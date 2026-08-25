# TennisPal — 工作目錄說明

手機網頁 App（PWA + LINE LIFF）：**幫人找到程度相近的球伴，約一個對兩個人都方便的球場。**

產品細節看 [README.md](README.md)，規格與決策看 [docs/PRD.html](docs/PRD.html)。
這份只寫「動手改之前必須知道的事」。

---

## 一、現在有兩套環境

| | 網址 | 資料 |
| --- | --- | --- |
| **正式站** | <https://liamtsai0807.github.io/tennis-match/> | 雲端 Supabase `reqsorkruyojhrsjeksu` |
| **本機開發** | <http://localhost:5180> | 本機 Supabase（Docker） |

**正式站的網址是固定的，不會再變。** push 到 `main` 就自動建置部署，約 40 秒上線。
要在 LINE 裡測就直接測正式站——**不需要 cloudflared 隧道了**，那整套已經退場。

版本字串（日期-git 短雜湊）顯示在「我的」頁最下面，也在 `/version.json`，
回報問題時第一個就看那個。

### 本機開發

```bash
open -a Docker && supabase start
```

```bash
npm run dev
```

本機的 `.env` 指向本機 Supabase，所以**開發時不會動到正式資料**。
要改 Edge Function 才需要另外開：

```bash
supabase functions serve --env-file supabase/functions/.env
```

`supabase db reset` 之後即時更新會失效——Kong 抓著舊的上游連線，WebSocket 全回 403：

```bash
docker restart supabase_kong_tennis-pal
```

### 動到雲端的時候

改了 schema：先加 migration，本機 `supabase db reset` 驗過，再
`node --experimental-strip-types tools/gen_deploy_sql.ts`，把
`supabase/deploy_cloud.sql` 貼進雲端 SQL Editor。那一份是冪等的，貼幾次都不會壞，
而且**刻意不含示範球友**——雲端是真人在用的。

改了 Edge Function：`supabase functions deploy`。
改了 LINE 憑證：`supabase secrets set --env-file supabase/functions/.env`。

前端的環境變數在 GitHub repo 的 Settings → Secrets and variables → Actions：
`VITE_SUPABASE_URL`、`VITE_LINE_LIFF_ID` 是 Variables，`VITE_SUPABASE_ANON_KEY` 是 Secret。
**Vite 的環境變數是建置時烤進 bundle 的**，改完要重新部署才會生效。

## 二、這個專案的硬規則

都是踩過才寫下來的，違反其中任何一條都會產生「看起來能動、實際上在騙人」的東西。

### 不知道的事就不要顯示

球場資料大半來自政府開放資料，很多欄位是 `null`，那代表**還不知道**，不是 0。
型別上全部是 `T | null`，畫面必須處理 null，不能用預設值填滿。

已經犯過一次、影響最大的例子：時段表用「球場面數 − TennisPal 的預約數」算剩餘量，
兩個數字都是假的（面數在匯入時一律填 1；預約只是使用者自己記的時段），結果市府系統
訂滿的場顯示「可預約」。**顯示錯的資訊比不顯示更糟。**

現在 `Slot` 只回報 `minePresent` / `othersPresent`，`slotLabel()` 一個字都不碰場館的
實際空位。要改這一塊之前先想清楚：這個數字我們真的查證過嗎？

### 我們永遠訂不到場

全台沒有任何場館提供訂場 API。App 裡的 `bookings` 一直只是「我們自己記著這個時段」，
真正的訂場一定發生在別人的系統裡（`club.booking_url`）或電話裡（`club.phone`）。

任何按鈕的文案都不能讓人以為按了就訂到了。ClubDetail 的主要動作是「到官方系統訂場」
或「打電話訂場」；App 內部那個叫「記下」。

### 不要編造資料

沒有電話就留 `null`，不要填一支沒查證過的號碼。人工查證過的東西放
`src/lib/clubOverrides.ts` 並記 `verified_on`。

### club id 必須穩定

`slugId(開放資料原本的名稱, 地址)`。id 一變，所有人存的偏好球場、既有預約、
邀約全部失效。改顯示名稱走 override，不要動 id。重跑匯入之後要確認 id 沒變。

### 憑證不進 git

`.env`、`supabase/functions/.env` 都在 `.gitignore` 裡。
LIFF ID 和 channel ID 不是機密（會出現在網址裡），access token 和 channel secret 是。

### GoTrue 會把 email 轉小寫

LINE 的 user id 是大寫 `U` 開頭。組內部信箱時一定要 `.toLowerCase()`，
否則第一次註冊寫進去的是小寫、第二次組出來的是大寫，回訪的人再也對不上自己的帳號。
（`line_user_id` 本身要保留原大小寫，推播 API 認的是那個。）

---

## 三、常用指令

| 做什麼 | 指令 |
| --- | --- |
| 測試 | `npm test` |
| 型別檢查 | `npx tsc -b` |
| 建置 | `npm run build` |
| 重匯球場資料 | `node --experimental-strip-types tools/import_clubs.ts <iplay.csv> 臺北市 新北市` |
| 產 seed.sql | `node --experimental-strip-types tools/gen_seed_sql.ts` |
| 產 PWA 圖示 | `node --experimental-strip-types tools/make_icons.ts` |
| 產圖文選單底圖 | `node --experimental-strip-types tools/make_richmenu.ts` |
| 裝圖文選單到 LINE | `node --experimental-strip-types tools/setup_richmenu.ts`（`--dry` 先看） |

球場開放資料每年更新一次，來源
<https://data.gov.tw/dataset/22849>（政府資料開放授權條款第 1 版，要標示來源）。

---

## 四、東西放在哪

```
src/lib/          純邏輯，不碰 UI 也不碰資料庫
  match.ts        媒合演算法（有測試）
  level.ts        三題推算 NTRP（有測試）
  db.ts           唯一的資料進出口。Supabase 與離線兩種實作共用同一組簽名
  clubData.ts     由 import_clubs.ts 產生，不要手改
  clubOverrides.ts 人工查證的修正，可以手改
src/screens/      一個畫面一個檔案
supabase/
  migrations/     只能往前加，不要改已經套用過的
  functions/      Edge Functions（Deno，不是 Node）
tools/            建置期腳本與測試，不會進 bundle
```

**`db.ts` 是唯一的資料進出口。** 畫面不直接碰 Supabase，也不直接碰 localStorage。
沒設定 Supabase 時自動走離線示範資料，兩種實作的函式簽名完全一樣——所以接後端
不需要動任何畫面程式碼。要加資料存取，加在 `db.ts`。

**測試守的是「錯了不會當機、只會默默給錯答案」的東西**：媒合演算法、程度推算、
Flex 訊息結構。改那三塊一定要跑 `npm test`。

---

## 五、目前的狀態

能動的：登錄與偏好、媒合、選球場、送邀約、LINE 登入（LIFF）、推播（Flex）、
圖文選單、PWA 安裝與更新提示、訂場提醒排程（雲端 pg_cron，台北時間每晚九點），
以及 push 到 main 就自動部署。

雲端排程掛在 `cron.job` 的 `booking-reminder`。看執行紀錄：
`select * from cron.job_run_details order by start_time desc limit 10;`

還沒解的：

- **沒有真實的場地空檔**。要誠實回答「哪個場現在有空」，只能去讀官方系統的時段頁
  （21 個台北市體育局的場抓得到）。牽涉爬別人網站的頻率與條款，還沒決定要不要走。
  這是目前最大的產品缺口
- **有三把憑證外流在對話紀錄裡**（LINE access token、LINE channel secret、
  Supabase service_role key），整條路確認正常之後要一次換掉。
  換 service_role 會連 anon key 一起失效，所以同步要做的事：更新 GitHub 的
  `VITE_SUPABASE_ANON_KEY`、重新部署、用新 key 重跑一次 `schedule_booking_reminder`
- **雲端還沒有任何球友**。deploy_cloud.sql 刻意不放假人，所以第一個註冊的人
  會發現媒合是空的——這是對的行為，但要知道
- **推播額度**：LINE 免費方案每月 200 則，一次邀約約用掉 2–3 則
- 本機的登入信不會真的寄出去，全部進 Mailpit（<http://127.0.0.1:54324>）；
  雲端寄信目前走 Supabase 內建服務，每小時只有幾封，上線前要接真的 SMTP
