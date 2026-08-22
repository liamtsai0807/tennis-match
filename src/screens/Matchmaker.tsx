/** ===== Matchmaker.tsx =====
 * 找球伴的主畫面：選一天 + 一個時段，看誰適合。
 * 預設值直接吃登錄時填的偏好，所以多數情況打開就有結果，不用先設定什麼。
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Avatar, Empty } from '../components/ui.tsx'
import { IconChevron, IconPin, IconClock } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { getMe, listClubs, listPlayers } from '../lib/db.ts'
import { rankPartners, isFreeOn, BLOCKS, BLOCK_ORDER } from '../lib/match.ts'
import { km } from '../lib/geo.ts'
import { addDaysISO, friendlyDate, shortDate, todayISO, weekday } from '../lib/format.ts'
import type { Player, TimeBlock } from '../lib/types.ts'

const DAYS_AHEAD = 14

/** 從今天起找第一天「我自己有空」的日子當預設，省掉使用者一次點擊。 */
function firstFreeDate(me: Player, block: TimeBlock): string {
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = addDaysISO(todayISO(), i)
    if (isFreeOn(me, d, block)) return d
  }
  return todayISO()
}

export default function Matchmaker() {
  const { data } = useData(async () => {
    const [me, players, clubs] = await Promise.all([getMe(), listPlayers(), listClubs()])
    return { me, players, clubs }
  }, [])

  const [block, setBlock] = useState<TimeBlock | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [loosen, setLoosen] = useState(false)

  const me = data?.me
  // 沒手動選的話，用偏好推出來的預設值
  const activeBlock = block ?? me?.availability.blocks[0] ?? 'evening'
  const activeDate = date ?? (me ? firstFreeDate(me, activeBlock) : todayISO())

  const fits = useMemo(() => {
    if (!me) return []
    return rankPartners(me, data!.players, { date: activeDate, block: activeBlock, loosen })
  }, [me, data?.players, activeDate, activeBlock, loosen])

  const strict = useMemo(() => {
    if (!me) return []
    return rankPartners(me, data!.players, { date: activeDate, block: activeBlock, loosen: false })
  }, [me, data?.players, activeDate, activeBlock])

  if (!me) return <><Header title="找球伴" /><div className="page" /></>

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysISO(todayISO(), i))
  const freeCount = fits.filter((f) => f.free).length
  const iAmFree = isFreeOn(me, activeDate, activeBlock)

  return (
    <>
      <Header title="找球伴" />
      <div className="page">
        <div className="eyebrow" style={{ marginBottom: 8 }}>哪一天</div>
        <div className="daystrip" style={{ marginBottom: 16 }}>
          {days.map((d) => (
            <button
              key={d}
              className="day"
              aria-pressed={d === activeDate}
              onClick={() => setDate(d)}
            >
              <small>{weekday(d)}</small>
              <b>{shortDate(d).split('/')[1]}</b>
              {isFreeOn(me, d, activeBlock) && <i className="dot" />}
            </button>
          ))}
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>什麼時候</div>
        <div className="segmented" style={{ marginBottom: 16 }}>
          {BLOCK_ORDER.map((b) => (
            <button key={b} aria-pressed={b === activeBlock} onClick={() => setBlock(b)}>
              {BLOCKS[b].label}
            </button>
          ))}
        </div>

        {!iAmFree && (
          <div className="card pad" style={{ marginBottom: 14, background: '#fff8ec' }}>
            <p className="note" style={{ margin: 0 }}>
              你設定的有空時段裡沒有「{friendlyDate(activeDate)} {BLOCKS[activeBlock].label}」。
              還是可以約，只是別忘了自己那天行不行。
            </p>
          </div>
        )}

        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="eyebrow">
            {friendlyDate(activeDate)}{BLOCKS[activeBlock].label}・{freeCount} 位有空
          </div>
          {strict.length < 3 && (
            <button
              className="pill blue"
              aria-pressed={loosen}
              onClick={() => setLoosen(!loosen)}
            >
              {loosen ? '只看符合程度的' : '放寬程度範圍'}
            </button>
          )}
        </div>

        {fits.length === 0 ? (
          <Empty
            emoji="🎾"
            title="這個條件下沒有人"
            hint={'你想找 NTRP ' + me.pref_ntrp_min + '–' + me.pref_ntrp_max +
              ' 的球友。換個時段，或到「我的」把範圍調寬一點。'}
          />
        ) : (
          <div className="stack">
            {fits.map((f) => (
              <Link
                key={f.player.id}
                to={'/match/' + f.player.id + '?date=' + activeDate + '&block=' + activeBlock}
                className="card tap pad"
              >
                <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  <Avatar player={f.player} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row between">
                      <b style={{ fontSize: 16, fontWeight: 800 }}>{f.player.name}</b>
                      <span className={'pill ' + (f.score >= 70 ? 'ok' : f.score >= 45 ? 'blue' : '')}>
                        合適度 {f.score}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 10, marginTop: 3, color: 'var(--ink-2)', fontSize: 12.5 }}>
                      <span>NTRP {f.player.ntrp}</span>
                      <span className="row" style={{ gap: 3 }}><IconPin size={13} />{km(f.distanceKm)}</span>
                      {!f.levelOk && <span className="pill warn">超出你設的範圍</span>}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {f.free
                    ? <span className="pill ok"><IconClock size={12} />{BLOCKS[activeBlock].label}有空</span>
                    : <span className="pill"><IconClock size={12} />平常這時段沒空</span>}
                  {f.sharedClubIds.length > 0 && (
                    <span className="pill blue">
                      共同球場 {f.sharedClubIds
                        .map((id) => data!.clubs.find((c) => c.id === id)?.name.replace(/（.*）/, ''))
                        .filter(Boolean).join('、')}
                    </span>
                  )}
                  {f.mutual && <span className="pill">對方也在找你這個程度</span>}
                </div>

                <div className="row between" style={{ marginTop: 10 }}>
                  <small className="note truncate" style={{ margin: 0 }}>{f.player.bio}</small>
                  <IconChevron size={18} />
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="note" style={{ textAlign: 'center', marginTop: 20, color: 'var(--ink-3)' }}>
          合適度看程度、共同球場、時段和距離四項算出來，點進去可以看細節。
        </p>
      </div>
    </>
  )
}
