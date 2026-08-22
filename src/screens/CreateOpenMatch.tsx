/** ===== CreateOpenMatch.tsx ===== */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { useData } from '../lib/useData.ts'
import { createOpenMatch, listClubs } from '../lib/db.ts'
import { addDaysISO, friendlyDate, hourLabel, todayISO } from '../lib/format.ts'
import type { MatchKind, Ntrp } from '../lib/types.ts'

const NTRP_STEPS: Ntrp[] = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5]

export default function CreateOpenMatch() {
  const nav = useNavigate()
  const toast = useToast()
  const { data: clubs } = useData(listClubs, [])

  const [clubId, setClubId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [hour, setHour] = useState(19)
  const [kind, setKind] = useState<MatchKind>('doubles')
  const [ntrpMin, setNtrpMin] = useState<Ntrp>(3)
  const [ntrpMax, setNtrpMax] = useState<Ntrp>(4)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const slots = kind === 'singles' ? 2 : 4
  const club = clubs?.find((c) => c.id === clubId)
  const canSubmit = Boolean(clubId) && ntrpMin <= ntrpMax

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      const m = await createOpenMatch({
        club_id: clubId, date, hour, kind,
        ntrp_min: ntrpMin, ntrp_max: ntrpMax, slots, note: note.trim(),
      })
      toast('球局已發布，等人加入囉')
      nav('/partners/' + m.id, { replace: true })
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header title="發起球局" onBack />
      <div className="page">
        <div className="card pad stack" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>球場</label>
            <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
              <option value="">選一個球場…</option>
              {(clubs ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}（{c.district}）</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>日期</label>
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {Array.from({ length: 14 }, (_, i) => addDaysISO(todayISO(), i)).map((d) => (
                <option key={d} value={d}>{friendlyDate(d)}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>開打時間</label>
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card pad stack" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>形式</label>
            <div className="segmented">
              <button aria-pressed={kind === 'singles'} onClick={() => setKind('singles')}>單打（2 人）</button>
              <button aria-pressed={kind === 'doubles'} onClick={() => setKind('doubles')}>雙打（4 人）</button>
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>程度下限</label>
              <select value={ntrpMin} onChange={(e) => setNtrpMin(Number(e.target.value) as Ntrp)}>
                {NTRP_STEPS.map((n) => <option key={n} value={n}>NTRP {n}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>程度上限</label>
              <select value={ntrpMax} onChange={(e) => setNtrpMax(Number(e.target.value) as Ntrp)}>
                {NTRP_STEPS.map((n) => <option key={n} value={n}>NTRP {n}</option>)}
              </select>
            </div>
          </div>
          {ntrpMin > ntrpMax && (
            <p className="note" style={{ color: 'var(--danger)' }}>下限不能高於上限</p>
          )}

          <div className="field">
            <label>想說的話</label>
            <textarea
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：輕鬆打，不計較勝負；打完可以一起吃飯"
            />
            <small style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>{note.length}/120</small>
          </div>
        </div>

        <div className="card pad" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>預覽</div>
          <p className="note" style={{ margin: 0 }}>
            {club ? club.name : '（還沒選球場）'}・{friendlyDate(date)} {hourLabel(hour)}・
            {kind === 'singles' ? '單打' : '雙打'}・NTRP {ntrpMin}–{ntrpMax}，
            你會佔掉 1 個位置，還缺 {slots - 1} 人。
          </p>
        </div>

        <button className="btn primary block" disabled={!canSubmit || saving} onClick={submit}>
          {saving ? '發布中…' : '發布球局'}
        </button>
      </div>
    </>
  )
}
