/** ===== main.tsx ===== */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { registerServiceWorker } from './lib/appUpdate.ts'
import { autoSignInInLine, initAuth } from './lib/auth.ts'
import { initLiff } from './lib/liff.ts'
import { reportPerf } from './lib/report.ts'
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
const warn = (where: string) => (e: unknown) => {
  // 這兩步失敗不該擋住畫面，但一定要留痕跡——曾經因為前一步靜靜地 reject，
  // 導致 initAuth 整個被跳過，登入畫面於是顯示了一顆後端根本沒開的按鈕，
  // 而 console 什麼都沒有，查了很久。
  console.warn('[啟動] ' + where + ' 失敗：' + ((e as Error)?.message ?? String(e)))
}

// 兩步各自 catch，前一步倒了後一步照樣要跑。
// 用 .then(initAuth) 串接的話，initLiff 一 reject 就會連 initAuth 一起跳過，
// 而 .finally 還是會渲染——畫面出得來，但身分和後端設定都沒載入。
/*
 * 只等 LIFF，其餘都不擋畫面。
 *
 * 原本是等 LIFF → 讀 session → 自動登入 → 網路探針全部跑完才渲染，
 * 加起來每次進來都空白兩秒以上。那幾件事裡只有 LIFF 非等不可：
 * 它會把 ?liff.state= 轉成真的導頁，晚一步的話 Router 已經讀過網址，
 * 深連結就會落在首頁而不是使用者點的那一格。
 *
 * 登入狀態改成背景解析，畫面用 authReady() 顯示「確認中」，
 * 不會閃一下登入頁。訪客本來就能逛，不需要等任何身分確認。
 */
initLiff()
  .catch(warn('LIFF 初始化'))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    // 量一次這台裝置實際的載入時間。使用者說「第一次兩三秒、第二次不到一秒」，
    // 那種事不該靠口述——讓 App 自己把數字送回來。
    reportPerf()

    // 這兩件事在背景做完，畫面會自己跟上
    void initAuth()
      .catch(warn('讀取登入狀態'))
      .then(() => autoSignInInLine().catch(warn('LINE 自動登入')))
  })

/**
 * 註冊 service worker，讓 App 裝到主畫面後沒網路也打得開，並在有新版時提示。
 * 開發模式不註冊——SW 的快取會蓋掉 Vite 的熱更新，改了程式碼看不到變化。
 */
if (import.meta.env.PROD) {
  window.addEventListener('load', () => registerServiceWorker(__BUILD__))
}
