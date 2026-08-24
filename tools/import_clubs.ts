/** ===== import_clubs.ts =====
 * 把政府開放資料「全國運動場館資訊（iPlay）」轉成 src/lib/clubData.ts。
 *
 * 用法：
 *   node --experimental-strip-types tools/import_clubs.ts <iplay.csv> [縣市...]
 *   node --experimental-strip-types tools/import_clubs.ts ~/Downloads/iplay.csv 臺北市 新北市
 *
 * CSV 來源（年更一次，免費，政府資料開放授權條款第 1 版，使用須標示來源）：
 *   https://data.gov.tw/dataset/22849
 * 檔案 9.6MB、一萬五千筆，不進 git——要重跑就重新下載。
 *
 * 開放資料給得起的：名稱、行政區、地址、經緯度、開放星期、租借方式。
 * 給不起的：場地材質、室內外、夜燈、每小時價格、場地面數、評分。
 * 那些一律留 null 或標成未確認，不要編一個出來——編出來的價格使用者會當真。
 *
 * 第二個來源：臺北市體育局場館設施管理系統的場館頁 tools/data/vbs_tennis.json
 * 那是掃 vbs.sports.taipei/venues/?K=<id> 得到的——每一頁都是伺服器端算繪，
 * 一頁就有面數、開放時間、夜燈、收費，連經緯度都有，而且網址本身就是深連結。
 * 掃描方式寫在那個 JSON 的註解檔裡；資料進 git，不用每次重掃。
 *
 * 這一份補的不只是欄位，是整個場館：iPlay 漏掉了臺北市大部分的河濱網球場
 * （華中 7 面、彩虹 9 面、道南、中正、古亭、延平、景美⋯⋯），
 * 那些全都在市府的線上訂場系統裡訂得到。
 *
 * 三個來源的優先序：iPlay（底）→ 體育局場館頁（覆蓋，因為它是訂場系統的第一手）
 * → clubOverrides.ts 的人工查證（最高，人看過的最準）。
 *
 * 最後套上 src/lib/clubOverrides.ts：人工查證的修正（override）與開放資料整個
 * 漏掉的球場（addition）。那是唯一手改的一份，放在這裡套是因為 clubData.ts
 * 每次重跑都會整份重寫，人工成果寫在那裡會被蓋掉。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { CLUB_OVERRIDES } from '../src/lib/clubOverrides.ts'

interface VbsTennis {
  k: number; district: string; name: string
  lat: number; lng: number
  courts: number | null; fee: number | null; lights: boolean
  open_hour: number; close_hour: number
}

const VBS_TENNIS: VbsTennis[] = JSON.parse(
  readFileSync(new URL('./data/vbs_tennis.json', import.meta.url), 'utf8'),
)

/** 從體育局場館頁抓下來的那一天。資料會過期，不記日期就不知道哪一筆該重查。 */
const VBS_VERIFIED_ON = '2026-08-23'

const VBS_NOTE = '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。'

/** 場館頁的網址就是深連結，一頁看得到時段與收費 */
const vbsUrl = (k: number) => `https://vbs.sports.taipei/venues/?K=${k}`

/** 兩點距離（公尺）。用來判斷開放資料與體育局講的是不是同一個地方。 */
function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const p1 = (aLat * Math.PI) / 180
  const p2 = (bLat * Math.PI) / 180
  const dp = p2 - p1
  const dl = ((bLng - aLng) * Math.PI) / 180
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const [csvPath, ...cityArgs] = process.argv.slice(2)
if (!csvPath) {
  console.error('用法：node --experimental-strip-types tools/import_clubs.ts <iplay.csv> [縣市...]')
  process.exit(1)
}
const CITIES = cityArgs.length > 0 ? cityArgs : ['臺北市', '新北市']

// ---------- CSV ----------

/** 最小可用的 CSV 解析：處理引號、引號內的逗號與換行、跳脫的雙引號。 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows
}

// ---------- 過濾 ----------

/**
 * 練習壁是對著牆打的，不能兩個人約球。留著只會讓媒合推薦一個約不成的地方。
 */
function isPracticeWall(name: string, kind: string): boolean {
  return /練習壁|練習牆/.test(name + kind)
}

/** 租不到的場放進 App 只會害人白跑。台北市有將近一半是這種。 */
function isRentable(rental: string): boolean {
  return rental.includes('對外場地租借') && !rental.includes('不開放')
}

function cityOf(address: string): string {
  const m = /^\s*(?:\d+\s*)?(.{2,3}?[市縣])/.exec(address)
  return m ? m[1].replace('台', '臺') : ''
}

// ---------- 臺北市體育局訂場系統 ----------

/**
 * 地址正規化。兩份資料同一個地點寫法不一樣：
 * iPlay 寫「臺北市 士林區 忠誠路二段77號」，體育局寫「臺北市士林區忠誠路2段77號 」。
 * 統一臺／台、去掉空白與括號說明、去掉郵遞區號、中文數字的「段」換成阿拉伯數字。
 */
function normAddr(a: string): string {
  const cn: Record<string, string> = {
    一: '1', 二: '2', 三: '3', 四: '4', 五: '5',
    六: '6', 七: '7', 八: '8', 九: '9', 十: '10',
  }
  return (a ?? '')
    .replace(/臺/g, '台')
    .replace(/[\s\u3000]/g, '')
    .replace(/\(.*?\)|（.*?）/g, '')
    .replace(/^\d{3,5}/, '')
    .replace(/^台灣/, '')
    .replace(/([一二三四五六七八九十])段/g, (_m, d: string) => cn[d] + '段')
}

// ---------- 產生穩定的 id ----------

/**
 * id 由名稱與地址推出來，不用流水號——開放資料年更一次，
 * 中間插進一筆就會把後面所有流水號往後推，使用者存的偏好球場就全錯位了。
 */
function slugId(name: string, address: string): string {
  let h = 2166136261
  for (const ch of name + '|' + address) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return 'c-' + (h >>> 0).toString(36).padStart(7, '0')
}

/**
 * 由 id 推出一個穩定的漸層底圖，不依賴外部圖床也不用每筆手挑顏色。
 *
 * 色相刻意鎖在 8–44 度這段紅土到赭石的範圍，飽和度也壓低。
 * 原本是整個色環隨機取，配上黑白紅土的版面之後，一張洋紅色的球場卡
 * 會比球場本身還搶眼——那是設計在跟內容爭注意力。
 */
function gradient(id: string): string {
  let n = 0
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) % 997
  // 6–28 度。原本開到 44，但色相一過 35、飽和度又低的時候會讀成橄欖綠，
  // 那跟紅土是兩回事。收窄之後整排球場卡才像同一個材質的不同角度。
  const h = 6 + (n % 23)
  const s = 34 + (n % 4) * 6      // 34–52%：夠分辨，又不會變螢光
  return `linear-gradient(150deg,hsl(${h} ${s}% 36%),hsl(${h + 5} ${s}% 24%) 55%,hsl(${h + 9} ${s + 4}% 15%))`
}

// ---------- 主流程 ----------

const rows = parseCsv(readFileSync(csvPath, 'utf8').replace(/^﻿/, ''))
const header = rows[0]
const col = (name: string) => header.indexOf(name)
const iDistrict = col('行政區')
const iName = col('場館名稱')
const iKind = col('場館分類')
const iAddr = col('地址')
const iLat = col('緯度')
const iLng = col('經度')
const iFacility = col('設施項目')
const iRental = col('租借資訊')
// 訂不到場的時候，能打的那支電話比什麼都有用。開放資料每一筆都有。
const iPhone = col('場館實際管理人電話')
const iWebsite = col('場館官方網站')

/**
 * 開放資料的電話很雜：有「02-25702330#6535」、有全形括號、有多支用頓號隔開。
 * 只做保守清理——去空白、統一分隔符號；看不出是電話的就丟掉，不要硬猜。
 */
function cleanPhone(raw: string | undefined): string | null {
  const t = (raw ?? '').trim().replace(/\s+/g, '')
  if (!t) return null
  if (!/\d{6,}/.test(t.replace(/\D/g, ''))) return null
  return t.slice(0, 40)
}

/** 官網只收 http(s)，其他（有人填「無」、填 email）一律丟掉。 */
function cleanUrl(raw: string | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!/^https?:\/\//i.test(t)) return null
  return t.slice(0, 200)
}

interface Row {
  name: string; district: string; address: string
  lat: number; lng: number; free: boolean
  openHour: number; closeHour: number
  bookingUrl: string | null
  phone: string | null
  website: string | null
  vbs: VbsTennis | null
}

/** 人工查證的結果，用正規化地址當鍵 */
const overrides = new Map(CLUB_OVERRIDES.map((o) => [normAddr(o.address), o]))
let overridden = 0

/** 體育局場館頁裡還沒被開放資料對到的，最後要整個補進來 */
const vbsUnused = new Set(VBS_TENNIS.map((v) => v.k))
let matched = 0

const seen = new Set<string>()
const clubs: Row[] = []
const skipped = { 非網球: 0, 練習壁: 0, 不開放租借: 0, 座標無效: 0, 不在範圍: 0, 重複: 0 }

for (const r of rows.slice(1)) {
  if (r.length < header.length) continue
  const name = (r[iName] ?? '').trim()
  const kind = (r[iKind] ?? '').trim()
  const facility = (r[iFacility] ?? '').trim()
  const address = (r[iAddr] ?? '').trim()
  const rental = (r[iRental] ?? '').trim()

  if (!/網球/.test(facility + kind)) { skipped.非網球++; continue }
  if (isPracticeWall(name, kind + facility)) { skipped.練習壁++; continue }
  if (!isRentable(rental)) { skipped.不開放租借++; continue }
  if (!CITIES.includes(cityOf(address))) { skipped.不在範圍++; continue }

  const lat = Number(r[iLat])
  const lng = Number(r[iLng])
  if (!(lat > 21 && lat < 26.5 && lng > 118 && lng < 122.5)) { skipped.座標無效++; continue }

  const key = `${lat.toFixed(5)}|${lng.toFixed(5)}|${name}`
  if (seen.has(key)) { skipped.重複++; continue }
  seen.add(key)

  const district = (r[iDistrict] ?? '').trim()
  // 用座標對應而不是地址——河濱球場的「地址」是「基隆河成美橋至成功橋間」
  // 這種描述，沒有門牌可以比。250 公尺內視為同一個地方。
  const hit = VBS_TENNIS
    .map((v) => ({ v, d: metres(lat, lng, v.lat, v.lng) }))
    .filter((x) => x.d < 250)
    .sort((a, b) => a.d - b.d)[0]?.v
  if (hit) { matched++; vbsUnused.delete(hit.k) }

  clubs.push({
    name,
    district: cityOf(address) + district,
    address,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    // 「免費對外場地租借」是真的資料，價格就是 0；「付費」只知道要錢，不知道多少
    free: rental.includes('免費'),
    // 對不上就退回 6–22 這個保守預設，並不是查證過的營業時間
    openHour: hit?.open_hour ?? 6,
    closeHour: hit?.close_hour ?? 22,
    bookingUrl: hit ? vbsUrl(hit.k) : null,
    phone: cleanPhone(r[iPhone]),
    website: cleanUrl(r[iWebsite]),
    vbs: hit ?? null,
  })
}

clubs.sort((a, b) => a.district.localeCompare(b.district, 'zh-TW') || a.name.localeCompare(b.name, 'zh-TW'))

const lit = (v: unknown): string =>
  v === null || v === undefined ? 'null'
    : typeof v === 'string' ? JSON.stringify(v)
      : String(v)

const body = clubs.map((c) => {
  // id 一律由「開放資料原本的名稱＋地址」推出來，人工改了顯示名稱也不會變。
  // id 變動等於使用者存的偏好球場全部失效，那個代價比名稱好看重要得多。
  const id = slugId(c.name, c.address)
  const ov = overrides.get(normAddr(c.address))
  if (ov) overridden++
  const p = ov?.patch ?? {}

  const field = <K extends keyof typeof p>(key: K, fallback: unknown) =>
    lit(key in p ? p[key] : fallback)

  return `  {
    id: '${id}', name: ${field('name', c.name)},
    district: ${JSON.stringify(c.district)},
    address: ${JSON.stringify(c.address)},
    lat: ${c.lat}, lng: ${c.lng},
    surface: ${field('surface', null)},
    // 名稱帶「室內」的才敢說是室內；沒寫的一律當戶外，寧可少說也不要說錯
    indoor: ${field('indoor', /室內/.test(c.name))},
    lights: ${field('lights', c.vbs ? c.vbs.lights : null)},
    price_per_hour: ${field('price_per_hour', c.vbs ? c.vbs.fee : (c.free ? 0 : null))},
    price_note: ${field('price_note', c.vbs ? VBS_NOTE : null)},
    rating: ${field('rating', null)},
    courts: ${field('courts', c.vbs?.courts ?? 1)},
    open_hour: ${field('open_hour', c.openHour)},
    close_hour: ${field('close_hour', c.closeHour)},
    photo: '${gradient(id)}',
    source: '${ov || c.vbs ? 'manual' : 'opendata'}',
    booking_url: ${field('booking_url', c.bookingUrl)},
    phone: ${field('phone', c.phone)},
    website: ${field('website', c.website)},
    verified_on: ${lit(ov?.verifiedOn ?? (c.vbs ? VBS_VERIFIED_ON : null))},
  },`
}).join('\n')

/**
 * 開放資料整個漏掉、但確實在體育局訂場系統裡的球場。
 * iPlay 漏掉了臺北市大部分的河濱網球場，漏掉的還不是小場——
 * 華中 7 面、彩虹 9 面。對「河濱打球」這件事來說，那等於漏掉半個城市。
 */
const extras = VBS_TENNIS.filter((v) => vbsUnused.has(v.k))
const extraBody = extras.map((v) => {
  const id = 'c-vbs-' + v.k
  return `  {
    id: '${id}', name: ${JSON.stringify(v.name)},
    district: ${JSON.stringify('臺北市' + v.district)},
    // 體育局場館頁沒有門牌地址，河濱球場本來也沒有；用場館名稱當地址欄的內容，
    // 畫面上至少講得出這是哪裡，導航靠的是座標
    address: ${JSON.stringify(v.name)},
    lat: ${v.lat}, lng: ${v.lng},
    surface: null, indoor: false, lights: ${v.lights},
    price_per_hour: ${lit(v.fee)},
    price_note: ${JSON.stringify(VBS_NOTE)},
    rating: null, courts: ${v.courts ?? 1},
    open_hour: ${v.open_hour}, close_hour: ${v.close_hour},
    photo: '${gradient(id)}',
    source: 'manual',
    booking_url: '${vbsUrl(v.k)}',
    // 這幾個場是從體育局場館頁補進來的，不在開放資料裡，所以沒有電話與官網。
    // 寧可留白，也不要填一支沒查證過的號碼。
    phone: null, website: null,
    verified_on: '${VBS_VERIFIED_ON}',
  },`
}).join('\n')

const out = `/** ===== clubData.ts =====
 * 由 tools/import_clubs.ts 從政府開放資料產生，不要手改——重跑一次就會被蓋掉。
 *
 * 來源：全國運動場館資訊（iPlay），運動部
 *       https://data.gov.tw/dataset/22849
 *       政府資料開放授權條款第 1 版
 *
 * 已經篩掉：非網球場、網球練習壁（對牆打，不能約球）、
 *           標示「不開放對外場地租借」的場（租不到，放進來只會害人白跑）。
 *
 * surface / lights / rating / price_per_hour（付費場）都是 null——
 * 開放資料沒有這些欄位。等人工確認過再把值填進來，並把 source 改成 'manual'。
 * courts 一律先當 1 面；真實面數要人工查，它只影響「這個時段還剩幾面」的計算。
 *
 * 開放時間：對得上臺北市體育局訂場系統的才是查證過的，其餘一律是 6–22 的保守預設。
 * booking_url：有值代表這個場在市府線上訂場系統裡。
 *
 * 範圍：${CITIES.join('、')}，開放資料 ${clubs.length} 個，
 * 另加 ${extras.length} 個開放資料漏掉、但在臺北市體育局訂場系統裡訂得到的。
 */
import type { Club } from './types.ts'

export const REAL_CLUBS: Club[] = [
${body}
${extraBody}
]
`

writeFileSync(new URL('../src/lib/clubData.ts', import.meta.url), out)

console.log(`已產生 src/lib/clubData.ts：${CITIES.join('、')} 共 ${clubs.length} 個可租借的網球場館`)
console.log('過濾掉：', Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join('、'))
console.log(`對上臺北市體育局場館頁：${matched} 個（面數／夜燈／收費／深連結都是官方的）`)
console.log(`套用人工查證：${overridden} / ${CLUB_OVERRIDES.length} 個`)
console.log(`開放資料漏掉、從體育局補進來的：${extras.length} 個`)
if (overridden < CLUB_OVERRIDES.length) {
  // 開放資料年更一次，地址改了 override 就會靜靜失效，不講的話沒人會發現
  const missed = CLUB_OVERRIDES.filter((o) => !clubs.some((c) => normAddr(c.address) === normAddr(o.address)))
  console.warn('⚠️  這些人工查證的地址在開放資料裡找不到，可能是地址寫法變了：')
  for (const m of missed) console.warn('   ' + m.address)
}
const byDistrict = new Map<string, number>()
for (const c of clubs) byDistrict.set(c.district, (byDistrict.get(c.district) ?? 0) + 1)
console.log('分布：', [...byDistrict].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join('、'))
