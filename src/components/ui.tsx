/** ===== ui.tsx =====
 * 跨畫面共用的小零件。刻意都是無狀態的，狀態一律留在畫面層。
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack } from './icons.tsx'
import { initials } from '../lib/format.ts'
import type { Player } from '../lib/types.ts'

export function Avatar({ player, size = 'md' }: { player?: Player | null; size?: 'sm' | 'md' | 'lg' }) {
  const hue = player?.avatar_hue ?? 210
  const cls = 'avatar' + (size === 'md' ? '' : ' ' + size)
  if (!player) return <div className={cls + ' ghost'}>?</div>
  return (
    <div
      className={cls}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 72% 58%), hsl(${hue + 22} 68% 42%))` }}
    >
      {initials(player.name)}
    </div>
  )
}

/** 缺人的位置畫成虛線圈，比寫「還缺 2 人」直覺。 */
export function AvatarStack({ players, slots }: { players: (Player | null)[]; slots: number }) {
  const cells: (Player | null)[] = [...players]
  while (cells.length < slots) cells.push(null)
  return (
    <div className="avatar-stack">
      {cells.slice(0, slots).map((p, i) => (
        <Avatar key={p?.id ?? 'empty-' + i} player={p} size="sm" />
      ))}
    </div>
  )
}

export function Header({
  title, right, onBack,
}: { title?: string; right?: ReactNode; onBack?: boolean }) {
  const nav = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className={'topbar' + (scrolled ? ' scrolled' : '')}>
      {onBack ? (
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回"><IconBack /></button>
      ) : <span />}
      {title ? <h1>{title}</h1> : <div className="wordmark">TENNISPAL</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{right ?? <span />}</div>
    </div>
  )
}

export function Empty({ emoji, title, hint }: { emoji: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="big">{emoji}</div>
      <p style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{title}</p>
      {hint && <p>{hint}</p>}
    </div>
  )
}

export function Sheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  // 面板開著時鎖住背景捲動，否則 iOS 上會捲到底層畫面
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="grabber" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return <div className="kv"><span>{k}</span><b>{v}</b></div>
}
