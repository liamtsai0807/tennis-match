/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * LIFF app 的 id。有值代表 LINE 登入設定好了。
   * 這是設定不是機密（它會出現在 LINE 的網址裡），可以進前端。
   * channel secret 是機密，只放在 Edge Function 的環境變數。
   */
  readonly VITE_LINE_LIFF_ID?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }

/** 由 vite.config.ts 的 define 注入，內容是「日期-git短雜湊」 */
declare const __BUILD__: string
