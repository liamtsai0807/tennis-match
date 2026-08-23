/** ===== format.ts ===== */
import { levelLabel } from './level.ts'
import type { Ntrp, Surface, ClubSource } from './types.ts'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 一律用「本地」的年月日組字串，不要用 toISOString()——那是 UTC。
 * 台灣是 UTC+8，本地午夜換算成 UTC 會掉到前一天，日期條就會從昨天開始排。
 */
function toISO(d: Date): string {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/** 「今天 (五)」「8/25 (一)」——列表上要一眼看得出是不是今天。 */
export function friendlyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const today = todayISO()
  const w = WEEKDAYS[d.getDay()]
  if (iso === today) return '今天 (' + w + ')'
  if (iso === addDaysISO(today, 1)) return '明天 (' + w + ')'
  return d.getMonth() + 1 + '/' + d.getDate() + ' (' + w + ')'
}

export function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.getMonth() + 1 + '/' + d.getDate()
}

export function weekday(iso: string): string {
  return WEEKDAYS[new Date(iso + 'T00:00:00').getDay()]
}

export function hourLabel(h: number): string {
  return String(h).padStart(2, '0') + ':00'
}

export function hourRange(h: number): string {
  return hourLabel(h) + '–' + hourLabel(h + 1)
}

export const SURFACE_LABEL: Record<Surface, string> = {
  hard: '硬地', clay: '紅土', grass: '草地',
}

/** 白話在前、NTRP 在括號裡。數字對不知道 NTRP 的人沒有意義。 */
export function ntrpLabel(n: Ntrp): string {
  return levelLabel(n)
}

/**
 * 沒有線上訂場系統的球場，至少把人送到地圖——那裡有電話、營業時間和導航，
 * 比什麼都不給好。用搜尋而不是座標，因為地圖上的店家頁面資訊比一個圖釘多。
 */
export function mapsUrl(name: string, address: string): string {
  return 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(name + ' ' + address)
}

/**
 * 時段還剩幾面。來自開放資料的球場沒有面數，我們只知道「有沒有被訂走」——
 * 說「剩 1 面」會讓人以為我們查證過總共幾面，其實沒有。
 */
export function slotLabel(free: number, source: ClubSource): string {
  if (free === 0) return '額滿'
  return source === 'opendata' ? '可預約' : '剩 ' + free + ' 面'
}

/** null = 還不知道價格。不要顯示成 NT$0，那會被當成免費。 */
export function money(n: number | null): string {
  if (n === null) return '價格未提供'
  if (n === 0) return '免費'
  return 'NT$' + n.toLocaleString('zh-TW')
}

/**
 * 頭像縮寫。中文取名字的最後一個字，不取兩個字——小尺寸頭像（30px）塞兩個字會擠爆。
 * 英文名取兩個字首。
 */
export function initials(name: string): string {
  const trimmed = name.trim()
  if (/[\u4e00-\u9fff]/.test(trimmed)) return trimmed.slice(-1)
  return trimmed.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}
