/** ===== BookingReport.tsx =====
 * 約成之後的訂場回報。
 *
 * App 內的預約一直只是「我們自己記著這個時段」，不是真的訂到場——臺灣沒有
 * 任何一家場館提供訂場 API，真正的訂場一定發生在別人的系統裡。所以這一段的
 * 工作是：把人送到對的地方、然後讓他回來說一聲。
 *
 * 三種球場長得不一樣，因為現實就是三種：
 *   有官方訂場系統（69 個裡的 18 個）→ 外連過去，回來按「我訂好了」
 *   免費而且能自由使用（16 個）      → 根本不用訂，不要浪費使用者的注意力
 *   沒有線上訂場（35 個，最多）      → 只能給地圖，靠電話或現場
 */
import { useState } from 'react'
import { mapsUrl, money } from '../lib/format.ts'
import { markBookedExternally, setBooker } from '../lib/db.ts'
import type { Club, Invite, Booking } from '../lib/types.ts'

interface Props {
  invite: Invite
  club: Club
  booking: Booking | null
  meId: string
  otherName: string
  busy: boolean
  setBusy: (v: boolean) => void
  toast: (msg: string, kind?: 'ok' | 'bad') => void
}

export function BookingReport({
  invite, club, booking, meId, otherName, busy, setBusy, toast,
}: Props) {
  const [ref, setRef] = useState('')

  const done = Boolean(booking?.external_confirmed_at)
  const mine = invite.booker_id === meId
  // 免費而且沒有線上系統的場，多半是「沒人預約就自由使用」——不要求訂場
  const freeWalkIn = club.price_per_hour === 0
  const hasSystem = Boolean(club.booking_url)

  async function report() {
    if (!booking) return
    setBusy(true)
    try {
      await markBookedExternally(booking.id, ref)
      toast('記下來了，' + otherName + ' 那邊會看到場地已確認')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function handOver() {
    setBusy(true)
    try {
      await setBooker(invite.id, mine ? (invite.from_id === meId ? invite.to_id : invite.from_id) : meId)
      toast(mine ? '換 ' + otherName + ' 去訂了' : '好，你去訂')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="pill ok">場地已確認</span>
          {booking?.external_ref && (
            <small style={{ color: 'var(--ink-3)', fontSize: 12 }}>
              訂單編號 {booking.external_ref}
            </small>
          )}
        </div>
        <p className="note" style={{ margin: '10px 0 0' }}>
          {booking?.external_by === meId ? '你' : otherName}已經在球館的系統訂好了。
          場地費 {money(club.price_per_hour)}，現場均分。
        </p>
      </div>
    )
  }

  if (freeWalkIn && !hasSystem) {
    return (
      <div className="card pad" style={{ marginBottom: 16 }}>
        <span className="pill ok">不用訂場</span>
        <p className="note" style={{ margin: '10px 0 0' }}>
          這個場免費，而且沒有人預約的時段開放現場自由使用。<b>直接去就好。</b>
        </p>
      </div>
    )
  }

  return (
    <div className="card pad stack-s" style={{ marginBottom: 16 }}>
      <div className="row between" style={{ alignItems: 'center' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 3 }}>誰去訂</div>
          <b style={{ fontSize: 15.5, fontWeight: 800 }}>{mine ? '你' : otherName}</b>
        </div>
        <button className="btn sm" disabled={busy} onClick={handOver}>
          {mine ? '改成 ' + otherName : '改成我'}
        </button>
      </div>

      {/*
        我們不代訂，也碰不到對方的帳號。能做的是把人送到精確的那一頁——
        送到首頁讓他自己找，跟沒給沒兩樣。
      */}
      <a
        className="btn block"
        href={club.booking_url ?? mapsUrl(club.name, club.address)}
        target="_blank"
        rel="noreferrer"
      >
        {hasSystem ? '到官方系統訂場 ↗' : '在地圖上開啟 ↗'}
      </a>
      <p className="note" style={{ margin: 0, textAlign: 'center' }}>
        {hasSystem
          ? '要先在對方系統註冊會員。我們不代訂，也不碰你的帳號。'
          : '這個場沒有線上訂場，地圖上有電話與營業時間。'}
      </p>

      {mine && (
        <>
          <button className="btn primary block" disabled={busy || !booking} onClick={report}>
            我訂好了
          </button>

          {/* 編號刻意是選填。要人抄一串英數字回來，多數人不會做，
              而我們真正需要知道的只有「訂了沒」 */}
          <div className="row" style={{ gap: 9 }}>
            <input
              value={ref}
              maxLength={40}
              onChange={(e) => setRef(e.target.value)}
              placeholder="訂單編號（選填）"
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <p className="note" style={{ margin: 0 }}>
            按「我訂好了」{otherName} 就會看到場地已確認。
            編號可以不填——現場真的對不上時才用得到。
          </p>
        </>
      )}

      {!mine && (
        <p className="note" style={{ margin: 0 }}>
          說好由 {otherName} 去訂。他訂完你這邊會自動更新；如果他一直沒動，
          你可以按上面「改成我」自己去訂。
        </p>
      )}
    </div>
  )
}
