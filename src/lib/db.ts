/** ===== db.ts =====
 * 唯一的資料進出口。畫面只認這裡的函式，不直接碰 Supabase 也不直接碰 localStorage。
 * 沒設定 Supabase 時自動退回離線模式，兩邊的函式簽名完全一樣，
 * 之後接上真後端不需要動任何畫面程式碼。
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase.ts'
import { requireUserId } from './auth.ts'
import { CLUBS, COURTS, PLAYERS, SEED_BOOKINGS, SEED_INVITES, ME } from './mockData.ts'
import type { Booking, Club, Court, Invite, Player } from './types.ts'

export const OFFLINE = !isSupabaseConfigured

/**
 * 我是誰。離線模式一直是那個示範使用者；接上 Supabase 之後是登入者的 auth.uid()。
 * 刻意做成函式而不是常數——身分要到登入後才知道，常數在模組載入時就被定死了。
 */
export function myId(): string {
  return OFFLINE ? ME : requireUserId()
}

const KEY = 'tennispal.v2'

/**
 * 只存「使用者產生的」資料，外加我自己的偏好設定。
 * 球場與其他球友屬於參考資料，直接讀常數——否則改了 mockData 卻被舊快取蓋掉，
 * 會 debug 到懷疑人生。
 */
interface LocalStore {
  onboarded: boolean
  me: Player | null          // null = 還沒填過偏好，用 mockData 的預設值
  bookings: Booking[]
  invites: Invite[]
}

function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 9)
}

function seed(): LocalStore {
  const bookings: Booking[] = SEED_BOOKINGS.map((b, i) => ({
    id: 'seed-' + i,
    club_id: b.club_id,
    court_id: b.club_id + '-court-' + b.court,
    user_id: b.user,
    date: b.date,
    hour: b.hour,
    created_at: new Date().toISOString(),
    status: 'confirmed' as const,
  }))
  const invites: Invite[] = SEED_INVITES.map((i) => ({
    ...i,
    created_at: new Date().toISOString(),
  }))
  return { onboarded: false, me: null, bookings, invites }
}

/**
 * 有些環境（沙箱 iframe、無痕模式）會直接擋掉 localStorage，一存取就丟例外。
 * 那種情況退回記憶體，App 照樣能用，只是關掉分頁就忘了。
 */
let memory: string | null = null

function load(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memory
  }
}

function save(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    // 存不進去就算了，至少這一次開啟期間資料還在
  }
  memory = value
}

function read(): LocalStore {
  try {
    const raw = load()
    if (!raw) {
      const fresh = seed()
      save(JSON.stringify(fresh))
      return fresh
    }
    return { ...seed(), ...(JSON.parse(raw) as Partial<LocalStore>) } as LocalStore
  } catch {
    return seed()
  }
}

function write(s: LocalStore) {
  save(JSON.stringify(s))
  window.dispatchEvent(new Event('tennispal:changed'))
}

export function resetDemoData() {
  save(null)
  write(seed())
}

// ---------- 登錄狀態與我的偏好 ----------

/**
 * 有沒有設定過偏好。線上模式的真相在資料庫——換一台裝置登入同一個帳號時，
 * 不該被要求重填一次，而 localStorage 的旗標在那個情境會說謊。
 */
export async function isOnboarded(): Promise<boolean> {
  if (supabase) {
    const { data, error } = await supabase.from('players').select('id').eq('id', myId()).maybeSingle()
    if (error) throw error
    return data !== null
  }
  return read().onboarded
}

/**
 * 剛註冊、還沒填過偏好的人要有一份草稿。借用示範使用者的預設座標與程度區間，
 * 但名字留白——預先填好的話使用者會直接按下一步，然後頂著別人的名字上路。
 */
function blankPlayer(id: string): Player {
  const template = PLAYERS.find((p) => p.id === ME)!
  return {
    ...template,
    id,
    name: '',
    bio: '',
    wins: 0,
    losses: 0,
    level_answers: null,
    // 由 id 推出一個穩定的頭像顏色，不然每個新使用者都長一樣
    avatar_hue: [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7),
  }
}

/** 還沒設定過偏好時回傳草稿而不是 null——畫面才有東西可以編輯。 */
export async function getMe(): Promise<Player> {
  if (supabase) {
    const id = myId()
    const { data, error } = await supabase.from('players').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return (data as Player | null) ?? blankPlayer(id)
  }
  const s = read()
  if (s.me) return s.me
  return PLAYERS.find((p) => p.id === ME)!
}

export async function saveMe(me: Player, markOnboarded = true): Promise<Player> {
  if (supabase) {
    const { data, error } = await supabase.from('players').upsert(me).select().single()
    if (error) throw error
    const s = read()
    s.me = data as Player
    if (markOnboarded) s.onboarded = true
    write(s)
    return data as Player
  }
  const s = read()
  s.me = me
  if (markOnboarded) s.onboarded = true
  write(s)
  return me
}

// ---------- 球場 ----------

export async function listClubs(): Promise<Club[]> {
  if (supabase) {
    const { data, error } = await supabase.from('clubs').select('*').order('rating', { ascending: false })
    if (error) throw error
    return data as Club[]
  }
  return CLUBS
}

export async function getClub(id: string): Promise<Club | null> {
  return (await listClubs()).find((c) => c.id === id) ?? null
}

export async function listCourts(clubId: string): Promise<Court[]> {
  if (supabase) {
    const { data, error } = await supabase.from('courts').select('*').eq('club_id', clubId)
    if (error) throw error
    return data as Court[]
  }
  return COURTS.filter((c) => c.club_id === clubId)
}

// ---------- 球友 ----------

/** 其他球友。我自己的資料一律走 getMe()，避免兩份不同步。 */
export async function listPlayers(): Promise<Player[]> {
  if (supabase) {
    const { data, error } = await supabase.from('players').select('*').neq('id', myId())
    if (error) throw error
    return data as Player[]
  }
  return PLAYERS.filter((p) => p.id !== ME)
}

export async function getPlayer(id: string): Promise<Player | null> {
  if (id === myId()) return getMe()
  return (await listPlayers()).find((p) => p.id === id) ?? null
}

// ---------- 預約 ----------

export interface Slot {
  hour: number
  total: number
  taken: number
  free: number
}

/** 某球館某一天每個整點還剩幾面場。 */
export async function getAvailability(clubId: string, date: string): Promise<Slot[]> {
  const club = await getClub(clubId)
  if (!club) return []
  const courts = await listCourts(clubId)
  const bookings = await bookingsFor(clubId, date)
  const slots: Slot[] = []
  for (let h = club.open_hour; h < club.close_hour; h++) {
    const taken = bookings.filter((b) => b.hour === h && b.status === 'confirmed').length
    slots.push({ hour: h, total: courts.length, taken, free: Math.max(0, courts.length - taken) })
  }
  return slots
}

async function bookingsFor(clubId: string, date: string): Promise<Booking[]> {
  if (supabase) {
    const { data, error } = await supabase.from('bookings').select('*').eq('club_id', clubId).eq('date', date)
    if (error) throw error
    return data as Booking[]
  }
  return read().bookings.filter((b) => b.club_id === clubId && b.date === date)
}

export async function createBooking(input: {
  club_id: string; date: string; hour: number
}): Promise<Booking> {
  const courts = await listCourts(input.club_id)
  const taken = (await bookingsFor(input.club_id, input.date))
    .filter((b) => b.hour === input.hour && b.status === 'confirmed')
    .map((b) => b.court_id)
  const free = courts.find((c) => !taken.includes(c.id))
  if (!free) throw new Error('這個時段已經被訂滿了，換一個時間吧')

  const booking: Booking = {
    id: uid('bk'),
    club_id: input.club_id,
    court_id: free.id,
    user_id: myId(),
    date: input.date,
    hour: input.hour,
    created_at: new Date().toISOString(),
    status: 'confirmed',
  }

  if (supabase) {
    const { data, error } = await supabase.from('bookings').insert(booking).select().single()
    if (error) throw error
    return data as Booking
  }
  const s = read()
  s.bookings.push(booking)
  write(s)
  return booking
}

export async function listMyBookings(): Promise<Booking[]> {
  if (supabase) {
    const { data, error } = await supabase.from('bookings').select('*')
      .eq('user_id', myId()).order('date').order('hour')
    if (error) throw error
    return data as Booking[]
  }
  return read().bookings.filter((b) => b.user_id === ME).sort(byDateHour)
}

export async function cancelBooking(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (error) throw error
    return
  }
  const s = read()
  const b = s.bookings.find((x) => x.id === id)
  if (b) b.status = 'cancelled'
  write(s)
}

function byDateHour(a: { date: string; hour: number }, b: { date: string; hour: number }) {
  return (a.date + String(a.hour).padStart(2, '0')).localeCompare(b.date + String(b.hour).padStart(2, '0'))
}

// ---------- 邀約 ----------

/**
 * 送出邀約 = 先把場地訂下來，再把邀請寄出去。
 * 順序反過來（等對方答應才訂場）常常會撲空，好時段撐不到對方回覆。
 * 對方拒絕的話 declineInvite() 會把場地退掉。
 */
export async function sendInvite(input: {
  to_id: string; club_id: string; date: string; hour: number; message: string
}): Promise<Invite> {
  const booking = await createBooking({
    club_id: input.club_id, date: input.date, hour: input.hour,
  })

  const invite: Invite = {
    id: uid('inv'),
    from_id: myId(),
    to_id: input.to_id,
    club_id: input.club_id,
    booking_id: booking.id,
    date: input.date,
    hour: input.hour,
    message: input.message,
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  if (supabase) {
    const { data, error } = await supabase.from('invites').insert(invite).select().single()
    if (error) {
      // 場地已經訂了但邀約寄不出去，把場地退掉，不要留下孤兒預約
      await cancelBooking(booking.id)
      throw error
    }
    return data as Invite
  }
  const s = read()
  s.invites.unshift(invite)
  write(s)
  return invite
}

export async function listInvites(): Promise<Invite[]> {
  if (supabase) {
    const { data, error } = await supabase.from('invites').select('*')
      .or('from_id.eq.' + myId() + ',to_id.eq.' + myId())
    if (error) throw error
    return (data as Invite[]).sort(byDateHour)
  }
  return read().invites
    .filter((i) => i.from_id === ME || i.to_id === ME)
    .sort(byDateHour)
}

export async function getInvite(id: string): Promise<Invite | null> {
  return (await listInvites()).find((i) => i.id === id) ?? null
}

async function setInviteStatus(id: string, status: Invite['status']): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('invites').update({ status }).eq('id', id)
    if (error) throw error
    return
  }
  const s = read()
  const inv = s.invites.find((x) => x.id === id)
  if (inv) inv.status = status
  write(s)
}

export async function acceptInvite(id: string): Promise<void> {
  await setInviteStatus(id, 'accepted')
}

/** 拒絕或取消時把場地一起退掉，不然球場會被沒人要打的球局佔著。 */
export async function declineInvite(id: string): Promise<void> {
  const inv = await getInvite(id)
  await setInviteStatus(id, 'declined')
  if (inv) await cancelBooking(inv.booking_id)
}

export async function cancelInvite(id: string): Promise<void> {
  const inv = await getInvite(id)
  await setInviteStatus(id, 'cancelled')
  if (inv) await cancelBooking(inv.booking_id)
}

// ---------- 訂閱 ----------

/**
 * 所有訂閱者共用一條 realtime channel，扇出和引用計數自己做。
 *
 * 不能讓每個 useData 各自 client.channel('all-changes')——supabase-js 拿 topic
 * 當快取鍵，第二個呼叫拿到的是同一條、而且已經 subscribe() 過的 channel，
 * 再 .on() 會直接丟 "cannot add postgres_changes callbacks after subscribe()"。
 * 一個畫面只要用兩次 useData 就會踩到（InviteCompose 就是）。
 * 改成每人一條唯一 topic 也不行：channel 數量會隨畫面上的 hook 數膨脹。
 */
const changeListeners = new Set<() => void>()
let changeChannel: RealtimeChannel | null = null

/** 給列表頁用的粗粒度訂閱：任何資料變動都重抓。 */
export function subscribeAll(onChange: () => void): () => void {
  const client = supabase
  if (client) {
    changeListeners.add(onChange)
    if (!changeChannel) {
      changeChannel = client
        .channel('all-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          // 先複製一份再跑，回呼裡退訂不會動到正在迭代的集合
          for (const fn of [...changeListeners]) fn()
        })
        .subscribe()
    }
    return () => {
      changeListeners.delete(onChange)
      // 最後一個訂閱者走了才真的收掉 channel，否則會斷掉還在用的人
      if (changeListeners.size === 0 && changeChannel) {
        client.removeChannel(changeChannel)
        changeChannel = null
      }
    }
  }
  window.addEventListener('tennispal:changed', onChange)
  return () => window.removeEventListener('tennispal:changed', onChange)
}
