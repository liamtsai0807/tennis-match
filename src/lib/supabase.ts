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

/**
 * 後端的主機名，只給畫面顯示用。
 *
 * 為什麼要露出來：使用者回報「登入失敗」時，最需要先知道的是「你現在連的是
 * 哪一個後端、跑的是哪一版」。少了這兩個資訊，同一句錯誤訊息可能來自
 * 正式站、來自本機、或來自某個活在 service worker 快取裡的舊版本，
 * 而三者的修法完全不同。曾經為此追了很久。
 */
export const backendHost = (() => {
  try { return url ? new URL(url).host : '離線' } catch { return '網址無效' }
})()

/** 本機攔信箱的網址。埠號是 Supabase CLI 的預設值。 */
export const LOCAL_MAILBOX_URL = 'http://127.0.0.1:54324'
