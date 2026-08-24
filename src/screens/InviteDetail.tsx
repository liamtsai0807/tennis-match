/** ===== InviteDetail.tsx =====
 * 一封邀約的詳情。收到的可以接受／婉拒，送出的可以取消。
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header, Avatar, Empty, KV } from '../components/ui.tsx'
import { BookingReport } from '../components/BookingReport.tsx'
import { useToast } from '../components/Toast.tsx'
import { IconClock, IconPin, IconChevron } from '../components/icons.tsx'
import { useData } from '../lib/useData.ts'
import {
  acceptInvite, cancelInvite, declineInvite, getBooking, getClub, getInvite, getPlayer, myId,
} from '../lib/db.ts'
import { distanceKm, km } from '../lib/geo.ts'
import { friendlyDate, hourRange, money, ntrpLabel, SURFACE_LABEL } from '../lib/format.ts'
import type { Invite } from '../lib/types.ts'

const STATUS_LABEL: Record<Invite['status'], { text: string; cls: string }> = {
  pending: { text: '等待回覆', cls: 'warn' },
  accepted: { text: '約成了', cls: 'ok' },
  declined: { text: '已婉拒', cls: 'danger' },
  cancelled: { text: '已取消', cls: '' },
}

export default function InviteDetail() {
  const { inviteId = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const { data } = useData(async () => {
    const invite = await getInvite(inviteId)
    if (!invite) return { invite: null, club: null, me: null, other: null }
    const otherId = invite.from_id === myId() ? invite.to_id : invite.from_id
    const [club, me, other, booking] = await Promise.all([
      getClub(invite.club_id), getPlayer(myId()), getPlayer(otherId),
      getBooking(invite.booking_id),
    ])
    return { invite, club, me, other, booking }
  }, [inviteId])

  const invite = data?.invite
  if (!invite || !data?.other || !data?.me) {
    return (
      <>
        <Header title="邀約" onBack />
        <div className="page"><Empty emoji="✉️" title="找不到這封邀約" /></div>
      </>
    )
  }

  const { club, other, me, booking } = data
  const incoming = invite.to_id === myId()
  const status = STATUS_LABEL[invite.status]
  const open = invite.status === 'pending'

  async function act(fn: (id: string) => Promise<void>, msg: string, back?: boolean) {
    setBusy(true)
    try {
      await fn(invite!.id)
      toast(msg)
      if (back) nav('/profile', { replace: true })
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Header title={incoming ? '收到的邀約' : '送出的邀約'} onBack />
      <div className="page">
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className={'pill ' + status.cls}>{status.text}</span>
            <small style={{ color: 'var(--ink-3)', fontSize: 12 }}>
              {incoming ? other.name + ' 約你' : '你約 ' + other.name}
            </small>
          </div>

          <Link to={'/player/' + other.id} className="row" style={{ gap: 12 }}>
            <Avatar player={other} />
            <div className="grow" style={{ minWidth: 0 }}>
              <b style={{ fontSize: 17, fontWeight: 800 }}>{other.name}</b>
              <div className="note">{ntrpLabel(other.ntrp)}・{other.district}</div>
            </div>
            <IconChevron size={18} />
          </Link>

          {invite.message && (
            <p className="note" style={{ marginTop: 14, marginBottom: 0, padding: 12, background: 'var(--bg)', borderRadius: 12 }}>
              「{invite.message}」
            </p>
          )}
        </div>

        <div className="card pad" style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 17, fontWeight: 800 }}>{club?.name}</b>
          <div className="stack-s" style={{ marginTop: 10, color: 'var(--ink-2)', fontSize: 13.5 }}>
            <div className="row" style={{ gap: 6 }}>
              <IconClock size={16} />{friendlyDate(invite.date)} {hourRange(invite.hour)}
            </div>
            <div className="row" style={{ gap: 6 }}><IconPin size={16} />{club?.address}</div>
          </div>
          {club && (
            <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {club.surface && <span className="pill">{SURFACE_LABEL[club.surface]}</span>}
              {club.indoor && <span className="pill">室內</span>}
              <span className="pill">你 {km(distanceKm(me, club))}</span>
              <span className="pill">{other.name} {km(distanceKm(other, club))}</span>
            </div>
          )}
        </div>

        <div className="card pad" style={{ marginBottom: 14 }}>
          <KV k="場地費" v={club ? money(club.price_per_hour) + '（現場均分）' : '—'} />
        </div>

        {invite.status === 'accepted' && club && (
          <BookingReport
            invite={invite}
            club={club}
            booking={booking ?? null}
            meId={myId()}
            otherName={other.name}
            busy={busy}
            setBusy={setBusy}
            toast={toast}
          />
        )}

        {open && incoming && (
          <div className="stack-s">
            <button
              className="btn primary block"
              disabled={busy}
              onClick={() => act(acceptInvite, '接受了！記得準時到場')}
            >
              接受邀約
            </button>
            <button
              className="btn danger block"
              disabled={busy}
              onClick={() => act(declineInvite, '已婉拒，場地也退掉了', true)}
            >
              婉拒
            </button>
          </div>
        )}

        {open && !incoming && (
          <button
            className="btn danger block"
            disabled={busy}
            onClick={() => act(cancelInvite, '已取消，場地也退掉了', true)}
          >
            取消邀約
          </button>
        )}

        {invite.status === 'accepted' && (
          <p className="note" style={{ textAlign: 'center', color: 'var(--ok)', fontWeight: 700 }}>
            約成了，{friendlyDate(invite.date)} {hourRange(invite.hour)} 見 🎾
          </p>
        )}

        {open && (
          <p className="note" style={{ textAlign: 'center', marginTop: 14, color: 'var(--ink-3)' }}>
            {incoming
              ? '婉拒的話，對方訂的場地會自動退掉，不會佔著別人的時段。'
              : '對方回覆前場地都幫你留著。取消的話會一起退訂。'}
          </p>
        )}
      </div>
    </>
  )
}
