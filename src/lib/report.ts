/** ===== report.ts =====
 * 把前端的失敗細節送回資料庫。
 *
 * 為什麼需要：有些環境接不上開發者工具——LINE 的 iOS webview 就是。
 * 那裡失敗時我們只看得到一句話，而同一段程式在桌面瀏覽器、在 curl 都正常，
 * 於是只能靠「改一次、請使用者試一次」來回猜，非常慢而且經常猜錯。
 *
 * 讓 App 自己把發生什麼事送回來，就不必猜了。
 *
 * 三個刻意的限制：
 *   1. **絕不記憑證。** id_token、access token、apikey 一律不進 facts。
 *   2. **失敗就算了。** 回報是診斷用的，不能因為它失敗而改變使用者看到的東西。
 *   3. **只寫不讀。** 資料表的 RLS 只開 anon insert。
 */
import { supabase } from './supabase.ts'
import { callFunction } from './callFunction.ts'

export interface ReportFacts {
  [key: string]: string | number | boolean | null
}

export function report(stage: string, err: unknown, facts: ReportFacts = {}): void {
  if (!supabase) return
  const e = err as { name?: string; message?: string }
  // 走 report 這支 Edge Function 而不是直接寫 PostgREST：PostgREST 需要
  // apikey 標頭，會觸發 CORS preflight，而「預檢失敗」正是我們要查的
  // 那個 bug——用一條同樣可能壞掉的路去回報，等於什麼都收不到。
  // 實際發生過：資料表一直是空的，我們卻以為是「沒有錯誤」。
  void callFunction('report', {
    build: typeof __BUILD__ === 'string' ? __BUILD__ : null,
    stage,
    name: e?.name ?? null,
    message: e?.message ?? String(err),
    ua: navigator.userAgent.slice(0, 300),
    facts,
  }, { noPreflight: true }).catch((x: unknown) => {
    console.warn('[回報] 送不出去：' + ((x as Error).message ?? x))
  })
}
