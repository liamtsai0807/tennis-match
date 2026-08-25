/** ===== proxy =====
 * 把「需要 CORS 預檢的請求」包成「不需要預檢的請求」轉送出去。
 *
 * 為什麼需要：iOS 26 的 LINE LIFF webview 裡，所有觸發 CORS preflight 的
 * 跨網域請求都在網路層失敗（TypeError），簡單請求則完全正常。實測數據：
 *
 *     不預檢的 POST                    → 200
 *     不預檢的 GET（apikey 在查詢字串）→ 401（有送達，只是權限不足）
 *     預檢的 GET（apikey 在標頭）      → TypeError
 *
 * 而 supabase-js 的每一個請求都帶 apikey 與 X-Client-Info，所以整個資料層
 * 在 LINE 裡都不能用——球場列表崩潰、登入拿不到 session。伺服器端怎麼調
 * CORS 都沒用，因為預檢根本到不了伺服器。
 *
 * 這支函式讓前端改用「POST + Content-Type: text/plain」把原始請求包在
 * body 裡送過來（那是 CORS 的簡單請求，不會預檢），由這裡在伺服器端replay。
 *
 * **不提升權限。** Authorization 與 apikey 原封不動轉送，RLS 照常生效——
 * 這支只是搬運工，不是後門。也因此它不能變成公開的轉發站：
 * 目的地限定在本專案的 /rest/v1 與 /auth/v1，其他一律拒絕。
 */
import { corsPreflight, json } from '../_shared/cors.ts'

const BASE = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')

/** 只允許轉送到這些路徑。避免變成任何人都能用的開放轉發站。 */
const ALLOWED = [/^\/rest\/v1\//, /^\/auth\/v1\//, /^\/storage\/v1\//]

/** 只轉送這些標頭。其他一律丟掉，不要把來源端的東西原封不動往裡送。 */
const FORWARD = ['authorization', 'apikey', 'content-type', 'prefer', 'accept', 'accept-profile', 'content-profile', 'range']

interface Payload {
  path?: string
  method?: string
  headers?: Record<string, string>
  body?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight()
  if (!BASE) return json({ error: '伺服器沒有設定 SUPABASE_URL' }, 500)

  let p: Payload
  try {
    p = await req.json()
  } catch {
    return json({ error: '不是合法的 JSON' }, 400)
  }

  const path = p.path ?? ''

  // 診斷用：不碰上游，直接回一個乾淨的 200。
  // 用來分辨「proxy 回 200 這件事本身行不行」與「轉送上游的回應行不行」。
  if (path === '/__ping') return json({ ok: true })

  if (!path.startsWith('/') || !ALLOWED.some((re) => re.test(path))) {
    return json({ error: '不允許的目的地：' + path.slice(0, 80) }, 400)
  }

  const headers = new Headers()
  for (const [k, v] of Object.entries(p.headers ?? {})) {
    if (FORWARD.includes(k.toLowerCase())) headers.set(k, v)
  }

  let upstream: Response
  try {
    upstream = await fetch(BASE + path, {
      method: p.method ?? 'GET',
      headers,
      body: p.body ?? undefined,
    })
  } catch (e) {
    return json({ error: '轉送失敗：' + ((e as Error).message || '') }, 502)
  }

  const text = await upstream.text()
  const out = new Headers({
    'Access-Control-Allow-Origin': '*',
    // 前端要讀得到下面那個自訂標頭，得先在這裡放行
    'Access-Control-Expose-Headers': 'x-proxy-content-range',
  })
  const ct = upstream.headers.get('content-type')
  if (ct) out.set('Content-Type', ct)

  /*
   * PostgREST 的分頁筆數在 Content-Range，少了它 supabase-js 的 count 會拿不到。
   * 但**不能原名轉送**：Content-Range 是給 206 Partial Content 用的標頭，
   * 出現在 200 上，iOS 的 WebKit 會把整個回應判成格式錯誤，fetch 直接以
   * 「Load failed」失敗。
   *
   * 這正是這支 proxy 第一版在 LINE 裡失效的原因，而且極難查：同樣形狀的
   * 請求打 report 函式成功、打 proxy 失敗，兩邊回應的唯一差別就是這一行。
   *
   * 改成換個名字帶回去，由前端在組合 Response 時還原。
   */
  const cr = upstream.headers.get('content-range')
  if (cr) out.set('x-proxy-content-range', cr)

  return new Response(text, { status: upstream.status, headers: out })
})
