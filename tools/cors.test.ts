/** ===== cors.test.ts =====
 * CORS 少列一個標頭的失敗方式特別惡劣：
 *
 *   - 瀏覽器擋在 preflight，fetch 直接在網路層死掉
 *   - 前端只看得到「Failed to send a request to the Edge Function」
 *   - 函式根本沒被呼叫到，所以伺服器端一行日誌都沒有
 *   - **curl 測完全正常**，因為 curl 不做 preflight
 *
 * 真的發生過：allow-headers 只列了 authorization 與 content-type，但
 * supabase-js 的 functions.invoke() 還會送 x-client-info 與 apikey，
 * 於是 LINE 登入在正式站一按就錯，而所有從命令列做的驗證都是綠的。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { CORS_HEADERS } from '../supabase/functions/_shared/cors.ts'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log('  ok   ' + name)
  } catch (e) {
    console.error('  FAIL ' + name)
    console.error('       ' + (e as Error).message)
    process.exitCode = 1
  }
}

/** supabase-js 的 functions.invoke() 一定會送的標頭。 */
const REQUIRED = ['authorization', 'x-client-info', 'apikey', 'content-type']

console.log('\nEdge Function 的 CORS')

test('allow-headers 涵蓋 supabase-js 會送的每一個標頭', () => {
  const allowed = CORS_HEADERS['Access-Control-Allow-Headers']
    .split(',').map((h) => h.trim().toLowerCase())
  for (const h of REQUIRED) {
    assert.ok(allowed.includes(h),
      `少了 ${h}——瀏覽器會擋掉 preflight，而前端只會看到「Failed to send a request」`)
  }
})

test('POST 與 OPTIONS 都在允許的方法裡', () => {
  const methods = CORS_HEADERS['Access-Control-Allow-Methods']
    .split(',').map((m) => m.trim().toUpperCase())
  assert.ok(methods.includes('POST'))
  assert.ok(methods.includes('OPTIONS'))
})

test('前端會呼叫的 function 都用共用的 CORS，沒有自己寫一份', () => {
  const dir = new URL('../supabase/functions/', import.meta.url)
  // 前端透過 functions.invoke() 呼叫的那些
  const browserFacing = ['line-auth', 'notify-invite']
  for (const name of browserFacing) {
    const src = readFileSync(new URL(name + '/index.ts', dir), 'utf8')
    assert.ok(src.includes("_shared/cors.ts"),
      `${name} 沒有用共用的 CORS 模組`)
    assert.ok(!src.includes('Access-Control-Allow-Headers'),
      `${name} 自己寫了一份 allow-headers，會跟共用的走鐘`)
    assert.ok(src.includes('corsPreflight()'),
      `${name} 沒有處理 OPTIONS preflight`)
  }
})

test('沒有漏掉新的 function', () => {
  const dir = new URL('../supabase/functions/', import.meta.url)
  const fns = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
  // 這裡不是要求每個都做 CORS——排程用的函式不需要——而是新增函式時
  // 會踩到這個斷言，逼人想一下「這支會不會被瀏覽器呼叫」
  assert.deepEqual(fns.sort(), ['line-auth', 'notify-invite', 'remind-bookings'],
    '函式清單變了：新增的那支如果會被前端呼叫，要用 _shared/cors.ts')
})

console.log('\n' + passed + ' 個測試通過' + (process.exitCode ? '，有失敗' : '') + '\n')
