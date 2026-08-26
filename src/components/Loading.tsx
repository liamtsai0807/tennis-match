/** ===== Loading.tsx =====
 * 「還在確認」的畫面。
 *
 * 為什麼要有這個元件：先前有三個地方在還沒決定要顯示什麼時直接 return
 * 空白（`null` 或一個空的 div）。正常情況那只有零點幾秒，但只要背後那件事
 * 卡住或失敗，使用者看到的就是**永久空白**——沒有訊息、沒有出路。
 * 從圖文選單點「找球伴」開出來一片空白就是這樣來的。
 *
 * 所以：不要留白，而且久到不合理時要講話，並且把它回報回來。
 */
import { useEffect, useState } from 'react'
import { report } from '../lib/report.ts'

/** 超過這個時間還沒好，就不是「載入中」而是「卡住了」。 */
const STUCK_MS = 6000

export function Loading({ what }: { what: string }) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setStuck(true)
      // 卡住這件事本身要留下紀錄，否則只有使用者知道
      report('stuck', new Error('等太久：' + what), { what, ms: STUCK_MS })
    }, STUCK_MS)
    return () => clearTimeout(t)
  }, [what])

  return (
    <div className="page loading-screen">
      <div className="loading-ball">🎾</div>
      <p className="note">{stuck ? '比預期久，可能是連線不穩' : '載入中…'}</p>
      {stuck && (
        <button className="btn" onClick={() => window.location.reload()}>
          重新整理
        </button>
      )}
    </div>
  )
}
