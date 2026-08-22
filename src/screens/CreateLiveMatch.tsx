/** ===== CreateLiveMatch.tsx =====
 * 開一場要計分的比賽。從球局頁進來時（?match=xxx）會自動帶入球場與人選，
 * 少打幾個字就少一次放棄。
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { useData } from '../lib/useData.ts'
import { createLiveMatch, getOpenMatch, listClubs, listPlayers, ME } from '../lib/db.ts'
import { newScore, DEFAULT_FORMAT, QUICK_FORMAT } from '../lib/scoring.ts'
import type { MatchFormat, MatchKind } from '../lib/types.ts'

const FORMATS: Array<{ id: string; label: string; hint: string; format: MatchFormat }> = [
  { id: 'quick', label: '一盤決勝', hint: '6 局一盤，6:6 搶七', format: QUICK_FORMAT },
  { id: 'standard', label: '三盤兩勝', hint: '決勝盤打搶十', format: DEFAULT_FORMAT },
  {
    id: 'noad', label: '快打模式', hint: '一盤 4 局・平分決勝',
    format: { ...QUICK_FORMAT, gamesPerSet: 4, tiebreakAtGames: 4, noAd: true },
  },
]

export default function CreateLiveMatch() {
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const fromMatch = params.get('match')

  const { data } = useData(async () => {
    const [players, clubs] = await Promise.all([listPlayers(), listClubs()])
    const source = fromMatch ? await getOpenMatch(fromMatch) : null
    return { players, clubs, source }
  }, [fromMatch])

  const [kind, setKind] = useState<MatchKind>('singles')
  const [clubId, setClubId] = useState('')
  const [sideA, setSideA] = useState<string[]>([ME])
  const [sideB, setSideB] = useState<string[]>([])
  const [formatId, setFormatId] = useState('quick')
  const [firstServer, setFirstServer] = useState<0 | 1>(0)
  const [saving, setSaving] = useState(false)

  // 從球局帶入：球場、單雙打、以及已加入的人分成兩邊
  useEffect(() => {
    const src = data?.source
    if (!src) return
    setClubId(src.club_id)
    setKind(src.kind)
    const half = Math.ceil(src.joined.length / 2)
    setSideA(src.joined.slice(0, half))
    setSideB(src.joined.slice(half))
  }, [data?.source])

  const perSide = kind === 'singles' ? 1 : 2
  const others = (data?.players ?? [])
  const ready = sideA.length === perSide && sideB.length === perSide &&
    !sideA.some((id) => sideB.includes(id))

  function pick(side: 'a' | 'b', index: number, id: string) {
    const set = side === 'a' ? [...sideA] : [...sideB]
    set[index] = id
    if (side === 'a') setSideA(set.filter(Boolean))
    else setSideB(set.filter(Boolean))
  }

  async function start() {
    if (!ready) return
    setSaving(true)
    try {
      const format = FORMATS.find((f) => f.id === formatId)!.format
      const nameOf = (ids: string[]) =>
        ids.map((id) => others.find((p) => p.id === id)?.name ?? '?').join(' / ')
      const m = await createLiveMatch({
        title: nameOf(sideA) + ' vs ' + nameOf(sideB),
        club_id: clubId,
        kind,
        side_a: sideA,
        side_b: sideB,
        format,
        state: newScore(firstServer),
        scorer_id: ME,
        started_at: new Date().toISOString(),
        finished_at: null,
        spectators: 0,
      })
      toast('開賽！可以開始計分了')
      nav('/live/' + m.id, { replace: true })
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header title="開新比賽" onBack />
      <div className="page">
        <div className="card pad stack" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>形式</label>
            <div className="segmented">
              <button aria-pressed={kind === 'singles'} onClick={() => { setKind('singles'); setSideA(sideA.slice(0, 1)); setSideB(sideB.slice(0, 1)) }}>單打</button>
              <button aria-pressed={kind === 'doubles'} onClick={() => setKind('doubles')}>雙打</button>
            </div>
          </div>
          <div className="field">
            <label>球場（選填）</label>
            <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
              <option value="">不指定</option>
              {(data?.clubs ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>上場的人</div>
        <div className="card pad stack" style={{ marginBottom: 14 }}>
          {(['a', 'b'] as const).map((side) => (
            <div key={side} className="field">
              <label>{side === 'a' ? 'A 方' : 'B 方'}</label>
              <div className="stack-s">
                {Array.from({ length: perSide }, (_, i) => {
                  const current = (side === 'a' ? sideA : sideB)[i] ?? ''
                  return (
                    <select key={i} value={current} onChange={(e) => pick(side, i, e.target.value)}>
                      <option value="">選一位球友…</option>
                      {others.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}（NTRP {p.ntrp}）</option>
                      ))}
                    </select>
                  )
                })}
              </div>
            </div>
          ))}
          {sideA.some((id) => sideB.includes(id)) && (
            <p className="note" style={{ color: 'var(--danger)' }}>同一個人不能站在兩邊</p>
          )}
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>賽制</div>
        <div className="stack-s" style={{ marginBottom: 14 }}>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              className="card pad row between"
              style={{ textAlign: 'left', border: formatId === f.id ? '2px solid var(--blue)' : '2px solid transparent' }}
              onClick={() => setFormatId(f.id)}
            >
              <div>
                <b style={{ fontSize: 15 }}>{f.label}</b>
                <div className="note">{f.hint}</div>
              </div>
              {formatId === f.id && <span className="pill blue">已選</span>}
            </button>
          ))}
        </div>

        <div className="card pad" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>誰先發球</div>
          <div className="segmented">
            <button aria-pressed={firstServer === 0} onClick={() => setFirstServer(0)}>A 方</button>
            <button aria-pressed={firstServer === 1} onClick={() => setFirstServer(1)}>B 方</button>
          </div>
        </div>

        <button className="btn primary block" disabled={!ready || saving} onClick={start}>
          {saving ? '準備中…' : ready ? '開始比賽' : '請先選滿兩邊的人'}
        </button>
      </div>
    </>
  )
}
