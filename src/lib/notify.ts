/** ===== notify.ts =====
 * 邀約有動靜時通知對方。
 *
 * 這個產品最大的單點風險是「送出去的邀約沒有人回」——邀約是非同步的，
 * 對方要在別的時間看到它。PRD §10 把「邀約接受率」當核心指標，
 * 沒有推播的話那個指標一定掛，而且掛了還看不出是演算法不準還是沒人看到。
 *
 * 實際推播在 Edge Function 做（channel access token 是機密，不能進前端 bundle）。
 * 這裡只負責「告訴伺服器發生了什麼事」，而且刻意做成不會失敗：
 * 通知送不出去是遺憾，讓送邀約整個失敗才是災難。
 */
import { supabase } from './supabase.ts'

export type NotifyKind = 'invited' | 'accepted' | 'declined' | 'cancelled'

/**
 * 通知是「盡力而為」：任何錯誤都吞掉，只留在 console。
 * 呼叫端不需要 await，也不該因為它失敗而改變流程。
 */
export function notifyInvite(inviteId: string, kind: NotifyKind): void {
  if (!supabase) return // 離線示範模式沒有對方，也沒有伺服器

  void supabase.functions
    .invoke('notify-invite', { body: { invite_id: inviteId, kind } })
    .then(({ data, error }) => {
      if (error) {
        console.warn('[通知] 送不出去', error.message)
        return
      }
      // skipped 是正常狀況：還沒設定 LINE，或對方還沒綁定
      if (data?.skipped) console.info('[通知] 跳過：' + data.skipped)
    })
    .catch((e: unknown) => {
      console.warn('[通知] 送不出去', e)
    })
}
