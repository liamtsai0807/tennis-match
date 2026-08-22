/** ===== Toast.tsx ===== */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Kind = 'ok' | 'bad'
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {})

export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: Kind } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((msg: string, kind: Kind = 'ok') => {
    window.clearTimeout(timer.current)
    setToast({ msg, kind })
    timer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && <div className={'toast' + (toast.kind === 'bad' ? ' bad' : '')}>{toast.msg}</div>}
    </Ctx.Provider>
  )
}
