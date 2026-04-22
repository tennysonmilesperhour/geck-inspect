-- =============================================================================
-- Scheduled prune for stale push_subscriptions.
-- =============================================================================
--
-- iOS silently expires web-push subscriptions after ~8 weeks of the
-- installed PWA not being opened. The push service never returns a 410
-- in that case — we just get 0 delivered forever. The send-push edge
-- function already bumps last_seen_at on every successful delivery and
-- the touchPushSubscription() client helper bumps it on every
-- authenticated page load, so a row that hasn't moved in 56 days is
-- almost certainly dead.
--
-- We run the prune via pg_cron nightly. Anyone whose subscription we
-- deleted will see the "Enable notifications" CTA on their next visit
-- and can re-subscribe with one tap.
--
-- Requires: pg_cron extension (available on Supabase, not enabled by
-- default). We create it inside the `extensions` schema per Supabase
-- convention, and guard every line so re-running the migration is a
-- no-op even if pg_cron is already scheduling an older version of the
-- job.
-- =============================================================================

create extension if not exists pg_cron with schema extensions;

create or replace function public.prune_stale_push_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  deleted_count integer;
begin
  with pruned as (
    delete from public.push_subscriptions
     where last_seen_at < now() - interval '56 days'
    returning id
  )
  select count(*) into deleted_count from pruned;
  return deleted_count;
end;
$$;

comment on function public.prune_stale_push_subscriptions() is
  'Deletes push_subscriptions rows not touched in >56 days (iOS silent expiry window). Returns the count pruned. Called nightly by a pg_cron job.';

-- Unschedule any previous version of this job so we end up with exactly
-- one schedule row. cron.unschedule returns an error if the job name
-- doesn't exist, so swallow it.
do $$
begin
  perform cron.unschedule('prune-stale-push-subscriptions');
exception when others then
  null;
end;
$$;

-- Run every day at 03:17 UTC — off-hours for both US and EU so it
-- doesn't compete with peak user activity.
select cron.schedule(
  'prune-stale-push-subscriptions',
  '17 3 * * *',
  $$ select public.prune_stale_push_subscriptions(); $$
);
