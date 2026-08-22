import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相對路徑：部署到 GitHub Pages 那種子路徑（/repo-name/）也不用改設定。
  // 搭配 HashRouter，靜態主機不需要任何 rewrite 規則。
  base: './',
  plugins: [react()],
  server: { host: true, port: 5180 },
})
