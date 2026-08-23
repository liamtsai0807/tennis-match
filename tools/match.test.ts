/** ===== match.test.ts =====
 * 媒合演算法的離線測試：npm test
 * 排序錯了不會當機，只會默默推薦錯的人，所以這塊一定要有測試守著。
 */
import assert from 'node:assert/strict'
import { distanceKm, km } from '../src/lib/geo.ts'
import { isFreeOn, rankPartners, rankClubs, blockOf, hoursIn, BLOCKS } from '../src/lib/match.ts'
import type { Club, Ntrp, Player } from '../src/lib/types.ts'

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

// 2026-08-22 是週六、08-23 週日、08-24 週一
const SAT = '2026-08-22'
const MON = '2026-08-24'

function player(over: Partial<Player> & { id: string }): Player {
  return {
    name: over.id, avatar_hue: 200, ntrp: 3, district: '台北市大安區',
    lat: 25.03, lng: 121.54, hand: 'right', bio: '', wins: 0, losses: 0,
    level_answers: 'manual',
    availability: { weekdays: [0, 1, 2, 3, 4, 5, 6], blocks: ['morning', 'afternoon', 'evening'] },
    pref_club_ids: [], pref_ntrp_min: 2 as Ntrp, pref_ntrp_max: 5.5 as Ntrp,
    ...over,
  }
}

function club(id: string, lat: number, lng: number): Club {
  return {
    id, name: id, district: '', address: '', lat, lng,
    surface: 'hard', indoor: false, lights: true, price_per_hour: 500,
    rating: 4, photo: '', courts: 4, open_hour: 6, close_hour: 22,
    source: 'manual',
  }
}

console.log('\n距離')
test('同一點距離是 0', () => {
  assert.equal(distanceKm({ lat: 25, lng: 121 }, { lat: 25, lng: 121 }), 0)
})
test('台北到高雄大約 300 公里', () => {
  const d = distanceKm({ lat: 25.033, lng: 121.565 }, { lat: 22.627, lng: 120.301 })
  assert.ok(d > 280 && d < 320, '算出來是 ' + d.toFixed(1) + ' 公里')
})
test('距離是對稱的', () => {
  const a = { lat: 25.03, lng: 121.54 }
  const b = { lat: 25.08, lng: 121.58 }
  assert.equal(distanceKm(a, b).toFixed(6), distanceKm(b, a).toFixed(6))
})
test('一公里以內用公尺表示', () => {
  assert.equal(km(0.42), '420 公尺')
  assert.equal(km(3.14), '3.1 公里')
  assert.equal(km(23.6), '24 公里')
})

console.log('\n時段')
test('小時對應到正確的時段', () => {
  assert.equal(blockOf(8), 'morning')
  assert.equal(blockOf(14), 'afternoon')
  assert.equal(blockOf(19), 'evening')
})
test('時段展開成整點清單', () => {
  assert.deepEqual(hoursIn('evening'), [17, 18, 19, 20, 21])
  assert.equal(hoursIn('morning').length, BLOCKS.morning.to - BLOCKS.morning.from)
})
test('有空與否要同時看星期幾和時段', () => {
  const p = player({ id: 'a', availability: { weekdays: [1, 2, 3, 4, 5], blocks: ['evening'] } })
  assert.equal(isFreeOn(p, MON, 'evening'), true)
  assert.equal(isFreeOn(p, MON, 'morning'), false, '星期對了但時段不對')
  assert.equal(isFreeOn(p, SAT, 'evening'), false, '時段對了但星期不對')
})

console.log('\n媒合球伴')
const me = player({
  id: 'me', ntrp: 3, pref_ntrp_min: 2.5, pref_ntrp_max: 3.5,
  pref_club_ids: ['c-daan', 'c-xinyi'],
})

test('程度超出我設定的區間就不推薦', () => {
  const pool = [player({ id: 'strong', ntrp: 4.5 }), player({ id: 'ok', ntrp: 3 })]
  const out = rankPartners(me, pool, { date: MON, block: 'evening', loosen: false })
  assert.deepEqual(out.map((f) => f.player.id), ['ok'])
})
test('放寬條件後超出區間的人也會出現，但排在後面', () => {
  const pool = [player({ id: 'strong', ntrp: 4.5 }), player({ id: 'ok', ntrp: 3 })]
  const out = rankPartners(me, pool, { date: MON, block: 'evening', loosen: true })
  assert.equal(out.length, 2)
  assert.equal(out[0].player.id, 'ok')
  assert.equal(out.find((f) => f.player.id === 'strong')!.levelOk, false)
})
test('那天沒空的一律排在有空的後面，即使其他條件更好', () => {
  const busy = player({
    id: 'busy', ntrp: 3, pref_club_ids: ['c-daan', 'c-xinyi'],
    availability: { weekdays: [0, 6], blocks: ['morning'] },
  })
  const free = player({ id: 'free', ntrp: 3.5 })
  const out = rankPartners(me, [busy, free], { date: MON, block: 'evening', loosen: false })
  assert.equal(out[0].player.id, 'free')
  assert.ok(out[1].score > out[0].score, 'busy 的分數其實比較高，只是沒空才排後面')
})
test('有共同常去的球場會拉高分數', () => {
  const shared = player({ id: 'shared', ntrp: 3, pref_club_ids: ['c-daan', 'c-xinyi'] })
  const none = player({ id: 'none', ntrp: 3, pref_club_ids: ['c-taoyuan'] })
  const out = rankPartners(me, [none, shared], { date: MON, block: 'evening', loosen: false })
  assert.equal(out[0].player.id, 'shared')
  assert.deepEqual(out[0].sharedClubIds, ['c-daan', 'c-xinyi'])
  assert.deepEqual(out[1].sharedClubIds, [])
})
test('雙向合適（我也在對方的區間內）會加分', () => {
  const oneWay = player({ id: 'oneway', ntrp: 3, pref_ntrp_min: 4, pref_ntrp_max: 5 })
  const twoWay = player({ id: 'twoway', ntrp: 3, pref_ntrp_min: 2.5, pref_ntrp_max: 3.5 })
  const out = rankPartners(me, [oneWay, twoWay], { date: MON, block: 'evening', loosen: false })
  assert.equal(out[0].player.id, 'twoway')
  assert.equal(out[0].mutual, true)
  assert.equal(out.find((f) => f.player.id === 'oneway')!.mutual, false)
})
test('不會把自己配給自己', () => {
  const out = rankPartners(me, [me, player({ id: 'other' })], { date: MON, block: 'evening', loosen: true })
  assert.deepEqual(out.map((f) => f.player.id), ['other'])
})
test('每個人都附上看得懂的理由', () => {
  const out = rankPartners(me, [player({ id: 'x', ntrp: 3 })], { date: MON, block: 'evening', loosen: false })
  assert.ok(out[0].reasons.length >= 2)
  assert.ok(out[0].reasons.some((r) => r.includes('程度')))
})

console.log('\n選球場')
// 我在大安 (25.027,121.549)，對方在板橋 (25.014,121.463)
const meDaan = player({ id: 'me', lat: 25.027, lng: 121.549, pref_club_ids: ['c-daan'] })
const youBanqiao = player({ id: 'you', lat: 25.014, lng: 121.463, pref_club_ids: ['c-banqiao'] })

const CLUBS = [
  club('c-daan', 25.027, 121.549),       // 我家門口，對方要跑 8.7 公里
  club('c-banqiao', 25.014, 121.463),    // 對方家門口，我要跑 8.7 公里
  club('c-wanhua', 25.020, 121.506),     // 真正的中間點，兩人各約 4.3 公里
  club('c-zhongshan', 25.070, 121.520),  // 偏北，不在兩人之間
  club('c-taoyuan', 25.000, 121.220),    // 兩人都很遠
]

test('兩人都設為常去的球場排第一', () => {
  const both = player({ id: 'you2', lat: 25.014, lng: 121.463, pref_club_ids: ['c-zhongshan'] })
  const meBoth = player({ id: 'me2', lat: 25.027, lng: 121.549, pref_club_ids: ['c-zhongshan'] })
  const out = rankClubs(CLUBS, meBoth, both)
  assert.equal(out[0].club.id, 'c-zhongshan')
  assert.equal(out[0].tag, '兩人都常來')
})
test('雙方各有偏好時，中間點贏過任一方的家門口', () => {
  const out = rankClubs(CLUBS, meDaan, youBanqiao)
  assert.equal(out[0].club.id, 'c-wanhua',
    '中間點對兩人都只要 4 公里，該贏過「我家門口但對方要跑 9 公里」的大安' +
    '（實際排序：' + out.map((f) => f.club.id).join(' > ') + '）')
})
test('我的偏好不足以壓過「對方要跑非常遠」', () => {
  const farAway = player({ id: 'far', lat: 24.80, lng: 121.02, pref_club_ids: [] })  // 新竹
  const out = rankClubs(CLUBS, meDaan, farAway)
  assert.notEqual(out[0].club.id, 'c-daan',
    '對方在新竹，大安對他來說是 60 公里，不該因為我常去就排第一' +
    '（實際排序：' + out.map((f) => f.club.id).join(' > ') + '）')
})
test('偏好相同時，比較公平的那個贏', () => {
  const out = rankClubs(CLUBS, meDaan, youBanqiao)
  const wanhua = out.find((f) => f.club.id === 'c-wanhua')!
  const zhongshan = out.find((f) => f.club.id === 'c-zhongshan')!
  assert.equal(wanhua.prefMe, false)
  assert.equal(zhongshan.prefMe, false)
  assert.ok(wanhua.score > zhongshan.score, '兩個都不是偏好球場，萬華比較居中所以該贏')
})
test('兩人都很遠的球場排最後', () => {
  const out = rankClubs(CLUBS, meDaan, youBanqiao)
  assert.equal(out[out.length - 1].club.id, 'c-taoyuan')
})
test('worst 取的是兩人之中較遠的那個', () => {
  const out = rankClubs(CLUBS, meDaan, youBanqiao)
  for (const f of out) {
    assert.equal(f.worst, Math.max(f.fromMe, f.fromPartner))
  }
})
test('球場排序對調兩人身分後結果一致（公平性）', () => {
  const a = rankClubs(CLUBS, meDaan, youBanqiao).map((f) => f.club.id)
  const b = rankClubs(CLUBS, youBanqiao, meDaan).map((f) => f.club.id)
  assert.deepEqual(a, b, '換個人來看，推薦順序不該變')
})
test('標籤說得出為什麼推薦它', () => {
  const out = rankClubs(CLUBS, meDaan, youBanqiao)
  const daan = out.find((f) => f.club.id === 'c-daan')!
  assert.equal(daan.tag, '你常來')
  assert.equal(daan.prefMe, true)
  assert.equal(daan.prefPartner, false)
})

console.log('\n' + passed + ' 個測試通過' + (process.exitCode ? '，有失敗' : '') + '\n')
