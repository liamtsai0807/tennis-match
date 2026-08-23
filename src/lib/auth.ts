/** ===== auth.ts =====
 * 身分只在這裡處理。畫面和 db.ts 都只問「我是誰」，不管背後是 Supabase Auth
 * 還是離線模式那個固定的示範使用者。
 *
 * Q1 決定第一版走 Google + Email，之後要加 LINE Login 時只會動到這個檔案。
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
