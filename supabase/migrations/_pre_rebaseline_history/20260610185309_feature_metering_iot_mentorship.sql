-- ============================================================================
-- Feature metering + IoT connections + mentorship offers + similarity helper
-- ============================================================================
-- Supports the June 2026 feature wave. Three concerns:
--
-- 1. feature_usage: a generic monthly credit ledger for metered features
--    (assistant messages, health screens, IoT polls, visual searches,
--    growth reels). Mirrors morph_id_usage (20260516) but keyed by a
--    feature name so each new metered feature doesn't need a new table.
--    Tier allotments live in src/lib/tierLimits.js. Hard caps, no
--    overage; NULL included = unlimited (usage still counted).
--
-- 2. iot_connections: per-user IoT provider credentials (Govee etc.).
--    OWNER-ONLY RLS. Per DECISIONS.md entry 25, secrets never live on
--    the public profiles table; this table exists precisely for that.
--
-- 3. mentor_offers: opt-in mentorship/consult/course listings for the
--    education marketplace. Public read of active offers, owner manage.
--
-- Plus similar_gecko_images_by_url: convenience wrapper over the
-- existing embedding index so the client can ask for visual neighbors
-- of a photo it already has the URL for.
-- ============================================================================

-- 1. ---------------------------------------------------------------------
create table if not exists public.feature_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  month_key text not null,
  tier_at_start text not null default 'free',
  credits_included integer,            -- NULL = unlimited
  credits_consumed integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (user_id, feature, month_key)
);

create index if not exists feature_usage_user_idx
  on public.feature_usage(user_id, feature, month_key desc);

alter table public.feature_usage enable row level security;

drop policy if exists "Users read their own feature usage" on public.feature_usage;
create policy "Users read their own feature usage"
  on public.feature_usage
  for select
  using (user_id = auth.uid());
-- Writes go only through the RPC below (security definer); no direct
-- insert/update policies on purpose.

-- consume_feature_credit
-- Atomically reserve p_cost credits of a named feature for the CALLING
-- auth user (auth.uid(); never a parameter, so users cannot consume on
-- behalf of others). Raises 'feature_credits_exhausted' when the
-- consumption would exceed credits_included. NULL included = unlimited.
create or replace function public.consume_feature_credit(
  p_feature text,
  p_tier text,
  p_included integer,
  p_cost integer default 1
)
returns public.feature_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_row public.feature_usage;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.feature_usage (user_id, feature, month_key, tier_at_start, credits_included)
  values (v_user, p_feature, v_month, coalesce(p_tier, 'free'), p_included)
  on conflict (user_id, feature, month_key) do nothing;

  select * into v_row
  from public.feature_usage
  where user_id = v_user and feature = p_feature and month_key = v_month
  for update;

  -- Tier upgrades mid-month raise the allotment in place.
  if p_included is null then
    v_row.credits_included := null;
  elsif v_row.credits_included is not null and p_included > v_row.credits_included then
    v_row.credits_included := p_included;
  end if;

  if v_row.credits_included is not null
     and v_row.credits_consumed + p_cost > v_row.credits_included then
    raise exception 'feature_credits_exhausted';
  end if;

  update public.feature_usage
  set credits_consumed = credits_consumed + p_cost,
      credits_included = v_row.credits_included,
      tier_at_start = coalesce(p_tier, tier_at_start),
      updated_date = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.consume_feature_credit(text, text, integer, integer)
  to authenticated;

-- 2. ---------------------------------------------------------------------
create table if not exists public.iot_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'govee',
  api_key text not null,
  device_mappings jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  last_polled_at timestamptz,
  last_readings jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.iot_connections enable row level security;

drop policy if exists "Owners manage their iot connections" on public.iot_connections;
create policy "Owners manage their iot connections"
  on public.iot_connections
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. ---------------------------------------------------------------------
create table if not exists public.mentor_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  headline text not null,
  bio_md text,
  offer_type text not null default 'mentorship', -- mentorship | consult | course
  specialties text[] not null default '{}',
  years_experience integer,
  price_usd numeric,
  price_note text,
  duration_minutes integer,
  availability_note text,
  contact_method text not null default 'messages',
  is_active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.mentor_offers enable row level security;

drop policy if exists "Anyone can browse active mentor offers" on public.mentor_offers;
create policy "Anyone can browse active mentor offers"
  on public.mentor_offers
  for select
  using (is_active = true or user_id = auth.uid());

drop policy if exists "Owners manage their mentor offers" on public.mentor_offers;
create policy "Owners manage their mentor offers"
  on public.mentor_offers
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. ---------------------------------------------------------------------
-- Visual neighbors of a photo the client already knows the URL of.
-- Wraps the hnsw index from 20260417000005; excludes the queried image
-- itself. Authenticated only (the feature is metered client-side and
-- gallery data is public anyway, this just avoids anon scraping).
create or replace function public.similar_gecko_images_by_url(
  p_image_url text,
  match_count int default 12
)
returns table (
  id text,
  image_url text,
  primary_morph text,
  secondary_traits jsonb,
  base_color text,
  created_by text,
  similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
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
  order by g.image_embedding <=> q.image_embedding
  limit greatest(1, least(match_count, 24));
$$;

grant execute on function public.similar_gecko_images_by_url(text, int)
  to authenticated;
