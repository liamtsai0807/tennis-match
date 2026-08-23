/** ===== supabase.ts ===== */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** 兩個環境變數都有填才算設定完成；否則整個 App 走離線示範資料。 */
export const isSupabaseConfigured = Boolean(url && key)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } })
  : null

export const backendLabel = isSupabaseConfigured ? 'Supabase' : '離線示範'

/**
 * 後端是不是跑在這台機器上。用來提醒「信不會真的寄出去」——
 * 本機的 Supabase 內建一個攔信箱（Mailpit），所有登入信都進那裡，
 * 不知道的話會以為信寄丟了，坐在那邊等一封永遠不會來的信。
 */
export const isLocalBackend = /\/\/(127\.0\.0\.1|localhost)\b/.test(url)

/** 本機攔信箱的網址。埠號是 Supabase CLI 的預設值。 */
export const LOCAL_MAILBOX_URL = 'http://127.0.0.1:54324'
