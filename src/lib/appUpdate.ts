/** ===== appUpdate.ts =====
 * Service worker 註冊，以及「有新版本」的偵測。
 *
 * 為什麼不用 service worker 的 waiting 狀態來判斷有沒有新版：
 * 這個 App 的導覽請求走 network-first，只要有網路，冷啟動時拿到的就是最新的
 * HTML 與最新的（檔名帶雜湊的）JS——使用者早就在跑新版了，這時再跳「有新版本」
 * 是騙人的。而且 registration.update() 重抓的是註冊當下那個網址，
 * 版本寫在查詢參數裡的話它永遠抓不到新的。
 *
 * 真正需要提示的只有一種情況：App 常駐在背景好幾天沒重新載入過。
 * 所以改成回到前景時比對 version.json，跟自己建置時嵌入的版本不一樣才提示。
 */

const EVENT = 'tennispal:update-ready'

/** 回到前景後至少隔這麼久才再查一次，避免切來切去一直打請求。 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000

let lastCheck = 0
let announced = false

export function onUpdateReady(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}

/** 使用者按下「更新」：重新載入就會拿到新的 HTML 與新的資源。 */
export function applyUpdate() {
  window.location.reload()
}

/**
 * 比對線上的版本。抓不到（離線、檔案還沒上去）就當作沒有新版，
 * 不要為了這個跳錯誤給使用者看。
 */
async function checkForUpdate(currentBuild: string) {
  const now = Date.now()
  if (announced || now - lastCheck < CHECK_INTERVAL_MS) return
  lastCheck = now

  try {
    const res = await fetch(import.meta.env.BASE_URL + 'version.json', { cache: 'no-store' })
    if (!res.ok) return
    const { build } = (await res.json()) as { build?: string }
    if (build && build !== currentBuild) {
      announced = true
      window.dispatchEvent(new Event(EVENT))
    }
  } catch {
    // 離線就是離線，沒有新版可言
  }
}

export function registerServiceWorker(build: string) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js?v=' + encodeURIComponent(build))
      .catch(() => { /* 註冊失敗只是少了離線功能，不擋使用 */ })
  }

  // 手機上把 App 切回前景會走這裡
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate(build)
  })

  // 桌機上分頁可能一直開著、從不觸發 visibilitychange，所以另外定期問一次
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdate(build)
  }, CHECK_INTERVAL_MS)
}
