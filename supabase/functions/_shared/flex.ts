/** ===== flex.ts =====
 * LINE 的 Flex Message 版型。對應設計稿上那幾張卡。
 *
 * 兩個 Edge Function 都用得到（送邀約時推、前一天提醒時推），所以放共用。
 *
 * 配色跟 App 一致：紅土 #c4522f 是我們的主要動作，LINE 綠 #06c755 留給
 * 「在 LINE 裡繼續」那顆按鈕——那是 LINE 的地盤，用它的顏色使用者才知道
 * 按下去不會跳出去。提醒卡用金褐 #9a6b12，跟紅土分得開。
 */

export const CLAY = '#c4522f'
export const CLAY_SOFT = '#fbeee9'
export const LINE_GREEN = '#06c755'
export const AMBER = '#9a6b12'
export const INK = '#17150f'
export const INK_2 = '#5c5750'
export const INK_3 = '#8f8880'

export interface Club { name: string; price_per_hour: number | null }
export interface Person { name: string; ntrp: number | null; district: string | null }

/** 一列「標籤 ─ 值」。右邊靠右對齊，長球場名才不會把標籤擠掉。 */
function row(label: string, value: string) {
  return {
    type: 'box', layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: INK_3, flex: 2 },
      { type: 'text', text: value, size: 'sm', color: INK, weight: 'bold', flex: 5, wrap: true, align: 'end' },
    ],
  }
}

function button(label: string, url: string, color: string) {
  return {
    type: 'button', style: 'primary', height: 'sm', color,
    action: { type: 'uri', label, uri: url },
  }
}

function money(n: number | null): string {
  if (n === null) return '價格未提供'
  if (n === 0) return '免費'
  return 'NT$' + n
}

/**
 * 深連結回 App 的某一頁。
 *
 * LIFF 的網址不能帶 # 片段，但 App 用的是 HashRouter，所以路徑走
 * ?liff.state= 這個查詢參數送進去，前端 initLiff() 再把它轉回 hash。
 */
export function liffLink(liffId: string, path: string): string {
  return `https://liff.line.me/${liffId}?liff.state=${encodeURIComponent(path)}`
}

/** 有人約你。這張卡是整個產品的成敗——沒推播就沒人回。 */
export function invitedFlex(o: {
  from: Person; club: Club; whenText: string; message: string
  score: number | null; inviteUrl: string
}) {
  const chips = [
    o.from.ntrp !== null ? `NTRP ${o.from.ntrp}` : null,
    o.from.district ?? null,
  ].filter(Boolean).join('・')

  return {
    type: 'flex',
    // altText 是通知列與不支援 Flex 的環境會看到的字，一定要自己讀得懂
    altText: `${o.from.name} 約你 ${o.whenText} 打球`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'horizontal', paddingAll: '16px', backgroundColor: CLAY,
        contents: [
          { type: 'text', text: '有人約你打球', color: '#ffffff', weight: 'bold', size: 'md', flex: 4 },
          ...(o.score !== null
            ? [{ type: 'text', text: `合適度 ${o.score}`, color: '#ffffff', size: 'xs', weight: 'bold', align: 'end', gravity: 'center', flex: 3 }]
            : []),
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: o.from.name, weight: 'bold', size: 'xl', color: INK },
          ...(chips ? [{ type: 'text', text: chips, size: 'sm', color: INK_2, wrap: true }] : []),
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md',
            contents: [
              row('球場', o.club.name),
              row('時間', o.whenText),
              row('場地費', money(o.club.price_per_hour) + '・現場均分'),
            ],
          },
          ...(o.message
            ? [{
                type: 'box', layout: 'vertical', backgroundColor: '#faf9f7',
                cornerRadius: '10px', paddingAll: '12px', margin: 'md',
                contents: [{ type: 'text', text: `「${o.message}」`, size: 'sm', color: INK_2, wrap: true }],
              }]
            : []),
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        // 這顆用 LINE 綠：按下去是在 LINE 裡開 LIFF，不會跳出去
        contents: [button('看邀約並回覆', o.inviteUrl, LINE_GREEN)],
      },
    },
  }
}

/** 約成了。重點是「還沒訂場」跟「誰去訂」——不講清楚兩個人都會以為對方會處理。 */
export function acceptedFlex(o: {
  other: Person; club: Club; whenText: string; bookerIsYou: boolean
  needsBooking: boolean; inviteUrl: string
}) {
  return {
    type: 'flex',
    altText: `${o.other.name} 接受了邀約：${o.whenText}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: LINE_GREEN,
        contents: [{ type: 'text', text: '約成了', color: '#ffffff', weight: 'bold', size: 'md' }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          {
            type: 'text', wrap: true, size: 'md', color: INK,
            text: o.needsBooking
              ? `你和 ${o.other.name} 約好了。場地還沒訂，記得訂下來。`
              : `你和 ${o.other.name} 約好了。這個場不用訂，直接去就好。`,
          },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#faf9f7',
            cornerRadius: '10px', paddingAll: '12px',
            contents: [
              row('球場', o.club.name),
              row('時間', o.whenText),
              ...(o.needsBooking ? [row('誰去訂', o.bookerIsYou ? '你' : o.other.name)] : []),
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: [button(o.needsBooking ? '去訂場' : '看這場球', o.inviteUrl, CLAY)],
      },
    },
  }
}

/** 婉拒或取消。要講明場地已經退掉，不然對方會以為場還留著。 */
export function endedFlex(o: {
  other: Person; club: Club; whenText: string; cancelled: boolean; inviteUrl: string
}) {
  const what = o.cancelled ? '取消了這場' : '這次不方便'
  return {
    type: 'flex',
    altText: `${o.other.name}${what}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: `${o.other.name}${what}`, weight: 'bold', size: 'md', color: INK, wrap: true },
          { type: 'text', text: `${o.club.name}・${o.whenText}`, size: 'sm', color: INK_2, wrap: true },
          { type: 'text', text: '場地已經退掉了，不會佔著。', size: 'sm', color: INK_3, wrap: true },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [button('再找一個球伴', o.inviteUrl, CLAY)],
      },
    },
  }
}

/**
 * 前一天還沒有人訂場。
 *
 * 這張卡是「訂完回報」真正能成立的原因——不靠使用者記得，靠系統問。
 * 三個出口都要給：去訂、我訂好了、換人訂。少了最後一個，
 * 兩個人都在等對方的時候就沒有出路。
 */
export function reminderFlex(o: {
  other: Person; club: Club; whenText: string; hoursLeft: number
  bookerIsYou: boolean; inviteUrl: string; bookingUrl: string | null
}) {
  return {
    type: 'flex',
    altText: `${o.whenText}的球還沒訂場`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'horizontal', paddingAll: '16px', backgroundColor: AMBER,
        contents: [{ type: 'text', text: '這場球還沒訂場', color: '#ffffff', weight: 'bold', size: 'md' }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          {
            type: 'text', wrap: true, size: 'md', color: INK,
            text: `你和 ${o.other.name} 約了 ${o.whenText}，但還沒有人說訂好了。`,
          },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#faf9f7',
            cornerRadius: '10px', paddingAll: '12px',
            contents: [
              row('球場', o.club.name),
              row('說好誰去訂', o.bookerIsYou ? '你' : o.other.name),
              row('距離開打', `${o.hoursLeft} 小時`),
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: [
          ...(o.bookingUrl ? [button('到官方系統訂場', o.bookingUrl, AMBER)] : []),
          button('我訂好了 / 換人訂', o.inviteUrl, CLAY),
        ],
      },
    },
  }
}
