/** ===== lazyScreen.ts =====
 * 會自己從「分塊掉了」復原的 lazy()。
 *
 * 程式碼切分之後，畫面是分開的檔案，而檔名帶內容雜湊——部署一次，舊的
 * 檔名就不存在了。使用者開著舊版的頁面、中途我們上線新版，他再點進一個
 * 還沒載入的畫面時，那個分塊就 404。
 *
 * 實際發生過，而且錯誤訊息完全看不出原因：
 *   'text/html' is not a valid JavaScript MIME type
 * （因為靜態主機把 index.html 當成 fallback 回給它了。伺服器端那一半
 * 已經改成誠實回 404，見 worker/index.ts。）
 *
 * 對使用者來說這不是錯誤，是「你手上的版本過期了」。正確的處理是重新
 * 載入一次拿到新版，而不是把崩潰畫面丟給他。
 *
 * 只重載一次——用 sessionStorage 記著。真的是別的原因壞掉時，
 * 無限重載會比原本的錯誤更糟。
 */
import { lazy, type ComponentType } from 'react'
import { report } from './report.ts'

const RELOADED = 'chunk-reloaded'

export function lazyScreen<T extends ComponentType<unknown>>(
  name: string,
  load: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    load().catch((e: unknown) => {
      const already = sessionStorage.getItem(RELOADED)
      report('chunk-load-failed', e, { name, willReload: !already })
      if (!already) {
        sessionStorage.setItem(RELOADED, name)
        window.location.reload()
        // 重載中，回一個永遠不 resolve 的 promise，不要讓 Suspense 先閃錯誤
        return new Promise<{ default: T }>(() => {})
      }
      throw e
    }),
  )
}
