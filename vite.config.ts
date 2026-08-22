import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

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

export default defineConfig({
  // 相對路徑：部署到 GitHub Pages 那種子路徑（/repo-name/）也不用改設定。
  // 搭配 HashRouter，靜態主機不需要任何 rewrite 規則。
  base: './',
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(buildId()) },
  server: { host: true, port: 5180 },
})
