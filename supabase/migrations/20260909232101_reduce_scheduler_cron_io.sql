-- Reduce sustained Disk IO caused by pg_cron.
--
-- Two scheduler jobs ran on "* * * * *" (every minute):
--   * process-scheduled-blog-posts -> public.process_scheduled_blog_posts()
--   * promote_drain_scheduled      -> public.publish_due_scheduled_posts()
-- Almost every tick promotes zero rows (each predicate is a cheap indexed
-- probe), but pg_cron still writes one insert plus three status updates to
-- cron.job_run_details on every execution. pg_cron never purges that table,
-- so over ~5 months it grew to ~328k rows / 57 MB. That continuous write
-- churn (WAL, dirty-page flushes, and repeated autovacuum of a growing log
-- table) was the main driver of Disk IO Budget depletion, not query reads
-- (cache hit ratio on these tables is ~100%).
--
-- Fixes, both reversible:
--   1. Drop the two per-minute jobs to every 5 minutes. Five-minute
--      granularity is fine for a blog/social scheduler and cuts these jobs'
--      execution volume (and their cron.job_run_details writes) by ~80%.
--   2. Add retention for cron.job_run_details: a purge function plus a daily
--      job that keeps the last 7 days of run history.

-- 1a. Blog post publisher: every 5 minutes instead of every minute.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-scheduled-blog-posts') then
    perform cron.unschedule('process-scheduled-blog-posts');
  end if;
  perform cron.schedule(
    'process-scheduled-blog-posts',
    '*/5 * * * *',
    $cron$ select public.process_scheduled_blog_posts(); $cron$
  );
end
$$;

-- 1b. Social post publisher: every 5 minutes instead of every minute.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'promote_drain_scheduled') then
    perform cron.unschedule('promote_drain_scheduled');
  end if;
  perform cron.schedule(
    'promote_drain_scheduled',
    '*/5 * * * *',
    $cron$ select public.publish_due_scheduled_posts(); $cron$
  );
end
$$;

-- 2a. Retention helper. pg_cron writes one cron.job_run_details row per job
-- execution and never removes it. Keep p_keep_days of history for debugging.
-- coalesce(end_time, start_time) so crashed runs that never recorded an
-- end_time are still eligible once they age out, while a run currently in
-- flight (both timestamps recent) is preserved.
create or replace function public.purge_cron_run_details(p_keep_days integer default 7)
returns integer
language plpgsql
security definer
set search_path to 'cron', 'public'
as $function$
declare
  deleted_count integer := 0;
begin
  delete from cron.job_run_details
   where coalesce(end_time, start_time) < now() - make_interval(days => greatest(p_keep_days, 1));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

-- 2b. Purge daily at 03:47 UTC (off-peak, not colliding with other jobs).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-cron-run-details') then
    perform cron.unschedule('purge-cron-run-details');
  end if;
  perform cron.schedule(
    'purge-cron-run-details',
    '47 3 * * *',
    $cron$ select public.purge_cron_run_details(7); $cron$
  );
end
$$;
