-- Content moderation: a reports table, a Hide switch on member content, and
-- one admin function that hides, removes or dismisses (3 Oct 2026, feature
-- audit step 11; Apple guideline 1.2 needs report and block on all member
-- content).
--
-- What this does:
--
-- 1. public.content_reports. One row per report: who reported, what kind of
--    item (target_type), which row (target_id), a category and the reason,
--    and the moderation status. A member can file reports and read their
--    own; admins read and update all of them. One open report per member
--    per item (a second tap is not a second report), and at most 30 reports
--    an hour per member.
--
-- 2. moderation_hidden on the tables members publish to: forum_posts,
--    forum_comments, gecko_images, geckos, profiles, breeder_store_pages,
--    breeder_profiles, gecko_waitlists and morph_reference_images. It is
--    false on every row, so nothing changes until an admin hides something.
--    Only admins (or the database itself) can change it; a member's update
--    that carries the old value keeps working, it just cannot flip it.
--
-- 3. Restrictive row rules, so a hidden row is invisible to everyone except
--    its owner and admins, signed in or not. Restrictive rules are added to
--    the existing ones (both must pass), so they can only take rows away,
--    and only hidden rows. profiles already has no public read rule; its
--    public reads go through read_profiles and public_profile_content, which
--    now skip hidden profiles. The other functions that read these tables
--    on a visitor's behalf (community_feed, join_waitlist, the passport
--    visibility checks, similar_gecko_images_by_url) skip hidden rows too.
--    community_feed also leaves out members the viewer has blocked.
--
-- 4. public.moderate_content(type, id, action): admin only. Actions:
--    hide, unhide, remove, dismiss. For forum posts, forum comments and
--    gallery photos the Reports view erases the row itself (admins already
--    may), and "remove" then closes the reports. "remove" also rejects a Morph Guide
--    photo; takes a listing off the marketplace (is_public false, the
--    animal and its records stay with the owner); for a profile it makes
--    the profile private, hides it and clears the bio and pictures; for a
--    store page, breeder page or waitlist it unpublishes and hides it.
--    Every open report on that item is closed with the action taken.
--
-- 5. public.admin_content_reports(status): the admin queue, each report with
--    a short summary of the item (title, text, picture, owner, hidden or
--    gone) so the Reports view can show it without a request per row.
--
-- Backward compatible: new table, new columns with a default, new
-- functions, restrictive rules that match nothing until a row is hidden,
-- and function bodies that keep their signatures. Idempotent.

-- Fail fast instead of queueing behind a long transaction.
set local lock_timeout = '10s';

-- 1. Reports ---------------------------------------------------------------

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_email text not null default auth.email(),
  target_type text not null check (target_type in (
    'forum_post', 'forum_comment', 'gecko_image', 'gecko', 'profile',
    'breeder_page', 'store_page', 'waitlist', 'morph_photo', 'conversation'
  )),
  target_id text not null check (length(target_id) between 1 and 200),
  category text not null default 'other' check (category in (
    'spam', 'harassment', 'misleading', 'inappropriate', 'animal_welfare', 'other'
  )),
  reason text not null check (length(btrim(reason)) between 1 and 3000),
  excerpt text check (excerpt is null or length(excerpt) <= 3000),
  page text check (page is null or length(page) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  action_taken text check (action_taken is null or action_taken in ('hidden', 'removed', 'unhidden', 'dismissed')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx
  on public.content_reports (target_type, target_id);
create unique index if not exists content_reports_one_open_per_reporter
  on public.content_reports (reporter_email, target_type, target_id)
  where status = 'open';

alter table public.content_reports enable row level security;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'content_reports' and policyname = 'content_reports_insert_own') then
    create policy content_reports_insert_own on public.content_reports
      for insert to authenticated
      with check (
        reporter_email = (select auth.email())
        and status = 'open'
        and action_taken is null
        and resolved_by is null
        and resolved_at is null
      );
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'content_reports' and policyname = 'content_reports_read_own_or_admin') then
    create policy content_reports_read_own_or_admin on public.content_reports
      for select to authenticated
      using (reporter_email = (select auth.email()) or (select public.is_admin()));
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'content_reports' and policyname = 'content_reports_update_admin') then
    create policy content_reports_update_admin on public.content_reports
      for update to authenticated
      using ((select public.is_admin()))
      with check ((select public.is_admin()));
  end if;
end $p$;

revoke all on public.content_reports from anon;
grant select, insert on public.content_reports to authenticated;
grant update on public.content_reports to authenticated;

create or replace function public.content_reports_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.reason := btrim(new.reason);
    new.created_at := now();
    if auth.uid() is not null and (
      select count(*) from public.content_reports
       where reporter_email = new.reporter_email
         and created_at > now() - interval '1 hour'
    ) >= 30 then
      raise exception 'You have sent a lot of reports in the last hour. Please try again later.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create or replace trigger content_reports_guard
  before insert or update on public.content_reports
  for each row execute function public.content_reports_guard();

-- 2. The Hide switch --------------------------------------------------------

alter table public.forum_posts add column if not exists moderation_hidden boolean not null default false;
alter table public.forum_comments add column if not exists moderation_hidden boolean not null default false;
alter table public.gecko_images add column if not exists moderation_hidden boolean not null default false;
alter table public.geckos add column if not exists moderation_hidden boolean not null default false;
alter table public.profiles add column if not exists moderation_hidden boolean not null default false;
alter table public.breeder_store_pages add column if not exists moderation_hidden boolean not null default false;
alter table public.breeder_profiles add column if not exists moderation_hidden boolean not null default false;
alter table public.gecko_waitlists add column if not exists moderation_hidden boolean not null default false;
alter table public.morph_reference_images add column if not exists moderation_hidden boolean not null default false;

-- Members cannot set or clear the flag. Not security definer on purpose:
-- current_user is the member's role on a direct write, and the owning role
-- inside moderate_content and other database functions.
create or replace function public.guard_moderation_hidden()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user in ('authenticated', 'anon') and not coalesce(public.is_admin(), false) then
    if tg_op = 'INSERT' then
      new.moderation_hidden := false;
    elsif new.moderation_hidden is distinct from old.moderation_hidden then
      new.moderation_hidden := old.moderation_hidden;
    end if;
  end if;
  return new;
end;
$function$;

do $do$
declare t text;
begin
  foreach t in array array['forum_posts', 'forum_comments', 'gecko_images', 'geckos', 'profiles',
                           'breeder_store_pages', 'breeder_profiles', 'gecko_waitlists',
                           'morph_reference_images']
  loop
    execute format('create or replace trigger %I before insert or update of moderation_hidden on public.%I '
                   'for each row execute function public.guard_moderation_hidden()',
                   t || '_guard_moderation_hidden', t);
  end loop;
end
$do$;

-- 3. Hidden rows are invisible to everyone but the owner and admins ---------

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'forum_posts' and policyname = 'forum_posts_hide_moderated') then
    create policy forum_posts_hide_moderated on public.forum_posts as restrictive
      for select using (moderation_hidden = false or created_by = (select auth.email()) or (select public.is_admin()));
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'forum_comments' and policyname = 'forum_comments_hide_moderated') then
    create policy forum_comments_hide_moderated on public.forum_comments as restrictive
      for select using (moderation_hidden = false or created_by = (select auth.email()) or (select public.is_admin()));
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'gecko_images' and policyname = 'gecko_images_hide_moderated') then
    create policy gecko_images_hide_moderated on public.gecko_images as restrictive
      for select using (moderation_hidden = false or created_by = (select auth.email()) or (select public.is_admin()));
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'geckos' and policyname = 'geckos_hide_moderated') then
    create policy geckos_hide_moderated on public.geckos as restrictive
      for select using (
        moderation_hidden = false
        or created_by = (select auth.email())
        or (select public.is_admin())
        or public.is_collection_member(collection_id, (select auth.email()))
      );
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'breeder_store_pages' and policyname = 'breeder_store_pages_hide_moderated') then
    create policy breeder_store_pages_hide_moderated on public.breeder_store_pages as restrictive
      for select using (moderation_hidden = false or owner_email = (select auth.email()) or (select public.is_admin()));
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'breeder_profiles' and policyname = 'breeder_profiles_hide_moderated') then
    create policy breeder_profiles_hide_moderated on public.breeder_profiles as restrictive
      for select using (moderation_hidden = false or created_by = (select auth.email()) or (select public.is_admin()));
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'gecko_waitlists' and policyname = 'gecko_waitlists_hide_moderated') then
    create policy gecko_waitlists_hide_moderated on public.gecko_waitlists as restrictive
      for select using (moderation_hidden = false or breeder_user_id = (select auth.uid()) or (select public.is_admin()));
  end if;
end $p$;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'morph_reference_images' and policyname = 'morph_reference_images_hide_moderated') then
    create policy morph_reference_images_hide_moderated on public.morph_reference_images as restrictive
      for select using (
        moderation_hidden = false
        or created_by = (select auth.email())
        or submitted_by_email = (select auth.email())
        or (select public.is_admin())
      );
  end if;
end $p$;

-- Functions that read for visitors: skip hidden rows.

create or replace function public.read_profiles(p_emails text[] default null::text[])
returns setof public.profiles
language sql
stable
security definer
set search_path to ''
as $function$
  select r.* from public.profiles p
  cross join lateral jsonb_populate_record(null::public.profiles,
    case when p.email = auth.email() or public.is_admin() then to_jsonb(p)
    else jsonb_build_object(
      'id',p.id,'email',case when auth.uid() is not null or p.email = any(p_emails) then p.email else null end,
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

create or replace function public.public_profile_content(p_profile_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare p public.profiles; g jsonb := '[]'; b jsonb := '[]'; s jsonb; v_hide text := '';
begin
  select * into p from public.profiles where id=p_profile_id and (is_public_profile=true or email=auth.email() or public.is_admin())
    and (moderation_hidden=false or email=auth.email() or public.is_admin());
  if p.id is null then return null; end if;
  -- Signed-out visitors do not get the owner's email on each row.
  if auth.uid() is null then v_hide := 'created_by'; end if;
  if p.privacy_show_collection is distinct from false then
    select coalesce(jsonb_agg(to_jsonb(x) - v_hide),'[]') into g from public.geckos x where x.created_by=p.email and x.is_public=true and x.archived is distinct from true
      and (x.moderation_hidden=false or p.email=auth.email() or public.is_admin());
    select coalesce(jsonb_agg(to_jsonb(x) - v_hide),'[]') into b from public.breeding_plans x where x.created_by=p.email and x.is_public=true;
  end if;
  select jsonb_build_object('slug',slug,'is_published',is_published,'title',title) into s
    from public.breeder_store_pages where owner_email=p.email and is_published=true
      and (moderation_hidden=false or p.email=auth.email() or public.is_admin()) limit 1;
  return jsonb_build_object('geckos',g,'breeding_plans',b,'store_page',s);
end $function$;

create or replace function public.gecko_passport_is_public(p_animal_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.geckos g
     where g.id = p_animal_id
       and g.passport_code is not null
       and g.is_public = true
       and g.moderation_hidden = false
  );
$function$;

create or replace function public.get_passport_visibility(p_code text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case when g.is_public and g.moderation_hidden = false then 'public' else 'private' end
    from public.geckos g
   where g.passport_code = p_code
     and p_code is not null
     and length(p_code) >= 4
   limit 1;
$function$;

create or replace function public.similar_gecko_images_by_url(p_image_url text, match_count integer default 12)
returns table(id text, image_url text, primary_morph text, secondary_traits jsonb, base_color text, created_by text, similarity double precision)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
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
    g.created_by,
    1 - (g.image_embedding <=> q.image_embedding) as similarity
  from public.gecko_images g, q
  where g.image_embedding is not null
    and g.image_url <> p_image_url
    and g.moderation_hidden = false
  order by g.image_embedding <=> q.image_embedding
  limit greatest(1, least(match_count, 24));
$function$;

create or replace function public.community_feed(p_limit integer default 25)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
WITH viewer AS (
  SELECT auth.uid() IS NOT NULL AS signed_in
),
uploads AS (
  SELECT
    'upload'::text AS event_type,
    gi.id::text AS event_id,
    gi.created_date,
    gi.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, CASE WHEN (SELECT signed_in FROM viewer) THEN split_part(p.email, '@', 1) ELSE 'Geck Inspect keeper' END) AS actor_name,
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
    coalesce(p.full_name, p.business_name, CASE WHEN (SELECT signed_in FROM viewer) THEN split_part(p.email, '@', 1) ELSE 'Geck Inspect keeper' END) AS actor_name,
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
    coalesce(p.full_name, p.business_name, CASE WHEN (SELECT signed_in FROM viewer) THEN split_part(p.email, '@', 1) ELSE 'Geck Inspect keeper' END) AS actor_name,
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
    coalesce(p.full_name, p.business_name, CASE WHEN (SELECT signed_in FROM viewer) THEN split_part(p.email, '@', 1) ELSE 'Geck Inspect keeper' END) AS actor_name,
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
    coalesce(p.full_name, p.business_name, CASE WHEN (SELECT signed_in FROM viewer) THEN split_part(p.email, '@', 1) ELSE 'Geck Inspect keeper' END) AS actor_name,
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
    CASE WHEN (SELECT signed_in FROM viewer) THEN row_to_json(ranked)
         ELSE (to_jsonb(ranked) - 'actor_email')::json END
    ORDER BY ranked.created_date DESC),
  '[]'::json)
FROM ranked;
$function$;

create or replace function public.join_waitlist(p_slug text, p_name text, p_email text, p_wanted text default null::text, p_notes text default null::text, p_accept_terms boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  w public.gecko_waitlists;
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_wanted text := nullif(trim(coalesce(p_wanted, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_terms text;
  mine public.gecko_waitlist_signups;
  already boolean := false;
  place int;
  recent int;
begin
  if v_name = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter your name and a valid email.';
  end if;
  if length(v_name) > 120 or length(v_email) > 200
     or length(coalesce(v_wanted, '')) > 300 or length(coalesce(v_notes, '')) > 1000 then
    raise exception 'That is too long. Please shorten it.';
  end if;

  -- A waitlist hidden by a moderator behaves like a removed one.
  select * into w from public.gecko_waitlists where slug = p_slug and moderation_hidden = false;
  if not found then
    raise exception 'This waitlist link is invalid or has been removed.';
  end if;
  v_terms := nullif(trim(coalesce(w.deposit_terms, '')), '');

  select * into mine
    from public.gecko_waitlist_signups
   where waitlist_id = w.id and lower(email) = v_email and status not in ('withdrawn', 'refunded')
   order by created_date
   limit 1;

  if found then
    already := true;
  else
    if not w.is_open or (w.closes_at is not null and w.closes_at < now()) then
      raise exception 'This waitlist is closed.';
    end if;
    if v_terms is not null and not coalesce(p_accept_terms, false) then
      raise exception 'Please read and agree to the deposit terms to join.';
    end if;
    if w.max_signups is not null and (
      select count(*) from public.gecko_waitlist_signups
       where waitlist_id = w.id and status not in ('withdrawn', 'refunded')
    ) >= w.max_signups then
      raise exception 'This waitlist is full.';
    end if;

    insert into public.gecko_waitlist_signups
      (waitlist_id, name, email, wanted_outcome, notes, terms_accepted_at, terms_snapshot)
    values
      (w.id, v_name, v_email, v_wanted, v_notes,
       case when v_terms is not null then now() end, v_terms)
    returning * into mine;

    select count(*) into recent
      from public.notifications
     where type = 'waitlist_signup'
       and metadata->>'waitlist_id' = w.id::text
       and created_date > now() - interval '1 hour';
    if recent < 20 then
      insert into public.notifications (user_email, type, content, link, metadata)
      select u.email,
             'waitlist_signup',
             left(v_name || ' joined your waitlist "' || w.title || '"'
                  || coalesce(', hoping for ' || v_wanted, '') || '.', 500),
             '/MarketplaceSalesStats?tab=waitlists',
             jsonb_build_object('waitlist_id', w.id)
        from auth.users u
       where u.id = w.breeder_user_id and u.email is not null;
    end if;
  end if;

  select count(*) into place
    from public.gecko_waitlist_signups s
   where s.waitlist_id = w.id
     and s.status not in ('withdrawn', 'refunded')
     and (s.created_date, s.id) <= (mine.created_date, mine.id);

  return jsonb_build_object('position', place, 'already', already);
end;
$function$;

-- 4. Moderation actions -----------------------------------------------------

create or replace function public.moderate_content(p_target_type text, p_target_id text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_rows int := 0;
  v_hide boolean;
  v_taken text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can moderate content.';
  end if;
  if p_action not in ('hide', 'unhide', 'remove', 'dismiss') then
    raise exception 'Unknown moderation action: %', p_action;
  end if;
  if p_target_type not in ('forum_post', 'forum_comment', 'gecko_image', 'gecko', 'profile',
                           'breeder_page', 'store_page', 'waitlist', 'morph_photo', 'conversation') then
    raise exception 'Unknown content type: %', p_target_type;
  end if;
  if p_target_type = 'conversation' and p_action <> 'dismiss' then
    raise exception 'Conversations can only be dismissed here. Use the Support inbox or Users to act on the member.';
  end if;

  if p_action in ('hide', 'unhide') then
    v_hide := p_action = 'hide';
    case p_target_type
      when 'forum_post' then update public.forum_posts set moderation_hidden = v_hide where id = p_target_id;
      when 'forum_comment' then update public.forum_comments set moderation_hidden = v_hide where id = p_target_id;
      when 'gecko_image' then update public.gecko_images set moderation_hidden = v_hide where id = p_target_id;
      when 'gecko' then update public.geckos set moderation_hidden = v_hide where id = p_target_id;
      when 'profile' then update public.profiles set moderation_hidden = v_hide where id = p_target_id;
      when 'breeder_page' then update public.breeder_profiles set moderation_hidden = v_hide where id::text = p_target_id;
      when 'store_page' then update public.breeder_store_pages set moderation_hidden = v_hide where id::text = p_target_id;
      when 'waitlist' then update public.gecko_waitlists set moderation_hidden = v_hide where id::text = p_target_id;
      when 'morph_photo' then update public.morph_reference_images set moderation_hidden = v_hide where id = p_target_id;
    end case;
    get diagnostics v_rows = row_count;
    v_taken := case when v_hide then 'hidden' else 'unhidden' end;
  elsif p_action = 'remove' then
    case p_target_type
      when 'forum_post', 'forum_comment', 'gecko_image' then
        -- The Reports view erases these rows itself first (admins already
        -- have that right on all three tables), then calls this to close
        -- the reports. Here they are only kept hidden in case the client
        -- step did not finish.
        execute format('update public.%I set moderation_hidden = true where id = $1',
                       case p_target_type when 'forum_post' then 'forum_posts'
                                          when 'forum_comment' then 'forum_comments'
                                          else 'gecko_images' end)
          using p_target_id;
      when 'gecko' then
        -- Off the marketplace and out of public view. The animal and its
        -- care and breeding records stay with the owner.
        update public.geckos set is_public = false where id = p_target_id;
      when 'profile' then
        update public.profiles
           set is_public_profile = false, moderation_hidden = true,
               bio = null, profile_image_url = null, cover_image_url = null
         where id = p_target_id;
      when 'breeder_page' then
        update public.breeder_profiles
           set moderation_hidden = true, bio = null, profile_photo = null, banner_photo = null
         where id::text = p_target_id;
      when 'store_page' then
        update public.breeder_store_pages set is_published = false, moderation_hidden = true where id::text = p_target_id;
      when 'waitlist' then
        update public.gecko_waitlists set is_open = false, moderation_hidden = true where id::text = p_target_id;
      when 'morph_photo' then
        update public.morph_reference_images
           set status = 'rejected', rejection_reason = 'Removed by a moderator', moderation_hidden = true
         where id = p_target_id;
    end case;
    get diagnostics v_rows = row_count;
    v_taken := 'removed';
  else
    v_taken := 'dismissed';
  end if;

  update public.content_reports
     set status = case
                    when v_taken = 'dismissed' then 'dismissed'
                    when v_taken = 'unhidden' then status
                    else 'actioned'
                  end,
         action_taken = v_taken,
         resolved_by = auth.email(),
         resolved_at = now()
   where target_type = p_target_type
     and target_id = p_target_id
     and (status = 'open' or v_taken = 'unhidden');

  return jsonb_build_object('action', v_taken, 'rows', v_rows);
end;
$function$;

revoke all on function public.moderate_content(text, text, text) from public, anon;
grant execute on function public.moderate_content(text, text, text) to authenticated;

-- 5. The admin queue --------------------------------------------------------

create or replace function public.admin_content_reports(p_status text default 'open', p_limit integer default 200)
returns table (
  id uuid,
  target_type text,
  target_id text,
  category text,
  reason text,
  excerpt text,
  page text,
  status text,
  action_taken text,
  reporter_email text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by text,
  reports_on_target bigint,
  target jsonb
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can read the report queue.';
  end if;
  return query
  select r.id, r.target_type, r.target_id, r.category, r.reason, r.excerpt, r.page, r.status,
         r.action_taken, r.reporter_email, r.created_at, r.resolved_at, r.resolved_by,
         (select count(*) from public.content_reports r2
           where r2.target_type = r.target_type and r2.target_id = r.target_id),
         case r.target_type
           when 'forum_post' then (select jsonb_build_object('title', x.title, 'text', left(x.content, 600),
               'image_url', x.image_urls->>0, 'owner_email', x.created_by, 'hidden', x.moderation_hidden)
               from public.forum_posts x where x.id = r.target_id)
           when 'forum_comment' then (select jsonb_build_object('title', 'Comment', 'text', left(x.content, 600),
               'image_url', x.image_urls->>0, 'owner_email', x.created_by, 'hidden', x.moderation_hidden,
               'post_id', x.post_id)
               from public.forum_comments x where x.id = r.target_id)
           when 'gecko_image' then (select jsonb_build_object('title', coalesce(replace(x.primary_morph, '_', ' '), 'Gallery photo'),
               'text', left(x.notes, 600), 'image_url', x.image_url, 'owner_email', x.created_by,
               'hidden', x.moderation_hidden)
               from public.gecko_images x where x.id = r.target_id)
           when 'gecko' then (select jsonb_build_object('title', coalesce(x.name, x.gecko_id_code, 'Listing'),
               'text', left(coalesce(x.marketplace_description, x.notes), 600), 'image_url', x.image_urls->>0,
               'owner_email', x.created_by, 'hidden', x.moderation_hidden, 'is_public', x.is_public,
               'status', x.status, 'passport_code', x.passport_code)
               from public.geckos x where x.id = r.target_id)
           when 'profile' then (select jsonb_build_object('title', coalesce(x.business_name, x.full_name, 'Profile'),
               'text', left(x.bio, 600), 'image_url', x.profile_image_url, 'owner_email', x.email,
               'hidden', x.moderation_hidden, 'is_public', x.is_public_profile)
               from public.profiles x where x.id = r.target_id)
           when 'breeder_page' then (select jsonb_build_object('title', coalesce(x.display_name, 'Breeder page'),
               'text', left(x.bio, 600), 'image_url', x.profile_photo, 'owner_email', x.created_by,
               'hidden', x.moderation_hidden, 'slug', x.custom_slug)
               from public.breeder_profiles x where x.id::text = r.target_id)
           when 'store_page' then (select jsonb_build_object('title', coalesce(x.title, 'Store page'),
               'text', left(coalesce(x.tagline, x.description), 600), 'image_url', x.header_image_url,
               'owner_email', x.owner_email, 'hidden', x.moderation_hidden, 'is_public', x.is_published,
               'slug', x.slug)
               from public.breeder_store_pages x where x.id::text = r.target_id)
           when 'waitlist' then (select jsonb_build_object('title', coalesce(x.title, 'Waitlist'),
               'text', left(x.description, 600), 'owner_email', u.email, 'hidden', x.moderation_hidden,
               'is_public', x.is_open, 'slug', x.slug)
               from public.gecko_waitlists x left join auth.users u on u.id = x.breeder_user_id
               where x.id::text = r.target_id)
           when 'morph_photo' then (select jsonb_build_object('title', 'Morph Guide photo', 'image_url', x.image_url,
               'owner_email', x.submitted_by_email, 'hidden', x.moderation_hidden, 'status', x.status,
               'slug', x.morph_guide_id)
               from public.morph_reference_images x where x.id = r.target_id)
           when 'conversation' then jsonb_build_object('title', 'Direct messages', 'owner_email', r.target_id)
         end
    from public.content_reports r
   where p_status is null or p_status = 'all' or r.status = p_status
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$function$;

revoke all on function public.admin_content_reports(text, integer) from public, anon;
grant execute on function public.admin_content_reports(text, integer) to authenticated;
