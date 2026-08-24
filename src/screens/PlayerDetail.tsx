/** ===== PlayerDetail.tsx ===== */
import { Link, useParams } from 'react-router-dom'
import { Header, Avatar, Empty, KV } from '../components/ui.tsx'
import { useData } from '../lib/useData.ts'
import { getMe, getPlayer, listClubs, myId } from '../lib/db.ts'
import { BLOCKS, WEEKDAY_LABEL } from '../lib/match.ts'
import { distanceKm, km } from '../lib/geo.ts'
import { ntrpLabel } from '../lib/format.ts'

export default function PlayerDetail() {
  const { playerId = '' } = useParams()

  const { data } = useData(async () => {
    const [player, me, clubs] = await Promise.all([getPlayer(playerId), getMe(), listClubs()])
    return { player, me, clubs }
  }, [playerId])

  const p = data?.player
  if (!p || !data?.me) {
    return (
      <>
        <Header title="球友" onBack />
        <div className="page"><Empty emoji="🙋" title="找不到這位球友" /></div>
      </>
    )
  }

  const me = data.me
  const isMe = p.id === myId()
  const total = p.wins + p.losses
  const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0
  const shared = me.pref_club_ids.filter((id) => p.pref_club_ids.includes(id))

  return (
    <>
      <Header title={p.name} onBack />
      <div className="page">
        <div className="card pad" style={{ marginBottom: 14, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Avatar player={p} size="lg" />
          </div>
          <b style={{ fontSize: 21, fontWeight: 800 }}>{p.name}</b>
          <div className="note" style={{ marginTop: 4 }}>
            {ntrpLabel(p.ntrp)}・{p.district}
            {!isMe && '・離你 ' + km(distanceKm(me, p))}
          </div>
          {p.bio && <p className="note" style={{ marginTop: 12 }}>{p.bio}</p>}
        </div>

        <div className="card pad" style={{ marginBottom: 14 }}>
          <KV k="慣用手" v={p.hand === 'left' ? '左手' : '右手'} />
          <KV k="戰績" v={p.wins + ' 勝 ' + p.losses + ' 敗（' + winRate + '%）'} />
          <KV
            k="有空的時間"
            v={p.availability.weekdays.map((d) => WEEKDAY_LABEL[d]).join('、') + ' ' +
               p.availability.blocks.map((b) => BLOCKS[b].label).join('、')}
          />
          <KV k="想找的程度" v={'NTRP ' + p.pref_ntrp_min + ' – ' + p.pref_ntrp_max} />
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>常去的球場</div>
        <div className="card" style={{ marginBottom: 16 }}>
          {p.pref_club_ids.map((id) => {
            const club = data.clubs.find((c) => c.id === id)
            if (!club) return null
            const isShared = shared.includes(id)
            return (
              <Link key={id} to={'/clubs/' + id} className="list-row">
                <div className="grow">
                  <b className="truncate">{club.name}</b>
                  <small>{club.district}・離{isMe ? '你' : '他'} {km(distanceKm(p, club))}</small>
                </div>
                {isShared && !isMe && <span className="pill accent">你也常去</span>}
              </Link>
            )
          })}
        </div>

        {!isMe && (
          <Link className="btn primary block" to={'/match/' + p.id}>約他打球</Link>
        )}
      </div>
    </>
  )
}
