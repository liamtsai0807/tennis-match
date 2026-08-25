-- ===== deploy_cloud.sql =====
-- 由 tools/gen_deploy_sql.ts 產生，不要手改。
--
-- 用法：Supabase Dashboard → SQL Editor → New query → 整份貼上 → Run。
-- 可以重複執行（migration 都是 if not exists / on conflict do nothing）。
--
-- 內容：9 份 migration + 球場與場地的參考資料。
-- **不含示範球友**——雲端是真人在用的，放假人進去會讓使用者被媒合給
-- 不存在的對象。本機開發要的假球友在 supabase/seed.sql，那一份 db reset 會自動跑。

-- ─────────────────────────────────────────────
-- migrations/20260822000000_init.sql
-- ─────────────────────────────────────────────
-- ===== 初始 schema =====
-- 本機開發：supabase start / supabase db reset 會自動套用這份，接著套 ../seed.sql。
-- 雲端專案：在 SQL Editor 貼上整份執行一次即可。
-- 欄位名稱刻意跟 src/lib/types.ts 一字不差，這樣 db.ts 才能直接 insert 整個物件，
-- 不用做欄位對應。

create table if not exists clubs (
  id              text primary key,
  name            text not null,
  district        text not null,
  address         text not null,
  lat             double precision not null,
  lng             double precision not null,
  surface         text not null check (surface in ('hard','clay','grass')),
  indoor          boolean not null default false,
  lights          boolean not null default true,
  price_per_hour  int  not null,
  rating          numeric(2,1) not null default 4.0,
  photo           text not null default '',
  courts          int  not null,
  open_hour       int  not null default 6,
  close_hour      int  not null default 22
);

create table if not exists courts (
  id       text primary key,
  club_id  text not null references clubs(id) on delete cascade,
  name     text not null
);

-- 球友資料就是偏好設定本身。媒合時要同時看雙方的偏好，
-- 拆成另一張 preferences 表只會讓每次媒合都多一次 join。
create table if not exists players (
  id             text primary key,
  name           text not null,
  avatar_hue     int  not null default 210,
  ntrp           numeric(2,1) not null default 3.0,
  district       text not null default '',
  lat            double precision not null,
  lng            double precision not null,
  hand           text not null default 'right' check (hand in ('right','left')),
  bio            text not null default '',
  wins           int  not null default 0,
  losses         int  not null default 0,
  -- 程度是怎麼來的：null 未設定／'"manual"' 直接選的／三題的作答物件
  -- 存 jsonb 而不是拆成三欄，是因為題目本來就會改版，改版時不用動 schema
  level_answers  jsonb,
  -- { "weekdays": [1,2,3], "blocks": ["evening"] }
  availability   jsonb not null default '{"weekdays":[],"blocks":[]}'::jsonb,
  pref_club_ids  jsonb not null default '[]'::jsonb,
  pref_ntrp_min  numeric(2,1) not null default 2.0,
  pref_ntrp_max  numeric(2,1) not null default 5.5
);

create table if not exists bookings (
  id          text primary key,
  club_id     text not null references clubs(id) on delete cascade,
  court_id    text not null references courts(id) on delete cascade,
  user_id     text not null,
  date        date not null,
  hour        int  not null check (hour between 0 and 23),
  created_at  timestamptz not null default now(),
  status      text not null default 'confirmed' check (status in ('confirmed','cancelled'))
);

-- 同一面場、同一天、同一個整點只能有一筆有效預約。
-- 這是防重複預約的最後一道防線；前端的檢查一定有 race condition，資料庫這層不會。
create unique index if not exists bookings_no_double_book
  on bookings (court_id, date, hour) where status = 'confirmed';

create index if not exists bookings_by_club_date on bookings (club_id, date);

-- 邀約。送出時就把場地訂下來（booking_id），對方拒絕時 App 會把那筆預約一起退掉。
create table if not exists invites (
  id          text primary key,
  from_id     text not null,
  to_id       text not null,
  club_id     text not null references clubs(id) on delete cascade,
  booking_id  text not null references bookings(id) on delete cascade,
  date        date not null,
  hour        int  not null,
  message     text not null default '',
  status      text not null default 'pending'
                check (status in ('pending','accepted','declined','cancelled')),
  created_at  timestamptz not null default now()
);

create index if not exists invites_by_to   on invites (to_id, status);
create index if not exists invites_by_from on invites (from_id, status);

-- 有人接受或婉拒邀約時，對方要馬上看到。
-- 加進 realtime publication。重複加會直接報錯（不像 add column 有 if not exists），
-- 所以先問一下——這份 SQL 會被 deploy_cloud.sql 收進去，而那一份的前提是
-- 「貼幾次都不會壞」。
do $$
declare t text;
begin
  foreach t in array array['invites', 'bookings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 授權：PostgREST 是用 anon（未登入）這個角色連線的，新版 Supabase 不會自動把
-- 新資料表授權給它，少了這段前端一律拿到 42501 permission denied。
-- 這是「這個角色碰得到哪些資料表」，真正的列級存取控制在下面的 RLS policy。
-- ---------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- 球場與球場內的場地是參考資料，只讀。
grant select on clubs, courts to anon, authenticated;

-- 球友檔案、訂場、邀約是使用者會動的資料。
grant select, insert, update, delete on players, bookings, invites to anon, authenticated;

-- ---------------------------------------------------------------
-- RLS：目前 App 還沒接 Supabase Auth，先用「都可讀寫」讓流程跑得起來。
-- 正式上線前務必改成綁 auth.uid()，範例寫在下面註解。
-- ---------------------------------------------------------------
alter table clubs    enable row level security;
alter table courts   enable row level security;
alter table players  enable row level security;
alter table bookings enable row level security;
alter table invites  enable row level security;

create policy "read all clubs"   on clubs    for select using (true);
create policy "read all courts"  on courts   for select using (true);
create policy "rw players"       on players  for all using (true) with check (true);
create policy "rw bookings"      on bookings for all using (true) with check (true);
create policy "rw invites"       on invites  for all using (true) with check (true);

-- 接上 Supabase Auth 之後，換成這樣：
--   drop policy "rw players" on players;
--   create policy "read players" on players for select using (true);
--   create policy "own profile"  on players for update
--     using (id = auth.uid()::text) with check (id = auth.uid()::text);
--
--   drop policy "rw invites" on invites;
--   create policy "read own invites" on invites for select
--     using (from_id = auth.uid()::text or to_id = auth.uid()::text);
--   create policy "send invites" on invites for insert
--     with check (from_id = auth.uid()::text);
--   -- 收件人只能改 status（接受／婉拒），寄件人只能取消
--   create policy "respond to invites" on invites for update
--     using (to_id = auth.uid()::text or from_id = auth.uid()::text);

-- ─────────────────────────────────────────────
-- migrations/20260823000000_auth.sql
-- ─────────────────────────────────────────────
-- ===== 帳號與登入 =====
-- Q1 決定：第一版走 Supabase Auth 內建的 Google + Email。
-- 在這之前 RLS 全是 using (true)——誰都能讀寫任何人的資料，只適合自己玩。
-- 這份把權限綁到 auth.uid()。
--
-- players.id 沿用 text，真實使用者存的就是 auth.uid() 的字串形式。
-- 不改成 uuid + 外鍵指向 auth.users，是因為 seed 的示範球友（p-kai…）沒有
-- 對應的 auth 使用者，加了外鍵它們就進不了資料庫，本機開發和展示時
-- 就沒有任何人可以媒合。

-- ---------------------------------------------------------------
-- players
-- ---------------------------------------------------------------
drop policy if exists "rw players" on players;

-- 要媒合就得看得到別人，所以讀是開放的。
-- 這也是為什麼 players 上不能放聯絡方式之類的欄位。
create policy "read players" on players
  for select using (true);

create policy "insert own profile" on players
  for insert with check (id = auth.uid()::text);

create policy "update own profile" on players
  for update using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- ---------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------
drop policy if exists "rw bookings" on bookings;

-- 訂場畫面要算「這個時段還剩幾面」，就得看得到別人訂的場。
-- 露出的只有佔用狀態，沒有比 user_id 更多的東西。
create policy "read bookings" on bookings
  for select using (true);

create policy "book for self" on bookings
  for insert with check (user_id = auth.uid()::text);

-- 退訂不是只有訂的人會做：對方婉拒邀約時，要退的是「發起人」訂的那面場。
-- 只寫 user_id = auth.uid() 的話，婉拒會靜靜失敗，場地就留在那裡沒人退——
-- 正好違背 §5.5「不會留下孤兒場地」那條。
create policy "cancel own or invited booking" on bookings
  for update using (
    user_id = auth.uid()::text
    or exists (
      select 1 from invites i
      where i.booking_id = bookings.id
        and (i.from_id = auth.uid()::text or i.to_id = auth.uid()::text)
    )
  )
  with check (
    user_id = auth.uid()::text
    or exists (
      select 1 from invites i
      where i.booking_id = bookings.id
        and (i.from_id = auth.uid()::text or i.to_id = auth.uid()::text)
    )
  );

-- ---------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------
drop policy if exists "rw invites" on invites;

-- 邀約只有當事人兩方看得到。別人的約跟你無關。
create policy "read own invites" on invites
  for select using (
    from_id = auth.uid()::text or to_id = auth.uid()::text
  );

create policy "send invites" on invites
  for insert with check (from_id = auth.uid()::text);

-- 收件人接受／婉拒，發起人取消，兩邊做的都是改 status
create policy "respond to invites" on invites
  for update using (
    from_id = auth.uid()::text or to_id = auth.uid()::text
  )
  with check (
    from_id = auth.uid()::text or to_id = auth.uid()::text
  );

-- ─────────────────────────────────────────────
-- migrations/20260823010000_real_clubs.sql
-- ─────────────────────────────────────────────
-- ===== 真實球場資料 =====
-- 球場改用政府開放資料（全國運動場館資訊 iPlay）。
--
-- 開放資料給得起名稱、行政區、地址、經緯度；給不起場地材質、夜燈、
-- 每小時價格、評分。那幾欄改成可以是 null——「還不知道」跟「0 元」
-- 是完全不同的兩件事，用預設值填滿的話使用者會當真，然後帶著錯的資訊跑到球場。

alter table clubs alter column surface        drop not null;
alter table clubs alter column lights         drop not null;
alter table clubs alter column price_per_hour drop not null;
alter table clubs alter column rating         drop not null;

-- 這些 default 是留給人工建檔用的，開放資料匯入時會明確寫 null 覆蓋掉。
-- 留著沒有壞處：省略欄位時仍是合理的起始值。

-- 這筆資料哪裡來的。opendata 代表細節沒有經過人工確認，畫面上要講清楚，
-- 也讓之後人工補完的球場能被標示出來。
alter table clubs add column if not exists source text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clubs_source_check'
  ) then
    alter table clubs add constraint clubs_source_check
      check (source in ('opendata', 'manual'));
  end if;
end $$;

-- ─────────────────────────────────────────────
-- migrations/20260823020000_booking_url.sql
-- ─────────────────────────────────────────────
-- ===== 官方訂場系統的深連結 =====
-- 台灣沒有任何一家場館提供訂場 API。能做的整合裡成本最低、又真的對使用者有用的，
-- 是把人送到官方系統——App 負責媒合（我們的核心賭注），訂場交給已經存在的系統。
--
-- null 代表這個場沒有線上訂場系統，或我們還沒對應到。畫面會退成「在地圖上開啟」。
alter table clubs add column if not exists booking_url text;

-- ─────────────────────────────────────────────
-- migrations/20260823030000_club_verification.sql
-- ─────────────────────────────────────────────
-- ===== 人工查證的欄位 =====
-- 第一個實際跑過人工查證流程的球場是臺北市網球中心，過程中發現兩件事：
--
-- 1. 真實球場的價格幾乎都是分級的。臺北市網球中心室外離峰 300、尖峰 600、
--    室內全日 2000，夜間另收燈光費 200。price_per_hour 一個 int 裝不下，
--    硬塞就變成謊報，所以另開一欄放補充說明；有補充說明時，
--    price_per_hour 代表「最低那一檔」，畫面上標「起」。
--
-- 2. 查證過的資料也會過期。不記日期就不知道哪一筆該重查。
alter table clubs add column if not exists price_note text;
alter table clubs add column if not exists verified_on date;

-- ─────────────────────────────────────────────
-- migrations/20260823040000_notify.sql
-- ─────────────────────────────────────────────
-- ===== 通知：先把「送得到人」這件事在資料層準備好 =====
--
-- 邀約是非同步的：你送出去，對方要在別的時間看到並回覆。沒有推播的話，
-- PRD §10 的「邀約接受率」一定掛——那是這個產品最大的單點風險。
--
-- 推播本身在 Edge Function 做（channel access token 是機密，不能進前端 bundle），
-- 這裡只負責存「這個人要往哪裡推」。

-- ---------------------------------------------------------------
-- service_role 的授權
--
-- 這是先前漏掉的：權限那一份只寫了 grant ... to anon, authenticated。
-- service_role 雖然會繞過 RLS，但 GRANT 是另一回事，沒授權一樣是
-- permission denied。前端都走 anon／authenticated，所以一直沒發現，
-- 直到第一個伺服器端的 Edge Function 要讀 invites 才炸出來。
-- ---------------------------------------------------------------
grant usage on schema public to service_role;
grant all on clubs, courts, players, bookings, invites to service_role;

-- LINE 的使用者 id。null = 這個人還沒綁 LINE，推播就跳過，不是錯誤。
-- 刻意不叫 line_id：LINE 自己把「使用者 id」和「LINE ID」當成兩個不同的東西，
-- 前者是每個 channel 專屬的亂數字串，後者是使用者自己設的帳號名稱。
alter table players add column if not exists line_user_id text;

-- 一個 LINE 使用者只會對應到一個球友。沒有這條，換帳號登入會出現兩個人
-- 共用同一個 LINE 收件匣，通知就會送錯人。
create unique index if not exists players_line_user_id_key
  on players (line_user_id) where line_user_id is not null;

-- 通知紀錄。存下來有三個用途：
--   1. 送失敗時知道是哪一筆、為什麼
--   2. 避免重複送（同一個事件重試時）
--   3. 之後要看「推播到底有沒有提高接受率」時，這是唯一的證據
create table if not exists notifications (
  id          text primary key,
  invite_id   text not null references invites(id) on delete cascade,
  to_id       text not null,
  kind        text not null check (kind in ('invited', 'accepted', 'declined', 'cancelled')),
  channel     text not null,          -- 'line'、之後可能有 'webpush'、'email'
  status      text not null check (status in ('sent', 'skipped', 'failed')),
  detail      text,                   -- 失敗原因或跳過原因，給人看的
  created_at  timestamptz not null default now()
);

create index if not exists notifications_invite_idx on notifications (invite_id);

grant select, insert on notifications to anon, authenticated;
grant all on notifications to service_role;

alter table notifications enable row level security;

-- 只看得到跟自己有關的通知紀錄。寫入一律由 Edge Function 用 service role 做，
-- 所以這裡不開 insert 給一般使用者。
create policy "read own notifications" on notifications
  for select using (to_id = auth.uid()::text);

-- ─────────────────────────────────────────────
-- migrations/20260824000000_external_booking.sql
-- ─────────────────────────────────────────────
-- ===== 訂場回報 =====
--
-- App 內的 booking 一直只是「我們自己記著這個時段」，不是真的訂到場。
-- 台灣沒有任何一家場館提供訂場 API，所以真正的訂場一定發生在別人的系統裡，
-- 只能讓使用者回來說一聲。
--
-- 設計上兩個刻意的決定：
--
-- 1. 主要動作是「我訂好了」一顆按鈕，不是打一串訂單編號。
--    要人抄一串英數字回來，多數人不會做；而我們真正需要知道的只有
--    「訂了沒」這個布林值。編號是選填，現場真的對不上時才用得到。
--
-- 2. 明確記「誰去訂」。約好的兩個人常常都在等對方，沒有這一欄就沒辦法
--    提醒特定的人，只能兩個都吵，那反而更容易兩邊都以為對方會處理。

-- 誰負責去官方系統訂場。預設是發起人——場地和時間是他挑的。
alter table invites add column if not exists booker_id text;

update invites set booker_id = from_id where booker_id is null;

-- 官方那邊訂好的時間。null = 還沒訂，或這個場根本不用訂。
alter table bookings add column if not exists external_confirmed_at timestamptz;

-- 官方系統給的訂單編號，選填。
alter table bookings add column if not exists external_ref text;

-- 回報訂場的人。可能不是原本的 user_id——中途換人去訂是常見的。
alter table bookings add column if not exists external_by text;

-- ─────────────────────────────────────────────
-- migrations/20260824010000_reminder_schedule.sql
-- ─────────────────────────────────────────────
-- ===== 訂場提醒的排程 =====
--
-- 「訂完回報」不能靠使用者記得——按下「接受邀約」那一刻很興奮，隔天就忘了；
-- 而且約好的兩個人常常都在等對方。所以由系統在開打前一天問一次。
--
-- pg_cron 排程 + pg_net 打 HTTP 進 Edge Function。兩個都是 Supabase 內建的擴充。
create extension if not exists pg_cron;
create extension if not exists pg_net;

/*
 * 排程本身不寫死在 migration 裡，因為它需要專案網址與 service role key——
 * 那是機密，不能進 git，而且本機與雲端的值不一樣。
 *
 * 改成提供一個函式，環境準備好之後手動呼叫一次：
 *
 *   本機：
 *     select schedule_booking_reminder(
 *       'http://host.docker.internal:54321/functions/v1/remind-bookings',
 *       '<supabase status 印出來的 service_role key>'
 *     );
 *
 *   雲端：
 *     select schedule_booking_reminder(
 *       'https://<專案ref>.supabase.co/functions/v1/remind-bookings',
 *       '<service role key>'
 *     );
 *
 * 取消：select cron.unschedule('booking-reminder');
 * 看排程：select * from cron.job;
 * 看執行紀錄：select * from cron.job_run_details order by start_time desc limit 10;
 */
create or replace function schedule_booking_reminder(fn_url text, service_key text)
returns void
language plpgsql
security definer
as $$
begin
  -- 重複執行不要爆掉，直接換掉舊的
  perform cron.unschedule('booking-reminder')
  where exists (select 1 from cron.job where jobname = 'booking-reminder');

  -- 台北時間每天晚上九點。cron 跑在 UTC，所以是 13:00。
  -- 挑晚上九點是因為：還來得及訂明天的場，又不會吵到人睡覺。
  perform cron.schedule(
    'booking-reminder',
    '0 13 * * *',
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb
      );$cmd$,
      fn_url, service_key
    )
  );
end;
$$;

comment on function schedule_booking_reminder is
  '設定每天的訂場提醒。需要 Edge Function 的網址與 service role key，'
  '所以不寫死在 migration 裡——那是機密，而且本機與雲端的值不一樣。';

-- ─────────────────────────────────────────────
-- migrations/20260824020000_club_contact.sql
-- ─────────────────────────────────────────────
-- ===== 球場聯絡方式 =====
-- 全台沒有任何場館提供訂場 API，我們永遠代訂不了。所以「訂不到的時候能做什麼」
-- 才是這個畫面真正該解決的問題，而答案就是：一支打得通的電話、一個官方網站。
--
-- 兩欄都來自政府開放資料（全國運動場館資訊 iPlay）本來就有、但當初匯入時
-- 沒有讀進來的欄位——場館實際管理人電話、場館官方網站。雙北 101 個網球場館
-- 這兩欄的覆蓋率是 100%。

alter table clubs add column if not exists phone   text;
alter table clubs add column if not exists website text;

comment on column clubs.phone is
  '場館管理人電話，來自 iPlay 開放資料。null = 開放資料沒給，不要自己編一支。';
comment on column clubs.website is
  '場館官方網站。不保證訂得了場，但查得到公告與休館。';

-- ─────────────────────────────────────────────
-- 參考資料：球場與場地
-- 來源：全國運動場館資訊（iPlay），運動部
--       https://data.gov.tw/dataset/22849
--       政府資料開放授權條款第 1 版
-- ─────────────────────────────────────────────
insert into clubs (id, name, district, address, lat, lng, surface, indoor, lights, price_per_hour, price_note, rating, courts, open_hour, close_hour, photo, source, booking_url, phone, website, verified_on) values
  ('c-105c6hr', '明志國中迎曦廣場(風雨操場)', '新北市三重區', '新北市三重區中正北路107號', 25.064482, 121.489059, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(9 34% 36%),hsl(14 34% 24%) 55%,hsl(18 38% 15%))', 'opendata', null, '02-29844132#318', 'http://www.mcjh.ntpc.edu.tw', null),
  ('c-13ts2co', '排球場館', '新北市三重區', '新北市三重區中正北路163號', 25.069823, 121.479183, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(16 46% 36%),hsl(21 46% 24%) 55%,hsl(25 50% 15%))', 'opendata', null, '02-29715606#303', 'http://www.scvs.ntpc.edu.tw', null),
  ('c-02eb2j8', '新北高中網球場', '新北市三重區', '新北市三重區三信路1號', 25.087455, 121.489794, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(16 40% 36%),hsl(21 40% 24%) 55%,hsl(25 44% 15%))', 'opendata', null, '02-28577326#127', 'http://www.scsh.ntpc.edu.tw', null),
  ('c-17achkz', '土城綜合球場-網球場', '新北市土城區', '新北市土城區 明德路 清水路 交叉口', 24.979221, 121.454374, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(25 34% 36%),hsl(30 34% 24%) 55%,hsl(34 38% 15%))', 'opendata', null, '02-22700177#831', null, null),
  ('c-1e8y3fy', '宏國德霖科技學院網球場(館)', '新北市土城區', '新北市土城區青雲路380巷1號', 24.972287, 121.457537, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(25 46% 36%),hsl(30 46% 24%) 55%,hsl(34 50% 15%))', 'opendata', null, '02-22733567#605', 'http://www.dlit.edu.tw', null),
  ('c-1mxo36s', '中和區錦和運動公園-網球場', '新北市中和區', '新北市中和區錦和路350-1號', 24.993069, 121.487428, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(12 40% 36%),hsl(17 40% 24%) 55%,hsl(21 44% 15%))', 'opendata', null, '02-22482688#430', 'http://www.zhonghe.ntpc.gov.tw/', null),
  ('c-0lmdly4', '秀山國民小學網球場(館)', '新北市中和區', '新北市中和區立人街2號', 24.994499, 121.521792, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(26 52% 36%),hsl(31 52% 24%) 55%,hsl(35 56% 15%))', 'opendata', null, '02-29434353#836', 'http://www.ssps.ntpc.edu.tw', null),
  ('c-1x8ba0z', '綠寶石網球場（永和河濱）', '新北市永和區', '新北市永和區綠寶石公園網球場(新店溪左岸自行車道5.5KM)', 25.018155, 121.509411, null, false, true, 150, '平日每 4 小時 600 元、假日 800 元，未滿 2 小時以半場次計。時段固定兩小時一節：08–10、10–12、13–15、15–17、18–20、20–22。線上申請要先註冊會員，非新北市民也可以註冊。沒有人申請的時段開放現場自由使用。', null, 1, 8, 22, 'linear-gradient(150deg,hsl(26 40% 36%),hsl(31 40% 24%) 55%,hsl(35 44% 15%))', 'manual', 'https://www.hrcm.ntpc.gov.tw/Service/VenueRental/TennisCourtLeaseInst/Detail/綠寶石網球場', '02-89699596#501', 'http://www.rhbd.ntpc.gov.tw/cht/index.php?', '2026-08-23'),
  ('c-0wu26dk', '華僑高級中學網球場(館)', '新北市板橋區', '新北市板橋區大觀路一段32號', 25.006955, 121.446251, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(11 34% 36%),hsl(16 34% 24%) 55%,hsl(20 38% 15%))', 'opendata', null, '02-29684131#341', 'http://www.nocsh.ntpc.edu.tw', null),
  ('c-1swl24q', '新月網球場', '新北市板橋區', '新北市板橋區新月橋與特二橋間網球場(大漢溪右岸自行車道3.75K', 25.024217, 121.449501, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(8 40% 36%),hsl(13 40% 24%) 55%,hsl(17 44% 15%))', 'opendata', null, '02-89699596#501', 'http://www.rhbd.ntpc.gov.tw/cht/index.php?', null),
  ('c-0gejqbn', '林口高中網球場(館)', '新北市林口區', '新北市林口區仁愛路二段173號', 25.072976, 121.380043, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(27 52% 36%),hsl(32 52% 24%) 55%,hsl(36 56% 15%))', 'opendata', null, '02-26009482#302', 'http://www.lksh.ntpc.edu.tw', null),
  ('c-0fk0mr6', '第二運動公園網球場', '新北市林口區', '24462新北市林口區民族路205號', 25.078024, 121.367834, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(15 46% 36%),hsl(20 46% 24%) 55%,hsl(24 50% 15%))', 'opendata', null, '02-26033111#242', null, null),
  ('c-06td8b7', '臺灣師範大學室外網球場', '新北市林口區', '新北市林口區仁愛路一段2號', 25.06939, 121.403024, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(20 46% 36%),hsl(25 46% 24%) 55%,hsl(29 50% 15%))', 'opendata', null, '02-77148466', 'http://www.ntnu.edu.tw', null),
  ('c-0fkdbyh', '文化國小田徑場', '新北市淡水區', '新北市淡水區文化里真理街6號', 25.174053, 121.437963, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(12 52% 36%),hsl(17 52% 24%) 55%,hsl(21 56% 15%))', 'opendata', null, '02-26212031#852', 'http://www.twhps.ntpc.edu.tw', null),
  ('c-0nly2vt', '真理大學體育館', '新北市淡水區', '新北市淡水區真理街32號', 25.176622, 121.434808, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(17 34% 36%),hsl(22 34% 24%) 55%,hsl(26 38% 15%))', 'opendata', null, '02-26212121#1714', 'http://www.au.edu.tw', null),
  ('c-0jq1ucq', '淡江大學網球場(館)', '新北市淡水區', '新北市淡水區英專路151號', 25.175254, 121.450027, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(25 40% 36%),hsl(30 40% 24%) 55%,hsl(34 44% 15%))', 'opendata', null, '02-26230985', 'http://www.tku.edu.tw', null),
  ('c-1yr5xdo', '聖約翰科技大學網球場', '新北市淡水區', '新北市淡水區淡金路四段499號', 25.226727, 121.45088, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(25 52% 36%),hsl(30 52% 24%) 55%,hsl(34 56% 15%))', 'opendata', null, '02-28013131#6217', 'http://www.sju.edu.tw/', null),
  ('c-1yr5xdo', '聖約翰科技大學網球場', '新北市淡水區', '新北市淡水區淡金路四段499號', 25.227421, 121.451535, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(25 52% 36%),hsl(30 52% 24%) 55%,hsl(34 56% 15%))', 'opendata', null, '02-28013131#6217', 'http://www.sju.edu.tw/', null),
  ('c-0uf2fga', '景文科技大學網球場(館)', '新北市新店區', '新北市新店區安忠路99號', 24.951968, 121.509331, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(7 34% 36%),hsl(12 34% 24%) 55%,hsl(16 38% 15%))', 'opendata', null, '02-82122000#2213', 'http://www.just.edu.tw/', null),
  ('c-1gojbyh', '小碧潭網球場（新店河濱）', '新北市新店區', '新北市新店區小碧潭公園網球場(新店溪右岸自行車道2.3KM)', 24.972744, 121.52728, null, false, true, 150, '平日每 4 小時 600 元、假日 800 元，未滿 2 小時以半場次計。時段固定兩小時一節：08–10、10–12、13–15、15–17、18–20、20–22。線上申請要先註冊會員，非新北市民也可以註冊。沒有人申請的時段開放現場自由使用。', null, 1, 8, 22, 'linear-gradient(150deg,hsl(19 52% 36%),hsl(24 52% 24%) 55%,hsl(28 56% 15%))', 'manual', 'https://www.hrcm.ntpc.gov.tw/Service/VenueRental/TennisCourtLeaseInst/Detail/小碧潭網球場', '02-89699596#501', 'http://www.rhbd.ntpc.gov.tw/cht/index.php?', '2026-08-23'),
  ('c-0yin15m', '彭福國小網球場(館)', '新北市樹林區', '新北市樹林區忠孝街30號', 24.981614, 121.423055, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(27 34% 36%),hsl(32 34% 24%) 55%,hsl(36 38% 15%))', 'opendata', null, '02-86866589#703', 'http://www.pfps.ntpc.edu.tw', null),
  ('c-1wbp6yi', '樹林體育園區網球場', '新北市樹林區', '新北市樹林區水源街81號', 24.982203, 121.426806, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(21 40% 36%),hsl(26 40% 24%) 55%,hsl(30 44% 15%))', 'opendata', null, '02-29620462#101', 'http://www.t-sports.ntpc.gov.tw', null),
  ('c-12sm4rn', '微風運河網球場', '新北市蘆洲區', '新北市蘆洲區二重疏洪道微風網球場', 25.094315, 121.458111, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(13 34% 36%),hsl(18 34% 24%) 55%,hsl(22 38% 15%))', 'opendata', null, '02-89699596', 'https://www.hrcm.ntpc.gov.tw/', null),
  ('c-1vmo0ua', '鶯歌國小網球場(館)', '新北市鶯歌區', '新北市鶯歌區同慶里尖山埔路106號', 24.951175, 121.346612, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(19 46% 36%),hsl(24 46% 24%) 55%,hsl(28 50% 15%))', 'opendata', null, '02-26792038', 'http://www.ykes.ntpc.edu.tw', null),
  ('c-007sqo2', '百齡河濱公園網球場（社子岸）', '臺北市士林區', '臺北市士林區通河東街1及2段堤外', 25.088431, 121.514947, null, false, false, 0, '免費，但仍要在臺北市體育局系統預約（要先註冊會員）。沒有夜間照明，天黑就打不了。', null, 6, 8, 22, 'linear-gradient(150deg,hsl(11 34% 36%),hsl(16 34% 24%) 55%,hsl(20 38% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=87', '02-25702330#6508', 'https://vbs.sports.taipei/venues/', '2026-08-23'),
  ('c-0fl7cqi', '天壽公園', '臺北市士林區', '臺北市士林區中山北路6段405巷右側', 25.116907, 121.524491, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(22 34% 36%),hsl(27 34% 24%) 55%,hsl(31 38% 15%))', 'opendata', null, '02-25702330#6535', 'https://sports.gov.taipei/', null),
  ('c-0l425ko', '東吳大學網球場(館)', '臺北市士林區', '臺北市士林區臨溪路70號', 25.09568, 121.544307, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(17 34% 36%),hsl(22 34% 24%) 55%,hsl(26 38% 15%))', 'opendata', null, '(02)28819471#5606', 'http://www.scu.edu.tw/physical/', null),
  ('c-1wml0f7', '臺北市天母棒球場', '臺北市士林區', '臺北市 士林區 忠誠路二段77號', 25.113456, 121.532929, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(27 34% 36%),hsl(32 34% 24%) 55%,hsl(36 38% 15%))', 'opendata', null, '02-25702330', 'https://sports.gov.taipei/', null),
  ('c-0xywvlw', '銘傳大學田徑場', '臺北市士林區', '臺北市士林區中山北路五段250號', 25.087018, 121.52765, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(6 40% 36%),hsl(11 40% 24%) 55%,hsl(15 44% 15%))', 'opendata', null, '02-28824564#2325', 'http://www.mcu.edu.tw', null),
  ('c-014c0j5', '銘傳大學體育館', '臺北市士林區', '臺北市士林區中山北路五段250號', 25.085599, 121.533508, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(20 52% 36%),hsl(25 52% 24%) 55%,hsl(29 56% 15%))', 'opendata', null, '02-28824564#2325', 'http://www.mcu.edu.tw', null),
  ('c-1823beb', '臺北教育大學網球場', '臺北市大安區', '臺北市大安區和平東路二段134號', 25.022112, 121.544859, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(8 40% 36%),hsl(13 40% 24%) 55%,hsl(17 44% 15%))', 'opendata', null, '02-27321104#83511', 'http://www.ntue.edu.tw/', null),
  ('c-1g2soks', '臺灣科技大學網球場(館)', '臺北市大安區', '臺北市大安區基隆路四段43號', 25.014662, 121.54325, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(11 46% 36%),hsl(16 46% 24%) 55%,hsl(20 50% 15%))', 'opendata', null, '02-27333141#7168', 'http://www.ntust.edu.tw', null),
  ('c-0008o0m', '美堤河濱公園', '臺北市中山區', '臺北市 中山區 大直橋 至 中山高速公路(金泰段右岸)（基隆河右岸）', 25.076679, 121.553367, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 2, 8, 22, 'linear-gradient(150deg,hsl(11 52% 36%),hsl(16 52% 24%) 55%,hsl(20 56% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=174', '02-25702330#6504', 'https://vbs.sports.taipei/', '2026-08-23'),
  ('c-0flprbw', '新生公園網球場', '臺北市中山區', '臺北市中山區新生北路3段105號', 25.068495, 121.531745, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(17 46% 36%),hsl(22 46% 24%) 55%,hsl(26 50% 15%))', 'opendata', null, '02-25956489', null, null),
  ('c-187m0ht', '臺北市中山區大佳河濱公園', '臺北市中山區', '臺北市 中山區 圓山橋下10號水門 大直橋至中山橋(大佳段)（基隆河左岸）', 25.074803, 121.535547, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(9 34% 36%),hsl(14 34% 24%) 55%,hsl(18 38% 15%))', 'opendata', null, '02-25702330#6520', 'https://vbs.sports.taipei/', null),
  ('c-197lw6y', '三民國中網球場', '臺北市內湖區', '臺北市內湖區湖興里民權東路6段45號', 25.069518, 121.584993, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(12 46% 36%),hsl(17 46% 24%) 55%,hsl(21 50% 15%))', 'opendata', null, '02-27924772#404', 'http://www.smjh.tp.edu.tw', null),
  ('c-1g9ltan', '內湖區石潭公園', '臺北市內湖區', '臺北市 內湖區 安康路25巷', 25.063694, 121.592651, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(26 46% 36%),hsl(31 46% 24%) 55%,hsl(35 50% 15%))', 'opendata', null, '02-25702330', 'https://vbs.sports.taipei/venues/', null),
  ('c-0knqvfe', '西湖國中網球場', '臺北市內湖區', '臺北市內湖區西湖里環山路1段27號', 25.086114, 121.565797, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(13 40% 36%),hsl(18 40% 24%) 55%,hsl(22 44% 15%))', 'opendata', null, '02-27991817#215', 'http://www.xhjhs.tp.edu.tw', null),
  ('c-15j77uu', '煙波庭公園', '臺北市內湖區', '臺北市 內湖區 大湖街131巷18弄61號', 25.086504, 121.599029, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(11 46% 36%),hsl(16 46% 24%) 55%,hsl(20 50% 15%))', 'opendata', null, '02-25702330', 'https://sports.tms.gov.tw/', null),
  ('c-1adteb4', '瑞湖公園', '臺北市內湖區', '臺北市 內湖區 民權東路六段15巷及瑞湖街交接口', 25.069429, 121.577228, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(8 46% 36%),hsl(13 46% 24%) 55%,hsl(17 50% 15%))', 'opendata', null, '02-25702330', 'https://sports.tms.gov.tw/', null),
  ('c-0iow7ho', '臺北市網球中心', '臺北市內湖區', '臺北市內湖區民權東路6段208號', 25.067446, 121.596648, null, false, true, 300, '室外離峰 300、尖峰 600（平日 17–19 時、假日 13–19 時），夜間另收燈光費 200；室內全日 2000。室外開放到 19:00，室內到 22:00。尖峰時段一次要訂兩小時，離峰可訂一小時。', null, 10, 6, 22, 'linear-gradient(150deg,hsl(27 40% 36%),hsl(32 40% 24%) 55%,hsl(36 44% 15%))', 'manual', 'https://www.tsc.taipei/場館介紹/室外網球場outdoor/', '02-27951166', 'https://sports.gov.taipei/', '2026-08-23'),
  ('c-1q5cdaz', '萬有二號公園', '臺北市文山區', '臺北市 文山區 景隆街19巷4-2號', 25.00073, 121.541635, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(21 46% 36%),hsl(26 46% 24%) 55%,hsl(30 50% 15%))', 'opendata', null, '02-25702330', 'https://sports.gov.taipei/', null),
  ('c-06ex74s', '文林國小田徑場', '臺北市北投區', '臺北市北投區建民里文林北路155號', 25.105675, 121.51395, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(16 34% 36%),hsl(21 34% 24%) 55%,hsl(25 38% 15%))', 'opendata', null, '02-28234212#303', 'http://www.wles.tp.edu.tw', null),
  ('c-0uo7bm9', '明德國中田徑場', '臺北市北投區', '臺北市北投區建民里明德路50號', 25.107994, 121.518697, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(8 34% 36%),hsl(13 34% 24%) 55%,hsl(17 38% 15%))', 'opendata', null, '02-28232539#605', 'http://www.mdjh.tp.edu.tw', null),
  ('c-1p4fpa5', '逸仙國小網球場、籃球場、躲避球場、樂樂棒球場', '臺北市北投區', '臺北市北投區中心里新民路2號', 25.138165, 121.50557, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(25 46% 36%),hsl(30 46% 24%) 55%,hsl(34 50% 15%))', 'opendata', null, '02-28914537', 'http://www.ysps.tp.edu.tw', null),
  ('c-1psnhgm', '陽明大學山下球場', '臺北市北投區', '臺北市北投區立農街二段155號', 25.119784, 121.51372, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(11 52% 36%),hsl(16 52% 24%) 55%,hsl(20 56% 15%))', 'opendata', null, '02-28267000#2169', 'http://pe.web.ym.edu.tw/', null),
  ('c-02qp7af', '陽明大學山頂網球場', '臺北市北投區', '臺北市北投區立農街二段155號', 25.124421, 121.513816, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(22 40% 36%),hsl(27 40% 24%) 55%,hsl(31 44% 15%))', 'opendata', null, '02-28267000#2169', 'http://pe.web.ym.edu.tw/', null),
  ('c-1qsa9ed', '臺北藝術大學網球場(館)', '臺北市北投區', '臺北市北投區學園路1號', 25.136524, 121.47465, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(24 34% 36%),hsl(29 34% 24%) 55%,hsl(33 38% 15%))', 'opendata', null, '02-28961000#3663', 'http://www.tnua.edu.tw', null),
  ('c-11ojnba', '臺北網球場', '臺北市松山區', '臺北市 松山區 南京東路4段6號', 25.051337, 121.551334, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(16 34% 36%),hsl(21 34% 24%) 55%,hsl(25 38% 15%))', 'opendata', null, '02-25795349', 'https://zh-tw.facebook.com/TPTennisCourt/', null),
  ('c-00jd8gj', '臺北醫學大學網球場(館)', '臺北市信義區', '臺北市信義區吳興街250號', 25.026049, 121.561403, null, false, null, null, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(8 52% 36%),hsl(13 52% 24%) 55%,hsl(17 56% 15%))', 'opendata', null, '07-27361661#2274', 'http://pe.tmu.edu.tw', null),
  ('c-1asmr0i', '中研公園', '臺北市南港區', '臺北市 南港區 研究路2段12巷58弄', 25.046836, 121.613449, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(17 52% 36%),hsl(22 52% 24%) 55%,hsl(26 56% 15%))', 'opendata', null, '02-25702330', 'https://sports.tms.gov.tw/', null),
  ('c-0z1pvmg', '中華科技大學操場', '臺北市南港區', '臺北市南港區研究院路三段245號', 25.032699, 121.610847, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(27 46% 36%),hsl(32 46% 24%) 55%,hsl(36 50% 15%))', 'opendata', null, '02-26546773', 'http://www.cust.edu.tw/sports/', null),
  ('c-1bvbons', '玉成公園', '臺北市南港區', '臺北市 南港區 中坡南路55號', 25.042491, 121.585071, null, false, null, 0, null, null, 1, 6, 22, 'linear-gradient(150deg,hsl(19 40% 36%),hsl(24 40% 24%) 55%,hsl(28 44% 15%))', 'opendata', null, '02-25702330', 'https://sports.tms.gov.tw/', null),
  ('c-0rbgz6v', '南港公園', '臺北市南港區', '臺北市 南港區 東新街170號', 25.045146, 121.591799, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 1, 8, 22, 'linear-gradient(150deg,hsl(20 46% 36%),hsl(25 46% 24%) 55%,hsl(29 50% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=609', '02-25702330', 'https://sports.tms.gov.tw/', '2026-08-23'),
  ('c-vbs-341', '大佳河濱運動公園網球場', '臺北市中山區', '大佳河濱運動公園網球場', 25.074849, 121.531508, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 2, 8, 22, 'linear-gradient(150deg,hsl(22 46% 36%),hsl(27 46% 24%) 55%,hsl(31 50% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=341', null, null, '2026-08-23'),
  ('c-vbs-266', '中正河濱公園中正網球場', '臺北市中正區', '中正河濱公園中正網球場', 25.023453078713725, 121.51428624222645, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 3, 8, 22, 'linear-gradient(150deg,hsl(10 40% 36%),hsl(15 40% 24%) 55%,hsl(19 44% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=266', null, null, '2026-08-23'),
  ('c-vbs-305', '古亭河濱公園網球場', '臺北市中正區', '古亭河濱公園網球場', 25.019024, 121.522689, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 2, 8, 22, 'linear-gradient(150deg,hsl(17 46% 36%),hsl(22 46% 24%) 55%,hsl(26 50% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=305', null, null, '2026-08-23'),
  ('c-vbs-201', '彩虹河濱公園網球場', '臺北市內湖區', '彩虹河濱公園網球場', 25.062687, 121.571815, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 9, 8, 22, 'linear-gradient(150deg,hsl(26 46% 36%),hsl(31 46% 24%) 55%,hsl(35 50% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=201', null, null, '2026-08-23'),
  ('c-vbs-312', '成美右岸河濱公園網球場', '臺北市內湖區', '成美右岸河濱公園網球場', 25.05581, 121.586324, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 1, 8, 17, 'linear-gradient(150deg,hsl(22 46% 36%),hsl(27 46% 24%) 55%,hsl(31 50% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=312', null, null, '2026-08-23'),
  ('c-vbs-604', '碧湖公園網球場', '臺北市內湖區', '碧湖公園網球場', 25.081903, 121.583775, null, false, false, 0, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 1, 8, 17, 'linear-gradient(150deg,hsl(23 40% 36%),hsl(28 40% 24%) 55%,hsl(32 44% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=604', null, null, '2026-08-23'),
  ('c-vbs-342', '天母運動場區網球場', '臺北市士林區', '天母運動場區網球場', 25.113514, 121.535606, null, false, true, null, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 6, 8, 22, 'linear-gradient(150deg,hsl(23 52% 36%),hsl(28 52% 24%) 55%,hsl(32 56% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=342', null, null, '2026-08-23'),
  ('c-vbs-324', '延平河濱公園網球場', '臺北市大同區', '延平河濱公園網球場', 25.054497, 121.506679, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 1, 8, 22, 'linear-gradient(150deg,hsl(9 52% 36%),hsl(14 52% 24%) 55%,hsl(18 56% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=324', null, null, '2026-08-23'),
  ('c-vbs-489', '景美河濱公園網球場', '臺北市文山區', '景美河濱公園網球場', 24.991534, 121.536613, null, false, false, 0, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 1, 8, 22, 'linear-gradient(150deg,hsl(26 46% 36%),hsl(31 46% 24%) 55%,hsl(35 50% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=489', null, null, '2026-08-23'),
  ('c-vbs-352', '溪洲[福和]河濱公園網球場', '臺北市文山區', '溪洲[福和]河濱公園網球場', 25.000052, 121.534781, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 1, 8, 22, 'linear-gradient(150deg,hsl(8 46% 36%),hsl(13 46% 24%) 55%,hsl(17 50% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=352', null, null, '2026-08-23'),
  ('c-vbs-253', '道南河濱公園網球場1-2', '臺北市文山區', '道南河濱公園網球場1-2', 24.993917, 121.57182, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 1, 8, 17, 'linear-gradient(150deg,hsl(22 52% 36%),hsl(27 52% 24%) 55%,hsl(31 56% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=253', null, null, '2026-08-23'),
  ('c-vbs-425', '道南河濱公園網球場4-6', '臺北市文山區', '道南河濱公園網球場4-6', 24.9828, 121.570274, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 2, 8, 22, 'linear-gradient(150deg,hsl(20 34% 36%),hsl(25 34% 24%) 55%,hsl(29 38% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=425', null, null, '2026-08-23'),
  ('c-vbs-320', '民權公園網球場', '臺北市松山區', '民權公園網球場', 25.061584, 121.55929, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 2, 6, 22, 'linear-gradient(150deg,hsl(28 52% 36%),hsl(33 52% 24%) 55%,hsl(37 56% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=320', null, null, '2026-08-23'),
  ('c-vbs-239', '華中河濱公園網球場', '臺北市萬華區', '華中河濱公園網球場', 25.017174, 121.491658, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 7, 8, 22, 'linear-gradient(150deg,hsl(12 52% 36%),hsl(17 52% 24%) 55%,hsl(21 56% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=239', null, null, '2026-08-23'),
  ('c-vbs-210', '雙園河濱公園網球場', '臺北市萬華區', '雙園河濱公園網球場', 25.034276, 121.488169, null, false, true, 140, '臺北市體育局線上預約，要先註冊會員。未開放線上預約的面只供現場民眾輪流使用。', null, 4, 8, 22, 'linear-gradient(150deg,hsl(10 34% 36%),hsl(15 34% 24%) 55%,hsl(19 38% 15%))', 'manual', 'https://vbs.sports.taipei/venues/?K=210', null, null, '2026-08-23')
on conflict (id) do nothing;

insert into courts (id, club_id, name) values
  ('c-105c6hr-court-1', 'c-105c6hr', '第 1 球場'),
  ('c-13ts2co-court-1', 'c-13ts2co', '第 1 球場'),
  ('c-02eb2j8-court-1', 'c-02eb2j8', '第 1 球場'),
  ('c-17achkz-court-1', 'c-17achkz', '第 1 球場'),
  ('c-1e8y3fy-court-1', 'c-1e8y3fy', '第 1 球場'),
  ('c-1mxo36s-court-1', 'c-1mxo36s', '第 1 球場'),
  ('c-0lmdly4-court-1', 'c-0lmdly4', '第 1 球場'),
  ('c-1x8ba0z-court-1', 'c-1x8ba0z', '第 1 球場'),
  ('c-0wu26dk-court-1', 'c-0wu26dk', '第 1 球場'),
  ('c-1swl24q-court-1', 'c-1swl24q', '第 1 球場'),
  ('c-0gejqbn-court-1', 'c-0gejqbn', '第 1 球場'),
  ('c-0fk0mr6-court-1', 'c-0fk0mr6', '第 1 球場'),
  ('c-06td8b7-court-1', 'c-06td8b7', '第 1 球場'),
  ('c-0fkdbyh-court-1', 'c-0fkdbyh', '第 1 球場'),
  ('c-0nly2vt-court-1', 'c-0nly2vt', '第 1 球場'),
  ('c-0jq1ucq-court-1', 'c-0jq1ucq', '第 1 球場'),
  ('c-1yr5xdo-court-1', 'c-1yr5xdo', '第 1 球場'),
  ('c-1yr5xdo-court-1', 'c-1yr5xdo', '第 1 球場'),
  ('c-0uf2fga-court-1', 'c-0uf2fga', '第 1 球場'),
  ('c-1gojbyh-court-1', 'c-1gojbyh', '第 1 球場'),
  ('c-0yin15m-court-1', 'c-0yin15m', '第 1 球場'),
  ('c-1wbp6yi-court-1', 'c-1wbp6yi', '第 1 球場'),
  ('c-12sm4rn-court-1', 'c-12sm4rn', '第 1 球場'),
  ('c-1vmo0ua-court-1', 'c-1vmo0ua', '第 1 球場'),
  ('c-007sqo2-court-1', 'c-007sqo2', '第 1 球場'),
  ('c-007sqo2-court-2', 'c-007sqo2', '第 2 球場'),
  ('c-007sqo2-court-3', 'c-007sqo2', '第 3 球場'),
  ('c-007sqo2-court-4', 'c-007sqo2', '第 4 球場'),
  ('c-007sqo2-court-5', 'c-007sqo2', '第 5 球場'),
  ('c-007sqo2-court-6', 'c-007sqo2', '第 6 球場'),
  ('c-0fl7cqi-court-1', 'c-0fl7cqi', '第 1 球場'),
  ('c-0l425ko-court-1', 'c-0l425ko', '第 1 球場'),
  ('c-1wml0f7-court-1', 'c-1wml0f7', '第 1 球場'),
  ('c-0xywvlw-court-1', 'c-0xywvlw', '第 1 球場'),
  ('c-014c0j5-court-1', 'c-014c0j5', '第 1 球場'),
  ('c-1823beb-court-1', 'c-1823beb', '第 1 球場'),
  ('c-1g2soks-court-1', 'c-1g2soks', '第 1 球場'),
  ('c-0008o0m-court-1', 'c-0008o0m', '第 1 球場'),
  ('c-0008o0m-court-2', 'c-0008o0m', '第 2 球場'),
  ('c-0flprbw-court-1', 'c-0flprbw', '第 1 球場'),
  ('c-187m0ht-court-1', 'c-187m0ht', '第 1 球場'),
  ('c-197lw6y-court-1', 'c-197lw6y', '第 1 球場'),
  ('c-1g9ltan-court-1', 'c-1g9ltan', '第 1 球場'),
  ('c-0knqvfe-court-1', 'c-0knqvfe', '第 1 球場'),
  ('c-15j77uu-court-1', 'c-15j77uu', '第 1 球場'),
  ('c-1adteb4-court-1', 'c-1adteb4', '第 1 球場'),
  ('c-0iow7ho-court-1', 'c-0iow7ho', '第 1 球場'),
  ('c-0iow7ho-court-2', 'c-0iow7ho', '第 2 球場'),
  ('c-0iow7ho-court-3', 'c-0iow7ho', '第 3 球場'),
  ('c-0iow7ho-court-4', 'c-0iow7ho', '第 4 球場'),
  ('c-0iow7ho-court-5', 'c-0iow7ho', '第 5 球場'),
  ('c-0iow7ho-court-6', 'c-0iow7ho', '第 6 球場'),
  ('c-0iow7ho-court-7', 'c-0iow7ho', '第 7 球場'),
  ('c-0iow7ho-court-8', 'c-0iow7ho', '第 8 球場'),
  ('c-0iow7ho-court-9', 'c-0iow7ho', '第 9 球場'),
  ('c-0iow7ho-court-10', 'c-0iow7ho', '第 10 球場'),
  ('c-1q5cdaz-court-1', 'c-1q5cdaz', '第 1 球場'),
  ('c-06ex74s-court-1', 'c-06ex74s', '第 1 球場'),
  ('c-0uo7bm9-court-1', 'c-0uo7bm9', '第 1 球場'),
  ('c-1p4fpa5-court-1', 'c-1p4fpa5', '第 1 球場'),
  ('c-1psnhgm-court-1', 'c-1psnhgm', '第 1 球場'),
  ('c-02qp7af-court-1', 'c-02qp7af', '第 1 球場'),
  ('c-1qsa9ed-court-1', 'c-1qsa9ed', '第 1 球場'),
  ('c-11ojnba-court-1', 'c-11ojnba', '第 1 球場'),
  ('c-00jd8gj-court-1', 'c-00jd8gj', '第 1 球場'),
  ('c-1asmr0i-court-1', 'c-1asmr0i', '第 1 球場'),
  ('c-0z1pvmg-court-1', 'c-0z1pvmg', '第 1 球場'),
  ('c-1bvbons-court-1', 'c-1bvbons', '第 1 球場'),
  ('c-0rbgz6v-court-1', 'c-0rbgz6v', '第 1 球場'),
  ('c-vbs-341-court-1', 'c-vbs-341', '第 1 球場'),
  ('c-vbs-341-court-2', 'c-vbs-341', '第 2 球場'),
  ('c-vbs-266-court-1', 'c-vbs-266', '第 1 球場'),
  ('c-vbs-266-court-2', 'c-vbs-266', '第 2 球場'),
  ('c-vbs-266-court-3', 'c-vbs-266', '第 3 球場'),
  ('c-vbs-305-court-1', 'c-vbs-305', '第 1 球場'),
  ('c-vbs-305-court-2', 'c-vbs-305', '第 2 球場'),
  ('c-vbs-201-court-1', 'c-vbs-201', '第 1 球場'),
  ('c-vbs-201-court-2', 'c-vbs-201', '第 2 球場'),
  ('c-vbs-201-court-3', 'c-vbs-201', '第 3 球場'),
  ('c-vbs-201-court-4', 'c-vbs-201', '第 4 球場'),
  ('c-vbs-201-court-5', 'c-vbs-201', '第 5 球場'),
  ('c-vbs-201-court-6', 'c-vbs-201', '第 6 球場'),
  ('c-vbs-201-court-7', 'c-vbs-201', '第 7 球場'),
  ('c-vbs-201-court-8', 'c-vbs-201', '第 8 球場'),
  ('c-vbs-201-court-9', 'c-vbs-201', '第 9 球場'),
  ('c-vbs-312-court-1', 'c-vbs-312', '第 1 球場'),
  ('c-vbs-604-court-1', 'c-vbs-604', '第 1 球場'),
  ('c-vbs-342-court-1', 'c-vbs-342', '第 1 球場'),
  ('c-vbs-342-court-2', 'c-vbs-342', '第 2 球場'),
  ('c-vbs-342-court-3', 'c-vbs-342', '第 3 球場'),
  ('c-vbs-342-court-4', 'c-vbs-342', '第 4 球場'),
  ('c-vbs-342-court-5', 'c-vbs-342', '第 5 球場'),
  ('c-vbs-342-court-6', 'c-vbs-342', '第 6 球場'),
  ('c-vbs-324-court-1', 'c-vbs-324', '第 1 球場'),
  ('c-vbs-489-court-1', 'c-vbs-489', '第 1 球場'),
  ('c-vbs-352-court-1', 'c-vbs-352', '第 1 球場'),
  ('c-vbs-253-court-1', 'c-vbs-253', '第 1 球場'),
  ('c-vbs-425-court-1', 'c-vbs-425', '第 1 球場'),
  ('c-vbs-425-court-2', 'c-vbs-425', '第 2 球場'),
  ('c-vbs-320-court-1', 'c-vbs-320', '第 1 球場'),
  ('c-vbs-320-court-2', 'c-vbs-320', '第 2 球場'),
  ('c-vbs-239-court-1', 'c-vbs-239', '第 1 球場'),
  ('c-vbs-239-court-2', 'c-vbs-239', '第 2 球場'),
  ('c-vbs-239-court-3', 'c-vbs-239', '第 3 球場'),
  ('c-vbs-239-court-4', 'c-vbs-239', '第 4 球場'),
  ('c-vbs-239-court-5', 'c-vbs-239', '第 5 球場'),
  ('c-vbs-239-court-6', 'c-vbs-239', '第 6 球場'),
  ('c-vbs-239-court-7', 'c-vbs-239', '第 7 球場'),
  ('c-vbs-210-court-1', 'c-vbs-210', '第 1 球場'),
  ('c-vbs-210-court-2', 'c-vbs-210', '第 2 球場'),
  ('c-vbs-210-court-3', 'c-vbs-210', '第 3 球場'),
  ('c-vbs-210-court-4', 'c-vbs-210', '第 4 球場')
on conflict (id) do nothing;
