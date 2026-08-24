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
