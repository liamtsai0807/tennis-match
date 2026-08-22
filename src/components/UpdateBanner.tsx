/** ===== UpdateBanner.tsx =====
 * 有新版本時跳出來的一條提示。不自動更新，因為使用者可能正在填表單。
 */
import { useEffect, useState } from 'react'
import { applyUpdate, onUpdateReady } from '../lib/appUpdate.ts'

export function UpdateBanner() {
  const [ready, setReady] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => onUpdateReady(() => setReady(true)), [])

  if (!ready) return null

  return (
    <div className="update-bar" role="status">
      <div className="grow">
        <b>有新版本</b>
        <small>更新後畫面會重新載入，你填的偏好都還在</small>
      </div>
      <button
        className="btn sm primary"
        disabled={applying}
        onClick={() => { setApplying(true); applyUpdate() }}
      >
        {applying ? '更新中…' : '更新'}
      </button>
    </div>
  )
}
