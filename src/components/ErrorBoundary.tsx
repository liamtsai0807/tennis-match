/** ===== ErrorBoundary.tsx =====
 * 畫面丟例外時 React 會把整棵樹卸載。沒有這道防線，使用者看到的是全白畫面——
 * 沒有訊息、沒有出路，只能把 App 關掉。這裡至少留下「發生什麼事」跟「怎麼繼續」。
 *
 * 刻意包在 Routes 外面、底部導覽裡面：壞掉的是單一畫面，導覽列要留著，
 * 使用者才能自己走去別頁，而不是整個 App 陪葬。
 */
import { Component, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface Props {
  children: ReactNode
  /** 值一變就重置。傳目前路徑進來，換頁時壞掉的畫面不會一直卡著。 */
  resetKey: string
}

interface State {
  error: Error | null
}

class Boundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // 先留在 console。之後接上錯誤回報服務時，只要換掉這一行。
    console.error('[畫面錯誤]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  private retry = (): void => {
    this.setState({ error: null })
  }

  private goHome = (): void => {
    // 已經在首頁時 hash 不會變，路徑沒變就不會觸發上面的重置，所以這裡自己清掉
    window.location.hash = '#/'
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="screen-error">
        <div className="empty">
          <div className="big">🎾</div>
          <p style={{ fontWeight: 700, color: 'var(--ink-2)' }}>這個畫面出了點問題</p>
          <p>不是你操作錯了。換一頁可以繼續用，其他功能不受影響。</p>
        </div>

        <div className="screen-error-actions">
          <button className="btn" onClick={this.retry}>再試一次</button>
          <button className="btn primary" onClick={this.goHome}>回首頁</button>
        </div>

        {/* 版本加訊息一起附上——回報問題時第一個要問的就是「你哪一版」 */}
        <details className="screen-error-detail">
          <summary>回報問題時附上這段</summary>
          <pre>{`版本 ${__BUILD__}\n${error.message}`}</pre>
        </details>
      </div>
    )
  }
}

/** 包一層，讓 boundary 拿得到目前路徑當重置鍵（class component 不能用 hook）。 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}
