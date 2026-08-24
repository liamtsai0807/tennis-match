/** ===== flex.test.ts =====
 * 驗證推播的 Flex Message 結構。
 *
 * 為什麼需要這個：Flex 的 JSON 錯了，LINE 只會回一個 400，而且是在正式環境
 * 才看得到——本機用假 token 測會先撞上 401，根本走不到內容驗證那一步。
 * 那等於「推播壞掉」這件事要等真的使用者收不到訊息才會發現。
 *
 * 這裡照 LINE Flex Message 的規則走一遍整棵樹，把會被退件的結構先擋下來。
 */
import { strict as assert } from 'node:assert'
import {
  acceptedFlex, endedFlex, invitedFlex, reminderFlex, liffLink,
} from '../supabase/functions/_shared/flex.ts'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log('  ok   ' + name)
}
function group(name: string) { console.log('\n' + name) }

// ---------- 結構檢查 ----------

type Node = Record<string, unknown>

/** 走完整棵樹，把 LINE 會退件的結構找出來。path 是為了讓錯誤訊息指得出位置。 */
function walk(node: Node, path: string, problems: string[]): void {
  const t = node.type
  if (typeof t !== 'string') { problems.push(path + ' 沒有 type'); return }

  switch (t) {
    case 'box': {
      if (!['vertical', 'horizontal', 'baseline'].includes(node.layout as string)) {
        problems.push(`${path} box 的 layout 不合法：${String(node.layout)}`)
      }
      const kids = node.contents
      if (!Array.isArray(kids)) { problems.push(path + ' box 沒有 contents 陣列'); break }
      if (kids.length === 0) problems.push(path + ' box 的 contents 是空的（LINE 會退件）')
      kids.forEach((k, i) => walk(k as Node, `${path}.contents[${i}]`, problems))
      break
    }
    case 'text': {
      const s = node.text
      if (typeof s !== 'string' || s.length === 0) problems.push(path + ' text 是空的')
      if (typeof s === 'string' && s.length > 2000) problems.push(path + ' text 超過 2000 字')
      break
    }
    case 'button': {
      const a = node.action as Node | undefined
      if (!a) { problems.push(path + ' button 沒有 action'); break }
      if (a.type === 'uri') {
        const uri = String(a.uri ?? '')
        if (!/^https:\/\//.test(uri) && !/^line:\/\//.test(uri)) {
          problems.push(`${path} button 的 uri 必須是 https 或 line://：${uri}`)
        }
      }
      if (!a.label) problems.push(path + ' button 的 action 沒有 label')
      break
    }
    case 'separator':
    case 'filler':
    case 'spacer':
      break
    default:
      problems.push(`${path} 不認得的元件型別：${t}`)
  }
}

function check(msg: Record<string, unknown>): string[] {
  const problems: string[] = []
  if (msg.type !== 'flex') problems.push('最外層的 type 不是 flex')

  const alt = msg.altText
  if (typeof alt !== 'string' || alt.length === 0) problems.push('缺 altText')
  // altText 是通知列會顯示的字，超過 400 會被 LINE 退件
  if (typeof alt === 'string' && alt.length > 400) problems.push('altText 超過 400 字')

  const c = msg.contents as Node | undefined
  if (!c) { problems.push('缺 contents'); return problems }
  if (c.type !== 'bubble') problems.push('contents 不是 bubble')
  for (const slot of ['header', 'body', 'footer'] as const) {
    const s = c[slot] as Node | undefined
    if (!s) continue
    if (s.type !== 'box') problems.push(`${slot} 必須是 box`)
    walk(s, slot, problems)
  }
  if (!c.body) problems.push('bubble 沒有 body（LINE 會退件）')
  return problems
}

// ---------- 測試資料 ----------

const LIFF = '1234567890-AbcdEfgh'
const url = liffLink(LIFF, '/invites/inv-1')
const person = { name: '王凱文', ntrp: 3.5, district: '台北市大安區' }
const paid = { name: '彩虹河濱公園網球場', price_per_hour: 140 }
const free = { name: '百齡河濱公園網球場（社子岸）', price_per_hour: 0 }

// ---------- 測試 ----------

group('深連結')

test('liff.state 是編碼過的路徑，不是 hash', () => {
  // LIFF 的網址不能帶 #，路徑只能走查詢參數送進去
  assert.ok(!url.includes('#'), '網址不該有 #：' + url)
  assert.ok(url.startsWith('https://liff.line.me/' + LIFF), url)
  assert.equal(new URL(url).searchParams.get('liff.state'), '/invites/inv-1')
})

group('邀約卡')

test('結構合法', () => {
  const p = check(invitedFlex({
    from: person, club: paid, whenText: '8/30 (日) 19:00–20:00',
    message: '看到我們程度差不多，要不要打一場', score: 92, inviteUrl: url,
  }))
  assert.deepEqual(p, [])
})

test('沒有留言時不會產生空的文字元件', () => {
  // 空字串的 text 元件會被 LINE 退件，所以留言是空的時候整塊要不存在
  const p = check(invitedFlex({
    from: person, club: paid, whenText: '8/30 (日) 19:00–20:00',
    message: '', score: null, inviteUrl: url,
  }))
  assert.deepEqual(p, [])
})

test('沒有程度與地區時也不會有空文字', () => {
  const p = check(invitedFlex({
    from: { name: '新來的', ntrp: null, district: null },
    club: paid, whenText: '8/30 (日) 19:00–20:00', message: '', score: null, inviteUrl: url,
  }))
  assert.deepEqual(p, [])
})

test('altText 讀得懂是誰約你、什麼時候', () => {
  const m = invitedFlex({
    from: person, club: paid, whenText: '8/30 (日) 19:00–20:00',
    message: '', score: null, inviteUrl: url,
  })
  assert.ok(m.altText.includes('王凱文'), m.altText)
  assert.ok(m.altText.includes('8/30'), m.altText)
})

group('約成通知')

test('要訂場的版本結構合法，而且講得出誰去訂', () => {
  const m = acceptedFlex({
    other: person, club: paid, whenText: '8/30 (日) 19:00–20:00',
    bookerIsYou: true, needsBooking: true, inviteUrl: url,
  })
  assert.deepEqual(check(m), [])
  assert.ok(JSON.stringify(m).includes('誰去訂'))
})

test('不用訂的球場不會叫人去訂', () => {
  const m = acceptedFlex({
    other: person, club: free, whenText: '8/30 (日) 09:00–10:00',
    bookerIsYou: true, needsBooking: false, inviteUrl: url,
  })
  assert.deepEqual(check(m), [])
  const s = JSON.stringify(m)
  assert.ok(s.includes('不用訂'), '應該要說不用訂')
  assert.ok(!s.includes('誰去訂'), '不用訂的場不該出現「誰去訂」')
})

group('婉拒與取消')

test('婉拒的結構合法，並且說明場地已退', () => {
  const m = endedFlex({ other: person, club: paid, whenText: '8/30 (日) 19:00–20:00', cancelled: false, inviteUrl: url })
  assert.deepEqual(check(m), [])
  assert.ok(JSON.stringify(m).includes('退掉'))
})

test('取消與婉拒的說法不一樣', () => {
  const a = endedFlex({ other: person, club: paid, whenText: 'x', cancelled: false, inviteUrl: url })
  const b = endedFlex({ other: person, club: paid, whenText: 'x', cancelled: true, inviteUrl: url })
  assert.notEqual(a.altText, b.altText)
})

group('訂場提醒')

test('有官方訂場連結時給兩個出口', () => {
  const m = reminderFlex({
    other: person, club: paid, whenText: '8/30 (日) 19:00', hoursLeft: 22,
    bookerIsYou: true, inviteUrl: url, bookingUrl: 'https://vbs.sports.taipei/venues/?K=201',
  })
  assert.deepEqual(check(m), [])
  const buttons = JSON.stringify(m).match(/"type":"button"/g) ?? []
  assert.equal(buttons.length, 2, '應該要有「去訂場」與「我訂好了／換人訂」兩顆')
})

test('沒有官方連結時只剩一顆，而且結構仍然合法', () => {
  const m = reminderFlex({
    other: person, club: paid, whenText: '8/30 (日) 19:00', hoursLeft: 22,
    bookerIsYou: true, inviteUrl: url, bookingUrl: null,
  })
  assert.deepEqual(check(m), [])
  const buttons = JSON.stringify(m).match(/"type":"button"/g) ?? []
  assert.equal(buttons.length, 1)
})

group('會被 LINE 退件的結構')

test('驗證器抓得到空的 text', () => {
  const bad = {
    type: 'flex', altText: 'x',
    contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '' }] } },
  }
  assert.ok(check(bad).some((p) => p.includes('text 是空的')), '沒抓到空文字：' + check(bad))
})

test('驗證器抓得到非 https 的按鈕連結', () => {
  const bad = {
    type: 'flex', altText: 'x',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'button', action: { type: 'uri', label: '去', uri: 'http://example.com' } }],
      },
    },
  }
  assert.ok(check(bad).some((p) => p.includes('https')), '沒抓到 http 連結')
})

console.log(`\n${passed} 個測試通過`)
