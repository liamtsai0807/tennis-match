/** ===== icons.tsx =====
 * 全部手寫 SVG，不拉圖示套件——省下一個相依，也讓線條粗細統一。
 */
type P = { size?: number; stroke?: number }

const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', xmlns: 'http://www.w3.org/2000/svg',
})
const line = (w: number) => ({
  stroke: 'currentColor', strokeWidth: w,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
})

export const IconHome = ({ size = 23, stroke = 1.8 }: P) => (
  <svg {...base(size)}>
    <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5V15h-7v5.5H5A1.5 1.5 0 0 1 3.5 19z" {...line(stroke)} />
  </svg>
)

export const IconSearch = ({ size = 23, stroke = 1.8 }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="6.5" {...line(stroke)} />
    <path d="m16 16 4.5 4.5" {...line(stroke)} />
  </svg>
)

export const IconPeople = ({ size = 23, stroke = 1.8 }: P) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8.5" r="3.3" {...line(stroke)} />
    <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" {...line(stroke)} />
    <path d="M16 6.2a3.2 3.2 0 0 1 0 5.6M17 15c2 .6 3.5 2.3 3.5 4.5" {...line(stroke)} />
  </svg>
)

export const IconLive = ({ size = 23, stroke = 1.8 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" {...line(stroke)} />
    <path d="M6.2 6.2a8 8 0 0 0 0 11.6M17.8 17.8a8 8 0 0 0 0-11.6" {...line(stroke)} />
  </svg>
)

export const IconUser = ({ size = 23, stroke = 1.8 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="3.6" {...line(stroke)} />
    <path d="M4.8 20c0-3.4 3.2-5.6 7.2-5.6s7.2 2.2 7.2 5.6" {...line(stroke)} />
  </svg>
)

export const IconBack = ({ size = 23, stroke = 2 }: P) => (
  <svg {...base(size)}><path d="M15 4.5 7.5 12 15 19.5" {...line(stroke)} /></svg>
)

export const IconMenu = ({ size = 22, stroke = 1.9 }: P) => (
  <svg {...base(size)}><path d="M3.5 7h17M3.5 12h17M3.5 17h17" {...line(stroke)} /></svg>
)

export const IconSend = ({ size = 22, stroke = 1.8 }: P) => (
  <svg {...base(size)}><path d="M20.5 3.5 10.8 13.2M20.5 3.5l-6.3 17-3.4-7.3-7.3-3.4z" {...line(stroke)} /></svg>
)

export const IconQr = ({ size = 22, stroke = 1.7 }: P) => (
  <svg {...base(size)}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.6" {...line(stroke)} />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.6" {...line(stroke)} />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.6" {...line(stroke)} />
    <path d="M14 14h3v3h-3zM20.5 14v3M17.5 20.5h3" {...line(stroke)} />
  </svg>
)

export const IconCourt = ({ size = 22, stroke = 1.7 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4.5" width="18" height="15" rx="1.6" {...line(stroke)} />
    <path d="M12 4.5v15M3 12h18M7 4.5v15M17 4.5v15" {...line(stroke)} />
  </svg>
)

export const IconTrophy = ({ size = 22, stroke = 1.7 }: P) => (
  <svg {...base(size)}>
    <path d="M7 4h10v4.5a5 5 0 0 1-10 0z" {...line(stroke)} />
    <path d="M7 5.5H4.5V8a3 3 0 0 0 3 3M17 5.5h2.5V8a3 3 0 0 1-3 3" {...line(stroke)} />
    <path d="M12 13.5V17M8.5 20h7" {...line(stroke)} />
  </svg>
)

export const IconChart = ({ size = 22, stroke = 1.7 }: P) => (
  <svg {...base(size)}>
    <path d="M4 19V5M4 19h16" {...line(stroke)} />
    <path d="m7.5 15 3.5-4 3 2.5 4.5-6" {...line(stroke)} />
  </svg>
)

export const IconStar = ({ size = 22, stroke = 1.7, filled = false }: P & { filled?: boolean }) => (
  <svg {...base(size)}>
    <path
      d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.7l5.4-.8z"
      {...line(stroke)}
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
)

export const IconChevron = ({ size = 20, stroke = 2 }: P) => (
  <svg {...base(size)}><path d="M9 5.5 15.5 12 9 18.5" {...line(stroke)} /></svg>
)

export const IconPlus = ({ size = 22, stroke = 2 }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" {...line(stroke)} /></svg>
)

export const IconUndo = ({ size = 20, stroke = 1.9 }: P) => (
  <svg {...base(size)}>
    <path d="M4 9h9a5 5 0 0 1 0 10h-3" {...line(stroke)} />
    <path d="M7.5 5.5 4 9l3.5 3.5" {...line(stroke)} />
  </svg>
)

export const IconClock = ({ size = 20, stroke = 1.7 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.2" {...line(stroke)} />
    <path d="M12 7.5V12l3 1.8" {...line(stroke)} />
  </svg>
)

export const IconPin = ({ size = 20, stroke = 1.7 }: P) => (
  <svg {...base(size)}>
    <path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z" {...line(stroke)} />
    <circle cx="12" cy="10.5" r="2.4" {...line(stroke)} />
  </svg>
)

export const IconShare = ({ size = 20, stroke = 1.8 }: P) => (
  <svg {...base(size)}>
    <path d="M12 15V4M12 4 8.5 7.5M12 4l3.5 3.5" {...line(stroke)} />
    <path d="M5.5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6.5" {...line(stroke)} />
  </svg>
)
