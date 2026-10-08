-- Pin search_path on 13 invoker functions, hide three unused geck_data
-- views from the Data API, and take API execute away from the deletion
-- request trigger.
--
-- Production already applied version 20261008083025, so it will not run
-- this file again. A fresh replay (supabase db reset, or a preview
-- branch) does not have the geck_data functions and views that were
-- created from the archived geck-data repo. Each geck_data statement
-- runs only when that object exists. The public statements are
-- unchanged: those functions are created earlier in this repo.

-- geck_data helpers. Absent on a database that only replayed this repo.
do $$
begin
  if to_regprocedure('geck_data._age_class(text)') is not null then
    execute $stmt$alter function geck_data._age_class(text) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data._sex_class(text)') is not null then
    execute $stmt$alter function geck_data._sex_class(text) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data._drop_contained(text[])') is not null then
    execute $stmt$alter function geck_data._drop_contained(text[]) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.compare_trends(text[])') is not null then
    execute $stmt$alter function geck_data.compare_trends(text[]) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.feedle_import_markup()') is not null then
    execute $stmt$alter function geck_data.feedle_import_markup() set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.listing_price_history(text)') is not null then
    execute $stmt$alter function geck_data.listing_price_history(text) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.market_compare(integer)') is not null then
    execute $stmt$alter function geck_data.market_compare(integer) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.market_trend(text)') is not null then
    execute $stmt$alter function geck_data.market_trend(text) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.market_weekly(text)') is not null then
    execute $stmt$alter function geck_data.market_weekly(text) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.match_traits(text)') is not null then
    execute $stmt$alter function geck_data.match_traits(text) set search_path = ''$stmt$;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('geck_data.monthly_history(text)') is not null then
    execute $stmt$alter function geck_data.monthly_history(text) set search_path = ''$stmt$;
  end if;
end
$$;

alter function public.season_window_start(text, integer) set search_path = '';
alter function public.season_window_end(text, integer) set search_path = '';

-- No public reader. See README_advisor_exceptions.md.
-- These views come from the archived geck-data history. Skip the revoke
-- when a fresh replay never created them.
do $$
begin
  if to_regclass('geck_data.combo_index_daily') is not null then
    execute 'revoke all on geck_data.combo_index_daily from anon, authenticated';
  end if;
end
$$;

do $$
begin
  if to_regclass('geck_data.combo_weekly_prices_mv') is not null then
    execute 'revoke all on geck_data.combo_weekly_prices_mv from anon, authenticated';
  end if;
end
$$;

do $$
begin
  if to_regclass('geck_data.v_observed_traits') is not null then
    execute 'revoke all on geck_data.v_observed_traits from anon, authenticated';
  end if;
end
$$;

-- Trigger function from 20261003220000_account_erasure.sql.
-- Signature: public.notify_admins_of_deletion_request() returns trigger.
-- No arguments. Same revoke as the trigger functions in
-- 20261008063704_lock_security_definer_execute.sql.
-- Postgres checks EXECUTE when the trigger is created, not when it
-- fires, so support_messages_deletion_request_alert keeps running.
revoke execute on function public.notify_admins_of_deletion_request() from public, anon, authenticated;
