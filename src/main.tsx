/** ===== main.tsx ===== */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { registerServiceWorker } from './lib/appUpdate.ts'
import { initAuth } from './lib/auth.ts'
import './styles.css'

/**
 * 先把 session 解析完再開始渲染。少了這一步，已經登入的人會先看到登入畫面
 * 閃一下才跳進 App——每次冷啟動都閃一次，很像壞掉。
 * 解析失敗（後端連不上）也照樣渲染，讓 App 自己去顯示錯誤。
 */
initAuth().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

/**
 * 註冊 service worker，讓 App 裝到主畫面後沒網路也打得開，並在有新版時提示。
 * 開發模式不註冊——SW 的快取會蓋掉 Vite 的熱更新，改了程式碼看不到變化。
 */
if (import.meta.env.PROD) {
  window.addEventListener('load', () => registerServiceWorker(__BUILD__))
}
