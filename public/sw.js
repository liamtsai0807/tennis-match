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
 * 刻意不呼叫 skipWaiting()。
 * 新的 SW 先停在 waiting，等使用者按下「更新」才接管——否則畫面上跑的是舊的 JS、
 * 背後的 SW 卻是新的，會拿到不配對的資源，出現很難查的錯誤。
 */
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)))
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
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
