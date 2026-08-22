/** ===== Profile.tsx =====
 * 「我的」＝個人資料 + 行程（預約與球局）+ 設定。
 * 行程不另開分頁，因為使用者真正想知道的只有「我接下來要去哪打球」。
 */
import { Link } from 'react-router-dom'
import { Header, Avatar } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconCourt, IconChevron } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import {
  cancelBooking, listClubs, listLiveMatches, listMyBookings, listOpenMatches,
  listPlayers, resetDemoData, ME, OFFLINE,
} from '../lib/db.ts'
import { friendlyDate, hourRange, money, ntrpLabel, todayISO } from '../lib/format.ts'
import { formatFinalScore } from '../lib/scoring.ts'

export default function Profile() {
  const toast = useToast()
  const { data } = useData(async () => {
    const [players, bookings, clubs, matches, live] = await Promise.all([
      listPlayers(), listMyBookings(), listClubs(), listOpenMatches(), listLiveMatches(),
    ])
    return { players, bookings, clubs, matches, live }
  }, [])

  const me = data?.players.find((p) => p.id === ME)
  const today = todayISO()
  const upcoming = (data?.bookings ?? []).filter((b) => b.status === 'confirmed' && b.date >= today)
  const myMatches = (data?.matches ?? []).filter((m) => m.joined.includes(ME))
  const myFinished = (data?.live ?? []).filter(
    (m) => m.finished_at && [...m.side_a, ...m.side_b].includes(ME),
  )

  async function onCancel(id: string) {
    if (!confirm('確定取消這筆預約？')) return
    await cancelBooking(id)
    toast('預約已取消')
  }

  const total = (me?.wins ?? 0) + (me?.losses ?? 0)
  const winRate = total > 0 ? Math.round(((me?.wins ?? 0) / total) * 100) : 0

  return (
    <>
      <Header title="我的" />
      <div className="page">
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 14 }}>
            <Avatar player={me} size="lg" />
            <div className="grow" style={{ minWidth: 0 }}>
              <b style={{ fontSize: 20, fontWeight: 800 }}>{me?.name}</b>
              <div className="note">{me ? ntrpLabel(me.ntrp) : ''}・{me?.district}</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 16, textAlign: 'center' }}>
            <Stat label="勝場" value={String(me?.wins ?? 0)} />
            <Stat label="敗場" value={String(me?.losses ?? 0)} />
            <Stat label="勝率" value={winRate + '%'} />
            <Stat label="球局" value={String(myMatches.length)} />
          </div>
          {me?.bio && <p className="note" style={{ marginTop: 14, marginBottom: 0 }}>{me.bio}</p>}
        </div>

        <div className="section-title" style={{ marginTop: 22 }}>我的預約</div>
        <div className="card">
          {upcoming.length === 0 ? (
            <div className="list-row">
              <div className="grow">
                <b style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>還沒有預約</b>
                <small>去球場頁挑一個時段</small>
              </div>
              <Link className="btn sm primary" to="/clubs">訂場</Link>
            </div>
          ) : (
            upcoming.map((b) => {
              const club = data!.clubs.find((c) => c.id === b.club_id)
              return (
                <div key={b.id} className="list-row">
                  <div className="avatar" style={{ background: club?.photo, borderRadius: 12 }}>
                    <IconCourt size={19} />
                  </div>
                  <div className="grow">
                    <b className="truncate">{club?.name}</b>
                    <small>{friendlyDate(b.date)} {hourRange(b.hour)}・{b.players} 人・{club ? money(club.price_per_hour) : ''}</small>
                  </div>
                  <button className="btn sm danger" onClick={() => onCancel(b.id)}>取消</button>
                </div>
              )
            })
          )}
        </div>

        <div className="section-title" style={{ marginTop: 22 }}>我參加的球局</div>
        <div className="card">
          {myMatches.length === 0 ? (
            <div className="list-row">
              <div className="grow">
                <b style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 14 }}>還沒加入任何球局</b>
                <small>去球伴頁找找看</small>
              </div>
              <Link className="btn sm primary" to="/partners">找球局</Link>
            </div>
          ) : (
            myMatches.map((m) => {
              const club = data!.clubs.find((c) => c.id === m.club_id)
              return (
                <Link key={m.id} to={'/partners/' + m.id} className="list-row">
                  <div className="grow">
                    <b className="truncate">{club?.name}</b>
                    <small>{friendlyDate(m.date)} {hourRange(m.hour)}・{m.kind === 'singles' ? '單打' : '雙打'}</small>
                  </div>
                  {m.host_id === ME && <span className="pill blue">主揪</span>}
                  <IconChevron size={18} />
                </Link>
              )
            })
          )}
        </div>

        {myFinished.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 22 }}>最近的比賽</div>
            <div className="card">
              {myFinished.slice(0, 5).map((m) => {
                const iWon = (m.state.winner === 0 && m.side_a.includes(ME)) ||
                  (m.state.winner === 1 && m.side_b.includes(ME))
                return (
                  <Link key={m.id} to={'/live/' + m.id} className="list-row">
                    <span className={'pill ' + (iWon ? 'ok' : 'danger')}>{iWon ? '勝' : '敗'}</span>
                    <div className="grow">
                      <b className="truncate">{m.title}</b>
                      <small>{formatFinalScore(m.state)}</small>
                    </div>
                    <IconChevron size={18} />
                  </Link>
                )
              })}
            </div>
          </>
        )}

        <div className="section-title" style={{ marginTop: 22 }}>設定</div>
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
              onClick={() => { resetDemoData(); toast('示範資料已重設') }}
            >
              <div className="grow">
                <b>重設示範資料</b>
                <small>把預約、球局、比賽全部清回初始狀態</small>
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
