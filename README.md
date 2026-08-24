# TennisPal 網球夥伴

手機網頁 App（PWA），做一件事：**幫你找到程度相近的球伴，約一個對兩個人都方便的球場打球。**

## 文件

[docs/PRD.html](docs/PRD.html) — 產品需求文件：功能規格、演算法權重、資料模型、
與 TIEPLAYER 的功能對照、上線前必補的缺口與待決事項。
改演算法權重或狀態機時，記得一起改它，否則兩邊會走鐘。

## 使用者故事

> 使用者想找與他程度相當或相近的網球同伴約網球場打球。
> 登錄時可以先設定自己偏好的球場、偏好的時段、偏好的球伴等級。

整個 App 就是這一句話。

## 跑起來

```bash
npm install
```

```bash
npm run dev
```

打開 <http://localhost:5180>。用電腦看的話，開瀏覽器的手機模式（iPhone 尺寸）比較準。
手機要連的話，終端機會印出一組 `http://192.168.x.x:5180`，同一個 Wi-Fi 就能開。

## 流程

**1. 登錄時先設定偏好**（四步，可隨時回頭改）

- 名字 + **三題推算你的程度**（見下）
- 常出沒的行政區、想找的球伴程度區間
- 平常哪幾天、哪個時段有空
- 常去或想去的球場（可複選）

這些不是裝飾用的個人資料，是媒合演算法的輸入。沒填完不會放行到主畫面，
因為偏好是空的話，媒合出來也是空的。

**程度不用自評。** 直接問「你的 NTRP 是多少」的問題是：沒打過分級賽的人
不知道 3.0 和 3.5 差在哪，於是有人虛報有人謙虛——而整個媒合都建立在這個數字上。
改成問三題好回答的，由系統推算：

| 問題 | 在演算法裡的角色 |
| --- | --- |
| 跟程度差不多的人對打，通常能來回幾球？ | **定基準**。問行為不問自我評價，是最可靠的訊號 |
| 打多久了？ | 微調 |
| 多常打？ | 微調，權重是球齡的兩倍 |

對打回合數的四個等級刻意隔開一整級，而練習量只做半級微調——這樣「打了五年但
三球就失誤」不會壓過「打半年但能來回十球還控得住落點」。頻率權重高於年資，
因為每週兩次打半年，打得贏每月一次打五年的。

推算結果夾在 NTRP 2.0–4.5。上限壓在 4.5 是刻意的：再上去的差別（發球威脅、
戰術層次）自評問不出來。真的知道自己分級的人（打過聯賽的）可以點
「我知道自己的 NTRP」直接選。

畫面上顯示的是白話標籤（「能控制球路」），NTRP 數字降級成括號裡的附註。

**2. 找球伴**

選一天 + 一個時段（預設直接吃你填的偏好，多數情況打開就有結果），
系統列出候選人並附上**看得懂的理由**：程度差幾級、有幾個共同常去的球場、
那個時段有沒有空、對方是不是也在找你這個程度。

合適度是四項加權：

| 項目 | 權重 | 為什麼 |
| --- | --- | --- |
| 程度接近 | 0.30 | 程度差太多兩邊都打得不開心，這是網球跟很多運動最大的不同 |
| 共同偏好球場 | 0.25 | 決定「約不約得成」 |
| 那天有空 | 0.25 | 同上 |
| 雙向合適 | 0.10 | 我也在對方想找的範圍內，成功率高很多 |
| 距離 | 0.10 | 已經有共同球場的話，住哪沒那麼要緊 |

程度超出你設定的區間會被濾掉；結果太少時可以一鍵放寬。
那天沒空的人一律排在有空的後面——再合適，約不到也沒用。

**3. 選球場、送出邀約**

球場**不是**依「離你多近」排序，而是對兩個人都方便：

- 兩人都設為常去的球場優先
- 再來看「兩人之中較遠的那一個」要跑多遠，壓低比較倒楣的那一方
- 最後才看公平性（兩人距離差）

每張球場卡都同時顯示你和對方各自要跑多遠。只顧自己的話永遠約在自家門口，
對方跑到厭世就不會想再約第二次。

**4. 成局**

送出邀約的同時就把場地訂下來——好時段撐不到對方回覆。
對方婉拒或你自己取消，那筆預約會**自動退掉**，不會留下沒人要打的孤兒場地。

也可以跳過媒合，直接到「球場」頁自己訂一個場。

## 裝到手機

這是 PWA，不用經過 App Store 或 Play 商店：把 `dist/` 部署到任何支援 HTTPS 的
靜態主機，使用者開連結就能裝到主畫面，有自己的圖示、全螢幕、沒網路也打得開。

### 部署（GitHub Pages，自動）

push 到 `main` 就會自動建置上線，設定在 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)。
測試與型別檢查沒過就不會部署。

第一次要做的設定：

1. 在 GitHub 建一個 repo（Public，或 Private + 付費方案才有 Pages）
2. `git remote add origin <repo 網址>` 然後 `git push -u origin main`
3. repo → Settings → Pages → **Source 選 GitHub Actions**（不要選 Deploy from a branch）
4. Actions 分頁看它跑完，網址是 `https://<帳號>.github.io/<repo 名>/`

之後每次改完 push 就好。要回滾就到 Actions 重跑舊 commit 的 workflow。

想自己建一份來看：

```bash
npm run build
```

產出的 `dist/` 直接部署即可。已經處理好的部分：

- `base: './'` 加上 HashRouter — 部署在網域根目錄或子路徑（`/repo-name/`）都能跑，
  靜態主機不需要任何 rewrite 規則
- `public/manifest.webmanifest` — 名稱、圖示、`display: standalone`、捷徑
- `public/sw.js` — service worker，離線可用。**查快取時必須 `ignoreVary: true`**，
  因為 GitHub Pages、Netlify、Cloudflare 都會回 `Vary` 標頭，而 `caches.match()`
  預設要比對它，離線時請求標頭對不上就會整個失效
- 安裝提示 — Android 接 `beforeinstallprompt` 給一顆安裝鈕；iOS 沒有這個事件，
  改成教使用者按「分享 → 加入主畫面」
- **版本與更新** — 每次建置產生「日期-git短雜湊」，顯示在「我的」頁最下面
  （測試者回報問題時直接看得到是哪一版），同時寫進 `version.json`。
  App 回到前景時比對線上版本，不一樣就跳「有新版本」

  這裡刻意**不**用 service worker 的 waiting 狀態判斷有沒有新版：導覽請求走
  network-first，有網路時冷啟動拿到的本來就是最新的，這時再提示是騙人的；
  而且 `registration.update()` 重抓的是註冊當下那個網址，版本寫在查詢參數裡
  它永遠抓不到新的。真正需要提示的只有「App 常駐在背景好幾天沒重新載入」。

圖示由 `tools/make_icons.ts` 產生（純 Node，沒有繪圖相依）：

```bash
node --experimental-strip-types tools/make_icons.ts
```

**HTTPS 是必要條件**，service worker 在 http 下不會註冊（localhost 例外）。

## 資料存在哪

現在是**離線示範模式**：資料存在瀏覽器的 localStorage，畫面下方有「離線示範」的小標記。
所有流程都能完整跑完，只是資料只存在你這台裝置。

### 登入

接上 Supabase 之後會先要求登入（離線示範模式沒有帳號的概念，直接進 App）。
第一版走 Email 驗證碼與 Google，理由寫在 [PRD §9 Q1](docs/PRD.html)。

**Email 驗證碼**本機開箱可用，但要知道一件事：**信一封都不會離開這台機器**。
本機的 Supabase 內建一個攔信箱（Mailpit），所有登入信都進那裡——
填自己的真實信箱也一樣收不到，登入畫面上有提示連結，或直接開
<http://127.0.0.1:54324> 拿驗證碼。

上線前要接一個真的 SMTP 供應商（SendGrid、Resend、SES 之類）。
Supabase 雲端專案內建的寄信服務每小時只給幾封，官方明講不是給正式環境用的，
設定在 `[auth.email.smtp]`。

**Google 登入**要自己準備一組 OAuth 用戶端才會動：

1. Google Cloud Console 建 OAuth 2.0 用戶端（網頁應用程式）
2. 授權的重新導向 URI 填 `http://127.0.0.1:54321/auth/v1/callback`
3. `export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...` 與 `..._SECRET=...`
4. 把 `supabase/config.toml` 裡 `[auth.external.google]` 的 `enabled` 改成 `true`
5. `supabase stop && supabase start`

沒設定的話，登入畫面上的 Google 按鈕會回一個錯誤訊息，Email 那條路不受影響。

### 搬到 LINE（進行中）

不依賴憑證的部分已經做好了，拿到憑證填進去就會動：

| 檔案 | 做什麼 |
|---|---|
| [supabase/functions/line-auth](supabase/functions/line-auth/index.ts) | LINE 的 ID token 換成 Supabase session |
| [supabase/functions/notify-invite](supabase/functions/notify-invite/index.ts) | 邀約有動靜時推播給對方 |
| [src/lib/notify.ts](src/lib/notify.ts) | 前端這一側，盡力而為、不會讓邀約失敗 |
| [src/lib/auth.ts](src/lib/auth.ts) | `signInWithLine()`、`isLineConfigured`、`inLiff()` |

**還需要你去 LINE Developers 拿的東西**（我拿不到）：

1. 建一個 Provider
2. **Messaging API channel**（推播用）→ Channel access token
3. **LINE Login channel**（登入用）→ Channel ID、Channel secret
4. 在 Login channel 底下建 **LIFF app** → LIFF ID

拿到之後：

```bash
# 前端（LIFF ID 不是機密，會出現在網址裡）
echo 'VITE_LINE_LIFF_ID=你的LIFF_ID' >> .env

# Edge Function（這些是機密，不要進 git）
cat >> supabase/functions/.env <<'ENV'
LINE_CHANNEL_ACCESS_TOKEN=Messaging API 的 token
LINE_LOGIN_CHANNEL_ID=Login channel 的 Channel ID
ENV

supabase functions serve --env-file supabase/functions/.env
```

**沒設定的時候一律乾淨降級**：登入畫面不顯示 LINE 按鈕、推播回
`{"skipped":"尚未設定 LINE"}` 並把原因記進 `notifications` 表，
送邀約本身完全不受影響。

要換成真的可以多人共用的後端，接 Supabase：

1. 去 <https://supabase.com> 開一個免費專案
2. 進 SQL Editor，先貼 [supabase/migrations/20260822000000_init.sql](supabase/migrations/20260822000000_init.sql) 執行，再貼 [supabase/seed.sql](supabase/seed.sql) 執行
3. 專案設定裡複製 Project URL 與 anon public key
4. 把 `.env.example` 複製成 `.env`，兩個值填進去
5. 重跑 `npm run dev`

雲端專案還要做兩件本機已經設好、但不會自動同步過去的事：
Authentication → Providers 開啟 Email 與 Google；
Authentication → Email Templates → Magic Link 換成
[supabase/templates/magic_link.html](supabase/templates/magic_link.html) 的內容，
否則線上寄出去的還是「點我登入」的連結而不是驗證碼。

**不用改任何畫面程式碼。** 所有資料進出都集中在 [src/lib/db.ts](src/lib/db.ts)，
線上與離線兩種實作共用同一組函式簽名。

初始 migration 裡有一個 unique index 擋重複訂場——前端的檢查一定有 race condition，
資料庫這層才擋得住。

## 測試

```bash
npm test
```

33 個測試，分兩份：

- `match.test.ts`（22 個）媒合演算法：距離計算、時段判斷、程度過濾、共同球場加分、
  雙向合適、球場排序的公平性與對稱性
- `level.test.ts`（11 個）程度推算：結果範圍、回合數是否確實主導、
  頻率權重是否高於年資、刻度對齊

這兩塊寫錯都不會當機，只會默默推薦錯的人，所以一定要有測試守著。

```bash
npx tsc -b
```

## 專案結構

```
src/
  lib/
    types.ts       共用型別，欄位名稱刻意跟資料庫一致
    match.ts       媒合演算法（純函式，不碰 UI 也不碰資料庫）
    level.ts       三題推算 NTRP，以及白話的程度標籤
    geo.ts         兩點距離
    db.ts          唯一的資料進出口，Supabase / 離線兩種實作
    supabase.ts    連線設定；環境變數沒填就回傳 null
    mockData.ts    離線示範資料（9 個球館、12 位球友、行政區座標）
    format.ts      日期、金額、NTRP 等顯示格式
    useData.ts     取資料 + 訂閱變動的 hook
  components/
    PreferenceFields.tsx  偏好設定的欄位，登錄流程與設定頁共用
    ui.tsx / icons.tsx / Toast.tsx
  screens/
    Onboarding.tsx    登錄時設定偏好（四步）
    Matchmaker.tsx    找球伴
    InviteCompose.tsx 選球場 + 送出邀約
    InviteDetail.tsx  接受／婉拒／取消
    Clubs.tsx / ClubDetail.tsx   直接訂場
    Profile.tsx / Preferences.tsx / PlayerDetail.tsx / Home.tsx
supabase/
  config.toml    本機 Supabase 的設定（連接埠、seed 路徑…）
  migrations/    建表 + RLS + Realtime 設定，db reset 時依序套用
  seed.sql       由 tools/gen_seed_sql.ts 從 mockData.ts 產生，不要手改
  templates/     登入信範本（給驗證碼，不給連結）
src/lib/
  clubData.ts     真實球場，由 tools/import_clubs.ts 從開放資料產生，不要手改
  clubOverrides.ts 人工查證的結果（修正既有的、補開放資料漏掉的），
                   唯一一份手改的球場資料，匯入時套上去
tools/
  match.test.ts        媒合演算法測試
  level.test.ts        程度推算測試
  gen_seed_sql.ts      產生 seed.sql
  import_clubs.ts      把 iPlay 開放資料轉成 src/lib/clubData.ts
  build_single_file.ts 把 build 產物壓成單一 HTML，用來分享原型
  make_icons.ts        產生 PWA 安裝用的 PNG 圖示
```

## 配色

取自 [HybridClay](https://www.awwwards.com/sites/hybridclay-experience)——紅土球場的產品網站，
Awwwards 2020 Honorable Mention。**取的是方向，不是版型或品牌元素。**

重點不是「哪三個顏色」，是比例。量過原始截圖：

| | 面積 |
|---|---|
| 白 | 70.7% |
| 黑 | 14.5% |
| 灰階過渡 | 7.6% |
| **紅土** | **7.1%** |

紅土是點綴，不是主色。所以這裡刻意沒有滿版漸層：大面積留白，黑色當結構
（底部導覽是黑色而不是強調色），紅土只給主要動作。

紅土分三階，因為對比度撐不住一個值：

| token | 值 | 白字對比 | 用途 |
|---|---|---|---|
| `--clay` | `#df6c4f` | 3.28:1 ❌ | Awwwards 標的品牌色。過不了 AA，只能當裝飾與大字 |
| `--accent-deep` | `#c4522f` | 4.57:1 ✅ | 按鈕底 |
| `--accent` | `#b33819` | 6.01:1 ✅ | 白底上的文字與連結 |

白偏暖（`#faf9f7`），跟紅土同一個色溫才不會打架。頭像與球場卡的漸層也一起
收斂：頭像保留每個人的色相但飽和度壓到 22%，球場卡的色相鎖在 6–28 度。
原本是整個色環隨機取，一張洋紅色的球場卡會比球場本身還搶眼。

## 已知限制

- **信寄不出去，只到本機的攔信箱。** ⚠️ 上線前必補
  本機的 Supabase 內建 Mailpit，登入信全部被攔在 <http://127.0.0.1:54324>，
  填真實信箱一樣收不到。**要真的寄出去，得接一個 SMTP 供應商**
  （SendGrid、Resend、SES 之類），設定在 `supabase/config.toml` 的
  `[auth.email.smtp]`，密碼走環境變數不要進 git。
  雲端 Supabase 內建的寄信服務每小時只給幾封、官方明講不是給正式環境用的，
  真的開放球友註冊一定會撞到上限。
  同時記得把 Dashboard → Authentication → Email Templates → Magic Link
  換成 [supabase/templates/magic_link.html](supabase/templates/magic_link.html)，
  否則線上寄出去的是連結而不是驗證碼。
- **我們不代訂場地。** App 內的「預約」只是內部紀錄，用途是讓你和球伴對得上時間，
  **不會真的把場地訂下來**。台灣沒有任何一家場館提供訂場 API，所以球場詳情頁
  改成放「到官方系統訂場」的深連結（對得上臺北市體育局訂場系統的 10 個場），
  其餘退成「在地圖上開啟」讓使用者自己拿電話。
- **Google 登入要自備 OAuth 用戶端**，步驟在上面〈登入〉那一節。
  沒設定時按下去只會得到錯誤訊息，Email 那條路不受影響。
- **距離是直線距離**，不是實際路程。要接路網 API 才算得出路程，
  但拿來排序球場的結果幾乎一樣。
- **人工查證才剛開始。** 56 個球場裡目前有 **7 個**查證過（臺北市網球中心與六個河濱球場），
  其餘都還是開放資料的原樣。查證結果寫在
  [src/lib/clubOverrides.ts](src/lib/clubOverrides.ts)——那是**唯一一份手改的球場資料**，
  由匯入工具在產生 `clubData.ts` 時套上去。不要直接改 `clubData.ts`，
  它每次重跑都會整份重寫。
- **球館細節未確認。** 球場已經換成真實資料（政府開放資料 iPlay，雙北 54 個
  可租借的網球場館，見 [tools/import_clubs.ts](tools/import_clubs.ts)），
  名稱、地址、經緯度是真的。但**場地材質、夜燈、每小時價格、評分、面數
  開放資料沒有**，一律留 null、畫面上標「細節未確認」，等人工查證後補。
  面數一律先當 1 面，它只影響「這個時段還剩幾面」的模擬。
  另外開放資料本身有雜訊（例如有一筆場館名稱寫「排球場館」但分類是網球場），
  人工那一輪要順便清掉。
- **沒有付款、沒有推播通知。** 邀約是非同步的，對方不知道有人約他就不會回，
  這是上線後最可能讓「邀約接受率」掛掉的原因。

## 之前做過但先拿掉的

即時賽況（完整的網球計分引擎、跨裝置同步比分）做完並通過 24 個測試後，
因為超出目前的使用者故事而移除。程式碼在 commit `eb9aa1a`，需要時可以撿回來。
