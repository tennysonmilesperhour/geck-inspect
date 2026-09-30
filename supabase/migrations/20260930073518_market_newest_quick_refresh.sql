-- Market: a quick refresh for the newest-listings check (30 Sep 2026).
--
-- The newest check reads MorphMarket's first pages about every 30 minutes
-- (geck-data, scrape_listings_api.py --mode=newest) and then asks for a
-- market refresh. Refreshing every market view takes about 55 seconds of
-- database time, while new listings only need the two views behind the
-- Live tape, the watchlist matcher and the morning brief (about 2
-- seconds). So a batch of requests that all come from the newest check
-- refreshes just those two. Anything else (a catalog walk, Korea, Japan
-- and Europe, the hourly job) still refreshes everything, and only a full
-- refresh asks for a new collection value, as before.

create or replace function geck_data.refresh_listing_matviews()
returns void
language sql
security definer
set search_path to 'pg_catalog', 'geck_data', 'extensions'
as $$
  refresh materialized view concurrently geck_data.listing_market_mv;
  refresh materialized view concurrently geck_data.listing_facts_mv;
$$;

revoke all on function geck_data.refresh_listing_matviews() from public, anon, authenticated;
grant execute on function geck_data.refresh_listing_matviews() to service_role;

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

  -- The newest check only adds a few listings, so it refreshes the two
  -- listing views instead of all of them.
  if p_trigger = 'newest' then
    perform geck_data.refresh_listing_matviews();
  else
    perform geck_data.refresh_market_matviews();
  end if;

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

  begin
    v_result := v_result || jsonb_build_object('alerts', geck_data.match_alerts());
  exception when others then
    v_result := v_result || jsonb_build_object('alerts_error', sqlerrm);
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

create or replace function geck_data.run_requested_after_scrape()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_taken integer;
  v_full integer;
begin
  with taken as (
    update geck_data.after_scrape_requests r
       set handled_at = now()
     where r.id in (
       select q.id from geck_data.after_scrape_requests q
        where q.handled_at is null
        for update skip locked
     )
    returning r.source
  )
  select count(*), count(*) filter (where coalesce(t.source, '') not like 'newest%')
    into v_taken, v_full
    from taken t;

  if v_taken = 0 then
    return jsonb_build_object('requests', 0);
  end if;
  -- Only requests from the newest check get the quick refresh; any other
  -- source in the batch gets the full one.
  return geck_data.after_scrape(case when v_full > 0 then 'requested' else 'newest' end)
         || jsonb_build_object('requests', v_taken, 'full_requests', v_full);
end;
$$;
