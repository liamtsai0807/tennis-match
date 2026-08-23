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
