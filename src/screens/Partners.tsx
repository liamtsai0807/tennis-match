/** ===== Partners.tsx =====
 * 兩個分頁：「找球局」是揪團看板，「找球友」是照程度找人。
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Avatar, AvatarStack, Empty } from '../components/ui.tsx'
import { IconChevron, IconPlus, IconClock, IconPin } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { listClubs, listOpenMatches, listPlayers, ME } from '../lib/db.ts'
import { friendlyDate, hourRange, ntrpLabel } from '../lib/format.ts'
import type { Ntrp } from '../lib/types.ts'

export default function Partners() {
  const [tab, setTab] = useState<'matches' | 'people'>('matches')
  const { data } = useData(async () => {
    const [matches, clubs, players] = await Promise.all([listOpenMatches(), listClubs(), listPlayers()])
    return { matches, clubs, players }
  }, [])

  return (
    <>
      <Header title="球伴" right={
        <Link className="icon-btn" to="/partners/new" aria-label="發起球局"><IconPlus /></Link>
      } />
      <div className="page">
        <div className="segmented" style={{ marginBottom: 16 }}>
          <button aria-pressed={tab === 'matches'} onClick={() => setTab('matches')}>找球局</button>
          <button aria-pressed={tab === 'people'} onClick={() => setTab('people')}>找球友</button>
        </div>

        {tab === 'matches' ? <MatchesTab data={data} /> : <PeopleTab data={data} />}
      </div>
    </>
  )
}

type Data = { matches: Awaited<ReturnType<typeof listOpenMatches>>; clubs: Awaited<ReturnType<typeof listClubs>>; players: Awaited<ReturnType<typeof listPlayers>> } | null

function MatchesTab({ data }: { data: Data }) {
  const [onlyOpen, setOnlyOpen] = useState(true)
  const list = (data?.matches ?? []).filter((m) => (onlyOpen ? m.status === 'open' : true))

  return (
    <>
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className="chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen(true)}>還缺人</button>
        <button className="chip" aria-pressed={!onlyOpen} onClick={() => setOnlyOpen(false)}>全部</button>
      </div>

      {list.length === 0 ? (
        <Empty emoji="🎾" title="現在沒有球局" hint="不如你來發起一場？" />
      ) : (
        <div className="stack">
          {list.map((m) => {
            const club = data!.clubs.find((c) => c.id === m.club_id)
            const joined = m.joined.map((id) => data!.players.find((p) => p.id === id) ?? null)
            const host = data!.players.find((p) => p.id === m.host_id)
            const iAmIn = m.joined.includes(ME)
            return (
              <Link key={m.id} to={'/partners/' + m.id} className="card tap pad">
                <div className="row between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="pill blue">{m.kind === 'singles' ? '單打' : '雙打'}</span>
                    <span className="pill">NTRP {m.ntrp_min}–{m.ntrp_max}</span>
                  </div>
                  {m.status === 'full'
                    ? <span className="pill ok">已滿</span>
                    : <span className="pill warn">缺 {m.slots - m.joined.length} 人</span>}
                </div>

                <b style={{ fontSize: 16.5, fontWeight: 800, display: 'block' }}>{club?.name}</b>
                <div className="row" style={{ gap: 12, marginTop: 5, color: 'var(--ink-2)', fontSize: 12.5 }}>
                  <span className="row" style={{ gap: 4 }}><IconClock size={14} />{friendlyDate(m.date)} {hourRange(m.hour)}</span>
                  <span className="row" style={{ gap: 4 }}><IconPin size={14} />{club?.district}</span>
                </div>

                {m.note && (
                  <p className="note" style={{ margin: '10px 0 0' }}>{m.note}</p>
                )}

                <div className="row between" style={{ marginTop: 12 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <AvatarStack players={joined} slots={m.slots} />
                    <small style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                      {host?.name} 主揪{iAmIn && '・你已加入'}
                    </small>
                  </div>
                  <IconChevron size={18} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

const LEVELS: Array<{ id: string; label: string; test: (n: Ntrp) => boolean }> = [
  { id: 'all', label: '全部程度', test: () => true },
  { id: 'beginner', label: '初學 ≤2.5', test: (n) => n <= 2.5 },
  { id: 'mid', label: '進階 3–3.5', test: (n) => n >= 3 && n <= 3.5 },
  { id: 'adv', label: '熟練 4+', test: (n) => n >= 4 },
]

function PeopleTab({ data }: { data: Data }) {
  const [level, setLevel] = useState('all')
  const players = useMemo(() => {
    const t = LEVELS.find((l) => l.id === level)!.test
    return (data?.players ?? []).filter((p) => p.id !== ME && t(p.ntrp))
  }, [data, level])

  return (
    <>
      <div className="chips" style={{ marginBottom: 14 }}>
        {LEVELS.map((l) => (
          <button key={l.id} className="chip" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
            {l.label}
          </button>
        ))}
      </div>

      {players.length === 0 ? (
        <Empty emoji="🙋" title="這個程度暫時沒有人" hint="放寬條件看看" />
      ) : (
        <div className="card">
          {players.map((p) => (
            <Link key={p.id} to={'/player/' + p.id} className="list-row">
              <Avatar player={p} />
              <div className="grow">
                <b>{p.name}</b>
                <small className="truncate">{ntrpLabel(p.ntrp)}・{p.district}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b style={{ fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>{p.wins}勝 {p.losses}敗</b>
                <small style={{ display: 'block', color: 'var(--ink-3)', fontSize: 11.5 }}>
                  {p.hand === 'left' ? '左手' : '右手'}
                </small>
              </div>
              <IconChevron size={18} />
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
