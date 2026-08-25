/** ===== InviteCompose.tsx =====
 * 選定球伴之後：挑球場、挑時間、寫一句話，送出。
 * 球場清單是對「兩個人」排序的，不是只看我近不近——只顧自己的話永遠約在自家門口，
 * 對方跑到厭世就不會想再約第二次。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header, Avatar, Empty, Sheet, KV } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconPin, IconStar } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { getAvailability, getMe, getPlayer, listClubs, sendInvite } from '../lib/db.ts'
import { rankClubs, isFreeOn, hoursIn, BLOCKS } from '../lib/match.ts'
import { km } from '../lib/geo.ts'
import { friendlyDate, hourRange, money, slotLabel, SURFACE_LABEL, todayISO } from '../lib/format.ts'
import type { TimeBlock } from '../lib/types.ts'

export default function InviteCompose() {
  const { playerId = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()

  const date = params.get('date') || todayISO()
  const block = (params.get('block') || 'evening') as TimeBlock

  const [clubId, setClubId] = useState<string | null>(null)
  const [hour, setHour] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  const { data } = useData(async () => {
    const [me, partner, clubs] = await Promise.all([getMe(), getPlayer(playerId), listClubs()])
    return { me, partner, clubs }
  }, [playerId])

  const fits = useMemo(() => {
    if (!data?.partner) return []
    return rankClubs(data.clubs, data.me, data.partner)
  }, [data])

  // 只有選定球場之後才需要知道那天還剩幾面場，一次抓一個球館就好
  const { data: slots } = useData(
    async () => (clubId ? getAvailability(clubId, date) : []),
    [clubId, date],
  )

  if (!data?.partner) {
    return (
      <>
        <Header title="邀約" onBack />
        <div className="page"><Empty emoji="🙋" title="找不到這位球友" /></div>
      </>
    )
  }

  const partner = data.partner
  const chosen = fits.find((f) => f.club.id === clubId)
  const partnerFree = isFreeOn(partner, date, block)
  const hourOptions = hoursIn(block).filter((h) => {
    if (!chosen) return false
    return h >= chosen.club.open_hour && h < chosen.club.close_hour
  })

  async function send() {
    if (!clubId || hour === null) return
    setSending(true)
    try {
      const inv = await sendInvite({
        to_id: partner.id, club_id: clubId, date, hour, message: message.trim(),
      })
      setConfirming(false)
      toast('邀約已送出，場地也幫你訂好了')
      nav('/invites/' + inv.id, { replace: true })
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Header title="約他打球" onBack />
      <div className="page">
        <div className="card pad" style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 12 }}>
            <Avatar player={partner} />
            <div className="grow" style={{ minWidth: 0 }}>
              <b style={{ fontSize: 17, fontWeight: 800 }}>{partner.name}</b>
              <div className="note">NTRP {partner.ntrp}・{partner.district}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="pill accent">{friendlyDate(date)} {BLOCKS[block].label}</span>
            {partnerFree
              ? <span className="pill ok">對方這個時段通常有空</span>
              : <span className="pill warn">對方這個時段通常沒空</span>}
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>約在哪裡</div>
        <p className="note" style={{ margin: '0 0 10px' }}>
          依「兩個人都方便」排序，不是只看離你多近。
        </p>
        <div className="stack-s" style={{ marginBottom: 18 }}>
          {fits.slice(0, 5).map((f) => {
            const on = f.club.id === clubId
            return (
              <button
                key={f.club.id}
                className="card pad"
                style={{
                  textAlign: 'left', display: 'block', width: '100%',
                  border: on ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                aria-pressed={on}
                onClick={() => { setClubId(on ? null : f.club.id); setHour(null) }}
              >
                <div className="row between">
                  <b style={{ fontSize: 15.5, fontWeight: 800 }}>{f.club.name}</b>
                  <span className={'pill ' + (f.prefMe && f.prefPartner ? 'ok' : 'accent')}>{f.tag}</span>
                </div>
                <div className="row" style={{ gap: 10, marginTop: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>
                  <span className="row" style={{ gap: 3 }}><IconPin size={13} />你 {km(f.fromMe)}</span>
                  <span className="row" style={{ gap: 3 }}><IconPin size={13} />{partner.name} {km(f.fromPartner)}</span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {f.club.surface && <span className="pill">{SURFACE_LABEL[f.club.surface]}</span>}
                  {f.club.indoor && <span className="pill">室內</span>}
                  {f.club.rating !== null && (
                    <span className="pill"><IconStar size={12} filled />{f.club.rating.toFixed(1)}</span>
                  )}
                  <span className="spacer" />
                  <b style={{ fontSize: 13.5 }}>
                    {money(f.club.price_per_hour)}
                    {f.club.price_per_hour !== null && f.club.price_per_hour > 0 && (
                      <small style={{ color: 'var(--ink-3)' }}> /hr</small>
                    )}
                  </b>
                </div>
              </button>
            )
          })}
        </div>

        {chosen && (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>幾點開打</div>
            <div className="slots" style={{ marginBottom: 18 }}>
              {hourOptions.map((h) => {
                const slot = (slots ?? []).find((s) => s.hour === h)
                const past = date === todayISO() && h <= new Date().getHours()
                // 自己已經記過的時段不能再選；別人記過的照樣可選
                const blocked = !slot || past || slot.minePresent
                const label = past ? '已過' : slot ? slotLabel(slot) : ''
                return (
                  <button
                    key={h}
                    className={'slot' + (blocked ? ' full' : '')}
                    aria-pressed={hour === h}
                    disabled={blocked}
                    onClick={() => setHour(hour === h ? null : h)}
                  >
                    <b>{String(h).padStart(2, '0')}:00</b>
                    {label && <small>{label}</small>}
                  </button>
                )
              })}
              {hourOptions.length === 0 && (
                <p className="note" style={{ gridColumn: '1 / -1' }}>
                  這個球場在{BLOCKS[block].label}沒有開放時段。
                </p>
              )}
            </div>

            <div className="field" style={{ marginBottom: 18 }}>
              <label>想說的話（選填）</label>
              <textarea
                value={message}
                maxLength={100}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={'嗨 ' + partner.name + '，看到我們程度差不多，要不要打一場？'}
              />
            </div>

            <button
              className="btn primary block"
              disabled={hour === null}
              onClick={() => setConfirming(true)}
            >
              {hour === null ? '選一個開打時間' : '訂場並送出邀約'}
            </button>
          </>
        )}
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="確認送出">
        <div className="card pad" style={{ marginBottom: 14 }}>
          <KV k="對象" v={partner.name} />
          <KV k="球館" v={chosen?.club.name ?? '—'} />
          <KV k="日期" v={friendlyDate(date)} />
          <KV k="時間" v={hour !== null ? hourRange(hour) : '—'} />
          <KV k="場地費" v={chosen ? money(chosen.club.price_per_hour) + '（現場均分）' : '—'} />
        </div>
        <p className="note" style={{ marginBottom: 14 }}>
          送出的同時就會把場地訂下來，好時段不先訂容易被搶走。
          對方拒絕的話，這筆預約會自動退掉。
        </p>
        <button className="btn primary block" disabled={sending} onClick={send}>
          {sending ? '送出中…' : '確認送出'}
        </button>
      </Sheet>
    </>
  )
}
