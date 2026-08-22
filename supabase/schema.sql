-- ===== schema.sql =====
-- 在 Supabase 專案的 SQL Editor 貼上整份執行一次即可。
-- 這份 schema 刻意跟 src/lib/types.ts 的欄位名稱一字不差，
-- 這樣 db.ts 才能直接 insert 整個物件而不用做欄位對應。

create table if not exists clubs (
  id              text primary key,
  name            text not null,
  district        text not null,
  address         text not null,
  surface         text not null check (surface in ('hard','clay','grass','carpet')),
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

create table if not exists players (
  id          text primary key,
  name        text not null,
  avatar_hue  int  not null default 210,
  ntrp        numeric(2,1) not null default 3.0,
  district    text not null default '',
  hand        text not null default 'right' check (hand in ('right','left')),
  bio         text not null default '',
  wins        int  not null default 0,
  losses      int  not null default 0
);

create table if not exists bookings (
  id          text primary key,
  club_id     text not null references clubs(id) on delete cascade,
  court_id    text not null references courts(id) on delete cascade,
  user_id     text not null,
  date        date not null,
  hour        int  not null check (hour between 0 and 23),
  players     int  not null default 2,
  created_at  timestamptz not null default now(),
  status      text not null default 'confirmed' check (status in ('confirmed','cancelled'))
);

-- 同一面場、同一天、同一個整點只能有一筆有效預約。
-- 這是防重複預約的最後一道防線；前端的檢查會有 race condition，資料庫這層不會。
create unique index if not exists bookings_no_double_book
  on bookings (court_id, date, hour) where status = 'confirmed';

create index if not exists bookings_by_club_date on bookings (club_id, date);

create table if not exists open_matches (
  id        text primary key,
  host_id   text not null,
  club_id   text not null references clubs(id) on delete cascade,
  date      date not null,
  hour      int  not null,
  kind      text not null check (kind in ('singles','doubles')),
  ntrp_min  numeric(2,1) not null,
  ntrp_max  numeric(2,1) not null,
  slots     int  not null,
  joined    jsonb not null default '[]'::jsonb,
  note      text not null default '',
  status    text not null default 'open' check (status in ('open','full','cancelled'))
);

create table if not exists live_matches (
  id           text primary key,
  title        text not null,
  club_id      text not null default '',
  kind         text not null check (kind in ('singles','doubles')),
  side_a       jsonb not null default '[]'::jsonb,
  side_b       jsonb not null default '[]'::jsonb,
  format       jsonb not null,
  state        jsonb not null,
  scorer_id    text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  spectators   int not null default 0
);

-- 觀戰人數用 RPC 累加，避免前端讀值再寫回造成的計數漏算。
create or replace function bump_spectators(match_id text)
returns void language sql as $$
  update live_matches set spectators = spectators + 1 where id = match_id;
$$;

-- 即時比分推播需要把這張表加進 realtime publication。
alter publication supabase_realtime add table live_matches;
alter publication supabase_realtime add table open_matches;
alter publication supabase_realtime add table bookings;

-- ---------------------------------------------------------------
-- RLS：目前 App 還沒接 Supabase Auth，先用「都可讀寫」讓流程跑得起來。
-- 正式上線前務必改成綁 auth.uid()，範例寫在下面註解。
-- ---------------------------------------------------------------
alter table clubs        enable row level security;
alter table courts       enable row level security;
alter table players      enable row level security;
alter table bookings     enable row level security;
alter table open_matches enable row level security;
alter table live_matches enable row level security;

create policy "read all clubs"   on clubs        for select using (true);
create policy "read all courts"  on courts       for select using (true);
create policy "read all players" on players      for select using (true);
create policy "rw bookings"      on bookings     for all using (true) with check (true);
create policy "rw open_matches"  on open_matches for all using (true) with check (true);
create policy "rw live_matches"  on live_matches for all using (true) with check (true);

-- 接上 Supabase Auth 之後，把 bookings 的政策換成這樣：
--   drop policy "rw bookings" on bookings;
--   create policy "own bookings" on bookings for all
--     using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
--   create policy "read bookings" on bookings for select using (true);
