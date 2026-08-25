/** ===== report =====
 * 收前端回報的失敗細節，寫進 client_errors。
 *
 * 為什麼不讓前端直接寫 PostgREST：那需要 apikey 標頭，會觸發 CORS preflight，
 * 而「預檢失敗」正是我們要查的那個 bug——用一條同樣可能壞掉的路去回報，
 * 等於什麼都收不到（實際發生過，資料表一直是空的）。
 *
 * 這支刻意做成 verify_jwt = false 且不需要任何自訂標頭，前端用
 * Content-Type: text/plain 送 JSON，於是是 CORS 的「簡單請求」，
 * 瀏覽器完全不會發預檢。
 *
 * 它自己也是一個探針：回報收得到，就證明「無預檢的 POST」在那個環境是
 * 通的，那 line-auth 的失敗就另有原因。收不到，就證明整條 functions 路徑
 * 都被擋住，跟 CORS 無關。
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight()

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: '不是合法的 JSON' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 只收白名單欄位。前端傳什麼都不該直接進資料庫，
  // 而且長度要截斷——這是一個匿名可寫的端點
  const row = {
    build: String(payload.build ?? '').slice(0, 60) || null,
    stage: String(payload.stage ?? '').slice(0, 60) || null,
    name: String(payload.name ?? '').slice(0, 120) || null,
    message: String(payload.message ?? '').slice(0, 2000) || null,
    ua: String(payload.ua ?? '').slice(0, 300) || null,
    facts: payload.facts ?? {},
  }

  const { error } = await admin.from('client_errors').insert(row)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
