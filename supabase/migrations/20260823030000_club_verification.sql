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
