-- Audit batch A (4 Sep 2026, post-launch-night).
-- F36: internal and trigger functions were executable by anon and
--      authenticated because Postgres grants EXECUTE to PUBLIC by default.
--      Cron jobs run as postgres and triggers do not re-check EXECUTE at
--      fire time, so revoking from PUBLIC/anon/authenticated changes
--      nothing for the app and closes the door for direct RPC calls.
-- F36: promote_image_usage was a SECURITY DEFINER view (bypasses RLS).
-- F36: estimate_food_runout(p_user_email) returned another member's data
--      when handed their email. It now ignores the argument unless the
--      caller is the service role or an admin.
-- F45: error_logs accepted unlimited anonymous inserts. A BEFORE INSERT
--      trigger now drops rows past 20 per reporter per minute or 200 per
--      minute overall, and trims oversized fields.
-- F40: landing_stats() counted every profile row (121, most of them
--      legacy imports that never logged in). It now counts confirmed
--      accounts so "keepers signed up" is true.

-- ---------------------------------------------------------------------
-- F36a. Trigger and cron-only functions: nobody calls these over the API.
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._blog_touch_updated_date()',
    'public.admin_tasks_touch_updated_at()',
    'public.app_settings_touch_updated_at()',
    'public.bump_collection_updated_at()',
    'public.bump_gecko_change_ts_self()',
    'public.cleanup_transfer_requests_on_animal_delete()',
    'public.guard_notification_insert()',
    'public.handle_new_auth_user()',
    'public.protect_profile_privileged_columns()',
    'public.rls_auto_enable()',
    'public.set_testimonials_updated_at()',
    'public.store_products_update_search_vector()',
    'public.trg_bump_gecko_from_image()',
    'public.trg_bump_gecko_from_weight()',
    'public.cgd_reorder_reminder_run()',
    'public.process_scheduled_blog_posts()',
    'public.publish_due_scheduled_posts()'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', f);
    exception when undefined_function then
      raise notice 'skip missing %', f;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- F36b. Member-only RPCs: keep authenticated, drop anon.
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.consume_feature_credit(text, text, integer, integer)',
    'public.effective_tier_for_current_user()',
    'public.get_user_storage_bytes()',
    'public.claim_transfer(text, boolean)',
    'public.review_gecko_image(text, text, text, text[], jsonb, text, text[], text, text, text, text)',
    'public.admin_verify_gecko_image(text, text, text[], text[], text, text, text, text, text)',
    'public.next_unvoted_id_candidates(text, integer)',
    'public.nearest_training_samples(vector, integer, boolean)',
    'public.similar_gecko_images_by_url(text, integer)',
    'public.redeem_signup_grant(text)',
    'public.estimate_food_runout(text)'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    exception when undefined_function then
      raise notice 'skip missing %', f;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- F36c. estimate_food_runout: the email argument is advisory only.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.estimate_food_runout_unscoped(text)') is null then
    alter function public.estimate_food_runout(text) rename to estimate_food_runout_unscoped;
  end if;
end $$;
revoke all on function public.estimate_food_runout_unscoped(text) from public, anon, authenticated;

create or replace function public.estimate_food_runout(p_user_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.jwt() ->> 'email';
  v_privileged boolean := coalesce(auth.role(), '') = 'service_role' or public.is_admin();
begin
  if v_privileged and p_user_email is not null then
    return public.estimate_food_runout_unscoped(p_user_email);
  end if;
  if v_caller is null then
    return jsonb_build_object('has_food_history', false, 'reason', 'no_user');
  end if;
  return public.estimate_food_runout_unscoped(v_caller);
end;
$$;
revoke all on function public.estimate_food_runout(text) from public, anon;
grant execute on function public.estimate_food_runout(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- F36d. The one SECURITY DEFINER view.
-- ---------------------------------------------------------------------
alter view public.promote_image_usage set (security_invoker = true);

-- ---------------------------------------------------------------------
-- F45. Throttle error_logs inserts.
-- ---------------------------------------------------------------------
create index if not exists error_logs_created_date_idx
  on public.error_logs (created_date desc);

create or replace function public.throttle_error_logs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_recent integer;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  new.message    := left(coalesce(new.message, ''), 1000);
  new.stack      := left(new.stack, 4000);
  new.url        := left(new.url, 500);
  new.user_agent := left(new.user_agent, 300);
  if new.context is not null and pg_column_size(new.context) > 4000 then
    new.context := jsonb_build_object('truncated', true);
  end if;

  v_key := coalesce(new.user_email, new.created_by, new.user_agent, '');

  select count(*) into v_recent
    from public.error_logs
   where created_date > now() - interval '1 minute'
     and coalesce(user_email, created_by, user_agent, '') = v_key;
  if v_recent >= 20 then
    return null;  -- drop silently; the client must never see an error about errors
  end if;

  select count(*) into v_recent
    from public.error_logs
   where created_date > now() - interval '1 minute';
  if v_recent >= 200 then
    return null;
  end if;

  return new;
end;
$$;
revoke all on function public.throttle_error_logs() from public, anon, authenticated;

drop trigger if exists error_logs_throttle on public.error_logs;
create trigger error_logs_throttle
  before insert on public.error_logs
  for each row execute function public.throttle_error_logs();

-- ---------------------------------------------------------------------
-- F40. Count real accounts on the landing page.
-- ---------------------------------------------------------------------
create or replace function public.landing_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'keepers',  (select count(*) from auth.users where email_confirmed_at is not null and deleted_at is null),
    'geckos',   (select count(*) from public.geckos),
    'pairings', (select count(*) from public.breeding_plans)
  );
$$;
