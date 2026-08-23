/** ===== types.ts ===== */

import type { LevelAnswers } from './level.ts'

export type Surface = 'hard' | 'clay' | 'grass'

/** NTRP 是國際通用的網球分級，1.0 新手 ~ 7.0 職業。台灣球友多半自報 2.5–4.5。 */
export type Ntrp = 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5

/** 時段只分三段就夠了。要球友填「週三 19:00-21:00」這種精確格式，沒人會填。 */
export type TimeBlock = 'morning' | 'afternoon' | 'evening'

export interface LatLng {
  lat: number
  lng: number
}

/**
 * 常態有空的時間：星期幾 × 時段的交集。
 * 例如 weekdays [1,2,3,4,5] + blocks ['evening'] = 平日晚上。
 * 這個模型不精確，但填得完；精確到每一天的行事曆沒有人會維護。
 */
export interface Availability {
  weekdays: number[]        // 0 = 週日
  blocks: TimeBlock[]
}

/** 這筆球場資料哪裡來的。opendata 的細節沒有經過人工確認。 */
export type ClubSource = 'opendata' | 'manual'

export interface Club extends LatLng {
  id: string
  name: string
  district: string
  address: string
  /**
   * 以下幾欄政府開放資料沒有，null 代表「還不知道」。
   * 刻意不用 0 或預設值代替——編一個出來，使用者會當真，
   * 然後帶著錯的資訊跑到球場。
   */
  surface: Surface | null
  indoor: boolean
  lights: boolean | null    // 沒夜燈就排不了晚上的球
  price_per_hour: number | null   // TWD。0 是「免費」，是真的資料；null 才是不知道
  rating: number | null
  photo: string             // 用 CSS 漸層當底圖，不依賴外部圖床
  courts: number
  open_hour: number
  close_hour: number
  source: ClubSource
}

export interface Court {
  id: string
  club_id: string
  name: string
}

/**
 * 球友資料就是「偏好設定」本身——登錄時填的那幾題直接存在這裡，
 * 不另外開一張 preferences 表。因為媒合時要同時看雙方的偏好，
 * 拆成兩張表只會讓每次媒合都多一次 join。
 */
export interface Player extends LatLng {
  id: string
  name: string
  avatar_hue: number        // 用色相產生頭像底色，省掉上傳照片
  ntrp: Ntrp                // 自己的程度
  district: string          // 慣常出沒的區域，lat/lng 是這一區的中心
  hand: 'right' | 'left'
  bio: string
  wins: number
  losses: number
  /**
   * 程度是怎麼來的：
   *   null          還沒設定
   *   'manual'      使用者知道自己的 NTRP，直接選的
   *   LevelAnswers  三題的作答，ntrp 由 estimateNtrp() 推算
   */
  level_answers: LevelAnswers | 'manual' | null
  /** 偏好時段：星期幾 × 早/午/晚 */
  availability: Availability
  /** 偏好球場。兩個人的偏好有交集時，媒合分數會明顯往上拉 */
  pref_club_ids: string[]
  /** 想找的球伴程度區間 */
  pref_ntrp_min: Ntrp
  pref_ntrp_max: Ntrp
}

/** 登錄流程填完沒。存在本機，因為還沒有帳號系統可以掛。 */
export interface AppState {
  onboarded: boolean
}

export interface Booking {
  id: string
  club_id: string
  court_id: string
  user_id: string
  date: string              // YYYY-MM-DD
  hour: number              // 起始整點，一次一小時
  created_at: string
  status: 'confirmed' | 'cancelled'
}

/**
 * 邀約。送出時就把場地訂下來（booking_id），因為好時段不先訂就被搶走；
 * 對方拒絕的話 declineInvite() 會把那筆預約一起退掉，場地不會被白白佔著。
 */
export interface Invite {
  id: string
  from_id: string
  to_id: string
  club_id: string
  booking_id: string
  date: string
  hour: number
  message: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  created_at: string
}
