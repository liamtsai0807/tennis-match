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
  /**
   * 官方線上訂場系統的網址。null = 這個場沒有（或我們還不知道）線上訂場，
   * 畫面會退成「在地圖上開啟」讓使用者自己找電話。
   * 我們自己不代訂——沒有任何一家提供 API，硬做只會產生
   * 「App 說訂到了、現場卻不算數」這種比不做更糟的狀況。
   */
  booking_url: string | null
  /** 場館管理人電話。訂不到場、或這個場根本沒有線上訂場時，唯一還能做的事。 */
  phone: string | null
  /** 場館官方網站。不一定訂得了場，但至少查得到公告與休館。 */
  website: string | null
  /**
   * 收費的補充說明。真實球場的價格幾乎都是分級的——尖峰離峰、平日假日、
   * 室內室外、燈光費另計。price_per_hour 一個數字裝不下，硬塞會變成謊報。
   * 有值時 price_per_hour 代表「最低那一檔」，畫面上會標「起」。
   */
  price_note: string | null
  /** 人工查證的日期。資料會過期，不記日期就不知道哪一筆該重查。 */
  verified_on: string | null
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
  /**
   * 官方系統那邊訂好的時間。null = 還沒訂，或這個場根本不用訂。
   *
   * App 內的 booking 一直只是「我們自己記著這個時段」，不是真的訂到場——
   * 台灣沒有任何場館提供訂場 API，真正的訂場一定發生在別人的系統裡。
   */
  external_confirmed_at: string | null
  /** 官方系統給的訂單編號，選填。現場真的對不上時才用得到。 */
  external_ref: string | null
  /** 回報訂場的人。可能不是原本的 user_id——中途換人去訂很常見。 */
  external_by: string | null
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
  /**
   * 誰負責去官方系統訂場。預設發起人——場地和時間是他挑的。
   * 沒有這一欄就沒辦法提醒特定的人，只能兩個都吵，
   * 那反而更容易兩邊都以為對方會處理。
   */
  booker_id: string
}
