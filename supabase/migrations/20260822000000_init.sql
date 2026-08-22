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
alter publication supabase_realtime add table invites;
alter publication supabase_realtime add table bookings;

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
