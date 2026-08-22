/** ===== App.tsx ===== */
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ToastProvider } from './components/Toast.tsx'
import { IconHome, IconSearch, IconPeople, IconLive, IconUser } from './components/icons.tsx'
import { OFFLINE } from './lib/db.ts'

import Home from './screens/Home.tsx'
import Clubs from './screens/Clubs.tsx'
import ClubDetail from './screens/ClubDetail.tsx'
import Partners from './screens/Partners.tsx'
import OpenMatchDetail from './screens/OpenMatchDetail.tsx'
import CreateOpenMatch from './screens/CreateOpenMatch.tsx'
import LiveList from './screens/LiveList.tsx'
import CreateLiveMatch from './screens/CreateLiveMatch.tsx'
import LiveMatchScreen from './screens/LiveMatchScreen.tsx'
import Profile from './screens/Profile.tsx'
import PlayerDetail from './screens/PlayerDetail.tsx'

const TABS = [
  { to: '/', label: '首頁', Icon: IconHome, end: true },
  { to: '/clubs', label: '球場', Icon: IconSearch, end: false },
  { to: '/partners', label: '球伴', Icon: IconPeople, end: false },
  { to: '/live', label: '賽況', Icon: IconLive, end: false },
  { to: '/profile', label: '我的', Icon: IconUser, end: false },
]

function TabBar() {
  return (
    <nav className="tabbar">
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

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollToTop />
        <div className="app">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/clubs/:clubId" element={<ClubDetail />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/partners/new" element={<CreateOpenMatch />} />
            <Route path="/partners/:matchId" element={<OpenMatchDetail />} />
            <Route path="/live" element={<LiveList />} />
            <Route path="/live/new" element={<CreateLiveMatch />} />
            <Route path="/live/:matchId" element={<LiveMatchScreen />} />
            <Route path="/player/:playerId" element={<PlayerDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          {OFFLINE && <div className="backend-flag">離線示範模式</div>}
          <TabBar />
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}
