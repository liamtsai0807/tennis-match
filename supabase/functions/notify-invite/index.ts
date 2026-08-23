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

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push'

type Kind = 'invited' | 'accepted' | 'declined' | 'cancelled'

const WORDING: Record<Kind, (who: string) => { title: string; body: string }> = {
  invited: (who) => ({ title: '有人約你打球', body: `${who} 想跟你約一場` }),
  accepted: (who) => ({ title: '約成了', body: `${who} 接受了你的邀約` }),
  declined: (who) => ({ title: '對方婉拒了', body: `${who} 這次不方便，場地已經退掉` }),
  cancelled: (who) => ({ title: '邀約取消了', body: `${who} 取消了這場，場地已經退掉` }),
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

Deno.serve(async (req) => {
  // 瀏覽器會先送 preflight，擋掉的話前端連呼叫都呼叫不到
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  let payload: { invite_id?: string; kind?: Kind }
  try {
    payload = await req.json()
  } catch {
    return json({ error: '請求不是合法的 JSON' }, 400)
  }
  const { invite_id, kind } = payload
  if (!invite_id || !kind || !(kind in WORDING)) {
    return json({ error: '缺少 invite_id 或 kind' }, 400)
  }

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

  const { data: people } = await admin
    .from('players').select('id, name, line_user_id').in('id', [toId, fromId])
  const to = people?.find((p) => p.id === toId)
  const from = people?.find((p) => p.id === fromId)

  const note = async (status: string, detail: string) => {
    await admin.from('notifications').insert({
      id: `n-${invite_id}-${kind}-${crypto.randomUUID().slice(0, 8)}`,
      invite_id, to_id: toId, kind, channel: 'line', status, detail,
    })
  }

  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  if (!token) {
    await note('skipped', '尚未設定 LINE_CHANNEL_ACCESS_TOKEN')
    return json({ ok: true, skipped: '尚未設定 LINE' })
  }
  if (!to?.line_user_id) {
    await note('skipped', '收件人還沒綁定 LINE')
    return json({ ok: true, skipped: '收件人還沒綁定 LINE' })
  }

  const { title, body } = WORDING[kind](from?.name ?? '對方')
  const res = await fetch(LINE_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: to.line_user_id,
      // altText 是通知列與不支援 Flex 的環境會看到的字，一定要自己讀得懂
      messages: [{ type: 'text', text: `${title}\n${body}` }],
    }),
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
