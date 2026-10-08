-- Lock down SECURITY DEFINER functions the public anon key can call.
--
-- Checked 8 Oct 2026 against production (project mmuglfphhwlaluyfyxsp,
-- the live Geck Inspect database). The retired project
-- dhotmtgryuovkmsncdby is not the one this app uses.
--
-- Do not apply this file to production until it has been run on a
-- Supabase branch database and the checks at the bottom have passed.
-- main is not a protected branch, so a merge is not a review.
--
-- What this changes
-- -----------------
-- 1. Admin, cron, trigger, and internal helpers lose EXECUTE for anon
--    and, where the app does not call them, for authenticated too.
--    service_role and the owner (postgres, which is how pg_cron runs)
--    keep EXECUTE.
-- 2. Admin RPCs the signed-in admin panel calls keep EXECUTE for
--    authenticated. Each one already raises unless is_admin() is true.
--    Revoking anon is defense in depth: an unsigned visitor no longer
--    reaches the function at all.
-- 3. is_collection_owner / member / editor stay callable, because row
--    security policies call them, but they only answer for the signed-in
--    email. An anonymous or signed-in caller can no longer ask whether
--    some other email owns a collection.
--
-- search_path is already set on every security definer function in
-- public and geck_data (catalog check, 8 Oct 2026). This file does not
-- change search_path.
--
-- Triggers keep working after EXECUTE is revoked from anon and
-- authenticated. Postgres checks that privilege when the trigger is
-- created, not each time it fires. Confirm that on the branch with the
-- checks below before this reaches production.

-- Internal helpers and jobs. Not called from the browser.
revoke execute on function public._price_game_sells_open() from public, anon, authenticated;
revoke execute on function public.active_comp_tier(text) from public, anon, authenticated;
revoke execute on function public.agent_traffic_summary(integer) from public, anon, authenticated;
revoke execute on function public.clear_lapsed_featured_breeders() from public, anon, authenticated;
revoke execute on function public.enqueue_season_planner_reminders() from public, anon, authenticated;
revoke execute on function public.join_waitlist(text, text, text, text, text, boolean) from public, anon, authenticated;

grant execute on function public._price_game_sells_open() to service_role;
grant execute on function public.active_comp_tier(text) to service_role;
grant execute on function public.agent_traffic_summary(integer) to service_role;
grant execute on function public.clear_lapsed_featured_breeders() to service_role;
grant execute on function public.enqueue_season_planner_reminders() to service_role;
grant execute on function public.join_waitlist(text, text, text, text, text, boolean) to service_role;

-- Trigger functions. Not API endpoints.
revoke execute on function public.breeder_profiles_protect_trust_columns() from public, anon, authenticated;
revoke execute on function public.content_reports_guard() from public, anon, authenticated;
revoke execute on function public.guard_unique_gecko_code() from public, anon, authenticated;
revoke execute on function public.prevent_blocked_message() from public, anon, authenticated;

grant execute on function public.breeder_profiles_protect_trust_columns() to service_role;
grant execute on function public.content_reports_guard() to service_role;
grant execute on function public.guard_unique_gecko_code() to service_role;
grant execute on function public.prevent_blocked_message() to service_role;

-- Signed-in RPCs. The function itself rejects a missing session.
-- The admin panel and the signed-in app call these with the user JWT,
-- so authenticated keeps EXECUTE. anon does not need it.
revoke execute on function public.admin_breeder_verification_queue() from public, anon;
revoke execute on function public.admin_growth_funnel(integer) from public, anon;
revoke execute on function public.admin_set_breeder_verified(uuid, boolean, jsonb) from public, anon;
revoke execute on function public.my_reviewable_transfers(uuid) from public, anon;
revoke execute on function public.sell_time_model() from public, anon;
revoke execute on function public.submit_breeder_review(uuid, integer, text, text) from public, anon;

grant execute on function public.admin_breeder_verification_queue() to authenticated, service_role;
grant execute on function public.admin_growth_funnel(integer) to authenticated, service_role;
grant execute on function public.admin_set_breeder_verified(uuid, boolean, jsonb) to authenticated, service_role;
grant execute on function public.my_reviewable_transfers(uuid) to authenticated, service_role;
grant execute on function public.sell_time_model() to authenticated, service_role;
grant execute on function public.submit_breeder_review(uuid, integer, text, text) to authenticated, service_role;

-- Collection helpers used by row security. Still granted to anon and
-- authenticated, but a caller can only ask about their own email.
create or replace function public.is_collection_owner(p_collection_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.collections
     where id = p_collection_id
       and coalesce(auth.email(), '') <> ''
       and lower(owner_email) = lower(auth.email())
       and lower(coalesce(p_email, '')) = lower(auth.email())
  );
$$;

create or replace function public.is_collection_member(p_collection_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.collection_members
     where collection_id = p_collection_id
       and coalesce(auth.email(), '') <> ''
       and lower(member_email) = lower(auth.email())
       and lower(coalesce(p_email, '')) = lower(auth.email())
       and status in ('pending', 'accepted')
  );
$$;

create or replace function public.is_collection_editor(p_collection_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.collection_members
     where collection_id = p_collection_id
       and coalesce(auth.email(), '') <> ''
       and lower(member_email) = lower(auth.email())
       and lower(coalesce(p_email, '')) = lower(auth.email())
       and status = 'accepted'
       and role in ('owner', 'editor')
  );
$$;

revoke execute on function public.is_collection_owner(uuid, text) from public;
revoke execute on function public.is_collection_member(uuid, text) from public;
revoke execute on function public.is_collection_editor(uuid, text) from public;
grant execute on function public.is_collection_owner(uuid, text) to anon, authenticated, service_role;
grant execute on function public.is_collection_member(uuid, text) to anon, authenticated, service_role;
grant execute on function public.is_collection_editor(uuid, text) to anon, authenticated, service_role;

-- Branch database checks. Do not run these against production as the
-- proof. Apply this file on a Supabase branch first, then:
--   anon: admin_growth_funnel, admin_set_breeder_verified,
--     admin_breeder_verification_queue, join_waitlist, active_comp_tier,
--     and agent_traffic_summary are permission denied.
--   a signed-in non-admin: the admin RPCs raise admin_only (42501),
--     which means authenticated can still execute them.
--   service_role: agent_traffic_summary and log_agent_hit still work.
--   anon still succeeds: landing_stats, open_price_index, log_agent_hit,
--     read_profiles for a public profile.
--   triggers still fire: change a gecko id code, change a non-admin
--     breeder trust column, insert a content report, insert a message
--     between blocked users. None of those may return
--     "permission denied for function".
--   a signed-in member: is_collection_owner(their collection, their
--     email) is true; the same call with another email is false; an
--     anon call is false.
