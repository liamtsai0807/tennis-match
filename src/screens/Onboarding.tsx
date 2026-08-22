/** ===== Onboarding.tsx =====
 * 第一次進來時填偏好。分成三步而不是一頁長表單，因為一次看到七個欄位很容易直接關掉。
 * 每一步都可以往回改，最後一步才寫進資料庫。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LevelField, DistrictField, PartnerLevelField, AvailabilityField, ClubsField,
  isPreferencesValid,
} from '../components/PreferenceFields.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconBack } from '../components/icons.tsx'
import { getMe, listClubs, saveMe } from '../lib/db.ts'
import type { Club, Player } from '../lib/types.ts'

const STEPS = [
  { title: '先認識你一下', hint: '程度填得準，配到的人才會合拍。' },
  { title: '什麼時候有空', hint: '之後媒合會優先找那個時段也有空的人。' },
  { title: '想在哪裡打', hint: '選幾個你方便的球場，可以複選。' },
]

export default function Onboarding() {
  const nav = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [me, setMe] = useState<Player | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getMe(), listClubs()]).then(([m, c]) => {
      setMe(m)
      setClubs(c)
    })
  }, [])

  if (!me) return null

  const patch = (p: Partial<Player>) => setMe({ ...me, ...p })

  // 每一步各自的完成條件，沒填完就不讓往下——最後一步才發現填錯很煩
  const stepOk = [
    me.name.trim().length > 0 && me.pref_ntrp_min <= me.pref_ntrp_max,
    me.availability.weekdays.length > 0 && me.availability.blocks.length > 0,
    me.pref_club_ids.length > 0,
  ][step]

  async function finish() {
    if (!isPreferencesValid(me!)) return
    setSaving(true)
    try {
      await saveMe(me!)
      toast('設定完成，來找球伴吧')
      nav('/', { replace: true })
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="topbar">
        {step > 0 ? (
          <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label="上一步">
            <IconBack />
          </button>
        ) : <span />}
        <div className="wordmark">TENNISPAL</div>
        <span />
      </div>

      <div className="page">
        <div className="steps" style={{ marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <span key={i} className={'step-dot' + (i <= step ? ' on' : '')} />
          ))}
        </div>

        <h2 style={{ fontSize: 25, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-.01em' }}>
          {STEPS[step].title}
        </h2>
        <p className="note" style={{ margin: '0 0 20px' }}>{STEPS[step].hint}</p>

        {step === 0 && (
          <div className="card pad stack" style={{ gap: 18 }}>
            <div className="field">
              <label>你的名字</label>
              <input
                value={me.name}
                maxLength={20}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="其他球友會看到這個名字"
              />
            </div>
            <LevelField value={me} onChange={patch} />
            <DistrictField value={me} onChange={patch} />
            <PartnerLevelField value={me} onChange={patch} />
          </div>
        )}

        {step === 1 && (
          <div className="card pad">
            <AvailabilityField value={me} onChange={patch} />
          </div>
        )}

        {step === 2 && <ClubsField value={me} onChange={patch} clubs={clubs} />}

        <button
          className="btn primary block"
          style={{ marginTop: 22 }}
          disabled={!stepOk || saving}
          onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}
        >
          {saving ? '儲存中…'
            : step < STEPS.length - 1 ? '下一步'
            : '完成，開始找球伴'}
        </button>

        <p className="note" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-3)' }}>
          之後都可以在「我的」裡面改。
        </p>
      </div>
    </>
  )
}
