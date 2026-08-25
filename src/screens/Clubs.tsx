/** ===== Clubs.tsx ===== */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Empty } from '../components/ui.tsx'
import { IconPin, IconStar } from '../components/icons.tsx'
import { useToast } from '../components/Toast.tsx'
import { useData } from '../lib/useData.ts'
import { getMe, isSignedIn, listClubs } from '../lib/db.ts'
import { money, SURFACE_LABEL } from '../lib/format.ts'
import { distanceKm, km } from '../lib/geo.ts'
import { getMyLocation, locationErrorMessage, type LocationError } from '../lib/location.ts'
import type { LatLng } from '../lib/types.ts'

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'indoor', label: '室內' },
  { id: 'lights', label: '有夜燈' },
  { id: 'hard', label: '硬地' },
  { id: 'clay', label: '紅土' },
  { id: 'grass', label: '草地' },
]

export default function Clubs() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  /** 目前位置。null = 還沒問或問不到，這時退回登錄時選的行政區中心 */
  const [here, setHere] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)

  // 雙北有六十幾個球場，沒有排序等於叫使用者自己翻。
  // 原本靠評分排，但真實資料沒有評分欄位，全是 null 就等於沒排——改用離你多遠。
  // 「你」預設是登錄時選的行政區中心；按了「用目前位置」才換成真的座標。
  /**
   * 距離要有可信的原點才算得出來。
   *
   * 沒登入又沒給定位時，我們**不知道**使用者在哪——訪客草稿的座標是
   * 借來的預設值，拿它算出「離你 3.2 公里」就是在編。寧可不排序、
   * 不顯示距離，然後把「用目前位置」這顆按鈕講清楚。
   */
  const { data } = useData(async () => {
    const [clubs, me] = await Promise.all([listClubs(), getMe()])
    const origin = here ?? (isSignedIn() ? me : null)
    if (!origin) {
      return clubs
        .map((c) => ({ ...c, dist: null as number | null }))
        .sort((a, b) => a.district.localeCompare(b.district, 'zh-TW')
          || a.name.localeCompare(b.name, 'zh-TW'))
    }
    return clubs
      .map((c) => ({ ...c, dist: distanceKm(origin, c) as number | null }))
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))
  }, [here])

  async function useHere() {
    setLocating(true)
    try {
      setHere(await getMyLocation())
      toast('已改用你目前的位置排序')
    } catch (e) {
      toast(locationErrorMessage(e as LocationError), 'bad')
    } finally {
      setLocating(false)
    }
  }

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

        {/*
          定位不在進畫面時就要——一開 App 就跳系統對話框是最快讓人按「不允許」
          的方式，而按過之後就要叫使用者自己去改系統設定才問得到第二次。
        */}
        <div className="row between" style={{ marginBottom: 12 }}>
          <small className="note">
            {here ? '照你目前的位置排序'
              : isSignedIn() ? '照你設定的行政區排序'
                : '照行政區排列。要看「離我最近」就按右邊'}
          </small>
          {here ? (
            <button className="btn sm" onClick={() => { setHere(null); toast('改回用設定的行政區排序') }}>
              改回行政區
            </button>
          ) : (
            <button className="btn sm" disabled={locating} onClick={useHere}>
              {locating ? '定位中…' : '用目前位置'}
            </button>
          )}
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
                    <IconPin size={14} /> {c.district}{c.dist !== null && '・' + km(c.dist)}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {c.surface && <span className="pill">{SURFACE_LABEL[c.surface]}</span>}
                    {c.source !== 'opendata' && <span className="pill">{c.courts} 面場</span>}
                    {c.lights === true && <span className="pill">夜間照明</span>}
                    {c.lights === false && <span className="pill warn">無夜燈</span>}
                    {/* 來自開放資料的球場只有名稱、地址、座標是確定的，講清楚比留白好 */}
                    {c.source === 'opendata' && <span className="pill">細節未確認</span>}
                    {c.source === 'manual' && <span className="pill ok">已查證</span>}
                    {/* 「可預約」那種假空檔拿掉之後，卡片上要補真的、能拿來決定
                        點不點進去的資訊：這個場到底能怎麼訂 */}
                    {c.booking_url
                      ? <span className="pill accent">可線上訂</span>
                      : c.phone
                        ? <span className="pill">電話預約</span>
                        : null}
                    <span className="spacer" />
                    <b style={{ fontSize: 14.5 }}>
                      {money(c.price_per_hour)}
                      {/* 有補充說明代表價格是分級的，這個數字只是最低那一檔。
                          但免費就是免費，不會有「免費起」這種東西 */}
                      {c.price_note && c.price_per_hour !== null && c.price_per_hour > 0 && (
                        <small style={{ color: 'var(--ink-3)', fontWeight: 600 }}> 起</small>
                      )}
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
