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
