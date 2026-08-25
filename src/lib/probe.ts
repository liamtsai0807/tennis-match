/** ===== probe.ts =====
 * 開機時測一次「哪一類跨網域請求在這個環境能用」，把結果回報回來。
 *
 * 為什麼需要：iOS 26 的 LINE LIFF webview 裡，supabase-js 的每一個請求都以
 * TypeError 收場，而我們自己送的「簡單請求」卻成功（回報就是那樣送達的）。
 * 兩者的差別是 CORS preflight。但那只是推論——在改動架構之前，要有直接證據。
 *
 * 三個探針分別代表一類：
 *   simple   不帶自訂標頭、Content-Type: text/plain → 不觸發預檢
 *   apikeyQS GET 把 apikey 放查詢字串、不帶標頭 → 也不觸發預檢
 *   headers  GET 帶 apikey 標頭 → 觸發預檢
 *
 * 只跑一次，而且完全不擋任何流程。
 */
import { report } from './report.ts'

const URL_ = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

async function probe(fn: () => Promise<Response>): Promise<string> {
  try {
    const r = await fn()
    return String(r.status)
  } catch (e) {
    return 'FAIL:' + ((e as Error).name || '') + ':' + ((e as Error).message || '').slice(0, 40)
  }
}

export async function probeNetwork(): Promise<void> {
  if (!URL_ || !KEY) return
  if (sessionStorage.getItem('probed')) return
  sessionStorage.setItem('probed', '1')

  // proxy 那條路要不要走、走了通不通——這兩個是目前唯一還沒量過的東西
  const inClient = Boolean((window as { liff?: { isInClient?: () => boolean } }).liff?.isInClient?.())
  const viaProxy = await probe(() => fetch(URL_ + '/functions/v1/proxy', {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      path: '/rest/v1/clubs?select=id&limit=1', method: 'GET',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
    }),
  }))

  /*
   * 兩個對照實驗，用來隔離「是那支函式的問題，還是請求內容的問題」。
   *
   * proxySmall：打 proxy，但 payload 很小（不帶金鑰，預期回 401）。
   *             通了 → 函式本身沒問題，是內容大小或內容本身的關係。
   * reportBig ：打 report，但塞一段跟 proxy 差不多大的 payload。
   *             失敗 → 就是大小的問題，跟哪一支函式無關。
   */
  const proxySmall = await probe(() => fetch(URL_ + '/functions/v1/proxy', {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ path: '/rest/v1/clubs?select=id&limit=1', method: 'GET' }),
  }))
  const reportBig = await probe(() => fetch(URL_ + '/functions/v1/report', {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ stage: 'probe-big', message: 'x'.repeat(700) }),
  }))

  const [simple, apikeyQS, withHeaders] = await Promise.all([
    probe(() => fetch(URL_ + '/functions/v1/report', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ stage: 'probe-ping', message: 'ping' }),
    })),
    probe(() => fetch(URL_ + '/rest/v1/clubs?select=id&limit=1&apikey=' + encodeURIComponent(KEY))),
    probe(() => fetch(URL_ + '/rest/v1/clubs?select=id&limit=1', { headers: { apikey: KEY } })),
  ])

  report('probe', new Error('網路探針'), {
    simple, apikeyQS, withHeaders, inClient, viaProxy, proxySmall, reportBig,
  })
}
