/** ===== main.tsx ===== */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { registerServiceWorker } from './lib/appUpdate.ts'
import { initAuth } from './lib/auth.ts'
import { initLiff } from './lib/liff.ts'
import './styles.css'

/**
 * 開始渲染之前先做兩件事，順序有意義：
 *
 * 1. LIFF 要先——它會把 `?liff.state=` 轉回 hash。晚一步的話 Router 已經
 *    讀過網址了，深連結就會落在首頁而不是那封邀約。
 * 2. 再解析 session。少了這一步，已經登入的人會先看到登入畫面閃一下才跳進
 *    App，每次冷啟動都閃一次，很像壞掉。
 *
 * 兩者都失敗也照樣渲染，讓 App 自己去顯示錯誤。
 */
initLiff().then(initAuth).finally(() => {
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
