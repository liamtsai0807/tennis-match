/** ===== Scoreboard.tsx =====
 * 純顯示元件，不知道誰在計分、也不碰資料庫，這樣觀戰與計分兩個畫面才能共用。
 */
import { scoreboard } from '../lib/scoring.ts'
import type { LiveMatch, Player } from '../lib/types.ts'

export function Scoreboard({
  match, players, compact = false,
}: { match: LiveMatch; players: Player[]; compact?: boolean }) {
  const sb = scoreboard(match.state, match.format)
  const nameOf = (ids: string[]) =>
    ids.map((id) => players.find((p) => p.id === id)?.name ?? '對手').join(' / ')
  const sides: Array<{ label: string; idx: 0 | 1 }> = [
    { label: nameOf(match.side_a), idx: 0 },
    { label: nameOf(match.side_b), idx: 1 },
  ]

  return (
    <div className={'board' + (sb.winner !== null ? ' won' : '')}>
      {sides.map(({ label, idx }) => (
        <div className="side" key={idx}>
          <div className="who">
            <span className={'serving' + (sb.server === idx && sb.winner === null ? '' : ' hidden')} />
            <b style={{ opacity: sb.winner !== null && sb.winner !== idx ? .6 : 1 }}>{label}</b>
            {sb.winner === idx && <span className="pill ok" style={{ marginLeft: 2 }}>勝</span>}
          </div>

          <div className="sets">
            {sb.sets.map((s, i) => (
              <span key={i} className={'setbox' + (i === sb.currentSet ? ' current' : '')}>
                {s[idx]}
              </span>
            ))}
          </div>

          <div className={'pts' + (sb.points[idx] === 'AD' ? ' ad' : '')}>
            {sb.winner === null ? sb.points[idx] : '—'}
          </div>
        </div>
      ))}

      {!compact && (
        <div className="banner">
          <span>
            {sb.winner !== null
              ? '比賽結束'
              : sb.inTiebreak
                ? (match.format.finalSetSuperTiebreak && sb.currentSet === match.format.bestOfSets - 1
                    ? '決勝搶十' : '搶七')
                : '第 ' + (sb.currentSet + 1) + ' 盤・' + nameOf(sb.server === 0 ? match.side_a : match.side_b) + ' 發球'}
          </span>
          <span>
            {sb.isMatchPoint !== null && sb.winner === null
              ? '🔥 ' + nameOf(sb.isMatchPoint === 0 ? match.side_a : match.side_b) + ' 賽末點'
              : sb.setsWon[0] + ' – ' + sb.setsWon[1] + ' 盤'}
          </span>
        </div>
      )}
    </div>
  )
}
