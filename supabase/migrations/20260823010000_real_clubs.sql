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
