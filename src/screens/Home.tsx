/** ===== Home.tsx ===== */
import { Link } from 'react-router-dom'
import { Header, AvatarStack } from '../components/ui.tsx'
import {
  IconQr, IconSend, IconCourt, IconTrophy, IconChart, IconStar, IconChevron, IconLive,
} from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { listClubs, listOpenMatches, listPlayers, listMyBookings, listLiveMatches, ME } from '../lib/db.ts'
import { friendlyDate, hourRange, money, SURFACE_LABEL } from '../lib/format.ts'
import type { Club, LiveMatch, OpenMatch, Player, Booking } from '../lib/types.ts'
import { scoreboard } from '../lib/scoring.ts'

export default function Home() {
  const { data } = useData(async () => {
    const [clubs, matches, players, bookings, live] = await Promise.all([
      listClubs(), listOpenMatches(), listPlayers(), listMyBookings(), listLiveMatches(),
    ])
    return { clubs, matches, players, bookings, live }
  }, [])

  const me = data?.players.find((p) => p.id === ME)
  const favourite = data?.clubs[0]
  const liveNow = data?.live.filter((m) => !m.finished_at) ?? []
  const upcoming = (data?.bookings ?? []).filter((b) => b.status === 'confirmed').slice(0, 2)
  const openMatches = (data?.matches ?? []).filter((m) => m.status === 'open').slice(0, 3)

  return (
    <>
      <Header
        right={
          <div style={{ display: 'flex' }}>
            <Link className="icon-btn" to="/live" aria-label="即時賽況"><IconQr /></Link>
            <Link className="icon-btn" to="/partners" aria-label="找球伴"><IconSend /></Link>
          </div>
        }
      />
      <div className="page">
        <div className="greeting">嗨，{me?.name ?? '球友'}！</div>

        {/* 首頁上半部照著常見運動 App 的排法：左邊一張大圖是主要動作，右邊兩張是次要入口 */}
        <div className="grid2">
          <Link to="/clubs" className="card tap hero tall">
            <div className="art" style={{ background: 'linear-gradient(150deg,#1e6fd9,#0d3f8f 55%,#0a2d66)' }}>
              <CourtArt />
            </div>
            <div className="badge"><IconCourt size={21} /></div>
            <div className="label"><b>預約球場</b><span>找場地，開始揮拍</span></div>
          </Link>

          <div className="stack">
            <Link to={favourite ? '/clubs/' + favourite.id : '/clubs'} className="card tap pad" style={{ minHeight: 106 }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <b style={{ fontSize: 15.5, lineHeight: 1.25, display: 'block' }}>常去球館</b>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                    {favourite?.name ?? '選一個'}
                  </span>
                </div>
                <IconStar size={20} filled />
              </div>
              {favourite && (
                <div className="row" style={{ marginTop: 10, gap: 6 }}>
                  <span className="pill">{SURFACE_LABEL[favourite.surface]}</span>
                  <span className="pill">{money(favourite.price_per_hour)}/hr</span>
                </div>
              )}
            </Link>

            <Link to="/partners" className="card tap hero" style={{ minHeight: 152 }}>
              <div className="art" style={{ background: 'linear-gradient(150deg,#2f9e6a,#0d4d30)' }}>
                <NetArt />
              </div>
              <div className="badge"><IconTrophy size={20} /></div>
              <div className="label"><b>找球伴</b><span>{openMatches.length} 場正在揪人</span></div>
            </Link>
          </div>
        </div>

        {/* 即時賽況 */}
        <div className="section-title">
          即時賽況
          <Link className="more" to="/live">全部 ›</Link>
        </div>
        {liveNow.length > 0 ? (
          <div className="stack-s">
            {liveNow.slice(0, 2).map((m) => (
              <LiveRow key={m.id} match={m} players={data!.players} />
            ))}
          </div>
        ) : (
          <div className="grid2">
            <Link to="/live/new" className="card tap tile">
              <b>開始計分</b>
              <span>記下每一分，朋友能同步看到</span>
              <div className="art-strip" style={{ background: 'linear-gradient(135deg,#eaf4ff,#d6e9ff)', color: 'var(--blue-deep)' }}>
                <IconLive size={26} />
              </div>
            </Link>
            <Link to="/profile" className="card tap tile">
              <b>戰績與統計</b>
              <span>看看這陣子打得如何</span>
              <div className="art-strip" style={{ background: 'linear-gradient(135deg,#f1f3f7,#e3e7ee)', color: 'var(--ink-2)' }}>
                <IconChart size={26} />
              </div>
            </Link>
          </div>
        )}

        {/* 近期球局 */}
        <div className="section-title">
          有人在揪球
          <Link className="more" to="/partners">全部 ›</Link>
        </div>
        <div className="card">
          {openMatches.length === 0 && (
            <div className="list-row"><small style={{ color: 'var(--ink-3)' }}>目前沒有開放球局</small></div>
          )}
          {openMatches.map((m) => (
            <OpenMatchRow key={m.id} match={m} clubs={data!.clubs} players={data!.players} />
          ))}
        </div>

        {/* 我的行程 */}
        <div className="section-title">
          接下來
          <Link className="more" to="/profile">我的 ›</Link>
        </div>
        <div className="card">
          {upcoming.length === 0 ? (
            <div className="list-row">
              <div className="grow">
                <b style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>還沒有預約</b>
                <small>先去訂一個場地吧</small>
              </div>
              <Link className="btn sm primary" to="/clubs">訂場</Link>
            </div>
          ) : (
            upcoming.map((b) => <BookingRow key={b.id} booking={b} clubs={data!.clubs} />)
          )}
        </div>

        <p className="note" style={{ textAlign: 'center', marginTop: 26, color: 'var(--ink-3)' }}>
          打球前記得暖身，量力而為 🎾
        </p>
      </div>
    </>
  )
}

function LiveRow({ match, players }: { match: LiveMatch; players: Player[] }) {
  const sb = scoreboard(match.state, match.format)
  const name = (ids: string[]) =>
    ids.map((id) => players.find((p) => p.id === id)?.name ?? '對手').join(' / ')
  return (
    <Link to={'/live/' + match.id} className="card tap pad">
      <div className="row between">
        <span className="pill live">LIVE</span>
        <small style={{ color: 'var(--ink-3)', fontSize: 12 }}>{match.spectators} 人在看</small>
      </div>
      <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
        {[0, 1].map((i) => (
          <div key={i} className="row between">
            <b style={{ fontSize: 14.5, fontWeight: sb.winner === i ? 800 : 600 }}>
              {name(i === 0 ? match.side_a : match.side_b)}
            </b>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ color: 'var(--ink-3)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {sb.sets.map((s) => s[i as 0 | 1]).join(' ')}
              </span>
              <b style={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {sb.points[i as 0 | 1]}
              </b>
            </div>
          </div>
        ))}
      </div>
    </Link>
  )
}

function OpenMatchRow({ match, clubs, players }: { match: OpenMatch; clubs: Club[]; players: Player[] }) {
  const club = clubs.find((c) => c.id === match.club_id)
  const joined = match.joined.map((id) => players.find((p) => p.id === id) ?? null)
  return (
    <Link to={'/partners/' + match.id} className="list-row">
      <AvatarStack players={joined} slots={match.slots} />
      <div className="grow">
        <b className="truncate">{club?.name ?? '球場'}</b>
        <small className="truncate">
          {friendlyDate(match.date)} {hourRange(match.hour)}・
          {match.kind === 'singles' ? '單打' : '雙打'}・NTRP {match.ntrp_min}–{match.ntrp_max}
        </small>
      </div>
      <span className="pill blue">缺 {match.slots - match.joined.length}</span>
      <IconChevron size={18} />
    </Link>
  )
}

function BookingRow({ booking, clubs }: { booking: Booking; clubs: Club[] }) {
  const club = clubs.find((c) => c.id === booking.club_id)
  return (
    <div className="list-row">
      <div
        className="avatar"
        style={{ background: club?.photo ?? '#ccc', borderRadius: 12, width: 42, height: 42 }}
      >
        <IconCourt size={20} />
      </div>
      <div className="grow">
        <b className="truncate">{club?.name}</b>
        <small>{friendlyDate(booking.date)} {hourRange(booking.hour)}</small>
      </div>
      <span className="pill ok">已確認</span>
    </div>
  )
}

/** 首頁大圖用 SVG 畫，避免外連圖片（離線也要好看）。 */
function CourtArt() {
  return (
    <svg viewBox="0 0 200 380" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"
      style={{ opacity: .5 }}>
      <g stroke="#fff" strokeWidth="2" fill="none">
        <rect x="34" y="46" width="132" height="288" rx="3" />
        <path d="M34 190h132M100 46v288M56 46v288M144 46v288M56 118h88M56 262h88" />
      </g>
      <circle cx="150" cy="96" r="9" fill="#d8f34a" opacity=".9" />
    </svg>
  )
}

function NetArt() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"
      style={{ opacity: .45 }}>
      <g stroke="#fff" strokeWidth="1.2" opacity=".8">
        {Array.from({ length: 14 }, (_, i) => <line key={'v' + i} x1={i * 15} y1="58" x2={i * 15} y2="122" />)}
        {Array.from({ length: 6 }, (_, i) => <line key={'h' + i} x1="0" y1={58 + i * 13} x2="200" y2={58 + i * 13} />)}
      </g>
      <line x1="0" y1="56" x2="200" y2="56" stroke="#fff" strokeWidth="4" />
      <circle cx="164" cy="34" r="11" fill="#d8f34a" opacity=".95" />
    </svg>
  )
}
