/** ===== useData.ts =====
 * 統一的非同步取資料 hook。順便訂閱資料變動，所以別人加入球局、
 * 或另一個分頁改了比分，畫面會自己更新。
 */
import { useCallback, useEffect, useState } from 'react'
import { subscribeAll } from './db.ts'

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

  return { data, error, loading, reload: run }
}
