/** ===== mockData.ts =====
 * 離線示範資料。沒設定 Supabase 時整個 App 會跑在這上面，
 * 流程與線上完全一樣，只是資料存在 localStorage。
 */
import type { Club, Court, OpenMatch, Player } from './types.ts'

export const ME = 'p-me'

export const CLUBS: Club[] = [
  {
    id: 'c-daan', name: '大安網球中心', district: '台北市大安區',
    address: '台北市大安區敦化南路二段 99 號', surface: 'hard', indoor: false, lights: true,
    price_per_hour: 500, rating: 4.6, courts: 8, open_hour: 6, close_hour: 22,
    photo: 'linear-gradient(150deg,#1e6fd9,#0d3f8f 55%,#0a2d66)',
  },
  {
    id: 'c-tianmu', name: '天母網球場', district: '台北市士林區',
    address: '台北市士林區忠誠路二段 77 號', surface: 'clay', indoor: false, lights: true,
    price_per_hour: 420, rating: 4.4, courts: 6, open_hour: 6, close_hour: 21,
    photo: 'linear-gradient(150deg,#c96a3c,#a0472a 55%,#6f2f1c)',
  },
  {
    id: 'c-neihu', name: '內湖運動中心（室內）', district: '台北市內湖區',
    address: '台北市內湖區洲子街 12 號', surface: 'hard', indoor: true, lights: true,
    price_per_hour: 700, rating: 4.8, courts: 4, open_hour: 7, close_hour: 23,
    photo: 'linear-gradient(150deg,#3f5a8a,#22355c 55%,#141f38)',
  },
  {
    id: 'c-banqiao', name: '板橋第一網球場', district: '新北市板橋區',
    address: '新北市板橋區縣民大道二段 1 號', surface: 'hard', indoor: false, lights: false,
    price_per_hour: 350, rating: 4.1, courts: 10, open_hour: 6, close_hour: 18,
    photo: 'linear-gradient(150deg,#2f9e6a,#177a4c 55%,#0d4d30)',
  },
  {
    id: 'c-taoyuan', name: '桃園青埔網球園區', district: '桃園市中壢區',
    address: '桃園市中壢區高鐵南路二段 8 號', surface: 'grass', indoor: false, lights: true,
    price_per_hour: 600, rating: 4.7, courts: 5, open_hour: 6, close_hour: 22,
    photo: 'linear-gradient(150deg,#4a9d3f,#2c7028 55%,#17471a)',
  },
  {
    id: 'c-hsinchu', name: '新竹科園網球俱樂部', district: '新竹市東區',
    address: '新竹市東區科學園路 300 號', surface: 'hard', indoor: true, lights: true,
    price_per_hour: 650, rating: 4.5, courts: 6, open_hour: 7, close_hour: 23,
    photo: 'linear-gradient(150deg,#6a4bb5,#432d80 55%,#281a4d)',
  },
]

export const COURTS: Court[] = CLUBS.flatMap((club) =>
  Array.from({ length: club.courts }, (_, i) => ({
    id: club.id + '-court-' + (i + 1),
    club_id: club.id,
    name: '第 ' + (i + 1) + ' 球場',
  })),
)

export const PLAYERS: Player[] = [
  { id: ME, name: '陳彥廷', avatar_hue: 210, ntrp: 3, district: '台北市大安區', hand: 'right',
    bio: '週末球友，正手比反手穩。', wins: 12, losses: 9 },
  { id: 'p-kai', name: '王凱文', avatar_hue: 24, ntrp: 3.5, district: '台北市大安區', hand: 'right',
    bio: '底線纏鬥型，喜歡打長球。平日晚上比較有空。', wins: 34, losses: 21 },
  { id: 'p-yuting', name: '陳語婷', avatar_hue: 330, ntrp: 4, district: '台北市士林區', hand: 'left',
    bio: '左手發球有角度，雙打找我。', wins: 51, losses: 28 },
  { id: 'p-jason', name: 'Jason Liu', avatar_hue: 150, ntrp: 3, district: '新北市板橋區', hand: 'right',
    bio: '回台灣兩年，找固定球伴一起練。', wins: 18, losses: 22 },
  { id: 'p-meiling', name: '林美玲', avatar_hue: 275, ntrp: 2.5, district: '台北市內湖區', hand: 'right',
    bio: '打了半年，還在練發球，求輕虐。', wins: 6, losses: 15 },
  { id: 'p-hao', name: '張皓', avatar_hue: 195, ntrp: 4.5, district: '桃園市中壢區', hand: 'right',
    bio: '大學校隊出身，可以陪練也可以認真打。', wins: 88, losses: 31 },
  { id: 'p-sofia', name: 'Sofia Chen', avatar_hue: 45, ntrp: 3.5, district: '新竹市東區', hand: 'right',
    bio: '雙打為主，正拍抽球是強項。', wins: 40, losses: 33 },
  { id: 'p-ethan', name: '李昱辰', avatar_hue: 0, ntrp: 3, district: '台北市大安區', hand: 'right',
    bio: '國中生，禮拜六早上都有練球。', wins: 9, losses: 7 },
]

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export const OPEN_MATCHES: OpenMatch[] = [
  {
    id: 'm-1', host_id: 'p-kai', club_id: 'c-daan', date: isoDate(0), hour: 19,
    kind: 'doubles', ntrp_min: 3, ntrp_max: 4, slots: 4, joined: ['p-kai', 'p-yuting'],
    note: '今晚雙打缺兩位，程度差不多就好，不計較勝負。', status: 'open',
  },
  {
    id: 'm-2', host_id: 'p-hao', club_id: 'c-taoyuan', date: isoDate(1), hour: 7,
    kind: 'singles', ntrp_min: 4, ntrp_max: 5.5, slots: 2, joined: ['p-hao'],
    note: '早上七點單打，想認真打的來。草地場，記得帶對的鞋。', status: 'open',
  },
  {
    id: 'm-3', host_id: 'p-meiling', club_id: 'c-neihu', date: isoDate(1), hour: 20,
    kind: 'doubles', ntrp_min: 2, ntrp_max: 3, slots: 4, joined: ['p-meiling', 'p-jason', 'p-ethan'],
    note: '初學者友善場，室內不怕下雨。還缺一位！', status: 'open',
  },
  {
    id: 'm-4', host_id: 'p-sofia', club_id: 'c-hsinchu', date: isoDate(2), hour: 18,
    kind: 'doubles', ntrp_min: 3, ntrp_max: 4, slots: 4, joined: ['p-sofia'],
    note: '下班後打兩小時，打完可以一起吃飯。', status: 'open',
  },
  {
    id: 'm-5', host_id: 'p-yuting', club_id: 'c-tianmu', date: isoDate(3), hour: 9,
    kind: 'singles', ntrp_min: 3.5, ntrp_max: 4.5, slots: 2, joined: ['p-yuting'],
    note: '紅土場練球，想適應慢速場地的一起。', status: 'open',
  },
]

/** 這幾筆是「已經被訂走」的時段，讓預約畫面看起來不是空的。 */
export const SEED_BOOKINGS = [
  { club_id: 'c-daan', date: isoDate(0), hour: 19, court: 1 },
  { club_id: 'c-daan', date: isoDate(0), hour: 19, court: 2 },
  { club_id: 'c-daan', date: isoDate(0), hour: 20, court: 1 },
  { club_id: 'c-daan', date: isoDate(1), hour: 18, court: 3 },
  { club_id: 'c-neihu', date: isoDate(0), hour: 20, court: 1 },
  { club_id: 'c-neihu', date: isoDate(1), hour: 20, court: 2 },
  { club_id: 'c-tianmu', date: isoDate(0), hour: 9, court: 1 },
]
