-- ===== seed.sql =====
-- 由 tools/gen_seed_sql.ts 產生，不要手改。
-- 執行順序：先跑 schema.sql，再跑這一份。

insert into clubs (id, name, district, address, surface, indoor, lights, price_per_hour, rating, courts, open_hour, close_hour, photo) values
  ('c-daan', '大安網球中心', '台北市大安區', '台北市大安區敦化南路二段 99 號', 'hard', false, true, 500, 4.6, 8, 6, 22, 'linear-gradient(150deg,#1e6fd9,#0d3f8f 55%,#0a2d66)'),
  ('c-tianmu', '天母網球場', '台北市士林區', '台北市士林區忠誠路二段 77 號', 'clay', false, true, 420, 4.4, 6, 6, 21, 'linear-gradient(150deg,#c96a3c,#a0472a 55%,#6f2f1c)'),
  ('c-neihu', '內湖運動中心（室內）', '台北市內湖區', '台北市內湖區洲子街 12 號', 'hard', true, true, 700, 4.8, 4, 7, 23, 'linear-gradient(150deg,#3f5a8a,#22355c 55%,#141f38)'),
  ('c-banqiao', '板橋第一網球場', '新北市板橋區', '新北市板橋區縣民大道二段 1 號', 'hard', false, false, 350, 4.1, 10, 6, 18, 'linear-gradient(150deg,#2f9e6a,#177a4c 55%,#0d4d30)'),
  ('c-taoyuan', '桃園青埔網球園區', '桃園市中壢區', '桃園市中壢區高鐵南路二段 8 號', 'grass', false, true, 600, 4.7, 5, 6, 22, 'linear-gradient(150deg,#4a9d3f,#2c7028 55%,#17471a)'),
  ('c-hsinchu', '新竹科園網球俱樂部', '新竹市東區', '新竹市東區科學園路 300 號', 'hard', true, true, 650, 4.5, 6, 7, 23, 'linear-gradient(150deg,#6a4bb5,#432d80 55%,#281a4d)')
on conflict (id) do nothing;

insert into courts (id, club_id, name) values
  ('c-daan-court-1', 'c-daan', '第 1 球場'),
  ('c-daan-court-2', 'c-daan', '第 2 球場'),
  ('c-daan-court-3', 'c-daan', '第 3 球場'),
  ('c-daan-court-4', 'c-daan', '第 4 球場'),
  ('c-daan-court-5', 'c-daan', '第 5 球場'),
  ('c-daan-court-6', 'c-daan', '第 6 球場'),
  ('c-daan-court-7', 'c-daan', '第 7 球場'),
  ('c-daan-court-8', 'c-daan', '第 8 球場'),
  ('c-tianmu-court-1', 'c-tianmu', '第 1 球場'),
  ('c-tianmu-court-2', 'c-tianmu', '第 2 球場'),
  ('c-tianmu-court-3', 'c-tianmu', '第 3 球場'),
  ('c-tianmu-court-4', 'c-tianmu', '第 4 球場'),
  ('c-tianmu-court-5', 'c-tianmu', '第 5 球場'),
  ('c-tianmu-court-6', 'c-tianmu', '第 6 球場'),
  ('c-neihu-court-1', 'c-neihu', '第 1 球場'),
  ('c-neihu-court-2', 'c-neihu', '第 2 球場'),
  ('c-neihu-court-3', 'c-neihu', '第 3 球場'),
  ('c-neihu-court-4', 'c-neihu', '第 4 球場'),
  ('c-banqiao-court-1', 'c-banqiao', '第 1 球場'),
  ('c-banqiao-court-2', 'c-banqiao', '第 2 球場'),
  ('c-banqiao-court-3', 'c-banqiao', '第 3 球場'),
  ('c-banqiao-court-4', 'c-banqiao', '第 4 球場'),
  ('c-banqiao-court-5', 'c-banqiao', '第 5 球場'),
  ('c-banqiao-court-6', 'c-banqiao', '第 6 球場'),
  ('c-banqiao-court-7', 'c-banqiao', '第 7 球場'),
  ('c-banqiao-court-8', 'c-banqiao', '第 8 球場'),
  ('c-banqiao-court-9', 'c-banqiao', '第 9 球場'),
  ('c-banqiao-court-10', 'c-banqiao', '第 10 球場'),
  ('c-taoyuan-court-1', 'c-taoyuan', '第 1 球場'),
  ('c-taoyuan-court-2', 'c-taoyuan', '第 2 球場'),
  ('c-taoyuan-court-3', 'c-taoyuan', '第 3 球場'),
  ('c-taoyuan-court-4', 'c-taoyuan', '第 4 球場'),
  ('c-taoyuan-court-5', 'c-taoyuan', '第 5 球場'),
  ('c-hsinchu-court-1', 'c-hsinchu', '第 1 球場'),
  ('c-hsinchu-court-2', 'c-hsinchu', '第 2 球場'),
  ('c-hsinchu-court-3', 'c-hsinchu', '第 3 球場'),
  ('c-hsinchu-court-4', 'c-hsinchu', '第 4 球場'),
  ('c-hsinchu-court-5', 'c-hsinchu', '第 5 球場'),
  ('c-hsinchu-court-6', 'c-hsinchu', '第 6 球場')
on conflict (id) do nothing;

insert into players (id, name, avatar_hue, ntrp, district, hand, bio, wins, losses) values
  ('p-me', '陳彥廷', 210, 3, '台北市大安區', 'right', '週末球友，正手比反手穩。', 12, 9),
  ('p-kai', '王凱文', 24, 3.5, '台北市大安區', 'right', '底線纏鬥型，喜歡打長球。平日晚上比較有空。', 34, 21),
  ('p-yuting', '陳語婷', 330, 4, '台北市士林區', 'left', '左手發球有角度，雙打找我。', 51, 28),
  ('p-jason', 'Jason Liu', 150, 3, '新北市板橋區', 'right', '回台灣兩年，找固定球伴一起練。', 18, 22),
  ('p-meiling', '林美玲', 275, 2.5, '台北市內湖區', 'right', '打了半年，還在練發球，求輕虐。', 6, 15),
  ('p-hao', '張皓', 195, 4.5, '桃園市中壢區', 'right', '大學校隊出身，可以陪練也可以認真打。', 88, 31),
  ('p-sofia', 'Sofia Chen', 45, 3.5, '新竹市東區', 'right', '雙打為主，正拍抽球是強項。', 40, 33),
  ('p-ethan', '李昱辰', 0, 3, '台北市大安區', 'right', '國中生，禮拜六早上都有練球。', 9, 7)
on conflict (id) do nothing;

insert into open_matches (id, host_id, club_id, date, hour, kind, ntrp_min, ntrp_max, slots, joined, note, status) values
  ('m-1', 'p-kai', 'c-daan', '2026-08-22', 19, 'doubles', 3, 4, 4, '["p-kai","p-yuting"]'::jsonb, '今晚雙打缺兩位，程度差不多就好，不計較勝負。', 'open'),
  ('m-2', 'p-hao', 'c-taoyuan', '2026-08-23', 7, 'singles', 4, 5.5, 2, '["p-hao"]'::jsonb, '早上七點單打，想認真打的來。草地場，記得帶對的鞋。', 'open'),
  ('m-3', 'p-meiling', 'c-neihu', '2026-08-23', 20, 'doubles', 2, 3, 4, '["p-meiling","p-jason","p-ethan"]'::jsonb, '初學者友善場，室內不怕下雨。還缺一位！', 'open'),
  ('m-4', 'p-sofia', 'c-hsinchu', '2026-08-24', 18, 'doubles', 3, 4, 4, '["p-sofia"]'::jsonb, '下班後打兩小時，打完可以一起吃飯。', 'open'),
  ('m-5', 'p-yuting', 'c-tianmu', '2026-08-25', 9, 'singles', 3.5, 4.5, 2, '["p-yuting"]'::jsonb, '紅土場練球，想適應慢速場地的一起。', 'open')
on conflict (id) do nothing;

