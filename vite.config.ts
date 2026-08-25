import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { copyFileSync } from 'node:fs'

/**
 * 每次建置產生一個版本字串，用在兩個地方：
 *   1. 顯示在「我的」頁最下面——測試者回報問題時，第一個要問的就是「你哪一版」
 *   2. 當作 service worker 的網址參數，讓瀏覽器認得出這是新的 SW
 * CI 上有 git，本機沒 git 時退回時間戳，不要讓建置整個失敗。
 */
function buildId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
    return stamp + '-' + sha
  } catch {
    return stamp + '-dev'
  }
}

const BUILD = buildId()

/**
 * 把 index.html 再輸出一份 404.html。
 *
 * 靜態主機（GitHub Pages、Netlify…）對不存在的路徑會回 404。平常 HashRouter
 * 不會產生那種路徑，但 LIFF SDK 會：它把 ?liff.state=/clubs 變成真的導頁到
 * <base>/clubs。沒有這一份的話，圖文選單每一格都是 404。
 *
 * GitHub Pages 送 404.html 時不會改網址，所以 App 還看得到原本的路徑，
 * liff.ts 的 pathToHash() 再把它轉回 hash 路由。
 */
function emit404() {
  return {
    name: 'emit-404-html',
    closeBundle() {
      const dir = new URL('dist/', import.meta.url)
      copyFileSync(new URL('index.html', dir), new URL('404.html', dir))
    },
  }
}

/** 產出 version.json，讓常駐在背景的 App 有辦法問「線上現在是哪一版」。 */
function emitVersionFile() {
  return {
    name: 'emit-version-json',
    generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD }),
      })
    },
  }
}

export default defineConfig({
  /*
   * 部署的子路徑，建置時由 VITE_BASE 決定（GitHub Pages 是 /tennis-match/）。
   *
   * 本來是 './'，理由是「部署到任何子路徑都不用改設定」。那個理由在遇到
   * LIFF 之後不成立了：liff.init() 會把 ?liff.state=/profile/preferences
   * 變成真的導頁到 /tennis-match/profile/preferences，而相對路徑在那個深度
   * 會把資源解析到 /tennis-match/profile/assets/… ——整個 App 載不起來。
   *
   * 絕對路徑不管在哪一層都指得對。預設 '/' 讓本機開發照舊。
   */
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), emitVersionFile(), emit404()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: {
    host: true,
    port: 5180,
    // LINE 的 LIFF 只吃 https，本機開發時用 cloudflared 隧道掛上去。
    // Vite 預設擋掉不認識的 Host，開頭那個點代表「這個網域和它所有子網域」——
    // 隧道網址每次重開都會變，用萬用字元才不用一直回來改這裡。
    allowedHosts: ['.trycloudflare.com'],
  },
})
