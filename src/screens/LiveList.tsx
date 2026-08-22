/** ===== LiveList.tsx ===== */
import { Link } from 'react-router-dom'
import { Header, Empty } from '../components/ui.tsx'
import { Scoreboard } from '../components/Scoreboard.tsx'
import { IconPlus } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { listLiveMatches, listPlayers, listClubs } from '../lib/db.ts'
import { formatFinalScore } from '../lib/scoring.ts'

export default function LiveList() {
  const { data } = useData(async () => {
    const [matches, players, clubs] = await Promise.all([listLiveMatches(), listPlayers(), listClubs()])
    return { matches, players, clubs }
  }, [])

  const live = (data?.matches ?? []).filter((m) => !m.finished_at)
  const done = (data?.matches ?? []).filter((m) => m.finished_at)

  return (
    <>
      <Header title="賽況" right={
        <Link className="icon-btn" to="/live/new" aria-label="開新比賽"><IconPlus /></Link>
      } />
      <div className="page">
        {live.length === 0 && done.length === 0 ? (
          <Empty emoji="📣" title="還沒有比賽" hint="開一場比賽，朋友就能同步看到比分" />
        ) : null}

        {live.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 10 }}>進行中</div>
            <div className="stack" style={{ marginBottom: 24 }}>
              {live.map((m) => (
                <Link key={m.id} to={'/live/' + m.id} style={{ display: 'block' }}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <span className="pill live">LIVE</span>
                    <small style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                      {data!.clubs.find((c) => c.id === m.club_id)?.name ?? m.title}・{m.spectators} 人在看
                    </small>
                  </div>
                  <Scoreboard match={m} players={data!.players} />
                </Link>
              ))}
            </div>
          </>
        )}

        {done.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 10 }}>已結束</div>
            <div className="card">
              {done.map((m) => {
                const nameOf = (ids: string[]) =>
                  ids.map((id) => data!.players.find((p) => p.id === id)?.name ?? '對手').join(' / ')
                const winner = m.state.winner === 0 ? nameOf(m.side_a) : nameOf(m.side_b)
                return (
                  <Link key={m.id} to={'/live/' + m.id} className="list-row">
                    <div className="grow">
                      <b className="truncate">{nameOf(m.side_a)} vs {nameOf(m.side_b)}</b>
                      <small>{winner} 勝・{formatFinalScore(m.state)}</small>
                    </div>
                    <span className="pill">回顧</span>
                  </Link>
                )
              })}
            </div>
          </>
        )}

        <Link className="btn primary block" to="/live/new" style={{ marginTop: 22 }}>
          <IconPlus size={18} /> 開一場新比賽
        </Link>
      </div>
    </>
  )
}
