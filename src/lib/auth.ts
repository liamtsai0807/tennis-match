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
import { liffIdToken, liffLoggedIn, liffLogin, liffReady } from './liff.ts'

let session: Session | null = null
const listeners = new Set<(s: Session | null) => void>()

/**
 * 開始渲染畫面之前先解析一次 session。
 * 少了這一步，第一輪 render 會以為沒登入，把已經登入的人閃到登入頁再閃回來。
 */
/**
 * 後端實際開了哪些第三方登入。
 *
 * 為什麼要問：signInWithOAuth() 不會先檢查，它直接把瀏覽器導去 Supabase 的
 * authorize 端點；provider 沒開的話使用者不是看到提示，是**看到一頁 JSON**：
 *   {"code":400,"error_code":"validation_failed","msg":"Unsupported provider..."}
 * 這比按了沒反應更糟——人已經離開 App 了，還不知道發生什麼事。
 *
 * 而且本機 config.toml 開的 provider 不會同步到雲端專案，所以「本機好好的、
 * 上線就壞」是這條路的預設行為。只顯示真的能用的按鈕。
 */
let providers: Record<string, boolean> | null = null

export function isProviderEnabled(name: string): boolean {
  // 問不到就照舊顯示——網路一時失敗不該讓功能消失
  if (providers === null) return true
  return providers[name] === true
}

async function loadProviders(): Promise<void> {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return
  try {
    const res = await fetch(url + '/auth/v1/settings', { headers: { apikey: key } })
    if (!res.ok) return
    const body = await res.json() as { external?: Record<string, boolean> }
    providers = body.external ?? null
  } catch {
    // 維持 null＝照舊顯示
  }
}

export async function initAuth(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  session = data.session
  supabase.auth.onAuthStateChange((_event, next) => {
    session = next
    for (const fn of [...listeners]) fn(next)
  })
  await loadProviders()
}

export function currentSession(): Session | null {
  return session
}

/** 目前登入者的 id。呼叫時一定已經過了 AuthGate，所以拿不到就是程式有問題。 */
/**
 * 目前登入者的 LINE user id，不是用 LINE 登入的就回 null。
 * line-auth 在建立帳號時把它寫進 user_metadata，這裡讀回來——
 * 第一次登入時球友資料還不存在，那一刻綁不上，得靠建立資料時補。
 */
export function currentLineUserId(): string | null {
  const meta = currentSession()?.user?.user_metadata as { line_user_id?: string } | undefined
  return meta?.line_user_id ?? null
}

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

/**
 * LINE 登入這條路現在能不能用。
 *
 * 判斷的是「LIFF 初始化成功了」，不是「在不在 LINE App 裡」——外部瀏覽器
 * 開 LIFF 網址一樣登入得了，只是要多跳一次 LINE 的授權頁。
 *
 * 原本這裡看的是 window 上有沒有 liff 這個屬性，但 SDK 的 script 一載進來
 * 那個屬性就在了，init 還沒跑完就回 true，按下去只會拿到 null token。
 */
export function inLiff(): boolean {
  return liffReady()
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
  if (!liffReady()) {
    throw new Error('LINE 登入還沒準備好，請重新整理再試一次')
  }

  // 還沒登入 LINE 就先去登入。這一步會離開頁面，回來時會再走一次這個流程，
  // 那時候就拿得到 token 了。刻意等到使用者按下按鈕才做——初始化時就自動跳，
  // 會把只想用 Email 或 Google 的人一起綁架走。
  if (!liffLoggedIn()) {
    liffLogin()
    return
  }

  const idToken = liffIdToken()
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
