/** ===== appUpdate.ts =====
 * Service worker 的更新流程。
 *
 * PWA 最經典的坑：App 裝到手機之後，使用者就一直用著舊快取，你改了什麼他都看不到。
 * 這裡的做法是偵測到有新版在 waiting，就讓畫面跳出提示，由使用者按一下才切過去。
 * 不自動切是因為畫面上跑的是舊的 JS，SW 若先接管會拿到不配對的資源。
 */

const EVENT = 'tennispal:update-ready'

let waiting: ServiceWorker | null = null

export function onUpdateReady(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}

/** 使用者按下「更新」：叫新的 SW 接管，接管完成後重新載入。 */
export function applyUpdate() {
  if (!waiting) {
    window.location.reload()
    return
  }
  // controllerchange 代表新的 SW 已經接手，這時候重新載入才會拿到新資源
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  }, { once: true })
  waiting.postMessage('SKIP_WAITING')
}

function announce(sw: ServiceWorker) {
  waiting = sw
  window.dispatchEvent(new Event(EVENT))
}

export function registerServiceWorker(build: string) {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + 'sw.js?v=' + encodeURIComponent(build))
    .then((reg) => {
      // 開啟當下就已經有新版在等（上一次瀏覽時下載好的）
      if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting)

      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        if (!next) return
        next.addEventListener('statechange', () => {
          // 有 controller 才算「更新」；沒有的話是這台裝置第一次安裝，不用提示
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            announce(next)
          }
        })
      })

      // App 被放到背景很久再回來時，主動問一次有沒有新版
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
    })
    .catch(() => { /* 註冊失敗只是少了離線與更新提示，不擋使用 */ })
}
