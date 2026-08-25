/** ===== supabase.ts ===== */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** 兩個環境變數都有填才算設定完成；否則整個 App 走離線示範資料。 */
export const isSupabaseConfigured = Boolean(url && key)

/**
 * 需要預檢的請求在某些環境根本送不出去，所以改用「簡單請求」把它們包起來。
 *
 * 背景：iOS 26 的 LINE LIFF webview 裡，所有觸發 CORS preflight 的跨網域
 * 請求都在網路層失敗。實測（從那台手機回報回來的數據）：
 *
 *     不預檢的 POST                    → 200
 *     不預檢的 GET（apikey 在查詢字串）→ 401（有送達，只是權限不足）
 *     預檢的 GET（apikey 在標頭）      → TypeError
 *
 * supabase-js 的每一個請求都帶 apikey 與 X-Client-Info，所以在 LINE 裡
 * 整個資料層都不能用：球場列表崩潰、登入拿不到 session。伺服器端怎麼調
 * CORS 都沒用——預檢根本到不了伺服器。
 *
 * 這裡換掉 supabase-js 用的 fetch：在那個環境時，把原始請求包進
 * 「POST + Content-Type: text/plain」送去 proxy 函式，由伺服器端 replay。
 * Authorization 與 apikey 原封不動轉送，RLS 照常生效。
 *
 * **只在真的需要時才繞路。** 一般瀏覽器、PWA、桌面全部走原本的直連——
 * 多一跳就是多一個故障點，沒有理由讓所有人陪葬。判斷放在每一次請求裡
 * （而不是建立 client 時），因為 LIFF 要等 SDK 初始化完才知道。
 */
function proxiedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!needsProxy() || !raw.startsWith(url)) return fetch(input, init)

  const headers: Record<string, string> = {}
  new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    .forEach((v, k) => { headers[k] = v })

  return fetch(url + '/functions/v1/proxy', {
    method: 'POST',
    // text/plain 是 CORS 安全清單值，配上沒有自訂標頭 → 不觸發預檢
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      path: raw.slice(url.length),
      method: init?.method ?? (input instanceof Request ? input.method : 'GET'),
      headers,
      body: typeof init?.body === 'string' ? init.body : null,
    }),
  }).then(async (res) => {
    /*
     * 把 Content-Range 還原回來。伺服器端故意改了名字送——原名轉送的話，
     * iOS 的 WebKit 看到 200 帶著 Content-Range 會判成格式錯誤的回應，
     * fetch 以「Load failed」失敗。（proxy 第一版就是這樣壞的。）
     *
     * 這裡自己組一個 Response，所以標頭想放什麼就放什麼——瀏覽器對
     * 程式產生的 Response 沒有那層限制。supabase-js 拿到的東西跟直連時
     * 一模一樣，count 也照常運作。
     */
    const cr = res.headers.get('x-proxy-content-range')
    if (!cr) return res
    const h = new Headers(res.headers)
    h.delete('x-proxy-content-range')
    h.set('Content-Range', cr)
    return new Response(await res.text(), { status: res.status, statusText: res.statusText, headers: h })
  })
}

/**
 * 現在這個環境要不要繞路。
 *
 * 用「在不在 LINE App 內」判斷，而不是去偵測預檢會不會失敗——偵測要等
 * 一次網路來回，而第一個請求往往就在那之前發出去了。LIFF 這個條件是
 * 確定的、同步的，而且範圍剛好：目前只有這個環境有問題。
 */
function needsProxy(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as { liff?: { isInClient?: () => boolean } }).liff?.isInClient?.())
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
      global: { fetch: proxiedFetch },
    })
  : null

export const backendLabel = isSupabaseConfigured ? 'Supabase' : '離線示範'

/**
 * 後端是不是跑在這台機器上。用來提醒「信不會真的寄出去」——
 * 本機的 Supabase 內建一個攔信箱（Mailpit），所有登入信都進那裡，
 * 不知道的話會以為信寄丟了，坐在那邊等一封永遠不會來的信。
 */
export const isLocalBackend = /\/\/(127\.0\.0\.1|localhost)\b/.test(url)

/**
 * 後端的主機名，只給畫面顯示用。
 *
 * 為什麼要露出來：使用者回報「登入失敗」時，最需要先知道的是「你現在連的是
 * 哪一個後端、跑的是哪一版」。少了這兩個資訊，同一句錯誤訊息可能來自
 * 正式站、來自本機、或來自某個活在 service worker 快取裡的舊版本，
 * 而三者的修法完全不同。曾經為此追了很久。
 */
export const backendHost = (() => {
  try { return url ? new URL(url).host : '離線' } catch { return '網址無效' }
})()

/** 本機攔信箱的網址。埠號是 Supabase CLI 的預設值。 */
export const LOCAL_MAILBOX_URL = 'http://127.0.0.1:54324'
