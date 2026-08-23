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
