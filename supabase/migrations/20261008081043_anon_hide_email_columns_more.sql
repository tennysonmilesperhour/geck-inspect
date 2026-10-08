-- Owner emails off signed-out pages, part 2, step 2 of 2. NOT YET APPLIED.
--
-- BREAKING for any client that still reads these tables with `select *`
-- while signed out: Postgres refuses the whole query once a column in it
-- is not granted. Apply this only after the client that reads explicit
-- column lists (src/lib/publicColumns.js) is live in production, and after
-- 20261003220100_anon_hide_owner_email_columns.sql (geckos and photos).
-- Step 1 is 20261003022738_owner_profile_id_forum_store_welcome.sql.
--
-- A scan as the anon role on 3 Oct 2026 found email addresses readable by
-- signed-out visitors in 16 tables and in welcome_shelf(). After this:
--
-- 1. Signed-out visitors cannot read these tables at all. No signed-out
--    page reads them: user_activity, gecko_likes, questions, answers,
--    morph_traits, morph_price_cache.
-- 2. On the tables signed-out pages do read, they get every column except
--    the ones holding an email (created_by, owner_email, user_email,
--    uploader_email). Pages say who wrote a post or owns a store page with
--    owner_profile_id instead.
-- 3. Signed-in members lose other members' emails where nothing in the app
--    needs them: user_activity and gecko_likes rows are limited to the
--    member's own, and the email columns of gecko_of_the_day, questions
--    and answers are not readable by members either.
-- 4. welcome_shelf() stops returning the email key to signed-in callers
--    too. The new client looks follows up by profile id.
--
-- Columns added to these tables later are not readable when signed out
-- until they are granted here and listed in src/lib/publicColumns.js.
-- The column lists below must match src/lib/publicColumns.js. A unit test
-- (src/lib/__tests__/publicColumns.test.js) checks that they do.

-- ---------------------------------------------------------------------------
-- 1. Tables signed-out visitors do not need
-- ---------------------------------------------------------------------------
revoke select on public.user_activity from anon;
revoke select on public.gecko_likes from anon;
revoke select on public.questions from anon;
revoke select on public.answers from anon;
revoke select on public.morph_traits from anon;
revoke select on public.morph_price_cache from anon;

-- ---------------------------------------------------------------------------
-- 2. Signed-out column grants
-- ---------------------------------------------------------------------------
revoke select on public.forum_posts from anon;
grant select (
  id, title, content, category_id, author_name, image_urls,
  is_pinned, is_locked, view_count, created_date, updated_date,
  owner_profile_id
) on public.forum_posts to anon;

revoke select on public.forum_comments from anon;
grant select (
  id, post_id, content, author_name, image_urls, parent_comment_id,
  created_date, updated_date, owner_profile_id
) on public.forum_comments to anon;

revoke select on public.forum_likes from anon;
grant select (
  id, target_id, target_type, created_date, updated_date
) on public.forum_likes to anon;

revoke select on public.forum_categories from anon;
grant select (
  id, name, description, order_position, is_active, created_date,
  updated_date
) on public.forum_categories to anon;

revoke select on public.care_guide_sections from anon;
grant select (
  id, title, content, order_position, category, image_urls,
  is_published, source_url, last_updated, created_date, updated_date
) on public.care_guide_sections to anon;

revoke select on public.morph_guides from anon;
grant select (
  id, morph_name, description, key_features, example_image_url,
  rarity, breeding_info, created_date, updated_date
) on public.morph_guides to anon;

revoke select on public.page_config from anon;
grant select (
  id, page_name, display_name, category, icon, is_enabled,
  requires_auth, order_position, created_date, updated_date, section
) on public.page_config to anon;

revoke select on public.gecko_of_the_day from anon;
grant select (
  id, date, gecko_image_id, appreciative_message, created_date,
  updated_date
) on public.gecko_of_the_day to anon;

revoke select on public.breeder_store_pages from anon;
grant select (
  id, slug, title, tagline, description, header_image_url,
  contact_link, secondary_link, is_published, created_date,
  updated_date, policies, external_links, featured_gecko_ids,
  featured_breeding_plan_ids, slug_changed_at, slug_change_count,
  owner_profile_id
) on public.breeder_store_pages to anon;

revoke select on public.breeding_plans from anon;
grant select (
  id, sire_id, dam_id, breeding_id, pairing_date, copulation_events,
  egg_check_day, egg_check_count, first_egg_lay_date,
  expected_lay_interval, laying_active, dormant_since, status, notes,
  archived, archived_date, breeding_season, is_public, created_date,
  updated_date
) on public.breeding_plans to anon;

revoke select on public.feeding_records from anon;
grant select (
  id, animal_id, date, food_type, accepted, notes,
  created_date, updated_date
) on public.feeding_records to anon;

revoke select on public.shed_records from anon;
grant select (
  id, animal_id, date, quality, notes, created_date,
  updated_date
) on public.shed_records to anon;

revoke select on public.vet_records from anon;
grant select (
  id, animal_id, date, vet_name, reason, findings, treatment,
  follow_up, attachments, created_date, updated_date
) on public.vet_records to anon;

revoke select on public.ownership_records from anon;
grant select (
  id, animal_id, owner_user_id, owner_name, owner_avatar_url,
  acquired_date, transfer_method, sale_price, contributed_to_market_data,
  notes, created_date, updated_date
) on public.ownership_records to anon;

-- ---------------------------------------------------------------------------
-- 3. Signed-in members
-- ---------------------------------------------------------------------------

-- Activity points: a member reads their own rows; admins read all (the
-- admin user page). GeckoForm's insert reads back its own row, which this
-- still allows.
drop policy if exists "user_activity_read_all" on public.user_activity;
drop policy if exists "user_activity_read_own" on public.user_activity;
create policy "user_activity_read_own" on public.user_activity
  for select to authenticated
  using (
    user_email = (select auth.email())
    or created_by = (select auth.email())
    or public.is_admin()
  );

-- Photo likes: nothing in the app reads them today. A member sees the
-- likes they gave and the likes on their own photos.
drop policy if exists "gecko_likes_read_all" on public.gecko_likes;
drop policy if exists "gecko_likes_read_own" on public.gecko_likes;
create policy "gecko_likes_read_own" on public.gecko_likes
  for select to authenticated
  using (
    user_email = (select auth.email())
    or owner_email = (select auth.email())
    or created_by = (select auth.email())
    or public.is_admin()
  );

-- Gecko of the Day: nobody in the app needs the uploader's email (the
-- Dashboard reads GECKO_OF_THE_DAY_COLUMNS for everyone). Rows are written
-- by the server, not by members.
revoke select on public.gecko_of_the_day from authenticated;
grant select (
  id, date, gecko_image_id, appreciative_message, created_date,
  updated_date
) on public.gecko_of_the_day to authenticated;

-- Questions and answers: no page reads these tables yet.
revoke select on public.questions from authenticated;
grant select (
  id, author_id, title, body, tags, status, best_answer_id, view_count,
  upvote_count, is_featured, created_date, updated_date
) on public.questions to authenticated;

revoke select on public.answers from authenticated;
grant select (
  id, question_id, author_id, body, upvote_count, is_best_answer,
  created_date, updated_date
) on public.answers to authenticated;

-- ---------------------------------------------------------------------------
-- 4. New keepers rail without email addresses
-- ---------------------------------------------------------------------------
create or replace function public.welcome_shelf(p_limit integer default 6)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
SELECT coalesce(json_agg(row_to_json(rows) ORDER BY rows.created_date DESC), '[]'::json)
FROM (
  SELECT
    p.id::text AS id,
    coalesce(nullif(p.full_name, ''), nullif(p.business_name, ''), 'Geck Inspect keeper') AS display_name,
    p.profile_image_url,
    p.created_date
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
    AND p.created_date > now() - interval '7 days'
  ORDER BY p.created_date DESC
  LIMIT p_limit
) rows;
$$;
