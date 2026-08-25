/** ===== callFunction.ts =====
 * 呼叫 Edge Function。
 *
 * 為什麼不用 supabase.functions.invoke()：
 *
 * 它會自己替我們加標頭（apikey、X-Client-Info、視情況還有 x-region），
 * 而那份清單是隨版本會變的。標頭一旦超出 Edge Function 的
 * Access-Control-Allow-Headers，瀏覽器就擋在 preflight，fetch 直接在網路層
 * 死掉——前端只看得到「Failed to send a request to the Edge Function」，
 * 伺服器端一行日誌都沒有，因為函式根本沒被呼叫到。
 *
 * 這個組合實際上讓 LINE 登入在 LINE 的 iOS webview 裡完全不能用，而且
 * 同一段程式在桌面瀏覽器、在 curl 都正常，查起來像在抓鬼。
 *
 * 改成自己 fetch：送出去的標頭就是這裡寫的兩個，跟後端的允許清單一眼對得起來。
 * 順帶拿得到真正的狀態碼與回應內容——invoke() 只給一句
 * 「non-2xx status code」，得再想辦法把 body 挖出來。
 */
import { supabase } from './supabase.ts'

const URL_ = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export class FunctionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/**
 * 送一個 JSON 請求給 Edge Function，回傳解析後的 JSON。
 * 非 2xx 會丟 FunctionError，訊息帶狀態碼與伺服器給的原因。
 */
export async function callFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error('沒有設定後端')
  if (!URL_ || !KEY) throw new Error('後端設定不完整')

  // 登入中的人用自己的 token，沒登入就用 anon——兩者都是合法 JWT，
  // 而 Edge Function 的 verify_jwt 只在意「是不是這個專案簽的」。
  const token = (await supabase.auth.getSession()).data.session?.access_token ?? KEY

  let res: Response
  try {
    res = await fetch(`${URL_}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    // 走到這裡代表連請求都沒送出去：CORS 被擋、沒網路、或被中斷
    throw new Error('連不到伺服器（' + ((e as Error).message || '網路錯誤') + '）')
  }

  const raw = await res.text()
  let parsed: unknown = null
  try { parsed = raw ? JSON.parse(raw) : null } catch { /* 不是 JSON 就用原文 */ }

  if (!res.ok) {
    const detail = (parsed as { error?: string })?.error ?? raw.slice(0, 200)
    throw new FunctionError(res.status, `${res.status}：${detail || '伺服器沒有說明原因'}`)
  }
  return parsed as T
}
