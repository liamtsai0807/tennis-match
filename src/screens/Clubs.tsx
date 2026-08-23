/** ===== Clubs.tsx ===== */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Empty } from '../components/ui.tsx'
import { IconPin, IconStar } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { getMe, listClubs } from '../lib/db.ts'
import { money, SURFACE_LABEL } from '../lib/format.ts'
import { distanceKm, km } from '../lib/geo.ts'

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'indoor', label: '室內' },
  { id: 'lights', label: '有夜燈' },
  { id: 'hard', label: '硬地' },
  { id: 'clay', label: '紅土' },
  { id: 'grass', label: '草地' },
]

export default function Clubs() {
  // 雙北有五十幾個球場，沒有排序等於叫使用者自己翻。
  // 原本靠評分排，但真實資料沒有評分欄位，全是 null 就等於沒排——改用離你多遠。
  const { data } = useData(async () => {
    const [clubs, me] = await Promise.all([listClubs(), getMe()])
    return clubs
      .map((c) => ({ ...c, dist: distanceKm(me, c) }))
      .sort((a, b) => a.dist - b.dist)
  }, [])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  const clubs = useMemo(() => {
    let list = data ?? []
    const kw = q.trim()
    if (kw) list = list.filter((c) => (c.name + c.district + c.address).includes(kw))
    if (filter === 'indoor') list = list.filter((c) => c.indoor)
    else if (filter === 'lights') list = list.filter((c) => c.lights === true)
    else if (['hard', 'clay', 'grass'].includes(filter)) list = list.filter((c) => c.surface === filter)
    return list
  }, [data, q, filter])

  return (
    <>
      <Header title="找球場" />
      <div className="page">
        <div className="field" style={{ marginBottom: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋球館或地區，例如「大安」"
            inputMode="search"
          />
        </div>

        <div className="chips" style={{ marginBottom: 14 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {clubs.length === 0 ? (
          <Empty emoji="🔍" title="找不到符合的球場" hint="換個關鍵字或條件試試" />
        ) : (
          <div className="stack">
            {clubs.map((c) => (
              <Link key={c.id} to={'/clubs/' + c.id} className="card tap">
                <div style={{ height: 96, background: c.photo, position: 'relative' }}>
                  {c.rating !== null && (
                    <span
                      className="pill"
                      style={{ position: 'absolute', left: 12, top: 12, background: 'rgba(255,255,255,.92)' }}
                    >
                      <IconStar size={13} filled /> {c.rating.toFixed(1)}
                    </span>
                  )}
                  {c.indoor && (
                    <span className="pill" style={{ position: 'absolute', right: 12, top: 12, background: 'rgba(255,255,255,.92)' }}>
                      室內
                    </span>
                  )}
                </div>
                <div style={{ padding: '12px 14px 14px' }}>
                  <b style={{ fontSize: 16.5, fontWeight: 800 }}>{c.name}</b>
                  <div className="row" style={{ gap: 4, marginTop: 3, color: 'var(--ink-2)', fontSize: 12.5 }}>
                    <IconPin size={14} /> {c.district}・{km(c.dist)}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {c.surface && <span className="pill">{SURFACE_LABEL[c.surface]}</span>}
                    {c.source !== 'opendata' && <span className="pill">{c.courts} 面場</span>}
                    {c.lights === true && <span className="pill">夜間照明</span>}
                    {c.lights === false && <span className="pill warn">無夜燈</span>}
                    {/* 來自開放資料的球場只有名稱、地址、座標是確定的，講清楚比留白好 */}
                    {c.source === 'opendata' && <span className="pill">細節未確認</span>}
                    <span className="spacer" />
                    <b style={{ fontSize: 14.5 }}>
                      {money(c.price_per_hour)}
                      {c.price_per_hour !== null && c.price_per_hour > 0 && (
                        <small style={{ color: 'var(--ink-3)', fontWeight: 600 }}> /小時</small>
                      )}
                    </b>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
