/** ===== functions/api/[[path]].ts =====
 * Cloudflare Pages Function：把 /api/* 轉給 Supabase。
 *
 * 這一支的存在理由只有一個：**讓瀏覽器眼中只剩一個 origin**。
 *
 * 前端在 pages.dev、Supabase 在 supabase.co，兩個不同網域，於是每一個
 * 帶自訂標頭的請求都要先做 CORS preflight。而 iOS 的 LINE LIFF webview
 * 裡，預檢一律在網路層失敗（實測數據見 docs 與 git log）——伺服器端怎麼
 * 調 CORS 都沒用，預檢根本到不了伺服器。
 *
 * 業界的標準做法不是繞過 CORS，是讓它不存在：前端與 API 同源，
 * 跨網域的部分在伺服器端完成，那裡沒有 CORS 這回事。這就是那件事。
 *
 * 這一支不做任何判斷、不加任何權限：原樣轉送，Authorization 與 apikey
 * 照舊由前端帶，RLS 完全不受影響。
 */
interface Env {
  /** Supabase 專案網址，例如 https://xxx.supabase.co。在 Pages 的環境變數設定。 */
  SUPABASE_URL: string
}

export const onRequest = async (ctx: {
  request: Request
  env: Env
}): Promise<Response> => {
  const base = (ctx.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
  if (!base) {
    return new Response(JSON.stringify({ error: '伺服器沒有設定 SUPABASE_URL' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(ctx.request.url)
  // /api/rest/v1/clubs → /rest/v1/clubs
  const path = url.pathname.replace(/^\/api/, '')
  const target = base + path + url.search

  // 直接把原請求換個目的地送出去。Request 的第二個參數會沿用方法、標頭、
  // body 與 WebSocket 升級——realtime 走的就是升級，少了它即時更新會失效。
  return fetch(new Request(target, ctx.request))
}
