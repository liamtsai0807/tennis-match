/** ===== Home.tsx =====
 * 首頁只回答一件事：接下來我要跟誰、在哪、什麼時候打球。
 * 沒有球局的時候，最大的那張卡就是「找球伴」。
 */
import { Link } from 'react-router-dom'
import { Header, Avatar } from '../components/ui.tsx'
import { IconCourt, IconPeople, IconChevron, IconClock, IconPin } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { getMe, listClubs, listInvites, listMyBookings, listPlayers, myId } from '../lib/db.ts'
import { rankPartners, isFreeOn, BLOCKS } from '../lib/match.ts'
import { addDaysISO, friendlyDate, hourRange, todayISO } from '../lib/format.ts'
import type { Booking, Club, Invite, Player } from '../lib/types.ts'

export default function Home() {
  const { data } = useData(async () => {
    const [me, players, clubs, invites, bookings] = await Promise.all([
      getMe(), listPlayers(), listClubs(), listInvites(), listMyBookings(),
    ])
    return { me, players, clubs, invites, bookings }
  }, [])

  if (!data) return <><Header /><div className="page" /></>

  const { me, players, clubs, invites, bookings } = data
  const today = todayISO()

  const incoming = invites.filter((i) => i.to_id === myId() && i.status === 'pending')
  const outgoing = invites.filter((i) => i.from_id === myId() && i.status === 'pending')
  const confirmed = invites
    .filter((i) => i.status === 'accepted' && i.date >= today)
    .slice(0, 3)

  // 邀約已經涵蓋的場次不重複列，避免同一場球出現兩次
  const invitedBookingIds = new Set(invites.map((i) => i.booking_id))
  const soloBookings = bookings
    .filter((b) => b.status === 'confirmed' && b.date >= today && !invitedBookingIds.has(b.id))
    .slice(0, 2)

  // 首頁只給一個「今天最值得約的人」，完整名單在找球伴頁
  const block = me.availability.blocks[0] ?? 'evening'
  const suggestDate = nextFreeDate(me, block)
  const top = rankPartners(me, players, { date: suggestDate, block, loosen: false })
    .filter((f) => f.free)[0]

  return (
    <>
      <Header />
      <div className="page">
        <div className="greeting">嗨，{me.name}！</div>

        <Link to="/match" className="card tap hero" style={{ minHeight: 168, marginBottom: 14 }}>
          <div className="art" style={{ background: 'linear-gradient(150deg,#1e6fd9,#0d3f8f 55%,#0a2d66)' }}>
            <CourtArt />
          </div>
          <div className="badge"><IconPeople size={21} /></div>
          <div className="label">
            <b>找球伴</b>
            <span>NTRP {me.pref_ntrp_min}–{me.pref_ntrp_max}・{me.pref_club_ids.length} 個常去球場</span>
          </div>
        </Link>

        {top && (
          <Link to={'/match/' + top.player.id + '?date=' + suggestDate + '&block=' + block}
            className="card tap pad" style={{ marginBottom: 4 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>今天最合的人</div>
            <div className="row" style={{ gap: 12 }}>
              <Avatar player={top.player} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row between">
                  <b style={{ fontSize: 16, fontWeight: 800 }}>{top.player.name}</b>
                  <span className="pill ok">合適度 {top.score}</span>
                </div>
                <small className="note truncate" style={{ display: 'block', marginTop: 2 }}>
                  {top.reasons.slice(0, 2).join('・')}
                </small>
              </div>
              <IconChevron size={18} />
            </div>
            <div className="note" style={{ marginTop: 10 }}>
              建議約 {friendlyDate(suggestDate)}{BLOCKS[block].label}
            </div>
          </Link>
        )}

        {incoming.length > 0 && (
          <>
            <div className="section-title">
              有人約你
              <span className="pill warn">{incoming.length}</span>
            </div>
            <div className="card">
              {incoming.map((i) => (
                <InviteRow key={i.id} invite={i} clubs={clubs} players={players} side="from" />
              ))}
            </div>
          </>
        )}

        <div className="section-title">
          接下來
          <Link className="more" to="/profile">全部 ›</Link>
        </div>
        <div className="card">
          {confirmed.length === 0 && soloBookings.length === 0 && outgoing.length === 0 ? (
            <div className="list-row">
              <div className="grow">
                <b style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>還沒有安排</b>
                <small>找個球伴，或直接訂一個場地</small>
              </div>
              <Link className="btn sm primary" to="/match">找球伴</Link>
            </div>
          ) : (
            <>
              {confirmed.map((i) => (
                <InviteRow key={i.id} invite={i} clubs={clubs} players={players} side="other" />
              ))}
              {outgoing.map((i) => (
                <InviteRow key={i.id} invite={i} clubs={clubs} players={players} side="to" />
              ))}
              {soloBookings.map((b) => <BookingRow key={b.id} booking={b} clubs={clubs} />)}
            </>
          )}
        </div>

        <div className="section-title">
          直接訂場
          <Link className="more" to="/clubs">全部 ›</Link>
        </div>
        <div className="grid2">
          {me.pref_club_ids.slice(0, 2).map((id) => {
            const c = clubs.find((x) => x.id === id)
            if (!c) return null
            return (
              <Link key={id} to={'/clubs/' + id} className="card tap hero" style={{ minHeight: 118 }}>
                <div className="art" style={{ background: c.photo }} />
                <div className="label"><b style={{ fontSize: 15 }}>{c.name}</b><span>{c.district}</span></div>
              </Link>
            )
          })}
        </div>

        <p className="note" style={{ textAlign: 'center', marginTop: 26, color: 'var(--ink-3)' }}>
          打球前記得暖身，量力而為 🎾
        </p>
      </div>
    </>
  )
}

/** 從今天起第一個我有空的日子。首頁的建議日期用它，省得推薦一個我自己不能打的時間。 */
function nextFreeDate(me: Player, block: Parameters<typeof isFreeOn>[2]): string {
  for (let i = 0; i < 14; i++) {
    const d = addDaysISO(todayISO(), i)
    if (isFreeOn(me, d, block)) return d
  }
  return todayISO()
}

function InviteRow({
  invite, clubs, players, side,
}: { invite: Invite; clubs: Club[]; players: Player[]; side: 'from' | 'to' | 'other' }) {
  const club = clubs.find((c) => c.id === invite.club_id)
  const otherId = invite.from_id === myId() ? invite.to_id : invite.from_id
  const other = players.find((p) => p.id === otherId)
  const label = side === 'from' ? '約你' : side === 'to' ? '等回覆' : '約成了'
  return (
    <Link to={'/invites/' + invite.id} className="list-row">
      <Avatar player={other} />
      <div className="grow">
        <b className="truncate">{other?.name}・{club?.name}</b>
        <small className="truncate">
          <IconClock size={12} /> {friendlyDate(invite.date)} {hourRange(invite.hour)}
        </small>
      </div>
      <span className={'pill ' + (side === 'from' ? 'warn' : side === 'other' ? 'ok' : '')}>{label}</span>
      <IconChevron size={18} />
    </Link>
  )
}

function BookingRow({ booking, clubs }: { booking: Booking; clubs: Club[] }) {
  const club = clubs.find((c) => c.id === booking.club_id)
  return (
    <div className="list-row">
      <div className="avatar" style={{ background: club?.photo, borderRadius: 12 }}>
        <IconCourt size={19} />
      </div>
      <div className="grow">
        <b className="truncate">{club?.name}</b>
        <small><IconPin size={12} /> {friendlyDate(booking.date)} {hourRange(booking.hour)}・自己訂的場</small>
      </div>
      <span className="pill ok">已確認</span>
    </div>
  )
}

/** 首頁大圖用 SVG 畫，避免外連圖片。 */
function CourtArt() {
  return (
    <svg viewBox="0 0 200 170" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"
      style={{ opacity: .5 }}>
      <g stroke="#fff" strokeWidth="2" fill="none">
        <rect x="34" y="16" width="132" height="138" rx="3" />
        <path d="M34 85h132M100 16v138M56 16v138M144 16v138" />
      </g>
      <circle cx="150" cy="46" r="9" fill="#d8f34a" opacity=".9" />
    </svg>
  )
}
