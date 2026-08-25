/** ===== make_richmenu.ts =====
 * 產生 LINE 圖文選單的底圖（2500×1686 PNG）。
 *
 *   node --experimental-strip-types tools/make_richmenu.ts
 *
 * 為什麼不像 make_icons.ts 那樣自己刻像素：那六格要寫中文。手刻 PNG 畫得出
 * 圓形和線條，畫不出「找附近球場」四個字——除非自己解析 TTF 字型檔，
 * 那個工程量遠超過這張圖的價值。
 *
 * 所以改成排一張 HTML 再用無頭 Chrome 截圖。Chrome 只在產圖時用到，
 * 不是執行期的相依；產完的 PNG 進版控，之後要上傳選單的人不需要有 Chrome。
 *
 * 版面必須跟 setup_richmenu.ts 裡的 areas 對得起來——那邊寫的是點擊範圍，
 * 這邊畫的是看得到的格線，兩邊都是 3 欄 × 2 列、每格 833×843。
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, existsSync, unlinkSync } from 'node:fs'

const W = 2500
const H = 1686
const COLS = 3
const ROWS = 2

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find((p) => existsSync(p))

/**
 * 六格的內容。順序就是版面順序（左上 → 右下）。
 * 第一格刻意是「找附近球場」——使用者打開 LINE 最常想做的就是這件事，
 * 而在有圖文選單之前，那件事要先找到 LIFF 連結才做得到。
 */
export const CELLS = [
  { icon: '🎾', title: '找附近球場', sub: '照你的位置排' },
  { icon: '👥', title: '找球伴', sub: '程度相近的人' },
  { icon: '📩', title: '我的邀約', sub: '誰約了我' },
  { icon: '📅', title: '我的預約', sub: '接下來要打的' },
  { icon: '🏆', title: '報名球賽', sub: '網球協會' },
  { icon: '⚙️', title: '偏好設定', sub: '程度・時段・球場' },
]

const cellHtml = (c: typeof CELLS[number], i: number) => `
  <div class="cell${i === 0 ? ' hero' : ''}">
    <div class="icon">${c.icon}</div>
    <div class="title">${c.title}</div>
    <div class="sub">${c.sub}</div>
  </div>`

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    font-family: "PingFang TC", "Noto Sans TC", -apple-system, sans-serif;
    background: #faf7f5;
  }
  .grid {
    width: ${W}px; height: ${H}px;
    display: grid;
    grid-template-columns: repeat(${COLS}, 1fr);
    grid-template-rows: repeat(${ROWS}, 1fr);
    gap: 4px; background: #e6ddd6;
  }
  .cell {
    background: #fffdfb;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 26px;
  }
  /* 第一格是主要動作，給它紅土色的底，在聊天室裡一眼就看得到 */
  .cell.hero { background: linear-gradient(150deg, #c4522f, #8f3520); }
  .cell.hero .title { color: #fff; }
  .cell.hero .sub { color: rgba(255,255,255,.82); }
  .icon { font-size: 190px; line-height: 1; }
  .title { font-size: 88px; font-weight: 700; color: #2a211d; letter-spacing: .02em; }
  .sub { font-size: 52px; color: #8a7d75; letter-spacing: .02em; }
</style>
<div class="grid">${CELLS.map(cellHtml).join('')}</div>
`

if (!CHROME) {
  console.error('找不到 Chrome / Chromium / Edge，無法產生底圖。')
  console.error('已經有 public/richmenu.png 的話不用重產；要改版面才需要裝其中一個。')
  process.exit(1)
}

const tmpHtml = new URL('richmenu.tmp.html', import.meta.url)
const out = new URL('../public/richmenu.png', import.meta.url)
writeFileSync(tmpHtml, html)

execFileSync(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--window-size=${W},${H}`,
  `--screenshot=${out.pathname}`,
  tmpHtml.href,
], { stdio: 'pipe' })

unlinkSync(tmpHtml)
console.log(`已產生 public/richmenu.png（${W}×${H}，${CELLS.length} 格）`)
console.log('接著跑 tools/setup_richmenu.ts 上傳到 LINE。')
