/** ===== clubOverrides.ts =====
 * 人工查證的結果。這是唯一一份**手改的**球場資料。
 *
 * clubData.ts 是機器產生的，重跑 tools/import_clubs.ts 就會整份蓋掉——
 * 人工查來的價格、面數、夜燈如果寫在那裡，下次匯入就全沒了。
 * 所以查證成果放這裡，由匯入工具在產生 clubData.ts 時套上去。
 *
 * 對應鍵用地址而不是 id。id 是 名稱+地址 的雜湊，一改名字就變了；
 * 而政府開放資料的場館名稱本來就常常不是球場的名字
 * （例如臺北市網球中心在 iPlay 裡叫「臺北市網球中心附設健身房」）。
 * 地址比名稱穩定得多。
 *
 * 查證方式：看官方網站與第一手資料，查不到的就留空，不要用推測填。
 * 每一筆都要記 verified_on，資料會過期，不記日期就不知道哪一筆該重查。
 */
import type { Club } from './types.ts'

export interface ClubOverride {
  /** 要蓋的那個場的地址，逐字抄開放資料裡的寫法即可，比對前會正規化 */
  address: string
  /** 只寫查證過的欄位。沒查到的不要放進來——留 null 才是誠實的 */
  patch: Partial<Omit<Club, 'id' | 'lat' | 'lng' | 'source'>>
  /** 查證日期（ISO），以及查了什麼 */
  verifiedOn: string
  sources: string[]
}

export const CLUB_OVERRIDES: ClubOverride[] = [
  {
    // iPlay 把整個園區記成「臺北市網球中心附設健身房」，那是館內設施的名字，
    // 不是球場的名字。這正是開放資料顆粒度問題的典型例子。
    address: '臺北市內湖區民權東路六段208號',
    verifiedOn: '2026-08-23',
    sources: [
      'https://www.tsc.taipei/場館介紹/',
      'https://www.tsc.taipei/場館介紹/室外網球場outdoor/',
      'https://www.tsc.taipei/場館介紹/室內網球場indoor/',
      'https://archi-tec.com.tw/2020/03/台北市網球中心/（面數）',
    ],
    patch: {
      name: '臺北市網球中心',
      // 建築師事務所的原始說明：露天主球場一座、露天副球場一座、
      // 戶外球場十面、室內球場四面。主副球場是賽事用的，一般人約球訂的是那十面。
      courts: 10,
      // 有燈光費 200 元/面/時 這個收費項目，等於明確證實有夜燈
      lights: true,
      // 園區同時有室內外，我們的模型只有一個布林值。主要可訂的是室外那十面，
      // 室內的差異寫在 price_note 裡，不要用一個布林值假裝講得清楚。
      indoor: false,
      // 最低那一檔。分級的細節在 price_note
      price_per_hour: 300,
      price_note:
        '室外離峰 300、尖峰 600（平日 17–19 時、假日 13–19 時），夜間另收燈光費 200；' +
        '室內全日 2000。室外開放到 19:00，室內到 22:00。' +
        '尖峰時段一次要訂兩小時，離峰可訂一小時。',
      open_hour: 6,
      close_hour: 22,
      // 官方自己的 App 才訂得到，不是市府那套通用系統。
      // 落地頁刻意指室外網球場那一頁而不是「網羽球場地預約」——後者是 2017 年的
      // 公告、內容大半在講羽球；室外網球場那頁才有網球的訂場辦法、價目與電話。
      // 這種事只有真的把連結點開才會發現。
      booking_url: 'https://www.tsc.taipei/場館介紹/室外網球場outdoor/',
      // surface 查不到。官網與新聞都沒寫材質，所以留空——
      // 「大概是硬地」不是查證，是猜測。
    },
  },

  // ---------------------------------------------------------------
  // 大台北河濱網球場
  //
  // 河濱球場分屬兩個完全不同的單位，訂法也完全不同：
  //   臺北市 → 體育局場館設施管理系統（水利工程處只管河濱棒壘球，網球歸體育局）
  //   新北市 → 高灘地工程管理處，自 114/12/1 起全流域開放線上申請，非市民也能註冊
  // 兩邊都要會員登入、都沒有 API，所以我們只能把人送到對的那個入口。
  // ---------------------------------------------------------------

  {
    address: '臺北市 中山區 大直橋 至 中山高速公路(金泰段右岸)（基隆河右岸）',
    verifiedOn: '2026-08-23',
    sources: ['https://vbs.sports.taipei/venues/?K=174'],
    patch: {
      name: '美堤河濱公園網球場',
      courts: 2,
      lights: true,
      open_hour: 8,
      close_hour: 22,
      // 官方場館頁寫的是日間夜間同價 140。網路上流傳的 400 元是錯的，
      // 那是別的收費表；只信場館頁自己寫的數字。
      price_per_hour: 140,
      price_note:
        '每小時 140 元，日間夜間同價。臺北市體育局線上預約，要先註冊會員。' +
        '未開放線上預約的面只供現場民眾輪流使用，不能營利。',
      // 深連結到這個場館自己的頁面，不是場地清單頁——那一頁就看得到時段與收費
      booking_url: 'https://vbs.sports.taipei/venues/?K=174',
    },
  },

  {
    address: '臺北市 中山區 圓山橋下10號水門 大直橋至中山橋(大佳段)（基隆河左岸）',
    verifiedOn: '2026-08-23',
    sources: ['https://vbs.sports.taipei/opendata/sports_tms2.json（確認它在系統裡）'],
    patch: {
      name: '大佳河濱公園網球場',
      open_hour: 8,
      close_hour: 22,
      // 體育局的開放資料確認這個場在系統裡（SportType 網球），但還沒找到它的
      // 場館專屬頁（?K=）——它的地址沒有路名，用路名比對的方式找不到。
      // 先給清單頁，之後補上精確的那一頁。面數與收費都還沒查證。
      booking_url: 'https://vbs.sports.taipei/venues/',
      price_note: '在臺北市體育局的線上訂場系統裡，但這個場的面數與收費還沒查證。',
    },
  },

  {
    address: '臺北市士林區通河東街1及2段堤外',
    verifiedOn: '2026-08-23',
    sources: ['https://vbs.sports.taipei/venues/?K=87'],
    patch: {
      name: '百齡河濱公園網球場（社子岸）',
      // 體育局把六面場拆成六筆（K=87～92），每筆都是「1 個(面)」。
      // 對使用者來說那是同一個地方的六面場。
      courts: 6,
      lights: false,
      open_hour: 8,
      close_hour: 22,
      // 場館頁寫「日間 不收費，夜間 不收費」——0 是真的資料，不是不知道
      price_per_hour: 0,
      price_note:
        '免費，但仍要在臺北市體育局系統預約（要先註冊會員）。沒有夜間照明，天黑就打不了。',
      booking_url: 'https://vbs.sports.taipei/venues/?K=87',
    },
  },

  {
    address: '新北市永和區綠寶石公園網球場(新店溪左岸自行車道5.5KM)',
    verifiedOn: '2026-08-23',
    sources: [
      'https://www.hrcm.ntpc.gov.tw/Service/VenueRental/TennisCourtLeaseInst/Detail/綠寶石網球場',
      'https://mp.hrcm.ntpc.gov.tw/Parnt/（線上申請系統首頁注意事項）',
    ],
    patch: {
      name: '綠寶石網球場（永和河濱）',
      lights: true,          // 有 20:00~22:00 的時段
      open_hour: 8,
      close_hour: 22,
      // 高灘處是「每 4 小時」計價，不是每小時。150 是 600÷4 的等效時薪，
      // 標「起」並把真正的計價方式寫在 price_note——不然使用者會以為打一小時 150。
      price_per_hour: 150,
      price_note:
        '平日每 4 小時 600 元、假日 800 元，未滿 2 小時以半場次計。' +
        '時段固定兩小時一節：08–10、10–12、13–15、15–17、18–20、20–22。' +
        '線上申請要先註冊會員，非新北市民也可以註冊。' +
        '沒有人申請的時段開放現場自由使用。',
      booking_url:
        'https://www.hrcm.ntpc.gov.tw/Service/VenueRental/TennisCourtLeaseInst/Detail/綠寶石網球場',
    },
  },

  {
    address: '新北市新店區小碧潭公園網球場(新店溪右岸自行車道2.3KM)',
    verifiedOn: '2026-08-23',
    sources: [
      'https://www.hrcm.ntpc.gov.tw/Service/VenueRental/TennisCourtLeaseInst/Detail/小碧潭網球場',
    ],
    patch: {
      name: '小碧潭網球場（新店河濱）',
      lights: true,
      open_hour: 8,
      close_hour: 22,
      price_per_hour: 150,
      price_note:
        '平日每 4 小時 600 元、假日 800 元，未滿 2 小時以半場次計。' +
        '時段固定兩小時一節：08–10、10–12、13–15、15–17、18–20、20–22。' +
        '線上申請要先註冊會員，非新北市民也可以註冊。' +
        '沒有人申請的時段開放現場自由使用。',
      booking_url:
        'https://www.hrcm.ntpc.gov.tw/Service/VenueRental/TennisCourtLeaseInst/Detail/小碧潭網球場',
    },
  },
]

/**
 * 開放資料整個漏掉、但確實存在而且訂得到的球場。
 *
 * override 只能修既有的球場，補不了缺的。而 iPlay 漏掉的不是零星幾個——
 * 光是臺北市河濱就漏了彩虹（9 面）和雙園（4 面），兩個都在體育局的線上訂場
 * 系統裡、都有夜燈。對「河濱打球」這件事來說，漏掉九面場等於漏掉一個大場地。
 *
 * 這裡每一筆的座標、面數、開放時間、收費都來自體育局場館頁本身，不是估的。
 */
export const CLUB_ADDITIONS: Array<{
  club: Omit<Club, 'photo'>
  sources: string[]
}> = [
  {
    sources: ['https://vbs.sports.taipei/venues/?K=201'],
    club: {
      // id 自己給，不走名稱雜湊——這筆不是從開放資料來的，沒有原始名稱可以雜湊
      id: 'c-vbs-201',
      name: '彩虹河濱公園網球場',
      district: '臺北市內湖區',
      address: '基隆河中山高速公路至麥帥一橋間(舊宗段右岸)（基隆河右岸）',
      lat: 25.062687, lng: 121.571815,
      surface: null, indoor: false, lights: true,
      price_per_hour: 140,
      price_note: '每小時 140 元，日間夜間同價。臺北市體育局線上預約，要先註冊會員。',
      rating: null, courts: 9,
      open_hour: 8, close_hour: 22,
      source: 'manual',
      booking_url: 'https://vbs.sports.taipei/venues/?K=201',
      verified_on: '2026-08-23',
    },
  },
  {
    sources: ['https://vbs.sports.taipei/venues/?K=210'],
    club: {
      id: 'c-vbs-210',
      name: '雙園河濱公園網球場',
      district: '臺北市萬華區',
      address: '雙園抽水站至華江橋上游側欄杆間',
      lat: 25.034276, lng: 121.488169,
      surface: null, indoor: false, lights: true,
      price_per_hour: 140,
      price_note: '每小時 140 元，日間夜間同價。臺北市體育局線上預約，要先註冊會員。',
      rating: null, courts: 4,
      open_hour: 8, close_hour: 22,
      source: 'manual',
      booking_url: 'https://vbs.sports.taipei/venues/?K=210',
      verified_on: '2026-08-23',
    },
  },
]
