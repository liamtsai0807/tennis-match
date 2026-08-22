/** ===== types.ts ===== */

export type Surface = 'hard' | 'clay' | 'grass' | 'carpet'
export type MatchKind = 'singles' | 'doubles'

/** NTRP 是國際通用的網球分級，1.0 新手 ~ 7.0 職業。台灣球友多半自報 2.5–4.5。 */
export type Ntrp = 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5

export interface Club {
  id: string
  name: string
  district: string          // 例：台北市大安區
  address: string
  surface: Surface
  indoor: boolean
  lights: boolean           // 有夜間照明才排得了晚上的球
  price_per_hour: number    // TWD
  rating: number
  photo: string             // 漸層底圖的 CSS，避免依賴外部圖床
  courts: number
  open_hour: number         // 24 小時制
  close_hour: number
}

export interface Court {
  id: string
  club_id: string
  name: string
}

/** 一筆場地預約。start 用 ISO 字串存，時區一律台北。 */
export interface Booking {
  id: string
  club_id: string
  court_id: string
  user_id: string
  date: string              // YYYY-MM-DD
  hour: number              // 起始整點；目前只開放整點一小時為單位
  players: number
  created_at: string
  status: 'confirmed' | 'cancelled'
}

export interface Player {
  id: string
  name: string
  avatar_hue: number        // 用色相產生頭像底色，省掉圖片
  ntrp: Ntrp
  district: string
  hand: 'right' | 'left'
  bio: string
  wins: number
  losses: number
}

/** 開放球局：缺人的球局，別人可以按「加入」。 */
export interface OpenMatch {
  id: string
  host_id: string
  club_id: string
  date: string
  hour: number
  kind: MatchKind
  ntrp_min: Ntrp
  ntrp_max: Ntrp
  slots: number             // 總共需要幾人（含主揪）
  joined: string[]          // player id，含主揪
  note: string
  status: 'open' | 'full' | 'cancelled'
}

/** 賽制設定。改這裡就能支援 6 局 / 快速賽 / 搶十。 */
export interface MatchFormat {
  bestOfSets: 1 | 3 | 5
  gamesPerSet: number
  tiebreakAtGames: number   // 幾比幾進搶七，通常 6
  tiebreakTo: number        // 搶七拿幾分，通常 7
  noAd: boolean             // 平分決勝（40:40 下一分定勝負）
  finalSetSuperTiebreak: boolean // 決勝盤改打搶十
}

export interface LiveMatch {
  id: string
  title: string
  club_id: string
  kind: MatchKind
  side_a: string[]          // player ids
  side_b: string[]
  format: MatchFormat
  state: ScoreState
  scorer_id: string         // 誰在計分
  started_at: string
  finished_at: string | null
  spectators: number
}

/** 計分狀態。所有欄位都是可序列化的純資料，方便直接塞進 Supabase 的 jsonb 欄位。 */
export interface ScoreState {
  /** 每一盤的局數，index 0 是第一盤。最後一項是進行中的盤。 */
  sets: Array<[number, number]>
  /** 目前這一局已得的「分數次數」，不是 15/30/40，換算交給 displayPoints()。 */
  points: [number, number]
  server: 0 | 1
  /** 開賽時是誰先發。悔棋要從第一分重播，沒有這個就算不回正確的發球方。 */
  firstServer: 0 | 1
  inTiebreak: boolean
  winner: 0 | 1 | null
  /** 每一分的紀錄，用來做悔棋與賽後統計。 */
  log: PointLog[]
}

export interface PointLog {
  by: 0 | 1
  at: number                // Date.now()
  /** 記在哪一盤哪一局，方便之後畫走勢圖 */
  setIndex: number
  gameScore: [number, number]
}
