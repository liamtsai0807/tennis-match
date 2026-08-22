/** ===== db.ts =====
 * 唯一的資料進出口。畫面只認這裡的函式，不直接碰 Supabase 也不直接碰 localStorage。
 * 沒設定 Supabase 時自動退回離線模式，兩邊的函式簽名完全一樣，所以之後接上真後端
 * 不需要動任何畫面程式碼。
 */
import { supabase, isSupabaseConfigured } from './supabase.ts'
import { CLUBS, COURTS, PLAYERS, OPEN_MATCHES, SEED_BOOKINGS, ME } from './mockData.ts'
import type { Booking, Club, Court, LiveMatch, OpenMatch, Player, ScoreState } from './types.ts'

export { ME }
export const OFFLINE = !isSupabaseConfigured

const KEY = 'tennispal.v1'

/**
 * 只存「使用者產生的」資料。球場與球友屬於參考資料，直接讀常數，
 * 否則改了 mockData 卻被舊快取蓋掉，會debug到懷疑人生。
 */
interface LocalStore {
  bookings: Booking[]
  openMatches: OpenMatch[]
  liveMatches: LiveMatch[]
}

function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 9)
}

function seed(): LocalStore {
  const bookings: Booking[] = SEED_BOOKINGS.map((b, i) => ({
    id: 'seed-' + i,
    club_id: b.club_id,
    court_id: b.club_id + '-court-' + b.court,
    user_id: 'p-other',
    date: b.date,
    hour: b.hour,
    players: 4,
    created_at: new Date().toISOString(),
    status: 'confirmed' as const,
  }))
  return { bookings, openMatches: [...OPEN_MATCHES], liveMatches: [] }
}

function read(): LocalStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const fresh = seed()
      localStorage.setItem(KEY, JSON.stringify(fresh))
      return fresh
    }
    return JSON.parse(raw) as LocalStore
  } catch {
    return seed()
  }
}

function write(s: LocalStore) {
  localStorage.setItem(KEY, JSON.stringify(s))
  channel?.postMessage('changed')
  window.dispatchEvent(new Event('tennispal:changed'))
}

/** 離線模式下也要能「即時分享賽況」：同一台裝置開兩個分頁就能看到比分同步。 */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tennispal') : null
channel?.addEventListener('message', () => window.dispatchEvent(new Event('tennispal:changed')))

export function resetDemoData() {
  localStorage.removeItem(KEY)
  write(seed())
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
  const all = await listClubs()
  return all.find((c) => c.id === id) ?? null
}

export async function listCourts(clubId: string): Promise<Court[]> {
  if (supabase) {
    const { data, error } = await supabase.from('courts').select('*').eq('club_id', clubId)
    if (error) throw error
    return data as Court[]
  }
  return COURTS.filter((c) => c.club_id === clubId)
}

// ---------- 預約 ----------

export interface Slot {
  hour: number
  total: number
  taken: number
  free: number
  minePresent: boolean
}

/** 某球館某一天每個整點還剩幾面場。畫面只需要這個結果，不需要知道細節。 */
export async function getAvailability(clubId: string, date: string): Promise<Slot[]> {
  const club = await getClub(clubId)
  if (!club) return []
  const courts = await listCourts(clubId)
  const bookings = await bookingsFor(clubId, date)
  const slots: Slot[] = []
  for (let h = club.open_hour; h < club.close_hour; h++) {
    const atHour = bookings.filter((b) => b.hour === h && b.status === 'confirmed')
    slots.push({
      hour: h,
      total: courts.length,
      taken: atHour.length,
      free: Math.max(0, courts.length - atHour.length),
      minePresent: atHour.some((b) => b.user_id === ME),
    })
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
  club_id: string; date: string; hour: number; players: number
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
    user_id: ME,
    date: input.date,
    hour: input.hour,
    players: input.players,
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
      .eq('user_id', ME).order('date').order('hour')
    if (error) throw error
    return data as Booking[]
  }
  return read().bookings
    .filter((b) => b.user_id === ME)
    .sort((a, b) => (a.date + String(a.hour).padStart(2, '0')).localeCompare(b.date + String(b.hour).padStart(2, '0')))
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

// ---------- 球伴與開放球局 ----------

export async function listPlayers(): Promise<Player[]> {
  if (supabase) {
    const { data, error } = await supabase.from('players').select('*')
    if (error) throw error
    return data as Player[]
  }
  return PLAYERS
}

export async function getPlayer(id: string): Promise<Player | null> {
  return (await listPlayers()).find((p) => p.id === id) ?? null
}

export async function listOpenMatches(): Promise<OpenMatch[]> {
  if (supabase) {
    const { data, error } = await supabase.from('open_matches').select('*')
      .neq('status', 'cancelled').order('date').order('hour')
    if (error) throw error
    return data as OpenMatch[]
  }
  return read().openMatches
    .filter((m) => m.status !== 'cancelled')
    .sort((a, b) => (a.date + String(a.hour).padStart(2, '0')).localeCompare(b.date + String(b.hour).padStart(2, '0')))
}

export async function getOpenMatch(id: string): Promise<OpenMatch | null> {
  return (await listOpenMatches()).find((m) => m.id === id) ?? null
}

export async function createOpenMatch(input: Omit<OpenMatch, 'id' | 'joined' | 'status' | 'host_id'>): Promise<OpenMatch> {
  const m: OpenMatch = { ...input, id: uid('m'), host_id: ME, joined: [ME], status: 'open' }
  if (supabase) {
    const { data, error } = await supabase.from('open_matches').insert(m).select().single()
    if (error) throw error
    return data as OpenMatch
  }
  const s = read()
  s.openMatches.unshift(m)
  write(s)
  return m
}

/** 加入 / 退出同一個入口，避免兩邊各寫一次名額判斷。 */
export async function toggleJoin(matchId: string): Promise<OpenMatch> {
  const m = await getOpenMatch(matchId)
  if (!m) throw new Error('找不到這場球局')
  const inIt = m.joined.includes(ME)
  if (!inIt && m.joined.length >= m.slots) throw new Error('人已經滿了')
  const joined = inIt ? m.joined.filter((x) => x !== ME) : [...m.joined, ME]
  const status: OpenMatch['status'] = joined.length >= m.slots ? 'full' : 'open'

  if (supabase) {
    const { data, error } = await supabase.from('open_matches')
      .update({ joined, status }).eq('id', matchId).select().single()
    if (error) throw error
    return data as OpenMatch
  }
  const s = read()
  const target = s.openMatches.find((x) => x.id === matchId)!
  target.joined = joined
  target.status = status
  write(s)
  return target
}

export async function cancelOpenMatch(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('open_matches').update({ status: 'cancelled' }).eq('id', id)
    if (error) throw error
    return
  }
  const s = read()
  const m = s.openMatches.find((x) => x.id === id)
  if (m) m.status = 'cancelled'
  write(s)
}

// ---------- 即時賽況 ----------

export async function listLiveMatches(): Promise<LiveMatch[]> {
  if (supabase) {
    const { data, error } = await supabase.from('live_matches').select('*')
      .order('started_at', { ascending: false })
    if (error) throw error
    return data as LiveMatch[]
  }
  return [...read().liveMatches].sort((a, b) => b.started_at.localeCompare(a.started_at))
}

export async function getLiveMatch(id: string): Promise<LiveMatch | null> {
  if (supabase) {
    const { data, error } = await supabase.from('live_matches').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return (data as LiveMatch) ?? null
  }
  return read().liveMatches.find((m) => m.id === id) ?? null
}

export async function createLiveMatch(m: Omit<LiveMatch, 'id'>): Promise<LiveMatch> {
  const full: LiveMatch = { ...m, id: uid('live') }
  if (supabase) {
    const { data, error } = await supabase.from('live_matches').insert(full).select().single()
    if (error) throw error
    return data as LiveMatch
  }
  const s = read()
  s.liveMatches.unshift(full)
  write(s)
  return full
}

export async function updateLiveScore(id: string, state: ScoreState): Promise<void> {
  const finished = state.winner !== null ? new Date().toISOString() : null
  if (supabase) {
    const { error } = await supabase.from('live_matches')
      .update({ state, finished_at: finished }).eq('id', id)
    if (error) throw error
    return
  }
  const s = read()
  const m = s.liveMatches.find((x) => x.id === id)
  if (m) {
    m.state = state
    m.finished_at = finished
  }
  write(s)
}

export async function bumpSpectators(id: string): Promise<void> {
  if (supabase) {
    await supabase.rpc('bump_spectators', { match_id: id })
    return
  }
  const s = read()
  const m = s.liveMatches.find((x) => x.id === id)
  if (m) m.spectators++
  write(s)
}

/**
 * 訂閱一場比賽的比分變化。
 * Supabase 走 Realtime；離線模式走 BroadcastChannel，所以同一台電腦開兩個分頁
 * （一個計分、一個觀戰）就能實際看到即時同步。
 */
export function subscribeLiveMatch(id: string, onChange: (m: LiveMatch) => void): () => void {
  const client = supabase
  if (client) {
    const ch = client
      .channel('live-' + id)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_matches', filter: 'id=eq.' + id },
        (payload) => onChange(payload.new as LiveMatch))
      .subscribe()
    return () => { client.removeChannel(ch) }
  }
  const handler = () => {
    const m = read().liveMatches.find((x) => x.id === id)
    if (m) onChange(m)
  }
  window.addEventListener('tennispal:changed', handler)
  return () => window.removeEventListener('tennispal:changed', handler)
}

/** 給列表頁用的粗粒度訂閱：任何資料變動都重抓。 */
export function subscribeAll(onChange: () => void): () => void {
  const client = supabase
  if (client) {
    const ch = client
      .channel('all-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, onChange)
      .subscribe()
    return () => { client.removeChannel(ch) }
  }
  window.addEventListener('tennispal:changed', onChange)
  return () => window.removeEventListener('tennispal:changed', onChange)
}
