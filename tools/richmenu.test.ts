/** ===== richmenu.test.ts =====
 * 圖文選單是使用者進入這個服務的唯一入口，壞掉的方式又特別安靜：
 * 按下去只是開了一個空白頁，沒有任何錯誤訊息，開發時也不會有人發現。
 *
 * 這裡守三件會默默壞掉的事：
 *   1. 選單指向 App 裡不存在的路由
 *   2. 底圖的格子數跟點擊範圍的數量對不起來（按到隔壁格）
 *   3. 點擊範圍沒有蓋滿整張圖（點下去沒反應的縫）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { areas, W, H, COLS, ROWS } from './setup_richmenu.ts'
import { CELLS } from './make_richmenu.ts'

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

/** 從 App.tsx 直接抓 <Route path="..."> 出來，而不是在這裡再抄一份路由表。 */
function appRoutes(): string[] {
  const src = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  return [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
}

/** liff.state 帶的那段路徑；外部網址回 null。 */
function liffPath(uri: string): string | null {
  if (!uri.startsWith('https://liff.line.me/')) return null
  const state = new URL(uri).searchParams.get('liff.state')
  return state
}

console.log('\n圖文選單')

test('底圖的格數跟點擊範圍一樣多', () => {
  assert.equal(CELLS.length, areas().length,
    'make_richmenu 的 CELLS 與 setup_richmenu 的 ACTIONS 必須一一對應')
  assert.equal(CELLS.length, COLS * ROWS)
})

test('每一格都指得到東西', () => {
  for (const a of areas()) {
    assert.ok(a.action.uri, a.action.label + ' 沒有網址')
    assert.match(a.action.uri, /^https:\/\//, a.action.label + ' 不是 https')
  }
})

test('LIFF 深連結指向的路由，App 裡真的存在', () => {
  const routes = appRoutes()
  assert.ok(routes.length > 3, '沒有從 App.tsx 抓到路由，正規表示式可能過時了')
  for (const a of areas()) {
    const path = liffPath(a.action.uri)
    if (path === null) continue      // 外部網址（報名球賽）不在這裡管
    assert.ok(routes.includes(path),
      `${a.action.label} 指向 ${path}，但 App.tsx 沒有這條路由`)
  }
})

test('點擊範圍蓋滿整張圖，沒有點不到的縫', () => {
  // 逐格檢查邊界是否首尾相接，比算總面積可靠——
  // 面積對得起來但位置錯開的情況，總面積一樣看不出來
  const grid = areas()
  for (let row = 0; row < ROWS; row++) {
    let x = 0
    for (let col = 0; col < COLS; col++) {
      const b = grid[row * COLS + col].bounds
      assert.equal(b.x, x, `第 ${row + 1} 列第 ${col + 1} 格的左緣對不上`)
      x += b.width
    }
    assert.equal(x, W, `第 ${row + 1} 列的寬度加起來不是 ${W}`)
  }
  let y = 0
  for (let row = 0; row < ROWS; row++) {
    const b = grid[row * COLS].bounds
    assert.equal(b.y, y, `第 ${row + 1} 列的上緣對不上`)
    y += b.height
  }
  assert.equal(y, H, `所有列的高度加起來不是 ${H}`)
})

test('第一格是找球場——打開 LINE 最常想做的那件事', () => {
  assert.equal(liffPath(areas()[0].action.uri), '/clubs')
  assert.ok(CELLS[0].title.includes('球場'))
})

console.log('\n' + passed + ' 個測試通過' + (process.exitCode ? '，有失敗' : '') + '\n')
