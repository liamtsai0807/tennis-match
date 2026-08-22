/** ===== scoring.ts ===== */
import type { MatchFormat, ScoreState } from './types.ts'

export const DEFAULT_FORMAT: MatchFormat = {
  bestOfSets: 3,
  gamesPerSet: 6,
  tiebreakAtGames: 6,
  tiebreakTo: 7,
  noAd: false,
  finalSetSuperTiebreak: true,
}

/** 業餘球友最常打的：一盤 6 局、6:6 搶七。 */
export const QUICK_FORMAT: MatchFormat = {
  ...DEFAULT_FORMAT,
  bestOfSets: 1,
  finalSetSuperTiebreak: false,
}

export function newScore(server: 0 | 1 = 0): ScoreState {
  return {
    sets: [[0, 0]], points: [0, 0], server, firstServer: server,
    inTiebreak: false, winner: null, log: [],
  }
}

/** 一般局的分數顯示。40:40 之後不再往上跳數字，改成 AD。 */
export function displayPoints(state: ScoreState, side: 0 | 1): string {
  if (state.inTiebreak) return String(state.points[side])
  const me = state.points[side]
  const you = state.points[1 - side]
  if (me < 3 || you < 3) return ['0', '15', '30', '40'][Math.min(me, 3)]
  if (me === you) return '40'
  return me > you ? 'AD' : '40'
}

function setsWon(state: ScoreState, format: MatchFormat): [number, number] {
  let a = 0
  let b = 0
  for (let i = 0; i < state.sets.length; i++) {
    const [x, y] = state.sets[i]
    if (isSetOver(x, y, format, isFinalSet(i, format))) {
      if (x > y) a++
      else b++
    }
  }
  return [a, b]
}

function isFinalSet(setIndex: number, format: MatchFormat): boolean {
  return setIndex === format.bestOfSets - 1
}

function isSetOver(a: number, b: number, format: MatchFormat, finalSet: boolean): boolean {
  // 決勝盤打超級搶十時，那一「盤」其實是一局搶十，1:0 就結束。
  if (finalSet && format.finalSetSuperTiebreak && format.bestOfSets > 1) {
    return a >= 1 || b >= 1
  }
  const target = format.gamesPerSet
  const tbAt = format.tiebreakAtGames
  if (a >= target && a - b >= 2) return true
  if (b >= target && b - a >= 2) return true
  // 搶七局本身也算一局，所以 7:6 就是結束
  if (a === tbAt + 1 && b === tbAt) return true
  if (b === tbAt + 1 && a === tbAt) return true
  return false
}

/** 這一盤現在該不該進搶七？決勝盤的超級搶十在第一分就成立。 */
function shouldEnterTiebreak(state: ScoreState, format: MatchFormat): boolean {
  const idx = state.sets.length - 1
  const [a, b] = state.sets[idx]
  if (isFinalSet(idx, format) && format.finalSetSuperTiebreak && format.bestOfSets > 1) {
    return a === 0 && b === 0
  }
  return a === format.tiebreakAtGames && b === format.tiebreakAtGames
}

function tiebreakTarget(state: ScoreState, format: MatchFormat): number {
  const idx = state.sets.length - 1
  if (isFinalSet(idx, format) && format.finalSetSuperTiebreak && format.bestOfSets > 1) return 10
  return format.tiebreakTo
}

/**
 * 判斷這一局有沒有人拿下。回傳贏家或 null。
 * 搶七與一般局的勝負條件不同，所以分開判。
 */
function gameWinner(state: ScoreState, format: MatchFormat): 0 | 1 | null {
  const [a, b] = state.points
  if (state.inTiebreak) {
    const target = tiebreakTarget(state, format)
    if (a >= target && a - b >= 2) return 0
    if (b >= target && b - a >= 2) return 1
    return null
  }
  if (format.noAd) {
    // 平分決勝：雙方都到 3（40:40）之後，下一分直接結束
    if (a >= 4 && b <= 3) return 0
    if (b >= 4 && a <= 3) return 1
    return null
  }
  if (a >= 4 && a - b >= 2) return 0
  if (b >= 4 && b - a >= 2) return 1
  return null
}

/**
 * 發球權輪替。
 * 一般局：每結束一局換人。
 * 搶七：第 1 分後換發，之後每 2 分換一次（1-2-2-2…）。
 */
function serverAfterTiebreakPoint(startServer: 0 | 1, pointsPlayed: number): 0 | 1 {
  const swaps = Math.floor((pointsPlayed + 1) / 2)
  return ((startServer + swaps) % 2) as 0 | 1
}

/** 記一分。永遠回傳新物件，不改動原本的 state，這樣悔棋才好做。 */
export function awardPoint(state: ScoreState, side: 0 | 1, format: MatchFormat): ScoreState {
  if (state.winner !== null) return state

  const next: ScoreState = {
    ...state,
    sets: state.sets.map((s) => [s[0], s[1]] as [number, number]),
    points: [state.points[0], state.points[1]],
    log: [
      ...state.log,
      {
        by: side,
        at: Date.now(),
        setIndex: state.sets.length - 1,
        gameScore: [state.points[0], state.points[1]],
      },
    ],
  }
  next.points[side]++

  const winnerOfGame = gameWinner(next, format)

  if (winnerOfGame === null) {
    if (next.inTiebreak) {
      const played = next.points[0] + next.points[1]
      // 搶七的發球起點就是進搶七當下的發球方
      const startServer = tiebreakStartServer(state)
      next.server = serverAfterTiebreakPoint(startServer, played)
    }
    return next
  }

  // 這一局結束了
  const idx = next.sets.length - 1
  next.sets[idx][winnerOfGame]++
  next.points = [0, 0]
  next.server = (1 - next.server) as 0 | 1
  next.inTiebreak = false

  const [ga, gb] = next.sets[idx]
  if (isSetOver(ga, gb, format, isFinalSet(idx, format))) {
    const [sa, sb] = setsWon(next, format)
    const needed = Math.floor(format.bestOfSets / 2) + 1
    if (sa >= needed) next.winner = 0
    else if (sb >= needed) next.winner = 1
    else next.sets.push([0, 0])
  }

  if (next.winner === null && shouldEnterTiebreak(next, format)) {
    next.inTiebreak = true
    TIEBREAK_START.set(next, next.server)
  }

  return next
}

/**
 * 搶七起始發球方要記住，否則換發計算會錯。
 * 用 WeakMap 而不是塞進 ScoreState，是因為 ScoreState 要能直接 JSON 存進資料庫；
 * 拿不到時（例如從資料庫讀回來）就用局數回推。
 */
const TIEBREAK_START = new WeakMap<ScoreState, 0 | 1>()

function tiebreakStartServer(state: ScoreState): 0 | 1 {
  const remembered = TIEBREAK_START.get(state)
  if (remembered !== undefined) return remembered
  const played = state.points[0] + state.points[1]
  // 從目前發球方與已打分數反推回起始發球方
  const swaps = Math.floor((played + 1) / 2)
  return (((state.server - swaps) % 2 + 2) % 2) as 0 | 1
}

/** 悔棋：把 log 重播到倒數第二分。比就地反推簡單，也不會有邊界錯誤。 */
export function undoPoint(state: ScoreState, format: MatchFormat): ScoreState {
  if (state.log.length === 0) return state
  const replay = state.log.slice(0, -1)
  let s = newScore(state.firstServer)
  for (const p of replay) s = awardPoint(s, p.by, format)
  return s
}

/** 給比分板用的整理結果。 */
export function scoreboard(state: ScoreState, format: MatchFormat) {
  const [sa, sb] = setsWon(state, format)
  return {
    setsWon: [sa, sb] as [number, number],
    sets: state.sets,
    currentSet: state.sets.length - 1,
    points: [displayPoints(state, 0), displayPoints(state, 1)] as [string, string],
    server: state.server,
    inTiebreak: state.inTiebreak,
    winner: state.winner,
    isMatchPoint: isBreakOrMatchPoint(state, format),
  }
}

/** 賽末點提示：試著替雙方各加一分，看會不會直接結束比賽。 */
function isBreakOrMatchPoint(state: ScoreState, format: MatchFormat): 0 | 1 | null {
  if (state.winner !== null) return null
  for (const side of [0, 1] as const) {
    if (awardPoint(state, side, format).winner === side) return side
  }
  return null
}

/** 「6-4 7-5」這種賽後一行式比分。 */
export function formatFinalScore(state: ScoreState): string {
  return state.sets
    .filter(([a, b]) => a + b > 0)
    .map(([a, b]) => a + '-' + b)
    .join(' ')
}
