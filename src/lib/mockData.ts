/** ===== mockData.ts =====
 * 離線示範資料。沒設定 Supabase 時整個 App 跑在這上面，流程與線上完全一樣。
 * 座標是各行政區的大致中心，不是真實地址——媒合要算距離，沒有座標就算不出來。
 */
import type { Club, Court, Player } from './types.ts'

export const ME = 'p-me'

export const CLUBS: Club[] = [
  {
    id: 'c-daan', name: '大安網球中心', district: '台北市大安區',
    address: '台北市大安區敦化南路二段 99 號', lat: 25.0270, lng: 121.5490,
    surface: 'hard', indoor: false, lights: true,
    price_per_hour: 500, rating: 4.6, courts: 8, open_hour: 6, close_hour: 22,
    photo: 'linear-gradient(150deg,#1e6fd9,#0d3f8f 55%,#0a2d66)',
  },
  {
    id: 'c-xinyi', name: '信義運動中心網球場', district: '台北市信義區',
    address: '台北市信義區松勤街 100 號', lat: 25.0330, lng: 121.5670,
    surface: 'hard', indoor: true, lights: true,
    price_per_hour: 650, rating: 4.5, courts: 4, open_hour: 7, close_hour: 22,
    photo: 'linear-gradient(150deg,#3f5a8a,#22355c 55%,#141f38)',
  },
  {
    id: 'c-zhongshan', name: '中山網球場', district: '台北市中山區',
    address: '台北市中山區玉門街 1 號', lat: 25.0700, lng: 121.5200,
    surface: 'hard', indoor: false, lights: true,
    price_per_hour: 400, rating: 4.2, courts: 6, open_hour: 6, close_hour: 21,
    photo: 'linear-gradient(150deg,#2f9e6a,#177a4c 55%,#0d4d30)',
  },
  {
    id: 'c-neihu', name: '內湖運動中心（室內）', district: '台北市內湖區',
    address: '台北市內湖區洲子街 12 號', lat: 25.0790, lng: 121.5750,
    surface: 'hard', indoor: true, lights: true,
    price_per_hour: 700, rating: 4.8, courts: 4, open_hour: 7, close_hour: 23,
    photo: 'linear-gradient(150deg,#4a5f9e,#25356b 55%,#141f42)',
  },
  {
    id: 'c-tianmu', name: '天母網球場', district: '台北市士林區',
    address: '台北市士林區忠誠路二段 77 號', lat: 25.1180, lng: 121.5300,
    surface: 'clay', indoor: false, lights: true,
    price_per_hour: 420, rating: 4.4, courts: 6, open_hour: 6, close_hour: 21,
    photo: 'linear-gradient(150deg,#c96a3c,#a0472a 55%,#6f2f1c)',
  },
  {
    id: 'c-banqiao', name: '板橋第一網球場', district: '新北市板橋區',
    address: '新北市板橋區縣民大道二段 1 號', lat: 25.0140, lng: 121.4630,
    surface: 'hard', indoor: false, lights: false,
    price_per_hour: 350, rating: 4.1, courts: 10, open_hour: 6, close_hour: 18,
    photo: 'linear-gradient(150deg,#2f8f9e,#176a7a 55%,#0d4250)',
  },
  {
    id: 'c-sanchong', name: '三重綜合運動場網球場', district: '新北市三重區',
    address: '新北市三重區集美街 60 號', lat: 25.0670, lng: 121.4880,
    surface: 'hard', indoor: false, lights: true,
    price_per_hour: 380, rating: 4.0, courts: 6, open_hour: 6, close_hour: 21,
    photo: 'linear-gradient(150deg,#8a6a3f,#5c4522 55%,#382a14)',
  },
  {
    id: 'c-xindian', name: '新店央北網球場', district: '新北市新店區',
    address: '新北市新店區安興路 30 號', lat: 24.9800, lng: 121.5390,
    surface: 'hard', indoor: false, lights: true,
    price_per_hour: 450, rating: 4.3, courts: 5, open_hour: 6, close_hour: 22,
    photo: 'linear-gradient(150deg,#6a4bb5,#432d80 55%,#281a4d)',
  },
  {
    id: 'c-taoyuan', name: '桃園青埔網球園區', district: '桃園市中壢區',
    address: '桃園市中壢區高鐵南路二段 8 號', lat: 25.0000, lng: 121.2200,
    surface: 'grass', indoor: false, lights: true,
    price_per_hour: 600, rating: 4.7, courts: 5, open_hour: 6, close_hour: 22,
    photo: 'linear-gradient(150deg,#4a9d3f,#2c7028 55%,#17471a)',
  },
]

export const COURTS: Court[] = CLUBS.flatMap((club) =>
  Array.from({ length: club.courts }, (_, i) => ({
    id: club.id + '-court-' + (i + 1),
    club_id: club.id,
    name: '第 ' + (i + 1) + ' 球場',
  })),
)

const WEEKNIGHTS = [1, 2, 3, 4, 5]
const WEEKEND = [0, 6]
const EVERYDAY = [0, 1, 2, 3, 4, 5, 6]

export const PLAYERS: Player[] = [
  {
    id: ME, name: '陳彥廷', avatar_hue: 210, ntrp: 3, district: '台北市大安區',
    lat: 25.0265, lng: 121.5435, hand: 'right',
    bio: '週末球友，正手比反手穩。想找程度差不多的固定球伴。',
    wins: 12, losses: 9,
    // 這是「還沒登錄」的草稿，所以偏好一律留白——預先勾好等於幫使用者決定，
    // 他很可能直接按下一步，然後拿到一組不是自己的偏好去媒合
    level_answers: null,
    availability: { weekdays: [], blocks: [] },
    pref_club_ids: [],
    pref_ntrp_min: 2.5, pref_ntrp_max: 3.5,
  },
  {
    id: 'p-kai', name: '王凱文', avatar_hue: 24, ntrp: 3.5, district: '台北市大安區',
    lat: 25.0300, lng: 121.5470, hand: 'right',
    bio: '底線纏鬥型，喜歡打長球。平日晚上比較有空。',
    wins: 34, losses: 21,
    level_answers: 'manual',
    availability: { weekdays: WEEKNIGHTS, blocks: ['evening'] },
    pref_club_ids: ['c-daan', 'c-xinyi'],
    pref_ntrp_min: 3, pref_ntrp_max: 4,
  },
  {
    id: 'p-ethan', name: '李昱辰', avatar_hue: 0, ntrp: 3, district: '台北市大安區',
    lat: 25.0230, lng: 121.5380, hand: 'right',
    bio: '高中生，禮拜六早上固定練球，想找人對打。',
    wins: 9, losses: 7,
    level_answers: 'manual',
    availability: { weekdays: [6], blocks: ['morning'] },
    pref_club_ids: ['c-daan', 'c-zhongshan'],
    pref_ntrp_min: 2.5, pref_ntrp_max: 3.5,
  },
  {
    id: 'p-hanwei', name: '吳承翰', avatar_hue: 190, ntrp: 3, district: '台北市信義區',
    lat: 25.0330, lng: 121.5600, hand: 'right',
    bio: '下班後想動一動，不太計較勝負，打得開心比較重要。',
    wins: 15, losses: 18,
    level_answers: 'manual',
    availability: { weekdays: [...WEEKNIGHTS, ...WEEKEND], blocks: ['evening', 'afternoon'] },
    pref_club_ids: ['c-xinyi', 'c-daan', 'c-neihu'],
    pref_ntrp_min: 2.5, pref_ntrp_max: 3.5,
  },
  {
    id: 'p-shihan', name: '黃詩涵', avatar_hue: 300, ntrp: 3.5, district: '台北市中山區',
    lat: 25.0650, lng: 121.5250, hand: 'right',
    bio: '正拍抽球是強項，反拍還在練。平日晚上都可以。',
    wins: 28, losses: 24,
    level_answers: 'manual',
    availability: { weekdays: WEEKNIGHTS, blocks: ['evening'] },
    pref_club_ids: ['c-zhongshan', 'c-sanchong', 'c-daan'],
    pref_ntrp_min: 3, pref_ntrp_max: 4,
  },
  {
    id: 'p-ryan', name: 'Ryan Park', avatar_hue: 150, ntrp: 3, district: '台北市內湖區',
    lat: 25.0820, lng: 121.5780, hand: 'left',
    bio: '左手，發球有角度。在台北工作三年了，想固定找人打。',
    wins: 20, losses: 19,
    level_answers: 'manual',
    availability: { weekdays: EVERYDAY, blocks: ['evening', 'morning'] },
    pref_club_ids: ['c-neihu', 'c-xinyi'],
    pref_ntrp_min: 2.5, pref_ntrp_max: 3.5,
  },
  {
    id: 'p-yuting', name: '陳語婷', avatar_hue: 330, ntrp: 4, district: '台北市士林區',
    lat: 25.1000, lng: 121.5250, hand: 'left',
    bio: '打了六年，想找強一點的對手練習。',
    wins: 51, losses: 28,
    level_answers: 'manual',
    availability: { weekdays: WEEKEND, blocks: ['morning', 'afternoon'] },
    pref_club_ids: ['c-tianmu', 'c-zhongshan'],
    pref_ntrp_min: 3.5, pref_ntrp_max: 4.5,
  },
  {
    id: 'p-meiling', name: '林美玲', avatar_hue: 275, ntrp: 2.5, district: '台北市內湖區',
    lat: 25.0800, lng: 121.5900, hand: 'right',
    bio: '打了半年，還在練發球，求輕虐。',
    wins: 6, losses: 15,
    level_answers: 'manual',
    availability: { weekdays: WEEKEND, blocks: ['morning'] },
    pref_club_ids: ['c-neihu', 'c-tianmu'],
    pref_ntrp_min: 2, pref_ntrp_max: 3,
  },
  {
    id: 'p-jason', name: 'Jason Liu', avatar_hue: 45, ntrp: 3, district: '新北市板橋區',
    lat: 25.0120, lng: 121.4650, hand: 'right',
    bio: '回台灣兩年，找固定球伴一起練。板橋、台北都可以。',
    wins: 18, losses: 22,
    level_answers: 'manual',
    availability: { weekdays: EVERYDAY, blocks: ['evening', 'afternoon'] },
    pref_club_ids: ['c-banqiao', 'c-daan', 'c-sanchong'],
    pref_ntrp_min: 2.5, pref_ntrp_max: 3.5,
  },
  {
    id: 'p-mingyuan', name: '蔡明遠', avatar_hue: 95, ntrp: 2.5, district: '新北市新店區',
    lat: 24.9750, lng: 121.5400, hand: 'right',
    bio: '剛開始打，週末早上有空，希望對方有耐心一點。',
    wins: 3, losses: 11,
    level_answers: 'manual',
    availability: { weekdays: WEEKEND, blocks: ['morning'] },
    pref_club_ids: ['c-xindian'],
    pref_ntrp_min: 2, pref_ntrp_max: 3,
  },
  {
    id: 'p-hao', name: '張皓', avatar_hue: 15, ntrp: 4.5, district: '桃園市中壢區',
    lat: 24.9600, lng: 121.2200, hand: 'right',
    bio: '大學校隊出身，可以陪練也可以認真打。',
    wins: 88, losses: 31,
    level_answers: 'manual',
    availability: { weekdays: WEEKEND, blocks: ['morning', 'afternoon'] },
    pref_club_ids: ['c-taoyuan', 'c-xindian'],
    pref_ntrp_min: 4, pref_ntrp_max: 5.5,
  },
  {
    id: 'p-sofia', name: 'Sofia Chen', avatar_hue: 260, ntrp: 3.5, district: '新竹市東區',
    lat: 24.7900, lng: 121.0100, hand: 'right',
    bio: '新竹上班，偶爾北上找人打。',
    wins: 40, losses: 33,
    level_answers: 'manual',
    availability: { weekdays: WEEKNIGHTS, blocks: ['evening'] },
    pref_club_ids: ['c-taoyuan'],
    pref_ntrp_min: 3, pref_ntrp_max: 4,
  },
]

/** 同樣要用本地日期，不然示範資料會跟畫面上的「今天」對不起來。 */
function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

/** 已經被別人訂走的時段，讓訂場畫面不是一片空的。 */
export const SEED_BOOKINGS = [
  { club_id: 'c-daan', date: isoDate(0), hour: 19, court: 1, user: 'p-other' },
  { club_id: 'c-daan', date: isoDate(0), hour: 19, court: 2, user: 'p-other' },
  { club_id: 'c-daan', date: isoDate(0), hour: 20, court: 1, user: 'p-other' },
  { club_id: 'c-daan', date: isoDate(1), hour: 18, court: 3, user: 'p-other' },
  { club_id: 'c-xinyi', date: isoDate(1), hour: 19, court: 1, user: 'p-other' },
  { club_id: 'c-neihu', date: isoDate(1), hour: 20, court: 2, user: 'p-other' },
  { club_id: 'c-tianmu', date: isoDate(2), hour: 9, court: 1, user: 'p-other' },
  // 這一筆是下面那封邀請函訂的場，兩者要對得起來
  { club_id: 'c-daan', date: isoDate(2), hour: 19, court: 4, user: 'p-kai' },
]

/** 別人寄給你的邀約，這樣「收到的邀約」那一段才有東西可以按。 */
export const SEED_INVITES = [
  {
    id: 'inv-seed-1',
    from_id: 'p-kai',
    to_id: ME,
    club_id: 'c-daan',
    booking_id: 'seed-7',
    date: isoDate(2),
    hour: 19,
    message: '看到你也在大安區，程度好像差不多，要不要打一場？',
    status: 'pending' as const,
  },
]

/**
 * 登錄時讓使用者選「活動範圍」用的。
 * 選了哪一區就把該區中心的座標存進 Player.lat/lng——要使用者輸入完整地址
 * 會嚇跑一半的人，而媒合只需要粗略位置就夠準了。
 */
export const DISTRICTS: Array<{ name: string; lat: number; lng: number }> = [
  { name: '台北市大安區', lat: 25.0265, lng: 121.5435 },
  { name: '台北市信義區', lat: 25.0330, lng: 121.5600 },
  { name: '台北市中山區', lat: 25.0650, lng: 121.5250 },
  { name: '台北市內湖區', lat: 25.0820, lng: 121.5780 },
  { name: '台北市士林區', lat: 25.1000, lng: 121.5250 },
  { name: '台北市松山區', lat: 25.0500, lng: 121.5600 },
  { name: '台北市中正區', lat: 25.0320, lng: 121.5180 },
  { name: '台北市萬華區', lat: 25.0280, lng: 121.4990 },
  { name: '新北市板橋區', lat: 25.0120, lng: 121.4650 },
  { name: '新北市三重區', lat: 25.0620, lng: 121.4880 },
  { name: '新北市新店區', lat: 24.9750, lng: 121.5400 },
  { name: '新北市中和區', lat: 24.9990, lng: 121.4980 },
  { name: '桃園市中壢區', lat: 24.9600, lng: 121.2200 },
  { name: '新竹市東區', lat: 24.7900, lng: 121.0100 },
]
