/** ===== scoring.test.ts =====
 * 計分引擎的離線測試，不需要瀏覽器：npm test
 */
import assert from 'node:assert/strict'
import {
  awardPoint, newScore, displayPoints, scoreboard, undoPoint,
  formatFinalScore, DEFAULT_FORMAT, QUICK_FORMAT,
} from '../src/lib/scoring.ts'
import type { MatchFormat, ScoreState } from '../src/lib/types.ts'

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

function play(seq: string, format: MatchFormat = DEFAULT_FORMAT, firstServer: 0 | 1 = 0): ScoreState {
  let s = newScore(firstServer)
  for (const c of seq) {
    if (c === 'a' || c === 'A') s = awardPoint(s, 0, format)
    else if (c === 'b' || c === 'B') s = awardPoint(s, 1, format)
  }
  return s
}
/** 讓某一方連拿 n 局（每局四分乾淨拿下）。 */
function games(side: 'a' | 'b', n: number): string { return side.repeat(4 * n) }
/** 雙方各拿 n 局，用來把比分推到 5:5、6:6 這種平手狀態。 */
function evenGames(n: number): string { return 'aaaabbbb'.repeat(n) }

console.log('\n一般局計分')
test('0/15/30/40 依序顯示', () => {
  assert.equal(displayPoints(play(''), 0), '0')
  assert.equal(displayPoints(play('a'), 0), '15')
  assert.equal(displayPoints(play('aa'), 0), '30')
  assert.equal(displayPoints(play('aaa'), 0), '40')
})
test('四分直落拿下一局，分數歸零', () => {
  const s = play('aaaa')
  assert.deepEqual(s.sets[0], [1, 0])
  assert.deepEqual(s.points, [0, 0])
})
test('40:40 是 deuce，不是誰贏', () => {
  const s = play('aaabbb')
  assert.equal(displayPoints(s, 0), '40')
  assert.equal(displayPoints(s, 1), '40')
  assert.deepEqual(s.sets[0], [0, 0])
})
test('deuce 後領先一分是 AD，再一分才拿局', () => {
  let s = play('aaabbba')
  assert.equal(displayPoints(s, 0), 'AD')
  assert.equal(displayPoints(s, 1), '40')
  s = awardPoint(s, 0, DEFAULT_FORMAT)
  assert.deepEqual(s.sets[0], [1, 0])
})
test('AD 之後被追回會回到 deuce', () => {
  const s = play('aaabbbab')
  assert.equal(displayPoints(s, 0), '40')
  assert.equal(displayPoints(s, 1), '40')
  assert.deepEqual(s.sets[0], [0, 0])
})
test('no-ad 賽制：40:40 下一分定勝負', () => {
  const noAd: MatchFormat = { ...DEFAULT_FORMAT, noAd: true }
  const s = play('aaabbba', noAd)
  assert.deepEqual(s.sets[0], [1, 0])
})

console.log('\n發球輪替')
test('每結束一局換發球', () => {
  assert.equal(newScore(0).server, 0)
  assert.equal(play('aaaa').server, 1)
  assert.equal(play('aaaabbbb').server, 0)
})

console.log('\n盤與搶七')
test('6:0 直接拿下一盤，開新盤', () => {
  const s = play(games('a', 6))
  assert.deepEqual(s.sets[0], [6, 0])
  assert.equal(s.sets.length, 2)
})
test('5:5 不算結束，要 7:5', () => {
  const s = play(evenGames(5))
  assert.deepEqual(s.sets[0], [5, 5])
  assert.equal(s.sets.length, 1)
  const s2 = play(evenGames(5) + games('a', 2))
  assert.deepEqual(s2.sets[0], [7, 5])
  assert.equal(s2.sets.length, 2)
})
test('6:6 進搶七，分數用數字顯示', () => {
  const s = play(evenGames(6))
  assert.equal(s.inTiebreak, true)
  assert.deepEqual(s.sets[0], [6, 6])
  const s1 = awardPoint(s, 0, DEFAULT_FORMAT)
  assert.equal(displayPoints(s1, 0), '1')
})
test('搶七 7:0 收下該盤，記成 7:6', () => {
  let s = play(evenGames(6))
  for (let i = 0; i < 7; i++) s = awardPoint(s, 0, DEFAULT_FORMAT)
  assert.deepEqual(s.sets[0], [7, 6])
  assert.equal(s.inTiebreak, false)
})
test('搶七 6:6 要贏兩分才算', () => {
  let s = play(evenGames(6))
  for (let i = 0; i < 6; i++) { s = awardPoint(s, 0, DEFAULT_FORMAT); s = awardPoint(s, 1, DEFAULT_FORMAT) }
  assert.deepEqual(s.points, [6, 6])
  s = awardPoint(s, 0, DEFAULT_FORMAT)
  assert.deepEqual(s.sets[0], [6, 6], '7:6 還不能收盤')
  s = awardPoint(s, 0, DEFAULT_FORMAT)
  assert.deepEqual(s.sets[0], [7, 6])
})
test('搶七發球是 1-2-2-2 輪替', () => {
  let s = play(evenGames(6))
  const first = s.server
  const seen: number[] = [s.server]
  for (let i = 0; i < 5; i++) { s = awardPoint(s, 0, DEFAULT_FORMAT); seen.push(s.server) }
  // 第 1 分 first 發；第 2、3 分對手發；第 4、5 分 first 發
  assert.deepEqual(seen, [first, 1 - first, 1 - first, first, first, 1 - first])
})

console.log('\n整場比賽')
test('三盤兩勝：先拿兩盤就結束，之後不再記分', () => {
  const s = play(games('a', 6) + games('a', 6), DEFAULT_FORMAT)
  assert.equal(s.winner, 0)
  assert.equal(formatFinalScore(s), '6-0 6-0')
  const after = awardPoint(s, 1, DEFAULT_FORMAT)
  assert.equal(after.log.length, s.log.length, '比賽結束後不該再吃分')
})
test('決勝盤打超級搶十，先到 10 分', () => {
  // a 先拿第一盤 6:0，b 拿回第二盤 0:6，第三盤就是決勝盤
  let s = play(games('a', 6) + games('b', 6), DEFAULT_FORMAT)
  assert.equal(s.sets.length, 3)
  assert.equal(s.winner, null)
  assert.equal(s.inTiebreak, true, '第三盤應直接進搶十')
  for (let i = 0; i < 9; i++) s = awardPoint(s, 0, DEFAULT_FORMAT)
  assert.equal(s.winner, null, '9 分還沒贏')
  s = awardPoint(s, 0, DEFAULT_FORMAT)
  assert.equal(s.winner, 0)
})
test('單盤快速賽不套用超級搶十', () => {
  const s = play(evenGames(5), QUICK_FORMAT)
  assert.equal(s.inTiebreak, false)
  assert.deepEqual(s.sets[0], [5, 5])
})
test('單盤賽拿下一盤就結束', () => {
  const s = play(games('a', 6), QUICK_FORMAT)
  assert.equal(s.winner, 0)
})

console.log('\n悔棋與提示')
test('悔棋回到上一分，狀態完全一致', () => {
  const before = play('aaabbb')
  const after = awardPoint(before, 0, DEFAULT_FORMAT)
  const undone = undoPoint(after, DEFAULT_FORMAT)
  assert.deepEqual(undone.points, before.points)
  assert.deepEqual(undone.sets, before.sets)
  assert.equal(undone.server, before.server)
  assert.equal(undone.log.length, before.log.length)
})
test('跨局悔棋也要把局數退回來', () => {
  const s = play('aaaa')
  assert.deepEqual(s.sets[0], [1, 0])
  const undone = undoPoint(s, DEFAULT_FORMAT)
  assert.deepEqual(undone.sets[0], [0, 0])
  assert.equal(displayPoints(undone, 0), '40')
})
test('悔棋後發球方要跟著退回去', () => {
  // B 先發，打完一局換 A 發；退回一分應該回到 B 發球
  const s = play('bbbb', DEFAULT_FORMAT, 1)
  assert.equal(s.server, 0)
  const undone = undoPoint(s, DEFAULT_FORMAT)
  assert.equal(undone.server, 1)
  assert.equal(undone.firstServer, 1)
})
test('firstServer 會一路帶著走，存進資料庫再讀回來也還在', () => {
  const s = play(games('a', 3) + 'ab', DEFAULT_FORMAT, 1)
  assert.equal(s.firstServer, 1)
  const back = JSON.parse(JSON.stringify(s))
  assert.equal(undoPoint(back, DEFAULT_FORMAT).firstServer, 1)
})
test('賽末點會被標出來', () => {
  const s = play(games('a', 6) + games('a', 5) + 'aaa')  // 6-0, 5-0 之後 40:0
  assert.equal(scoreboard(s, DEFAULT_FORMAT).isMatchPoint, 0)
  assert.equal(scoreboard(play('aa'), DEFAULT_FORMAT).isMatchPoint, null)
})

console.log('\n不可變性')
test('awardPoint 不會改到原本的狀態', () => {
  const s = play('aaa')
  const snapshot = JSON.stringify(s)
  awardPoint(s, 0, DEFAULT_FORMAT)
  assert.equal(JSON.stringify(s), snapshot)
})
test('計分狀態可以 JSON 來回而不失真', () => {
  const s = play(games('a', 6) + 'aab')
  const back = JSON.parse(JSON.stringify(s)) as ScoreState
  assert.deepEqual(back.sets, s.sets)
  assert.deepEqual(back.points, s.points)
})

console.log('\n' + passed + ' 個測試通過' + (process.exitCode ? '，有失敗' : '') + '\n')
