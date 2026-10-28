-- Members' email addresses off the rows other members read, step 1 of 2
-- (28 Oct 2026). Additive only: safe for the app that is already open.
--
-- Why: any signed-in account could read about 35 members' addresses from
-- columns that hold the author's or owner's email (gecko_images.created_by,
-- forum_posts.created_by, forum_comments.created_by, forum_likes.user_email,
-- breeder_profiles.created_by and more). 20261015130000 took these columns
-- away from signed-out visitors; signed-in members still had them
-- (comprehensive review, Part E, item E1 4).
--
-- Step 1 (this file, with the app change in the same merge) gives the app
-- what it needs so it never reads another member's email column:
--
--   1. my_row_ids(table): the ids of the caller's own rows, so "my badges"
--      and similar reads stop filtering on the email column.
--   2. forum_like_state(ids): like counts and "liked by me" for forum posts
--      and comments, without anyone's address.
--   3. community_reaction_state(types, ids): the same for Live Feed
--      reactions.
--   4. notify_forum_thread_author(comment id): the "commented on your post"
--      and "replied to your comment" notification. The browser used to read
--      the author's email from the post to address it; the database now
--      finds the author itself and applies the same checks as before
--      (member_notification_template).
--   5. is_giveaway_host(id): the giveaway entries read rule asked
--      giveaways.created_by as the member; it now asks this helper, so the
--      rule keeps working once members lose that column.
--   6. next_unvoted_id_candidates: "uploaded by a member" is now
--      owner_profile_id is not null instead of created_by is not null. The
--      set_owner_profile_id trigger keeps the two in step (checked on
--      production 28 Oct 2026: 34 candidate photos either way).
--
-- Step 2 (supabase/pending/member_email_columns_revoke.sql) takes the email
-- columns from signed-in members. It moves to supabase/migrations only once
-- this step has been live for 3 days, so every open tab has reloaded.
--
-- Function bodies: next_unvoted_id_candidates starts from production's
-- definition (pg_get_functiondef, md5 7eba4bacfeeca644ca696b6c2fda8b47, the
-- same as the baseline 20260410025954_remote_schema.sql) with one line
-- changed. The giveaway_entries_read policy keeps its meaning.
--
-- Safe to run more than once: create or replace, drop policy if exists.
--
-- Tests: supabase/tests/member_email_reads_regressions.sql, and with step 2
-- applied, supabase/pending/member_email_columns_revoke_regressions.sql.

-- =====================================================================
-- 1. The caller's own row ids
-- =====================================================================
-- Returns ids only. The page then reads those rows by id with its usual
-- column list, so row rules and column grants still apply to the read.
create or replace function public.my_row_ids(p_table text)
returns text[]
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_me text := auth.email();
  v_col text;
  v_ids text[];
begin
  -- A fixed list: the table name never reaches the query unless it is one
  -- of these, so the caller cannot name any other table or column.
  v_col := case p_table
    when 'gecko_images' then 'created_by'
    when 'forum_posts' then 'created_by'
    when 'forum_comments' then 'created_by'
    when 'forum_likes' then 'created_by'
    when 'breeder_profiles' then 'created_by'
    when 'breeder_reviews' then 'created_by'
    when 'morph_guide_comments' then 'user_email'
    when 'user_badges' then 'user_email'
    when 'giveaways' then 'created_by'
    when 'morph_price_entries' then 'created_by'
  end;
  if v_col is null then
    raise exception 'my_row_ids does not cover that table' using errcode = '22023';
  end if;
  if v_me is null then
    return '{}'::text[];
  end if;
  execute format(
    'select coalesce(array_agg(t.id::text order by t.id::text), ''{}''::text[]) from public.%I t where t.%I = $1',
    p_table, v_col)
    into v_ids
    using v_me;
  return v_ids;
end;
$function$;

comment on function public.my_row_ids(text) is
  'The ids of the signed-in caller''s own rows in one of the tables whose owner column holds an email address. Lets the app find "mine" without reading or filtering on the email column.';

-- =====================================================================
-- 2. Forum likes: counts, and whether the caller liked it
-- =====================================================================
create or replace function public.forum_like_state(p_target_ids text[])
returns table(target_id text, like_count integer, liked boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  select l.target_id,
         count(*)::integer,
         coalesce(bool_or(auth.email() is not null
                          and auth.email() in (l.created_by, l.user_email)), false)
    from public.forum_likes l
   where l.target_id = any (p_target_ids[1:500])
   group by l.target_id;
$function$;

comment on function public.forum_like_state(text[]) is
  'Like counts for forum posts and comments, and whether the caller liked each one. Never returns who liked.';

-- =====================================================================
-- 3. Live Feed reactions: counts, and whether the caller reacted
-- =====================================================================
create or replace function public.community_reaction_state(p_event_types text[], p_event_ids text[])
returns table(event_type text, event_id text, reaction text, reaction_count integer, mine boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  select r.event_type,
         r.event_id,
         r.reaction,
         count(*)::integer,
         coalesce(bool_or(auth.email() is not null and r.user_email = auth.email()), false)
    from public.community_event_reactions r
   where r.event_type = any (p_event_types[1:20])
     and r.event_id = any (p_event_ids[1:200])
   group by r.event_type, r.event_id, r.reaction;
$function$;

comment on function public.community_reaction_state(text[], text[]) is
  'Live Feed reaction counts, and which reactions are the caller''s own. Never returns who reacted.';

-- =====================================================================
-- 4. Forum comment and reply notifications
-- =====================================================================
-- The caller names the comment they just wrote. The database finds who to
-- tell (the author of the comment it answers, otherwise the post's author)
-- and runs the same checks a member's own notification insert runs:
-- member_notification_template refuses unless the caller wrote a comment on
-- that post in the last hour and the recipient has posted in the thread,
-- refuses between members who blocked each other, sends the same
-- notification at most once in 10 minutes and caps how many people a member
-- reaches in an hour. The text and link come from its fixed template.
-- Returns true when a notification was written, false when there was no one
-- to tell (the caller's own post, no author, a repeat, or a comment still
-- waiting for approval).
create or replace function public.notify_forum_thread_author(p_comment_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_me text := auth.email();
  v_post_id text;
  v_parent_id text;
  v_author text;
  v_status text;
  v_to text;
  v_type text;
  v_tpl jsonb;
begin
  if v_me is null then
    raise exception 'Sign in to send notifications' using errcode = '42501';
  end if;

  select c.post_id, c.parent_comment_id, c.created_by, c.approval_status
    into v_post_id, v_parent_id, v_author, v_status
    from public.forum_comments c
   where c.id = p_comment_id;
  if not found or v_author is distinct from v_me then
    raise exception 'There is no comment of yours with that id' using errcode = '42501';
  end if;
  -- A comment waiting for review is private, so nobody hears about it yet.
  if coalesce(v_status, 'approved') <> 'approved' then
    return false;
  end if;

  -- As before: a reply goes to the comment's author, falling back to the
  -- post's author when that comment has none.
  v_type := case when v_parent_id is null then 'new_comment' else 'new_reply' end;
  if v_parent_id is not null then
    select p.created_by into v_to
      from public.forum_comments p
     where p.id = v_parent_id and p.post_id = v_post_id;
  end if;
  if v_to is null then
    select fp.created_by into v_to from public.forum_posts fp where fp.id = v_post_id;
  end if;
  if nullif(btrim(coalesce(v_to, '')), '') is null or lower(btrim(v_to)) = lower(v_me) then
    return false;
  end if;

  v_tpl := public.member_notification_template(v_to, v_type, jsonb_build_object('post_id', v_post_id));
  if coalesce((v_tpl ->> 'skip')::boolean, false) then
    return false;
  end if;

  insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by, created_date)
  values (lower(btrim(v_to)), v_type, v_tpl ->> 'content', public.safe_internal_link(v_tpl ->> 'link'),
          v_tpl -> 'metadata', false, v_me, now());
  return true;
end;
$function$;

comment on function public.notify_forum_thread_author(text) is
  'Tells the author of a forum post or comment that the caller answered it. The database finds the recipient, so the browser never needs their email address.';

-- =====================================================================
-- 5. Giveaway entries: the host check without reading giveaways.created_by
-- =====================================================================
-- A read rule's subquery runs with the member's own column rights. Once
-- step 2 takes giveaways.created_by from members, the old subquery would
-- make every read of giveaway_entries fail. Same meaning as before.
create or replace function public.is_giveaway_host(p_giveaway_id text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select auth.email() is not null
     and exists (select 1 from public.giveaways g
                  where g.id = p_giveaway_id and g.created_by = auth.email());
$function$;

drop policy if exists "giveaway_entries_read" on public.giveaway_entries;
create policy "giveaway_entries_read" on public.giveaway_entries
  for select
  using (
    (select auth.email()) = user_email
    or public.is_giveaway_host(giveaway_id)
  );

-- =====================================================================
-- 6. ID needs panel: member uploads by owner_profile_id
-- =====================================================================
-- Starts from production (see the header). Only the created_by line
-- changed: this function runs with the member's own rights, so it must not
-- read the email column.
CREATE OR REPLACE FUNCTION public.next_unvoted_id_candidates(reviewer text, lim integer DEFAULT 20)
 RETURNS TABLE(id text, image_url text, primary_morph text, base_color text, created_date timestamp with time zone, verified boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT g.id, g.image_url, g.primary_morph, g.base_color, g.created_date, g.verified
  FROM public.gecko_images g
  WHERE g.primary_morph IS NOT NULL
    AND g.image_url IS NOT NULL
    AND g.owner_profile_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.classification_votes v
      WHERE v.gecko_image_id = g.id
        AND v.reviewer_email = reviewer
    )
  ORDER BY g.created_date DESC NULLS LAST
  LIMIT GREATEST(lim, 1);
$function$;

-- =====================================================================
-- Grants (since 20261015130000 a new function runs only for the roles it
-- is granted to). next_unvoted_id_candidates keeps its existing grants.
-- =====================================================================
revoke all on function public.my_row_ids(text) from public, anon;
grant execute on function public.my_row_ids(text) to authenticated, service_role;

revoke all on function public.forum_like_state(text[]) from public;
grant execute on function public.forum_like_state(text[]) to anon, authenticated, service_role;

revoke all on function public.community_reaction_state(text[], text[]) from public;
grant execute on function public.community_reaction_state(text[], text[]) to anon, authenticated, service_role;

revoke all on function public.notify_forum_thread_author(text) from public, anon;
grant execute on function public.notify_forum_thread_author(text) to authenticated, service_role;

-- The read rule applies to every role, so every API role needs it.
revoke all on function public.is_giveaway_host(text) from public;
grant execute on function public.is_giveaway_host(text) to anon, authenticated, service_role;
