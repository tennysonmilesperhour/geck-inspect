-- Social post publishing is paused for now, so promote_drain_scheduled
-- (public.publish_due_scheduled_posts) has nothing to claim. Deactivate it
-- entirely instead of running it every 5 minutes. Removes its Disk IO
-- contribution (function execution plus cron.job_run_details writes).
--
-- Deactivating (rather than unscheduling) keeps the job definition so it is a
-- one-flag revert. Re-enable with:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'promote_drain_scheduled'),
--     active := true);

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'promote_drain_scheduled';
  if v_jobid is not null then
    perform cron.alter_job(job_id := v_jobid, active := false);
  end if;
end
$$;
