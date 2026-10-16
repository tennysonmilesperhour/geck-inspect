-- Privacy: log retention and private breeding project finances
-- (comprehensive review of 14 Oct 2026, plan item E3 31, and the
-- adversarial review's privacy findings).
--
-- 1. A 90-day retention job.
--    Why: error reports, the crawler log and copies of payment webhooks
--    were kept forever. Error reports carry the member's email and the page
--    address; webhook copies carry the customer's name, email and billing
--    address. Nothing needs them after three months: the admin error log
--    and the nightly triage read the last day, the agent review reads the
--    last week, and Stripe stops retrying an event after three days.
--    public.apply_privacy_retention(days default 90), run daily by pg_cron
--    as job 'privacy-retention-daily' (04:05 UTC):
--      * public.error_logs and geck_data.error_logs: rows older than the
--        cutoff are deleted.
--      * public.agent_hits: rows older than the cutoff are deleted. The
--        weekly agent review keeps its own summaries in docs/agent-review.
--      * public.stripe_webhook_logs: the row stays, the raw payload is
--        cleared. stripe-webhook and store-stripe-webhook look rows up by
--        stripe_event_id and processing_status to skip an event they
--        already applied, and the admin reads the type and outcome, so the
--        row matters; the full Stripe event does not. (A later run of
--        rebuild_payment_events_from_webhook_log() can only rebuild the
--        last 90 days; it ran once on 15 Oct 2026 over the whole history.)
--      * public.payment_events: the ledger row stays (revenue, refunds and
--        cancellations are read from its columns), raw_stripe_payload is
--        cleared.
--      * public.revenuecat_webhook_events: the row stays (revenuecat-webhook
--        skips an event id it has seen), the payload becomes {} because the
--        column is NOT NULL.
--    The first run removes about 56 app error reports and 574 Geck
--    Intellect error reports from April to mid July (counted read-only on
--    16 Oct 2026); no webhook row was older than 90 days that day.
--
-- 2. breeding_projects, clutches and genetic_outcome_predictions are
--    readable by their owner and by admins only.
--    Why: each had a "Public read" policy (USING true, for every role), so
--    any signed-in member could read every other member's acquisition
--    costs, feeding and housing costs and revenue, and anon held column
--    grants on them. No app code reads these tables (they back the old
--    breeding-project entities in src/api/supabaseEntities.js, which no
--    page calls), none is shared through collections, production holds 0
--    rows in each, and the only function that touches them
--    (admin_erase_account) is SECURITY DEFINER. The insert, update and
--    delete policies were already owner-only and are left as they are.
--    anon loses its grants on the three tables: signed-out visitors have
--    no policy that lets them use them anyway.
--
-- Safe for the app already open in members' browsers: nothing it calls
-- changes shape. Safe to run more than once. The new function grants
-- EXECUTE explicitly (supabase/SCHEMA_CONVENTIONS.md 4a): service_role
-- only, since pg_cron runs it as the owner.

-- 1. Retention ---------------------------------------------------------------

create or replace function public.apply_privacy_retention(p_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cutoff       timestamptz;
  v_error_logs   bigint := 0;
  v_market_logs  bigint := 0;
  v_agent_hits   bigint := 0;
  v_stripe_logs  bigint := 0;
  v_payments     bigint := 0;
  v_revenuecat   bigint := 0;
begin
  -- Server only, like the other maintenance functions: a call through the
  -- API carries a role claim, and only service_role passes. pg_cron and the
  -- SQL console carry none.
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'apply_privacy_retention: service role only';
  end if;
  -- A slip such as 0 or 9 would wipe the logs the admin is reading today.
  if p_days is null or p_days < 30 then
    raise exception 'apply_privacy_retention: keep at least 30 days (got %)', p_days;
  end if;
  v_cutoff := now() - make_interval(days => p_days);

  delete from public.error_logs e
   where e.created_date < v_cutoff;
  get diagnostics v_error_logs = row_count;

  -- Geck Intellect's error log lives in the same database; it holds the
  -- same kind of data (email, page address, browser).
  if to_regclass('geck_data.error_logs') is not null then
    execute 'delete from geck_data.error_logs where created_date < $1' using v_cutoff;
    get diagnostics v_market_logs = row_count;
  end if;

  delete from public.agent_hits h
   where h.at < v_cutoff;
  get diagnostics v_agent_hits = row_count;

  update public.stripe_webhook_logs l
     set raw_payload = null,
         updated_date = now()
   where l.raw_payload is not null
     and coalesce(l.created_date, l.processed_at, l.updated_date) < v_cutoff;
  get diagnostics v_stripe_logs = row_count;

  update public.payment_events p
     set raw_stripe_payload = null,
         updated_date = now()
   where p.raw_stripe_payload is not null
     and coalesce(p.created_date, p.event_timestamp) < v_cutoff;
  get diagnostics v_payments = row_count;

  update public.revenuecat_webhook_events r
     set payload = '{}'::jsonb
   where r.payload <> '{}'::jsonb
     and r.received_at < v_cutoff;
  get diagnostics v_revenuecat = row_count;

  return jsonb_build_object(
    'cutoff', v_cutoff,
    'error_logs_deleted', v_error_logs,
    'market_error_logs_deleted', v_market_logs,
    'agent_hits_deleted', v_agent_hits,
    'stripe_webhook_payloads_cleared', v_stripe_logs,
    'payment_event_payloads_cleared', v_payments,
    'revenuecat_payloads_cleared', v_revenuecat
  );
end
$function$;

comment on function public.apply_privacy_retention(integer) is
  'Daily privacy retention (pg_cron job privacy-retention-daily): deletes error logs and crawler hits older than p_days (default 90) and clears old webhook payloads while keeping the rows billing needs.';

revoke all on function public.apply_privacy_retention(integer) from public;
revoke all on function public.apply_privacy_retention(integer) from anon;
revoke all on function public.apply_privacy_retention(integer) from authenticated;
grant execute on function public.apply_privacy_retention(integer) to service_role;

-- cron.schedule with a fixed name replaces the job if it exists, so a
-- second run of this file leaves one job.
select cron.schedule(
  'privacy-retention-daily',
  '5 4 * * *',
  $cron$ select public.apply_privacy_retention(90); $cron$
);

-- 2. Breeding project finances: owner or admin only -------------------------

drop policy if exists "Public read breeding projects" on public.breeding_projects;
drop policy if exists breeding_projects_select_own on public.breeding_projects;
create policy breeding_projects_select_own on public.breeding_projects
  for select to authenticated
  using (created_by = (select auth.email()) or (select public.is_admin()));

drop policy if exists "Public read clutches" on public.clutches;
drop policy if exists clutches_select_own on public.clutches;
create policy clutches_select_own on public.clutches
  for select to authenticated
  using (created_by = (select auth.email()) or (select public.is_admin()));

drop policy if exists "Public read genetic outcomes" on public.genetic_outcome_predictions;
drop policy if exists genetic_outcome_predictions_select_own on public.genetic_outcome_predictions;
create policy genetic_outcome_predictions_select_own on public.genetic_outcome_predictions
  for select to authenticated
  using (created_by = (select auth.email()) or (select public.is_admin()));

-- Revoking the table privileges also removes the column grants anon held.
revoke all on table public.breeding_projects from anon;
revoke all on table public.clutches from anon;
revoke all on table public.genetic_outcome_predictions from anon;
