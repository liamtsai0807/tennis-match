# TennisPal — 工作目錄說明

手機網頁 App（PWA + LINE LIFF）：**幫人找到程度相近的球伴，約一個對兩個人都方便的球場。**

產品細節看 [README.md](README.md)，規格與決策看 [docs/PRD.html](docs/PRD.html)。
這份只寫「動手改之前必須知道的事」。

---

## 一、先把環境叫起來

**這是最常卡住的地方。** 服務全部是本機的，Mac 重開或 Docker 關掉就全沒了，
而且 LINE 那一側會跟著壞——症狀是圖文選單六格全都打不開。

順序不能顛倒：

```bash
open -a Docker && supabase start
```

```bash
supabase functions serve --env-file supabase/functions/.env
```

```bash
npm run dev
```

要在 LINE 裡測的話，還要兩條 https 隧道（LIFF 只吃 https）：

```bash
cloudflared tunnel --url http://localhost:5180 --edge-ip-version 4 --protocol http2
```

```bash
cloudflared tunnel --url http://localhost:54321 --edge-ip-version 4 --protocol http2
```

`--edge-ip-version 4 --protocol http2` 不是可有可無：預設的 QUIC over IPv6
在這台機器上會週期性斷線，斷的那 40 秒使用者看到的是 Cloudflare 1033。

隧道跑起來之後**每次都要做兩件事**（網址每次重開都會變）：

1. `.env` 的 `VITE_SUPABASE_URL` 換成 54321 那條的網址
2. LINE Developers → Login channel `2011230134` → LIFF → Endpoint URL
   換成 5180 那條的網址

**忘記第 1 件**：App 開得起來但撈不到任何資料。手機上的 `127.0.0.1` 指的是手機
自己，而且 https 頁面呼叫 http 會被當混合內容擋掉。

**忘記第 2 件**：圖文選單六格全部打不開。

拿隧道網址不用去翻終端機，cloudflared 自己有 metrics 端點：

```bash
for pt in $(lsof -nP -iTCP -sTCP:LISTEN | grep -i cloudflar | awk '{print $NF}' | sed 's/.*://'); do curl -s "http://127.0.0.1:$pt/quicktunnel"; echo; done
```

> **這整套的脆弱性是已知的、還沒解的問題。** 真正的出路是把前端部署到
> GitHub Pages（網址固定，LIFF endpoint 永遠不用再改）並改用雲端 Supabase。
> 部署流程已經寫好在 `.github/workflows/deploy.yml`，還沒接上。

`supabase db reset` 之後即時更新會失效——Kong 抓著舊的上游連線，WebSocket 全回 403：

```bash
docker restart supabase_kong_tennis-pal
```

---

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
訂場提醒排程、圖文選單、PWA 安裝與更新提示。

還沒解的：

- **前端沒有固定網址**（見第一節）——這是現在最大的痛點
- **沒有真實的場地空檔**。要誠實回答「哪個場現在有空」，只能去讀官方系統的時段頁
  （21 個台北市體育局的場抓得到）。牽涉爬別人網站的頻率與條款，還沒決定要不要走
- **推播額度**：LINE 免費方案每月 200 則，一次邀約約用掉 2–3 則
- 本機的登入信不會真的寄出去，全部進 Mailpit（<http://127.0.0.1:54324>）
