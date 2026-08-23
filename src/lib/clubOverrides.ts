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
]
