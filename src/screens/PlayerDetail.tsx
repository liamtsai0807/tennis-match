/** ===== PlayerDetail.tsx ===== */
import { Link, useParams } from 'react-router-dom'
import { Header, Avatar, Empty, KV } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconChevron } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { getPlayer, listClubs, listOpenMatches, ME } from '../lib/db.ts'
import { friendlyDate, hourRange, ntrpLabel } from '../lib/format.ts'

export default function PlayerDetail() {
  const { playerId = '' } = useParams()
  const toast = useToast()

  const { data } = useData(async () => {
    const [player, matches, clubs] = await Promise.all([
      getPlayer(playerId), listOpenMatches(), listClubs(),
    ])
    return { player, matches, clubs }
  }, [playerId])

  const p = data?.player
  if (!p) {
    return (
      <>
        <Header title="球友" onBack />
        <div className="page"><Empty emoji="🙋" title="找不到這位球友" /></div>
      </>
    )
  }

  const theirMatches = (data?.matches ?? []).filter(
    (m) => m.joined.includes(p.id) && m.status !== 'cancelled',
  )
  const total = p.wins + p.losses
  const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0

  return (
    <>
      <Header title={p.name} onBack />
      <div className="page">
        <div className="card pad" style={{ marginBottom: 14, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Avatar player={p} size="lg" />
          </div>
          <b style={{ fontSize: 21, fontWeight: 800 }}>{p.name}</b>
          <div className="note" style={{ marginTop: 4 }}>{ntrpLabel(p.ntrp)}・{p.district}</div>
          {p.bio && <p className="note" style={{ marginTop: 12 }}>{p.bio}</p>}
        </div>

        <div className="card pad" style={{ marginBottom: 14 }}>
          <KV k="慣用手" v={p.hand === 'left' ? '左手' : '右手'} />
          <KV k="戰績" v={p.wins + ' 勝 ' + p.losses + ' 敗'} />
          <KV k="勝率" v={winRate + '%'} />
        </div>

        {theirMatches.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>接下來的球局</div>
            <div className="card" style={{ marginBottom: 16 }}>
              {theirMatches.map((m) => {
                const club = data!.clubs.find((c) => c.id === m.club_id)
                return (
                  <Link key={m.id} to={'/partners/' + m.id} className="list-row">
                    <div className="grow">
                      <b className="truncate">{club?.name}</b>
                      <small>{friendlyDate(m.date)} {hourRange(m.hour)}・{m.kind === 'singles' ? '單打' : '雙打'}</small>
                    </div>
                    {m.status === 'open' && <span className="pill warn">缺 {m.slots - m.joined.length}</span>}
                    <IconChevron size={18} />
                  </Link>
                )
              })}
            </div>
          </>
        )}

        {p.id !== ME && (
          <button className="btn primary block" onClick={() => toast('已送出邀請，等對方回覆')}>
            邀他一起打球
          </button>
        )}
      </div>
    </>
  )
}
