-- Postgres grants EXECUTE on a new function to PUBLIC by default, so the
-- earlier "grant execute ... to service_role" added a grant without removing
-- the implicit public one. Both of these are SECURITY DEFINER maintenance
-- functions that were therefore reachable from the anon key over PostgREST:
--
--   /rest/v1/rpc/refresh_market_matviews  -> three concurrent matview
--     refreshes on demand, an IO amplification vector on a project that was
--     just recovering from a Disk IO budget exhaustion
--   /rest/v1/rpc/purge_cron_run_details   -> deletes cron run history
--
-- Neither is called from the app. They are invoked by pg_cron, which runs as
-- the job owner (postgres) and is unaffected by these revokes.

revoke all on function geck_data.refresh_market_matviews() from public;
revoke all on function geck_data.refresh_market_matviews() from anon;
revoke all on function geck_data.refresh_market_matviews() from authenticated;
grant execute on function geck_data.refresh_market_matviews() to service_role;

revoke all on function public.purge_cron_run_details(integer) from public;
revoke all on function public.purge_cron_run_details(integer) from anon;
revoke all on function public.purge_cron_run_details(integer) from authenticated;
grant execute on function public.purge_cron_run_details(integer) to service_role;
