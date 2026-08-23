/** ===== Preferences.tsx =====
 * 登錄之後要改偏好就走這裡。欄位跟登錄流程是同一份元件，只是一次顯示全部。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import {
  LevelField, DistrictField, PartnerLevelField, AvailabilityField, ClubsField,
  isPreferencesValid,
} from '../components/PreferenceFields.tsx'
import { usePreferenceDraft } from '../lib/useData.ts'
import { saveMe } from '../lib/db.ts'
import type { Player } from '../lib/types.ts'

export default function Preferences() {
  const nav = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const { me, setMe, clubs } = usePreferenceDraft()

  if (!me) return <><Header title="我的偏好" onBack /><div className="page" /></>

  const patch = (p: Partial<Player>) => setMe({ ...me, ...p })

  async function save() {
    setSaving(true)
    try {
      await saveMe(me!)
      toast('偏好已更新，媒合結果會跟著變')
      nav(-1)
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header title="我的偏好" onBack />
      <div className="page">
        <div className="card pad stack" style={{ gap: 18, marginBottom: 14 }}>
          <div className="field">
            <label>你的名字</label>
            <input value={me.name} maxLength={20} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <LevelField value={me} onChange={patch} />
          <DistrictField value={me} onChange={patch} />
          <PartnerLevelField value={me} onChange={patch} />
        </div>

        <div className="card pad" style={{ marginBottom: 14 }}>
          <AvailabilityField value={me} onChange={patch} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <ClubsField value={me} onChange={patch} clubs={clubs} />
        </div>

        <button
          className="btn primary block"
          disabled={!isPreferencesValid(me) || saving}
          onClick={save}
        >
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </>
  )
}
