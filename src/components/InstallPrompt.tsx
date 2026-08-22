/** ===== InstallPrompt.tsx =====
 * 引導使用者把 App 裝到主畫面。
 *
 * 兩個平台的做法完全不同：
 *   Android / Chrome  瀏覽器會丟 beforeinstallprompt，我們接住它、自己給一顆按鈕
 *   iOS / Safari      沒有這個事件，只能教使用者按「分享 → 加入主畫面」
 * 已經是安裝狀態、或使用者關掉過，就不再出現。
 */
import { useEffect, useState } from 'react'
import { IconShare } from './icons.tsx'

const DISMISSED = 'tennispal.install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari 不支援 display-mode，用它自己的旗標
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [hidden, setHidden] = useState(wasDismissed() || isStandalone())

  useEffect(() => {
    if (hidden) return

    const onPrompt = (e: Event) => {
      e.preventDefault()          // 不要讓瀏覽器自己的迷你提示搶走
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS 沒有事件可接，只能靠判斷。晚一點再出現，不要一進來就擋在臉上
    let timer: number | undefined
    if (isIos()) timer = window.setTimeout(() => setShowIos(true), 4000)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.clearTimeout(timer)
    }
  }, [hidden])

  function dismiss() {
    try { localStorage.setItem(DISMISSED, '1') } catch { /* 存不了就下次再問 */ }
    setHidden(true)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setHidden(true)
  }

  if (hidden || (!deferred && !showIos)) return null

  return (
    <div className="install-bar" role="region" aria-label="安裝到主畫面">
      <div className="install-icon" aria-hidden="true">🎾</div>
      <div className="grow">
        <b>裝到主畫面</b>
        <small>
          {deferred
            ? '像一般 App 一樣開啟，沒網路也打得開'
            : '按下方的「分享」，再選「加入主畫面」'}
        </small>
      </div>
      {deferred
        ? <button className="btn sm primary" onClick={install}>安裝</button>
        : <span className="share-hint" aria-hidden="true"><IconShare size={20} /></span>}
      <button className="install-close" onClick={dismiss} aria-label="不要再顯示">✕</button>
    </div>
  )
}
