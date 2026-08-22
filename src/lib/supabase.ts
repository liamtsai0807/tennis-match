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
