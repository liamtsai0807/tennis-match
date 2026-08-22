# TennisPal 網球夥伴

手機網頁 App（PWA），做一件事：**幫你找到程度相近的球伴，約一個對兩個人都方便的球場打球。**

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

要換成真的可以多人共用的後端，接 Supabase：

1. 去 <https://supabase.com> 開一個免費專案
2. 進 SQL Editor，先貼 [supabase/schema.sql](supabase/schema.sql) 執行，再貼 [supabase/seed.sql](supabase/seed.sql) 執行
3. 專案設定裡複製 Project URL 與 anon public key
4. 把 `.env.example` 複製成 `.env`，兩個值填進去
5. 重跑 `npm run dev`

**不用改任何畫面程式碼。** 所有資料進出都集中在 [src/lib/db.ts](src/lib/db.ts)，
線上與離線兩種實作共用同一組函式簽名。

`schema.sql` 裡有一個 unique index 擋重複訂場——前端的檢查一定有 race condition，
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
  schema.sql     建表 + RLS + Realtime 設定
  seed.sql       由 tools/gen_seed_sql.ts 從 mockData.ts 產生，不要手改
tools/
  match.test.ts        媒合演算法測試
  level.test.ts        程度推算測試
  gen_seed_sql.ts      產生 seed.sql
  build_single_file.ts 把 build 產物壓成單一 HTML，用來分享原型
  make_icons.ts        產生 PWA 安裝用的 PNG 圖示
```

## 已知限制

- **沒有登入。** 目前寫死一個使用者（`ME = 'p-me'`），「登錄」只是填偏好，
  不是真的註冊。要多人真的用，得接 Supabase Auth，並把 `schema.sql` 註解裡
  那組綁 `auth.uid()` 的 RLS 政策換上去——現在的政策是「誰都能讀寫」，只適合自己玩。
- **對方不會真的回覆。** 示範資料裡有一封別人寄給你的邀約可以按接受／婉拒，
  但你送出去的邀約沒有人會回。要真的能互動得先有帳號系統。
- **距離是直線距離**，不是實際路程。要接路網 API 才算得出路程，
  但拿來排序球場的結果幾乎一樣。
- **真實球館資料。** 九個球館的地址與價格是編的，座標只到行政區中心。
- **沒有付款、沒有推播通知。**

## 之前做過但先拿掉的

即時賽況（完整的網球計分引擎、跨裝置同步比分）做完並通過 24 個測試後，
因為超出目前的使用者故事而移除。程式碼在 commit `eb9aa1a`，需要時可以撿回來。
