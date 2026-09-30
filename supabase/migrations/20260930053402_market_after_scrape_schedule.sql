-- Schedules for the daily market snapshot (29 Sep 2026).
--
-- The hourly refresh now runs geck_data.after_scrape(), which refreshes the
-- market views and rewrites today's market_daily rows. A second job runs
-- every 5 minutes and handles requests scrapers leave with
-- geck_data.request_after_scrape(), so fresh data shows within minutes of
-- a scrape instead of up to an hour later.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-market-matviews') then
    perform cron.unschedule('refresh-market-matviews');
  end if;
  perform cron.schedule('refresh-market-matviews', '20 * * * *',
    $cron$ select geck_data.after_scrape('hourly'); $cron$);

  if exists (select 1 from cron.job where jobname = 'market-after-scrape-requests') then
    perform cron.unschedule('market-after-scrape-requests');
  end if;
  perform cron.schedule('market-after-scrape-requests', '*/5 * * * *',
    $cron$ select geck_data.run_requested_after_scrape(); $cron$);
end
$$;
