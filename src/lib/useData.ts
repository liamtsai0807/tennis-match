/** ===== useData.ts =====
 * 統一的非同步取資料 hook。順便訂閱資料變動，所以別人加入球局、
 * 或另一個分頁改了比分，畫面會自己更新。
 */
import { useCallback, useEffect, useState } from 'react'
import { getMe, listClubs, subscribeAll } from './db.ts'
import type { Club, Player } from './types.ts'

export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(() => {
    let alive = true
    loader()
      .then((d) => { if (alive) { setData(d); setError(null) } })
      .catch((e) => { if (alive) setError(e as Error) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // loader 每次 render 都是新函式，所以依賴改用呼叫端給的 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    const cancel = run()
    const unsub = subscribeAll(() => { run() })
    return () => { cancel(); unsub() }
  }, [run])

  // 載入失敗在 render 階段丟出去，交給 ErrorBoundary 統一處理。
  // 不這樣做的話畫面只是一直停在 loading——後端掛掉跟資料還沒到，
  // 使用者看到的是同一片空白，而且永遠不會有下文。
  if (error) throw error

  return { data, error, loading, reload: run }
}

/**
 * 偏好編輯用的草稿。登錄流程和「我的偏好」頁做的事一模一樣：
 * 載入「我」和球場清單，然後讓畫面就地改 me。抽出來是因為原本兩邊各寫一份，
 * 而且兩份都漏了 catch——請求失敗時 me 永遠是 null，畫面就停在空白，
 * 不丟例外所以 ErrorBoundary 也接不到，使用者看到的是一片死寂。
 */
export function usePreferenceDraft() {
  const [me, setMe] = useState<Player | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([getMe(), listClubs()])
      .then(([m, c]) => { if (alive) { setMe(m); setClubs(c) } })
      .catch((e) => { if (alive) setError(e as Error) })
    return () => { alive = false }
  }, [])

  if (error) throw error

  return { me, setMe, clubs }
}
