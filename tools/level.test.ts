/** ===== level.test.ts =====
 * 程度推算的測試。這個數字餵給媒合，推錯了整個配對就歪掉，
 * 而且錯的方式很安靜——不會當機，只會配到打不起來的人。
 */
import assert from 'node:assert/strict'
import {
  estimateNtrp, snapToStep, levelName, levelLabel,
  EXPERIENCE_OPTIONS, FREQUENCY_OPTIONS, RALLY_OPTIONS,
} from '../src/lib/level.ts'
import type { Experience, Frequency, LevelAnswers, Rally } from '../src/lib/level.ts'

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

const ans = (rally: Rally, experience: Experience, frequency: Frequency): LevelAnswers =>
  ({ rally, experience, frequency })

console.log('\n推算結果的範圍')
test('最生疏的組合是 2.0', () => {
  assert.equal(estimateNtrp(ans('short', 'lt6m', 'monthly')), 2)
})
test('最熟練的組合是 4.5', () => {
  assert.equal(estimateNtrp(ans('attack', 'gt5y', 'weekly2')), 4.5)
})
test('所有組合都落在 2.0–4.5，而且都是合法的 0.5 刻度', () => {
  for (const e of EXPERIENCE_OPTIONS) {
    for (const f of FREQUENCY_OPTIONS) {
      for (const r of RALLY_OPTIONS) {
        const n = estimateNtrp(ans(r.id, e.id, f.id))
        assert.ok(n >= 2 && n <= 4.5, r.id + '/' + e.id + '/' + f.id + ' 算出 ' + n)
        assert.equal(n * 2, Math.round(n * 2), n + ' 不是 0.5 的倍數')
      }
    }
  }
})

console.log('\n對打回合數是主要訊號')
test('其他條件相同時，回合數越多程度越高', () => {
  const fixed = (r: Rally) => estimateNtrp(ans(r, '6m2y', 'weekly1'))
  assert.ok(fixed('short') < fixed('medium'))
  assert.ok(fixed('medium') < fixed('long'))
  assert.ok(fixed('long') < fixed('attack'))
})
test('回合數的影響大於球齡', () => {
  // 打五年但三球就失誤 vs 打半年但能來回十球以上
  const veteran = estimateNtrp(ans('short', 'gt5y', 'weekly1'))
  const newbie = estimateNtrp(ans('long', 'lt6m', 'weekly1'))
  assert.ok(newbie > veteran,
    '球齡不該壓過實際打得出來的東西（老手 ' + veteran + ' vs 新手 ' + newbie + '）')
})

console.log('\n頻率與球齡的加成')
test('每週兩次打半年，勝過每月幾次打五年', () => {
  const often = estimateNtrp(ans('medium', '6m2y', 'weekly2'))
  const rarely = estimateNtrp(ans('medium', 'gt5y', 'monthly'))
  assert.ok(often > rarely,
    '頻率比年資重要（常打 ' + often + ' vs 久但少打 ' + rarely + '）')
})
test('練習量只做半級微調，不會蓋過基準', () => {
  const low = estimateNtrp(ans('medium', 'lt6m', 'monthly'))
  const high = estimateNtrp(ans('medium', 'gt5y', 'weekly2'))
  assert.equal(high - low, 1, '同樣回合數下，兩個極端最多差一級')
})
test('頻率的權重高於年資', () => {
  // 每週兩次打半年到兩年 vs 每週一次打兩到五年
  const often = estimateNtrp(ans('medium', '6m2y', 'weekly2'))
  const longer = estimateNtrp(ans('medium', '2y5y', 'weekly1'))
  assert.ok(often > longer,
    '打得勤該勝過打得久（每週兩次 ' + often + ' vs 資歷較長 ' + longer + '）')
})

console.log('\n刻度與標籤')
test('推算值一律對齊 0.5 刻度', () => {
  assert.equal(snapToStep(3.2), 3)
  assert.equal(snapToStep(3.3), 3.5)
  assert.equal(snapToStep(1.1), 2, '低於下限的往回夾到最小刻度')
})
test('每個刻度都有白話標籤，而且不重複到看不出差別', () => {
  const names = [2, 2.5, 3, 3.5, 4, 4.5].map((n) => levelName(n as never))
  assert.equal(new Set(names).size, names.length, '標籤有重複：' + names.join('、'))
  for (const n of names) assert.ok(n.length > 0)
})
test('標籤把白話放前面、NTRP 放括號裡', () => {
  assert.equal(levelLabel(3.5 as never), '能控制球路（NTRP 3.5）')
})

console.log('\n' + passed + ' 個測試通過' + (process.exitCode ? '，有失敗' : '') + '\n')
