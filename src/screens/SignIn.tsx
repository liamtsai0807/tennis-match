/** ===== SignIn.tsx =====
 * 登入。Q1 決定第一版走 Google + Email。
 *
 * Email 這條路用六位數驗證碼而不是魔術連結：連結會把人踢出 App 去信箱、
 * 再從信件跳回來，手機上這一趟很容易就回不來。驗證碼可以直接在 App 裡打完。
 */
import { useState } from 'react'
import { useToast } from '../components/Toast.tsx'
import { inLiff, isLineConfigured, sendEmailCode, signInWithGoogle, signInWithLine, verifyEmailCode } from '../lib/auth.ts'
import { LOCAL_MAILBOX_URL, isLocalBackend } from '../lib/supabase.ts'

export default function SignIn() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function send() {
    setBusy(true)
    try {
      await sendEmailCode(email.trim())
      setSent(true)
      toast(isLocalBackend ? '驗證碼寄出了，到攔信箱拿' : '驗證碼寄出了，收信看看')
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    try {
      // 成功之後不用自己導頁——auth 狀態一變，AuthGate 就會把 App 放進來
      await verifyEmailCode(email.trim(), code.trim())
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function line() {
    setBusy(true)
    try {
      await signInWithLine()
    } catch (e) {
      toast((e as Error).message, 'bad')
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      toast((e as Error).message, 'bad')
      setBusy(false)
    }
  }

  return (
    <div className="page signin">
      <div className="signin-brand">
        <div className="signin-ball">🎾</div>
        <h1>TennisPal</h1>
        <p className="note">找程度相近的球伴，約一個對兩個人都方便的球場。</p>
      </div>

      <div className="card pad stack" style={{ gap: 16 }}>
        {!sent ? (
          <>
            <div className="field">
              <label>你的 Email</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button className="btn primary block" disabled={!emailOk || busy} onClick={send}>
              {busy ? '寄送中…' : '寄驗證碼給我'}
            </button>
          </>
        ) : (
          <>
            <div className="field">
              <label>輸入信裡的六位數驗證碼</label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="otp"
              />
            </div>
            <button className="btn primary block" disabled={code.length !== 6 || busy} onClick={verify}>
              {busy ? '驗證中…' : '登入'}
            </button>
            <p className="note" style={{ textAlign: 'center', margin: 0 }}>
              寄到 {email}
              {' · '}
              <button className="linklike" onClick={() => { setSent(false); setCode('') }}>換一個信箱</button>
            </p>

            {/* 本機的信一封都不會離開這台機器，不講的話會等一封永遠不來的信 */}
            {isLocalBackend && (
              <p className="signin-devnote">
                本機開發模式：信不會真的寄出去，全部被攔在
                {' '}
                <a href={LOCAL_MAILBOX_URL} target="_blank" rel="noreferrer">攔信箱</a>
                {' '}裡，驗證碼去那邊拿。
              </p>
            )}
          </>
        )}
      </div>

      <div className="signin-or"><span>或</span></div>

      {/*
        LINE 登入只在「設定好了」而且「真的在 LINE 裡開啟」時才出現。
        在一般瀏覽器顯示這顆按鈕，按下去只會得到一句錯誤——那比沒有更糟。
      */}
      {isLineConfigured && inLiff() && (
        <button className="btn block signin-line" disabled={busy} onClick={line}>
          用 LINE 登入
        </button>
      )}

      <button className="btn block signin-google" disabled={busy} onClick={google}>
        用 Google 帳號登入
      </button>

      <p className="note signin-terms">
        登入即表示你同意我們保存你填的偏好設定，用來媒合球伴。
        位置只存到行政區，不會顯示你的確切位置給其他人。
      </p>
    </div>
  )
}
