/** ===== remind-bookings =====
 * 前一天提醒：約成了、但還沒有人說訂好場。
 *
 * 這是「訂完回報」真正能成立的原因。回報這件事不能靠使用者記得——他按完
 * 「接受邀約」那一刻很興奮，隔天就忘了；而且約好的兩個人常常都在等對方。
 * 所以由系統在開打前問一次，並且給三個出口：去訂、我訂好了、換人訂。
 *
 * 由排程觸發（pg_cron，見 migration）。也可以手動 POST 進來測。
 *
 * 免費而且沒有線上訂場的球場不會提醒——那些場沒人預約的時段就開放自由使用，
 * 提醒他去做一件不存在的事只會讓通知變成雜訊。
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { liffLink, reminderFlex } from '../_shared/flex.ts'

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

function whenText(date: string, hour: number): string {
  const [, m, d] = date.split('-')
  const wd = '日一二三四五六'[new Date(date + 'T00:00:00Z').getUTCDay()]
  return `${Number(m)}/${Number(d)} (${wd}) ${String(hour).padStart(2, '0')}:00`
}

/** 台灣時間的今天與明天。伺服器跑在 UTC，直接用會差八小時、提醒送錯天。 */
function taipeiDates(): { today: string; tomorrow: string } {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const t = new Date(now)
  t.setUTCDate(t.getUTCDate() + 1)
  return { today: iso(now), tomorrow: iso(t) }
}

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  const liffId = Deno.env.get('LINE_LIFF_ID')

  const { tomorrow } = taipeiDates()

  const { data: invites, error } = await admin
    .from('invites')
    .select('*, bookings!inner(external_confirmed_at), clubs!inner(name, price_per_hour, booking_url)')
    .eq('status', 'accepted')
    .eq('date', tomorrow)
  if (error) return json({ error: error.message }, 500)

  const due = (invites ?? []).filter((i: Record<string, unknown>) => {
    const b = i.bookings as { external_confirmed_at: string | null }
    const c = i.clubs as { price_per_hour: number | null; booking_url: string | null }
    if (b?.external_confirmed_at) return false                 // 已經訂好了
    if (c?.price_per_hour === 0 && !c?.booking_url) return false // 這種場不用訂
    return true
  })

  if (due.length === 0) return json({ ok: true, checked: (invites ?? []).length, reminded: 0 })

  const ids = [...new Set(due.flatMap((i) => [i.from_id as string, i.to_id as string]))]
  const { data: people } = await admin
    .from('players').select('id, name, ntrp, district, line_user_id').in('id', ids)

  let sent = 0, skipped = 0, failed = 0
  for (const inv of due) {
    // 只提醒說好要去訂的那一個人。兩個都吵反而更容易兩邊都以為對方會處理。
    const bookerId = (inv.booker_id as string) ?? (inv.from_id as string)
    const otherId = bookerId === inv.from_id ? (inv.to_id as string) : (inv.from_id as string)
    const booker = people?.find((p) => p.id === bookerId)
    const other = people?.find((p) => p.id === otherId)
    const club = inv.clubs as { name: string; price_per_hour: number | null; booking_url: string | null }

    const note = async (status: string, detail: string) => {
      await admin.from('notifications').insert({
        id: `n-${inv.id}-remind-${crypto.randomUUID().slice(0, 8)}`,
        invite_id: inv.id, to_id: bookerId, kind: 'accepted',
        channel: 'line', status, detail,
      })
    }

    if (!token) { skipped++; await note('skipped', '尚未設定 LINE_CHANNEL_ACCESS_TOKEN'); continue }
    if (!booker?.line_user_id) { skipped++; await note('skipped', '收件人還沒綁定 LINE'); continue }

    const inviteUrl = liffId ? liffLink(liffId, '/invites/' + inv.id) : '#'
    const res = await fetch(LINE_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        to: booker.line_user_id,
        messages: [reminderFlex({
          other: { name: other?.name ?? '對方', ntrp: null, district: null },
          club: { name: club.name, price_per_hour: club.price_per_hour },
          whenText: whenText(inv.date as string, inv.hour as number),
          hoursLeft: 24,
          bookerIsYou: true,
          inviteUrl,
          bookingUrl: club.booking_url,
        })],
      }),
    })
    if (res.ok) { sent++; await note('sent', '前一天提醒') }
    else { failed++; await note('failed', `LINE 回 ${res.status}：${(await res.text()).slice(0, 200)}`) }
  }

  return json({ ok: true, date: tomorrow, checked: (invites ?? []).length, due: due.length, sent, skipped, failed })
})
