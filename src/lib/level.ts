/** ===== level.ts =====
 * 用三個好回答的問題推算 NTRP，取代「請自評你的 NTRP」。
 *
 * 為什麼不直接問 NTRP：沒打過分級賽的人不知道 3.0 和 3.5 差在哪，
 * 自評的結果有人虛報有人謙虛，而整個媒合都建立在這個數字上。
 *
 * 三題的分工：
 *   rally      問「行為」不問「自我評價」，是最可靠的訊號，拿來定基準
 *   experience 打多久
 *   frequency  多常打
 * 後兩題單獨看都不準——每週三次打半年，打得贏每月一次打五年的——
 * 但兩者相加約等於「累積的有效練習量」，拿來對基準做微調剛好。
 */
import type { Ntrp } from './types.ts'

export type Experience = 'lt6m' | '6m2y' | '2y5y' | 'gt5y'
export type Frequency = 'monthly' | 'weekly1' | 'weekly2'
export type Rally = 'short' | 'medium' | 'long' | 'attack'

export interface LevelAnswers {
  experience: Experience
  frequency: Frequency
  rally: Rally
}

// 標籤刻意用數字不用國字：四顆並排時「半年到兩年」會換行，整排高度就參差不齊
export const EXPERIENCE_OPTIONS: Array<{ id: Experience; label: string }> = [
  { id: 'lt6m', label: '半年內' },
  { id: '6m2y', label: '半年–2年' },
  { id: '2y5y', label: '2–5年' },
  { id: 'gt5y', label: '5年以上' },
]

export const FREQUENCY_OPTIONS: Array<{ id: Frequency; label: string }> = [
  { id: 'monthly', label: '一個月幾次' },
  { id: 'weekly1', label: '每週一次' },
  { id: 'weekly2', label: '每週兩次以上' },
]

export const RALLY_OPTIONS: Array<{ id: Rally; label: string; hint: string }> = [
  { id: 'short', label: '三球以內就會失誤', hint: '還在抓球感' },
  { id: 'medium', label: '大概五到十球', hint: '中速球回得穩' },
  { id: 'long', label: '十球以上，還能控制落點', hint: '打得到想打的位置' },
  { id: 'attack', label: '能主動變速、變旋轉去進攻', hint: '會用戰術得分' },
]

/**
 * 對打回合數定基準——它直接對應 NTRP 真正在量的「穩定度」。
 * 各級之間刻意隔開一整級（而不是半級），因為下面的練習量微調是半級：
 * 隔半級的話，球齡就能整個抵銷掉回合數，那等於讓proxy蓋過實際觀察到的行為。
 */
const RALLY_BASE: Record<Rally, number> = {
  short: 2,
  medium: 3,
  long: 4,
  attack: 5,
}

/**
 * 練習量 = 頻率 × 2 + 年資。頻率的權重是年資的兩倍——
 * 每週兩次打半年，打得贏每月一次打五年的。
 */
const EXPERIENCE_POINTS: Record<Experience, number> = {
  lt6m: 0, '6m2y': 1, '2y5y': 2, gt5y: 3,
}

const FREQUENCY_POINTS: Record<Frequency, number> = {
  monthly: 0, weekly1: 1, weekly2: 2,
}

const FREQUENCY_WEIGHT = 2

export const NTRP_STEPS: Ntrp[] = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5]

/**
 * 推算結果夾在 2.0–4.5。
 * 上限壓在 4.5 是刻意的：4.5 以上的差別（發球威脅、戰術層次）自評問不出來，
 * 硬推上去只會讓強手被配到打不動的對手。真的更強的人走手動選擇。
 */
const MIN_ESTIMATE = 2
const MAX_ESTIMATE = 4.5

export function estimateNtrp(a: LevelAnswers): Ntrp {
  const base = RALLY_BASE[a.rally]
  const volume =
    FREQUENCY_POINTS[a.frequency] * FREQUENCY_WEIGHT + EXPERIENCE_POINTS[a.experience]

  // volume 落在 0–7。兩頭各半級，中間不動——這三題撐不起更細的刻度，
  // 硬給更細的調整只是假精確。
  const adjust = volume <= 2 ? -0.5 : volume >= 5 ? 0.5 : 0

  const raw = base + adjust
  const clamped = Math.min(MAX_ESTIMATE, Math.max(MIN_ESTIMATE, raw))
  return snapToStep(clamped)
}

/** 對齊到 NTRP 的 0.5 刻度，不要跑出 3.2 這種不存在的級數。 */
export function snapToStep(value: number): Ntrp {
  return NTRP_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  ) as Ntrp
}

/** 畫面上主要顯示這個，NTRP 數字降級成附註。 */
export function levelName(n: Ntrp): string {
  if (n <= 2) return '剛開始'
  if (n <= 2.5) return '初學'
  if (n <= 3) return '可以穩定來回'
  if (n <= 3.5) return '能控制球路'
  if (n <= 4) return '能變化節奏'
  if (n <= 4.5) return '有比賽經驗'
  return '競賽等級'
}

export function levelHint(n: Ntrp): string {
  if (n <= 2) return '還在抓球感，能把球打過網'
  if (n <= 2.5) return '慢速球可以來回幾拍'
  if (n <= 3) return '中速球回得穩，但還不太控制得了方向'
  if (n <= 3.5) return '正反拍都打得到想打的位置，會用一點旋轉'
  if (n <= 4) return '控制落點與深度，發球開始有戰術'
  if (n <= 4.5) return '會變速變旋轉，第一發球有威脅'
  return '地區賽事以上的水準'
}

/** 「能控制球路（NTRP 3.5）」 */
export function levelLabel(n: Ntrp): string {
  return levelName(n) + '（NTRP ' + n + '）'
}
