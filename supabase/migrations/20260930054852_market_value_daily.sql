-- Daily market value of each member's crested geckos (30 Sep 2026).
--
-- The Portfolio already writes a collection_valuations row, but only when a
-- member opens that page, and its total mixes in asking prices the member
-- typed and AI estimates. The Today card, the market brief and the Sunday
-- digest need a number that moves with the market and exists for every
-- member every day, so the market-value-snapshot edge function values each
-- member's crested geckos from the Geck Data trait value table (the same
-- code as the Portfolio) and writes one row per member per day here.
--
--   value       sum of each priced gecko at its quality tier (breeder grade
--               at the median, pet at p25, and so on)
--   value_low   sum of the typical range's low end (p25) for those geckos
--   value_high  sum of the high end (p75)
--   details     one entry per priced gecko: trait, band, value
--
-- Members read their own rows. Only the service role writes.

create table if not exists public.market_value_daily (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  day date not null,
  geckos integer not null default 0,
  priced integer not null default 0,
  value numeric(12, 2) not null default 0,
  value_low numeric(12, 2) not null default 0,
  value_high numeric(12, 2) not null default 0,
  details jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (user_email, day)
);

alter table public.market_value_daily enable row level security;

drop policy if exists "Members read their own market value" on public.market_value_daily;
create policy "Members read their own market value"
  on public.market_value_daily for select to authenticated
  using (user_email = lower((select auth.jwt()) ->> 'email'));

revoke all on public.market_value_daily from anon, authenticated;
grant select on public.market_value_daily to authenticated;
grant select, insert, update, delete on public.market_value_daily to service_role;

-- Ask the edge function to revalue every collection. It reads the same
-- Vault secret the notifications trigger uses, at run time, so the value
-- never sits in cron.job.
create or replace function public.request_market_value_snapshot()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;
  if coalesce(v_key, '') = '' then
    return;
  end if;
  perform net.http_post(
    url := 'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/market-value-snapshot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.request_market_value_snapshot() from public, anon, authenticated;
grant execute on function public.request_market_value_snapshot() to service_role;

-- After a scraper finishes, revalue collections too, so the Today card
-- shows the new market the same morning.
create or replace function geck_data.after_scrape(p_trigger text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_run bigint;
  v_today date := (now() at time zone 'UTC')::date;
  v_rows integer;
  v_result jsonb;
begin
  -- One run at a time; a second caller waits for the first to finish.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('geck_data.after_scrape'));

  insert into geck_data.after_scrape_runs (trigger) values (left(coalesce(p_trigger, 'manual'), 40))
  returning id into v_run;

  perform geck_data.refresh_market_matviews();

  -- A failed snapshot must not undo the refresh the site depends on, so
  -- it runs in its own block and reports the error instead.
  begin
    -- A scrape that runs past midnight UTC still belongs to the day it
    -- started, so yesterday is rebuilt during the first hours of a day.
    if extract(hour from now() at time zone 'UTC') < 6 then
      perform geck_data.snapshot_market_day(v_today - 1);
    end if;
    v_rows := geck_data.snapshot_market_day(v_today);
    v_result := jsonb_build_object('snapshot_rows', v_rows);
  exception when others then
    v_result := jsonb_build_object('snapshot_error', sqlerrm);
  end;

  if p_trigger = 'requested' then
    begin
      perform public.request_market_value_snapshot();
      v_result := v_result || jsonb_build_object('value_snapshot', 'requested');
    exception when others then
      v_result := v_result || jsonb_build_object('value_snapshot_error', sqlerrm);
    end;
  end if;

  update geck_data.after_scrape_runs
     set finished_at = now(), result = v_result
   where id = v_run;
  return v_result;
end;
$$;

revoke all on function geck_data.after_scrape(text) from public, anon, authenticated;
grant execute on function geck_data.after_scrape(text) to service_role;

-- Every day, whether or not a scrape ran, so each member has a row per day.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'market-value-daily') then
    perform cron.unschedule('market-value-daily');
  end if;
  perform cron.schedule('market-value-daily', '40 12 * * *',
    $cron$ select public.request_market_value_snapshot(); $cron$);
end
$$;
