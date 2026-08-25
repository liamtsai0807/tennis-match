/** ===== notify-invite =====
 * 邀約有動靜時推播給對方。
 *
 * 為什麼在伺服器端做：LINE 的 channel access token 是機密。前端 bundle 是公開的，
 * 任何人都下載得到，token 放進去等於送給全世界一個可以冒充你發訊息的權限。
 *
 * 沒設定 LINE 的時候不當作錯誤——回 skipped 就好。開發時本來就沒有 token，
 * 而使用者也可能根本沒綁 LINE，那兩種情況都不該讓送邀約失敗。
 *
 * 目前由前端在送出／回覆邀約之後呼叫。之後要硬化的話改成資料庫觸發，
 * 那樣就算使用者按完立刻關掉 App，通知還是送得出去。
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/cors.ts'
import { acceptedFlex, endedFlex, invitedFlex, liffLink } from '../_shared/flex.ts'

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push'

type Kind = 'invited' | 'accepted' | 'declined' | 'cancelled'

/** 「8/29 (六) 19:00–20:00」。伺服器端沒有使用者的時區，日期就照字串處理。 */
function whenText(date: string, hour: number): string {
  const [, m, d] = date.split('-')
  const wd = '日一二三四五六'[new Date(date + 'T00:00:00Z').getUTCDay()]
  const hh = String(hour).padStart(2, '0')
  const nn = String(hour + 1).padStart(2, '0')
  return `${Number(m)}/${Number(d)} (${wd}) ${hh}:00–${nn}:00`
}


Deno.serve(async (req) => {
  // 瀏覽器會先送 preflight，擋掉的話前端連呼叫都呼叫不到
  if (req.method === 'OPTIONS') return corsPreflight()

  let payload: { invite_id?: string; kind?: Kind }
  try {
    payload = await req.json()
  } catch {
    return json({ error: '請求不是合法的 JSON' }, 400)
  }
  const { invite_id, kind } = payload
  if (!invite_id || !kind) return json({ error: '缺少 invite_id 或 kind' }, 400)

  // service role 才讀得到雙方的資料——通知要知道收件人是誰，
  // 而那筆資料在 RLS 底下對呼叫者是看不見的
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: invite, error } = await admin
    .from('invites').select('*').eq('id', invite_id).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!invite) return json({ error: '找不到這筆邀約' }, 404)

  // 誰該收到通知：被邀請的那次通知收件人，其餘都是回報給發起人
  const toId = kind === 'invited' ? invite.to_id : invite.from_id
  const fromId = kind === 'invited' ? invite.from_id : invite.to_id

  const [{ data: people }, { data: club }, { data: booking }] = await Promise.all([
    admin.from('players').select('id, name, ntrp, district, line_user_id').in('id', [toId, fromId]),
    admin.from('clubs').select('name, price_per_hour, booking_url').eq('id', invite.club_id).maybeSingle(),
    admin.from('bookings').select('external_confirmed_at').eq('id', invite.booking_id).maybeSingle(),
  ])
  const to = people?.find((p) => p.id === toId)
  const from = people?.find((p) => p.id === fromId)

  const note = async (status: string, detail: string) => {
    await admin.from('notifications').insert({
      id: `n-${invite_id}-${kind}-${crypto.randomUUID().slice(0, 8)}`,
      invite_id, to_id: toId, kind, channel: 'line', status, detail,
    })
  }

  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  const liffId = Deno.env.get('LINE_LIFF_ID')
  if (!token) {
    await note('skipped', '尚未設定 LINE_CHANNEL_ACCESS_TOKEN')
    return json({ ok: true, skipped: '尚未設定 LINE' })
  }
  if (!to?.line_user_id) {
    await note('skipped', '收件人還沒綁定 LINE')
    return json({ ok: true, skipped: '收件人還沒綁定 LINE' })
  }

  const when = whenText(invite.date, invite.hour)
  const person = { name: from?.name ?? '對方', ntrp: from?.ntrp ?? null, district: from?.district ?? null }
  const clubInfo = { name: club?.name ?? '球場', price_per_hour: club?.price_per_hour ?? null }
  // 沒有 LIFF ID 就連回網頁版，按鈕至少還是能用的
  const inviteUrl = liffId
    ? liffLink(liffId, '/invites/' + invite_id)
    : (Deno.env.get('APP_URL') ?? 'https://liff.line.me') + '/#/invites/' + invite_id

  const message =
    kind === 'invited'
      ? invitedFlex({ from: person, club: clubInfo, whenText: when, message: invite.message ?? '', score: null, inviteUrl })
      : kind === 'accepted'
        ? acceptedFlex({
            other: person, club: clubInfo, whenText: when,
            bookerIsYou: invite.booker_id === toId,
            // 免費又沒有線上系統的場不用訂，不要叫人去做沒有的事
            needsBooking: !booking?.external_confirmed_at && !(club?.price_per_hour === 0 && !club?.booking_url),
            inviteUrl,
          })
        : endedFlex({ other: person, club: clubInfo, whenText: when, cancelled: kind === 'cancelled', inviteUrl })

  const res = await fetch(LINE_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: to.line_user_id, messages: [message] }),
  })

  if (!res.ok) {
    const detail = `LINE 回 ${res.status}：${(await res.text()).slice(0, 200)}`
    await note('failed', detail)
    // 通知送不出去不該讓邀約本身失敗，所以這裡回 200 帶 ok:false
    return json({ ok: false, error: detail })
  }

  await note('sent', '')
  return json({ ok: true })
})
