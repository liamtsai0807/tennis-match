/** ===== liff.ts =====
 * 在 LINE 裡開啟時的初始化。
 *
 * 沒設定 VITE_LINE_LIFF_ID 就整段跳過——一般瀏覽器、PWA、離線示範都還是照舊，
 * LIFF 只是多一種開啟方式，不是取代原本那條路。
 */

/** LIFF SDK 的 CDN。版號釘死，不要用 latest——SDK 換版時行為可能不一樣。 */
const SDK = 'https://static.line-scdn.net/liff/edge/2/sdk.js'

const LIFF_ID = (import.meta.env.VITE_LINE_LIFF_ID ?? '').trim()

interface Liff {
  init(cfg: { liffId: string; withLoginOnExternalBrowser?: boolean }): Promise<void>
  isInClient(): boolean
  isLoggedIn(): boolean
  login(cfg?: { redirectUri?: string }): void
  getIDToken(): string | null
  closeWindow(): void
}

function sdk(): Liff | null {
  return (window as unknown as { liff?: Liff }).liff ?? null
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('載不到 LIFF SDK'))
    document.head.appendChild(el)
  })
}

/**
 * LIFF 的 endpoint URL 不能帶 `#` 片段，但我們用的是 HashRouter。
 *
 * 所以從 Flex 卡片深連結到某一頁時，路徑是走 `?liff.state=` 這個查詢參數送進來的
 * （LINE 官方的做法）。這裡把它轉回 hash，再從網址上抹掉——留著的話
 * 使用者按重新整理會再跳一次，而且網址看起來很怪。
 */
function applyDeepLink(): void {
  const url = new URL(window.location.href)
  const state = url.searchParams.get('liff.state')
  if (!state) return
  url.searchParams.delete('liff.state')
  const path = state.startsWith('#') ? state : '#' + (state.startsWith('/') ? state : '/' + state)
  window.history.replaceState(null, '', url.pathname + url.search + path)
}

/**
 * 在 LINE 裡就初始化 LIFF。回傳「現在是不是在 LIFF 裡」。
 *
 * 任何一步失敗都只記在 console，不擋 App 啟動：LIFF 掛掉的時候，
 * 使用者至少還能用 Email 登入，總比整個開不起來好。
 */
export async function initLiff(): Promise<boolean> {
  if (!LIFF_ID) return false
  try {
    if (!sdk()) await loadScript(SDK)
    const liff = sdk()
    if (!liff) return false

    // withLoginOnExternalBrowser：在外部瀏覽器打開 LIFF 網址時也能登入，
    // 不然使用者從電腦點連結會卡住
    await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true })
    applyDeepLink()
    return true
  } catch (e) {
    console.warn('[LIFF] 初始化失敗，改用一般網頁模式：' + (e as Error).message)
    return false
  }
}

/** 在 LINE 裡按完動作要關掉視窗回聊天室；一般瀏覽器沒有這回事。 */
export function closeLiffWindow(): void {
  const liff = sdk()
  if (liff?.isInClient()) liff.closeWindow()
}
