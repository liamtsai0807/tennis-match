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
import { addDaysISO, friendlyDate, hourRange, mapsUrl, money, shortDate, slotLabel, SURFACE_LABEL, telHref, todayISO, weekday } from '../lib/format.ts'

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
              {club.rating !== null && (
                <span className="pill"><IconStar size={13} filled /> {club.rating.toFixed(1)}</span>
              )}
            </div>
            <div className="row" style={{ gap: 4, marginTop: 4, color: 'var(--ink-2)', fontSize: 13 }}>
              <IconPin size={15} /> {club.address}
            </div>
            {/* 分級收費一個數字裝不下，說明要放在看得到的地方 */}
            {club.price_note && (
              <p className="note price-note">
                <b>收費</b>{club.price_note}
              </p>
            )}
            <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {club.surface && <span className="pill">{SURFACE_LABEL[club.surface]}</span>}
              <span className="pill">{club.indoor ? '室內' : '戶外'}</span>
              {club.source !== 'opendata' && <span className="pill">{club.courts} 面場</span>}
              <span className="pill">{club.open_hour}:00–{club.close_hour}:00</span>
              {club.lights === true && <span className="pill">夜間照明</span>}
              {club.verified_on && (
                <span className="pill ok">已查證 {club.verified_on}</span>
              )}
              {club.source === 'opendata' && <span className="pill">細節未確認</span>}
            </div>

          </div>
        </div>

        {/*
          全台沒有任何場館提供訂場 API，我們代訂不了，這件事不會改變。
          所以這一段的責任是「把人送到真的訂得到的地方」，而且要是畫面上
          最顯眼的動作——以前它是一顆灰色小按鈕，埋在日期選擇器上面，
          結果使用者以為下面那個時段表就是訂場，按完才發現不算數。
        */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>怎麼訂到這個場</div>
        <div className="card pad stack-s" style={{ marginBottom: 22 }}>
          {club.booking_url ? (
            <>
              <a className="btn primary block" href={club.booking_url} target="_blank" rel="noreferrer">
                到官方系統訂場 ↗
              </a>
              <p className="note" style={{ margin: 0, textAlign: 'center' }}>
                這個場可以線上訂。訂完記得回來按「已經訂好了」，球伴才知道。
              </p>
            </>
          ) : club.phone ? (
            <>
              <a className="btn primary block" href={telHref(club.phone)}>
                打電話訂場　{club.phone}
              </a>
              <p className="note" style={{ margin: 0, textAlign: 'center' }}>
                這個場沒有線上訂場系統，只能電話預約。
              </p>
            </>
          ) : (
            <a className="btn primary block" href={mapsUrl(club.name, club.address)} target="_blank" rel="noreferrer">
              在地圖上開啟 ↗
            </a>
          )}

          {/* 主要動作以外的路，全部收在這裡，一個都不要漏掉 */}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            {club.booking_url && club.phone && (
              <a className="btn sm" href={telHref(club.phone)}>☎ {club.phone}</a>
            )}
            {club.website && (
              <a className="btn sm" href={club.website} target="_blank" rel="noreferrer">官方網站 ↗</a>
            )}
            <a className="btn sm" href={mapsUrl(club.name, club.address)} target="_blank" rel="noreferrer">
              地圖 ↗
            </a>
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>和球伴喬時間</div>
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
          {friendlyDate(date)}・哪些時段還沒有人卡
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
                <small>{past ? '已過' : slotLabel(s.free, club.source)}</small>
              </button>
            )
          })}
        </div>

        {hour !== null && (
          <div style={{ marginTop: 18 }} className="stack-s">
            <button className="btn block" onClick={() => setConfirming(true)}>
              {/* 價格不知道就別提——「・價格未提供」掛在按鈕上只是噪音 */}
              記下 {hourRange(hour)}
              {club.price_per_hour !== null && '・' + money(club.price_per_hour)}
            </button>
            {/* 警語要在按下去之前就看得到。放進確認面板等於先騙人再澄清 */}
            <p className="note" style={{ margin: 0, textAlign: 'center' }}>
              這只是記在 App 裡讓球伴對得上時間，<b>不會真的訂到場地</b>。
            </p>
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
        {/* 旁邊就放著一個真的訂場連結，不講清楚會有人以為這裡按了就訂到了 */}
        <p className="note warn-note" style={{ marginBottom: 14 }}>
          <b>這是 App 內部的紀錄，不會真的把場地訂下來。</b>
          它的用途是讓你和球伴對得上時間；場地要另外去球館的系統或打電話訂。
        </p>
        <p className="note" style={{ marginBottom: 14 }}>
          場地費現場付款。
        </p>
        <button className="btn primary block" disabled={saving} onClick={confirm}>
          {saving ? '處理中…' : '確認預約'}
        </button>
      </Sheet>
    </>
  )
}
