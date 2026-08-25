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

/**
 * liff.init() 有沒有成功跑完。
 *
 * 不能改用「window 上有沒有 liff」來判斷——SDK 的 script 一載進來那個屬性就在了，
 * 但還沒 init 之前呼叫任何 API 都會炸。這個旗標才是「LIFF 真的可以用了」。
 */
let ready = false

export function liffReady(): boolean {
  return ready
}

/** 是不是在 LINE App 內開啟。外部瀏覽器開 LIFF 網址時這裡是 false。 */
export function isInLineClient(): boolean {
  return ready && (sdk()?.isInClient() ?? false)
}

export function liffLoggedIn(): boolean {
  return ready && (sdk()?.isLoggedIn() ?? false)
}

/** 使用者按下「用 LINE 登入」才呼叫。會離開頁面跳去 LINE，回來時網址不變。 */
export function liffLogin(): void {
  sdk()?.login()
}

export function liffIdToken(): string | null {
  return ready ? sdk()?.getIDToken() ?? null : null
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
 * LIFF SDK 自己會把 `?liff.state=/clubs` 變成真的導頁到 `<base>/clubs`——
 * 那是 init() 內部做的，applyDeepLink() 根本沒機會先跑。
 *
 * 靜態主機上那個路徑沒有檔案，GitHub Pages 會回 404。我們用 404.html
 * （index.html 的複本）把 App 撈回來，但網址還停在 /tennis-match/clubs，
 * 而 HashRouter 只看 # 後面，結果是進了首頁而不是球場頁。
 *
 * 所以這裡要把「多出來的那段路徑」轉回 hash。BASE_URL 由建置時的 base 決定，
 * 本機是 '/'，GitHub Pages 是 '/tennis-match/'。
 *
 * 本機開發抓不到這個問題：Vite 對任何路徑都回 index.html，看起來一切正常。
 */
function pathToHash(): void {
  if (window.location.hash) return          // 已經有 hash 路由，不要動
  const base = import.meta.env.BASE_URL || '/'
  const path = window.location.pathname
  if (!path.startsWith(base)) return
  const rest = path.slice(base.length).replace(/^\/+/, '')
  if (!rest) return                          // 就在根目錄，正常進首頁
  window.history.replaceState(null, '', base + window.location.search + '#/' + rest)
}

/**
 * 在 LINE 裡就初始化 LIFF。回傳「現在是不是在 LIFF 裡」。
 *
 * 任何一步失敗都只記在 console，不擋 App 啟動：LIFF 掛掉的時候，
 * 使用者至少還能用 Email 登入，總比整個開不起來好。
 */
export async function initLiff(): Promise<boolean> {
  // 一定要在最前面。SDK 的導頁是整頁重新載入，await 後面的程式碼不會執行——
  // 真正把路徑撈回來的是「重新載入之後的這一次」。
  pathToHash()
  if (!LIFF_ID) return false
  try {
    if (!sdk()) await loadScript(SDK)
    const liff = sdk()
    if (!liff) return false

    // 這裡刻意**不**加 withLoginOnExternalBrowser。
    //
    // 加了的話，任何在一般瀏覽器開啟的人，App 都還沒渲染就會被踢去 LINE 登入頁——
    // 包含用電腦測試、把 PWA 裝到主畫面後從桌面開、以及只想用 Email 或 Google
    // 登入的人。SignIn 上那兩顆按鈕等於永遠按不到。
    //
    // 改成不自動登入：App 一定先渲染自己的登入畫面，要不要走 LINE 由使用者按下去
    // 才決定（signInWithLine() 會在需要時呼叫 liff.login()）。
    await liff.init({ liffId: LIFF_ID })
    ready = true
    applyDeepLink()
    // init() 可能已經把我們導到 <base>/clubs 這種路徑上了，撈回 hash 路由
    pathToHash()
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
