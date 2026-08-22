# TennisPal 網球夥伴

給喜歡打網球的人用的手機網頁 App（PWA）：**訂球場、找球伴、即時分享賽況**。
用手機瀏覽器打開就能用，也可以「加入主畫面」變成像 App 一樣的圖示。

## 跑起來

```bash
npm install
```

```bash
npm run dev
```

打開 <http://localhost:5180>。用電腦看的話，開瀏覽器的手機模式（iPhone 尺寸）比較準。

手機要連的話，`vite.config.ts` 已經開了 `host: true`，
終端機會印出一組 `http://192.168.x.x:5180`，手機連同一個 Wi-Fi 就能開。

## 三個核心功能

**訂球場** — 六個示範球館（硬地／紅土／草地、室內外、有無夜燈）。
選日期 → 選時段 → 確認。每個整點會顯示還剩幾面場，已被訂走或已經過去的時段點不下去。
確認後系統自動配一面沒被佔用的場地。

**找球伴** — 「找球局」是揪團看板，看得到誰主揪、還缺幾人、程度範圍（NTRP）、主揪的留言；
一鍵加入或退出。「找球友」可以照程度篩人，點進去看戰績跟習慣。
自己也可以發起球局。

**即時賽況** — 這是最花工夫的部分。內建一套完整的網球計分引擎：

- 15 / 30 / 40 / deuce / AD 的完整規則
- 一盤 6 局、6:6 進搶七、搶七要贏兩分
- 三盤兩勝，決勝盤可設定打超級搶十（先到 10 分）
- no-ad（平分決勝）賽制
- 發球權輪替，含搶七的 1-2-2-2 換發規則
- 賽末點自動標示
- 「記錯了」可以逐分往回退

計分的人按左右兩個大按鈕記分，**其他人打開同一個連結就會同步看到比分變化**，不用重新整理。

## 資料存在哪

現在是**離線示範模式**：資料存在瀏覽器的 localStorage，畫面右下角會有一個「離線示範」的小標記。
所有流程都是真的能跑完的，只是資料只存在你這台裝置。
即時比分同步在離線模式下走 `BroadcastChannel`——同一台電腦開兩個分頁（一個計分、一個觀戰）就能實際看到效果。

要換成真的可以多人共用的後端，接 Supabase：

1. 去 <https://supabase.com> 開一個免費專案
2. 進 SQL Editor，先貼 [supabase/schema.sql](supabase/schema.sql) 執行，再貼 [supabase/seed.sql](supabase/seed.sql) 執行
3. 專案設定裡複製 Project URL 與 anon public key
4. 把 `.env.example` 複製成 `.env`，兩個值填進去
5. 重跑 `npm run dev`

**不用改任何畫面程式碼。** 所有資料進出都集中在 [src/lib/db.ts](src/lib/db.ts)，
線上與離線兩種實作共用同一組函式簽名。接上之後，即時比分改走 Supabase Realtime。

`schema.sql` 裡有一個 unique index 擋重複訂場——前端的檢查一定會有 race condition，
資料庫這層才擋得住。

## 測試

```bash
npm test
```

24 個測試，全部針對計分引擎（deuce、AD、搶七換發、決勝搶十、悔棋、序列化）。
規則寫錯不會當機、只會默默算錯分，所以這塊一定要有測試守著。

```bash
npx tsc -b
```

## 專案結構

```
src/
  lib/
    types.ts       共用型別，欄位名稱刻意跟資料庫一致
    scoring.ts     網球計分引擎（純函式，不碰 UI 也不碰資料庫）
    db.ts          唯一的資料進出口，Supabase / 離線兩種實作
    supabase.ts    連線設定；環境變數沒填就回傳 null
    mockData.ts    離線示範資料
    format.ts      日期、金額、NTRP 等顯示格式
    useData.ts     取資料 + 訂閱變動的 hook
  components/      共用零件（頭像、比分板、底部面板、Toast、圖示）
  screens/         每個畫面一個檔案
supabase/
  schema.sql       建表 + RLS + Realtime 設定
  seed.sql         由 tools/gen_seed_sql.ts 從 mockData.ts 產生，不要手改
tools/
  scoring.test.ts  計分引擎測試
  gen_seed_sql.ts  產生 seed.sql
```

## 還沒做的

- **登入。** 目前寫死一個使用者（`ME = 'p-me'`）。要多人真的用，得接 Supabase Auth，
  並把 `schema.sql` 註解裡那組綁 `auth.uid()` 的 RLS 政策換上去——現在的政策是「誰都能讀寫」，
  只適合自己玩。
- **付款。** 場地費目前只顯示金額，寫的是現場付款。
- **真實球館資料。** 六個球館是示範用的，地址與價格都是編的。
- **推播通知。** 球局有人加入、比賽開打前提醒，都還沒有。
