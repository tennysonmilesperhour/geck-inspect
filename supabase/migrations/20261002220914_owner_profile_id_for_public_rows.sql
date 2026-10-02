-- Owner emails off public gecko rows, step 1 of 2 (additive, safe for the
-- client that is live today).
--
-- geckos.created_by and gecko_images.created_by hold the owner's email
-- address, and signed-out visitors can read both. Step 2 (a separate
-- migration, applied only after the new client is deployed) takes the
-- created_by column away from the anon role. Before that can happen,
-- signed-out pages need another way to say "who owns this":
--
-- 1. owner_profile_id: the owner's profiles.id, kept in step with
--    created_by by a trigger (a client cannot set it to someone else).
--    Pages look the display name up from read_profiles by this id.
-- 2. community_owner_gecko_counts() gives the per-owner counts keyed by
--    owner_profile_id. The old community_gecko_counts() runs as its owner
--    (so it keeps working once anon loses created_by) and only returns
--    created_by to signed-in callers.
-- 3. public_profile_content() and community_feed() stop handing owner
--    emails to signed-out callers.

alter table public.geckos add column if not exists owner_profile_id text;
alter table public.gecko_images add column if not exists owner_profile_id text;

create or replace function public.set_owner_profile_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.owner_profile_id := (
    select p.id from public.profiles p where p.email = new.created_by
  );
  return new;
end;
$$;

revoke all on function public.set_owner_profile_id() from public, anon, authenticated;

create or replace trigger geckos_set_owner_profile_id
  before insert or update on public.geckos
  for each row execute function public.set_owner_profile_id();

create or replace trigger gecko_images_set_owner_profile_id
  before insert or update on public.gecko_images
  for each row execute function public.set_owner_profile_id();

-- Backfill. The change-timestamp trigger is paused so filling in this
-- column does not mark every gecko as recently changed.
alter table public.geckos disable trigger geckos_bump_change_ts;
update public.geckos g
   set owner_profile_id = p.id
  from public.profiles p
 where p.email = g.created_by
   and g.owner_profile_id is distinct from p.id;
alter table public.geckos enable trigger geckos_bump_change_ts;

update public.gecko_images gi
   set owner_profile_id = p.id
  from public.profiles p
 where p.email = gi.created_by
   and gi.owner_profile_id is distinct from p.id;

create index if not exists geckos_owner_profile_id_idx on public.geckos (owner_profile_id);
create index if not exists gecko_images_owner_profile_id_idx on public.gecko_images (owner_profile_id);

-- Per-owner counts keyed by profile id, with no email in the result. The
-- Community page and Featured Breeders read this one from now on.
create or replace function public.community_owner_gecko_counts()
returns table(
  owner_profile_id text,
  keeping integer,
  selling integer,
  breeding integer,
  cover_image text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.owner_profile_id,
    count(*) filter (where g.status is distinct from 'Sold')::int,
    count(*) filter (where g.status = 'For Sale')::int,
    count(*) filter (where g.status in ('Ready to Breed', 'Proven', 'Future Breeder'))::int,
    (array_agg(g.image_urls ->> 0 order by g.created_date)
       filter (where jsonb_typeof(g.image_urls) = 'array' and jsonb_array_length(g.image_urls) > 0))[1]
  from public.geckos g
  where g.owner_profile_id is not null
    and coalesce(g.is_public, true)
    and (g.is_public is true or g.created_by = auth.email())
    and not coalesce(g.archived, false)
  group by g.owner_profile_id
$$;

revoke all on function public.community_owner_gecko_counts() from public;
grant execute on function public.community_owner_gecko_counts() to anon, authenticated, service_role;

-- The old email-keyed version stays for the client that is live today.
-- It now runs as its owner (it would fail for signed-out visitors once
-- step 2 lands) and leaves created_by empty for them.
create or replace function public.community_gecko_counts()
returns table(created_by text, keeping integer, selling integer, breeding integer, cover_image text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when auth.uid() is not null then g.created_by end,
    count(*) filter (where g.status is distinct from 'Sold')::int,
    count(*) filter (where g.status = 'For Sale')::int,
    count(*) filter (where g.status in ('Ready to Breed', 'Proven', 'Future Breeder'))::int,
    (array_agg(g.image_urls ->> 0 order by g.created_date)
       filter (where jsonb_typeof(g.image_urls) = 'array' and jsonb_array_length(g.image_urls) > 0))[1]
  from public.geckos g
  where g.created_by is not null
    and coalesce(g.is_public, true)
    and (g.is_public is true or g.created_by = auth.email())
    and not coalesce(g.archived, false)
  group by g.created_by
$$;

create or replace function public.public_profile_content(p_profile_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare p public.profiles; g jsonb := '[]'; b jsonb := '[]'; s jsonb; v_hide text := '';
begin
  select * into p from public.profiles where id=p_profile_id and (is_public_profile=true or email=auth.email() or public.is_admin());
  if p.id is null then return null; end if;
  -- Signed-out visitors do not get the owner's email on each row.
  if auth.uid() is null then v_hide := 'created_by'; end if;
  if p.privacy_show_collection is distinct from false then
    select coalesce(jsonb_agg(to_jsonb(x) - v_hide),'[]') into g from public.geckos x where x.created_by=p.email and x.is_public=true and x.archived is distinct from true;
    select coalesce(jsonb_agg(to_jsonb(x) - v_hide),'[]') into b from public.breeding_plans x where x.created_by=p.email and x.is_public=true;
  end if;
  select jsonb_build_object('slug',slug,'is_published',is_published,'title',title) into s
    from public.breeder_store_pages where owner_email=p.email and is_published=true limit 1;
  return jsonb_build_object('geckos',g,'breeding_plans',b,'store_page',s);
end $$;

-- Same feed as before. For signed-out callers the actor_email key is
-- dropped and a member with no name shows as "Geck Inspect keeper"
-- instead of the first half of their email address.
create or replace function public.community_feed(p_limit integer default 25)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
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
  SELECT * FROM combined
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
$$;
