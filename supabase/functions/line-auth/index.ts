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
import { corsPreflight, json } from '../_shared/cors.ts'

const LINE_VERIFY = 'https://api.line.me/oauth2/v2.1/verify'


/**
 * 這個錯誤代表「這個人以前就註冊過」，也就是回訪，不是失敗。
 * 優先看錯誤代碼，舊版 GoTrue 沒有代碼時退回比對狀態碼與訊息。
 */
function isAlreadyRegistered(err: { code?: string; status?: number; message?: string }): boolean {
  if (err.code === 'email_exists') return true
  return err.status === 422 && /already been registered/i.test(err.message ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight()

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
  //
  // 一定要轉小寫：LINE 的 user id 是大寫 U 開頭，而 GoTrue 存 email 前會轉小寫。
  // 不轉的話，第一次註冊寫進去的是小寫、第二次組出來的是大寫，回訪的人就再也
  // 對不上自己的帳號了。lineUserId 本身要保留原大小寫，推播 API 認的是那個。
  const lineUserId = profile.sub
  const email = `line_${lineUserId}@line.local`.toLowerCase()

  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { provider: 'line', line_user_id: lineUserId, name: profile.name ?? '' },
  })

  // 已經註冊過代表這是回訪，是正常的；其他錯誤才是真的有問題。
  if (createErr && !isAlreadyRegistered(createErr)) {
    console.error('[line-auth] 建立使用者失敗', createErr.message)
    return json({ error: createErr.message }, 500)
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

  // 使用者 id 直接從 session 拿，不必再去翻使用者清單。
  // listUsers() 預設只回前 50 筆，人一多就會翻不到——這裡從源頭避開那個問題。
  const userId = sess.user?.id ?? sess.session?.user?.id
  if (userId) {
    // 把 LINE 的使用者 id 記到球友資料上，推播才知道要往哪裡送
    const { error: linkUserErr } = await admin.from('players')
      .update({ line_user_id: lineUserId })
      .eq('id', userId)
    // 記不起來不該擋住登入，但要留下痕跡，否則推播默默送不出去很難查
    if (linkUserErr) console.error('[line-auth] 綁定 line_user_id 失敗', linkUserErr.message)
  }

  return json({
    access_token: sess.session?.access_token,
    refresh_token: sess.session?.refresh_token,
  })
})
