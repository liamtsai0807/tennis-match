/** ===== App.tsx ===== */
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ToastProvider } from './components/Toast.tsx'
import { IconHome, IconSearch, IconPeople, IconUser } from './components/icons.tsx'
import { OFFLINE, isOnboarded } from './lib/db.ts'

import Onboarding from './screens/Onboarding.tsx'
import Home from './screens/Home.tsx'
import Matchmaker from './screens/Matchmaker.tsx'
import InviteCompose from './screens/InviteCompose.tsx'
import InviteDetail from './screens/InviteDetail.tsx'
import Clubs from './screens/Clubs.tsx'
import ClubDetail from './screens/ClubDetail.tsx'
import PlayerDetail from './screens/PlayerDetail.tsx'
import Profile from './screens/Profile.tsx'
import Preferences from './screens/Preferences.tsx'

const TABS = [
  { to: '/', label: '首頁', Icon: IconHome, end: true },
  { to: '/match', label: '找球伴', Icon: IconPeople, end: false },
  { to: '/clubs', label: '球場', Icon: IconSearch, end: false },
  { to: '/profile', label: '我的', Icon: IconUser, end: false },
]

function TabBar() {
  return (
    <nav className="tabbar four">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'on' : '')}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/** 換頁時捲回最上面，不然從長列表點進詳情會停在半空中。 */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/**
 * 還沒填過偏好就一律導到登錄流程。
 * 媒合完全靠那些偏好在運作，沒填的話進到任何頁面都只會看到空畫面。
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const [done, setDone] = useState(isOnboarded())

  useEffect(() => {
    const sync = () => setDone(isOnboarded())
    window.addEventListener('tennispal:changed', sync)
    return () => window.removeEventListener('tennispal:changed', sync)
  }, [])

  if (!done && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  if (done && pathname === '/onboarding') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ScrollToTop />
        <div className="app">
          <OnboardingGate>
            <Routes>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<Home />} />
              <Route path="/match" element={<Matchmaker />} />
              <Route path="/match/:playerId" element={<InviteCompose />} />
              <Route path="/invites/:inviteId" element={<InviteDetail />} />
              <Route path="/clubs" element={<Clubs />} />
              <Route path="/clubs/:clubId" element={<ClubDetail />} />
              <Route path="/player/:playerId" element={<PlayerDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/preferences" element={<Preferences />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </OnboardingGate>
          {OFFLINE && <div className="backend-flag">離線示範模式</div>}
          <TabRegion />
        </div>
      </ToastProvider>
    </HashRouter>
  )
}

/** 登錄流程中不顯示底部導覽——那時候還沒東西可以逛。 */
function TabRegion() {
  const { pathname } = useLocation()
  if (pathname === '/onboarding') return null
  return <TabBar />
}
