/** ===== OpenMatchDetail.tsx ===== */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header, Avatar, Empty, KV } from '../components/ui.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconClock, IconPin, IconChevron } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import { cancelOpenMatch, getClub, getOpenMatch, listPlayers, toggleJoin, ME } from '../lib/db.ts'
import { friendlyDate, hourRange, money, ntrpLabel, SURFACE_LABEL } from '../lib/format.ts'

export default function OpenMatchDetail() {
  const { matchId = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const { data } = useData(async () => {
    const match = await getOpenMatch(matchId)
    if (!match) return { match: null, club: null, players: [] }
    const [club, players] = await Promise.all([getClub(match.club_id), listPlayers()])
    return { match, club, players }
  }, [matchId])

  const match = data?.match
  const club = data?.club
  if (!match) {
    return (
      <>
        <Header title="球局" onBack />
        <div className="page"><Empty emoji="🎾" title="找不到這場球局" hint="可能已經被取消了" /></div>
      </>
    )
  }

  const iAmIn = match.joined.includes(ME)
  const iAmHost = match.host_id === ME
  const spotsLeft = match.slots - match.joined.length
  const host = data!.players.find((p) => p.id === match.host_id)

  async function onToggle() {
    setBusy(true)
    try {
      await toggleJoin(match!.id)
      toast(iAmIn ? '已退出這場球局' : '加入成功！記得準時到場')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function onCancel() {
    if (!confirm('確定要取消這場球局嗎？已加入的球友會看不到它。')) return
    await cancelOpenMatch(match!.id)
    toast('球局已取消')
    nav('/partners')
  }

  return (
    <>
      <Header title="球局詳情" onBack />
      <div className="page">
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <span className="pill blue">{match.kind === 'singles' ? '單打' : '雙打'}</span>
            <span className="pill">NTRP {match.ntrp_min}–{match.ntrp_max}</span>
            <span className="spacer" />
            {spotsLeft > 0
              ? <span className="pill warn">缺 {spotsLeft} 人</span>
              : <span className="pill ok">人數已滿</span>}
          </div>

          <b style={{ fontSize: 20, fontWeight: 800 }}>{club?.name}</b>
          <div className="stack-s" style={{ marginTop: 10, color: 'var(--ink-2)', fontSize: 13.5 }}>
            <div className="row" style={{ gap: 6 }}><IconClock size={16} />{friendlyDate(match.date)} {hourRange(match.hour)}</div>
            <div className="row" style={{ gap: 6 }}><IconPin size={16} />{club?.address}</div>
          </div>

          {match.note && (
            <p className="note" style={{ marginTop: 14, padding: 12, background: '#f6f7fa', borderRadius: 12 }}>
              「{match.note}」
            </p>
          )}
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>參加的人（{match.joined.length}/{match.slots}）</div>
        <div className="card" style={{ marginBottom: 14 }}>
          {match.joined.map((id) => {
            const p = data!.players.find((x) => x.id === id)
            return (
              <Link key={id} to={'/player/' + id} className="list-row">
                <Avatar player={p} />
                <div className="grow">
                  <b>{p?.name ?? '球友'}{id === ME && '（你）'}</b>
                  <small>{p ? ntrpLabel(p.ntrp) : ''}{id === match.host_id ? '・主揪' : ''}</small>
                </div>
                <IconChevron size={18} />
              </Link>
            )
          })}
          {Array.from({ length: spotsLeft }, (_, i) => (
            <div key={'slot' + i} className="list-row">
              <Avatar />
              <div className="grow">
                <b style={{ color: 'var(--ink-3)', fontWeight: 600 }}>空位</b>
                <small>等人加入</small>
              </div>
            </div>
          ))}
        </div>

        <div className="card pad" style={{ marginBottom: 16 }}>
          <KV k="場地" v={club ? SURFACE_LABEL[club.surface] + (club.indoor ? '・室內' : '・戶外') : '—'} />
          <KV k="場地費" v={club ? money(club.price_per_hour) + ' / 小時（現場均分）' : '—'} />
          <KV k="主揪" v={host?.name ?? '—'} />
        </div>

        {iAmHost ? (
          <div className="stack-s">
            <Link className="btn primary block" to={'/live/new?match=' + match.id}>開始計分</Link>
            <button className="btn danger block" onClick={onCancel}>取消這場球局</button>
          </div>
        ) : (
          <button
            className={'btn block ' + (iAmIn ? 'danger' : 'primary')}
            disabled={busy || (!iAmIn && spotsLeft === 0)}
            onClick={onToggle}
          >
            {iAmIn ? '退出球局' : spotsLeft === 0 ? '人數已滿' : '我要加入'}
          </button>
        )}

        <p className="note" style={{ textAlign: 'center', marginTop: 14, color: 'var(--ink-3)' }}>
          臨時不能到請提早退出，讓位置留給別人。
        </p>
      </div>
    </>
  )
}
