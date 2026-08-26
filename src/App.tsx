/** ===== App.tsx ===== */
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { Suspense, useEffect, useState } from 'react'
import { ToastProvider } from './components/Toast.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { InstallPrompt } from './components/InstallPrompt.tsx'
import { UpdateBanner } from './components/UpdateBanner.tsx'
import { IconHome, IconSearch, IconPeople, IconUser } from './components/icons.tsx'
import { OFFLINE, isOnboarded } from './lib/db.ts'
import { authReady, useSession } from './lib/auth.ts'
import SignIn from './screens/SignIn.tsx'
import { Loading } from './components/Loading.tsx'
import { lazyScreen } from './lib/lazyScreen.ts'

/*
 * 首屏只帶三個畫面：首頁、球場列表、球場詳情。
 *
 * 那是使用者從圖文選單進來最常落地的地方，也是唯一不需要登入的路徑。
 * 其餘畫面改成用到才載——整包 519 KB 在手機上光解析就要時間，而點進
 * 每一格都要等兩秒以上，其中大半是在等根本還用不到的程式碼。
 */
import Home from './screens/Home.tsx'
import Clubs from './screens/Clubs.tsx'
import ClubDetail from './screens/ClubDetail.tsx'

const Onboarding = lazyScreen('Onboarding', () => import('./screens/Onboarding.tsx'))
const Matchmaker = lazyScreen('Matchmaker', () => import('./screens/Matchmaker.tsx'))
const InviteCompose = lazyScreen('InviteCompose', () => import('./screens/InviteCompose.tsx'))
const InviteDetail = lazyScreen('InviteDetail', () => import('./screens/InviteDetail.tsx'))
const PlayerDetail = lazyScreen('PlayerDetail', () => import('./screens/PlayerDetail.tsx'))
const Profile = lazyScreen('Profile', () => import('./screens/Profile.tsx'))
const Preferences = lazyScreen('Preferences', () => import('./screens/Preferences.tsx'))

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
 * 需要身分的頁面才擋。
 *
 * 原本是整個 App 一道牆：不登入什麼都看不到。那是錯的——圖文選單第一格
 * 寫「找附近球場」，使用者點下去卻拿到登入表單；而球場資料是政府開放
 * 資料，我們也本來就訂不到場，那條路完全不需要帳號。
 *
 * 現在只有真的要「以某個人的身分」做的事才擋：找球伴、邀約、我的。
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession()
  if (OFFLINE) return <>{children}</>
  // session 還在解析時什麼都不要決定。直接顯示 SignIn 的話，已經登入的人
  // 每次冷啟動都會看到登入畫面閃一下——那比多等 0.3 秒更像壞掉。
  if (!authReady()) return <Loading what="確認登入狀態" />
  if (!session) return <SignIn />
  return <>{children}</>
}

/**
 * 只有媒合相關的頁面需要偏好設定。
 *
 * 原本是全站一律導去登錄流程，包含只想看球場的人。但那四步的存在理由
 * 是餵媒合演算法——不找球伴的人，一題都不必回答。
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  // null = 還在問資料庫。這個階段什麼都不導，不然會先閃一次登錄流程
  const [done, setDone] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    const sync = () => {
      isOnboarded()
        .then((d) => { if (alive) setDone(d) })
        .catch(() => { if (alive) setDone(false) })
    }
    sync()
    window.addEventListener('tennispal:changed', sync)
    return () => {
      alive = false
      window.removeEventListener('tennispal:changed', sync)
    }
  }, [])

  // 不要留白。這一步要問資料庫，網路慢或失敗時會停在這裡
  if (done === null) return <Loading what="讀取偏好設定" />
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
          <ErrorBoundary>
            {/* 切出去的畫面在載入時給一塊空白，不要跳版面 */}
            <Suspense fallback={<Loading what="載入畫面" />}>
            <Routes>
              {/* 公開：不需要帳號就能用。球場是政府開放資料，
                  而真正的訂場發生在別人的系統裡，我們只是把人送過去 */}
              <Route path="/" element={<Home />} />
              <Route path="/clubs" element={<Clubs />} />
              <Route path="/clubs/:clubId" element={<ClubDetail />} />

              {/* 要有身分，但不需要填完偏好 */}
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/profile/preferences" element={<RequireAuth><Preferences /></RequireAuth>} />
              <Route path="/player/:playerId" element={<RequireAuth><PlayerDetail /></RequireAuth>} />
              <Route path="/invites/:inviteId" element={<RequireAuth><InviteDetail /></RequireAuth>} />
              <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

              {/* 媒合：要有身分，也要填完偏好——沒有那些資料就媒合不出東西 */}
              <Route path="/match" element={
                <RequireAuth><OnboardingGate><Matchmaker /></OnboardingGate></RequireAuth>} />
              <Route path="/match/:playerId" element={
                <RequireAuth><OnboardingGate><InviteCompose /></OnboardingGate></RequireAuth>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </ErrorBoundary>
          <UpdateBanner />
          <InstallPrompt />
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
