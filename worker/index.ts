/** ===== worker/index.ts =====
 * Cloudflare Worker：同時提供靜態網站與同源的 /api/*。
 *
 * 這一支的存在理由只有一個：**讓瀏覽器眼中只剩一個 origin**。
 *
 * 前端與 Supabase 分屬兩個網域時，每一個帶自訂標頭的請求都要先做 CORS
 * preflight，而 iOS 的 LINE LIFF webview 裡預檢一律在網路層失敗——
 * 伺服器端怎麼調 CORS 都沒用，預檢根本到不了伺服器。
 *
 * 業界的標準做法不是繞過 CORS，是讓它不存在：前端與 API 同源，跨網域
 * 那一段在伺服器端完成，那裡沒有 CORS 這回事。
 *
 * 這一支不做判斷、不加權限：/api/* 原樣轉給 Supabase，Authorization 與
 * apikey 照舊由前端帶，RLS 完全不受影響。其餘路徑交給靜態資源。
 */
interface Env {
  /** Supabase 專案網址，例如 https://xxx.supabase.co。在 Worker 的設定裡填。 */
  SUPABASE_URL: string
  /** 靜態資源（dist/）。not_found_handling 設成 SPA，深連結才撈得回 App。 */
  ASSETS: { fetch: (req: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const base = (env.SUPABASE_URL ?? '').replace(/\/+$/, '')
      if (!base) {
        return new Response(JSON.stringify({
          error: '沒有設定 SUPABASE_URL——檢查 wrangler.jsonc 的 vars，或 Cloudflare 後台的「執行時」變數（不是組建變數）',
        }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        })
      }
      // /api/rest/v1/clubs → /rest/v1/clubs
      const target = base + url.pathname.slice('/api'.length) + url.search
      // 換個目的地把原請求送出去。這種寫法會沿用方法、標頭、body 與
      // WebSocket 升級——realtime 走的就是升級，少了它即時更新會失效。
      return fetch(new Request(target, request))
    }

    /*
     * 靜態資源找不到時要回 404，不要走 SPA fallback。
     *
     * fallback 的用意是「深連結進來的頁面路徑要撈得回 App」，但它會一視同仁
     * 地把 index.html 塞給任何找不到的路徑——包含 /assets/Profile-舊雜湊.js。
     * 於是瀏覽器拿到 HTML 卻期待 JavaScript，錯誤訊息是
     * 「'text/html' is not a valid JavaScript MIME type」，整個畫面崩潰。
     *
     * 什麼時候會發生：使用者開著舊版的頁面，中間我們部署了新版，舊的
     * 分塊檔名就不存在了。有程式碼切分就一定會遇到。
     *
     * 回 404 不會讓那個情況變好，但會讓它**誠實**——前端才有辦法認出
     * 「這是分塊掉了」並重新載入，而不是收到一團 HTML 不知所措。
     */
    const res = await env.ASSETS.fetch(request)
    if (res.status === 200 && url.pathname.startsWith('/assets/')) {
      const type = res.headers.get('content-type') ?? ''
      if (type.includes('text/html')) {
        return new Response('資源不存在（可能是舊版的分塊，請重新載入）', { status: 404 })
      }
    }
    return res
  },
}
