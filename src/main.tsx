/** ===== main.tsx ===== */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * 註冊 service worker，讓 App 裝到主畫面後沒網路也打得開。
 * 開發模式不註冊——SW 的快取會蓋掉 Vite 的熱更新，改了程式碼看不到變化。
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch(() => { /* 註冊失敗只是少了離線功能，不擋使用 */ })
  })
}
