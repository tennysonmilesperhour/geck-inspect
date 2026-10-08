-- Pin search_path on 13 invoker functions, hide three unused geck_data
-- views from the Data API, and take API execute away from the deletion
-- request trigger.
--
-- Not applied. The owner applies this file after merge. Do not run it
-- from CI.

-- These 13 functions are language sql, security invoker, and they
-- schema-qualify every object they touch. A read-only check showed the
-- same output with search_path empty and with the default path.
alter function geck_data._age_class(text) set search_path = '';
alter function geck_data._sex_class(text) set search_path = '';
alter function geck_data._drop_contained(text[]) set search_path = '';
alter function geck_data.compare_trends(text[]) set search_path = '';
alter function geck_data.feedle_import_markup() set search_path = '';
alter function geck_data.listing_price_history(text) set search_path = '';
alter function geck_data.market_compare(integer) set search_path = '';
alter function geck_data.market_trend(text) set search_path = '';
alter function geck_data.market_weekly(text) set search_path = '';
alter function geck_data.match_traits(text) set search_path = '';
alter function geck_data.monthly_history(text) set search_path = '';
alter function public.season_window_start(text, integer) set search_path = '';
alter function public.season_window_end(text, integer) set search_path = '';

-- No public reader. See README_advisor_exceptions.md.
revoke all on geck_data.combo_index_daily from anon, authenticated;
revoke all on geck_data.combo_weekly_prices_mv from anon, authenticated;
revoke all on geck_data.v_observed_traits from anon, authenticated;

-- Trigger function from 20261003220000_account_erasure.sql.
-- Signature: public.notify_admins_of_deletion_request() returns trigger.
-- No arguments. Same revoke as the trigger functions in
-- 20261008063704_lock_security_definer_execute.sql.
-- Postgres checks EXECUTE when the trigger is created, not when it
-- fires, so support_messages_deletion_request_alert keeps running.
revoke execute on function public.notify_admins_of_deletion_request() from public, anon, authenticated;
