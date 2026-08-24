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
