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
 * 第二個來源：臺北市體育局場館設施管理系統自己的開放端點
 *   https://vbs.sports.taipei/opendata/sports_tms2.json
 * 它補兩件 iPlay 給不起的事：
 *   1. 真實的開放與關閉時間（iPlay 的「開放時間」欄位存的是星期，不是時刻）
 *   2. 出現在那份名單裡就代表這個場在市府的線上訂場系統裡，可以深連結過去
 * 對應只能靠地址——那份 JSON 沒有座標也沒有 id。對不上很正常：
 * 我們的球場有一半是大學和學校的場，本來就不歸市府訂場系統管。
 *
 * 最後套上 src/lib/clubOverrides.ts：人工查證的修正（override）與開放資料整個
 * 漏掉的球場（addition）。那是唯一手改的一份，放在這裡套是因為 clubData.ts
 * 每次重跑都會整份重寫，人工成果寫在那裡會被蓋掉。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { CLUB_ADDITIONS, CLUB_OVERRIDES } from '../src/lib/clubOverrides.ts'

const VBS_URL = 'https://vbs.sports.taipei/opendata/sports_tms2.json'

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

interface VbsVenue {
  Area: string
  Name: string
  SportType: string
  Address: string
  startTime: string
  endTime: string
}

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

/**
 * 抓出「路名＋段＋巷弄號」這個核心，前面的縣市行政區去掉。
 * 完整地址逐字比對只對得上三筆，因為兩邊在門牌後面接的補充說明不一樣；
 * 拿核心去比對得上十筆，而且十筆都是精確地址，沒有偽陽性。
 */
function addrCore(a: string): string {
  const m = /([^市區縣]{2,10}(?:路|街|大道)[0-9]*段?[0-9]*巷?[0-9-]*弄?[0-9-]*號?)/.exec(normAddr(a))
  return m ? m[1] : ''
}

function hourOf(t: string): number | null {
  const m = /^(\d{1,2}):/.exec(t ?? '')
  return m ? Number(m[1]) : null
}

async function loadVbs(): Promise<VbsVenue[]> {
  try {
    const res = await fetch(VBS_URL)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const all = (await res.json()) as VbsVenue[]
    return all.filter((x) => (x.SportType ?? '').includes('網球'))
  } catch (e) {
    // 對不到就是少了開放時間與訂場連結，球場本身還是進得去，不要讓整個匯入失敗
    console.warn('⚠️  讀不到體育局訂場系統的資料，開放時間與訂場連結會留空：' + (e as Error).message)
    return []
  }
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

/** 由 id 推出一個穩定的漸層底圖，不依賴外部圖床也不用每筆手挑顏色。 */
function gradient(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
  const s = 52 + (h % 3) * 6
  return `linear-gradient(150deg,hsl(${h} ${s}% 42%),hsl(${(h + 12) % 360} ${s}% 28%) 55%,hsl(${(h + 24) % 360} ${s}% 18%))`
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

interface Row {
  name: string; district: string; address: string
  lat: number; lng: number; free: boolean
  openHour: number; closeHour: number
  bookingUrl: string | null
}

/** 人工查證的結果，用正規化地址當鍵 */
const overrides = new Map(CLUB_OVERRIDES.map((o) => [normAddr(o.address), o]))
let overridden = 0

const vbs = await loadVbs()
/** 深連結只能到場地清單頁——網球的篩選是純前端 JS，沒有可靠的網址參數。 */
const VBS_PAGE = 'https://vbs.sports.taipei/venues/'
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
  const core = addrCore(address)
  const hit = core
    ? vbs.find((v) => district.includes(v.Area) && normAddr(v.Address).includes(core))
    : undefined
  if (hit) matched++

  clubs.push({
    name,
    district: cityOf(address) + district,
    address,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    // 「免費對外場地租借」是真的資料，價格就是 0；「付費」只知道要錢，不知道多少
    free: rental.includes('免費'),
    // 對不上就退回 6–22 這個保守預設，並不是查證過的營業時間
    openHour: (hit && hourOf(hit.startTime)) ?? 6,
    closeHour: (hit && hourOf(hit.endTime)) ?? 22,
    bookingUrl: hit ? VBS_PAGE : null,
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
    lights: ${field('lights', null)},
    price_per_hour: ${field('price_per_hour', c.free ? 0 : null)},
    price_note: ${field('price_note', null)},
    rating: ${field('rating', null)},
    courts: ${field('courts', 1)},
    open_hour: ${field('open_hour', c.openHour)},
    close_hour: ${field('close_hour', c.closeHour)},
    photo: '${gradient(id)}',
    source: '${ov ? 'manual' : 'opendata'}',
    booking_url: ${field('booking_url', c.bookingUrl)},
    verified_on: ${lit(ov?.verifiedOn ?? null)},
  },`
}).join('\n')

/** 開放資料漏掉、人工補進來的球場。這些沒有原始名稱可以雜湊，id 在 override 檔裡自己給。 */
const extraBody = CLUB_ADDITIONS.map(({ club: c }) => `  {
    id: '${c.id}', name: ${JSON.stringify(c.name)},
    district: ${JSON.stringify(c.district)},
    address: ${JSON.stringify(c.address)},
    lat: ${c.lat}, lng: ${c.lng},
    surface: ${lit(c.surface)},
    indoor: ${c.indoor},
    lights: ${lit(c.lights)},
    price_per_hour: ${lit(c.price_per_hour)},
    price_note: ${lit(c.price_note)},
    rating: ${lit(c.rating)},
    courts: ${c.courts},
    open_hour: ${c.open_hour}, close_hour: ${c.close_hour},
    photo: '${gradient(c.id)}',
    source: '${c.source}',
    booking_url: ${lit(c.booking_url)},
    verified_on: ${lit(c.verified_on)},
  },`).join('\n')

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
 * 另加 ${CLUB_ADDITIONS.length} 個開放資料漏掉但確實訂得到的（見 clubOverrides.ts）。
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
console.log(`對上臺北市體育局訂場系統：${matched} 個（有真實開放時間與訂場連結）`)
console.log(`套用人工查證：${overridden} / ${CLUB_OVERRIDES.length} 個`)
console.log(`人工補進開放資料漏掉的：${CLUB_ADDITIONS.length} 個`)
if (overridden < CLUB_OVERRIDES.length) {
  // 開放資料年更一次，地址改了 override 就會靜靜失效，不講的話沒人會發現
  const missed = CLUB_OVERRIDES.filter((o) => !clubs.some((c) => normAddr(c.address) === normAddr(o.address)))
  console.warn('⚠️  這些人工查證的地址在開放資料裡找不到，可能是地址寫法變了：')
  for (const m of missed) console.warn('   ' + m.address)
}
const byDistrict = new Map<string, number>()
for (const c of clubs) byDistrict.set(c.district, (byDistrict.get(c.district) ?? 0) + 1)
console.log('分布：', [...byDistrict].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join('、'))
