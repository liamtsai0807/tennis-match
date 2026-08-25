/** ===== setup_richmenu.ts =====
 * 把圖文選單裝到 LINE 官方帳號上，並設為所有人的預設。
 *
 *   node --experimental-strip-types tools/setup_richmenu.ts
 *   node --experimental-strip-types tools/setup_richmenu.ts --dry   # 只印出要送什麼
 *
 * 為什麼要有這個東西：在有圖文選單之前，使用者打開 LINE 對話視窗只看得到
 * 一個空白的輸入框——要用這個服務得先自己找到 LIFF 連結。圖文選單釘在
 * 鍵盤上方，開啟對話就在那裡，這是把「門檻」降到零的唯一辦法。
 *
 * 需要的東西（跟 Edge Function 共用同一份 .env）：
 *   supabase/functions/.env → LINE_CHANNEL_ACCESS_TOKEN、LINE_LIFF_ID
 *
 * 版面對應 tools/make_richmenu.ts 畫的那張圖：3 欄 × 2 列。
 * 改那邊的格子順序，這邊的 ACTIONS 要跟著改，否則按下去會跑錯地方。
 */
import { readFileSync, existsSync } from 'node:fs'

const API = 'https://api.line.me/v2/bot'
const DATA_API = 'https://api-data.line.me/v2/bot'

const W = 2500
const H = 1686
const COLS = 3
const ROWS = 2

// ---------- 讀設定 ----------

function readEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const fnEnv = readEnv(new URL('../supabase/functions/.env', import.meta.url).pathname)
const appEnv = readEnv(new URL('../.env', import.meta.url).pathname)

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? fnEnv.LINE_CHANNEL_ACCESS_TOKEN
const LIFF_ID = process.env.LINE_LIFF_ID ?? fnEnv.LINE_LIFF_ID ?? appEnv.VITE_LINE_LIFF_ID
const DRY = process.argv.includes('--dry')

/** 中華民國網球協會的線上報名系統。跟 Home.tsx 用的是同一個網址。 */
const CTTA_URL = 'https://ctta.dadada.com.tw/ctta/login.asp'

/** 深連結。跟 supabase/functions/_shared/flex.ts 的 liffLink() 是同一套規則。 */
const liff = (path: string) =>
  `https://liff.line.me/${LIFF_ID}?liff.state=${encodeURIComponent(path)}`

/**
 * 六格的動作，順序必須跟 make_richmenu.ts 的 CELLS 一致。
 * 第一格是「找附近球場」——打開 LINE 最常想做的那件事，放在左上角最大的位置。
 */
const ACTIONS: Array<{ label: string; uri: string }> = [
  { label: '找附近球場', uri: liff('/clubs') },
  { label: '找球伴', uri: liff('/match') },
  { label: '我的邀約', uri: liff('/') },
  { label: '我的預約', uri: liff('/profile') },
  { label: '報名球賽', uri: CTTA_URL },
  { label: '偏好設定', uri: liff('/profile/preferences') },
]

/**
 * 把六格切成點擊範圍。
 * 最後一欄／最後一列要吃掉除不盡的餘數，不然右邊和下面會留一條點不到的縫。
 */
function areas() {
  const cw = Math.floor(W / COLS)
  const ch = Math.floor(H / ROWS)
  return ACTIONS.map((a, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    return {
      bounds: {
        x: col * cw,
        y: row * ch,
        width: col === COLS - 1 ? W - col * cw : cw,
        height: row === ROWS - 1 ? H - row * ch : ch,
      },
      action: { type: 'uri' as const, label: a.label, uri: a.uri },
    }
  })
}

const menu = {
  size: { width: W, height: H },
  selected: true,          // 進對話就展開，不用使用者自己點開
  name: 'TennisPal 主選單',
  chatBarText: '打開選單',
  areas: areas(),
}

// ---------- 送出 ----------

async function api(method: string, path: string, body?: unknown, base = API) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`)
  return text ? JSON.parse(text) : {}
}

async function main() {
  if (!TOKEN) {
    console.error('缺 LINE_CHANNEL_ACCESS_TOKEN（找不到 supabase/functions/.env）')
    process.exit(1)
  }
  if (!LIFF_ID) {
    console.error('缺 LIFF ID。LINE_LIFF_ID 或 VITE_LINE_LIFF_ID 至少要有一個。')
    process.exit(1)
  }

  console.log('LIFF ID：', LIFF_ID)
  for (const a of ACTIONS) console.log('  ', a.label.padEnd(6), a.uri)

  if (DRY) {
    console.log('\n--dry：沒有真的送出。')
    return
  }

  const png = readFileSync(new URL('../public/richmenu.png', import.meta.url))
  console.log('\n底圖：', (png.length / 1024).toFixed(0), 'KB')

  // 舊的先清掉。不清的話每跑一次就多留一個孤兒選單，
  // 而每個帳號的選單數量是有上限的
  const { richmenus } = await api('GET', '/richmenu/list') as { richmenus?: Array<{ richMenuId: string }> }
  for (const old of richmenus ?? []) {
    await api('DELETE', '/richmenu/' + old.richMenuId)
    console.log('已刪除舊選單', old.richMenuId)
  }

  const { richMenuId } = await api('POST', '/richmenu', menu) as { richMenuId: string }
  console.log('已建立選單', richMenuId)

  // 圖片走另一個網域（api-data），而且不能帶 JSON 的 Content-Type
  const up = await fetch(`${DATA_API}/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'image/png' },
    body: png,
  })
  if (!up.ok) throw new Error('上傳底圖失敗：' + up.status + ' ' + (await up.text()))
  console.log('已上傳底圖')

  await api('POST', '/user/all/richmenu/' + richMenuId)
  console.log('已設為所有使用者的預設選單')
  console.log('\n完成。回 LINE 把對話關掉再打開就會看到。')
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e))
  process.exit(1)
})
