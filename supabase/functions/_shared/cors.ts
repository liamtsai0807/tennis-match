/** ===== cors.ts =====
 * 給瀏覽器呼叫的 Edge Function 共用的 CORS 設定。
 *
 * 為什麼要抽出來：allow-headers 少列一個，瀏覽器就會擋掉 preflight，而失敗的
 * 樣子是「Failed to send a request to the Edge Function」——那是 fetch 在網路層
 * 就死了，函式根本沒被呼叫到，所以伺服器端一行日誌都不會有。
 *
 * 之前就是這樣：只列了 authorization 和 content-type，但 supabase-js 的
 * functions.invoke() 還會送 x-client-info 與 apikey，於是 LINE 登入在正式站
 * 一按就錯。用 curl 測完全正常（curl 不做 preflight），只有真的瀏覽器會現形。
 */

/** supabase-js 的 functions.invoke() 實際會送出的標頭，一個都不能漏。 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // 少一趟 preflight。24 小時是瀏覽器普遍接受的上限
  'Access-Control-Max-Age': '86400',
} as const

/** preflight 的標準回應。 */
export function corsPreflight(): Response {
  return new Response('ok', { headers: CORS_HEADERS })
}

/** JSON 回應。跨網域的回應也要帶 allow-origin，不是只有 preflight 需要。 */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': CORS_HEADERS['Access-Control-Allow-Origin'],
    },
  })
}
