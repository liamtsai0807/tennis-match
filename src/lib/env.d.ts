/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }

/** 由 vite.config.ts 的 define 注入，內容是「日期-git短雜湊」 */
declare const __BUILD__: string
