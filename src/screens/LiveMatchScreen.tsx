/** ===== LiveMatchScreen.tsx =====
 * 同一個畫面兩種身分：計分者看得到記分按鈕，其他人只看比分。
 * 用 scorer_id 判斷，不做另一條路由，因為兩邊要看到的比分板是同一個。
 */
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Header, Empty } from '../components/ui.tsx'
import { Scoreboard } from '../components/Scoreboard.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconUndo, IconShare } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import {
  bumpSpectators, getLiveMatch, listPlayers, subscribeLiveMatch, updateLiveScore, ME,
} from '../lib/db.ts'
import { awardPoint, formatFinalScore, scoreboard, undoPoint } from '../lib/scoring.ts'
import type { LiveMatch, Player } from '../lib/types.ts'

export default function LiveMatchScreen() {
  const { matchId = '' } = useParams()
  const toast = useToast()
  const [match, setMatch] = useState<LiveMatch | null>(null)
  const counted = useRef(false)

  const { data } = useData(async () => {
    const [m, players] = await Promise.all([getLiveMatch(matchId), listPlayers()])
    return { m, players }
  }, [matchId])

  useEffect(() => { if (data?.m) setMatch(data.m) }, [data?.m])

  // 訂閱比分變化：Supabase 走 Realtime，離線模式走分頁之間的廣播
  useEffect(() => {
    if (!matchId) return
    return subscribeLiveMatch(matchId, (m) => setMatch(m))
  }, [matchId])

  // 觀戰人數一場只加一次，重新整理不重複計
  useEffect(() => {
    if (!match || counted.current || match.scorer_id === ME) return
    counted.current = true
    bumpSpectators(match.id)
  }, [match])

  if (!match) {
    return (
      <>
        <Header title="賽況" onBack />
        <div className="page"><Empty emoji="📣" title="找不到這場比賽" /></div>
      </>
    )
  }

  const players: Player[] = data?.players ?? []
  const isScorer = match.scorer_id === ME
  const sb = scoreboard(match.state, match.format)
  const finished = match.state.winner !== null
  const nameOf = (ids: string[]) =>
    ids.map((id) => players.find((p) => p.id === id)?.name ?? '對手').join(' / ')

  async function point(side: 0 | 1) {
    const next = awardPoint(match!.state, side, match!.format)
    setMatch({ ...match!, state: next })            // 先動畫面，網路慢也不卡手
    await updateLiveScore(match!.id, next)
    if (next.winner !== null) {
      toast(nameOf(next.winner === 0 ? match!.side_a : match!.side_b) + ' 拿下比賽！')
    }
  }

  async function undo() {
    const next = undoPoint(match!.state, match!.format)
    setMatch({ ...match!, state: next })
    await updateLiveScore(match!.id, next)
  }

  async function share() {
    const url = window.location.href
    const text = nameOf(match!.side_a) + ' vs ' + nameOf(match!.side_b) + '　' +
      sb.sets.map((s) => s[0] + '-' + s[1]).join(' ')
    try {
      if (navigator.share) await navigator.share({ title: 'TennisPal 賽況', text, url })
      else {
        await navigator.clipboard.writeText(text + '\n' + url)
        toast('連結已複製，貼給朋友就能看直播比分')
      }
    } catch {
      toast('分享取消')
    }
  }

  return (
    <>
      <Header title={finished ? '賽後回顧' : '即時賽況'} onBack right={
        <button className="icon-btn" onClick={share} aria-label="分享"><IconShare /></button>
      } />
      <div className="page">
        <div className="row between" style={{ marginBottom: 10 }}>
          {finished
            ? <span className="pill ok">已結束</span>
            : <span className="pill live">LIVE</span>}
          <small style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            {match.spectators} 人在看・{isScorer ? '你是計分員' : '觀戰中'}
          </small>
        </div>

        <Scoreboard match={match} players={players} />

        {finished && (
          <div className="card pad" style={{ marginTop: 14, textAlign: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>最終比分</div>
            <b style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.02em' }}>
              {formatFinalScore(match.state)}
            </b>
            <div className="note" style={{ marginTop: 6 }}>
              {nameOf(match.state.winner === 0 ? match.side_a : match.side_b)} 獲勝，
              全場共 {match.state.log.length} 分
            </div>
          </div>
        )}

        {isScorer && !finished && (
          <>
            <div className="eyebrow" style={{ margin: '20px 0 10px' }}>誰得分？</div>
            <div className="scorepad">
              <button onClick={() => point(0)}>
                <small>A 方得分</small>
                <b>{nameOf(match.side_a)}</b>
              </button>
              <button onClick={() => point(1)}>
                <small>B 方得分</small>
                <b>{nameOf(match.side_b)}</b>
              </button>
            </div>
            <button
              className="btn block"
              style={{ marginTop: 12 }}
              disabled={match.state.log.length === 0}
              onClick={undo}
            >
              <IconUndo size={18} /> 記錯了，退回上一分
            </button>
            <p className="note" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-3)' }}>
              按右上角分享，朋友打開連結就能同步看到這個比分。
            </p>
          </>
        )}

        {!isScorer && !finished && (
          <p className="note" style={{ textAlign: 'center', marginTop: 18, color: 'var(--ink-3)' }}>
            比分由 {players.find((p) => p.id === match.scorer_id)?.name ?? '計分員'} 即時更新
          </p>
        )}

        {match.state.log.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '24px 0 10px' }}>逐分紀錄</div>
            <PointHistory match={match} players={players} />
          </>
        )}
      </div>
    </>
  )
}

/** 只顯示最近 12 分，看更久以前的意義不大，也免得畫面太長。 */
function PointHistory({ match, players }: { match: LiveMatch; players: Player[] }) {
  const nameOf = (ids: string[]) =>
    ids.map((id) => players.find((p) => p.id === id)?.name ?? '對手').join(' / ')
  const recent = [...match.state.log].slice(-12).reverse()
  return (
    <div className="card">
      {recent.map((p, i) => (
        <div key={match.state.log.length - i} className="list-row" style={{ padding: '10px 16px' }}>
          <span
            className="pill"
            style={{ background: p.by === 0 ? 'var(--blue-soft)' : '#f0f2f6', minWidth: 34, justifyContent: 'center' }}
          >
            {p.by === 0 ? 'A' : 'B'}
          </span>
          <div className="grow">
            <b style={{ fontSize: 13.5, fontWeight: 600 }} className="truncate">
              {nameOf(p.by === 0 ? match.side_a : match.side_b)} 得分
            </b>
          </div>
          <small style={{ color: 'var(--ink-3)', fontSize: 12 }}>第 {p.setIndex + 1} 盤</small>
        </div>
      ))}
    </div>
  )
}
