/** ===== ClubDetail.tsx =====
 * 訂場流程：選日期 → 選時段 → 確認。刻意做成一頁到底，不換頁，
 * 因為訂場是最常用的動作，多一次跳轉就多一次流失。
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Header, Sheet, KV, Empty } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconPin, IconStar, IconShare } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { createBooking, getAvailability, getClub } from '../lib/db.ts'
import { addDaysISO, friendlyDate, hourRange, money, shortDate, SURFACE_LABEL, todayISO, weekday } from '../lib/format.ts'

const DAYS_AHEAD = 14

export default function ClubDetail() {
  const { clubId = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()

  const [date, setDate] = useState(todayISO())
  const [hour, setHour] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data } = useData(async () => {
    const club = await getClub(clubId)
    const slots = club ? await getAvailability(clubId, date) : []
    return { club, slots }
  }, [clubId, date])

  const club = data?.club
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysISO(todayISO(), i))

  // 今天的話，已經過去的時段就不該還能點
  const nowHour = new Date().getHours()
  const isToday = date === todayISO()

  async function confirm() {
    if (hour === null || !club) return
    setSaving(true)
    try {
      await createBooking({ club_id: club.id, date, hour })
      setConfirming(false)
      setHour(null)
      toast('訂場成功！已加進你的行程')
      nav('/profile')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  if (!club) {
    return (
      <>
        <Header title="球場" onBack />
        <div className="page"><Empty emoji="🎾" title="載入中…" /></div>
      </>
    )
  }

  return (
    <>
      <Header title={club.name} onBack right={
        <button className="icon-btn" aria-label="分享" onClick={() => toast('已複製球館資訊')}>
          <IconShare />
        </button>
      } />
      <div className="page">
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ height: 130, background: club.photo }} />
          <div style={{ padding: '12px 15px 15px' }}>
            <div className="row between">
              <b style={{ fontSize: 19, fontWeight: 800 }}>{club.name}</b>
              <span className="pill"><IconStar size={13} filled /> {club.rating.toFixed(1)}</span>
            </div>
            <div className="row" style={{ gap: 4, marginTop: 4, color: 'var(--ink-2)', fontSize: 13 }}>
              <IconPin size={15} /> {club.address}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <span className="pill">{SURFACE_LABEL[club.surface]}</span>
              <span className="pill">{club.indoor ? '室內' : '戶外'}</span>
              <span className="pill">{club.courts} 面場</span>
              <span className="pill">{club.open_hour}:00–{club.close_hour}:00</span>
              {club.lights && <span className="pill">夜間照明</span>}
            </div>
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>選日期</div>
        <div className="daystrip" style={{ marginBottom: 18 }}>
          {days.map((d) => (
            <button
              key={d}
              className="day"
              aria-pressed={d === date}
              onClick={() => { setDate(d); setHour(null) }}
            >
              <small>{weekday(d)}</small>
              <b>{shortDate(d).split('/')[1]}</b>
            </button>
          ))}
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {friendlyDate(date)}・剩餘場地
        </div>
        <div className="slots">
          {(data?.slots ?? []).map((s) => {
            const past = isToday && s.hour <= nowHour
            const full = s.free === 0 || past
            return (
              <button
                key={s.hour}
                className={'slot' + (full ? ' full' : '')}
                aria-pressed={hour === s.hour}
                disabled={full}
                onClick={() => setHour(s.hour === hour ? null : s.hour)}
              >
                <b>{String(s.hour).padStart(2, '0')}:00</b>
                <small>{past ? '已過' : s.free === 0 ? '額滿' : '剩 ' + s.free + ' 面'}</small>
              </button>
            )
          })}
        </div>

        {hour !== null && (
          <div style={{ marginTop: 18 }} className="stack">
            <button className="btn primary block" onClick={() => setConfirming(true)}>
              預約 {hourRange(hour)}・{money(club.price_per_hour)}
            </button>
          </div>
        )}
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="確認預約">
        <div className="card pad" style={{ marginBottom: 14 }}>
          <KV k="球館" v={club.name} />
          <KV k="日期" v={friendlyDate(date)} />
          <KV k="時間" v={hour !== null ? hourRange(hour) : '—'} />
          <KV k="場地費" v={money(club.price_per_hour)} />
        </div>
        <p className="note" style={{ marginBottom: 14 }}>
          場地費現場付款。開打前 2 小時內取消恕不退費，這是球館的規定。
        </p>
        <button className="btn primary block" disabled={saving} onClick={confirm}>
          {saving ? '處理中…' : '確認預約'}
        </button>
      </Sheet>
    </>
  )
}
