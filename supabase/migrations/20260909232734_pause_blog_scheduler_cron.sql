-- Blog publishing is paused and blog_posts is empty, so
-- process-scheduled-blog-posts has nothing to do. Deactivate it entirely
-- rather than run it on any schedule. This removes its Disk IO contribution
-- (function execution plus cron.job_run_details writes) completely.
--
-- Deactivating (rather than unscheduling) keeps the job definition so it is a
-- one-flag revert. Re-enable with:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'process-scheduled-blog-posts'),
--     active := true);
-- or re-run 20260909232101_reduce_scheduler_cron_io.sql to recreate it on
-- the */5 schedule.

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'process-scheduled-blog-posts';
  if v_jobid is not null then
    perform cron.alter_job(job_id := v_jobid, active := false);
  end if;
end
$$;
