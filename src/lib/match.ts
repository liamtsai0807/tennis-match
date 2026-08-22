/** ===== match.ts =====
 * 媒合的計算全部集中在這裡：純函式，不碰資料庫也不碰畫面，方便單獨測。
 *
 * 兩個排序：
 *   rankPartners — 誰適合跟我打
 *   rankClubs    — 約在哪打
 *
 * 設計上的重點是「雙向」。單看自己的偏好排出來的名單，對方不見得想接受邀約，
 * 那種媒合的成功率很低。所以程度與球場都同時看兩邊的設定。
 */
import { distanceKm } from './geo.ts'
import type { Club, Ntrp, Player, TimeBlock } from './types.ts'

export const BLOCKS: Record<TimeBlock, { label: string; from: number; to: number }> = {
  morning: { label: '早上', from: 6, to: 12 },
  afternoon: { label: '下午', from: 12, to: 17 },
  evening: { label: '晚上', from: 17, to: 22 },
}

export const BLOCK_ORDER: TimeBlock[] = ['morning', 'afternoon', 'evening']

export const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

export function blockOf(hour: number): TimeBlock {
  if (hour < BLOCKS.morning.to) return 'morning'
  if (hour < BLOCKS.afternoon.to) return 'afternoon'
  return 'evening'
}

export function hoursIn(block: TimeBlock): number[] {
  const { from, to } = BLOCKS[block]
  return Array.from({ length: to - from }, (_, i) => from + i)
}

/** 那一天的那個時段，這個人平常有沒有空。 */
export function isFreeOn(player: Player, date: string, block: TimeBlock): boolean {
  const weekday = new Date(date + 'T00:00:00').getDay()
  return (
    player.availability.weekdays.includes(weekday) &&
    player.availability.blocks.includes(block)
  )
}

function inRange(n: Ntrp, min: Ntrp, max: Ntrp): boolean {
  return n >= min && n <= max
}

function overlap<T>(a: T[], b: T[]): T[] {
  return a.filter((x) => b.includes(x))
}

// ---------- 找球伴 ----------

export interface PartnerCriteria {
  date: string
  block: TimeBlock
  /** 放寬條件：不再要求對方落在你設定的程度區間內，只排序不過濾。 */
  loosen: boolean
}

export interface PartnerFit {
  player: Player
  /** 對方程度跟我差幾級 */
  levelGap: number
  /** 對方落在我設定的程度區間內 */
  levelOk: boolean
  /** 我也落在對方設定的區間內——雙向合適，成功率高很多 */
  mutual: boolean
  /** 雙方都有設為偏好的球場 */
  sharedClubIds: string[]
  free: boolean
  distanceKm: number
  score: number          // 0–100
  /** 給使用者看的理由。媒合結果不解釋的話，使用者不會信它。 */
  reasons: string[]
}

/**
 * 權重。程度最重要——程度差太多兩邊都打得不開心，這是網球跟很多運動最大的不同。
 * 共同球場與時段其次，因為那決定「約不約得成」。距離只當微調，
 * 已經有共同偏好球場的話，住哪其實沒那麼要緊。
 */
const W_LEVEL = 0.3
const W_CLUB = 0.25
const W_TIME = 0.25
const W_MUTUAL = 0.1
const W_DIST = 0.1

/** 距離超過這個公里數，距離分數就歸零。 */
const FAR_KM = 25

export function rankPartners(
  me: Player,
  others: Player[],
  criteria: PartnerCriteria,
): PartnerFit[] {
  const { date, block, loosen } = criteria
  const span = Math.max(0.5, me.pref_ntrp_max - me.pref_ntrp_min)

  return others
    .filter((p) => p.id !== me.id)
    .map((p): PartnerFit => {
      const levelGap = Math.abs(p.ntrp - me.ntrp)
      const levelOk = inRange(p.ntrp, me.pref_ntrp_min, me.pref_ntrp_max)
      const mutual = inRange(me.ntrp, p.pref_ntrp_min, p.pref_ntrp_max)
      const sharedClubIds = overlap(me.pref_club_ids, p.pref_club_ids)
      const free = isFreeOn(p, date, block)
      const dist = distanceKm(me, p)

      // 程度分數用「我設定的區間寬度」當基準，區間開得寬的人本來就比較不挑
      const levelScore = Math.max(0, 1 - levelGap / span)
      const clubScore = sharedClubIds.length > 0 ? Math.min(1, sharedClubIds.length / 2) : 0
      const distScore = 1 - Math.min(dist / FAR_KM, 1)

      const score = Math.round(
        100 *
          (W_LEVEL * levelScore +
            W_CLUB * clubScore +
            W_TIME * (free ? 1 : 0) +
            W_MUTUAL * (mutual ? 1 : 0) +
            W_DIST * distScore),
      )

      const reasons: string[] = []
      if (levelGap === 0) reasons.push('程度跟你一樣（NTRP ' + p.ntrp + '）')
      else if (levelGap <= 0.5) reasons.push('只差半級，打起來會很接近')
      else reasons.push('程度差 ' + levelGap + ' 級')

      if (sharedClubIds.length > 0) reasons.push('有 ' + sharedClubIds.length + ' 個共同常去的球場')
      reasons.push(free ? BLOCKS[block].label + '通常有空' : BLOCKS[block].label + '通常沒空')
      if (mutual) reasons.push('你也在對方想找的程度範圍內')

      return {
        player: p, levelGap, levelOk, mutual, sharedClubIds, free,
        distanceKm: dist, score, reasons,
      }
    })
    .filter((f) => loosen || f.levelOk)
    // 那天沒空的排後面——再合適，約不到也沒用
    .sort((a, b) => Number(b.free) - Number(a.free) || b.score - a.score)
}

// ---------- 找球場 ----------

export interface ClubFit {
  club: Club
  fromMe: number
  fromPartner: number
  /** 兩人之中較遠的那一個。用它排序，等於在壓低「比較倒楣的那個人」的通勤。 */
  worst: number
  /** 兩人距離差，越小代表越公平。 */
  gap: number
  prefMe: boolean
  prefPartner: boolean
  score: number
  tag: string
}

/** 距離減半的基準：剛好這麼遠時分數是 0.5。 */
const CLUB_HALF_KM = 15
const FAIR_HALF_KM = 10

/**
 * 距離換算成分數。用雙曲線衰減而不是「超過 N 公里就歸零」，
 * 因為歸零會讓遠距離全部同分——對方在新竹時，30 公里和 60 公里的球場
 * 得分一樣，排序就只剩下偏好在作用，會推薦出很荒謬的結果。
 */
function decay(value: number, half: number): number {
  return 1 / (1 + value / half)
}

/**
 * 偏好加分。兩人都常去給滿分，只有一個人常去只給四分之一——
 * 單方偏好是「順便」，不該壓過「對方要多跑二十公里」這種硬成本。
 */
function prefWeight(prefMe: boolean, prefPartner: boolean): number {
  if (prefMe && prefPartner) return 1
  if (prefMe || prefPartner) return 0.25
  return 0
}

/**
 * 球場排序刻意不是「離我最近」。
 * 先看兩個人有沒有都把它設為常去的球場——那是最省事的答案，
 * 再來才看距離，而且看的是「兩人之中較遠的那個」。
 * 只顧自己的話永遠約在自家門口，對方跑到厭世就不會想再約第二次。
 */
export function rankClubs(clubs: Club[], me: Player, partner: Player): ClubFit[] {
  return clubs
    .map((club): ClubFit => {
      const fromMe = distanceKm(me, club)
      const fromPartner = distanceKm(partner, club)
      const worst = Math.max(fromMe, fromPartner)
      const gap = Math.abs(fromMe - fromPartner)
      const prefMe = me.pref_club_ids.includes(club.id)
      const prefPartner = partner.pref_club_ids.includes(club.id)

      const worstScore = decay(worst, CLUB_HALF_KM)
      const fairScore = decay(gap, FAIR_HALF_KM)
      const prefScore = prefWeight(prefMe, prefPartner)

      const score = Math.round(
        100 * (0.4 * prefScore + 0.4 * worstScore + 0.2 * fairScore),
      )

      let tag = ''
      if (prefMe && prefPartner) tag = '兩人都常來'
      else if (prefPartner) tag = '對方常來'
      else if (prefMe) tag = '你常來'
      else if (gap < 1.5) tag = '兩邊差不多遠'
      else tag = fromMe < fromPartner ? '你比較近' : '對方比較近'

      return { club, fromMe, fromPartner, worst, gap, prefMe, prefPartner, score, tag }
    })
    .sort((a, b) => b.score - a.score || a.worst - b.worst)
}
