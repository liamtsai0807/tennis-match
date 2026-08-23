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
 */
import { readFileSync, writeFileSync } from 'node:fs'

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

interface Row { name: string; district: string; address: string; lat: number; lng: number; free: boolean }

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

  clubs.push({
    name,
    district: cityOf(address) + (r[iDistrict] ?? '').trim(),
    address,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    // 「免費對外場地租借」是真的資料，價格就是 0；「付費」只知道要錢，不知道多少
    free: rental.includes('免費'),
  })
}

clubs.sort((a, b) => a.district.localeCompare(b.district, 'zh-TW') || a.name.localeCompare(b.name, 'zh-TW'))

const body = clubs.map((c) => {
  const id = slugId(c.name, c.address)
  // 名稱帶「室內」的才敢說是室內；沒寫的一律當戶外，寧可少說也不要說錯
  const indoor = /室內/.test(c.name)
  return `  {
    id: '${id}', name: ${JSON.stringify(c.name)},
    district: ${JSON.stringify(c.district)},
    address: ${JSON.stringify(c.address)},
    lat: ${c.lat}, lng: ${c.lng},
    surface: null, indoor: ${indoor}, lights: null,
    price_per_hour: ${c.free ? 0 : 'null'}, rating: null, courts: 1,
    open_hour: 6, close_hour: 22,
    photo: '${gradient(id)}',
    source: 'opendata',
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
 * 範圍：${CITIES.join('、')}，共 ${clubs.length} 個場館。
 */
import type { Club } from './types.ts'

export const REAL_CLUBS: Club[] = [
${body}
]
`

writeFileSync(new URL('../src/lib/clubData.ts', import.meta.url), out)

console.log(`已產生 src/lib/clubData.ts：${CITIES.join('、')} 共 ${clubs.length} 個可租借的網球場館`)
console.log('過濾掉：', Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join('、'))
const byDistrict = new Map<string, number>()
for (const c of clubs) byDistrict.set(c.district, (byDistrict.get(c.district) ?? 0) + 1)
console.log('分布：', [...byDistrict].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join('、'))
