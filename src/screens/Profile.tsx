/** ===== Profile.tsx =====
 * 「我的」＝我的邀約、我的預約、以及登錄時填的那些偏好（可以隨時改）。
 */
import { Link } from 'react-router-dom'
import { Header, Avatar } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconCourt, IconChevron } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import {
  cancelBooking, getMe, listClubs, listInvites, listMyBookings, listPlayers,
  resetDemoData, ME, OFFLINE,
} from '../lib/db.ts'
import { BLOCKS, WEEKDAY_LABEL } from '../lib/match.ts'
import { friendlyDate, hourRange, money, ntrpLabel, todayISO } from '../lib/format.ts'
import type { Invite } from '../lib/types.ts'

const STATUS: Record<Invite['status'], { text: string; cls: string }> = {
  pending: { text: '等待回覆', cls: 'warn' },
  accepted: { text: '約成了', cls: 'ok' },
  declined: { text: '已婉拒', cls: '' },
  cancelled: { text: '已取消', cls: '' },
}

export default function Profile() {
  const toast = useToast()
  const { data } = useData(async () => {
    const [me, players, bookings, clubs, invites] = await Promise.all([
      getMe(), listPlayers(), listMyBookings(), listClubs(), listInvites(),
    ])
    return { me, players, bookings, clubs, invites }
  }, [])

  if (!data) return <><Header title="我的" /><div className="page" /></>

  const { me, players, bookings, clubs, invites } = data
  const today = todayISO()

  const live = invites.filter((i) => i.status === 'pending' || (i.status === 'accepted' && i.date >= today))
  const invitedBookingIds = new Set(invites.map((i) => i.booking_id))
  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && b.date >= today && !invitedBookingIds.has(b.id),
  )

  const total = me.wins + me.losses
  const winRate = total > 0 ? Math.round((me.wins / total) * 100) : 0

  async function onCancel(id: string) {
    if (!confirm('確定取消這筆預約？')) return
    await cancelBooking(id)
    toast('預約已取消')
  }

  return (
    <>
      <Header title="我的" />
      <div className="page">
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 14 }}>
            <Avatar player={me} size="lg" />
            <div className="grow" style={{ minWidth: 0 }}>
              <b style={{ fontSize: 20, fontWeight: 800 }}>{me.name}</b>
              <div className="note">{ntrpLabel(me.ntrp)}・{me.district}</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 16, textAlign: 'center' }}>
            <Stat label="勝場" value={String(me.wins)} />
            <Stat label="敗場" value={String(me.losses)} />
            <Stat label="勝率" value={winRate + '%'} />
            <Stat label="進行中" value={String(live.length)} />
          </div>
        </div>

        <div className="section-title">我的邀約</div>
        <div className="card">
          {live.length === 0 ? (
            <div className="list-row">
              <div className="grow">
                <b style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>目前沒有邀約</b>
                <small>去找一個程度相近的球友吧</small>
              </div>
              <Link className="btn sm primary" to="/match">找球伴</Link>
            </div>
          ) : (
            live.map((i) => {
              const otherId = i.from_id === ME ? i.to_id : i.from_id
              const other = players.find((p) => p.id === otherId)
              const club = clubs.find((c) => c.id === i.club_id)
              const s = STATUS[i.status]
              return (
                <Link key={i.id} to={'/invites/' + i.id} className="list-row">
                  <Avatar player={other} />
                  <div className="grow">
                    <b className="truncate">
                      {i.from_id === ME ? '你約 ' : ''}{other?.name}{i.to_id === ME ? ' 約你' : ''}
                    </b>
                    <small className="truncate">
                      {club?.name}・{friendlyDate(i.date)} {hourRange(i.hour)}
                    </small>
                  </div>
                  <span className={'pill ' + s.cls}>{s.text}</span>
                  <IconChevron size={18} />
                </Link>
              )
            })
          )}
        </div>

        <div className="section-title">自己訂的場</div>
        <div className="card">
          {upcoming.length === 0 ? (
            <div className="list-row">
              <div className="grow">
                <b style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>沒有單獨訂的場</b>
                <small>邀約訂的場列在上面那一區</small>
              </div>
              <Link className="btn sm primary" to="/clubs">訂場</Link>
            </div>
          ) : (
            upcoming.map((b) => {
              const club = clubs.find((c) => c.id === b.club_id)
              return (
                <div key={b.id} className="list-row">
                  <div className="avatar" style={{ background: club?.photo, borderRadius: 12 }}>
                    <IconCourt size={19} />
                  </div>
                  <div className="grow">
                    <b className="truncate">{club?.name}</b>
                    <small>{friendlyDate(b.date)} {hourRange(b.hour)}・{club ? money(club.price_per_hour) : ''}</small>
                  </div>
                  <button className="btn sm danger" onClick={() => onCancel(b.id)}>取消</button>
                </div>
              )
            })
          )}
        </div>

        <div className="section-title">
          我的偏好
          <Link className="more" to="/profile/preferences">修改 ›</Link>
        </div>
        <div className="card">
          <div className="list-row">
            <div className="grow">
              <b>想找的程度</b>
              <small>NTRP {me.pref_ntrp_min} – {me.pref_ntrp_max}</small>
            </div>
          </div>
          <div className="list-row">
            <div className="grow">
              <b>有空的時間</b>
              <small>
                {me.availability.weekdays.map((d) => WEEKDAY_LABEL[d]).join('、')}
                {'　'}
                {me.availability.blocks.map((b) => BLOCKS[b].label).join('、')}
              </small>
            </div>
          </div>
          <Link to="/profile/preferences" className="list-row">
            <div className="grow">
              <b>常去的球場</b>
              <small className="truncate">
                {me.pref_club_ids.map((id) => clubs.find((c) => c.id === id)?.name).filter(Boolean).join('、') || '還沒選'}
              </small>
            </div>
            <IconChevron size={18} />
          </Link>
        </div>

        <div className="section-title">設定</div>
        <div className="card">
          <div className="list-row">
            <div className="grow">
              <b>資料來源</b>
              <small>{OFFLINE ? '離線示範資料（存在這台裝置）' : '已連線 Supabase'}</small>
            </div>
            <span className={'pill ' + (OFFLINE ? '' : 'ok')}>{OFFLINE ? '離線' : '線上'}</span>
          </div>
          {OFFLINE && (
            <button
              className="list-row"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => {
                if (!confirm('會把偏好設定、邀約、預約全部清掉，重新走一次登錄流程。')) return
                resetDemoData()
                location.href = '/'
              }}
            >
              <div className="grow">
                <b>重設示範資料</b>
                <small>連偏好設定一起清掉，重新走登錄流程</small>
              </div>
              <IconChevron size={18} />
            </button>
          )}
        </div>

        <p className="note" style={{ textAlign: 'center', marginTop: 20, color: 'var(--ink-3)' }}>
          TennisPal・場地費與規則以各球館現場公告為準
        </p>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <b style={{ display: 'block', fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
      <small style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{label}</small>
    </div>
  )
}
