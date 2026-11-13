-- Owner email addresses, step 1 continued: two functions that run as
-- their owner handed signed-in members the owner's email, whatever the
-- column rights say. Owner decision E16; plan in
-- docs/planning/owner-emails-2026-11.md.
--
-- Step 2 takes created_by on geckos, breeding plans and the care records
-- away from members. A function that runs as its owner is not bound by
-- that, so these two would have kept giving the address out:
--
--   1. public_profile_content(profile id), the public profile page. Its
--      gecko and plan rows carried created_by for any signed-in caller
--      (signed-out callers already got it removed). The page never uses
--      it. Now nobody gets it.
--   2. community_gecko_counts(), which returned every keeper's email with
--      their gecko counts to any signed-in caller. The app has used
--      community_owner_gecko_counts (by profile id) since October and no
--      longer calls it. Members and visitors can no longer run it; the
--      function itself stays.
--
-- Body of public_profile_content from production as read with
-- pg_get_functiondef on 13 November 2026, with the email always removed.
-- Regression file: supabase/tests/owner_emails_functions_regressions.sql.
-- Idempotent.

create or replace function public.public_profile_content(p_profile_id text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare p public.profiles; g jsonb := '[]'; b jsonb := '[]'; s jsonb;
begin
  select * into p from public.profiles where id=p_profile_id and (is_public_profile=true or email=auth.email() or public.is_admin())
    and (moderation_hidden=false or email=auth.email() or public.is_admin());
  if p.id is null then return null; end if;
  -- No row carries the owner's email (created_by), for anyone: the page
  -- says who owns them by the profile it was asked about.
  if p.privacy_show_collection is distinct from false then
    select coalesce(jsonb_agg(to_jsonb(x) - 'created_by'),'[]') into g from public.geckos x where x.created_by=p.email and x.is_public=true and x.archived is distinct from true
      and (x.moderation_hidden=false or p.email=auth.email() or public.is_admin());
    select coalesce(jsonb_agg(to_jsonb(x) - 'created_by'),'[]') into b from public.breeding_plans x where x.created_by=p.email and x.is_public=true;
  end if;
  select jsonb_build_object('slug',slug,'is_published',is_published,'title',title) into s
    from public.breeder_store_pages where owner_email=p.email and is_published=true
      and (moderation_hidden=false or p.email=auth.email() or public.is_admin()) limit 1;
  return jsonb_build_object('geckos',g,'breeding_plans',b,'store_page',s);
end $function$;

revoke all on function public.public_profile_content(text) from public;
grant execute on function public.public_profile_content(text) to anon, authenticated, service_role;

revoke all on function public.community_gecko_counts() from public, anon, authenticated;
grant execute on function public.community_gecko_counts() to service_role;
