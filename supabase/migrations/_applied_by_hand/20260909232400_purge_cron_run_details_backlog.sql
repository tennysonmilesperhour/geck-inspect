-- =============================================================================
-- One-time cleanup of the cron.job_run_details backlog
-- =============================================================================
-- Applied by hand on 2026-09-09 in response to a Supabase "depleting Disk IO
-- Budget" alert. This is NOT part of the runnable migration chain: it deletes
-- operational log data and runs VACUUM FULL, which cannot execute inside a
-- migration transaction. A fresh environment has no backlog, so there is
-- nothing to replay.
--
-- Background: pg_cron logs one row per job execution to cron.job_run_details
-- and never purges it. With two jobs running every minute, the table had grown
-- to ~328,700 rows / 57 MB. Migration 20260909232101_reduce_scheduler_cron_io
-- adds public.purge_cron_run_details() plus a daily 'purge-cron-run-details'
-- job for ongoing retention; this file cleared the existing backlog once.
--
-- Result: 308,544 rows deleted, 20,179 kept (last 7 days); table 57 MB -> 3.4 MB.
-- =============================================================================

-- Delete everything older than the 7-day retention window.
select public.purge_cron_run_details(7);

-- Reclaim the dead space to disk. Steady-state size (7-day retention) is a few
-- MB, well under the old 57 MB, so a plain VACUUM would leave the empty pages
-- as bloat. VACUUM FULL rewrites the table compactly. Run outside a
-- transaction (Supabase SQL editor / MCP execute_sql, not apply_migration).
VACUUM (FULL, ANALYZE) cron.job_run_details;
