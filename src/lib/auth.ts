/** ===== auth.ts =====
 * 身分只在這裡處理。畫面和 db.ts 都只問「我是誰」，不管背後是 Supabase Auth
 * 還是離線模式那個固定的示範使用者。
 *
 * Q1 決定第一版走 Google + Email，LINE Login 是第二步。
 * 三種登入方式都走同一組函式，畫面不知道背後是誰。
 */
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase.ts'

let session: Session | null = null
const listeners = new Set<(s: Session | null) => void>()

/**
 * 開始渲染畫面之前先解析一次 session。
 * 少了這一步，第一輪 render 會以為沒登入，把已經登入的人閃到登入頁再閃回來。
 */
export async function initAuth(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  session = data.session
  supabase.auth.onAuthStateChange((_event, next) => {
    session = next
    for (const fn of [...listeners]) fn(next)
  })
}

export function currentSession(): Session | null {
  return session
}

/** 目前登入者的 id。呼叫時一定已經過了 AuthGate，所以拿不到就是程式有問題。 */
export function requireUserId(): string {
  const id = session?.user.id
  if (!id) throw new Error('尚未登入')
  return id
}

export function onAuthChange(fn: (s: Session | null) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** 畫面要跟著登入狀態變的話用這個。 */
export function useSession(): Session | null {
  const [s, setS] = useState<Session | null>(currentSession())
  useEffect(() => onAuthChange(setS), [])
  return s
}

function client() {
  if (!supabase) throw new Error('沒有設定後端，無法登入')
  return supabase
}

/**
 * 寄六位數驗證碼到信箱。
 * 用驗證碼而不是魔術連結，是因為連結會把人踢出 App 去收信、再從信件跳回來——
 * 手機上這一趟很容易就回不來了。驗證碼可以直接在 App 裡打完。
 */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

/**
 * LINE Login 目前設定好了沒。
 *
 * Supabase Auth 的內建 provider 清單裡沒有 LINE，所以不能像 Google 那樣
 * 呼叫 signInWithOAuth 就了事，得走「LIFF 拿 ID token → Edge Function 驗證並
 * 換成 Supabase session」這條路。channel id 是設定不是機密，可以放前端；
 * channel secret 只有 Edge Function 看得到。
 */
export const isLineConfigured = Boolean(
  (import.meta.env.VITE_LINE_LIFF_ID ?? '').trim(),
)

/** 現在是不是跑在 LINE 的 App 裡（LIFF）。不是的話 LINE 登入按鈕不該出現。 */
export function inLiff(): boolean {
  return typeof window !== 'undefined' && 'liff' in window
}

/**
 * 用 LINE 登入。
 *
 * 流程：LIFF SDK 拿到 ID token → 丟給 line-auth Edge Function →
 * 那邊拿 channel secret 跟 LINE 驗證、建立或找出對應的 Supabase 使用者、
 * 回一組 session → 這裡把 session 設進 client。
 *
 * 沒設定時直接丟明確的錯誤，不要靜靜失敗——按了沒反應比報錯更難查。
 */
/**
 * 把 Edge Function 的錯誤變成看得懂的一句話。
 *
 * supabase-js 遇到非 2xx 會丟 FunctionsHttpError，它的 message 是固定的
 * 「Edge Function returned a non-2xx status code」——對排查一點幫助都沒有。
 * 真正的原因在 error.context（那是原始的 Response）的 body 裡。
 */
async function describeFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context
  const fallback = (error as Error)?.message ?? '登入失敗'
  if (!ctx || typeof ctx.text !== 'function') return fallback
  try {
    const raw = await ctx.text()
    const detail = (JSON.parse(raw) as { error?: string })?.error ?? raw
    return detail ? `${ctx.status}：${detail}` : fallback
  } catch {
    return fallback
  }
}

export async function signInWithLine(): Promise<void> {
  if (!isLineConfigured) {
    throw new Error('LINE 登入還沒設定（缺 VITE_LINE_LIFF_ID）')
  }
  if (!inLiff()) {
    throw new Error('LINE 登入只能在 LINE 裡開啟時使用')
  }
  const liff = (window as unknown as { liff: { getIDToken(): string | null } }).liff
  const idToken = liff.getIDToken()
  if (!idToken) throw new Error('拿不到 LINE 的 ID token，請重新開啟')

  const { data, error } = await client().functions.invoke('line-auth', {
    body: { id_token: idToken },
  })
  // supabase-js 只給「Edge Function returned a non-2xx status code」，
  // 真正的原因在回應的 body 裡。不挖出來的話，畫面上永遠只有那句廢話。
  if (error) throw new Error(await describeFunctionError(error))
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('line-auth 沒有回傳 session')
  }
  const { error: setErr } = await client().auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (setErr) throw setErr
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await client().auth.signInWithOAuth({
    provider: 'google',
    // HashRouter 的 # 後面不會被送到 OAuth 提供者，導回來的是乾淨的根路徑
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await client().auth.signOut()
}
