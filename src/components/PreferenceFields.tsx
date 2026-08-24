/** ===== PreferenceFields.tsx =====
 * 偏好設定的欄位拆成一段一段，登錄流程一次顯示一段，設定頁一次顯示全部。
 * 兩邊共用同一份，才不會改了設定頁卻忘了改登錄流程。
 */
import { useMemo, useState } from 'react'
import { DISTRICTS } from '../lib/mockData.ts'
import { BLOCKS, BLOCK_ORDER, WEEKDAY_LABEL } from '../lib/match.ts'
import {
  estimateNtrp, levelName, levelHint, NTRP_STEPS,
  EXPERIENCE_OPTIONS, FREQUENCY_OPTIONS, RALLY_OPTIONS,
} from '../lib/level.ts'
import { distanceKm, km } from '../lib/geo.ts'
import { SURFACE_LABEL, money } from '../lib/format.ts'
import type { LevelAnswers } from '../lib/level.ts'
import type { Club, Ntrp, Player, TimeBlock } from '../lib/types.ts'

type Patch = (patch: Partial<Player>) => void

/**
 * 你的程度。問三題好回答的，然後推算 NTRP。
 *
 * 直接問「你的 NTRP 是多少」的問題是：沒打過分級賽的人不知道 3.0 和 3.5 差在哪，
 * 於是有人虛報有人謙虛，而整個媒合都建立在這個數字上。
 * 真的知道自己分級的人（打過聯賽的）走右上角那個連結直接選。
 */
export function LevelField({ value, onChange }: { value: Player; onChange: Patch }) {
  const stored = value.level_answers
  const manual = stored === 'manual'
  // 三題還沒答完的中間狀態留在元件裡，答滿三題才寫回 player
  const [draft, setDraft] = useState<Partial<LevelAnswers>>(
    stored && stored !== 'manual' ? stored : {},
  )

  function pick(patch: Partial<LevelAnswers>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (next.experience && next.frequency && next.rally) {
      const answers = next as LevelAnswers
      onChange({ level_answers: answers, ntrp: estimateNtrp(answers) })
    }
  }

  const done = Boolean(draft.experience && draft.frequency && draft.rally)

  if (manual) {
    return (
      <div className="field">
        <div className="row between">
          <label style={{ margin: 0 }}>你的程度（NTRP）</label>
          <button className="linkish" onClick={() => { setDraft({}); onChange({ level_answers: null }) }}>
            改用三題推算
          </button>
        </div>
        <div className="chips">
          {NTRP_STEPS.map((n) => (
            <button
              key={n}
              className="chip"
              aria-pressed={value.ntrp === n}
              onClick={() => onChange({ ntrp: n, level_answers: 'manual' })}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="note" style={{ margin: '2px 0 0' }}>{levelHint(value.ntrp)}</p>
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row between">
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>
          你的程度
        </label>
        <button className="linkish" onClick={() => onChange({ level_answers: 'manual' })}>
          我知道自己的 NTRP
        </button>
      </div>

      <Question
        n={1}
        title="打多久了？"
        options={EXPERIENCE_OPTIONS}
        selected={draft.experience}
        onPick={(id) => pick({ experience: id })}
      />
      <Question
        n={2}
        title="多常打？"
        options={FREQUENCY_OPTIONS}
        selected={draft.frequency}
        onPick={(id) => pick({ frequency: id })}
      />
      <Question
        n={3}
        title="跟程度差不多的人對打，通常能來回幾球？"
        options={RALLY_OPTIONS}
        selected={draft.rally}
        onPick={(id) => pick({ rally: id })}
        stacked
      />

      {done ? (
        <div className="result">
          <div className="eyebrow" style={{ marginBottom: 4 }}>你的程度</div>
          <b style={{ fontSize: 19, fontWeight: 800 }}>{levelName(value.ntrp)}</b>
          <span className="ntrp-note">NTRP {value.ntrp}</span>
          <p className="note" style={{ margin: '6px 0 0' }}>{levelHint(value.ntrp)}</p>
        </div>
      ) : (
        <p className="note" style={{ margin: 0 }}>
          三題都選完就會算出你的程度，之後隨時可以改。
        </p>
      )}
    </div>
  )
}

function Question<T extends string>({
  n, title, options, selected, onPick, stacked = false,
}: {
  n: number
  title: string
  options: ReadonlyArray<{ id: T; label: string; hint?: string }>
  selected: T | undefined
  onPick: (id: T) => void
  stacked?: boolean
}) {
  return (
    <div className="field">
      <label><span className="qnum">{n}</span>{title}</label>
      <div className={stacked ? 'stack-s' : 'row'} style={stacked ? undefined : { gap: 6 }}>
        {options.map((o) => (
          <button
            key={o.id}
            className="chip"
            style={stacked ? { textAlign: 'left' } : { flex: 1, padding: '10px 4px', textAlign: 'center' }}
            aria-pressed={selected === o.id}
            onClick={() => onPick(o.id)}
          >
            {o.label}
            {o.hint && (
              <small style={{ display: 'block', fontWeight: 500, opacity: .7, fontSize: 11, marginTop: 1 }}>
                {o.hint}
              </small>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 活動範圍。只到行政區，不問完整地址——問地址會嚇跑一半的人。 */
export function DistrictField({ value, onChange }: { value: Player; onChange: Patch }) {
  return (
    <div className="field">
      <label>你通常在哪一區打球</label>
      <select
        value={value.district}
        onChange={(e) => {
          const d = DISTRICTS.find((x) => x.name === e.target.value)
          if (d) onChange({ district: d.name, lat: d.lat, lng: d.lng })
        }}
      >
        {DISTRICTS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
      </select>
      <p className="note" style={{ margin: '2px 0 0' }}>
        用來估算球場離你多遠，不會顯示給其他人看到確切位置。
      </p>
    </div>
  )
}

/** 想找的球伴程度。上下限都給，比只給「±0.5」有彈性。 */
export function PartnerLevelField({ value, onChange }: { value: Player; onChange: Patch }) {
  const invalid = value.pref_ntrp_min > value.pref_ntrp_max
  return (
    <div className="field">
      <label>想找的球伴程度</label>
      <div className="row" style={{ gap: 10 }}>
        <select
          style={{ flex: 1 }}
          value={value.pref_ntrp_min}
          onChange={(e) => onChange({ pref_ntrp_min: Number(e.target.value) as Ntrp })}
        >
          {NTRP_STEPS.map((n) => <option key={n} value={n}>NTRP {n}</option>)}
        </select>
        <span style={{ color: 'var(--ink-3)' }}>到</span>
        <select
          style={{ flex: 1 }}
          value={value.pref_ntrp_max}
          onChange={(e) => onChange({ pref_ntrp_max: Number(e.target.value) as Ntrp })}
        >
          {NTRP_STEPS.map((n) => <option key={n} value={n}>NTRP {n}</option>)}
        </select>
      </div>
      {invalid ? (
        <p className="note" style={{ margin: '2px 0 0', color: 'var(--danger)' }}>下限不能高於上限</p>
      ) : (
        <p className="note" style={{ margin: '2px 0 0' }}>
          {value.pref_ntrp_min === value.pref_ntrp_max
            ? '只找完全同級的球友，配對結果會比較少'
            : '範圍開太窄會找不到人，開太寬會打得不盡興'}
        </p>
      )}
    </div>
  )
}

/** 偏好時段：星期幾 × 早午晚 */
export function AvailabilityField({ value, onChange }: { value: Player; onChange: Patch }) {
  const { weekdays, blocks } = value.availability

  function toggleDay(d: number) {
    const next = weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d].sort()
    onChange({ availability: { weekdays: next, blocks } })
  }
  function toggleBlock(b: TimeBlock) {
    const next = blocks.includes(b) ? blocks.filter((x) => x !== b) : [...blocks, b]
    onChange({ availability: { weekdays, blocks: next } })
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field">
        <label>平常哪幾天有空</label>
        <div className="row" style={{ gap: 6 }}>
          {WEEKDAY_LABEL.map((label, d) => (
            <button
              key={d}
              className="chip"
              style={{ flex: 1, padding: '10px 0', textAlign: 'center' }}
              aria-pressed={weekdays.includes(d)}
              onClick={() => toggleDay(d)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>哪個時段</label>
        <div className="row" style={{ gap: 8 }}>
          {BLOCK_ORDER.map((b) => (
            <button
              key={b}
              className="chip"
              style={{ flex: 1, padding: '12px 0', textAlign: 'center' }}
              aria-pressed={blocks.includes(b)}
              onClick={() => toggleBlock(b)}
            >
              {BLOCKS[b].label}
              <small style={{ display: 'block', fontWeight: 500, opacity: .7, fontSize: 11 }}>
                {BLOCKS[b].from}–{BLOCKS[b].to} 點
              </small>
            </button>
          ))}
        </div>
        {(weekdays.length === 0 || blocks.length === 0) && (
          <p className="note" style={{ margin: '2px 0 0', color: 'var(--danger)' }}>
            兩邊都至少要選一個，不然媒合不到任何人
          </p>
        )}
      </div>
    </div>
  )
}

/** 偏好球場。依離活動範圍的距離排，最近的排前面。 */
export function ClubsField({
  value, onChange, clubs,
}: { value: Player; onChange: Patch; clubs: Club[] }) {
  const sorted = useMemo(
    () => [...clubs]
      .map((c) => ({ club: c, dist: distanceKm(value, c) }))
      .sort((a, b) => a.dist - b.dist),
    [clubs, value.lat, value.lng],
  )

  function toggle(id: string) {
    const cur = value.pref_club_ids
    onChange({
      pref_club_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    })
  }

  return (
    <div className="field">
      <label>常去或想去的球場（可複選）</label>
      <div className="stack-s">
        {sorted.map(({ club, dist }) => {
          const on = value.pref_club_ids.includes(club.id)
          return (
            <button
              key={club.id}
              className="card pad row between"
              style={{
                textAlign: 'left',
                border: on ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              aria-pressed={on}
              onClick={() => toggle(club.id)}
            >
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 15, display: 'block' }}>{club.name}</b>
                <small style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>
                  {km(dist)}
                  {club.surface ? '・' + SURFACE_LABEL[club.surface] : ''}
                  {club.indoor ? '・室內' : ''}・{money(club.price_per_hour)}
                </small>
              </div>
              <span className={'pill ' + (on ? 'accent' : '')}>{on ? '已選' : '選'}</span>
            </button>
          )
        })}
      </div>
      <p className="note" style={{ margin: '2px 0 0' }}>
        跟你選了同樣球場的人，媒合時會排比較前面。
      </p>
    </div>
  )
}

/** 表單填完整了沒。登錄流程與設定頁都用這個判斷，標準才會一致。 */
export function isPreferencesValid(p: Player): boolean {
  return (
    p.name.trim().length > 0 &&
    p.level_answers !== null &&
    p.pref_ntrp_min <= p.pref_ntrp_max &&
    p.availability.weekdays.length > 0 &&
    p.availability.blocks.length > 0 &&
    p.pref_club_ids.length > 0
  )
}
