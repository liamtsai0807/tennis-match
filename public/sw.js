/** ===== sw.js =====
 * 讓 App 裝到手機後，沒網路也打得開。
 *
 * 沒有用 workbox 之類的套件，因為這裡的需求只有兩條規則：
 *   有雜湊檔名的靜態資源（/assets/index-abc123.js）→ 內容不會變，快取優先
 *   其他（HTML、圖示、manifest）→ 先連網，斷線才回快取
 * 為了這兩條拉一個建置外掛不划算。
 */
/**
 * 快取名稱帶上建置版本。註冊時網址是 sw.js?v=20260822-abc1234，
 * 版本一變瀏覽器就認得出這是新的 SW，舊快取也會在 activate 時被清掉。
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = 'tennispal-' + VERSION

/**
 * 查快取時一律忽略 Vary。
 * 靜態主機（GitHub Pages、Netlify、Cloudflare）常會回 Vary: Origin 或
 * Vary: Accept-Encoding，而 caches.match() 預設要比對這些標頭——離線時
 * 送出的請求標頭跟當初存進去的對不上，就會撈不到快取，離線直接失效。
 * 這裡存的都是同源的自家靜態檔，沒有內容協商，忽略 Vary 是安全的。
 */
const MATCH = { ignoreVary: true }

// 導覽請求離線時要回哪一頁。用 SW 自己的 scope 推，才不會綁死在網域根目錄
const SHELL = new URL('./', self.registration.scope).pathname

/**
 * 直接接管，不停在 waiting。
 * 導覽請求走 network-first，所以只要有網路，頁面與 SW 是同一次載入一起換新的，
 * 不會出現「畫面跑舊 JS、SW 是新的」那種不配對狀況。
 * 就算真的錯開了也不會壞：資源檔名帶內容雜湊，舊頁面要的舊檔案還在伺服器上。
 */
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(req) {
  const hit = await caches.match(req, MATCH)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
  return res
}

async function networkFirst(req, fallback) {
  try {
    const res = await fetch(req)
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
    return res
  } catch (err) {
    const hit = await caches.match(fallback || req, MATCH)
    if (hit) return hit
    throw err
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 版本檔一定要問伺服器，被快取住的話就永遠偵測不到新版了
  if (url.pathname.endsWith('/version.json')) return

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, SHELL))
    return
  }
  // Vite 的產物檔名帶內容雜湊，改了就是新檔名，所以可以放心快取優先
  if (url.pathname.includes('/assets/')) {
    e.respondWith(cacheFirst(req))
    return
  }
  e.respondWith(networkFirst(req))
})
