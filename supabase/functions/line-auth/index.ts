/** ===== line-auth =====
 * 把 LINE 的 ID token 換成 Supabase 的 session。
 *
 * 為什麼需要這一層：Supabase Auth 的內建 provider 清單裡沒有 LINE
 * （有 apple、google、facebook、line 的鄰居 kakao，就是沒有 line）。
 * LINE 支援 OIDC，所以可以自己驗證它的 ID token，再用 admin API
 * 建立或找出對應的 Supabase 使用者。
 *
 * 這條路不需要 channel secret：LINE 的 verify 端點只要 id_token 加 client_id，
 * 所以整個專案沒有任何地方讀 secret。要設定的只有 LINE_LOGIN_CHANNEL_ID，
 * 而 channel id 跟 LIFF id 都不是機密（LIFF id 本來就會出現在網址裡）。
 *
 * 沒設定 channel 時回明確的錯誤，不要假裝成功——登入靜靜失敗最難查。
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const LINE_VERIFY = 'https://api.line.me/oauth2/v2.1/verify'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const channelId = Deno.env.get('LINE_LOGIN_CHANNEL_ID')
  if (!channelId) return json({ error: '伺服器還沒設定 LINE_LOGIN_CHANNEL_ID' }, 501)

  let idToken: string | undefined
  try {
    idToken = (await req.json())?.id_token
  } catch {
    return json({ error: '請求不是合法的 JSON' }, 400)
  }
  if (!idToken) return json({ error: '缺少 id_token' }, 400)

  // 一定要送 client_id 給 LINE 驗——少了它，別人用自己 channel 簽的 token
  // 也會通過，等於誰都能冒充任何使用者登入
  const verify = await fetch(LINE_VERIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })
  if (!verify.ok) {
    const detail = (await verify.text()).slice(0, 300)
    // 印出來，不然這一步失敗時前端只看得到一個沒有內容的 401
    console.error('[line-auth] LINE 拒絕 id_token', {
      status: verify.status, detail, client_id: channelId,
    })
    return json({ error: 'LINE 不認這個 id_token：' + detail }, 401)
  }
  const profile = await verify.json() as { sub: string; name?: string; email?: string }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // LINE 不保證給 email（使用者可以不授權），所以不能拿 email 當身分。
  // 用 sub（該 channel 專屬的使用者 id）組一個穩定的內部信箱。
  const lineUserId = profile.sub
  const email = `line_${lineUserId}@line.local`

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { provider: 'line', line_user_id: lineUserId, name: profile.name ?? '' },
  })

  let userId = created?.user?.id
  if (createErr) {
    // 已經註冊過就不是錯誤，找出原本那個人
    const { data: list } = await admin.auth.admin.listUsers()
    userId = list?.users.find((u) => u.email === email)?.id
    if (!userId) {
      console.error('[line-auth] 建立使用者失敗且找不到既有帳號', createErr.message)
      return json({ error: createErr.message }, 500)
    }
  }

  // 把 LINE 的使用者 id 記到球友資料上，推播才知道要往哪裡送
  if (userId) {
    await admin.from('players')
      .update({ line_user_id: lineUserId })
      .eq('id', userId)
  }

  // magiclink 只是拿 session 的手段，這封信不會寄出去
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink', email,
  })
  if (linkErr) {
    console.error('[line-auth] generateLink 失敗', linkErr.message)
    return json({ error: linkErr.message }, 500)
  }

  const hashed = link?.properties?.hashed_token
  if (!hashed) {
    console.error('[line-auth] generateLink 沒有回傳 hashed_token')
    return json({ error: '產不出 session' }, 500)
  }

  const anon = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )
  const { data: sess, error: otpErr } = await anon.auth.verifyOtp({
    type: 'magiclink', token_hash: hashed,
  })
  if (otpErr) {
    console.error('[line-auth] verifyOtp 失敗', otpErr.message)
    return json({ error: otpErr.message }, 500)
  }

  return json({
    access_token: sess.session?.access_token,
    refresh_token: sess.session?.refresh_token,
  })
})
