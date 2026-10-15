-- Notifications, messages, data exposure and account erasure (15 Oct 2026).
--
-- The comprehensive review of 14 October (docs/planning/
-- comprehensive-review-2026-10-14.md, Part C) and the adversarial review
-- found these holes. Each section below says what was wrong, what changes
-- and why. Every function redefined here starts from production's own
-- definition (read with pg_get_functiondef on 15 Oct 2026, identical to the
-- repo) with only the lines named in the section changed.
--
-- Safe to run more than once: functions are create-or-replace, policies and
-- triggers are dropped before they are created, the new column uses
-- "if not exists", and revokes are no-ops the second time.
--
-- Tests: supabase/tests/comms_exposure_regressions.sql
--
--  1. Notifications: a member could email and push any other member from
--     the official address with their own words and link.
--  2. Direct messages: the recipient could rewrite a message and its sender.
--  3. Morph ID usage log: every member could read every other member's rows.
--  4. Member emails: read_profiles, community_feed and the visual search
--     handed other members' emails to any signed-in caller.
--  5. Market Intelligence: the brief, the live feed and watchlists answered
--     any signed-in member, although the product is Enterprise only.
--  6. Account deletion: anyone could file a deletion request in another
--     member's name and an admin could act on it.
--  7. Sold prices: signed-out visitors could read what a gecko sold for.
--  8. Table and function privileges the API roles never need.
--  9. Account erasure deleted the care history of geckos the member had sold.

-- =====================================================================
-- Shared: who is calling
-- =====================================================================
--
-- Several guards below need to tell a member's own request apart from
-- the app's server code. Inside a SECURITY INVOKER trigger, current_user is
-- the role that ran the statement:
--   * 'authenticated' or 'anon' for a request from a browser or the app;
--   * 'postgres' when one of our own SECURITY DEFINER functions (owned by
--     postgres) wrote the row, for example a reminder job or join_waitlist;
--   * 'service_role' for edge functions.
-- auth.role() cannot make this distinction: it reads the caller's token,
-- which still says 'authenticated' inside a server function the member
-- called. That is why these guards are SECURITY INVOKER.

-- =====================================================================
-- 1. Notifications
-- =====================================================================
--
-- Before: the insert policy only checked created_by, and the guard only
-- shortened the text and rewrote links that did not start with "/". Every
-- row is sent by email and push (notify_dispatch_on_insert). So any member
-- could send any member an email from the official address with their own
-- words, and a link such as //evil.example passed the guard and opened
-- another website.
--
-- After:
--   * Every link is an in-app path: one leading "/" not followed by "/" or
--     "\". Anything else becomes "/". This applies to every writer.
--   * The app's server code (reminder jobs, waitlists, the deletion alert,
--     edge functions) is unchanged.
--   * Admins keep writing announcements and replies in their own words.
--   * A member may write notifications to themselves (level up, hatch
--     alerts), at most 30 an hour.
--   * A member may notify someone else only for: a message they just sent,
--     a forum comment or reply they just wrote, a follow, or (to their own
--     followers) a new gecko or breeding plan. The database checks that the
--     message, comment or follow exists, then writes the text and the link
--     itself from a fixed template plus the sender's display name. Whatever
--     text or link the browser sent is thrown away. The same notification
--     is sent at most once every 10 minutes, and a member can reach at most
--     30 different people an hour this way.
-- Follows now go through follow_profile() (section 4), which writes the
-- follower notification itself.

-- An in-app path, or "/" for anything else. Immutable so it is cheap.
create or replace function public.safe_internal_link(p_link text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_link is null then null
    when btrim(p_link) ~ '^/([^/\\[:space:]][^[:space:]]*)?$' then btrim(p_link)
    else '/'
  end;
$function$;

comment on function public.safe_internal_link(text) is
  'Returns the link when it is a path inside Geck Inspect (one leading slash, not followed by a slash or backslash, no spaces), otherwise "/". Used by the notification guard so a notification can never open another website.';

-- The fixed text, link and metadata of a member-to-member notification.
-- Internal: only our own functions call it, never the API.
create or replace function public._member_notification(
  p_sender_email text,
  p_recipient_email text,
  p_type text,
  p_post_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_profile_id text;
  v_name text;
  v_encoded text;
begin
  -- The sender's public name. Emails and anything that looks like a web
  -- address are never used as a name, so the template cannot be turned
  -- into "visit evil.example" through a display name.
  select p.id,
         coalesce(nullif(btrim(p.business_name), ''), nullif(btrim(p.full_name), ''), nullif(btrim(p.breeder_name), ''))
    into v_profile_id, v_name
    from public.profiles p
   where p.email = p_sender_email
   limit 1;
  v_name := btrim(regexp_replace(coalesce(v_name, ''), '[[:cntrl:]]+', ' ', 'g'));
  if v_name = ''
     or v_name ~* '(@|://|www\.|\.(com|net|org|io|co|app|xyz|info|link|me|shop|store)([^[:alnum:]]|$))' then
    v_name := 'A Geck Inspect member';
  end if;
  v_name := left(v_name, 60);

  -- Messages opens a conversation from ?recipient=<email>. The recipient
  -- already sees the sender's address on the message itself.
  v_encoded := replace(replace(replace(replace(replace(replace(replace(
                 p_sender_email, '%', '%25'), '+', '%2B'), '&', '%26'), '#', '%23'),
                 '?', '%3F'), '=', '%3D'), ' ', '%20');

  return jsonb_build_object(
    'content', case p_type
      when 'new_message'       then v_name || ' sent you a message.'
      when 'new_comment'       then v_name || ' commented on your forum post.'
      when 'new_reply'         then v_name || ' replied to your comment.'
      when 'new_follower'      then v_name || ' started following you.'
      when 'new_gecko_listing' then v_name || ' listed a new gecko.'
      when 'new_breeding_plan' then v_name || ' started a new breeding project.'
      else v_name || ' sent you a notification.'
    end,
    'link', case
      when p_type = 'new_message' then '/Messages?recipient=' || v_encoded
      when p_type in ('new_comment', 'new_reply') and p_post_id is not null then '/ForumPost?id=' || p_post_id
      when v_profile_id is not null then '/PublicProfile?userId=' || v_profile_id
      else '/Notifications'
    end,
    'metadata', jsonb_strip_nulls(jsonb_build_object('from_profile_id', v_profile_id, 'post_id', p_post_id))
  );
end;
$function$;

-- Checks a member's notification to someone else and returns the text to
-- store. Raises when the member may not send it; returns {"skip": true}
-- when the same notification went out in the last 10 minutes. It only ever
-- looks at the caller's own messages, comments and follows, so calling it
-- directly tells a member nothing about anyone else.
create or replace function public.member_notification_template(
  p_recipient_email text,
  p_type text,
  p_metadata jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_me text := auth.email();
  v_post text := nullif(btrim(coalesce(p_metadata ->> 'post_id', '')), '');
  v_fanout boolean := p_type in ('new_gecko_listing', 'new_breeding_plan');
  v_reached integer;
begin
  if v_me is null then
    raise exception 'Sign in to send notifications' using errcode = '42501';
  end if;
  if p_recipient_email is null or p_recipient_email = v_me then
    raise exception 'This check is for notifications to other members' using errcode = '22023';
  end if;
  if p_type is null or p_type not in
     ('new_message', 'new_comment', 'new_reply', 'new_follower', 'new_gecko_listing', 'new_breeding_plan') then
    raise exception 'Members can only notify other members about messages, forum replies, follows and new listings'
      using errcode = '42501';
  end if;

  -- The event must exist, and be the caller's own.
  if p_type = 'new_message' then
    if not exists (select 1 from public.direct_messages d
                    where d.sender_email = v_me and d.recipient_email = p_recipient_email
                      and d.created_date > now() - interval '1 hour') then
      raise exception 'There is no recent message to this member' using errcode = '42501';
    end if;
  elsif p_type in ('new_comment', 'new_reply') then
    if v_post is null or not exists (
         select 1 from public.forum_comments c
          where c.post_id = v_post and c.created_by = v_me
            and c.created_date > now() - interval '1 hour') then
      raise exception 'There is no recent comment of yours on that post' using errcode = '42501';
    end if;
    if not exists (select 1 from public.forum_posts fp where fp.id = v_post and fp.created_by = p_recipient_email)
       and not exists (select 1 from public.forum_comments c where c.post_id = v_post and c.created_by = p_recipient_email) then
      raise exception 'That member has not posted in this thread' using errcode = '42501';
    end if;
  elsif p_type = 'new_follower' then
    if not exists (select 1 from public.user_follows f
                    where f.follower_email = v_me and f.following_email = p_recipient_email) then
      raise exception 'You do not follow this member' using errcode = '42501';
    end if;
  else
    -- New gecko or breeding plan: only to the caller's own followers.
    if not exists (select 1 from public.user_follows f
                    where f.follower_email = p_recipient_email and f.following_email = v_me) then
      raise exception 'Only your followers hear about your new listings' using errcode = '42501';
    end if;
  end if;

  -- The same notification at most once every 10 minutes (a burst of chat
  -- messages becomes one email, not ten).
  if exists (select 1 from public.notifications n
              where n.created_by = v_me and n.user_email = p_recipient_email and n.type = p_type
                and n.created_date > now() - interval '10 minutes'
                and (v_post is null or n.metadata ->> 'post_id' = v_post)) then
    return jsonb_build_object('skip', true);
  end if;

  -- At most 30 different people an hour, apart from one's own followers.
  if not v_fanout then
    select count(distinct n.user_email) into v_reached
      from public.notifications n
     where n.created_by = v_me
       and n.user_email <> v_me
       and n.user_email <> p_recipient_email
       and n.type not in ('new_gecko_listing', 'new_breeding_plan')
       and n.created_date > now() - interval '1 hour';
    if v_reached >= 30 then
      raise exception 'Too many notifications in the last hour. Try again later.' using errcode = '54000';
    end if;
  end if;

  return public._member_notification(v_me, p_recipient_email, p_type, v_post)
         || jsonb_build_object('skip', false);
end;
$function$;

create or replace function public.guard_notification_insert()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_email text;
  v_recent integer;
  v_tpl jsonb;
begin
  -- Our own server code (reminder jobs, waitlists, edge functions): keep
  -- the row, but a link is always an in-app path.
  if current_user not in ('anon', 'authenticated') then
    new.link := public.safe_internal_link(new.link);
    return new;
  end if;

  v_email := auth.email();
  if current_user = 'anon' or v_email is null then
    raise exception 'Sign in to create notifications' using errcode = '42501';
  end if;
  new.created_by := v_email;
  new.link := public.safe_internal_link(new.link);
  if new.content is not null and length(new.content) > 500 then
    new.content := left(new.content, 500);
  end if;

  -- Admins: announcements, support replies, role changes, in their words.
  if public.is_admin() then
    return new;
  end if;

  -- A member's note to themselves (level up, hatch alert).
  if new.user_email = v_email then
    select count(*) into v_recent
      from public.notifications n
     where n.user_email = v_email and n.created_by = v_email
       and n.created_date > now() - interval '1 hour';
    if v_recent >= 30 then
      raise exception 'Too many notifications in the last hour. Try again later.' using errcode = '54000';
    end if;
    return new;
  end if;

  -- Anyone else: checked, and the words and link come from the template.
  v_tpl := public.member_notification_template(new.user_email, new.type, new.metadata);
  if coalesce((v_tpl ->> 'skip')::boolean, false) then
    return null;
  end if;
  new.content := v_tpl ->> 'content';
  new.link := v_tpl ->> 'link';
  new.metadata := v_tpl -> 'metadata';
  new.is_read := false;
  return new;
end;
$function$;

-- The rate limits above count a member's recent notifications.
create index if not exists notifications_created_by_created_date_idx
  on public.notifications (created_by, created_date desc);

-- =====================================================================
-- 2. Direct messages: nobody rewrites a sent message
-- =====================================================================
--
-- Before: direct_messages_update_own let either person in a conversation
-- update any column, with no WITH CHECK, so a recipient could change a
-- message's words or make it look as if someone else sent it.
-- After: only the recipient may update a message, and only to mark it read
-- (the one update the app makes, src/pages/Messages.jsx). The sender
-- cannot edit a sent message (the app has no edit; "unsend" is a delete,
-- which is unchanged). There are no per-person hide flags in this table.

create or replace function public.guard_direct_message_update()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if (to_jsonb(new) - 'is_read' - 'updated_date') is distinct from (to_jsonb(old) - 'is_read' - 'updated_date') then
    raise exception 'A sent message cannot be changed. Only its read state can.' using errcode = '42501';
  end if;
  if new.is_read is distinct from old.is_read and auth.email() is distinct from old.recipient_email then
    raise exception 'Only the recipient can mark a message read' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists direct_messages_guard_update on public.direct_messages;
create trigger direct_messages_guard_update
  before update on public.direct_messages
  for each row execute function public.guard_direct_message_update();

drop policy if exists direct_messages_update_own on public.direct_messages;
create policy direct_messages_update_own on public.direct_messages
  for update to authenticated
  using ((select auth.email()) = recipient_email)
  with check ((select auth.email()) = recipient_email);

-- =====================================================================
-- 3. Morph ID usage log
-- =====================================================================
--
-- Before: "public read model_invocations" (USING true) let every signed-in
-- member read every row: hashed IP addresses, plan tiers, costs.
-- After: a member reads their own rows; admins read all. The Morph ID edge
-- function writes and counts with the service role, which is not affected.
-- No page in the app reads this table directly.

drop policy if exists "public read model_invocations" on geck_data.model_invocations;
drop policy if exists model_invocations_read_own_or_admin on geck_data.model_invocations;
create policy model_invocations_read_own_or_admin on geck_data.model_invocations
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke select on geck_data.model_invocations from anon;

-- =====================================================================
-- 4. Members' email addresses
-- =====================================================================
--
-- Before: read_profiles() returned every public member's email to any
-- signed-in caller (the Messages "new conversation" list loaded up to 2,000
-- of them at once). community_feed() showed the part of the email before
-- the @ as a name and returned actor_email. similar_gecko_images_by_url()
-- returned each photo's owner email.
-- After: another member's email goes only to admins. A member still gets
-- their own, and a caller who already has an address (read_profiles with
-- p_emails, used to show names next to messages) still gets that address
-- back. Follows, blocks, new conversations and the store page redirect,
-- which used to look the email up from a profile id, now go through the
-- functions below, which take the profile id and never return the email.

CREATE OR REPLACE FUNCTION public.read_profiles(p_emails text[] DEFAULT NULL::text[])
 RETURNS SETOF profiles
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.* from public.profiles p
  cross join lateral jsonb_populate_record(null::public.profiles,
    case when p.email = auth.email() or public.is_admin() then to_jsonb(p)
    else jsonb_build_object(
      'id',p.id,
      -- 15 Oct 2026: no longer every signed-in caller; only an address the
      -- caller already passed in p_emails (own row and admins get it above).
      'email',case when p.email = any(p_emails) then p.email else null end,
      'full_name',p.full_name,'business_name',p.business_name,'bio',p.bio,
      'profile_image_url',p.profile_image_url,'cover_image_url',p.cover_image_url,
      'website_url',p.website_url,'instagram_handle',p.instagram_handle,
      'facebook_url',p.facebook_url,'youtube_url',p.youtube_url,'tiktok_handle',p.tiktok_handle,
      'is_expert',p.is_expert,'is_public_profile',p.is_public_profile,
      'privacy_show_collection',p.privacy_show_collection,'privacy_show_activity',p.privacy_show_activity,
      'membership_tier',p.membership_tier,'total_points',p.total_points,
      'is_featured_breeder',p.is_featured_breeder,'store_policy',p.store_policy,
      'created_date',p.created_date,'looking_for',p.looking_for,
      'show_breeders_publicly',p.show_breeders_publicly,
      'show_username_on_images',p.show_username_on_images
    ) end
  ) r
  where (p.is_public_profile = true or p.email = auth.email() or public.is_admin())
    and (p.moderation_hidden = false or p.email = auth.email() or public.is_admin())
    and (p_emails is null or p.email = any(p_emails));
$function$;

CREATE OR REPLACE FUNCTION public.community_feed(p_limit integer DEFAULT 25)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH viewer AS (
  SELECT auth.uid() IS NOT NULL AS signed_in
),
uploads AS (
  SELECT
    'upload'::text AS event_type,
    gi.id::text AS event_id,
    gi.created_date,
    gi.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, 'Geck Inspect keeper') AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'shared a photo of ' || coalesce(replace(gi.primary_morph, '_', ' '), 'a crested gecko') AS summary,
    gi.image_url,
    '/Gallery'::text AS href
  FROM public.gecko_images gi
  INNER JOIN public.profiles p ON p.email = gi.created_by
  WHERE gi.created_date IS NOT NULL
    AND gi.image_url IS NOT NULL
    AND gi.created_by IS NOT NULL
    AND gi.moderation_hidden = false
    AND p.moderation_hidden = false
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY gi.created_date DESC
  LIMIT 30
),
posts AS (
  SELECT
    'forum_post'::text AS event_type,
    fp.id::text AS event_id,
    fp.created_date,
    fp.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, 'Geck Inspect keeper') AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'posted "' || left(coalesce(fp.title, 'a new thread'), 80) || '"' AS summary,
    NULL::text AS image_url,
    '/Forum'::text AS href
  FROM public.forum_posts fp
  INNER JOIN public.profiles p ON p.email = fp.created_by
  WHERE fp.created_date IS NOT NULL
    AND fp.created_by IS NOT NULL
    AND fp.moderation_hidden = false
    AND p.moderation_hidden = false
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY fp.created_date DESC
  LIMIT 30
),
plans AS (
  SELECT
    'breeding_plan'::text AS event_type,
    bp.id::text AS event_id,
    bp.created_date,
    bp.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, 'Geck Inspect keeper') AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'planned a new pairing' AS summary,
    NULL::text AS image_url,
    '/Breeding'::text AS href
  FROM public.breeding_plans bp
  INNER JOIN public.profiles p ON p.email = bp.created_by
  WHERE bp.created_date IS NOT NULL
    AND bp.created_by IS NOT NULL
    AND coalesce(bp.is_public, false) = true
    AND p.moderation_hidden = false
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY bp.created_date DESC
  LIMIT 30
),
hatched AS (
  SELECT
    'hatched'::text AS event_type,
    e.id::text AS event_id,
    e.hatch_date_actual::timestamptz AS created_date,
    e.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, 'Geck Inspect keeper') AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'just hatched a new gecko' AS summary,
    NULL::text AS image_url,
    '/Breeding'::text AS href
  FROM public.eggs e
  INNER JOIN public.profiles p ON p.email = e.created_by
  INNER JOIN public.breeding_plans bp ON bp.id = e.breeding_plan_id
  WHERE e.status = 'Hatched'
    AND e.hatch_date_actual IS NOT NULL
    AND coalesce(e.archived, false) = false
    AND p.moderation_hidden = false
    AND coalesce(p.is_public_profile, true) = true
    AND coalesce(bp.is_public, false) = true
  ORDER BY e.hatch_date_actual DESC
  LIMIT 30
),
joins AS (
  SELECT
    'join'::text AS event_type,
    p.id::text AS event_id,
    p.created_date,
    p.email AS actor_email,
    coalesce(p.full_name, p.business_name, 'Geck Inspect keeper') AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'joined the community' AS summary,
    NULL::text AS image_url,
    ('/PublicProfile?userId=' || p.id::text)::text AS href
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND p.moderation_hidden = false
    AND coalesce(p.is_public_profile, true) = true
    AND p.created_date > now() - interval '30 days'
  ORDER BY p.created_date DESC
  LIMIT 30
),
combined AS (
  SELECT * FROM uploads
  UNION ALL SELECT * FROM posts
  UNION ALL SELECT * FROM plans
  UNION ALL SELECT * FROM hatched
  UNION ALL SELECT * FROM joins
),
ranked AS (
  SELECT * FROM combined c
  -- Members the viewer blocked do not appear in their feed.
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_blocks b
     WHERE b.blocker_email = auth.email()
       AND b.blocked_email = c.actor_email
  )
  ORDER BY created_date DESC
  LIMIT p_limit
)
SELECT coalesce(
  json_agg(
    -- 15 Oct 2026: actor_email (used above to hide blocked members) never
    -- leaves the database; pages use actor_id.
    (to_jsonb(ranked) - 'actor_email')::json
    ORDER BY ranked.created_date DESC),
  '[]'::json)
FROM ranked;
$function$;

CREATE OR REPLACE FUNCTION public.similar_gecko_images_by_url(p_image_url text, match_count integer DEFAULT 12)
 RETURNS TABLE(id text, image_url text, primary_morph text, secondary_traits jsonb, base_color text, created_by text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  with q as (
    select image_embedding
    from public.gecko_images
    where image_url = p_image_url
      and image_embedding is not null
    limit 1
  )
  select
    g.id,
    g.image_url,
    g.primary_morph,
    g.secondary_traits,
    g.base_color,
    -- 15 Oct 2026: the owner's email only for the owner or an admin.
    case when g.created_by = auth.email() or public.is_admin() then g.created_by end,
    1 - (g.image_embedding <=> q.image_embedding) as similarity
  from public.gecko_images g, q
  where g.image_embedding is not null
    and g.image_url <> p_image_url
    and g.moderation_hidden = false
  order by g.image_embedding <=> q.image_embedding
  limit greatest(1, least(match_count, 24));
$function$;

-- Which of these profiles the caller follows (the follow buttons).
create or replace function public.follow_state(p_profile_ids text[])
returns setof text
language sql
stable
security definer
set search_path to ''
as $function$
  select p.id
    from public.profiles p
   where p.id = any (coalesce(p_profile_ids, '{}'::text[]))
     and exists (select 1 from public.user_follows f
                  where f.follower_email = auth.email() and f.following_email = p.email);
$function$;

-- Follow or unfollow a member by profile id. A new follow notifies the
-- member from here, with our own words. Returns the new state.
create or replace function public.follow_profile(p_profile_id text, p_follow boolean default true)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_me text := auth.email();
  v_target text;
  v_recent integer;
  v_tpl jsonb;
begin
  if v_me is null then
    raise exception 'Sign in to follow members' using errcode = '42501';
  end if;
  select p.email into v_target
    from public.profiles p
   where p.id = p_profile_id
     and (p.is_public_profile = true or public.is_admin())
     and (p.moderation_hidden = false or public.is_admin())
   limit 1;
  if v_target is null then
    raise exception 'That member could not be found' using errcode = 'P0002';
  end if;
  if v_target = v_me then
    raise exception 'You cannot follow yourself' using errcode = '22023';
  end if;

  if not coalesce(p_follow, true) then
    delete from public.user_follows f where f.follower_email = v_me and f.following_email = v_target;
    return false;
  end if;
  if exists (select 1 from public.user_follows f where f.follower_email = v_me and f.following_email = v_target) then
    return true;
  end if;
  if exists (select 1 from public.user_blocks b
              where (b.blocker_email = v_target and b.blocked_email = v_me)
                 or (b.blocker_email = v_me and b.blocked_email = v_target)) then
    raise exception 'You cannot follow this member' using errcode = '42501';
  end if;
  -- Following is how a member learns another member's address (their own
  -- follow row), so it is limited.
  select count(*) into v_recent
    from public.user_follows f
   where f.follower_email = v_me and f.created_date > now() - interval '1 hour';
  if v_recent >= 60 then
    raise exception 'Too many follows in the last hour. Try again later.' using errcode = '54000';
  end if;

  insert into public.user_follows (follower_email, following_email, created_by)
  values (v_me, v_target, v_me);

  if not exists (select 1 from public.notifications n
                  where n.created_by = v_me and n.user_email = v_target and n.type = 'new_follower'
                    and n.created_date > now() - interval '1 day') then
    v_tpl := public._member_notification(v_me, v_target, 'new_follower', null);
    insert into public.notifications (user_email, type, content, link, metadata, created_by)
    values (v_target, 'new_follower', v_tpl ->> 'content', v_tpl ->> 'link', v_tpl -> 'metadata', v_me);
  end if;
  return true;
end;
$function$;

-- Block a member by profile id (Report or block).
create or replace function public.block_profile(p_profile_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_me text := auth.email();
  v_target text;
begin
  if v_me is null then
    raise exception 'Sign in to block members' using errcode = '42501';
  end if;
  select p.email into v_target from public.profiles p where p.id = p_profile_id limit 1;
  if v_target is null then
    raise exception 'We could not find this member to block.' using errcode = 'P0002';
  end if;
  if v_target = v_me then
    raise exception 'You cannot block yourself' using errcode = '22023';
  end if;
  insert into public.user_blocks (blocker_email, blocked_email)
  values (v_me, v_target)
  on conflict do nothing;
end;
$function$;

-- Start or continue a conversation with a member by profile id (the
-- Messages "new conversation" list no longer has addresses). Returns the
-- message, as the app's own insert would. Blocks still apply (the
-- prevent_blocked_message trigger runs on this insert).
create or replace function public.send_direct_message_to_profile(
  p_profile_id text,
  p_content text,
  p_message_type text default 'direct'
)
returns public.direct_messages
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_me text := auth.email();
  v_target text;
  v_content text := btrim(coalesce(p_content, ''));
  v_type text := coalesce(nullif(btrim(coalesce(p_message_type, '')), ''), 'direct');
  v_started integer;
  v_row public.direct_messages;
begin
  if v_me is null then
    raise exception 'Sign in to send messages' using errcode = '42501';
  end if;
  if v_content = '' then
    raise exception 'Write a message first' using errcode = '22023';
  end if;
  if length(v_content) > 5000 then
    raise exception 'Messages can be up to 5,000 characters' using errcode = '22023';
  end if;
  if v_type = 'system' then
    v_type := 'direct';
  end if;
  select p.email into v_target
    from public.profiles p
   where p.id = p_profile_id
     and (p.is_public_profile = true or public.is_admin())
     and (p.moderation_hidden = false or public.is_admin())
   limit 1;
  if v_target is null then
    raise exception 'That member could not be found' using errcode = 'P0002';
  end if;
  if v_target = v_me then
    raise exception 'You cannot message yourself' using errcode = '22023';
  end if;
  -- New conversations are limited: a first message is how a member learns
  -- another member's address.
  if not exists (select 1 from public.direct_messages d
                  where (d.sender_email = v_me and d.recipient_email = v_target)
                     or (d.sender_email = v_target and d.recipient_email = v_me)) then
    select count(distinct d.recipient_email) into v_started
      from public.direct_messages d
     where d.sender_email = v_me and d.created_date > now() - interval '1 hour';
    if v_started >= 20 then
      raise exception 'Too many new conversations in the last hour. Try again later.' using errcode = '54000';
    end if;
  end if;
  insert into public.direct_messages (sender_email, recipient_email, content, message_type, created_by)
  values (v_me, v_target, v_content, v_type, v_me)
  returning * into v_row;
  return v_row;
end;
$function$;

-- The breeder page slug for a profile, so /store/<slug> can redirect to
-- the breeder's page without the browser learning the owner's email.
create or replace function public.breeder_slug_for_profile(p_profile_id text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select b.custom_slug
    from public.profiles p
    join public.breeder_profiles b on b.created_by = p.email
   where p.id = p_profile_id
     and p.moderation_hidden = false
     and coalesce(b.moderation_hidden, false) = false
     and nullif(btrim(b.custom_slug), '') is not null
   limit 1;
$function$;

-- =====================================================================
-- 5. Market Intelligence is Enterprise, on the server too
-- =====================================================================
--
-- Before: decision 38 made the brief, the live feed and watchlists
-- Enterprise only, but only in the app. The database functions answered
-- any signed-in member. seller_market_view already checked the plan.
-- After: the same rule as the app (src/lib/tierLimits.js resolveTier and
-- the market_intelligence feature in PlanLimitChecker): Enterprise, or an
-- admin. Complimentary plans only grant Keeper or Breeder, so they do not
-- unlock it, exactly as in the app. effective_tier_for_current_user() is the
-- database copy of resolveTier. Removing a watch, or switching one off,
-- stays open to everyone so a member who left Enterprise can stop alerts.

create or replace function public.require_market_intelligence()
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  -- Server code (no token, or the service role) is not a member.
  if auth.role() is null or auth.role() = 'service_role' then
    return;
  end if;
  if auth.uid() is null then
    raise exception 'Sign in to use Market Intelligence' using errcode = '42501';
  end if;
  if coalesce(public.effective_tier_for_current_user(), 'free') <> 'enterprise' then
    raise exception 'Market Intelligence is part of the Enterprise plan' using errcode = '42501';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.market_brief()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- 15 Oct 2026: Enterprise or admin (decision 38), checked here too.
  select public.require_market_intelligence();
  select case when auth.uid() is null then null
              else geck_data.market_brief_for((select auth.jwt()) ->> 'email', auth.uid()) end;
$function$;

CREATE OR REPLACE FUNCTION public.market_tape(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 40, p_scope text DEFAULT 'all'::text, p_before_id text DEFAULT NULL::text)
 RETURNS TABLE(event_id text, at timestamp with time zone, kind text, market text, listing_id text, title text, morphs text[], sex_class text, age_class text, weight_grams numeric, price numeric, was_price numeric, currency text, price_local numeric, price_position text, similar_p25 numeric, similar_p50 numeric, similar_p75 numeric, image_url text, listing_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- 15 Oct 2026: Enterprise or admin (decision 38), checked here too.
  select public.require_market_intelligence();
  with bounds as (
    select coalesce(p_before, now() + interval '1 minute') as before_at
  ),
  us_new as (
    select 'us-new-' || l.listing_id as event_id, l.first_seen_at as at, 'new'::text as kind,
           'US'::text as market, l.listing_id, l.name as title, f.morphs,
           l.sex_class, l.age_class, l.weight_grams,
           l.price, null::numeric as was_price, 'USD'::text as currency, l.price as price_local,
           l.position as price_position, l.similar_p25, l.similar_p50, l.similar_p75,
           l.primary_image_url as image_url, l.listing_url
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    cross join bounds b
    where p_scope in ('all', 'US')
      and l.currency = 'USD' and not l.is_lot
      and l.first_seen_at <= b.before_at
      and l.first_seen_at > b.before_at - interval '120 days'
      and (f.first_listed_at is null or f.first_listed_at >= l.first_seen_at - interval '3 days')
      -- Leave out a day that was a catch-up after an outage.
      and not exists (
        select 1 from geck_data.market_daily d
         where d.market = 'US' and d.trait = '' and d.after_gap
           and d.day = (l.first_seen_at at time zone 'UTC')::date
      )
      -- And MorphMarket's first import.
      and l.first_seen_at >= (
        select min(d.day)::timestamp at time zone 'UTC' + interval '3 days'
          from geck_data.market_daily d where d.market = 'US' and d.trait = '' and d.full_check
      )
  ),
  us_ph as (
    select regexp_replace(h.listing_id, '^mm_', '') as listing_id, h.observed_at, h.price,
           lag(h.price) over (partition by h.listing_id order by h.observed_at) as prev
    from geck_data.price_history h
    cross join bounds b
    where p_scope in ('all', 'US')
      and h.currency = 'USD'
      and h.observed_at <= b.before_at
      and h.observed_at > b.before_at - interval '150 days'
  ),
  us_cuts as (
    select 'us-cut-' || c.listing_id || '-' || extract(epoch from c.observed_at)::bigint,
           c.observed_at, 'cut'::text, 'US'::text, l.listing_id, l.name, f.morphs,
           l.sex_class, l.age_class, l.weight_grams,
           c.price, c.prev, 'USD'::text, c.price,
           l.position, l.similar_p25, l.similar_p50, l.similar_p75,
           l.primary_image_url, l.listing_url
    from us_ph c
    cross join bounds b
    join geck_data.listing_market_mv l on l.listing_id = c.listing_id
    join geck_data.listing_facts_mv f on f.listing_id = c.listing_id
    where c.prev is not null and c.price < c.prev
      and c.observed_at > b.before_at - interval '120 days'
      and not l.is_lot
      and not exists (
        select 1 from geck_data.market_daily d
         where d.market = 'US' and d.trait = '' and d.after_gap
           and d.day = (c.observed_at at time zone 'UTC')::date
      )
  ),
  obs as (
    select o.platform, o.external_id, o.observed_on
    from geck_data.cross_platform_observations o
    where o.platform in ('feedle_kr', 'kr_shops', 'repsuki', 'terraristik')
      and o.observed_on > current_date - 120
  ),
  plat_days as (
    select platform, observed_on, count(*) as n from obs group by platform, observed_on
  ),
  plat_full as (
    select pd.platform, pd.observed_on,
           pd.n >= 0.5 * coalesce((
             select max(p2.n) from plat_days p2
              where p2.platform = pd.platform and p2.observed_on < pd.observed_on
                and p2.observed_on >= pd.observed_on - 45), 0) as full_check,
           lag(pd.observed_on) over (partition by pd.platform order by pd.observed_on) as prev_on,
           min(pd.observed_on) over (partition by pd.platform) as first_on
    from plat_days pd
  ),
  good_days as (
    -- A day counts when the source had a full check that day and on its
    -- previous check day, and it was not the source's first day.
    select pf.platform, pf.observed_on
    from plat_full pf
    join plat_full pp on pp.platform = pf.platform and pp.observed_on = pf.prev_on
    where pf.full_check and pp.full_check and pf.observed_on > pf.first_on
  ),
  first_obs as (
    select platform, external_id, min(observed_on) as first_on
    from obs group by platform, external_id
  ),
  intl_new as (
    select 'cp-new-' || c.id::text, c.first_seen_at, 'new'::text,
           case when c.platform in ('feedle_kr', 'kr_shops') then 'KR'
                when c.platform = 'repsuki' then 'JP' else 'EU' end,
           c.platform || ':' || c.external_id, c.title,
           coalesce(tr.traits, '{}'::text[]),
           case lower(coalesce(c.payload ->> 'sex', ''))
             when 'male' then 'male' when 'female' then 'female' else 'unsexed' end,
           null::text, null::numeric,
           round(c.price / nullif(fx.per_usd, 0)), null::numeric, c.currency, c.price,
           null::text, null::numeric, null::numeric, null::numeric,
           (select i.image_url from geck_data.cross_platform_listing_images i
             where i.cross_platform_listing_id = c.id limit 1),
           c.url
    from geck_data.cross_platform_listings c
    join first_obs fo on fo.platform = c.platform and fo.external_id = c.external_id
    join good_days gd on gd.platform = c.platform and gd.observed_on = fo.first_on
    left join geck_data.cross_platform_traits_mv tr on tr.platform = c.platform and tr.external_id = c.external_id
    left join geck_data.fx_rates fx on fx.currency = c.currency
    cross join bounds b
    where p_scope in ('all', 'KR', 'JP', 'EU')
      and (p_scope = 'all' or p_scope = case when c.platform in ('feedle_kr', 'kr_shops') then 'KR'
                                             when c.platform = 'repsuki' then 'JP' else 'EU' end)
      and coalesce(c.species, 'crested') = 'crested'
      and not coalesce((c.payload ->> 'is_group_lot')::boolean, false)
      and c.price > 0
      and c.first_seen_at <= b.before_at
  )
  select * from (
    select * from us_new
    union all
    select * from us_cuts
    union all
    select * from intl_new
  ) e
  -- Page by time, then by event id: a source can stamp many listings
  -- with the same time, and a plain time cursor would skip some of them.
  where p_before is null
     or e.at < p_before
     or (e.at = p_before and p_before_id is not null and e.event_id < p_before_id)
  order by e.at desc, e.event_id desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$;

CREATE OR REPLACE FUNCTION public.market_watch_list()
 RETURNS TABLE(id uuid, name text, query jsonb, active boolean, created_at timestamp with time zone, matches_7d bigint, last_match_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- 15 Oct 2026: Enterprise or admin (decision 38), checked here too.
  select public.require_market_intelligence();
  select a.id, a.name, a.query, a.active, a.created_at,
         (select count(*) from geck_data.alert_matches m
           where m.alert_id = a.id and m.matched_at > now() - interval '7 days'),
         (select max(m.matched_at) from geck_data.alert_matches m where m.alert_id = a.id)
  from geck_data.alerts a
  where a.owner_id = auth.uid()
  order by a.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.market_watch_matches(p_limit integer DEFAULT 30)
 RETURNS TABLE(match_id uuid, alert_id uuid, alert_name text, matched_at timestamp with time zone, trigger text, price numeric, was_price numeric, listing_id text, title text, morphs text[], sex_class text, age_class text, weight_grams numeric, price_position text, similar_p25 numeric, similar_p50 numeric, similar_p75 numeric, image_url text, listing_url text, for_sale boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- 15 Oct 2026: Enterprise or admin (decision 38), checked here too.
  select public.require_market_intelligence();
  select m.id, a.id, a.name, m.matched_at,
         m.payload ->> 'trigger', (m.payload ->> 'price')::numeric, (m.payload ->> 'was_price')::numeric,
         l.listing_id, l.name, f.morphs, l.sex_class, l.age_class, l.weight_grams,
         l.position, l.similar_p25, l.similar_p50, l.similar_p75,
         l.primary_image_url, l.listing_url, l.for_sale
  from geck_data.alert_matches m
  join geck_data.alerts a on a.id = m.alert_id
  left join geck_data.listing_market_mv l on l.listing_id = regexp_replace(m.listing_id, '^mm_', '')
  left join geck_data.listing_facts_mv f on f.listing_id = l.listing_id
  where a.owner_id = auth.uid()
  order by m.matched_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$function$;

CREATE OR REPLACE FUNCTION public.market_watch_set_active(p_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- 15 Oct 2026: switching a watch on needs Enterprise; switching it off does not.
  select public.require_market_intelligence() where coalesce(p_active, false);
  update geck_data.alerts a set active = coalesce(p_active, a.active)
   where a.id = p_id and a.owner_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.market_watch_save(p_id uuid DEFAULT NULL::uuid, p_traits text[] DEFAULT NULL::text[], p_max_price numeric DEFAULT NULL::numeric, p_min_price numeric DEFAULT NULL::numeric, p_sex text DEFAULT NULL::text, p_cuts_only boolean DEFAULT false, p_seller_slug text DEFAULT NULL::text, p_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_traits text[];
  v_query jsonb;
  v_name text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to keep a watchlist' using errcode = '42501';
  end if;
  -- 15 Oct 2026: Enterprise or admin (decision 38), checked here too.
  perform public.require_market_intelligence();

  select coalesce(array_agg(distinct left(trim(t), 60)) filter (where trim(t) <> ''), '{}')
    into v_traits
    from unnest(coalesce(p_traits, '{}'::text[])) t;
  if cardinality(v_traits) > 6 then
    raise exception 'Pick up to 6 morphs' using errcode = '22023';
  end if;
  if p_max_price is not null and (p_max_price <= 0 or p_max_price > 100000) then
    raise exception 'Max price must be between $1 and $100,000' using errcode = '22023';
  end if;
  if p_min_price is not null and (p_min_price < 0 or p_min_price > 100000) then
    raise exception 'Min price must be between $0 and $100,000' using errcode = '22023';
  end if;
  if p_sex is not null and p_sex not in ('male', 'female', 'unsexed') then
    raise exception 'Sex must be male, female or unsexed' using errcode = '22023';
  end if;
  if cardinality(v_traits) = 0 and nullif(trim(coalesce(p_seller_slug, '')), '') is null
     and p_max_price is null then
    raise exception 'Pick a morph, a breeder or a price' using errcode = '22023';
  end if;

  v_query := jsonb_strip_nulls(jsonb_build_object(
    'species', 'crested',
    'trait_all', case when cardinality(v_traits) > 0 then to_jsonb(v_traits) end,
    'max_price', p_max_price,
    'min_price', p_min_price,
    'sex', p_sex,
    'must_be_drop', case when p_cuts_only then true end,
    'seller_ids', case when nullif(trim(coalesce(p_seller_slug, '')), '') is not null
                       then jsonb_build_array(trim(p_seller_slug)) end
  ));

  v_name := left(coalesce(nullif(trim(p_name), ''), concat_ws(' ',
    coalesce(nullif(array_to_string(v_traits, ' + '), ''), 'Any crested gecko'),
    case when p_sex is not null then '(' || p_sex || ')' end,
    case when p_max_price is not null then 'under $' || to_char(p_max_price, 'FM999,999') end,
    case when p_cuts_only then 'price cuts' end
  )), 120);

  if p_id is null then
    if (select count(*) from geck_data.alerts a where a.owner_id = v_uid) >= 25 then
      raise exception 'A watchlist holds up to 25 alerts' using errcode = '22023';
    end if;
    insert into geck_data.alerts (owner_id, name, query, active)
    values (v_uid, v_name, v_query, true)
    returning id into v_id;
  else
    update geck_data.alerts a
       set name = v_name, query = v_query
     where a.id = p_id and a.owner_id = v_uid
    returning a.id into v_id;
    if v_id is null then
      raise exception 'Alert not found' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$function$;

-- =====================================================================
-- 6. Account deletion requests come from the account itself
-- =====================================================================
--
-- Before: anyone, signed in or not, could insert a support message with
-- the subject "Account deletion request" and any member's email. Admins
-- were alerted, and the Support inbox's Erase button erased whatever
-- account the ticket named.
-- After: the database stamps filed_by_email with the email of the signed-in
-- account that filed the message (empty for signed-out visitors), whatever
-- the browser sent. A deletion request is actionable only when that
-- verified email is the account it names: only then are admins alerted,
-- does the inbox show the Erase button, and will admin-delete-account run
-- from the ticket. Signed-out visitors still send ordinary support
-- messages. Admins can still erase an account deliberately from Admin
-- Panel, Users.

alter table public.support_messages add column if not exists filed_by_email text;
comment on column public.support_messages.filed_by_email is
  'Email of the signed-in account that filed this message, set by the database (guard_support_message). Empty for signed-out visitors. A deletion request can start an erasure only when this matches user_email.';

create or replace function public.guard_support_message()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- The filer is the session, never what the form says.
    new.filed_by_email := auth.email();
    new.created_by := auth.email();
    -- Status and the admin fields are the team's to set.
    new.status := 'new';
    new.admin_notes := null;
    new.resolved_by := null;
    new.resolved_date := null;
  else
    new.filed_by_email := old.filed_by_email;
  end if;
  return new;
end;
$function$;

drop trigger if exists support_messages_guard on public.support_messages;
create trigger support_messages_guard
  before insert or update on public.support_messages
  for each row execute function public.guard_support_message();

CREATE OR REPLACE FUNCTION public.notify_admins_of_deletion_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.subject is distinct from 'Account deletion request' then
    return new;
  end if;
  -- 15 Oct 2026: only a request filed by the signed-in account it names.
  -- Anything else stays an ordinary support message.
  if new.filed_by_email is null
     or lower(btrim(new.filed_by_email)) is distinct from lower(btrim(coalesce(new.user_email, ''))) then
    return new;
  end if;
  insert into public.notifications (user_email, type, content, link, metadata)
  select p.email,
         'account_deletion_request',
         'A member asked to delete their account (' || coalesce(new.user_email, 'unknown email')
           || '). Open the Support inbox to review it and run the erasure. The privacy policy promises deletion within 30 days.',
         '/AdminPanel?section=support',
         jsonb_build_object('support_message_id', new.id)
    from public.profiles p
   where p.role = 'admin'
     and nullif(btrim(p.email), '') is not null;
  return new;
end;
$function$;

-- =====================================================================
-- 7. Sold prices are not public
-- =====================================================================
--
-- Before: 20261008081011 granted signed-out visitors select on
-- geckos.sold_price. No signed-out page shows it (src/lib/publicColumns.js
-- drops it in the same change). sire_id and dam_id stay readable: the
-- passport's lineage needs them.

revoke select (sold_price) on public.geckos from anon;

-- =====================================================================
-- 8. Privileges the API roles never need
-- =====================================================================
--
-- GRANT ALL in the baseline gave anon and authenticated TRUNCATE,
-- REFERENCES and TRIGGER on every table (and MAINTAIN on Postgres 17).
-- None is reachable through the API today, but none is needed, and
-- TRUNCATE ignores row level security. Default privileges also granted
-- EXECUTE on every new function to anon and authenticated (and to PUBLIC,
-- Postgres's own default), which is why
-- 20261008063704_lock_security_definer_execute had to exist. From now on
-- a new function runs only for the roles it is granted to explicitly.
-- Existing functions keep their grants.

do $$
declare
  r record;
  v_pg17 boolean := current_setting('server_version_num')::int >= 170000;
begin
  for r in
    select n.nspname, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'geck_data')
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke truncate, references, trigger on table %I.%I from anon, authenticated', r.nspname, r.relname);
    if v_pg17 then
      execute format('revoke maintain on table %I.%I from anon, authenticated', r.nspname, r.relname);
    end if;
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end
$$;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public;

-- =====================================================================
-- 9. Account erasure keeps the care history of animals sold on
-- =====================================================================
--
-- Before: step 1f deleted every weight, feeding, shed, vet and event
-- record the member had ever logged, on any animal. A gecko they sold kept
-- its passport but lost its history.
-- After: records on animals the member owns at erasure time are deleted
-- as before (their own geckos and reptiles, including the ones kept for
-- other members' lineage). Records they logged on someone else's animal
-- stay with the animal, anonymised the way the privacy policy describes:
-- the author becomes a deleted-account address, so the member's name and
-- email are gone, and their free-text notes are removed. Vet attachments
-- on those records stay (the file step already keeps files a surviving
-- row uses).

CREATE OR REPLACE FUNCTION public.admin_erase_account(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_uid       uuid;
  v_uid_text  text;
  v_tomb      text := 'deleted-' || replace(gen_random_uuid()::text, '-', '') || '@deleted.geckinspect.invalid';
  v_label     constant text := 'Former member';
  v_zero      constant uuid := '00000000-0000-0000-0000-000000000000';
  v_url_re    constant text := '/storage/v1/object/(?:public|sign|authenticated)/([A-Za-z0-9_-]+)/([^?#"'' ]+)';
  v_buckets   constant text[] := array['geck-inspect-media', 'promote-images', 'raw-uploads'];
  v_profile   int := 0;
  v_geckos_deleted int := 0;
  v_geckos_kept    int := 0;
  v_messages  int := 0;
  v_images    int := 0;
  v_files     jsonb;
begin
  -- Server only. EXECUTE is also revoked from anon and authenticated, but
  -- this check holds even if a grant is ever restored by mistake: a call
  -- through the API carries a role claim, and only service_role passes. A
  -- direct database session (no claim) is an admin at the console.
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'admin_erase_account: service role only';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'admin_erase_account: an email address is required';
  end if;
  if v_email like '%@deleted.geckinspect.invalid' then
    raise exception 'admin_erase_account: this account was already erased';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'admin') then
    raise exception 'admin_erase_account: remove the admin role before erasing an admin account';
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  v_uid_text := v_uid::text;

  -- 1a. Gather the member's files before the rows that point at them go.
  create temp table if not exists pg_temp._erase_files (bucket text, name text) on commit drop;
  truncate pg_temp._erase_files;

  insert into pg_temp._erase_files (bucket, name)
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id = any (v_buckets)
     and v_uid is not null
     and (o.owner_id = v_uid_text
          or o.owner = v_uid
          or o.name ~ ('(^|/)' || v_uid_text || '/'));

  insert into pg_temp._erase_files (bucket, name)
  select m[1], m[2]
    from (
      select g.image_urls::text as blob from public.geckos g where lower(g.created_by) = v_email
      union all select r.image_urls::text from public.other_reptiles r where lower(r.created_by) = v_email
      union all select i.image_url from public.gecko_images i where lower(i.created_by) = v_email
      union all select p.profile_image_url || ' ' || coalesce(p.cover_image_url, '') from public.profiles p where lower(p.email) = v_email
      union all select l.image_url from public.lineage_placeholders l where lower(l.created_by) = v_email
      union all select coalesce(b.profile_photo, '') || ' ' || coalesce(b.banner_photo, '') from public.breeder_profiles b
               where lower(b.created_by) = v_email or (v_uid is not null and b.user_id = v_uid)
      union all select s.header_image_url from public.breeder_store_pages s where lower(s.owner_email) = v_email
      union all select v.attachments::text from public.vet_records v where lower(v.created_by) = v_email
      union all select c.image_url from public.morph_guide_comments c where lower(c.created_by) = v_email or lower(c.user_email) = v_email
      union all select r.image_url from public.morph_reference_images r
               where lower(r.submitted_by_email) = v_email and coalesce(r.status, '') <> 'approved'
      union all select p.public_url from public.promote_images p where v_uid is not null and p.user_id = v_uid
    ) blobs
    cross join lateral regexp_matches(coalesce(blobs.blob, ''), v_url_re, 'g') as m
   where m[1] = any (v_buckets);

  -- 1b. Lineage: keep the member's geckos that another member's gecko
  --     descends from (any number of generations), or that another
  --     member's breeding plan uses.
  create temp table if not exists pg_temp._erase_keep (id text primary key) on commit drop;
  truncate pg_temp._erase_keep;

  insert into pg_temp._erase_keep (id)
  with recursive mine as (
    select g.id, g.sire_id, g.dam_id from public.geckos g where lower(g.created_by) = v_email
  ),
  seeds as (
    select m.id
      from mine m
     where exists (select 1 from public.geckos o
                    where (o.sire_id = m.id or o.dam_id = m.id)
                      and lower(coalesce(o.created_by, '')) <> v_email)
        or exists (select 1 from public.breeding_plans bp
                    where (bp.sire_id = m.id or bp.dam_id = m.id)
                      and lower(coalesce(bp.created_by, '')) <> v_email)
  ),
  ancestors as (
    select s.id from seeds s
    union
    select m.id
      from ancestors a
      join public.geckos child on child.id = a.id
      join mine m on m.id in (child.sire_id, child.dam_id)
  )
  select distinct id from ancestors
  on conflict do nothing;

  -- Give every child (anyone's) a parent name before the parent is hidden
  -- or deleted.
  update public.geckos c
     set sire_name = p.name
    from public.geckos p
   where c.sire_id = p.id
     and lower(p.created_by) = v_email
     and nullif(btrim(c.sire_name), '') is null;
  update public.geckos c
     set dam_name = p.name
    from public.geckos p
   where c.dam_id = p.id
     and lower(p.created_by) = v_email
     and nullif(btrim(c.dam_name), '') is null;

  -- Other members' records that link to one of the member's geckos with a
  -- plain foreign key (no cascade) would block the delete. Clear the link;
  -- their own text (sire_name, review body) stays.
  update public.breeding_projects bp
     set sire_animal_id = null
   where bp.sire_animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email)
     and not (lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  update public.breeding_projects bp
     set dam_animal_id = null
   where bp.dam_animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email)
     and not (lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  update public.breeder_reviews r
     set animal_id = null
   where r.animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email);

  -- 1c. Kept lineage geckos: anonymise.
  update public.geckos g
     set created_by = v_tomb,
         collection_id = null,
         is_public = false,
         gallery_display = false,
         archived = true,
         archived_date = coalesce(g.archived_date, current_date),
         archive_reason = 'Owner account deleted',
         notes = null,
         genetics_notes = null,
         marketplace_description = null,
         asking_price = null,
         listing_price = null,
         sold_price = null,
         market_price_estimate = null,
         morphmarket_id = null,
         morphmarket_url = null,
         palm_street_id = null,
         palm_street_url = null,
         image_urls = '[]'::jsonb,
         image_crop_data = null,
         passport_code = null,
         breeder_name = null,
         breeder_user_id = null,
         hatch_facility = null,
         feeding_group_id = null,
         growth_slideshow_enabled = false
   where g.id in (select k.id from pg_temp._erase_keep k);
  get diagnostics v_geckos_kept = row_count;

  -- 1d. Chain of custody and transfers on animals other members now hold.
  update public.ownership_records o
     set owner_user_id = null,
         owner_name = v_label,
         owner_avatar_url = null,
         notes = null,
         created_by = case when lower(o.created_by) = v_email then v_tomb else o.created_by end
   where (v_uid is not null and o.owner_user_id = v_uid)
      or lower(coalesce(o.created_by, '')) = v_email;

  delete from public.transfer_requests t
   where t.status <> 'claimed'
     and ((v_uid is not null and (t.from_user_id = v_uid or t.to_user_id = v_uid))
          or lower(t.to_email) = v_email
          or lower(coalesce(t.created_by, '')) = v_email);
  update public.transfer_requests t
     set from_user_id = case when t.from_user_id = v_uid then v_zero else t.from_user_id end,
         to_user_id   = case when t.to_user_id = v_uid then null else t.to_user_id end,
         to_email     = case when lower(t.to_email) = v_email then v_tomb else t.to_email end,
         created_by   = case when lower(t.created_by) = v_email then v_tomb else t.created_by end,
         message      = null
   where (v_uid is not null and (t.from_user_id = v_uid or t.to_user_id = v_uid))
      or lower(t.to_email) = v_email
      or lower(coalesce(t.created_by, '')) = v_email;

  update public.geckos g
     set breeder_user_id = null
   where v_uid is not null and g.breeder_user_id = v_uid;

  -- 1e. Breeding records.
  update public.breeding_loans l
     set breeding_project_id = null
   where l.breeding_project_id in (
     select bp.id from public.breeding_projects bp
      where lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  delete from public.breeding_loans l
   where (v_uid is not null and l.lender_user_id = v_uid)
      or (lower(coalesce(l.created_by, '')) = v_email and (l.lender_user_id is null or l.lender_user_id = v_uid));
  update public.breeding_loans l
     set borrower_user_id = null,
         borrower_email = null,
         borrower_name = v_label,
         created_by = case when lower(l.created_by) = v_email then v_tomb else l.created_by end
   where (v_uid is not null and l.borrower_user_id = v_uid)
      or lower(coalesce(l.borrower_email, '')) = v_email;

  delete from public.eggs e
   where e.breeding_plan_id in (select bp.id from public.breeding_plans bp where lower(bp.created_by) = v_email)
      or lower(coalesce(e.created_by, '')) = v_email;
  delete from public.breeding_plans bp where lower(bp.created_by) = v_email;
  delete from public.future_breeding_plans x where lower(x.created_by) = v_email;
  delete from public.pairing_outcome_logs x where lower(x.created_by) = v_email;
  delete from public.genetic_outcome_predictions x where lower(x.created_by) = v_email;
  delete from public.clutches x where lower(x.created_by) = v_email;
  delete from public.breeding_projects bp
   where lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid);
  delete from geck_data.breeding_pairs x where v_uid is not null and x.owner_id = v_uid;

  -- 1f. Husbandry records the member logged.
  --     On someone else's animal (one they sold or care for in a shared
  --     collection) the record stays with the animal's history, with the
  --     author replaced by the deleted-account address and their notes
  --     removed. On their own animals (including ones kept above for
  --     lineage, already re-addressed in 1c) it is deleted. "Someone
  --     else's" means a gecko or reptile that exists and is not theirs.
  update public.weight_records x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.feeding_records x
     set created_by = case when lower(x.created_by) = v_email then v_tomb else x.created_by end,
         logged_by = case when x.logged_by = v_uid then null else x.logged_by end,
         notes = null
   where (lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid))
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.shed_records x
     set created_by = case when lower(x.created_by) = v_email then v_tomb else x.created_by end,
         logged_by = case when x.logged_by = v_uid then null else x.logged_by end,
         notes = null
   where (lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid))
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.vet_records x
     set created_by = v_tomb
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.gecko_events x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.reptile_events x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.other_reptiles r
                  where r.id = x.reptile_id
                    and lower(coalesce(r.created_by, '')) <> v_email);
  update public.lineage_placeholders x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  -- Everything still in the member's name is on their own animals (or on
  -- an animal that no longer exists).
  delete from public.weight_records x where lower(x.created_by) = v_email;
  delete from public.feeding_records x where lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid);
  delete from public.shed_records x where lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid);
  delete from public.vet_records x where lower(x.created_by) = v_email;
  delete from public.gecko_events x where lower(x.created_by) = v_email;
  delete from public.reptile_events x where lower(x.created_by) = v_email;
  delete from public.lineage_placeholders x where lower(x.created_by) = v_email;

  -- 1g. Animals. Deleting a gecko also removes its weights, feedings, sheds,
  --     vet visits, ownership records, loans and pending transfers (existing
  --     cascades and triggers).
  delete from public.geckos g
   where lower(g.created_by) = v_email
     and g.id not in (select k.id from pg_temp._erase_keep k);
  get diagnostics v_geckos_deleted = row_count;
  -- Geckos with no recorded owner that sit in the member's own collections.
  delete from public.geckos g
   where nullif(btrim(g.created_by), '') is null
     and g.collection_id in (select c.id from public.collections c where lower(c.owner_email) = v_email);
  delete from public.other_reptiles x where lower(x.created_by) = v_email;
  delete from public.feeding_groups x where lower(x.created_by) = v_email;

  -- 1h. Collections. Remove the member from other members' collections,
  --     then delete their own. Clearing is_default first lets the existing
  --     rehome trigger move collaborators' geckos to their own default
  --     collection instead of leaving them in no collection.
  delete from public.collection_members cm
   where lower(cm.member_email) = v_email
     and cm.collection_id not in (select c.id from public.collections c where lower(c.owner_email) = v_email);
  update public.collection_members cm
     set invited_by_email = null
   where lower(cm.invited_by_email) = v_email;
  update public.collections c set is_default = false where lower(c.owner_email) = v_email;
  delete from public.collections c where lower(c.owner_email) = v_email;
  update public.collection_activity a
     set actor_email = null,
         actor_name = v_label
   where lower(a.actor_email) = v_email;
  update public.collection_activity a
     set detail = null
   where position(v_email in lower(coalesce(a.detail, ''))) > 0;

  -- 1i. Photos and the training data on them.
  delete from public.gecko_likes x
   where lower(x.user_email) = v_email
      or lower(x.owner_email) = v_email
      or x.gecko_image_id in (select i.id from public.gecko_images i where lower(i.created_by) = v_email);
  delete from public.gecko_of_the_day x
   where lower(x.uploader_email) = v_email
      or x.gecko_image_id in (select i.id from public.gecko_images i where lower(i.created_by) = v_email);
  delete from public.gecko_images i where lower(i.created_by) = v_email;
  get diagnostics v_images = row_count;
  update public.classification_votes v
     set created_by = case when lower(v.created_by) = v_email then v_tomb else v.created_by end,
         reviewer_email = case when lower(v.reviewer_email) = v_email then null else v.reviewer_email end,
         verified_by = case when lower(v.verified_by) = v_email then null else v.verified_by end
   where lower(coalesce(v.created_by, '')) = v_email
      or lower(coalesce(v.reviewer_email, '')) = v_email
      or lower(coalesce(v.verified_by, '')) = v_email;
  delete from public.morph_reference_images r
   where lower(r.submitted_by_email) = v_email and coalesce(r.status, '') <> 'approved';
  update public.morph_reference_images r
     set submitted_by_email = v_tomb,
         created_by = case when lower(r.created_by) = v_email then v_tomb else r.created_by end
   where lower(r.submitted_by_email) = v_email;
  update public.morph_price_entries p
     set submitted_by = null,
         created_by = case when lower(p.created_by) = v_email then v_tomb else p.created_by end,
         notes = null,
         is_anonymous = true
   where (v_uid is not null and p.submitted_by = v_uid) or lower(coalesce(p.created_by, '')) = v_email;
  delete from public.promote_images x where v_uid is not null and x.user_id = v_uid;

  -- 1j. Messages, notifications and support.
  delete from public.direct_messages d
   where lower(d.sender_email) = v_email
      or lower(d.recipient_email) = v_email
      or lower(coalesce(d.created_by, '')) = v_email;
  get diagnostics v_messages = row_count;
  delete from public.notifications n
   where lower(n.user_email) = v_email or lower(coalesce(n.created_by, '')) = v_email;
  delete from public.support_replies r
   where r.message_id in (
     select s.id::text from public.support_messages s
      where (lower(s.user_email) = v_email or lower(coalesce(s.created_by, '')) = v_email)
        and s.subject is distinct from 'Account deletion request');
  delete from public.support_messages s
   where (lower(s.user_email) = v_email or lower(coalesce(s.created_by, '')) = v_email)
     and s.subject is distinct from 'Account deletion request';
  delete from public.push_subscriptions x where lower(x.user_email) = v_email;
  -- Tables added on 3 Oct 2026.
  delete from public.content_reports x where lower(x.reporter_email) = v_email;
  delete from public.planner_notes x where v_uid is not null and x.user_id = v_uid;
  delete from public.consultant_conversations x where v_uid is not null and x.user_id = v_uid;
  delete from public.forum_post_views x where v_uid is not null and x.viewer_id = v_uid;

  -- 1k. Community.
  update public.forum_posts f
     set author_name = v_label, created_by = v_tomb
   where lower(f.created_by) = v_email;
  update public.forum_comments f
     set author_name = v_label, created_by = v_tomb
   where lower(f.created_by) = v_email;
  delete from public.forum_likes x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  update public.questions q
     set author_id = null, created_by = v_tomb
   where lower(q.created_by) = v_email or (v_uid is not null and q.author_id = v_uid);
  update public.answers a
     set author_id = null, created_by = v_tomb
   where lower(a.created_by) = v_email or (v_uid is not null and a.author_id = v_uid);
  delete from public.question_votes x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.morph_guide_comments x where lower(x.created_by) = v_email or lower(x.user_email) = v_email;
  delete from public.community_event_reactions x where lower(x.user_email) = v_email;
  delete from public.user_follows x
   where lower(x.follower_email) = v_email or lower(x.following_email) = v_email;
  delete from public.user_blocks x
   where lower(x.blocker_email) = v_email or lower(x.blocked_email) = v_email;
  delete from public.marketplace_likes x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.breeder_reviews r where v_uid is not null and r.reviewed_user_id = v_uid;
  update public.breeder_reviews r
     set reviewer_user_id = null,
         created_by = case when lower(r.created_by) = v_email then v_tomb else r.created_by end
   where (v_uid is not null and r.reviewer_user_id = v_uid) or lower(coalesce(r.created_by, '')) = v_email;
  delete from public.giveaway_entries x where lower(x.user_email) = v_email;
  update public.giveaways g
     set winner_emails = coalesce((
           select jsonb_agg(w) from jsonb_array_elements(g.winner_emails) w
            where lower(w #>> '{}') <> v_email), '[]'::jsonb)
   where jsonb_typeof(g.winner_emails) = 'array'
     and exists (select 1 from jsonb_array_elements(g.winner_emails) w where lower(w #>> '{}') = v_email);
  delete from public.user_badges x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.user_activity x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.user_events x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.expert_actions x where lower(x.expert_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.expert_verification_requests x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.mentor_offers x where lower(x.owner_email) = v_email or (v_uid is not null and x.user_id = v_uid);

  -- 1l. Breeder pages, waitlists and inquiries.
  delete from public.breeder_profiles x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.breeder_store_pages x where lower(x.owner_email) = v_email;
  delete from public.breeder_inquiries x where lower(x.buyer_email) = v_email or lower(x.breeder_email) = v_email;
  delete from public.gecko_waitlists x where v_uid is not null and x.breeder_user_id = v_uid;
  delete from public.gecko_waitlist_signups x where lower(x.email) = v_email;

  -- 1m. Business tools and market.
  delete from public.pending_sales x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.marketplace_costs x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.collection_valuations x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.market_value_daily x where lower(x.user_email) = v_email;
  delete from public.price_alerts x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.price_game_guesses x where v_uid is not null and x.user_id = v_uid;
  delete from public.tasks x where lower(x.created_by) = v_email;
  delete from public.projects x where lower(x.created_by) = v_email;
  delete from public.shipping_orders x where lower(x.created_by) = v_email;

  -- 1n. Usage, integrations and subscriptions.
  delete from public.newsletter_subscribers x where lower(x.email) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.guide_email_sends x where lower(x.email) = v_email;
  delete from public.feature_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.morph_id_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.iot_connections x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_posts x where (v_uid is not null and x.created_by_user_id = v_uid) or lower(coalesce(x.created_by_email, '')) = v_email;
  delete from public.social_platform_connections x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_post_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_post_photo_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_generation_log x where v_uid is not null and x.user_id = v_uid;
  delete from public.user_brand_voice x where v_uid is not null and x.user_id = v_uid;
  delete from public.store_carts x where v_uid is not null and x.owner_user_id = v_uid;
  delete from public.revenuecat_entitlements x where v_uid is not null and x.app_user_id = v_uid;
  delete from public.revenuecat_sync_requests x where v_uid is not null and x.app_user_id = v_uid;
  update public.store_affiliate_clicks x set user_id = null where v_uid is not null and x.user_id = v_uid;

  -- 1o. Money and referral records: keep the amounts, drop the person.
  update public.store_orders o
     set customer_email = v_tomb,
         customer_name = null,
         owner_user_id = null,
         ship_to = null,
         notes = null
   where lower(o.customer_email) = v_email or (v_uid is not null and o.owner_user_id = v_uid);
  update public.store_signup_grants g
     set granted_email = case when lower(g.granted_email) = v_email then v_tomb else g.granted_email end,
         redeemed_by_user_id = case when g.redeemed_by_user_id = v_uid then null else g.redeemed_by_user_id end,
         ship_to_postal_hash = null
   where lower(g.granted_email) = v_email or (v_uid is not null and g.redeemed_by_user_id = v_uid);
  update public.payment_events p
     set user_email = v_tomb,
         raw_stripe_payload = null,
         created_by = case when lower(p.created_by) = v_email then v_tomb else p.created_by end
   where lower(p.user_email) = v_email;
  update public.referral_rewards r
     set referrer_email = case when lower(r.referrer_email) = v_email then v_tomb else r.referrer_email end,
         referred_email = case when lower(r.referred_email) = v_email then v_tomb else r.referred_email end
   where lower(r.referrer_email) = v_email or lower(r.referred_email) = v_email;
  update public.social_referral_bonuses b
     set referrer_email = case when lower(b.referrer_email) = v_email then v_tomb else b.referrer_email end,
         referred_email = case when lower(b.referred_email) = v_email then v_tomb else b.referred_email end,
         referrer_user_id = case when b.referrer_user_id = v_uid then null else b.referrer_user_id end,
         referred_user_id = case when b.referred_user_id = v_uid then null else b.referred_user_id end
   where lower(coalesce(b.referrer_email, '')) = v_email
      or lower(coalesce(b.referred_email, '')) = v_email
      or (v_uid is not null and (b.referrer_user_id = v_uid or b.referred_user_id = v_uid));

  -- 1p. Logs.
  update public.error_logs e
     set user_email = null,
         created_by = case when lower(e.created_by) = v_email then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or lower(coalesce(e.created_by, '')) = v_email;
  update geck_data.error_logs e
     set user_email = null,
         created_by = case when e.created_by = v_uid then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or (v_uid is not null and e.created_by = v_uid);
  update geck_data.user_events e
     set user_email = null,
         created_by = case when e.created_by = v_uid then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or (v_uid is not null and e.created_by = v_uid);
  update geck_data.model_invocations m set user_id = null where v_uid is not null and m.user_id = v_uid;
  update geck_data.listing_images li set uploaded_by = null where v_uid is not null and li.uploaded_by = v_uid;
  delete from geck_data.alerts x where v_uid is not null and x.owner_id = v_uid;
  delete from geck_data.user_notification_channels x where v_uid is not null and x.owner_id = v_uid;

  -- 1q. The profile itself.
  delete from public.profiles p where lower(p.email) = v_email;
  get diagnostics v_profile = row_count;
  delete from geck_data.profiles p where lower(p.email) = v_email or (v_uid is not null and p.id = v_uid);

  -- 2. Files to remove: the member's, minus anything a surviving row uses.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.name)), '[]'::jsonb)
    into v_files
    from (
      select distinct ef.bucket, ef.name
        from pg_temp._erase_files ef
        join storage.objects o on o.bucket_id = ef.bucket and o.name = ef.name
    ) f
   where not exists (select 1 from public.geckos x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.other_reptiles x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.gecko_images x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.profiles x
                      where strpos(coalesce(x.profile_image_url, '') || coalesce(x.cover_image_url, ''), f.name) > 0)
     and not exists (select 1 from public.forum_posts x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.forum_comments x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.lineage_placeholders x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.morph_reference_images x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.morph_guides x where strpos(x.example_image_url, f.name) > 0)
     and not exists (select 1 from public.morph_traits x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.care_guide_sections x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.breeder_store_pages x where strpos(x.header_image_url, f.name) > 0)
     and not exists (select 1 from public.breeder_profiles x
                      where strpos(coalesce(x.profile_photo, '') || coalesce(x.banner_photo, ''), f.name) > 0)
     and not exists (select 1 from public.store_products x where strpos(x.images::text, f.name) > 0)
     and not exists (select 1 from public.vet_records x where strpos(x.attachments::text, f.name) > 0)
     and not exists (select 1 from public.breeding_loans x
                      where strpos(coalesce(x.condition_photos_out::text, '') || coalesce(x.condition_photos_in::text, ''), f.name) > 0)
     and not exists (select 1 from public.giveaways x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.blog_posts x where strpos(x.featured_image_url, f.name) > 0)
     and not exists (select 1 from public.testimonials x where strpos(x.avatar_url, f.name) > 0)
     and not exists (select 1 from public.promote_images x where x.storage_path = f.name);

  return jsonb_build_object(
    'email', v_email,
    'auth_user_id', v_uid,
    'profile_deleted', v_profile > 0,
    'geckos_deleted', v_geckos_deleted,
    'geckos_anonymised', v_geckos_kept,
    'photos_deleted', v_images,
    'messages_deleted', v_messages,
    'files', v_files
  );
end;
$function$;

-- =====================================================================
-- Grants for the functions this migration adds
-- =====================================================================
-- Each new function says exactly who may run it (section 8).

revoke all on function public.safe_internal_link(text) from public, anon;
grant execute on function public.safe_internal_link(text) to authenticated, service_role;

revoke all on function public._member_notification(text, text, text, text) from public, anon, authenticated;

revoke all on function public.member_notification_template(text, text, jsonb) from public, anon;
grant execute on function public.member_notification_template(text, text, jsonb) to authenticated;

revoke all on function public.guard_direct_message_update() from public, anon, authenticated;
revoke all on function public.guard_support_message() from public, anon, authenticated;

revoke all on function public.follow_state(text[]) from public, anon;
grant execute on function public.follow_state(text[]) to authenticated;
revoke all on function public.follow_profile(text, boolean) from public, anon;
grant execute on function public.follow_profile(text, boolean) to authenticated;
revoke all on function public.block_profile(text) from public, anon;
grant execute on function public.block_profile(text) to authenticated;
revoke all on function public.send_direct_message_to_profile(text, text, text) from public, anon;
grant execute on function public.send_direct_message_to_profile(text, text, text) to authenticated;
revoke all on function public.breeder_slug_for_profile(text) from public;
grant execute on function public.breeder_slug_for_profile(text) to anon, authenticated;

revoke all on function public.require_market_intelligence() from public, anon;
grant execute on function public.require_market_intelligence() to authenticated, service_role;
