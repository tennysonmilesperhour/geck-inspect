-- Generated from the complete geck-data migration history.
-- Target: Geck Inspect (2026-09-04T07:44:23.949Z).
-- Reversible boundary: every database object is namespaced in geck_data.

create schema if not exists geck_data;
grant usage on schema geck_data to anon, authenticated, service_role;
set search_path = geck_data, extensions, public, pg_catalog;

-- These two tables predated Geck Data's checked-in migration history. Their
-- definitions are generated from the live source catalog so the historical
-- migrations below can be replayed without touching public.
create table geck_data.market_sellers (
  seller_id text primary key,
  seller_name text,
  seller_location text,
  membership text,
  five_star_rating real,
  feedback_count integer,
  seller_rating_score integer,
  total_listings integer,
  total_listings_with_price integer,
  avg_price real,
  median_price real,
  min_price real,
  max_price real,
  total_proven_breeder integer,
  total_with_dams integer,
  total_with_sires integer,
  total_auctions integer,
  top_traits text,
  morph_specialization text,
  sex_breakdown jsonb,
  maturity_breakdown jsonb,
  avg_weight_grams real,
  avg_likes real,
  pct_renewed real,
  first_seen_listing text,
  last_seen_listing text,
  price_tier text,
  volume_tier text,
  updated_at timestamptz default now(),
  total_followers integer,
  created_year integer,
  can_ship boolean,
  is_away boolean,
  payment_methods text,
  about_text text,
  policy_text text,
  instagram_url text,
  tiktok_url text,
  facebook_url text,
  youtube_url text
);

create table geck_data.market_listings (
  id text primary key,
  morphmarket_key integer unique,
  url text,
  title text,
  price real,
  price_usd_equivalent real,
  sex text,
  maturity text,
  description text,
  first_listed text,
  store_name text,
  seller_id text,
  seller_name text,
  seller_location text,
  seller_rating integer,
  seller_sales integer,
  five_star_rating real,
  membership text,
  likes_count integer,
  is_renewed boolean,
  is_auction boolean,
  fixed_shipping real,
  min_shipping real,
  max_shipping real,
  birth_year integer,
  birth_month integer,
  birth_day integer,
  weight text,
  proven_breeder boolean,
  diet text,
  item_origin text,
  price_flexibility text,
  cached_traits text,
  norm_traits text,
  has_dams boolean default false,
  has_sires boolean default false,
  page_number integer,
  imported_at timestamptz,
  detail_collected boolean default false,
  price_flagged boolean default false,
  created_at timestamptz default now(),
  last_renewal text,
  last_seen text,
  saved_count integer,
  is_sold boolean default false,
  is_on_hold boolean default false,
  total_followers integer,
  seller_created_year integer,
  seller_feedback_count integer,
  bpg_tier text,
  original_price real,
  source text default 'manual',
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  current_status text check (current_status in ('live', 'sold', 'hold', 'removed', 'returned')),
  first_listed_at timestamptz,
  species text default 'unknown',
  canonical_listing_id text,
  is_group_lot boolean not null default false
);

-- Additional legacy ingest tables that also predated the checked-in history.
create table geck_data._backup_0028_trait_rows (
  id text,
  cached_traits text,
  norm_traits text,
  backed_up_at timestamptz
);

create table geck_data.market_auctions (
  auction_id integer primary key,
  listing_key integer,
  starting_bid real,
  highest_bid real,
  bid_count integer,
  end_time timestamptz,
  shipping_price real,
  captured_at timestamptz default now()
);
create index idx_market_auctions_listing on geck_data.market_auctions (listing_key);

create table geck_data.market_galleries (
  listing_key integer primary key,
  images jsonb,
  image_count integer,
  captured_at timestamptz default now()
);

create table geck_data.market_lineage (
  listing_key integer primary key,
  dams jsonb,
  sires jsonb,
  captured_at timestamptz default now()
);

create table geck_data.market_raw_captures (
  id bigserial primary key,
  type text,
  key text,
  data jsonb,
  captured_at timestamptz default now()
);

create table geck_data.morphs (
  id bigserial primary key,
  canonical_name text not null unique,
  category text,
  description text,
  aliases text[]
);
create index idx_morphs_aliases on geck_data.morphs using gin (aliases);

alter table geck_data._backup_0028_trait_rows enable row level security;
alter table geck_data.market_auctions enable row level security;
alter table geck_data.market_galleries enable row level security;
alter table geck_data.market_lineage enable row level security;
alter table geck_data.market_raw_captures enable row level security;
alter table geck_data.morphs enable row level security;

create policy morphs_read_authenticated on geck_data.morphs
  for select to authenticated using (true);

-- BEGIN SOURCE MIGRATION: 0001_init_geck_inspect.sql
-- ============================================================================
-- Geck Inspect / Geck Data, initial schema additions
--
-- Assumes market_listings and market_sellers already exist (from the earlier
-- Python upload). This migration:
--   1) Adds listing_images table
--   2) Creates two Storage buckets: listing-images (public) and raw-uploads (private)
--   3) Enables RLS on the market_* tables and exposes them as public-read
--   4) Adds storage policies so the dashboard can read images publicly,
--      but uploads always go through the server (service role).
--
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run; uses IF NOT EXISTS / ON CONFLICT throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. listing_images table
-- ----------------------------------------------------------------------------
create table if not exists geck_data.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id text references geck_data.market_listings(id) on delete set null,
  storage_bucket text not null default 'listing-images',
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists idx_listing_images_listing_id
  on geck_data.listing_images(listing_id);

create index if not exists idx_listing_images_uploaded_at
  on geck_data.listing_images(uploaded_at desc);

-- ----------------------------------------------------------------------------
-- 2. Storage buckets
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('raw-uploads', 'raw-uploads', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. RLS on market tables
--    Dashboard reads with the anon key, needs public SELECT.
--    Writes only happen through the server-side API route using the service
--    role key, which bypasses RLS, so we don't add public write policies.
-- ----------------------------------------------------------------------------
alter table geck_data.market_listings enable row level security;
alter table geck_data.market_sellers  enable row level security;
alter table geck_data.listing_images  enable row level security;

drop policy if exists "public read market_listings" on geck_data.market_listings;
create policy "public read market_listings" on geck_data.market_listings
  for select using (true);

drop policy if exists "public read market_sellers" on geck_data.market_sellers;
create policy "public read market_sellers" on geck_data.market_sellers
  for select using (true);

drop policy if exists "public read listing_images" on geck_data.listing_images;
create policy "public read listing_images" on geck_data.listing_images
  for select using (true);

-- ----------------------------------------------------------------------------
-- 4. Storage policies
--    listing-images: anyone can read (bucket is public, but objects also need
--                    a SELECT policy on storage.objects)
--    raw-uploads:    nothing public; only the service role touches it
-- ----------------------------------------------------------------------------
drop policy if exists "public read listing-images" on storage.objects;
create policy "public read listing-images" on storage.objects
  for select using (bucket_id = 'listing-images');

-- (no policies on raw-uploads, service role only)

-- END SOURCE MIGRATION: 0001_init_geck_inspect.sql


-- BEGIN SOURCE MIGRATION: 0002_extension_streams.sql
-- ============================================================================
-- Geck Inspect: 0002: extension streams
--
-- Adds the tables the browser extension needs to stream live events into,
-- beyond the batch .db import covered by 0001. Every table is
--   a) an append-only observation log (price_history, listing_status_events,
--      seller_snapshots, show_mentions, auction_results, price_drops,
--      alert_matches): or
--   b) an upsert-on-external-key store (cross_platform_listings, alerts).
--
-- Also extends market_listings with first_seen_at / last_seen_at so we can
-- compute days-to-sell and listing age without a separate join.
--
-- Safe to re-run. Everything uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. market_listings extensions
-- ----------------------------------------------------------------------------
alter table geck_data.market_listings
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at  timestamptz,
  add column if not exists current_status text
    check (current_status in ('live','sold','hold','removed','returned')) ;

create index if not exists idx_market_listings_last_seen_at
  on geck_data.market_listings(last_seen_at desc);
create index if not exists idx_market_listings_current_status
  on geck_data.market_listings(current_status);

-- ----------------------------------------------------------------------------
-- 1. price_history, every observed price for a listing
-- ----------------------------------------------------------------------------
create table if not exists geck_data.price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  price numeric,
  price_usd_equivalent numeric,
  currency text,
  observed_at timestamptz not null default now(),
  source text
);

create index if not exists idx_price_history_listing_observed
  on geck_data.price_history(listing_id, observed_at desc);

-- ----------------------------------------------------------------------------
-- 2. price_drops, explicit drop deltas (faster than window-fn over history)
-- ----------------------------------------------------------------------------
create table if not exists geck_data.price_drops (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  old_price numeric,
  new_price numeric,
  old_price_usd numeric,
  new_price_usd numeric,
  currency text,
  pct_change numeric,
  observed_at timestamptz not null default now(),
  source text
);

create index if not exists idx_price_drops_listing
  on geck_data.price_drops(listing_id);
create index if not exists idx_price_drops_observed_at
  on geck_data.price_drops(observed_at desc);

-- ----------------------------------------------------------------------------
-- 3. listing_status_events, state transitions (live / sold / hold / removed)
-- ----------------------------------------------------------------------------
create table if not exists geck_data.listing_status_events (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  status text not null check (status in ('live','sold','hold','removed','returned')),
  observed_at timestamptz not null default now(),
  source text, -- 'extension_explicit' | 'extension_inferred' | 'db_import' | 'auction_close'
  days_since_first_seen int,
  unique (listing_id, status, observed_at)
);

create index if not exists idx_listing_status_events_listing
  on geck_data.listing_status_events(listing_id);
create index if not exists idx_listing_status_events_status_observed
  on geck_data.listing_status_events(status, observed_at desc);

-- ----------------------------------------------------------------------------
-- 4. auction_results, when an auction closes, capture the final state
-- ----------------------------------------------------------------------------
create table if not exists geck_data.auction_results (
  id uuid primary key default gen_random_uuid(),
  listing_id text references geck_data.market_listings(id) on delete set null,
  final_price numeric,
  final_price_usd numeric,
  currency text,
  bid_count int,
  winning_bidder text,
  closed_at timestamptz not null default now(),
  observed_at timestamptz not null default now(),
  source text
);

create index if not exists idx_auction_results_closed_at
  on geck_data.auction_results(closed_at desc);
create index if not exists idx_auction_results_listing
  on geck_data.auction_results(listing_id);

-- ----------------------------------------------------------------------------
-- 5. seller_snapshots, periodic capture of seller-level stats
-- ----------------------------------------------------------------------------
create table if not exists geck_data.seller_snapshots (
  id uuid primary key default gen_random_uuid(),
  seller_id text not null references geck_data.market_sellers(seller_id) on delete cascade,
  observed_at timestamptz not null default now(),
  feedback_count int,
  seller_rating_score numeric,
  five_star_rating numeric,
  total_listings int,
  avg_price numeric,
  membership text,
  source text
);

create index if not exists idx_seller_snapshots_seller_observed
  on geck_data.seller_snapshots(seller_id, observed_at desc);

-- ----------------------------------------------------------------------------
-- 6. show_mentions, expo / show references found on listings or in bios
-- ----------------------------------------------------------------------------
create table if not exists geck_data.show_mentions (
  id uuid primary key default gen_random_uuid(),
  listing_id text references geck_data.market_listings(id) on delete set null,
  seller_id text references geck_data.market_sellers(seller_id) on delete set null,
  show_name text not null,
  show_date date,
  context text,                           -- surrounding sentence
  source_url text,
  observed_at timestamptz not null default now()
);

create index if not exists idx_show_mentions_show_name
  on geck_data.show_mentions(show_name);
create index if not exists idx_show_mentions_observed_at
  on geck_data.show_mentions(observed_at desc);

-- ----------------------------------------------------------------------------
-- 7. cross_platform_listings, listings observed on Fauna Classifieds,
--    Reptile Forums, Preloved, Kijiji, etc. keyed by (platform, external_id).
-- ----------------------------------------------------------------------------
create table if not exists geck_data.cross_platform_listings (
  id uuid primary key default gen_random_uuid(),
  platform text not null,                 -- 'fauna_classifieds' | 'reptile_forums' | 'preloved' | 'kijiji' | …
  external_id text not null,
  title text,
  description text,
  price numeric,
  price_usd_equivalent numeric,
  currency text,
  seller_name text,
  seller_location text,
  url text,
  traits_raw text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  payload jsonb,
  unique (platform, external_id)
);

create index if not exists idx_cross_platform_platform
  on geck_data.cross_platform_listings(platform);
create index if not exists idx_cross_platform_last_seen_at
  on geck_data.cross_platform_listings(last_seen_at desc);

-- ----------------------------------------------------------------------------
-- 8. alerts + alert_matches, saved queries and their hits
-- ----------------------------------------------------------------------------
create table if not exists geck_data.alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  query jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_owner on geck_data.alerts(owner_id);

create table if not exists geck_data.alert_matches (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references geck_data.alerts(id) on delete cascade,
  listing_id text references geck_data.market_listings(id) on delete set null,
  cross_platform_listing_id uuid references geck_data.cross_platform_listings(id) on delete set null,
  matched_at timestamptz not null default now(),
  payload jsonb,
  -- at least one side of the match must be populated
  check (listing_id is not null or cross_platform_listing_id is not null)
);

create index if not exists idx_alert_matches_alert on geck_data.alert_matches(alert_id);
create index if not exists idx_alert_matches_matched_at on geck_data.alert_matches(matched_at desc);

-- ----------------------------------------------------------------------------
-- 9. RLS, public read (reads via anon key, writes via service role only)
-- ----------------------------------------------------------------------------
alter table geck_data.price_history            enable row level security;
alter table geck_data.price_drops              enable row level security;
alter table geck_data.listing_status_events    enable row level security;
alter table geck_data.auction_results          enable row level security;
alter table geck_data.seller_snapshots         enable row level security;
alter table geck_data.show_mentions            enable row level security;
alter table geck_data.cross_platform_listings  enable row level security;
alter table geck_data.alerts                   enable row level security;
alter table geck_data.alert_matches            enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'price_history','price_drops','listing_status_events','auction_results',
    'seller_snapshots','show_mentions','cross_platform_listings','alert_matches'
  ]) loop
    execute format('drop policy if exists "public read %I" on geck_data.%I', t, t);
    execute format('create policy "public read %I" on geck_data.%I for select using (true)', t, t);
  end loop;
end $$;

-- alerts: owner-scoped read/write (personal saved queries)
drop policy if exists "owner read alerts" on geck_data.alerts;
create policy "owner read alerts" on geck_data.alerts
  for select using (auth.uid() = owner_id);

drop policy if exists "owner insert alerts" on geck_data.alerts;
create policy "owner insert alerts" on geck_data.alerts
  for insert with check (auth.uid() = owner_id);

drop policy if exists "owner update alerts" on geck_data.alerts;
create policy "owner update alerts" on geck_data.alerts
  for update using (auth.uid() = owner_id);

drop policy if exists "owner delete alerts" on geck_data.alerts;
create policy "owner delete alerts" on geck_data.alerts
  for delete using (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- 10. touch_listing_seen(p_id, p_observed)
--
--     Atomic update to first_seen_at / last_seen_at / current_status when a
--     listing is (re-)observed live. Replaces the read-modify-write dance in
--     application code so two concurrent listingSeen events can't clobber
--     each other. Preserves terminal states (sold, removed) so a stale
--     listingSeen can't undo a sold inference.
-- ----------------------------------------------------------------------------
create or replace function geck_data.touch_listing_seen(
  p_id text,
  p_observed timestamptz
)
returns void
language sql
as $$
  update geck_data.market_listings set
    first_seen_at = least(coalesce(first_seen_at, p_observed), p_observed),
    last_seen_at  = greatest(coalesce(last_seen_at,  p_observed), p_observed),
    current_status = case
      when current_status in ('sold','removed') then current_status
      else 'live'
    end
  where id = p_id;
$$;

-- ----------------------------------------------------------------------------
-- 11. Convenience view: sold listings with days_to_sell
-- ----------------------------------------------------------------------------
create or replace view geck_data.sold_listings_v as
select
  l.id,
  l.seller_id,
  l.title,
  l.price,
  l.price_usd_equivalent,
  l.maturity,
  l.sex,
  l.cached_traits,
  l.norm_traits,
  l.first_seen_at,
  lse.observed_at as sold_at,
  lse.days_since_first_seen as days_to_sell,
  lse.source as sold_source
from geck_data.market_listings l
join geck_data.listing_status_events lse on lse.listing_id = l.id
where lse.status = 'sold';

-- END SOURCE MIGRATION: 0002_extension_streams.sql


-- BEGIN SOURCE MIGRATION: 0002a_ingest_metadata.sql
-- ============================================================================
-- Geck Data: 0002a: ingest metadata
--
-- Additive follow-up to 0002_extension_streams. Introduces the minimal schema
-- the salvaged artifacts from PR #1 need to be useful on current main:
--
--   1) market_listings.kind / .raw / .updated_at
--      Populated opportunistically by future ingest patches. The training
--      views in 0003_training_dataset flatten .raw into (image_url, traits[])
--      pairs, and /api/stats filters counts by .kind.
--
--   2) market_sellers.raw / .updated_at
--      Same idea on the sellers side.
--
--   3) ingest_events audit log.
--      Read by /api/stats (last event timestamp). Currently no writer on main
-- the table is there so the stats endpoint can read from it without
--      500'ing; rows will start appearing when /api/ingest is wired to append
--      here in a follow-up.
--
-- Numbered 0002a so it sorts AFTER 0002_extension_streams and BEFORE
-- 0003_admin_analytics / 0003_training_dataset, which depend on its columns.
--
-- Fully idempotent, safe to re-run. Paste into Supabase Dashboard → SQL
-- Editor → New query → Run, or apply via `supabase db push`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. market_listings: ingest metadata
-- ----------------------------------------------------------------------------
alter table geck_data.market_listings
  add column if not exists kind       text,
  add column if not exists raw        jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_market_listings_kind
  on geck_data.market_listings(kind);

create index if not exists idx_market_listings_updated_at
  on geck_data.market_listings(updated_at desc);

-- ----------------------------------------------------------------------------
-- 2. market_sellers: ingest metadata
-- ----------------------------------------------------------------------------
alter table geck_data.market_sellers
  add column if not exists raw        jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_market_sellers_updated_at
  on geck_data.market_sellers(updated_at desc);

-- ----------------------------------------------------------------------------
-- 3. ingest_events audit log
-- ----------------------------------------------------------------------------
create table if not exists geck_data.ingest_events (
  id         bigserial primary key,
  kind       text not null,
  source     text,
  received   integer not null default 0,
  written    integer not null default 0,
  skipped    integer not null default 0,
  errors     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingest_events_created_at
  on geck_data.ingest_events(created_at desc);

alter table geck_data.ingest_events enable row level security;
-- No public policies, the service role writes/reads; everyone else gets nothing.

-- END SOURCE MIGRATION: 0002a_ingest_metadata.sql


-- BEGIN SOURCE MIGRATION: 0003_admin_analytics.sql
-- ============================================================================
-- Geck Inspect: 0003: admin analytics
--
-- Adds the three tables that back the /admin/analytics dashboard:
--
--   1. profiles, extends auth.users with a role (user | admin).
--                        Used by RLS on every admin-only read below, and by
--                        the Next.js admin gate for /admin/* routes.
--   2. user_events, append-only product telemetry. Populated by
--                        src/lib/telemetry.ts (trackEvent / trackPageView)
--                        on the web app, and by any external source that
--                        POSTs into the Supabase REST API with the anon key.
--                        Every row carries a `source` tag so we can slice
--                        events coming in from the browser extension, the
--                        scraper, or future inspectors alongside geck-inspect.
--   3. error_logs, frontend + global handler error capture. Populated
--                        by reportError() + installGlobalErrorHandlers().
--
-- Plus a convenience view `v_daily_activity` for 90-day DAU/event-count
-- charts without scanning the full table, and an `is_admin()` helper that
-- every RLS policy below reuses so admin checks stay in one place.
--
-- Safe to re-run. Everything uses IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles, one row per auth user, with role
-- ----------------------------------------------------------------------------
create table if not exists geck_data.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on geck_data.profiles(role);

-- Auto-provision a profile row whenever a new auth user signs up.
create or replace function geck_data.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = geck_data
as $$
begin
  insert into geck_data.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Omitted during consolidation: Geck Inspect retains auth.users lifecycle ownership.

-- Backfill existing users who pre-date this migration.
insert into geck_data.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. is_admin(): shared predicate used by every admin RLS policy
-- ----------------------------------------------------------------------------
create or replace function geck_data.is_admin()
returns boolean
language sql
security definer
stable
set search_path = geck_data
as $$
  select exists (
    select 1 from geck_data.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. user_events, product telemetry
-- ----------------------------------------------------------------------------
create table if not exists geck_data.user_events (
  id           uuid primary key default gen_random_uuid(),
  event_name   text not null,
  user_email   text,
  page         text,
  session_id   text,
  source       text,                 -- 'geck-inspect' | 'extension' | future sources
  properties   jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_date timestamptz not null default now()
);

create index if not exists idx_user_events_created_date
  on geck_data.user_events(created_date desc);
create index if not exists idx_user_events_name_date
  on geck_data.user_events(event_name, created_date desc);
create index if not exists idx_user_events_email_date
  on geck_data.user_events(user_email, created_date desc);
create index if not exists idx_user_events_page_date
  on geck_data.user_events(page, created_date desc);
create index if not exists idx_user_events_source_date
  on geck_data.user_events(source, created_date desc);
create index if not exists idx_user_events_session
  on geck_data.user_events(session_id);

-- ----------------------------------------------------------------------------
-- 4. error_logs, frontend + global handler errors
-- ----------------------------------------------------------------------------
create table if not exists geck_data.error_logs (
  id            uuid primary key default gen_random_uuid(),
  level         text not null default 'error' check (level in ('error','warning','info')),
  message       text not null,
  stack         text,
  url           text,
  user_email    text,
  user_agent    text,
  source        text,               -- same tagging as user_events
  context       jsonb,
  resolved      boolean not null default false,
  resolved_by   uuid references auth.users(id) on delete set null,
  resolved_date timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_date  timestamptz not null default now()
);

create index if not exists idx_error_logs_created_date
  on geck_data.error_logs(created_date desc);
create index if not exists idx_error_logs_resolved_date
  on geck_data.error_logs(resolved, created_date desc);
create index if not exists idx_error_logs_email
  on geck_data.error_logs(user_email);
create index if not exists idx_error_logs_source_date
  on geck_data.error_logs(source, created_date desc);

-- ----------------------------------------------------------------------------
-- 5. RLS, anon can INSERT, admins can SELECT/UPDATE/DELETE
-- ----------------------------------------------------------------------------
alter table geck_data.profiles    enable row level security;
alter table geck_data.user_events enable row level security;
alter table geck_data.error_logs  enable row level security;

-- profiles: owner reads own row, admins read any.
drop policy if exists "owner read profile" on geck_data.profiles;
create policy "owner read profile" on geck_data.profiles
  for select using (auth.uid() = id);

drop policy if exists "admin read profiles" on geck_data.profiles;
create policy "admin read profiles" on geck_data.profiles
  for select using (geck_data.is_admin());

drop policy if exists "admin update profiles" on geck_data.profiles;
create policy "admin update profiles" on geck_data.profiles
  for update using (geck_data.is_admin());

-- user_events: anyone (anon + authenticated) can INSERT; admins read/modify.
drop policy if exists "anyone insert user_events" on geck_data.user_events;
create policy "anyone insert user_events" on geck_data.user_events
  for insert with check (true);

drop policy if exists "admin read user_events" on geck_data.user_events;
create policy "admin read user_events" on geck_data.user_events
  for select using (geck_data.is_admin());

drop policy if exists "admin update user_events" on geck_data.user_events;
create policy "admin update user_events" on geck_data.user_events
  for update using (geck_data.is_admin());

drop policy if exists "admin delete user_events" on geck_data.user_events;
create policy "admin delete user_events" on geck_data.user_events
  for delete using (geck_data.is_admin());

-- error_logs: same pattern.
drop policy if exists "anyone insert error_logs" on geck_data.error_logs;
create policy "anyone insert error_logs" on geck_data.error_logs
  for insert with check (true);

drop policy if exists "admin read error_logs" on geck_data.error_logs;
create policy "admin read error_logs" on geck_data.error_logs
  for select using (geck_data.is_admin());

drop policy if exists "admin update error_logs" on geck_data.error_logs;
create policy "admin update error_logs" on geck_data.error_logs
  for update using (geck_data.is_admin());

drop policy if exists "admin delete error_logs" on geck_data.error_logs;
create policy "admin delete error_logs" on geck_data.error_logs
  for delete using (geck_data.is_admin());

-- ----------------------------------------------------------------------------
-- 6. v_daily_activity: 90-day rollup for DAU + event_count charts
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_daily_activity as
select
  date_trunc('day', created_date) as day,
  count(distinct user_email) filter (where user_email is not null) as active_users,
  count(*)                                                          as event_count
from geck_data.user_events
where created_date >= now() - interval '90 days'
group by 1
order by 1 desc;

-- The view inherits RLS from user_events, so only admins can read it.

-- ----------------------------------------------------------------------------
-- 7. Making your first admin
--
--     Bootstrap: after running this migration, promote yourself by running
--     this in the SQL Editor (replace the email):
--
--       update geck_data.profiles set role = 'admin'
--       where email = 'you@example.com';
--
--     The is_admin() check will then unlock every /admin/* page.
-- ----------------------------------------------------------------------------

-- END SOURCE MIGRATION: 0003_admin_analytics.sql


-- BEGIN SOURCE MIGRATION: 0003_training_dataset.sql
-- ============================================================================
-- Geck Data, training dataset views for the morph-ID model
--
-- Produces flat (image_url, traits[]) pairs suitable for PyTorch / HF /
-- whatever you point at it. Two image sources are unioned:
--
--   A) `listing_images`: photos uploaded through /upload and stored in the
--      `listing-images` Supabase Storage bucket. URLs are geck_data.
--   B) `market_listings.raw`: extension-captured MorphMarket listings with
--      embedded image URLs pointing at MorphMarket's own CDN. Much larger
--      source; grows with every page browsed.
--
-- Trait extraction is deliberately forgiving. MorphMarket listings don't use
-- a single canonical shape, sometimes traits live at raw->'traits', other
-- times raw->'trait_list' or raw->'genetics'->'traits'. We COALESCE across
-- the likely locations and let the downstream trainer deduplicate.
--
-- Label noise is expected (seller-reported, often aspirational). Training
-- pipeline is responsible for cleaning; this view just surfaces the raw
-- joins so experiments can iterate quickly.
--
-- Idempotent: safe to re-run. Run AFTER 0002_extension_ingest.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. normalize_trait_name(text): lowercase, trim, collapse whitespace
--    Minimal normalization only; avoids taking a position on synonyms.
-- ----------------------------------------------------------------------------
create or replace function geck_data.normalize_trait_name(raw text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(lower(btrim(coalesce(raw, ''))), '\s+', ' ', 'g'),
    ''
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. extract_listing_traits(raw jsonb): returns text[] of trait names
--    Looks in the plausible locations, flattens, normalizes, dedupes.
-- ----------------------------------------------------------------------------
create or replace function geck_data.extract_listing_traits(raw jsonb)
returns text[]
language sql
immutable
as $$
  with candidates as (
    -- shape: raw->'traits' is an array of {name: "..."} objects
    select geck_data.normalize_trait_name(elem->>'name') as t
      from jsonb_array_elements(coalesce(raw->'traits', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'traits') = 'array'
    union all
    -- shape: raw->'trait_list' is an array of strings
    select geck_data.normalize_trait_name(elem #>> '{}') as t
      from jsonb_array_elements(coalesce(raw->'trait_list', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'trait_list') = 'array'
    union all
    -- shape: raw->'genetics'->'traits' is an array of {name: "..."} objects
    select geck_data.normalize_trait_name(elem->>'name') as t
      from jsonb_array_elements(coalesce(raw#>'{genetics,traits}', '[]'::jsonb)) as elem
      where jsonb_typeof(raw#>'{genetics,traits}') = 'array'
    union all
    -- shape: raw->'morphs' is an array of strings or {name: "..."}
    select geck_data.normalize_trait_name(coalesce(elem->>'name', elem #>> '{}')) as t
      from jsonb_array_elements(coalesce(raw->'morphs', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'morphs') = 'array'
  )
  select array_agg(distinct t order by t)
  from candidates
  where t is not null;
$$;

-- ----------------------------------------------------------------------------
-- 3. extract_listing_image_urls(raw jsonb): returns text[] of absolute URLs
--    Looks in raw->'images' / 'photos' / 'media', pulls out the URL field.
-- ----------------------------------------------------------------------------
create or replace function geck_data.extract_listing_image_urls(raw jsonb)
returns text[]
language sql
immutable
as $$
  with candidates as (
    select coalesce(elem->>'url', elem->>'src', elem->>'href', elem #>> '{}') as u
      from jsonb_array_elements(coalesce(raw->'images', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'images') = 'array'
    union all
    select coalesce(elem->>'url', elem->>'src', elem->>'href', elem #>> '{}') as u
      from jsonb_array_elements(coalesce(raw->'photos', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'photos') = 'array'
    union all
    select coalesce(elem->>'url', elem->>'src', elem->>'href', elem #>> '{}') as u
      from jsonb_array_elements(coalesce(raw->'media', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'media') = 'array'
  )
  select array_agg(distinct u)
  from candidates
  where u is not null and u like 'http%';
$$;

-- ----------------------------------------------------------------------------
-- 4. v_listing_labels, one row per listing, with traits[] and source info
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_listing_labels as
  select
    l.id                                       as listing_id,
    l.kind,
    geck_data.extract_listing_traits(l.raw)       as traits,
    l.raw->>'species'                          as species,
    l.raw->>'sex'                              as sex,
    (l.raw->>'price')::numeric                 as price,
    nullif(l.raw->>'seller_id', '')            as seller_id,
    l.updated_at
  from geck_data.market_listings l;

-- ----------------------------------------------------------------------------
-- 5. v_training_pairs, one row per (image_url, listing_id) pair
--    Union of uploaded images + extension-captured remote image URLs.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_training_pairs as
  -- Uploaded images stored in the listing-images bucket.
  select
    'uploaded'::text                             as image_source,
    (
      current_setting('app.supabase_public_url', true)
      || '/storage/v1/object/public/'
      || i.storage_bucket || '/' || i.storage_path
    )                                            as image_url,
    i.listing_id,
    lab.traits,
    lab.species,
    lab.sex,
    lab.price,
    lab.seller_id,
    i.uploaded_at                                as captured_at
  from geck_data.listing_images i
  left join geck_data.v_listing_labels lab on lab.listing_id = i.listing_id

  union all

  -- Extension-captured remote URLs embedded in the MorphMarket JSON.
  select
    'morphmarket_cdn'::text                      as image_source,
    url                                          as image_url,
    lab.listing_id,
    lab.traits,
    lab.species,
    lab.sex,
    lab.price,
    lab.seller_id,
    lab.updated_at                               as captured_at
  from geck_data.v_listing_labels lab
  cross join lateral unnest(
    coalesce(geck_data.extract_listing_image_urls(
      (select raw from geck_data.market_listings where id = lab.listing_id)
    ), '{}'::text[])
  ) as url;

-- ----------------------------------------------------------------------------
-- 6. v_trait_frequencies, sanity check: how common is each label?
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_trait_frequencies as
  select
    t                                 as trait,
    count(*)                          as listing_count
  from geck_data.v_listing_labels,
       lateral unnest(coalesce(traits, '{}'::text[])) as t
  group by t
  order by listing_count desc;

-- ----------------------------------------------------------------------------
-- 7. RLS, views inherit from the base tables. market_listings and
--    listing_images are already public-read (set in 0001), so no new
--    policies are needed. The view itself doesn't need RLS.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 8. Usage note
--    The uploaded-images branch of v_training_pairs needs the public
--    Supabase URL to build absolute image URLs. Set it once per session
--    (or bake it into a Postgres startup config) before querying:
--
--      set app.supabase_public_url = 'https://dhotmtgryuovkmsncdby.supabase.co';
--      select image_url, traits from v_training_pairs limit 5;
--
--    If the setting isn't set, the uploaded rows will have a NULL-prefixed
--    URL: harmless, just skip them in the trainer.
-- ----------------------------------------------------------------------------

-- END SOURCE MIGRATION: 0003_training_dataset.sql


-- BEGIN SOURCE MIGRATION: 0004_ingest_audit.sql
-- ============================================================================
-- Geck Inspect: 0004: ingest audit
--
-- Until now, the log of "what did the extension push and when?" was scattered
-- across the destination tables (price_drops, listing_status_events, etc).
-- That answers "is anything flowing?" but not "which POST carried which
-- events, and which failed?".
--
-- This migration adds a single append-only table that receives one row per
-- /api/ingest request, written by the route handler using the service role.
-- Admins can read it; only the service role writes it.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists geck_data.ingest_audit (
  id              uuid primary key default gen_random_uuid(),
  received_at     timestamptz not null default now(),
  source_tag      text,                    -- free-form "extension", "chrome-123", etc.
  content_type    text,
  event_count     integer not null default 0,
  ok_count        integer not null default 0,
  failed_count    integer not null default 0,
  duration_ms     integer,
  status_code     integer,
  error_summary   text,
  event_types     text[],                  -- distinct event types in the batch
  file_count      integer,                 -- multipart path: how many files
  client_ip_hash  text,                    -- sha256 of (ip + daily salt); never raw IP
  user_agent      text
);

create index if not exists idx_ingest_audit_received_at
  on geck_data.ingest_audit(received_at desc);
create index if not exists idx_ingest_audit_status_code
  on geck_data.ingest_audit(status_code, received_at desc);
create index if not exists idx_ingest_audit_event_types
  on geck_data.ingest_audit using gin (event_types);

alter table geck_data.ingest_audit enable row level security;

-- Admins read. No public insert, writes come from the server-side route
-- handler using the service-role key (which bypasses RLS), so the table
-- cannot be polluted by anon or authenticated callers.
drop policy if exists "admin read ingest_audit" on geck_data.ingest_audit;
create policy "admin read ingest_audit" on geck_data.ingest_audit
  for select using (geck_data.is_admin());

drop policy if exists "admin delete ingest_audit" on geck_data.ingest_audit;
create policy "admin delete ingest_audit" on geck_data.ingest_audit
  for delete using (geck_data.is_admin());

-- ----------------------------------------------------------------------------
-- v_ingest_daily: convenience view for the admin ingest timeline. Buckets
-- the last 30 days and surfaces success rate + most common event types.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_ingest_daily as
select
  date_trunc('day', received_at) as day,
  count(*)                              as requests,
  sum(event_count)                      as events,
  sum(ok_count)                         as ok,
  sum(failed_count)                     as failed,
  round(
    case when sum(event_count) = 0 then 100
         else 100.0 * sum(ok_count)::numeric / nullif(sum(event_count), 0)
    end,
    1
  )                                     as ok_pct,
  avg(duration_ms)::integer             as avg_duration_ms
from geck_data.ingest_audit
where received_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- END SOURCE MIGRATION: 0004_ingest_audit.sql


-- BEGIN SOURCE MIGRATION: 0005_market_analytics_views.sql
-- ============================================================================
-- Geck Inspect: 0005: market analytics views
--
-- Wires the /market dashboard to real Supabase data. Builds on the tables
-- created by 0001 (market_listings, market_sellers, listing_images),
-- 0002 (price_history, price_drops, listing_status_events, auction_results,
-- seller_snapshots, show_mentions, cross_platform_listings).
--
-- Everything here is read-only derived structure, no new base tables. The
-- application reads through these views with the anon key; RLS on the
-- underlying tables already permits public SELECT.
--
-- Safe to re-run; every create is IF NOT EXISTS / CREATE OR REPLACE and
-- every DROP uses IF EXISTS.
--
-- NOTE: all round(x, n) calls below cast to ::numeric first.
-- percentile_cont(...) and exp()/ln() return double precision, and Postgres
-- only implements round(numeric, int): not round(double precision, int).
-- If you see "function round(double precision, integer) does not exist",
-- you're on the pre-cast version of this file; re-run it (everything here
-- is CREATE OR REPLACE so it's safe to re-apply).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. combo_catalog, the canonical list of trait combinations the dashboard
-- recognizes. UI components keep an identical list in TypeScript; this is
-- the SQL mirror so views can do set-based joins instead of per-row ifs.
--
-- Each row carries the display name plus lowercased trait tokens. A listing
-- matches the combo iff every token appears in its cached_traits OR
-- norm_traits column (case-insensitive substring match).
-- ----------------------------------------------------------------------------
create table if not exists geck_data.combo_catalog (
  combo_name   text primary key,
  tokens       text[] not null,
  created_at   timestamptz not null default now()
);

-- Seed the 12 canonical combos used by the /market TypeScript fixtures.
insert into geck_data.combo_catalog (combo_name, tokens) values
  ('Lilly White × Axanthic',          array['lilly white','axanthic']),
  ('Lilly White × Cappuccino',        array['lilly white','cappuccino']),
  ('Cappuccino × Full Pinstripe',     array['cappuccino','full pinstripe']),
  ('Axanthic × Full Pinstripe',       array['axanthic','full pinstripe']),
  ('Sable × Extreme Harlequin',       array['sable','extreme harlequin']),
  ('Frappuccino × Pinstripe',         array['frappuccino','pinstripe']),
  ('Moonglow × Super Dalmatian',      array['moonglow','super dalmatian']),
  ('Lilly White × Soft Scale',        array['lilly white','soft scale']),
  ('Axanthic × Extreme Harlequin',    array['axanthic','extreme harlequin']),
  ('Cappuccino × Super Dalmatian',    array['cappuccino','super dalmatian']),
  ('Red Harlequin',                   array['red harlequin']),
  ('Tiger × Pinstripe',               array['tiger','pinstripe'])
on conflict (combo_name) do update set tokens = excluded.tokens;

alter table geck_data.combo_catalog enable row level security;
drop policy if exists "public read combo_catalog" on geck_data.combo_catalog;
create policy "public read combo_catalog" on geck_data.combo_catalog
  for select using (true);

-- ----------------------------------------------------------------------------
-- 2. combo_match(traits text): returns the first combo_catalog row whose
-- tokens all appear in `traits` (lowercased). Returns NULL if no match.
-- A listing can match at most one combo for the purposes of rollups so
-- high-specificity combos are checked first (longest tokens first).
-- ----------------------------------------------------------------------------
create or replace function geck_data.combo_match(p_traits text)
returns text
language sql
stable
parallel safe
set search_path = geck_data
as $$
  select combo_name
  from geck_data.combo_catalog
  where (
    select bool_and(
      position(token in lower(coalesce(p_traits, ''))) > 0
    )
    from unnest(tokens) as token
  )
  order by array_length(tokens, 1) desc, combo_name
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 3. region_of(seller_location text): coarse region classification used by
-- the Regional heatmap and Breeders table. Returns one of:
--   'US', 'CA', 'EU', 'UK', 'AU', 'JP', 'SE', 'SEA', or NULL.
--
-- Heuristics only, the dataset's seller_location is free-form text (city,
-- state, country). We match the country or country-code tail first, then
-- fall through to a few US/UK state abbreviations.
-- ----------------------------------------------------------------------------
create or replace function geck_data.region_of(p_loc text)
returns text
language sql
immutable
parallel safe
set search_path = geck_data
as $$
  select case
    when p_loc is null then null

    -- Direct country matches
    when p_loc ~* '\mUSA\M|\munited states\M|\mU\.S\.|\mUS\M' then 'US'
    when p_loc ~* '\mCA\M|\mcanada\M|\bca$|ontario|quebec|alberta|british columbia' then 'CA'
    when p_loc ~* '\muk\M|united kingdom|england|scotland|wales|northern ireland' then 'UK'
    when p_loc ~* '\mAU\M|\maustralia\M|new south wales|victoria|queensland|tasmania' then 'AU'
    when p_loc ~* '\mJP\M|\mjapan\M|tokyo|osaka|kyoto|hokkaido' then 'JP'
    when p_loc ~* '\mSE\M|sweden|stockholm|gothenburg' then 'SE'
    when p_loc ~* 'singapore|malaysia|thailand|indonesia|vietnam|philippines|kuala lumpur|bangkok|jakarta|manila' then 'SEA'

    -- European fall-through
    when p_loc ~* 'germany|france|netherlands|belgium|italy|spain|austria|switzerland|poland|czech|greece|portugal|ireland|finland|norway|denmark|eu' then 'EU'

    -- US state abbreviations in brackets (common MorphMarket format)
    when p_loc ~* ',\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\M' then 'US'

    else null
  end;
$$;

-- ----------------------------------------------------------------------------
-- 4. v_combo_rollups(window_days): for each combo, compute median sold,
-- median ask, % spread, avg days-to-sell, sold count, live count, and a
-- confidence score over the given window.
--
-- Implemented as a TABLE FUNCTION because materialized views can't take
-- parameters and we want the /market timeframe selector to change `window_days`.
-- ----------------------------------------------------------------------------
create or replace function geck_data.v_combo_rollups(window_days int)
returns table (
  combo_name       text,
  sold_count       integer,
  live_count       integer,
  median_sold      numeric,
  median_ask       numeric,
  spread_pct       numeric,
  avg_days_to_sell numeric,
  confidence_score integer
)
language sql
stable
parallel safe
set search_path = geck_data
as $$
with
-- Classify every in-range listing into its combo (or NULL).
classified as (
  select
    l.id,
    l.price_usd_equivalent,
    l.current_status,
    l.first_seen_at,
    l.last_seen_at,
    combo_match(coalesce(l.norm_traits, l.cached_traits)) as combo_name
  from geck_data.market_listings l
  where l.price_usd_equivalent is not null
    and l.price_usd_equivalent > 0
    and l.price_usd_equivalent < 100000
),
-- Latest sold event in window per listing.
sold_events as (
  select
    lse.listing_id,
    max(lse.observed_at) as sold_at,
    max(lse.days_since_first_seen) as days_to_sell
  from geck_data.listing_status_events lse
  where lse.status = 'sold'
    and lse.observed_at >= now() - make_interval(days => window_days)
  group by lse.listing_id
),
per_combo as (
  select
    c.combo_name,
    count(*) filter (where c.current_status = 'sold' and se.listing_id is not null) as sold_count,
    count(*) filter (where c.current_status = 'live') as live_count,
    percentile_cont(0.5) within group (order by c.price_usd_equivalent)
      filter (where c.current_status = 'sold' and se.listing_id is not null) as median_sold,
    percentile_cont(0.5) within group (order by c.price_usd_equivalent)
      filter (where c.current_status = 'live') as median_ask,
    avg(se.days_to_sell) filter (where se.days_to_sell is not null) as avg_days_to_sell
  from classified c
  left join sold_events se on se.listing_id = c.id
  where c.combo_name is not null
  group by c.combo_name
)
select
  pc.combo_name,
  coalesce(pc.sold_count, 0)::int  as sold_count,
  coalesce(pc.live_count, 0)::int  as live_count,
  pc.median_sold::numeric          as median_sold,
  pc.median_ask::numeric           as median_ask,
  case
    when pc.median_sold is null or pc.median_sold = 0 then null
    else round((((pc.median_ask - pc.median_sold) / pc.median_sold) * 100)::numeric, 1)
  end as spread_pct,
  round(pc.avg_days_to_sell::numeric, 1) as avg_days_to_sell,
  -- Confidence: start at 20, +2 per sold observation, +0.5 per live listing,
  -- capped at 99. Produces sensible gradient from thin to thick coverage.
  least(99,
    greatest(1,
      round((20 + coalesce(pc.sold_count, 0) * 2 + coalesce(pc.live_count, 0) * 0.5)::numeric)
    )
  )::int as confidence_score
from per_combo pc;
$$;

-- ----------------------------------------------------------------------------
-- 5. v_regional_pivot, combo × region median sold/ask over window. Uses
-- region_of() on the seller location to bucket listings. Unlike
-- v_combo_rollups we don't parameterize by window here; a materialized view
-- keyed on "last 365 days" is a reasonable default, with the app re-issuing
-- a function call for other windows.
-- ----------------------------------------------------------------------------
create or replace function geck_data.v_regional_heatmap(window_days int)
returns table (
  combo_name  text,
  region      text,
  n           integer,
  median_sold numeric,
  median_ask  numeric,
  confidence_score integer
)
language sql
stable
parallel safe
set search_path = geck_data
as $$
with
classified as (
  select
    l.id,
    l.seller_id,
    l.price_usd_equivalent,
    l.current_status,
    combo_match(coalesce(l.norm_traits, l.cached_traits)) as combo_name
  from geck_data.market_listings l
  where l.price_usd_equivalent is not null
    and l.price_usd_equivalent > 0
    and l.price_usd_equivalent < 100000
),
sold_in_window as (
  select distinct listing_id
  from geck_data.listing_status_events
  where status = 'sold'
    and observed_at >= now() - make_interval(days => window_days)
),
regionalised as (
  select
    c.combo_name,
    region_of(s.seller_location) as region,
    c.price_usd_equivalent,
    c.current_status,
    (siw.listing_id is not null) as sold_in_window
  from classified c
  left join geck_data.market_sellers s on s.seller_id = c.seller_id
  left join sold_in_window siw on siw.listing_id = c.id
  where c.combo_name is not null
    and region_of(s.seller_location) is not null
)
select
  combo_name,
  region,
  count(*)::int as n,
  (percentile_cont(0.5) within group (order by price_usd_equivalent)
    filter (where sold_in_window and current_status = 'sold'))::numeric as median_sold,
  (percentile_cont(0.5) within group (order by price_usd_equivalent)
    filter (where current_status = 'live'))::numeric as median_ask,
  least(99, greatest(1, round((20 + count(*) * 5)::numeric)))::int as confidence_score
from regionalised
group by combo_name, region;
$$;

-- ----------------------------------------------------------------------------
-- 6. v_market_index, weekly weighted basket of high-value combos. The
-- index value represents the geometric average of the top-8 combos' median
-- sold prices, normalized so the oldest week in the requested window = 1000.
-- ----------------------------------------------------------------------------
create or replace function geck_data.v_market_index(window_days int)
returns table (
  week_start timestamptz,
  value      numeric,
  combos_in  integer
)
language sql
stable
parallel safe
set search_path = geck_data
as $$
with
classified as (
  select
    lse.observed_at,
    l.price_usd_equivalent,
    combo_match(coalesce(l.norm_traits, l.cached_traits)) as combo_name,
    date_trunc('week', lse.observed_at) as week_start
  from geck_data.listing_status_events lse
  join geck_data.market_listings l on l.id = lse.listing_id
  where lse.status = 'sold'
    and lse.observed_at >= now() - make_interval(days => window_days)
    and l.price_usd_equivalent > 0
    and l.price_usd_equivalent < 100000
),
weekly_medians as (
  select
    week_start,
    combo_name,
    percentile_cont(0.5) within group (order by price_usd_equivalent) as median_px,
    count(*) as n
  from classified
  where combo_name is not null
  group by week_start, combo_name
),
-- Geometric average per week across all combos that had a sale that week.
per_week as (
  select
    week_start,
    exp(avg(ln(median_px))) as geo_avg,
    count(distinct combo_name)::int as combos_in
  from weekly_medians
  where median_px > 0
  group by week_start
),
-- Anchor: first available week's geo_avg maps to 1000.
anchored as (
  select
    p.week_start,
    p.combos_in,
    (p.geo_avg / first_value(p.geo_avg) over (order by p.week_start)) * 1000 as value
  from per_week p
)
select week_start, round(value::numeric, 1) as value, combos_in
from anchored
order by week_start;
$$;

-- ----------------------------------------------------------------------------
-- 7. v_combo_source_blend, for each combo, break down its observations
-- across price_history.source so the Combo detail panel can show "how the
-- headline is assembled" (GI sales / GI listings / breeder / …).
-- ----------------------------------------------------------------------------
create or replace function geck_data.v_combo_source_blend(p_combo text, window_days int)
returns table (
  source       text,
  n            integer,
  avg_price    numeric,
  pct          numeric
)
language sql
stable
parallel safe
set search_path = geck_data
as $$
with
classified as (
  select l.id
  from geck_data.market_listings l
  where combo_match(coalesce(l.norm_traits, l.cached_traits)) = p_combo
),
obs as (
  select
    coalesce(ph.source, 'gi_listings') as source,
    ph.price_usd_equivalent
  from geck_data.price_history ph
  join classified c on c.id = ph.listing_id
  where ph.observed_at >= now() - make_interval(days => window_days)
    and ph.price_usd_equivalent > 0
),
per_source as (
  select
    source,
    count(*)::int as n,
    avg(price_usd_equivalent) as avg_price
  from obs
  group by source
),
totals as (
  select sum(n)::numeric as total_n from per_source
)
select
  ps.source,
  ps.n,
  round(ps.avg_price::numeric, 2) as avg_price,
  case
    when t.total_n = 0 then 0::numeric
    else round(((ps.n::numeric / t.total_n) * 100)::numeric, 1)
  end as pct
from per_source ps
cross join totals t
order by ps.n desc;
$$;

-- ----------------------------------------------------------------------------
-- 8. Grants, anon reads everything the functions return through RLS on the
-- underlying tables; no explicit grants required.
-- ----------------------------------------------------------------------------
-- (intentionally empty, function security comes from table policies.)

-- END SOURCE MIGRATION: 0005_market_analytics_views.sql


-- BEGIN SOURCE MIGRATION: 0006_breeding_schema.sql
-- ============================================================================
-- Geck Inspect: 0006: breeding schema
--
-- Adds user-tracked breeding records that back the /market Supply tab. Each
-- table is owner-scoped (authenticated users can only see their own rows);
-- admins can SELECT everything for the aggregate projections the Supply tab
-- shows.
--
-- Design notes:
--   - breeding_pairs  ← the female+male pair a user is tracking
--   - clutches        ← one row per laid clutch under that pair
--   - hatchlings      ← one row per hatched juvenile (combined with a
--                       best-guess morph the user selects from combo_catalog)
--
-- The projection view v_supply_pipeline_monthly produces one row per
-- (month, combo) with the projected number of hatchlings we'd expect
-- across the user base, 9 months forward. It uses very conservative base
-- rates for pairs that haven't yet laid a clutch (default: 4 fertile
-- clutches/season, 2 eggs per clutch).
--
-- Safe to re-run.
-- ============================================================================

-- Relies on geck_data.is_admin() from 0003.
-- Relies on geck_data.combo_catalog from 0005 (breeding combos reference it).

-- ----------------------------------------------------------------------------
-- 1. breeding_pairs
-- ----------------------------------------------------------------------------
create table if not exists geck_data.breeding_pairs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  nickname     text,
  female_name  text,
  female_morph text,                              -- free text for now
  male_name    text,
  male_morph   text,
  combo_name   text references geck_data.combo_catalog(combo_name),
  active       boolean not null default true,
  paired_at    date default current_date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_breeding_pairs_owner
  on geck_data.breeding_pairs(owner_id);
create index if not exists idx_breeding_pairs_active
  on geck_data.breeding_pairs(active) where active;
create index if not exists idx_breeding_pairs_combo
  on geck_data.breeding_pairs(combo_name);

-- ----------------------------------------------------------------------------
-- 2. clutches
-- ----------------------------------------------------------------------------
create table if not exists geck_data.clutches (
  id                 uuid primary key default gen_random_uuid(),
  pair_id            uuid not null references geck_data.breeding_pairs(id) on delete cascade,
  laid_on            date not null,
  expected_hatch_on  date,                       -- nullable; computed if absent
  egg_count          integer not null default 2 check (egg_count between 0 and 6),
  fertile_count      integer check (fertile_count is null or fertile_count between 0 and egg_count),
  notes              text,
  created_at         timestamptz not null default now()
);

-- Default expected-hatch = laid_on + ~65 days if not supplied.
create or replace function geck_data.clutches_default_hatch()
returns trigger
language plpgsql
as $$
begin
  if new.expected_hatch_on is null then
    new.expected_hatch_on := new.laid_on + interval '65 days';
  end if;
  return new;
end;
$$;

drop trigger if exists clutches_default_hatch_tr on geck_data.clutches;
create trigger clutches_default_hatch_tr
  before insert on geck_data.clutches
  for each row execute function geck_data.clutches_default_hatch();

create index if not exists idx_clutches_pair on geck_data.clutches(pair_id);
create index if not exists idx_clutches_expected_hatch on geck_data.clutches(expected_hatch_on);

-- ----------------------------------------------------------------------------
-- 3. hatchlings
-- ----------------------------------------------------------------------------
create table if not exists geck_data.hatchlings (
  id            uuid primary key default gen_random_uuid(),
  clutch_id     uuid not null references geck_data.clutches(id) on delete cascade,
  hatched_on    date not null default current_date,
  morph_guess   text references geck_data.combo_catalog(combo_name),
  sex           text check (sex is null or sex in ('male','female','unknown')),
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_hatchlings_clutch on geck_data.hatchlings(clutch_id);
create index if not exists idx_hatchlings_hatched on geck_data.hatchlings(hatched_on desc);

-- ----------------------------------------------------------------------------
-- 4. RLS, owner read/write own; admin reads everything.
-- ----------------------------------------------------------------------------
alter table geck_data.breeding_pairs enable row level security;
alter table geck_data.clutches       enable row level security;
alter table geck_data.hatchlings     enable row level security;

-- breeding_pairs
drop policy if exists "owner crud breeding_pairs" on geck_data.breeding_pairs;
create policy "owner crud breeding_pairs" on geck_data.breeding_pairs
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "admin read breeding_pairs" on geck_data.breeding_pairs;
create policy "admin read breeding_pairs" on geck_data.breeding_pairs
  for select using (geck_data.is_admin());

-- clutches: owner via the pair
drop policy if exists "owner crud clutches" on geck_data.clutches;
create policy "owner crud clutches" on geck_data.clutches
  for all
  using (
    exists (
      select 1 from geck_data.breeding_pairs p
      where p.id = clutches.pair_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from geck_data.breeding_pairs p
      where p.id = clutches.pair_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "admin read clutches" on geck_data.clutches;
create policy "admin read clutches" on geck_data.clutches
  for select using (geck_data.is_admin());

-- hatchlings: owner via the clutch's pair
drop policy if exists "owner crud hatchlings" on geck_data.hatchlings;
create policy "owner crud hatchlings" on geck_data.hatchlings
  for all
  using (
    exists (
      select 1
      from geck_data.clutches c
      join geck_data.breeding_pairs p on p.id = c.pair_id
      where c.id = hatchlings.clutch_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from geck_data.clutches c
      join geck_data.breeding_pairs p on p.id = c.pair_id
      where c.id = hatchlings.clutch_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "admin read hatchlings" on geck_data.hatchlings;
create policy "admin read hatchlings" on geck_data.hatchlings
  for select using (geck_data.is_admin());

-- ----------------------------------------------------------------------------
-- 5. v_supply_pipeline_monthly, aggregate supply projection for the Supply
-- tab. Runs with security_invoker so RLS on breeding_pairs + clutches
-- applies to the caller: owners see their own pairs, admins see all pairs.
-- The view aggregates to (month, combo) so no owner identity leaks.
--
-- The projection combines:
--   a) Confirmed clutches: eggs expected to hatch in the month of
--      expected_hatch_on (fertile_count preferred, else 80% of egg_count)
--   b) Projected future clutches from active pairs: a seasonal clutch rate
--      (peaks in spring/summer) × 2 eggs/clutch × 80% fertility across the
--      next 9 months, attributed to the pair's combo_name
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_supply_pipeline_monthly
with (security_invoker = true)
as
with
-- Next 9 calendar months starting with the current month.
months as (
  select generate_series(
    date_trunc('month', now())::date,
    (date_trunc('month', now()) + interval '8 months')::date,
    interval '1 month'
  )::date as month_start
),
-- Confirmed clutches: eggs expected to hatch in a month.
confirmed as (
  select
    date_trunc('month', c.expected_hatch_on)::date as month_start,
    coalesce(p.combo_name, 'Unknown') as combo_name,
    -- Prefer fertile_count when given, else expect 80% of egg_count to hatch.
    sum(
      coalesce(c.fertile_count, (c.egg_count * 0.8)::int)
    ) as projected
  from geck_data.clutches c
  join geck_data.breeding_pairs p on p.id = c.pair_id
  where c.expected_hatch_on >= date_trunc('month', now())::date
    and c.expected_hatch_on < (date_trunc('month', now()) + interval '9 months')::date
  group by 1, 2
),
-- Projected future clutches from active pairs, with a seasonal shape
-- (Apr..Aug peak, Sep..Mar lower). 2 eggs/clutch × fertility factor.
active_pair_counts as (
  select
    coalesce(p.combo_name, 'Unknown') as combo_name,
    count(*) as pair_n
  from geck_data.breeding_pairs p
  where p.active
  group by p.combo_name
),
seasonal as (
  select
    m.month_start,
    extract(month from m.month_start)::int as mo,
    case extract(month from m.month_start)::int
      when 4 then 0.9 when 5 then 1.0 when 6 then 0.9
      when 7 then 0.7 when 8 then 0.45
      when 3 then 0.6 when 9 then 0.25
      else 0.1
    end as clutch_rate
  from months m
),
projected as (
  select
    s.month_start,
    a.combo_name,
    round(a.pair_n * s.clutch_rate * 2.0 * 0.8)::int as projected
  from seasonal s
  cross join active_pair_counts a
)
select
  month_start,
  combo_name,
  coalesce(sum(projected), 0)::int as projected_juveniles
from (
  select * from confirmed
  union all
  select * from projected
) u
group by month_start, combo_name
order by month_start, combo_name;

-- Views inherit RLS from base tables; hatchlings + breeding_pairs enforce
-- admin-only SELECT across other users' rows, so only admin users can read
-- the full projection. Owners still see their own share via the policies
-- above. The /market Supply tab reads the view via the admin path.

-- END SOURCE MIGRATION: 0006_breeding_schema.sql


-- BEGIN SOURCE MIGRATION: 0007_listing_image_urls.sql
-- Gallery events from the browser extension carry image URLs only; the
-- binaries are fetched server-side during /api/ingest processing. This lets
-- listing_images rows exist in a URL-only state (storage_path / file_name
-- nullable, image_url populated) while still enforcing de-duplication per
-- (listing_id, image_url).

alter table geck_data.listing_images
  add column if not exists image_url text;

alter table geck_data.listing_images
  alter column storage_path drop not null,
  alter column file_name drop not null;

-- Partial unique index so URL-only rows de-duplicate per listing without
-- interfering with legacy rows that only have storage_path.
create unique index if not exists idx_listing_images_listing_image_url
  on geck_data.listing_images (listing_id, image_url)
  where image_url is not null;

-- Fast lookup for a future hydrate endpoint that walks URL-only rows.
create index if not exists idx_listing_images_pending_hydrate
  on geck_data.listing_images (listing_id)
  where storage_path is null and image_url is not null;

-- END SOURCE MIGRATION: 0007_listing_image_urls.sql


-- BEGIN SOURCE MIGRATION: 0008_listing_images_unique_constraint.sql
-- 0007 created a partial unique index on (listing_id, image_url) to de-dupe
-- URL-only rows coming from gallery events. It worked for queries but
-- PostgREST's upsert with `on_conflict=listing_id,image_url` can't infer
-- partial indexes. ON CONFLICT requires either a matching unique CONSTRAINT
-- or a full (non-partial) unique index. The result was every listingImage
-- event failing at upsert with "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification", so no rows ever landed.
--
-- Swap to a real unique constraint. PostgreSQL treats NULLs as distinct by
-- default, so legacy rows where image_url is NULL still coexist freely.

drop index if exists geck_data.idx_listing_images_listing_image_url;

alter table geck_data.listing_images
  add constraint listing_images_listing_image_url_key
  unique (listing_id, image_url);

-- END SOURCE MIGRATION: 0008_listing_images_unique_constraint.sql


-- BEGIN SOURCE MIGRATION: 0009_lineage_auction_external_refs.sql
-- ============================================================================
-- Geck Data 0009: lineage, in-progress auction state, cross-platform images,
--                 external reference images, morph taxonomy.
--
-- Closes the gaps surfaced by the integration audit:
--   - lineage events (parents/dams/sires) were previously dropped on the floor
--     by legacyAdapter because there was no destination table.
--   - auction (mid-auction snapshot) events were also dropped; auction_results
--     only captures the close.
--   - cross_platform_listings had no companion image table; cross-platform
--     listings could never accumulate a gallery.
--   - No table existed to stage reference images from external open sources
--     (iNaturalist, Leopard Gecko Wiki, breeder partnerships).
--   - Morph taxonomy (canonical alleles, inheritance, synonyms) was implicit
--     in client code only; importer pipelines need a destination.
--
-- Safe to re-run; uses IF NOT EXISTS / ON CONFLICT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New columns on market_listings
-- ----------------------------------------------------------------------------
-- first_listed_at: when the seller actually published the listing (from the
-- MorphMarket `first_listed` field on the animal payload). Distinct from
-- first_seen_at, which is when our extension first observed it.
alter table geck_data.market_listings
  add column if not exists first_listed_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. listing_lineage
--    Parents recorded against a listing. role = 'dam' | 'sire' | 'parent'
--    (parent for entries where the breeder did not specify which side).
--    Parent rows do not need to have their own market_listings entry; we
--    capture the breeder-supplied label even if the parent is off-market.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.listing_lineage (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  role text not null check (role in ('dam', 'sire', 'parent')),
  parent_id text,
  parent_label text,
  parent_traits jsonb,
  parent_url text,
  observed_at timestamptz not null default now(),
  unique (listing_id, role, parent_id, parent_label)
);

create index if not exists idx_listing_lineage_listing_id
  on geck_data.listing_lineage(listing_id);
create index if not exists idx_listing_lineage_parent_id
  on geck_data.listing_lineage(parent_id) where parent_id is not null;

alter table geck_data.listing_lineage enable row level security;
drop policy if exists "public read listing_lineage" on geck_data.listing_lineage;
create policy "public read listing_lineage" on geck_data.listing_lineage
  for select using (true);

-- ----------------------------------------------------------------------------
-- 3. auction_state
--    Snapshots of an auction while it is still running. auction_results
--    captures the final close; this captures price/bid_count progress.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.auction_state (
  id bigserial primary key,
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  current_price numeric,
  current_price_usd numeric,
  currency text,
  bid_count integer,
  ends_at timestamptz,
  observed_at timestamptz not null default now(),
  source text default 'extension'
);

create index if not exists idx_auction_state_listing_observed
  on geck_data.auction_state(listing_id, observed_at desc);

alter table geck_data.auction_state enable row level security;
drop policy if exists "public read auction_state" on geck_data.auction_state;
create policy "public read auction_state" on geck_data.auction_state
  for select using (true);

-- ----------------------------------------------------------------------------
-- 4. cross_platform_listing_images
--    Mirrors listing_images but FKs into cross_platform_listings, which has
--    a different primary key (uuid, not the morphmarket text id).
-- ----------------------------------------------------------------------------
create table if not exists geck_data.cross_platform_listing_images (
  id uuid primary key default gen_random_uuid(),
  cross_platform_listing_id uuid not null
    references geck_data.cross_platform_listings(id) on delete cascade,
  storage_bucket text not null default 'listing-images',
  storage_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  image_url text not null,
  caption text,
  uploaded_at timestamptz not null default now(),
  unique (cross_platform_listing_id, image_url)
);

create index if not exists idx_xpl_images_listing
  on geck_data.cross_platform_listing_images(cross_platform_listing_id);

alter table geck_data.cross_platform_listing_images enable row level security;
drop policy if exists "public read cross_platform_listing_images"
  on geck_data.cross_platform_listing_images;
create policy "public read cross_platform_listing_images"
  on geck_data.cross_platform_listing_images
  for select using (true);

-- ----------------------------------------------------------------------------
-- 5. external_reference_images
--    Above-board open-source reference data. iNaturalist (CC-licensed wild
--    type), Leopard Gecko Wiki (CC-BY-SA), breeder partnerships, etc.
--    source_kind/source_id together identify the upstream record so re-imports
--    are idempotent.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.external_reference_images (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in (
    'inaturalist', 'leopard_gecko_wiki', 'reptidex', 'breeder_partner', 'other'
  )),
  source_id text not null,
  source_url text,
  species text,
  morph_label text,
  norm_morph_label text,
  license text,
  attribution text,
  storage_bucket text default 'listing-images',
  storage_path text,
  image_url text,
  width integer,
  height integer,
  captured_at timestamptz,
  imported_at timestamptz not null default now(),
  raw jsonb,
  unique (source_kind, source_id)
);

create index if not exists idx_ext_ref_morph
  on geck_data.external_reference_images(norm_morph_label);
create index if not exists idx_ext_ref_species
  on geck_data.external_reference_images(species);

alter table geck_data.external_reference_images enable row level security;
drop policy if exists "public read external_reference_images"
  on geck_data.external_reference_images;
create policy "public read external_reference_images"
  on geck_data.external_reference_images
  for select using (true);

-- ----------------------------------------------------------------------------
-- 6. morph_taxonomy
--    Canonical morph/allele records imported from ReptiDex / Leopard Gecko
--    Wiki / breeder dictionaries. Used by geck-inspect's morph guide and
--    by the recognition pipeline to normalize free-text trait strings.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.morph_taxonomy (
  id uuid primary key default gen_random_uuid(),
  species text not null,
  canonical_name text not null,
  norm_name text not null,
  inheritance text,
  allele_group text,
  parent_morphs text[],
  synonyms text[],
  description text,
  source_kind text not null,
  source_id text,
  source_url text,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (species, norm_name, source_kind)
);

create index if not exists idx_morph_taxonomy_species_norm
  on geck_data.morph_taxonomy(species, norm_name);

alter table geck_data.morph_taxonomy enable row level security;
drop policy if exists "public read morph_taxonomy" on geck_data.morph_taxonomy;
create policy "public read morph_taxonomy" on geck_data.morph_taxonomy
  for select using (true);

-- END SOURCE MIGRATION: 0009_lineage_auction_external_refs.sql


-- BEGIN SOURCE MIGRATION: 0010_species_routing.sql
-- ============================================================================
-- Geck Data 0010: species routing.
--
-- Geck Inspect is crested-gecko-FIRST. The Eye in the Sky extension scrapes
-- whatever MorphMarket page the user happens to view (cresteds, leopards,
-- gargoyles, leachies, snakes, etc.), so without filtering, non-crested
-- listings pollute the analytics surfaces the app shows.
--
-- This migration adds a species column on every ingest-facing table and a
-- private archive Storage bucket. The legacy adapter detects the species
-- from the MorphMarket URL path at ingest time and tags the row; non-crested
-- image bytes route to the archive bucket so the public `listing-images`
-- bucket stays crested-only.
--
-- We do NOT delete or move non-crested rows. They live in the same tables
-- with species='leopard'/'gargoyle'/etc. so a future leopard product (or
-- ad-hoc analysis) has the data on hand; the read-side just filters
-- WHERE species = 'crested'.
--
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. species columns on the main ingest tables
-- ----------------------------------------------------------------------------
alter table geck_data.market_listings
  add column if not exists species text default 'unknown';
create index if not exists idx_market_listings_species
  on geck_data.market_listings(species);

alter table geck_data.cross_platform_listings
  add column if not exists species text default 'unknown';
create index if not exists idx_cross_platform_listings_species
  on geck_data.cross_platform_listings(species);

alter table geck_data.listing_images
  add column if not exists species text default 'unknown';
create index if not exists idx_listing_images_species
  on geck_data.listing_images(species);

-- external_reference_images already has a `species` column from migration 0009.
-- morph_taxonomy already has a `species` column from migration 0009.

-- ----------------------------------------------------------------------------
-- 2. archive-listing-images Storage bucket
--    Private (service role only) because nothing user-facing reads it today.
--    Same internal path convention as listing-images: {listing_id}/{hash}.{ext}.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('archive-listing-images', 'archive-listing-images', false)
on conflict (id) do nothing;

-- (No public-read policy on archive-listing-images; service role only.)

-- END SOURCE MIGRATION: 0010_species_routing.sql


-- BEGIN SOURCE MIGRATION: 0011_canonical_listings.sql
-- ============================================================================
-- 0011: Track the scrape pipeline schema + mark canonical-source rows
--
-- Background: the geck-data scrape pipeline writes to three tables that were
-- created outside this repo's migrations folder (originally via SQL Editor
-- when the pipeline shipped in PR #48):
--
--   - geck_data.listings           (scraper output, PK listing_id)
--   - geck_data.listings_history   (one row per observation, FK to scrape_runs)
--   - geck_data.scrape_runs        (one row per pipeline run)
--
-- This migration brings them into the tracked migrations folder with
-- CREATE TABLE IF NOT EXISTS so a future fresh-install rebuilds correctly,
-- and adds two things needed for the canonical dual-write that lets the
-- public web app see scraper-sourced rows via market_listings:
--
--   1. An index on market_listings.source so the dashboard can filter by
--      provenance ('scraper' vs 'extension_legacy' vs 'manual').
--   2. A non-unique index on market_listings.morphmarket_key so cross-table
--      lookups by numeric MorphMarket id (used by the backfill dedupe step)
--      are not full scans.
--
-- Safe to re-run; IF NOT EXISTS / IF NOT EXISTS everywhere.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. scrape_runs
--    One row per Decodo scrape, CSV migration, or canonical backfill. Used by
--    /data-admin/runs and as the FK target for listings_history.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.scrape_runs (
  id bigserial primary key,
  scrape_type text not null,
  status text not null default 'running',
  triggered_by text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_attempted int not null default 0,
  records_succeeded int not null default 0,
  records_failed int not null default 0,
  error_message text
);

create index if not exists idx_scrape_runs_started_at
  on geck_data.scrape_runs(started_at desc);

create index if not exists idx_scrape_runs_scrape_type_status
  on geck_data.scrape_runs(scrape_type, status);

-- ----------------------------------------------------------------------------
-- 2. listings
--    Source of truth for scraper output. Read by /data-admin/* and by the
--    canonical dual-write mirror that populates market_listings.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.listings (
  listing_id text primary key,
  name text,
  price numeric,
  currency text,
  seller_name text,
  sex text,
  weight text,
  weight_grams numeric,
  maturity text,
  scientific_name text,
  birth_date text,
  origin text,
  pet_only text,
  lineage text,
  traits text,
  trait_array text[],
  trait_count int,
  category text,
  description text,
  primary_image_url text,
  all_image_urls text[],
  image_count int,
  listing_url text not null default '',
  availability text,
  shipping_label text,
  shipping_rate numeric,
  shipping_currency text,
  payment_method text,
  sku text,
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  sold_at timestamptz,
  species text default 'crested-gecko'
);

create index if not exists idx_listings_last_seen_at
  on geck_data.listings(last_seen_at desc);

create index if not exists idx_listings_is_active
  on geck_data.listings(is_active) where is_active = true;

create index if not exists idx_listings_seller_name
  on geck_data.listings(seller_name);

-- ----------------------------------------------------------------------------
-- 3. listings_history
--    Append-only observation log. Every scrape run inserts one row per
--    listing it sees with raw_snapshot capturing the source-of-truth payload.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.listings_history (
  id bigserial primary key,
  listing_id text not null references geck_data.listings(listing_id) on delete cascade,
  scrape_run_id bigint references geck_data.scrape_runs(id) on delete set null,
  observed_at timestamptz not null default now(),
  price numeric,
  is_active boolean,
  raw_snapshot jsonb
);

create index if not exists idx_listings_history_listing_observed
  on geck_data.listings_history(listing_id, observed_at desc);

create index if not exists idx_listings_history_scrape_run
  on geck_data.listings_history(scrape_run_id);

-- ----------------------------------------------------------------------------
-- 4. market_listings source-provenance index
--    The canonical dual-write tags rows with source='scraper'. The Eye in
--    the Sky bulk Python upload used source='manual' or NULL; the extension
--    real-time stream uses source='extension'. Filtering by source is now
--    common enough in /data-admin and future client tools that it warrants
--    a partial index.
-- ----------------------------------------------------------------------------
create index if not exists idx_market_listings_source
  on geck_data.market_listings(source);

create index if not exists idx_market_listings_morphmarket_key
  on geck_data.market_listings(morphmarket_key);

-- ----------------------------------------------------------------------------
-- 5. RLS on the scraper tables
--    /data-admin reads with the anon key (no auth on those pages today),
--    so we grant public SELECT to keep the dashboard working. Writes only
--    happen through the service-role-keyed Python scripts and the
--    GitHub Action, both of which bypass RLS.
-- ----------------------------------------------------------------------------
alter table geck_data.listings         enable row level security;
alter table geck_data.listings_history enable row level security;
alter table geck_data.scrape_runs      enable row level security;

drop policy if exists "public read listings"         on geck_data.listings;
create policy "public read listings"         on geck_data.listings         for select using (true);

drop policy if exists "public read listings_history" on geck_data.listings_history;
create policy "public read listings_history" on geck_data.listings_history for select using (true);

drop policy if exists "public read scrape_runs"      on geck_data.scrape_runs;
create policy "public read scrape_runs"      on geck_data.scrape_runs      for select using (true);

-- END SOURCE MIGRATION: 0011_canonical_listings.sql


-- BEGIN SOURCE MIGRATION: 0012_canonical_cleanup.sql
-- ============================================================================
-- 0012: Clean up legacy bare-numeric market_listings rows + ghost sellers
--
-- After 0011 enabled RLS and the canonical dual-write established the
-- mm_-prefixed id convention, 21 bare-numeric market_listings rows from
-- the 2026-04 bulk Python upload remained as dead-letter placeholders.
-- 16 of them anchored listing_images uploaded through the geck-data UI,
-- 3 anchored legacy price_history rows, and 18 of the 21 collided with
-- mm_-prefixed siblings created by the canonical backfill, leaving 3
-- hand-uploaded images on listing 3615035 unreachable from the public
-- listing page because they were attached to the bare id.
--
-- This migration:
--
--   1. Inserts mm_-prefixed siblings for the 3 bare rows that lacked one
--      (preserving whatever data they had, typically just `price`).
--   2. Re-points listing_images.listing_id from bare to mm_-prefixed (68 rows).
--   3. Re-points price_history.listing_id likewise (3 rows).
--   4. Deletes all 21 bare market_listings rows.
--   5. Deletes the 4 ghost market_sellers rows whose seller_id is a
--      MorphMarket page-section placeholder ('random_stores', '_own',
--      'search_index', 'featured_stores') rather than a real seller.
--
-- Pre-condition: a sane bare row count (<=100) to guard against running
-- this in an unexpected state. Post-condition: 0 bare rows and 0 ghost
-- sellers remain. Idempotent, a second run finds 0 bare rows and is
-- a no-op.
-- ============================================================================

do $$
declare
  bare_count int;
  ghost_count int;
begin
  select count(*) into bare_count
    from geck_data.market_listings where id not like 'mm_%';
  if bare_count = 0 then
    raise notice '0012: no bare-numeric market_listings rows found: already cleaned.';
    return;
  end if;
  if bare_count > 100 then
    raise exception
      '0012: refusing to run with % bare rows (expected <= 100). Investigate first.',
      bare_count;
  end if;
  select count(*) into ghost_count from geck_data.market_sellers
    where seller_name is null
      and seller_id in ('random_stores','_own','search_index','featured_stores');
  raise notice '0012 pre-check: % bare market_listings rows, % ghost sellers.',
    bare_count, ghost_count;
end$$;

-- 1. Create mm_-prefixed siblings for any bare rows that lack one.
--    Preserves whatever data the bare row had (typically just `price`).
insert into geck_data.market_listings (id, price, source, imported_at)
select
  'mm_' || id,
  price,
  coalesce(source, 'manual_legacy'),
  now()
from geck_data.market_listings
where id not like 'mm_%'
  and not exists (
    select 1 from geck_data.market_listings p
    where p.id = 'mm_' || geck_data.market_listings.id
  )
on conflict (id) do nothing;

-- 2. Re-point listing_images from bare ids to mm_-prefixed.
update geck_data.listing_images
set listing_id = 'mm_' || listing_id
where listing_id in (
  select id from geck_data.market_listings where id not like 'mm_%'
);

-- 3. Re-point price_history likewise.
update geck_data.price_history
set listing_id = 'mm_' || listing_id
where listing_id in (
  select id from geck_data.market_listings where id not like 'mm_%'
);

-- 4. Delete the bare rows now that nothing references them.
delete from geck_data.market_listings where id not like 'mm_%';

-- 5. Delete the ghost market_sellers rows.
delete from geck_data.market_sellers
where seller_id in ('random_stores','_own','search_index','featured_stores')
  and seller_name is null;

do $$
declare
  bare_count int;
  ghost_count int;
begin
  select count(*) into bare_count
    from geck_data.market_listings where id not like 'mm_%';
  if bare_count <> 0 then
    raise exception
      '0012 post-check: % bare-numeric market_listings rows remain after cleanup.',
      bare_count;
  end if;
  select count(*) into ghost_count from geck_data.market_sellers
    where seller_id in ('random_stores','_own','search_index','featured_stores');
  if ghost_count <> 0 then
    raise exception
      '0012 post-check: % ghost market_sellers rows remain after cleanup.',
      ghost_count;
  end if;
end$$;

-- END SOURCE MIGRATION: 0012_canonical_cleanup.sql


-- BEGIN SOURCE MIGRATION: 0013_canonical_status_bootstrap.sql
-- ============================================================================
-- 0013: Bootstrap current_status + listing_status_events from scraper data
--
-- The /market dashboard views from migration 0005 (v_combo_rollups,
-- v_regional_heatmap, v_market_index) read market_listings.current_status
-- ('sold' / 'live') and listing_status_events to compute rollups. The Eye
-- in the Sky extension populates these columns as it observes listings;
-- the Decodo scraper writes is_active / is_sold (via the canonical
-- dual-write in lib/canonical.py).
--
-- This migration translates the scraper's signal into the schema the views
-- expect:
--
--   1. current_status = 'sold' when is_sold = true, else 'live' (only when
--      currently NULL, leaves extension-set values untouched).
--   2. Synthesizes one listing_status_events row per sold listing that
--      doesn't already have one, using last_seen_at as the observation time
--      and days_since_first_seen as the listing's lifespan.
--
-- Going forward the canonical helper in scripts/lib/canonical.py sets
-- current_status on every upsert, so this only needs to run once for the
-- existing backfill. Re-running is idempotent (UPDATE only NULLs, INSERT
-- skips already-recorded events).
-- ============================================================================

-- 1. Set current_status from is_sold
update geck_data.market_listings
set current_status = case when is_sold then 'sold' else 'live' end
where current_status is null;

-- 2. Synthesize sold events
insert into geck_data.listing_status_events
  (id, listing_id, status, observed_at, source, days_since_first_seen)
select
  gen_random_uuid(),
  ml.id,
  'sold',
  coalesce(ml.last_seen_at, ml.imported_at, now()),
  coalesce(ml.source, 'scraper'),
  greatest(0,
    (extract(epoch from coalesce(ml.last_seen_at, now())
      - coalesce(ml.first_seen_at, ml.imported_at, now())) / 86400)::int
  )
from geck_data.market_listings ml
where ml.current_status = 'sold'
  and not exists (
    select 1 from geck_data.listing_status_events lse
    where lse.listing_id = ml.id and lse.status = 'sold'
  );

-- END SOURCE MIGRATION: 0013_canonical_status_bootstrap.sql


-- BEGIN SOURCE MIGRATION: 0014_morph_training_dataset.sql
-- ============================================================================
-- 0014: Morph ID training dataset views + crested morph taxonomy
--
-- Produces a flat (image_url, listing_id, traits[], ...) training set ready
-- for a PyTorch multi-label classifier. Two key differences from 0003's
-- v_training_pairs (which was built for the extension's market_listings.raw
-- jsonb shape that we no longer write to):
--
--   1. Reads from geck_data.listings (the scraper's canonical output) which
--      has 5,800+ rows with cleaned trait_array + primary_image_url.
--   2. Filters out the seller-questionnaire noise ("Diet: Cricket",
--      "Proven breeder: No", etc.) so labels are actual morph traits.
--
-- Outputs:
--   - geck_data.crested_morph_taxonomy : canonical trait list for crested geckos
--   - geck_data.is_training_trait(text) -> boolean : filter for the noise
--   - geck_data.v_morph_training : (image_url, listing_id, traits, sex,
--                                maturity, price, source, split) per image
--   - geck_data.v_morph_training_stats : per-trait coverage counts for the UI
--
-- Split assignment is deterministic via md5(listing_id)::bit(8) modulo:
--   0–69  → train  (70%)
--   70–84 → val    (15%)
--   85–99 → test   (15%)
-- This means a listing's images all land in the same split, preventing
-- train/val contamination by listing identity.
--
-- Idempotent; safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. crested_morph_taxonomy
-- ----------------------------------------------------------------------------
create table if not exists geck_data.crested_morph_taxonomy (
  canonical_name text primary key,
  norm_name text not null,
  category text not null check (category in (
    'pattern','color','dorsal','eye','scale','other','base'
  )),
  synonyms text[] not null default '{}',
  is_morph boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_crested_morph_taxonomy_norm
  on geck_data.crested_morph_taxonomy(norm_name);

-- Seed the canonical crested gecko trait set. Names match MorphMarket's
-- own labels so trait-array lookups join cleanly without normalization.
insert into geck_data.crested_morph_taxonomy (canonical_name, norm_name, category, synonyms) values
  -- Pattern / structural
  ('Harlequin',          'harlequin',          'pattern', array['harley']),
  ('Extreme Harlequin',  'extreme harlequin',  'pattern', array['extreme harley','ex harley']),
  ('Tri-color',          'tri-color',          'pattern', array['tricolor','tri color']),
  ('Pinstripe',          'pinstripe',          'pattern', array['pin','pinner']),
  ('Full Pinstripe',     'full pinstripe',     'pattern', array['full pin']),
  ('Partial Pinstripe',  'partial pinstripe',  'pattern', array['partial pin']),
  ('Quad-stripe',        'quad-stripe',        'pattern', array['quadstripe','quad stripe']),
  ('Reverse Pinstripe',  'reverse pinstripe',  'pattern', array['rev pin','reverse pin']),
  ('Dalmatian',          'dalmatian',          'pattern', array['dal']),
  ('Super Dalmatian',    'super dalmatian',    'pattern', array['super dal']),
  ('Phantom',            'phantom',            'pattern', array[]::text[]),
  ('Empty Back',         'empty back',         'pattern', array[]::text[]),
  ('Drippy',             'drippy',             'pattern', array[]::text[]),
  ('Portholes',          'portholes',          'pattern', array['porthole']),
  ('Tiger',              'tiger',              'pattern', array[]::text[]),
  ('Brindle',            'brindle',            'pattern', array[]::text[]),

  -- Color / pigmentation
  ('Lilly White',        'lilly white',        'color',   array['lilly','lily white','lily']),
  ('Cappuccino',         'cappuccino',         'color',   array['cap','capp']),
  ('Frappuccino',        'frappuccino',        'color',   array['frap','frapp']),
  ('Moonglow',           'moonglow',           'color',   array[]::text[]),
  ('Sable',              'sable',              'color',   array[]::text[]),
  ('Axanthic',           'axanthic',           'color',   array['axan']),
  ('Soft Scale',         'soft scale',         'scale',   array['softscale','softie']),
  ('Red',                'red',                'color',   array[]::text[]),
  ('Red Base',           'red base',           'color',   array[]::text[]),
  ('Red Harlequin',      'red harlequin',      'color',   array['red harley']),
  ('Yellow',             'yellow',             'color',   array[]::text[]),
  ('Yellow Base',        'yellow base',        'color',   array[]::text[]),
  ('Orange',             'orange',             'color',   array[]::text[]),
  ('Cream',              'cream',              'color',   array[]::text[]),
  ('Tangerine',          'tangerine',          'color',   array[]::text[]),
  ('Dark',               'dark',               'color',   array[]::text[]),
  ('Dark Base',          'dark base',          'color',   array[]::text[]),
  ('Olive',              'olive',              'color',   array[]::text[]),
  ('Lavender',           'lavender',           'color',   array[]::text[]),
  ('Buckskin',           'buckskin',           'color',   array[]::text[]),
  ('Patternless',        'patternless',        'pattern', array[]::text[]),
  ('White Wall',         'white wall',         'pattern', array['whitewall']),

  -- Eye / scale modifiers
  ('Whitewall',          'whitewall',          'pattern', array[]::text[]),
  ('Lily White',         'lily white',         'color',   array[]::text[]),
  ('Hypo',               'hypo',               'other',   array['hypomelanistic']),
  ('Het Axanthic',       'het axanthic',       'other',   array['het ax'])
on conflict (canonical_name) do update set
  norm_name = excluded.norm_name,
  category  = excluded.category,
  synonyms  = excluded.synonyms;

alter table geck_data.crested_morph_taxonomy enable row level security;
drop policy if exists "public read crested_morph_taxonomy"
  on geck_data.crested_morph_taxonomy;
create policy "public read crested_morph_taxonomy"
  on geck_data.crested_morph_taxonomy for select using (true);

-- ----------------------------------------------------------------------------
-- 2. is_training_trait, filter out the seller-questionnaire noise
--
-- The scraper picks up free-text labels including things like "Diet: Meal
-- Replacement, Cricket" and "Proven breeder: No" which are not morphs.
-- A trait is training-eligible iff:
--   - it does not start with "Diet:"
--   - it does not start with "Proven breeder"
--   - it appears in crested_morph_taxonomy.canonical_name OR matches a
--     synonym (case-insensitive)
-- ----------------------------------------------------------------------------
create or replace function geck_data.is_training_trait(p_trait text)
returns boolean
language sql
stable
parallel safe
set search_path = geck_data
as $$
  with input as (
    select lower(trim(p_trait)) as norm
  ),
  match as (
    select exists (
      select 1 from geck_data.crested_morph_taxonomy m, input i
      where m.norm_name = i.norm
         or i.norm = any(array(select lower(s) from unnest(m.synonyms) s))
    ) as is_match
  )
  select case
    when p_trait is null then false
    when p_trait ilike 'Diet:%'             then false
    when p_trait ilike 'Proven breeder%'    then false
    else (select is_match from match)
  end;
$$;

-- ----------------------------------------------------------------------------
-- 3. v_morph_training, flat (image_url, listing_id, traits[], ...) per image
--
-- Sources:
--   A. geck_data.listings.primary_image_url      (one row per listing)
--   B. geck_data.listings.all_image_urls         (unnested; usually same as A)
--   C. geck_data.listing_images (uploaded photos linked to market_listings.id)
--
-- The split column is deterministic from md5(listing_id) so re-running the
-- view yields the same partition. Listings that resolve to a recognised
-- canonical morph from is_training_trait() carry a non-empty traits[].
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_morph_training as
with
listing_traits as (
  -- Drop the metadata noise from trait_array; keep only training-eligible.
  select
    l.listing_id,
    l.primary_image_url,
    l.all_image_urls,
    l.sex,
    l.maturity,
    l.price,
    l.currency,
    (
      select coalesce(array_agg(t order by t), '{}'::text[])
      from unnest(coalesce(l.trait_array, '{}'::text[])) as t
      where geck_data.is_training_trait(t)
    ) as traits,
    case (('x' || substr(md5(l.listing_id), 1, 2))::bit(8)::int) % 100
      when 0  then 'train' when 1  then 'train' when 2  then 'train'
      when 3  then 'train' when 4  then 'train' when 5  then 'train'
      when 6  then 'train' when 7  then 'train' when 8  then 'train'
      when 9  then 'train'
      else case
        when (('x' || substr(md5(l.listing_id), 1, 2))::bit(8)::int) % 100 < 70 then 'train'
        when (('x' || substr(md5(l.listing_id), 1, 2))::bit(8)::int) % 100 < 85 then 'val'
        else 'test'
      end
    end as split
  from geck_data.listings l
  where l.primary_image_url is not null
    and l.is_active is not false
)
-- primary image (one row per listing)
select
  primary_image_url           as image_url,
  listing_id,
  traits,
  sex, maturity, price, currency,
  'scraper_primary'::text     as source,
  split
from listing_traits
where primary_image_url is not null

union all
-- additional images from the array
select
  url                         as image_url,
  lt.listing_id,
  lt.traits,
  lt.sex, lt.maturity, lt.price, lt.currency,
  'scraper_array'::text       as source,
  lt.split
from listing_traits lt,
     lateral unnest(coalesce(lt.all_image_urls, '{}'::text[])) as url
where url is not null and url <> lt.primary_image_url

union all
-- uploaded images via /upload (linked through listing_images.listing_id =
-- market_listings.id). We surface them with the matching scraper listing
-- when possible, else with a NULL trait array.
select
  -- Build the public storage URL.
  (
    'https://dhotmtgryuovkmsncdby.supabase.co/storage/v1/object/public/'
    || li.storage_bucket || '/' || li.storage_path
  )                           as image_url,
  -- Strip the 'mm_' prefix on listing_id to align with geck_data.listings.listing_id.
  case
    when li.listing_id like 'mm_%' then substring(li.listing_id from 4)
    else li.listing_id
  end                         as listing_id,
  (
    select coalesce(array_agg(t order by t), '{}'::text[])
    from unnest(coalesce(l.trait_array, '{}'::text[])) as t
    where geck_data.is_training_trait(t)
  )                           as traits,
  l.sex, l.maturity, l.price, l.currency,
  'uploaded'::text            as source,
  case (('x' || substr(md5(li.listing_id), 1, 2))::bit(8)::int) % 100
    when 0  then 'train' when 1  then 'train' when 2  then 'train'
    when 3  then 'train' when 4  then 'train' when 5  then 'train'
    when 6  then 'train' when 7  then 'train' when 8  then 'train'
    when 9  then 'train'
    else case
      when (('x' || substr(md5(li.listing_id), 1, 2))::bit(8)::int) % 100 < 70 then 'train'
      when (('x' || substr(md5(li.listing_id), 1, 2))::bit(8)::int) % 100 < 85 then 'val'
      else 'test'
    end
  end as split
from geck_data.listing_images li
left join geck_data.listings l on l.listing_id = (
  case when li.listing_id like 'mm_%' then substring(li.listing_id from 4)
       else li.listing_id end
);

-- ----------------------------------------------------------------------------
-- 4. v_morph_training_stats, per-trait coverage + per-split count
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_morph_training_stats as
with images_by_split as (
  select split, count(*) as n
  from geck_data.v_morph_training
  where traits is not null and array_length(traits, 1) > 0
  group by split
),
per_trait as (
  select t as trait,
         count(*) as image_count,
         count(distinct listing_id) as listing_count
  from geck_data.v_morph_training,
       lateral unnest(coalesce(traits, '{}'::text[])) as t
  where array_length(traits, 1) > 0
  group by t
)
select
  'split'::text   as kind,
  split           as key,
  n               as image_count,
  null::int       as listing_count
from images_by_split

union all

select
  'trait'::text   as kind,
  trait           as key,
  image_count,
  listing_count
from per_trait;

-- END SOURCE MIGRATION: 0014_morph_training_dataset.sql


-- BEGIN SOURCE MIGRATION: 0015_taxonomy_align_geck_inspect.sql
-- 0015: Align crested_morph_taxonomy to geck-inspect's snake_case canonical
-- ids so wild scraper images can be seeded into geck-inspect.gecko_images
-- without any further label translation.
--
-- geck-inspect's edge function (recognize-gecko-morph) consumes ids defined
-- in supabase/functions/recognize-gecko-morph/taxonomy.ts. Those ids are
-- the contract our seeder must produce, primary_morph, genetic_traits,
-- secondary_traits, base_color, etc.
--
-- This migration adds two columns:
--   canonical_id  text, the geck-inspect snake_case id
--   trait_kind    text, primary_morph / genetic_trait / secondary_trait / base_color
-- plus a helper function geck_data.canonical_trait(text) for the seeder.
--
-- Idempotent: adds columns IF NOT EXISTS and overwrites a known mapping
-- so a synonyms update only requires re-running this file.

alter table geck_data.crested_morph_taxonomy
  add column if not exists canonical_id text,
  add column if not exists trait_kind   text;

update geck_data.crested_morph_taxonomy set canonical_id =
  case canonical_name
    when 'Patternless'         then 'patternless'
    when 'Harlequin'           then 'harlequin'
    when 'Extreme Harlequin'   then 'extreme_harlequin'
    when 'Pinstripe'           then 'pinstripe'
    when 'Full Pinstripe'      then 'full_pinstripe'
    when 'Partial Pinstripe'   then 'partial_pinstripe'
    when 'Reverse Pinstripe'   then 'reverse_pinstripe'
    when 'Quad-stripe'         then 'quad_stripe'
    when 'Tiger'               then 'tiger'
    when 'Brindle'             then 'brindle'
    when 'Dalmatian'           then 'dalmatian'
    when 'Super Dalmatian'     then 'super_dalmatian'
    when 'Tri-color'           then 'tricolor'
    when 'Lilly White'         then 'lily_white'
    when 'Lily White'          then 'lily_white'
    when 'Axanthic'            then 'axanthic_vca'
    when 'Het Axanthic'        then 'axanthic_vca'
    when 'Cappuccino'          then 'cappuccino'
    when 'Frappuccino'         then 'frappuccino'
    when 'Moonglow'            then 'moonglow'
    when 'Soft Scale'          then 'soft_scale'
    when 'Empty Back'          then 'empty_back'
    when 'White Wall'          then 'white_wall'
    when 'Whitewall'           then 'white_wall'
    when 'Hypo'                then 'hypo'
    when 'Drippy'              then 'drippy_dorsal'
    when 'Phantom'             then 'phantom'
    when 'Portholes'           then 'portholes'
    when 'Red'                 then 'red'
    when 'Red Base'            then 'red'
    when 'Red Harlequin'       then 'red'
    when 'Dark'                then 'dark_brown'
    when 'Dark Base'           then 'dark_brown'
    when 'Yellow'              then 'yellow'
    when 'Yellow Base'         then 'yellow'
    when 'Orange'              then 'orange'
    when 'Cream'               then 'cream'
    when 'Tangerine'           then 'orange'
    when 'Olive'               then 'olive'
    when 'Lavender'            then 'lavender'
    when 'Buckskin'            then 'buckskin'
    when 'Sable'               then 'dark_brown'
    else null
  end;

update geck_data.crested_morph_taxonomy set trait_kind =
  case
    when canonical_id in (
      'patternless','flame','chevron_flame','harlequin','extreme_harlequin',
      'super_harlequin','pinstripe','full_pinstripe','partial_pinstripe',
      'phantom_pinstripe','reverse_pinstripe','quad_stripe','super_stripe',
      'tiger','super_tiger','brindle','extreme_brindle','dalmatian',
      'super_dalmatian','red_dalmatian','ink_spot','bicolor','tricolor'
    ) then 'primary_morph'
    when canonical_id in (
      'lily_white','axanthic_vca','axanthic_tsm','cappuccino','frappuccino',
      'moonglow','soft_scale','whiteout','empty_back','white_wall',
      'hypo','melanistic'
    ) then 'genetic_trait'
    when canonical_id in (
      'red','dark_red','crimson','orange','burnt_orange','yellow',
      'bright_yellow','buttery','cream','pink','coral','olive','dark_olive',
      'green','tan','buckskin','brown','dark_brown','chocolate','mahogany',
      'lavender','charcoal','near_black'
    ) then 'base_color'
    when canonical_id is not null then 'secondary_trait'
    else null
  end;

create index if not exists idx_crested_morph_taxonomy_canonical_id
  on geck_data.crested_morph_taxonomy(canonical_id) where canonical_id is not null;
create index if not exists idx_crested_morph_taxonomy_trait_kind
  on geck_data.crested_morph_taxonomy(trait_kind) where trait_kind is not null;

create or replace function geck_data.canonical_trait(p_trait text)
returns table (canonical_id text, trait_kind text)
language sql stable parallel safe set search_path = geck_data as $$
  with norm as (
    select lower(trim(p_trait)) as n
  )
  select m.canonical_id, m.trait_kind
  from geck_data.crested_morph_taxonomy m, norm
  where m.canonical_id is not null
    and (
      m.norm_name = norm.n
      or norm.n = any (array(select lower(s) from unnest(m.synonyms) s))
    )
  limit 1;
$$;

-- END SOURCE MIGRATION: 0015_taxonomy_align_geck_inspect.sql


-- BEGIN SOURCE MIGRATION: 0016_morph_training_canonical_view.sql
-- 0016: v_morph_training_canonical: emit geck-inspect-canonical ids.
--
-- Where v_morph_training emits scraper-native trait names, this view
-- maps them through crested_morph_taxonomy to geck-inspect's snake_case
-- canonical ids and splits them into the field categories the
-- gecko_images table expects:
--
--   primary_morph    (single id)
--   genetic_traits   (text[] of GENETIC_TRAIT_IDS)
--   secondary_traits (text[] of SECONDARY_TRAIT_IDS)
--   base_color       (single BASE_COLOR_ID)
--
-- Rows where no primary_morph can be resolved are filtered out, those
-- aren't useful for seeding gecko_images since primary_morph is the
-- main label.

create or replace view geck_data.v_morph_training_canonical as
with rows as (
  select v.image_url, v.listing_id, v.traits, v.sex, v.maturity,
         v.price, v.currency, v.source, v.split
  from geck_data.v_morph_training v
  where array_length(coalesce(v.traits, '{}'::text[]), 1) > 0
),
mapped as (
  select r.*,
    (
      select array_agg(distinct c.canonical_id)
      from unnest(r.traits) t
      join geck_data.crested_morph_taxonomy c on c.canonical_name = t
      where c.canonical_id is not null and c.trait_kind = 'primary_morph'
    ) as primary_morph_ids,
    (
      select array_agg(distinct c.canonical_id)
      from unnest(r.traits) t
      join geck_data.crested_morph_taxonomy c on c.canonical_name = t
      where c.canonical_id is not null and c.trait_kind = 'genetic_trait'
    ) as genetic_trait_ids,
    (
      select array_agg(distinct c.canonical_id)
      from unnest(r.traits) t
      join geck_data.crested_morph_taxonomy c on c.canonical_name = t
      where c.canonical_id is not null and c.trait_kind = 'secondary_trait'
    ) as secondary_trait_ids,
    (
      select c.canonical_id
      from unnest(r.traits) t
      join geck_data.crested_morph_taxonomy c on c.canonical_name = t
      where c.canonical_id is not null and c.trait_kind = 'base_color'
      limit 1
    ) as base_color_id
  from rows r
)
select
  image_url,
  listing_id,
  (primary_morph_ids)[1] as primary_morph,
  coalesce(genetic_trait_ids,   '{}'::text[]) as genetic_traits,
  coalesce(secondary_trait_ids, '{}'::text[]) as secondary_traits,
  base_color_id as base_color,
  sex, maturity, price, currency, source, split,
  traits as original_traits
from mapped
where (primary_morph_ids)[1] is not null;

-- END SOURCE MIGRATION: 0016_morph_training_canonical_view.sql


-- BEGIN SOURCE MIGRATION: 0017_morph_eval_runs.sql
-- 0017: Persistence for Morph ID eval runs.
--
-- Each row records one execution of scripts/eval_morph_id.py against the
-- geck-inspect recognize-gecko-morph edge function. The /data-admin/training/
-- evals dashboard reads from here to chart accuracy over time as the prompt
-- is tuned, the verified training set grows, or the underlying model
-- upgrades.

create table if not exists geck_data.morph_eval_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed')),

  -- What we evaluated against
  model text,
  taxonomy_version text,
  split text not null default 'test',
  eval_set_size int not null default 0,

  -- Headline metrics
  primary_morph_top1_accuracy numeric,
  primary_morph_top3_accuracy numeric,
  genetic_jaccard_avg numeric,
  base_color_accuracy numeric,

  -- Drilldown payloads
  per_trait_metrics jsonb default '{}'::jsonb,  -- {trait_id: {precision, recall, f1, support}}
  top_confusions   jsonb default '[]'::jsonb,   -- [{label, predicted, count}]

  -- Provenance
  prompt_fingerprint text,
  notes text,
  triggered_by text default 'manual',
  error_message text
);

create index if not exists idx_morph_eval_runs_started_at
  on geck_data.morph_eval_runs(started_at desc);
create index if not exists idx_morph_eval_runs_status
  on geck_data.morph_eval_runs(status);
create index if not exists idx_morph_eval_runs_model
  on geck_data.morph_eval_runs(model);

alter table geck_data.morph_eval_runs enable row level security;
drop policy if exists "public read morph_eval_runs" on geck_data.morph_eval_runs;
create policy "public read morph_eval_runs" on geck_data.morph_eval_runs
  for select using (true);

-- END SOURCE MIGRATION: 0017_morph_eval_runs.sql


-- BEGIN SOURCE MIGRATION: 0017_sellers.sql
-- Per-seller metadata captured from MorphMarket's per-store page.
-- Populated weekly by scripts/scrape_sellers.py.

CREATE TABLE IF NOT EXISTS geck_data.sellers (
    seller_slug      text PRIMARY KEY,    -- URL slug, e.g. "rosethornexotics"
    store_name       text,                -- display name from <title>
    owner_name       text,                -- parsed from meta description
    location_raw     text,                -- "Atlanta, GA, USA": raw, unsplit
    member_since     text,                -- "Basic Member since 2025"
    listings_count   int,                 -- self-reported active listings
    avatar_url       text,
    first_seen_at    timestamptz NOT NULL DEFAULT NOW(),
    last_updated_at  timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE geck_data.sellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read sellers" ON geck_data.sellers;
CREATE POLICY "public read sellers"
    ON geck_data.sellers FOR SELECT
    TO public
    USING (true);

-- Per-listing pointer to the seller's slug, populated by scrape_details.py
-- when it parses each listing's detail page.
ALTER TABLE geck_data.listings
    ADD COLUMN IF NOT EXISTS seller_slug text;

CREATE INDEX IF NOT EXISTS idx_listings_seller_slug
    ON geck_data.listings (seller_slug)
    WHERE seller_slug IS NOT NULL;

-- Returns slugs that need a (re)scrape: never seen, or last-scraped > 7d ago.
-- Mirrors listings_needing_detail_scrape's "fresh-or-stale" shape.
CREATE OR REPLACE VIEW geck_data.sellers_needing_scrape AS
SELECT DISTINCT l.seller_slug
FROM geck_data.listings l
LEFT JOIN geck_data.sellers s ON s.seller_slug = l.seller_slug
WHERE l.seller_slug IS NOT NULL
  AND l.is_active = TRUE
  AND (s.seller_slug IS NULL OR s.last_updated_at < NOW() - INTERVAL '7 days');

-- END SOURCE MIGRATION: 0017_sellers.sql


-- BEGIN SOURCE MIGRATION: 0018_strip_non_trait_segments.sql
-- 0018_strip_non_trait_segments.sql
--
-- Backfill: clean `Diet: ...|`, `Proven breeder: ...|` (and friends) out of
-- market_listings.cached_traits + norm_traits.
--
-- Why this is needed
-- ------------------
-- The Chrome extension concatenates the MorphMarket additionalProperty
-- list into cached_traits and norm_traits using " | " as the separator,
-- including non-trait properties. ~2818 of ~6717 rows (~42%) have a
-- leaked `Diet: ...` or `Proven breeder: ...` prefix segment that
-- downstream tokenizers ( /trends, RidgePlot, Sunburst, BoxPlot,
-- ForceGraph, TraitFrequencyAndPrice ) interpret as a morph.
--
-- Cleanup strategy
-- ----------------
-- 1. Split cached_traits on " | ".
-- 2. Drop any segment whose head is a known non-trait property name,
--    either `<key>: <value>` or the bare `<key>` (the extension
--    sometimes emits the bare name).
-- 3. Re-join the surviving segments with " | ".
-- 4. Rebuild norm_traits from the cleaned cached_traits by lowercasing
--    and replacing "|" with a space (the same flattening the writer
--    pipeline does). This is the lossless path, trying to clean
--    norm_traits in place via comma-split drops real trait tokens that
--    happen to be trapped in the same comma-segment as a polluted key.
-- 5. Idempotent: rows whose cached_traits no longer contain any matching
--    prefix are left untouched.
--
-- This migration runs as one transaction. The companion write-side guard
-- lives in src/lib/ingest/events.ts (sanitizeCachedTraits +
-- sanitizeNormTraits) so new ingest events do not re-pollute these
-- columns.
--
-- Apply manually in the Supabase SQL Editor after merge.

with polluted as (
  select id, cached_traits as old_cached
  from geck_data.market_listings
  where cached_traits ~* '^\s*(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$|\|)'
     or cached_traits ~* '\|\s*(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$|\|)'
     or norm_traits   ~* '(^|\s)(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*:'
),
cleaned as (
  select p.id,
         (
           select string_agg(seg, ' | ')
           from (
             select trim(both ' ' from x) as seg
             from regexp_split_to_table(coalesce(l.cached_traits, ''), '\s*\|\s*') as x
             where x !~* '^\s*(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$|\|)'
               and trim(both ' ' from x) <> ''
           ) sub
         ) as new_cached
  from polluted p
  join geck_data.market_listings l on l.id = p.id
)
update geck_data.market_listings ml
set cached_traits = c.new_cached,
    norm_traits   = lower(replace(coalesce(c.new_cached, ''), '|', ' '))
from cleaned c
where ml.id = c.id;

-- Sanity probe: after the update, no row should still match the
-- pollution pattern.
do $$
declare remaining int;
begin
  select count(*) into remaining
  from geck_data.market_listings
  where cached_traits ~* '(^|\|\s*)(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$|\|)'
     or norm_traits   ~* '(^|\s)(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*:';
  if remaining > 0 then
    raise exception 'cleanup left % polluted rows; aborting', remaining;
  end if;
end$$;

-- END SOURCE MIGRATION: 0018_strip_non_trait_segments.sql


-- BEGIN SOURCE MIGRATION: 0019_v_combo_profitability.sql
-- ============================================================================
-- 0019_v_combo_profitability.sql
--
-- Combo profitability ranking: surface the most likely-revenue combos based
-- on a blend of price and sell-through. Powers the /trends profitability
-- tiers section.
--
-- Score formula (per the design call):
--
--   effective_price   = median_sold (when ≥1 sold event) else median_ask * 0.8
--   sell_through_rate = sold_count / (sold_count + live_count)
--   score             = effective_price * sell_through_rate
--
-- Sell-through replaces the avg_days_to_sell signal because the existing
-- listing_status_events bootstrap stamped pre-existing sold rows with
-- days_since_first_seen = 0, which made days_to_sell unreliable. Once the
-- catalog has been running long enough that days_to_sell reflects real
-- first_seen → sold spans, a follow-up can swap that in (or blend it).
--
-- Universe is anchor combos (combo_catalog) UNION auto-discovered trait
-- pairs that pass a minimum-sample threshold. Anchors keep their curated
-- display names. Pairs are formed across the top-frequency trait tokens
-- only, so we don't fan out into thousands of low-N pairs.
--
-- The function returns RAW SCORE; tier bucketing happens in TypeScript so
-- the UI can change tier cutoffs without a migration.
-- ============================================================================

create or replace function geck_data.v_combo_profitability(
  p_window_days        int default 90,
  p_min_top_trait_n    int default 25,
  p_min_pair_listings  int default 20
)
returns table (
  combo_name        text,
  combo_source      text,    -- 'anchor' | 'discovered'
  sold_count        int,
  live_count        int,
  median_sold       numeric,
  median_ask        numeric,
  sell_through_rate numeric,
  effective_price   numeric,
  score             numeric,
  confidence        int
)
language sql
stable
parallel safe
set search_path = geck_data
as $body$
with
-- Tokenize each listing's traits using the same rules as the JS
-- parseTraitList (drop tokens with ':' or shorter than 3 chars).
listing_tokens as (
  select
    l.id,
    l.price_usd_equivalent,
    l.current_status,
    lower(trim(both ' ' from tok)) as token
  from geck_data.market_listings l,
       lateral regexp_split_to_table(
         coalesce(l.cached_traits, replace(coalesce(l.norm_traits, ''), ',', '|')),
         '\s*[|,]\s*'
       ) as tok
  where l.price_usd_equivalent is not null
    and l.price_usd_equivalent between 50 and 10000
    and tok is not null
    and lower(trim(both ' ' from tok)) <> ''
    and length(trim(both ' ' from tok)) >= 3
    and position(':' in tok) = 0
),
-- Sold-status events within the window. v_combo_rollups uses the same
-- shape; we replicate locally so this function doesn't depend on it.
sold_events as (
  select distinct lse.listing_id
  from geck_data.listing_status_events lse
  where lse.status = 'sold'
    and lse.observed_at >= now() - make_interval(days => p_window_days)
),
-- Listings that were first seen within the window, gates the "live"
-- side to the same period so the ratio is window-consistent.
in_window_listings as (
  select id from geck_data.market_listings
  where first_seen_at >= now() - make_interval(days => p_window_days)
),
-- ---- Anchor combos ----
anchor_classified as (
  select
    c.combo_name,
    'anchor'::text as combo_source,
    l.id,
    l.price_usd_equivalent,
    case when se.listing_id is not null then 'sold' else l.current_status end as effective_status
  from geck_data.combo_catalog c
  cross join lateral (
    select id, price_usd_equivalent, current_status, cached_traits, norm_traits
    from geck_data.market_listings
    where price_usd_equivalent is not null
      and price_usd_equivalent between 50 and 10000
      and (
        select bool_and(
          position(token in lower(coalesce(cached_traits, '') || ' ' || coalesce(norm_traits, ''))) > 0
        )
        from unnest(c.tokens) as token
      )
  ) l
  left join sold_events se on se.listing_id = l.id
  where l.id in (select id from in_window_listings)
     or se.listing_id is not null
),
anchor_rollup as (
  select
    combo_name,
    combo_source,
    count(*) filter (where effective_status = 'sold')::int as sold_count,
    count(*) filter (where effective_status = 'live')::int as live_count,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'sold') as median_sold,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'live') as median_ask
  from anchor_classified
  group by combo_name, combo_source
),
-- ---- Auto-discovered pair combos ----
top_traits as (
  select token, count(*) as n
  from listing_tokens
  group by token
  having count(*) >= p_min_top_trait_n
),
listing_pairs as (
  select
    t1.id,
    t1.price_usd_equivalent,
    case when se.listing_id is not null then 'sold' else t1.current_status end as effective_status,
    initcap(t1.token) || ' × ' || initcap(t2.token) as combo_name
  from listing_tokens t1
  join listing_tokens t2 on t1.id = t2.id and t1.token < t2.token
  join top_traits ta on ta.token = t1.token
  join top_traits tb on tb.token = t2.token
  left join sold_events se on se.listing_id = t1.id
  where t1.id in (select id from in_window_listings)
     or se.listing_id is not null
),
pair_rollup as (
  select
    combo_name,
    'discovered'::text as combo_source,
    count(*) filter (where effective_status = 'sold')::int as sold_count,
    count(*) filter (where effective_status = 'live')::int as live_count,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'sold') as median_sold,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'live') as median_ask
  from listing_pairs
  group by combo_name
  having count(*) >= p_min_pair_listings
),
-- ---- Union, drop duplicates (anchor display names win over auto-discovered
-- pair names that happen to surface the same two tokens) ----
combined as (
  select * from anchor_rollup
  union all
  select * from pair_rollup
  where combo_name not in (select combo_name from anchor_rollup)
)
select
  c.combo_name,
  c.combo_source,
  c.sold_count,
  c.live_count,
  round(c.median_sold::numeric, 0)              as median_sold,
  round(c.median_ask::numeric, 0)               as median_ask,
  round(
    (case when (c.sold_count + c.live_count) = 0 then 0
          else c.sold_count::numeric / (c.sold_count + c.live_count)
     end)::numeric,
    4
  ) as sell_through_rate,
  -- effective price: sold median when we have it, otherwise 80% of ask
  -- (typical haircut from sticker to clearing price).
  round(
    (coalesce(c.median_sold, c.median_ask * 0.8))::numeric,
    0
  ) as effective_price,
  round(
    (coalesce(c.median_sold, c.median_ask * 0.8)
     * (case when (c.sold_count + c.live_count) = 0 then 0
             else c.sold_count::numeric / (c.sold_count + c.live_count)
        end)
    )::numeric,
    2
  ) as score,
  -- Confidence: linear in sample size, capped at 99. Same shape as
  -- v_combo_rollups so the UI can use a shared scale.
  least(99,
    greatest(1,
      round((10 + c.sold_count * 4 + c.live_count * 0.4)::numeric)
    )
  )::int as confidence
from combined c
where (c.sold_count + c.live_count) > 0;
$body$;

grant execute on function geck_data.v_combo_profitability(int, int, int) to anon, authenticated;

-- END SOURCE MIGRATION: 0019_v_combo_profitability.sql


-- BEGIN SOURCE MIGRATION: 0020_promote_first_listed_to_timestamptz.sql
-- 0020_promote_first_listed_to_timestamptz.sql
--
-- Promote the historical text-typed `first_listed` column (YYYY-MM-DD)
-- into the typed `first_listed_at` timestamptz column. This unlocks
-- chronological trend queries by *MorphMarket listing date*: the date
-- the listing actually appeared on the marketplace, rather than the
-- date our scraper first observed it.
--
-- Why this matters: the catalog scraper bootstrapped over a 3-day
-- window in May 2026, so `first_seen_at` reflects scrape calendar, not
-- market calendar. The `first_listed` text column was populated for
-- ~1,105 rows (16% of the catalog) by an earlier import path and
-- carries real listing dates back to 2023-02-25. Using these dates
-- gives the /trends page a true 3-year longitudinal view for those
-- rows; the rest fall back to first_seen_at via coalesce in queries.
--
-- Idempotent: only fills first_listed_at where it is currently NULL.

update geck_data.market_listings
set first_listed_at = (first_listed || ' 00:00:00+00')::timestamptz
where first_listed_at is null
  and first_listed ~ '^\d{4}-\d{2}-\d{2}$';

-- END SOURCE MIGRATION: 0020_promote_first_listed_to_timestamptz.sql


-- BEGIN SOURCE MIGRATION: 0021_trait_tiers.sql
-- ============================================================================
-- 0021_trait_tiers.sql
--
-- Classifies crested gecko trait tokens into three tiers so the
-- profitability ranking can distinguish value-driving traits from
-- incidental descriptors.
--
--   Tier 1  Genetic morphs, predictable inheritance, breeder demand drivers
--           (Axanthic, Lilly White, Cappuccino, Frappuccino, Moonglow,
--           Sable, Soft Scale, Phantom, het-* versions).
--
--   Tier 2  Premium structural patterns, desirable look traits that aren't
--           simple-recessive genetic morphs but command a premium
--           (Extreme Harlequin, Full Pinstripe, Super Dalmatian, Crowned,
--           Drippy, Quad-Stripe, …).
--
--   Tier 3  Cosmetic descriptors, colours, markings, base coats, generic
--           pattern descriptors that ride along on listings whose value
--           comes from a Tier 1/2 trait (Snowflake, Tri-Color, Red,
--           Harlequin, Dalmatian, Partial Pinstripe, …).
--
-- The point is that pairs like "Snowflake × Tri-Color" should NOT surface
-- as a top profitability combo: buyers don't search for that pairing.
-- Instead "Axanthic × Snowflake" matters because Axanthic is the
-- value driver and Snowflake is a complementary marking.
--
-- Editable at any time: this is a data table, not hard-coded logic.
-- `update geck_data.trait_tiers set tier = 2 where trait_token = 'crowned';`
-- takes effect on the next v_combo_profitability call.
-- ============================================================================

create table if not exists geck_data.trait_tiers (
  trait_token  text primary key,        -- lowercased, matches listing tokens
  tier         int  not null check (tier between 1 and 3),
  display_name text not null,
  notes        text
);

comment on table geck_data.trait_tiers is
  'Classification of trait tokens for combo profitability ranking. Tier 1 = genetic value-driver, Tier 2 = premium pattern, Tier 3 = cosmetic descriptor.';

-- ---- Tier 1: genetic morphs ------------------------------------------------
insert into geck_data.trait_tiers (trait_token, tier, display_name) values
  ('lilly white',           1, 'Lilly White'),
  ('cappuccino',            1, 'Cappuccino'),
  ('axanthic',              1, 'Axanthic'),
  ('frappuccino',           1, 'Frappuccino'),
  ('moonglow',              1, 'Moonglow'),
  ('sable',                 1, 'Sable'),
  ('soft scale',            1, 'Soft Scale'),
  ('super soft scale',      1, 'Super Soft Scale'),
  ('phantom',               1, 'Phantom'),
  ('het axanthic',          1, 'Het Axanthic'),
  ('50% het axanthic',      1, '50% Het Axanthic'),
  ('66% het axanthic',      1, '66% Het Axanthic'),
  ('pos het axanthic',      1, 'Pos Het Axanthic'),
  ('het phantom',           1, 'Het Phantom'),
  ('50% het phantom',       1, '50% Het Phantom')
on conflict (trait_token) do update
  set tier = excluded.tier,
      display_name = excluded.display_name;

-- ---- Tier 2: premium structural patterns -----------------------------------
insert into geck_data.trait_tiers (trait_token, tier, display_name) values
  ('extreme harlequin',     2, 'Extreme Harlequin'),
  ('full pinstripe',        2, 'Full Pinstripe'),
  ('pinstripe',             2, 'Pinstripe'),
  ('super dalmatian',       2, 'Super Dalmatian'),
  ('crowned',               2, 'Crowned'),
  ('drippy',                2, 'Drippy'),
  ('quad-stripe',           2, 'Quad-Stripe'),
  ('reverse pinstripe',     2, 'Reverse Pinstripe'),
  ('super stripe',          2, 'Super Stripe'),
  ('super fire',            2, 'Super Fire'),
  ('patternless',           2, 'Patternless'),
  ('highway',               2, 'Highway')
on conflict (trait_token) do update
  set tier = excluded.tier,
      display_name = excluded.display_name;

-- ---- Tier 3: cosmetic descriptors ------------------------------------------
insert into geck_data.trait_tiers (trait_token, tier, display_name) values
  ('harlequin',             3, 'Harlequin'),
  ('tri-color',             3, 'Tri-Color'),
  ('dark',                  3, 'Dark'),
  ('dalmatian',             3, 'Dalmatian'),
  ('yellow',                3, 'Yellow'),
  ('cream',                 3, 'Cream'),
  ('red',                   3, 'Red'),
  ('white wall',            3, 'White Wall'),
  ('red base',              3, 'Red Base'),
  ('partial pinstripe',     3, 'Partial Pinstripe'),
  ('portholes',             3, 'Portholes'),
  ('black base',            3, 'Black Base'),
  ('empty back',            3, 'Empty Back'),
  ('lavender',              3, 'Lavender'),
  ('tangerine',             3, 'Tangerine'),
  ('snowflake',             3, 'Snowflake'),
  ('orange',                3, 'Orange'),
  ('orange patterning',     3, 'Orange Patterning'),
  ('white patterning',      3, 'White Patterning'),
  ('ink spot',              3, 'Ink Spot'),
  ('tiger',                 3, 'Tiger'),
  ('brindle',               3, 'Brindle'),
  ('yellow base',           3, 'Yellow Base'),
  ('fringing',              3, 'Fringing'),
  ('white out',             3, 'White Out'),
  ('flame',                 3, 'Flame'),
  ('red spot',              3, 'Red Spot'),
  ('black',                 3, 'Black'),
  ('kneecaps',              3, 'Kneecaps'),
  ('hypo',                  3, 'Hypo'),
  ('pin-dashed',            3, 'Pin-Dashed'),
  ('white tip',             3, 'White Tip'),
  ('oil spot',              3, 'Oil Spot'),
  ('halloween',             3, 'Halloween'),
  ('blushing',              3, 'Blushing')
on conflict (trait_token) do update
  set tier = excluded.tier,
      display_name = excluded.display_name;

grant select on geck_data.trait_tiers to anon, authenticated;

-- END SOURCE MIGRATION: 0021_trait_tiers.sql


-- BEGIN SOURCE MIGRATION: 0022_v_combo_profitability_v2.sql
-- ============================================================================
-- 0022_v_combo_profitability_v2.sql
--
-- Rewrites v_combo_profitability to fix two real problems with v1
-- (0019):
--
--   1. Single-sale "medians."   p_min_pair_listings only required 20
--      total listings (live + sold): pairs with sold_count = 1 ranked
--      to the top because percentile_cont(0.5) of one row is that row's
--      price. A single $1,250 outlier sale of a complex multi-trait
--      gecko got attributed to every pair of tokens that gecko was
--      tagged with (Red × Snowflake, Partial Pinstripe × Red,
--      Red Base × Tri-Color, …) and they all surfaced with $1,250
--      "medians." We now require p_min_sold_count actual sales (default
--      3) so the median is statistically meaningful.
--
--   2. Incidental pair labels.  Auto-discovered pairs emit a tile for
--      every pair of frequent trait tokens that co-occur on the same
--      listing. A listing tagged with 8 traits emits C(8,2)=28 pairs.
--      Many of these are statistical noise: "Snowflake × Tri-Color"
--      is not a combo anyone shops for. The new function joins each
--      token to geck_data.trait_tiers (migration 0021) and:
--        * orders the pair name so the lower-tier (more primary) token
--          comes first: "Axanthic × Snowflake" not "Snowflake × Axanthic"
--        * returns is_incidental = true when both tokens are Tier 3
--          (cosmetic descriptors only). The UI surfaces incidental
--          combos in a separate section so the main ranking shows
--          combos with at least one real value-driver.
--
-- Backwards compat: existing columns are preserved and three new ones
-- are appended (combo_rank, is_incidental, primary_token).
-- ============================================================================

drop function if exists geck_data.v_combo_profitability(int, int, int);

create or replace function geck_data.v_combo_profitability(
  p_window_days        int default 90,
  p_min_top_trait_n    int default 25,
  p_min_pair_listings  int default 20,
  p_min_sold_count     int default 3
)
returns table (
  combo_name        text,
  combo_source      text,    -- 'anchor' | 'discovered'
  sold_count        int,
  live_count        int,
  median_sold       numeric,
  median_ask        numeric,
  sell_through_rate numeric,
  effective_price   numeric,
  score             numeric,
  confidence        int,
  combo_rank        int,     -- tier sum; T1+T1=2 best, T3+T3=6 worst
  is_incidental     boolean, -- true when both tokens are Tier 3
  primary_token     text     -- lower-tier token in the pair (null for anchors)
)
language sql
stable
parallel safe
set search_path = geck_data
as $body$
with
listing_tokens as (
  select
    l.id,
    l.price_usd_equivalent,
    l.current_status,
    lower(trim(both ' ' from tok)) as token
  from geck_data.market_listings l,
       lateral regexp_split_to_table(
         coalesce(l.cached_traits, replace(coalesce(l.norm_traits, ''), ',', '|')),
         '\s*[|,]\s*'
       ) as tok
  where l.price_usd_equivalent is not null
    and l.price_usd_equivalent between 50 and 10000
    and tok is not null
    and lower(trim(both ' ' from tok)) <> ''
    and length(trim(both ' ' from tok)) >= 3
    and position(':' in tok) = 0
),
sold_events as (
  select distinct lse.listing_id
  from geck_data.listing_status_events lse
  where lse.status = 'sold'
    and lse.observed_at >= now() - make_interval(days => p_window_days)
),
in_window_listings as (
  select id from geck_data.market_listings
  where first_seen_at >= now() - make_interval(days => p_window_days)
),
-- ---- Anchor combos ----
anchor_classified as (
  select
    c.combo_name,
    'anchor'::text as combo_source,
    l.id,
    l.price_usd_equivalent,
    case when se.listing_id is not null then 'sold' else l.current_status end as effective_status
  from geck_data.combo_catalog c
  cross join lateral (
    select id, price_usd_equivalent, current_status, cached_traits, norm_traits
    from geck_data.market_listings
    where price_usd_equivalent is not null
      and price_usd_equivalent between 50 and 10000
      and (
        select bool_and(
          position(token in lower(coalesce(cached_traits, '') || ' ' || coalesce(norm_traits, ''))) > 0
        )
        from unnest(c.tokens) as token
      )
  ) l
  left join sold_events se on se.listing_id = l.id
  where l.id in (select id from in_window_listings)
     or se.listing_id is not null
),
anchor_rollup as (
  select
    combo_name,
    combo_source,
    count(*) filter (where effective_status = 'sold')::int as sold_count,
    count(*) filter (where effective_status = 'live')::int as live_count,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'sold') as median_sold,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'live') as median_ask,
    -- Anchor combo_rank = sum of tiers of its tokens, clamped to the
    -- same 2..6 range pairs use so they sort together.
    least(6, greatest(2,
      (select coalesce(sum(coalesce(tt.tier, 3)), 6)::int
       from geck_data.combo_catalog cc
       cross join lateral unnest(cc.tokens) as token
       left join geck_data.trait_tiers tt on tt.trait_token = token
       where cc.combo_name = anchor_classified.combo_name
       limit 1
      )
    )) as combo_rank,
    false as is_incidental,
    null::text as primary_token
  from anchor_classified
  group by combo_name, combo_source
),
-- ---- Auto-discovered pair combos ----
top_traits as (
  select token, count(*) as n
  from listing_tokens
  group by token
  having count(*) >= p_min_top_trait_n
),
listing_pairs as (
  select
    t1.id,
    t1.price_usd_equivalent,
    case when se.listing_id is not null then 'sold' else t1.current_status end as effective_status,
    -- Primary token = lower tier (more value-driving). Tie-break on
    -- alphabetic so the same pair always renders with the same name.
    case
      when coalesce(tier1.tier, 3) < coalesce(tier2.tier, 3) then t1.token
      when coalesce(tier1.tier, 3) > coalesce(tier2.tier, 3) then t2.token
      else least(t1.token, t2.token)
    end as primary_token,
    case
      when coalesce(tier1.tier, 3) < coalesce(tier2.tier, 3) then t2.token
      when coalesce(tier1.tier, 3) > coalesce(tier2.tier, 3) then t1.token
      else greatest(t1.token, t2.token)
    end as secondary_token,
    coalesce(tier1.tier, 3) + coalesce(tier2.tier, 3) as combo_rank,
    (coalesce(tier1.tier, 3) = 3 and coalesce(tier2.tier, 3) = 3) as is_incidental
  from listing_tokens t1
  join listing_tokens t2 on t1.id = t2.id and t1.token < t2.token
  join top_traits ta on ta.token = t1.token
  join top_traits tb on tb.token = t2.token
  left join geck_data.trait_tiers tier1 on tier1.trait_token = t1.token
  left join geck_data.trait_tiers tier2 on tier2.trait_token = t2.token
  left join sold_events se on se.listing_id = t1.id
  where t1.id in (select id from in_window_listings)
     or se.listing_id is not null
),
pair_rollup as (
  select
    coalesce(td_primary.display_name, initcap(primary_token))
      || ' × '
      || coalesce(td_secondary.display_name, initcap(secondary_token)) as combo_name,
    'discovered'::text as combo_source,
    count(*) filter (where effective_status = 'sold')::int as sold_count,
    count(*) filter (where effective_status = 'live')::int as live_count,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'sold') as median_sold,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'live') as median_ask,
    min(combo_rank)::int as combo_rank,
    bool_and(is_incidental) as is_incidental,
    primary_token
  from listing_pairs
  left join geck_data.trait_tiers td_primary on td_primary.trait_token = primary_token
  left join geck_data.trait_tiers td_secondary on td_secondary.trait_token = secondary_token
  group by primary_token, secondary_token, td_primary.display_name, td_secondary.display_name
  having count(*) >= p_min_pair_listings
),
-- Sorted-token dedup key so anchor "Lilly White × Cappuccino" and
-- discovered "Cappuccino × Lilly White" merge, same pair, different
-- string order. Without this both surface as separate rows with
-- identical metrics.
anchor_keyed as (
  select
    ar.*,
    (select string_agg(trim(both ' ' from t), '|' order by trim(both ' ' from t))
     from regexp_split_to_table(lower(ar.combo_name), '×') as t) as dedup_key
  from anchor_rollup ar
),
pair_keyed as (
  select
    pr.*,
    (select string_agg(trim(both ' ' from t), '|' order by trim(both ' ' from t))
     from regexp_split_to_table(lower(pr.combo_name), '×') as t) as dedup_key
  from pair_rollup pr
),
combined as (
  select combo_name, combo_source, sold_count, live_count, median_sold, median_ask,
         combo_rank, is_incidental, primary_token
  from anchor_keyed
  union all
  select combo_name, combo_source, sold_count, live_count, median_sold, median_ask,
         combo_rank, is_incidental, primary_token
  from pair_keyed
  where dedup_key not in (select dedup_key from anchor_keyed)
)
select
  c.combo_name,
  c.combo_source,
  c.sold_count,
  c.live_count,
  round(c.median_sold::numeric, 0)              as median_sold,
  round(c.median_ask::numeric, 0)               as median_ask,
  round(
    (case when (c.sold_count + c.live_count) = 0 then 0
          else c.sold_count::numeric / (c.sold_count + c.live_count)
     end)::numeric,
    4
  ) as sell_through_rate,
  round(
    (coalesce(c.median_sold, c.median_ask * 0.8))::numeric,
    0
  ) as effective_price,
  round(
    (coalesce(c.median_sold, c.median_ask * 0.8)
     * (case when (c.sold_count + c.live_count) = 0 then 0
             else c.sold_count::numeric / (c.sold_count + c.live_count)
        end)
    )::numeric,
    2
  ) as score,
  least(99,
    greatest(1,
      round((10 + c.sold_count * 4 + c.live_count * 0.4)::numeric)
    )
  )::int as confidence,
  c.combo_rank,
  c.is_incidental,
  c.primary_token
from combined c
where c.sold_count >= p_min_sold_count;
$body$;

grant execute on function geck_data.v_combo_profitability(int, int, int, int) to anon, authenticated;

-- END SOURCE MIGRATION: 0022_v_combo_profitability_v2.sql


-- BEGIN SOURCE MIGRATION: 0023_model_invocations.sql
-- 0021: Per-call log of every Anthropic model invocation that hits
-- the recognize-gecko-morph edge function (and any future LLM-backed
-- edge function that opts in). One row per upstream Anthropic request,
-- written from the edge function via the geck-data service role.
--
-- Powers the /data-admin/control "Spend (7d)" panel and gives us a
-- queryable substrate for cost dashboards instead of the Anthropic
-- billing PDF.

create table if not exists geck_data.model_invocations (
  id bigserial primary key,
  called_at timestamptz not null default now(),

  -- Which feature called Claude. Free-text so we can add new surfaces
  -- without a schema change; canonical values today:
  --   'morph_id_production'. Recognition.jsx, TrainModel.jsx (paying users)
  --   'morph_id_eval', scripts/eval_morph_id.py
  --   'morph_id_unknown', fallback when the caller didn't tag itself
  surface text not null,

  -- Resolved Claude model id at request time
  model text not null,

  -- Tokens reported by Anthropic in the response usage block
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_creation_tokens int,

  -- Estimated USD cost in cents (numeric for sub-cent precision).
  -- Computed in the edge function from a known price table so the
  -- value is frozen at write time even if prices change later.
  est_cost_cents numeric(12,4),

  -- Provenance
  user_id uuid,
  tier text,
  is_admin boolean default false,
  photo_count int,
  few_shot_count int,

  -- Outcome
  http_status int,
  error_code text,
  duration_ms int,
  request_id text
);

create index if not exists idx_model_invocations_called_at
  on geck_data.model_invocations(called_at desc);
create index if not exists idx_model_invocations_surface_called_at
  on geck_data.model_invocations(surface, called_at desc);
create index if not exists idx_model_invocations_error_code
  on geck_data.model_invocations(error_code)
  where error_code is not null;
create index if not exists idx_model_invocations_user_called_at
  on geck_data.model_invocations(user_id, called_at desc)
  where user_id is not null;

-- RLS: only the service role writes (from the edge function). Public
-- reads are allowed because /data-admin is the only consumer and it's
-- already gated by ADMIN_USER_ID at the route layer. If we ever expose
-- this table outside /data-admin we should tighten this to admin-only.
alter table geck_data.model_invocations enable row level security;
drop policy if exists "public read model_invocations" on geck_data.model_invocations;
create policy "public read model_invocations" on geck_data.model_invocations
  for select using (true);

-- Convenience view: 7-day spend rollup by day x surface x model, for
-- the /data-admin/control "Spend (7d)" panel.
create or replace view geck_data.v_model_spend_7d as
  select
    date_trunc('day', called_at) as day,
    surface,
    model,
    count(*) as call_count,
    sum(coalesce(input_tokens, 0))  as input_tokens,
    sum(coalesce(output_tokens, 0)) as output_tokens,
    sum(coalesce(est_cost_cents, 0)) as cost_cents,
    count(*) filter (where error_code is not null) as error_count
  from geck_data.model_invocations
  where called_at >= now() - interval '7 days'
  group by 1, 2, 3
  order by 1 desc, cost_cents desc;

-- END SOURCE MIGRATION: 0023_model_invocations.sql


-- BEGIN SOURCE MIGRATION: 0024_runtime_config.sql
-- 0022: Runtime configuration knobs that the /data-admin/control panel
-- can change without a redeploy. The eval script and the
-- recognize-gecko-morph edge function read these instead of (or as a
-- preferred override on top of) their existing env-var defaults, so
-- raising a daily cap is a single SQL update + automatic next-call pickup.
--
-- Every change is mirrored into runtime_config_history so we have an
-- audit trail of who turned what dial when.

create table if not exists geck_data.runtime_config (
  key text primary key,
  value jsonb not null,
  value_kind text not null check (value_kind in ('integer','number','boolean','string','json')),
  description text,
  min_value numeric,
  max_value numeric,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists geck_data.runtime_config_history (
  id bigserial primary key,
  key text not null,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz not null default now(),
  changed_by text
);

create index if not exists idx_runtime_config_history_key_time
  on geck_data.runtime_config_history(key, changed_at desc);

-- Trigger: every INSERT and UPDATE writes a history row. DELETE is
-- intentionally not audited because keys should never be deleted in
-- practice (the panel UI hides delete; SQL can still do it manually).
create or replace function geck_data.runtime_config_audit() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    insert into geck_data.runtime_config_history (key, old_value, new_value, changed_by)
    values (new.key, null, new.value, new.updated_by);
    return new;
  elsif (tg_op = 'UPDATE') then
    if old.value is distinct from new.value then
      insert into geck_data.runtime_config_history (key, old_value, new_value, changed_by)
      values (new.key, old.value, new.value, new.updated_by);
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists runtime_config_audit_trigger on geck_data.runtime_config;
create trigger runtime_config_audit_trigger
  after insert or update on geck_data.runtime_config
  for each row execute function geck_data.runtime_config_audit();

alter table geck_data.runtime_config enable row level security;
alter table geck_data.runtime_config_history enable row level security;

drop policy if exists "public read runtime_config" on geck_data.runtime_config;
create policy "public read runtime_config" on geck_data.runtime_config
  for select using (true);

drop policy if exists "public read runtime_config_history" on geck_data.runtime_config_history;
create policy "public read runtime_config_history" on geck_data.runtime_config_history
  for select using (true);

-- Seed the knobs the /data-admin/control panel needs day one. Idempotent
-- via on conflict do nothing so re-running this migration in a recovery
-- scenario doesn't reset a value the admin has since tuned.
insert into geck_data.runtime_config (key, value, value_kind, description, min_value, max_value, updated_by)
values
  ('eval_daily_cap_calls', to_jsonb(300), 'integer',
   'Max total images sent to recognize-gecko-morph per UTC day from scripts/eval_morph_id.py. '
   || 'Zero disables the cap. Mirror of the EVAL_DAILY_CAP_CALLS env var; runtime wins.',
   0, 5000, 'migration_0022'),
  ('morph_id_per_ip_daily', to_jsonb(50), 'integer',
   'Soft cap on production MorphID calls per source-IP per UTC day. Read by the edge function. '
   || 'Zero disables the cap.',
   0, 1000, 'migration_0022')
on conflict (key) do nothing;

-- END SOURCE MIGRATION: 0024_runtime_config.sql


-- BEGIN SOURCE MIGRATION: 0025_model_invocations_ip_hash.sql
-- 0025: Add ip_hash to model_invocations so the recognize-gecko-morph
-- edge function can enforce runtime_config.morph_id_per_ip_daily.
--
-- We store a SHA-256(salt + ip) hash, not the raw IP, so the table
-- doesn't carry PII even if the runtime_config sink leaks. The salt
-- lives in the edge function's IP_HASH_SALT env var.
--
-- A partial index lets the per-IP today-count query stay sub-millisecond
-- without bloating the index on legacy rows where ip_hash is null.

alter table geck_data.model_invocations
  add column if not exists ip_hash text;

create index if not exists idx_model_invocations_ip_hash_called_at
  on geck_data.model_invocations(ip_hash, called_at desc)
  where ip_hash is not null;

-- END SOURCE MIGRATION: 0025_model_invocations_ip_hash.sql


-- BEGIN SOURCE MIGRATION: 0026_anthropic_billing_daily.sql
-- 0026: Mirror of Anthropic's actual daily cost report. Populated by
-- scripts/pull_anthropic_billing.py against the
-- /v1/organizations/cost_report Admin API endpoint.
--
-- The /data-admin/control "Spend (7d)" panel pairs this with
-- v_model_spend_7d so we can show Estimated $ (from token counts in
-- model_invocations) next to Actual $ (from Anthropic's billing) and
-- flag drift.

create table if not exists geck_data.anthropic_billing_daily (
  day date primary key,
  cost_cents numeric not null default 0,
  by_model jsonb not null default '{}'::jsonb,        -- { model: cost_cents }
  by_token_type jsonb not null default '{}'::jsonb,   -- { token_type: cost_cents }
  raw jsonb,                                          -- whole bucket payload for debug
  fetched_at timestamptz not null default now()
);

create index if not exists idx_anthropic_billing_daily_day
  on geck_data.anthropic_billing_daily(day desc);

alter table geck_data.anthropic_billing_daily enable row level security;
drop policy if exists "public read anthropic_billing_daily" on geck_data.anthropic_billing_daily;
create policy "public read anthropic_billing_daily" on geck_data.anthropic_billing_daily
  for select using (true);

-- END SOURCE MIGRATION: 0026_anthropic_billing_daily.sql


-- BEGIN SOURCE MIGRATION: 0027_security_and_phash.sql
-- ============================================================================
-- Geck Data 0027: tighten RLS, add image perceptual-hash column.
--
-- 1. alert_matches was created with public-read RLS in 0002 alongside the
--    market tables, but a match links an alert (owner-scoped) to a listing.
--    Reading other users' matches leaks their saved-query semantics. Move
--    the policy to owner-scoped by joining through alerts.owner_id.
--
-- 2. cross_platform_listings is fine for public read (it's market data),
--    but we never set up a write policy for the service role, confirm it
--    explicitly so the contract is documented.
--
-- 3. Add listing_images.phash (perceptual hash) + index for the future
--    cross-platform dedup feature. The hash itself will be computed by a
--    separate worker (the route handler doesn't have a pHash dependency
--    today); this migration only lays the column down so /api/ingest can
--    persist hashes as they arrive.
--
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. alert_matches: owner-scoped read.
-- ----------------------------------------------------------------------------
drop policy if exists "public read alert_matches" on geck_data.alert_matches;
drop policy if exists "owner read alert_matches"  on geck_data.alert_matches;

create policy "owner read alert_matches" on geck_data.alert_matches
  for select using (
    exists (
      select 1
      from geck_data.alerts a
      where a.id = alert_matches.alert_id
        and a.owner_id = auth.uid()
    )
  );

-- Service role bypasses RLS entirely, so /api/ingest's writes still work.
-- We do NOT add an insert policy for anon/authenticated; user-facing alert
-- evaluation runs server-side with the admin client.

-- ----------------------------------------------------------------------------
-- 2. listing_images.phash: 64-bit perceptual hash, stored as bytea.
--    Indexed for fast "show me other listings with a similar image" queries.
-- ----------------------------------------------------------------------------
alter table geck_data.listing_images
  add column if not exists phash bytea,
  add column if not exists phash_algo text;  -- 'dhash'|'phash'|'whash'

create index if not exists idx_listing_images_phash
  on geck_data.listing_images(phash)
  where phash is not null;

-- Same column on cross_platform_listing_images so dedup can match across
-- the platform boundary (the whole point of pHash for this product).
alter table geck_data.cross_platform_listing_images
  add column if not exists phash bytea,
  add column if not exists phash_algo text;

create index if not exists idx_xpl_images_phash
  on geck_data.cross_platform_listing_images(phash)
  where phash is not null;

-- ----------------------------------------------------------------------------
-- 3. listing_image_phash_pairs, materialized candidate matches.
--    The dedup worker computes pHash, finds near-neighbours, and writes one
--    row per candidate pair. Read-side just consumes this table.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.listing_image_phash_pairs (
  id bigserial primary key,
  left_image_id uuid not null,
  right_image_id uuid not null,
  left_kind text not null check (left_kind in ('listing','cross_platform')),
  right_kind text not null check (right_kind in ('listing','cross_platform')),
  hamming_distance int not null,
  confidence numeric,            -- 1.0 = identical, 0.0 = unrelated
  computed_at timestamptz not null default now(),
  unique (left_image_id, right_image_id)
);

create index if not exists idx_phash_pairs_left
  on geck_data.listing_image_phash_pairs(left_image_id);
create index if not exists idx_phash_pairs_right
  on geck_data.listing_image_phash_pairs(right_image_id);
create index if not exists idx_phash_pairs_distance
  on geck_data.listing_image_phash_pairs(hamming_distance);

alter table geck_data.listing_image_phash_pairs enable row level security;
drop policy if exists "public read phash pairs" on geck_data.listing_image_phash_pairs;
create policy "public read phash pairs" on geck_data.listing_image_phash_pairs
  for select using (true);

-- END SOURCE MIGRATION: 0027_security_and_phash.sql


-- BEGIN SOURCE MIGRATION: 0028_backfill_drops_and_traits.sql
-- ============================================================================
-- Geck Data 0028: backfill historical price drops and sanitize trait columns.
--
-- 1. price_history contains every observed price per listing, but price_drops
--    only gets new rows from the extension's `priceDrop` event. Listings
--    whose price fell before the extension shipped the event (or where the
--    extension missed a window) never produced a price_drops row, leaving
--    /price-drops analytics under-counted. Backfill from price_history
--    using a window function over (listing_id ORDER BY observed_at).
--
-- 2. cached_traits/norm_traits can still hold leaked key/value segments
--    ("Diet: Meal Replacement", "Proven breeder: No") from rows ingested
--    before sanitization moved into the projectListing path (events.ts).
--    Apply the same regex strip on existing rows so /trends + /market
--    stop surfacing fake morphs derived from those words.
--
-- Both passes are idempotent: re-running won't double-write drops (unique
-- constraint added below) and the trait sanitization is a fixed-point
-- transform: running it twice produces the same output.
--
-- AMENDED 2026-07-07, before the first prod apply. The original dedup
-- key (listing_id, observed_at, source) was insufficient: a dry run
-- showed 2,548 of 2,555 lag-derived candidates were near-duplicates of
-- drops the extension had already recorded at a slightly different
-- timestamp, so the insert would have doubled the price_drops table.
-- The insert now also skips candidates that already have a price_drops
-- row for the same listing within one hour. Applied to prod that day
-- with this guard (7 genuinely missed drops inserted, 56 trait rows
-- sanitized; originals snapshotted in _backup_0028_trait_rows).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. price_drops backfill.
-- ----------------------------------------------------------------------------

-- Add a unique partial constraint so the backfill is replayable. We tag
-- backfilled rows with source='backfill_0028' so a re-run skips them via
-- ON CONFLICT.
create unique index if not exists idx_price_drops_listing_observed_src
  on geck_data.price_drops(listing_id, observed_at, source);

insert into geck_data.price_drops (
  listing_id, old_price, new_price, old_price_usd, new_price_usd,
  currency, pct_change, observed_at, source
)
select
  listing_id,
  prev_price                                              as old_price,
  price                                                   as new_price,
  prev_usd                                                as old_price_usd,
  price_usd_equivalent                                    as new_price_usd,
  currency,
  case
    when prev_price is null or prev_price = 0 then null
    else ((price - prev_price) / prev_price) * 100.0
  end                                                     as pct_change,
  observed_at,
  'backfill_0028'                                         as source
from (
  select
    listing_id,
    price,
    price_usd_equivalent,
    currency,
    observed_at,
    lag(price)                  over w as prev_price,
    lag(price_usd_equivalent)   over w as prev_usd
  from geck_data.price_history
  window w as (partition by listing_id order by observed_at)
) windowed
where prev_price is not null
  and price       is not null
  and price < prev_price
  and not exists (
    select 1 from geck_data.price_drops pd
    where pd.listing_id = windowed.listing_id
      and pd.observed_at between windowed.observed_at - interval '1 hour'
                             and windowed.observed_at + interval '1 hour'
  )
on conflict (listing_id, observed_at, source) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Trait sanitization backfill.
--    Strip leaked key/value segments. The list mirrors KEY_PREFIXES in
--    src/lib/traits.ts. A row collapsing to empty becomes NULL.
-- ----------------------------------------------------------------------------

create or replace function geck_data._sanitize_cached_traits(input text)
returns text
language plpgsql
immutable
as $$
declare
  segs text[];
  kept text[] := '{}';
  s text;
  re text := '^\s*(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$|\|)';
begin
  if input is null or btrim(input) = '' then return null; end if;
  if position('|' in input) > 0 then
    segs := string_to_array(input, '|');
  else
    segs := array[input];
  end if;
  foreach s in array segs loop
    s := btrim(s);
    if s = '' then continue; end if;
    if s ~* re then continue; end if;
    kept := array_append(kept, s);
  end loop;
  if cardinality(kept) = 0 then return null; end if;
  return array_to_string(kept, ' | ');
end;
$$;

create or replace function geck_data._sanitize_norm_traits(input text)
returns text
language plpgsql
immutable
as $$
declare
  segs text[];
  kept text[] := '{}';
  s text;
begin
  if input is null or btrim(input) = '' then return null; end if;
  segs := string_to_array(input, ',');
  foreach s in array segs loop
    s := btrim(s);
    if s = '' or position(':' in s) > 0 then continue; end if;
    kept := array_append(kept, s);
  end loop;
  if cardinality(kept) = 0 then return null; end if;
  return array_to_string(kept, ', ');
end;
$$;

-- One pass over market_listings. Only update rows that actually change so
-- we don't churn timestamps on millions of clean rows.
update geck_data.market_listings ml
   set cached_traits = geck_data._sanitize_cached_traits(ml.cached_traits),
       norm_traits   = geck_data._sanitize_norm_traits(ml.norm_traits)
 where (ml.cached_traits is distinct from geck_data._sanitize_cached_traits(ml.cached_traits))
    or (ml.norm_traits   is distinct from geck_data._sanitize_norm_traits(ml.norm_traits));

-- END SOURCE MIGRATION: 0028_backfill_drops_and_traits.sql


-- BEGIN SOURCE MIGRATION: 0029_market_intelligence_views.sql
-- ============================================================================
-- Geck Data 0029: market intelligence views.
--
-- These views back the new public API endpoints:
--   /api/market/temperature  → v_market_temperature
--   /api/market/fair-price   → v_combo_price_distribution
--   /api/market/arbitrage    → v_cross_platform_arbitrage_pairs
--
-- All are CREATE OR REPLACE so the file is replayable. They live in the
-- public schema so the anon key can SELECT them (no RLS on views).
--
-- Cresteds only, every view filters species in ('crested','unknown').
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. v_market_temperature
--    Composite scalar 0..100 summarising market activity over the last 30d.
--    Components (each normalised to 0..1, then averaged and rescaled):
--      - listing_volume   : new listings observed first_seen_at in 30d
--                           normalised against the trailing 365d distribution
--      - sell_through     : sold within 30d / listed within 30d
--      - velocity_inverse : median days-to-sell inverted (faster = hotter)
--      - price_momentum   : median sold price 30d vs 90d (capped ±20%)
--    Time-bucketed weekly so the dashboard can plot a sparkline.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_market_temperature as
with weeks as (
  select generate_series(
    date_trunc('week', now()) - interval '52 weeks',
    date_trunc('week', now()),
    interval '1 week'
  )::date as week_start
),
listings_per_week as (
  select date_trunc('week', first_seen_at)::date as week_start,
         count(*)::numeric as listed_n
    from geck_data.market_listings
   where species in ('crested','unknown')
     and first_seen_at >= now() - interval '52 weeks'
   group by 1
),
sold_per_week as (
  select date_trunc('week', lse.observed_at)::date as week_start,
         count(*)::numeric as sold_n,
         percentile_cont(0.5) within group (
           order by coalesce(ml.price_usd_equivalent, ml.price)
         ) as median_sold_usd,
         percentile_cont(0.5) within group (
           order by lse.days_since_first_seen
         ) as median_days_to_sell
    from geck_data.listing_status_events lse
    join geck_data.market_listings ml on ml.id = lse.listing_id
   where lse.status = 'sold'
     and ml.species in ('crested','unknown')
     and lse.observed_at >= now() - interval '52 weeks'
   group by 1
)
select
  w.week_start,
  coalesce(lpw.listed_n, 0)                        as listed_n,
  coalesce(spw.sold_n, 0)                          as sold_n,
  case
    when coalesce(lpw.listed_n, 0) = 0 then null
    else (coalesce(spw.sold_n, 0)::numeric / lpw.listed_n)
  end                                              as sell_through,
  spw.median_sold_usd,
  spw.median_days_to_sell
from weeks w
left join listings_per_week lpw on lpw.week_start = w.week_start
left join sold_per_week     spw on spw.week_start = w.week_start
order by w.week_start;

-- ----------------------------------------------------------------------------
-- 2. v_combo_price_distribution
--    Per-combo price percentiles + sample size, computed from sold listings
--    in the last 180 days. Drives /api/market/fair-price.
--    cached_traits is matched against combo trait sets in application code
--    (the matcher lives in lib/market/combos.ts); this view only emits the
--    listing-level price + the canonical combo id projected from a helper
--    function. We compute the combo id inline using a CASE chain instead of
--    a join to keep the view dependency-free.
-- ----------------------------------------------------------------------------
create or replace function geck_data._combo_id_from_traits(traits text)
returns text
language sql
immutable
as $$
  with t as (
    select lower(regexp_replace(coalesce(traits, ''), '[^a-zA-Z0-9 |,/;]', ' ', 'g')) as norm
  )
  select case
    when norm like '%lilly white%' and norm like '%axanthic%'        then 'lw-axa'
    when norm like '%lilly white%' and norm like '%cappuccino%'      then 'lw-cap'
    when norm like '%cappuccino%'  and norm like '%full pinstripe%'  then 'cap-pin'
    when norm like '%axanthic%'    and norm like '%full pinstripe%'  then 'axa-pin'
    when norm like '%sable%'       and norm like '%extreme harlequin%' then 'sable-harl'
    when norm like '%frappuccino%' and norm like '%pinstripe%'       then 'frap-pin'
    when norm like '%moonglow%'    and norm like '%super dalmatian%' then 'moonglow-dal'
    when norm like '%lilly white%' and norm like '%soft scale%'      then 'lw-soft'
    when norm like '%axanthic%'    and norm like '%extreme harlequin%' then 'axa-harl'
    when norm like '%cappuccino%'  and norm like '%super dalmatian%' then 'cap-dal'
    when norm like '%red%'         and norm like '%harlequin%'       then 'red-harl'
    when norm like '%tiger%'       and norm like '%pinstripe%'       then 'tiger-pin'
    else null
  end
  from t;
$$;

create or replace view geck_data.v_combo_price_distribution as
select
  geck_data._combo_id_from_traits(coalesce(ml.cached_traits, ml.norm_traits)) as combo_id,
  count(*)                                                                 as n,
  percentile_cont(0.10) within group (order by coalesce(ml.price_usd_equivalent, ml.price)) as p10,
  percentile_cont(0.25) within group (order by coalesce(ml.price_usd_equivalent, ml.price)) as p25,
  percentile_cont(0.50) within group (order by coalesce(ml.price_usd_equivalent, ml.price)) as p50,
  percentile_cont(0.75) within group (order by coalesce(ml.price_usd_equivalent, ml.price)) as p75,
  percentile_cont(0.90) within group (order by coalesce(ml.price_usd_equivalent, ml.price)) as p90,
  avg(coalesce(ml.price_usd_equivalent, ml.price))                         as mean_usd,
  stddev(coalesce(ml.price_usd_equivalent, ml.price))                      as stddev_usd
from geck_data.market_listings ml
join geck_data.listing_status_events lse
  on lse.listing_id = ml.id
 and lse.status = 'sold'
 and lse.observed_at >= now() - interval '180 days'
where ml.species in ('crested','unknown')
  and coalesce(ml.price_usd_equivalent, ml.price) is not null
  and coalesce(ml.price_usd_equivalent, ml.price) > 0
group by 1
having geck_data._combo_id_from_traits(coalesce(ml.cached_traits, ml.norm_traits)) is not null;

-- ----------------------------------------------------------------------------
-- 3. v_cross_platform_arbitrage_pairs
--    Joins listings sharing a phash across (listing_images, cross_platform).
--    The view emits one row per candidate pair with the price delta. Empty
--    until the pHash worker populates phash columns; downstream code should
--    treat that as the "no signal yet" empty state.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_cross_platform_arbitrage_pairs as
select
  li.listing_id                                       as listing_id,
  xpl.platform                                        as cross_platform,
  xpl.external_id                                     as cross_external_id,
  xpli.cross_platform_listing_id                      as cross_listing_uuid,
  ml.price_usd_equivalent                             as mm_price_usd,
  xpl.price_usd_equivalent                            as xpl_price_usd,
  case
    when coalesce(ml.price_usd_equivalent, 0) > 0
      then ((xpl.price_usd_equivalent - ml.price_usd_equivalent)
              / ml.price_usd_equivalent) * 100.0
  end                                                 as pct_delta,
  abs(coalesce(ml.price_usd_equivalent, 0)
      - coalesce(xpl.price_usd_equivalent, 0))        as abs_delta_usd,
  li.phash                                            as phash,
  ml.url                                              as mm_url,
  xpl.url                                             as xpl_url
from geck_data.listing_images li
join geck_data.cross_platform_listing_images xpli
  on xpli.phash = li.phash
 and xpli.phash is not null
join geck_data.cross_platform_listings xpl on xpl.id = xpli.cross_platform_listing_id
join geck_data.market_listings ml          on ml.id = li.listing_id
where li.phash is not null;

-- ----------------------------------------------------------------------------
-- 4. v_seller_reputation
--    Latest seller_snapshots row per seller + recent sold count. We drive
--    off seller_snapshots (created in 0002) rather than market_sellers
--    because market_sellers has no migration-defined column set, its
--    schema is whatever the original Python uploader laid down. Display
--    name resolution stays in application code (it falls back to listings).
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_seller_reputation as
with latest_snap as (
  select distinct on (seller_id)
    seller_id,
    observed_at,
    feedback_count,
    seller_rating_score,
    five_star_rating,
    total_listings,
    avg_price,
    membership
  from geck_data.seller_snapshots
  order by seller_id, observed_at desc
),
sold_30d as (
  select ml.seller_id, count(*) as sold_30d
    from geck_data.listing_status_events lse
    join geck_data.market_listings ml on ml.id = lse.listing_id
   where lse.status = 'sold'
     and lse.observed_at >= now() - interval '30 days'
     and ml.seller_id is not null
   group by 1
)
select
  snap.seller_id,
  snap.feedback_count,
  snap.seller_rating_score,
  snap.five_star_rating,
  snap.total_listings,
  snap.avg_price,
  snap.membership,
  coalesce(sold_30d.sold_30d, 0) as sold_30d,
  snap.observed_at               as snapshot_at
from latest_snap snap
left join sold_30d on sold_30d.seller_id = snap.seller_id;

-- END SOURCE MIGRATION: 0029_market_intelligence_views.sql


-- BEGIN SOURCE MIGRATION: 0030_notification_channels_and_demand.sql
-- ============================================================================
-- Geck Data 0030: notification channels + demand-signal event tables.
--
-- 1. user_notification_channels: where alert matches get pushed (Discord
--    webhook, generic webhook, email digest). Owner-scoped RLS so users
--    only see their own destinations. /api/ingest reads with the service
--    role so write/read symmetry isn't required.
--
-- 2. listing_views / listing_favorites: demand-side signals from the
--    extension. Until now we only knew what got listed; these tables
--    record what users *look at*. A future v_demand_index view will pair
--    views with listing_status_events to compute a demand-side velocity.
--
-- Both feature areas are additive; nothing existing depends on them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_notification_channels
-- ----------------------------------------------------------------------------
create table if not exists geck_data.user_notification_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('discord_webhook','generic_webhook','email')),
  endpoint text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  -- Allow at most a handful of endpoints per kind per user to bound the
  -- fan-out cost of a single match.
  unique (owner_id, kind, endpoint)
);

create index if not exists idx_unc_owner on geck_data.user_notification_channels(owner_id);
create index if not exists idx_unc_enabled on geck_data.user_notification_channels(enabled);

alter table geck_data.user_notification_channels enable row level security;
drop policy if exists "owner read channels"   on geck_data.user_notification_channels;
drop policy if exists "owner insert channels" on geck_data.user_notification_channels;
drop policy if exists "owner update channels" on geck_data.user_notification_channels;
drop policy if exists "owner delete channels" on geck_data.user_notification_channels;

create policy "owner read channels" on geck_data.user_notification_channels
  for select using (auth.uid() = owner_id);
create policy "owner insert channels" on geck_data.user_notification_channels
  for insert with check (auth.uid() = owner_id);
create policy "owner update channels" on geck_data.user_notification_channels
  for update using (auth.uid() = owner_id);
create policy "owner delete channels" on geck_data.user_notification_channels
  for delete using (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- 2. Demand-signal tables.
--
--    listing_views: anonymous, one row per (listing_id, anon_hash, day).
--    The extension generates a stable but anonymous hash per browser so
--    we count unique viewers without storing identifying data.
--
--    listing_favorites: ditto for the "heart" button. Same shape.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.listing_views (
  id bigserial primary key,
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  anon_hash text,                                -- daily-rotating sha256
  observed_at timestamptz not null default now(),
  view_day date generated always as ((observed_at at time zone 'UTC')::date) stored,
  referrer_kind text,                            -- 'search'|'browse'|'direct'|null
  source text,                                   -- 'extension'|'web'|...
  unique (listing_id, anon_hash, view_day)
);

create index if not exists idx_listing_views_listing on geck_data.listing_views(listing_id);
create index if not exists idx_listing_views_day on geck_data.listing_views(view_day desc);

alter table geck_data.listing_views enable row level security;
drop policy if exists "public read listing_views" on geck_data.listing_views;
create policy "public read listing_views" on geck_data.listing_views
  for select using (true);

create table if not exists geck_data.listing_favorites (
  id bigserial primary key,
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  anon_hash text,
  observed_at timestamptz not null default now(),
  source text,
  unique (listing_id, anon_hash)
);

create index if not exists idx_listing_favorites_listing on geck_data.listing_favorites(listing_id);

alter table geck_data.listing_favorites enable row level security;
drop policy if exists "public read listing_favorites" on geck_data.listing_favorites;
create policy "public read listing_favorites" on geck_data.listing_favorites
  for select using (true);

-- ----------------------------------------------------------------------------
-- 3. v_demand_index
--    Per-combo demand score: log(views_7d + 1) * (1 + favorites_7d / max(1, views_7d)).
--    The non-linearity keeps a single hyper-favourited listing from dominating;
--    the favourite-ratio bonus rewards combos where viewers convert to saves.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_demand_index as
with views_7d as (
  select listing_id, count(*) as views
    from geck_data.listing_views
   where observed_at >= now() - interval '7 days'
   group by 1
),
favs_7d as (
  select listing_id, count(*) as favs
    from geck_data.listing_favorites
   where observed_at >= now() - interval '7 days'
   group by 1
)
select
  ml.id            as listing_id,
  geck_data._combo_id_from_traits(coalesce(ml.cached_traits, ml.norm_traits)) as combo_id,
  coalesce(v.views, 0) as views_7d,
  coalesce(f.favs, 0)  as favorites_7d,
  ln(coalesce(v.views, 0) + 1)
    * (1 + (coalesce(f.favs, 0)::numeric / greatest(coalesce(v.views, 0), 1)))
  as demand_score
from geck_data.market_listings ml
left join views_7d v on v.listing_id = ml.id
left join favs_7d  f on f.listing_id = ml.id
where ml.species in ('crested','unknown');

-- END SOURCE MIGRATION: 0030_notification_channels_and_demand.sql


-- BEGIN SOURCE MIGRATION: 0031_batch_jobs.sql
-- ============================================================================
-- Geck Data 0031: batch_jobs table.
--
-- Backs /api/training/batch-invoke. One row per (listing_id, model, surface)
-- pending classification. A separate worker drains the table, calls Anthropic,
-- writes the result back into model_invocations + flips status to 'done'.
--
-- Status state machine: pending -> running -> done | failed
-- ============================================================================

create table if not exists geck_data.batch_jobs (
  id bigserial primary key,
  listing_id text not null references geck_data.market_listings(id) on delete cascade,
  model text not null,
  surface text not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_summary text,
  result jsonb,
  invocation_id bigint references geck_data.model_invocations(id) on delete set null,
  unique (listing_id, model, surface, status)
);

create index if not exists idx_batch_jobs_status_created
  on geck_data.batch_jobs(status, created_at);
create index if not exists idx_batch_jobs_listing
  on geck_data.batch_jobs(listing_id);

alter table geck_data.batch_jobs enable row level security;
drop policy if exists "public read batch_jobs" on geck_data.batch_jobs;
create policy "public read batch_jobs" on geck_data.batch_jobs for select using (true);

-- Helper: claim the next N pending jobs for a worker. Sets status='running'
-- atomically so two workers don't race for the same row. Returns the rows
-- the worker should now process.
create or replace function geck_data.claim_batch_jobs(p_limit int, p_worker text)
returns setof geck_data.batch_jobs
language sql
as $$
  with claimed as (
    select id from geck_data.batch_jobs
     where status = 'pending'
     order by created_at
     for update skip locked
     limit p_limit
  )
  update geck_data.batch_jobs bj
     set status = 'running',
         started_at = now(),
         error_summary = coalesce(error_summary, p_worker)
   where bj.id in (select id from claimed)
  returning bj.*;
$$;

-- END SOURCE MIGRATION: 0031_batch_jobs.sql


-- BEGIN SOURCE MIGRATION: 0032_data_quality_and_alerts.sql
-- ============================================================================
-- Geck Data 0032: data quality, alert maturity, ML loop, observability.
--
-- Bundles schema bits for the following improvement ideas:
--   #1  inference_confidence on listing_status_events
--   #2  canonical_listing_id on market_listings (re-list grouping)
--   #3  usd_rate_used on price_history (FX-drift correction)
--   #4  morph_taxonomy_synonyms (name normalisation)
--   #7  alert_delivery_attempts (delivery receipts)
--   #9  acknowledged_at + snoozed_until on alert_matches
--   #11 confidence numeric on model_invocations
--   #12 morph_human_labels (ML disagreement queue)
--   #13 v_trait_recognition_metrics view
--   #19 v_ingest_health_24h + prune_ingest_audit() function
--
-- Safe to re-run. Everything uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. listing_status_events.inference_confidence
--    A weak (0.0) to strong (1.0) numeric. Backfills NULL for legacy rows.
--    Convention by source:
--      extension_explicit -> 1.00  (the page itself flipped state)
--      auction_close      -> 0.95  (auction with a final bid)
--      extension_inferred -> 0.60  (heuristic: gone for >7d, etc.)
--      db_import          -> 0.50  (best-effort historical)
-- ----------------------------------------------------------------------------
alter table geck_data.listing_status_events
  add column if not exists inference_confidence numeric;

create index if not exists idx_lse_inference_confidence
  on geck_data.listing_status_events(inference_confidence)
  where inference_confidence is not null;

-- One-shot backfill from `source` for rows without a value. Idempotent.
update geck_data.listing_status_events
   set inference_confidence = case
     when source = 'extension_explicit' then 1.00
     when source = 'auction_close'      then 0.95
     when source = 'extension_inferred' then 0.60
     when source = 'db_import'          then 0.50
     else 0.70
   end
 where inference_confidence is null;

-- ----------------------------------------------------------------------------
-- 2. market_listings.canonical_listing_id
--    Same animal re-listed at a higher price gets grouped under one canonical
--    id. Populated by a dedup worker (planned, not yet shipped); we add the
--    column + index now so analytics views can join on it pre-emptively.
-- ----------------------------------------------------------------------------
alter table geck_data.market_listings
  add column if not exists canonical_listing_id text;

create index if not exists idx_market_listings_canonical
  on geck_data.market_listings(canonical_listing_id)
  where canonical_listing_id is not null;

-- ----------------------------------------------------------------------------
-- 3. price_history.usd_rate_used
--    Snapshot the FX rate used to derive price_usd_equivalent so historical
--    comparisons aren't biased by today's rates. NULL for legacy rows.
-- ----------------------------------------------------------------------------
alter table geck_data.price_history
  add column if not exists usd_rate_used numeric;

-- ----------------------------------------------------------------------------
-- 4. morph_taxonomy_synonyms
--    Canonical-form mapping for noisy trait labels. Used at sanitize-write
--    time by lib/traits.ts after the migration backfill in 0028.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.morph_taxonomy_synonyms (
  id bigserial primary key,
  alias text not null,
  canonical text not null,
  weight numeric not null default 1.0,
  added_at timestamptz not null default now(),
  added_by text,                -- 'manual' | 'ml_auto' | 'imported_from_X'
  unique (alias)
);

create index if not exists idx_synonyms_canonical
  on geck_data.morph_taxonomy_synonyms(canonical);

alter table geck_data.morph_taxonomy_synonyms enable row level security;
drop policy if exists "public read synonyms" on geck_data.morph_taxonomy_synonyms;
create policy "public read synonyms" on geck_data.morph_taxonomy_synonyms
  for select using (true);

-- Seed with a handful of obvious aliases so the table isn't empty on day 1.
insert into geck_data.morph_taxonomy_synonyms (alias, canonical, added_by) values
  ('lily white',      'Lilly White',     'manual'),
  ('lilywhite',       'Lilly White',     'manual'),
  ('lillywhite',      'Lilly White',     'manual'),
  ('cappucino',       'Cappuccino',      'manual'),
  ('frappucino',      'Frappuccino',     'manual'),
  ('extreme harl',    'Extreme Harlequin','manual'),
  ('xtreme harlequin','Extreme Harlequin','manual'),
  ('full pin',        'Full Pinstripe',  'manual'),
  ('pinny',           'Pinstripe',       'manual'),
  ('super dal',       'Super Dalmatian', 'manual')
on conflict (alias) do nothing;

-- ----------------------------------------------------------------------------
-- 7. alert_delivery_attempts
--    Track every notification attempt so /alerts can surface stale undelivered
--    matches. One row per (match × channel × attempt).
-- ----------------------------------------------------------------------------
create table if not exists geck_data.alert_delivery_attempts (
  id bigserial primary key,
  match_id uuid not null references geck_data.alert_matches(id) on delete cascade,
  channel_id uuid references geck_data.user_notification_channels(id) on delete set null,
  attempt_no int not null default 1,
  status text not null check (status in ('queued','sent','failed','retrying')),
  http_status int,
  error_summary text,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_alert_delivery_match on geck_data.alert_delivery_attempts(match_id);
create index if not exists idx_alert_delivery_status_attempted
  on geck_data.alert_delivery_attempts(status, attempted_at desc);

alter table geck_data.alert_delivery_attempts enable row level security;
drop policy if exists "owner read delivery attempts" on geck_data.alert_delivery_attempts;
-- Owner-scoped read via the match's alert.owner_id chain.
create policy "owner read delivery attempts" on geck_data.alert_delivery_attempts
  for select using (
    exists (
      select 1
      from geck_data.alert_matches m
      join geck_data.alerts a on a.id = m.alert_id
      where m.id = alert_delivery_attempts.match_id
        and a.owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 9. alert_matches.acknowledged_at + snoozed_until
--    Lets a viewer mark a match as "I saw this" so subsequent matches on the
--    same alert can skip notification until the snooze expires.
-- ----------------------------------------------------------------------------
alter table geck_data.alert_matches
  add column if not exists acknowledged_at timestamptz,
  add column if not exists snoozed_until   timestamptz;

create index if not exists idx_alert_matches_unack
  on geck_data.alert_matches(matched_at desc)
  where acknowledged_at is null;

-- ----------------------------------------------------------------------------
-- 11. model_invocations.confidence
--     Explicit per-call confidence, populated by the classifier itself
--     (currently inferred from output_tokens, keep that as a fallback in
--     /api/training/queue). NULL for legacy invocations.
-- ----------------------------------------------------------------------------
alter table geck_data.model_invocations
  add column if not exists confidence numeric,           -- 0..1
  add column if not exists predicted_combo_id text;      -- model's pick

create index if not exists idx_model_invocations_confidence
  on geck_data.model_invocations(confidence)
  where confidence is not null;

-- ----------------------------------------------------------------------------
-- 12. morph_human_labels
--     Ground truth from human reviewers. Joined with model_invocations to
--     compute per-trait recognition F1 and to surface model-vs-human
--     disagreements as the next active-learning batch.
-- ----------------------------------------------------------------------------
create table if not exists geck_data.morph_human_labels (
  id bigserial primary key,
  listing_id text references geck_data.market_listings(id) on delete cascade,
  invocation_id bigint references geck_data.model_invocations(id) on delete set null,
  combo_id text,                                        -- canonical combo
  traits text[],                                        -- canonical trait list
  labeler text not null,                                -- email / 'manual'
  notes text,
  labeled_at timestamptz not null default now()
);

create index if not exists idx_mhl_listing on geck_data.morph_human_labels(listing_id);
create index if not exists idx_mhl_labeled_at on geck_data.morph_human_labels(labeled_at desc);

alter table geck_data.morph_human_labels enable row level security;
drop policy if exists "public read human labels" on geck_data.morph_human_labels;
create policy "public read human labels" on geck_data.morph_human_labels
  for select using (true);

-- ----------------------------------------------------------------------------
-- 13. v_trait_recognition_metrics
--     Per-trait precision/recall/F1 from model_invocations × human_labels.
--     A trait is "predicted" if it appears in the model's predicted_combo_id
--     canonical trait list; "actual" if in the human label.
--     The view emits rolling 30-day numbers; widgets can window further.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_trait_recognition_metrics as
with pairs as (
  select
    mi.id                                                 as invocation_id,
    mi.predicted_combo_id                                 as predicted,
    mhl.combo_id                                          as actual,
    mhl.traits                                            as actual_traits,
    mi.called_at                                          as called_at
  from geck_data.model_invocations mi
  join geck_data.morph_human_labels mhl on mhl.invocation_id = mi.id
  where mi.called_at >= now() - interval '30 days'
),
agg as (
  select
    unnest(coalesce(actual_traits, array[]::text[]))      as trait,
    count(*)                                              as samples,
    count(*) filter (where predicted = actual)            as combo_correct,
    count(*) filter (where predicted is null)             as model_silent
  from pairs
  group by 1
)
select
  trait,
  samples,
  combo_correct,
  model_silent,
  case when samples > 0 then combo_correct::numeric / samples else null end as combo_accuracy
from agg
order by samples desc;

-- ----------------------------------------------------------------------------
-- 19. v_ingest_health_24h + prune_ingest_audit()
--     Rolling 24h health snapshot for /status. prune function drops rows
--     older than 90d so ingest_audit doesn't grow without bound.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_ingest_health_24h as
select
  count(*)                                                       as total_requests,
  count(*) filter (where status_code between 200 and 299)        as ok_requests,
  count(*) filter (where status_code >= 400)                     as error_requests,
  sum(coalesce(event_count, 0))                                  as total_events,
  sum(coalesce(ok_count, 0))                                     as events_ok,
  sum(coalesce(failed_count, 0))                                 as events_failed,
  percentile_cont(0.5)  within group (order by duration_ms)      as p50_duration_ms,
  percentile_cont(0.95) within group (order by duration_ms)      as p95_duration_ms,
  max(received_at)                                               as last_ingest_at
from geck_data.ingest_audit
where received_at >= now() - interval '24 hours';

create or replace function geck_data.prune_ingest_audit(p_keep_days int default 90)
returns int
language sql
as $$
  with deleted as (
    delete from geck_data.ingest_audit
     where received_at < now() - (p_keep_days::text || ' days')::interval
     returning 1
  )
  select count(*)::int from deleted;
$$;

-- END SOURCE MIGRATION: 0032_data_quality_and_alerts.sql


-- BEGIN SOURCE MIGRATION: 0033_price_adjustment_factors.sql
-- ============================================================================
-- Geck Data 0033: price-adjustment multipliers.
--
-- Backs /api/market/fair-price. The base price distribution per canonical
-- combo comes from v_combo_price_distribution (migration 0029); this
-- migration adds the layer that adjusts that band for the gecko's
-- individual attributes (age, sex, weight, proven status).
--
-- Why multipliers rather than further segmentation of the view:
--   Segmenting v_combo_price_distribution by (combo, age, sex, proven)
--   fragments sample sizes to nothing for rare combos, e.g., only
--   ~4 sold "proven breeder" Lilly White × Axanthic in any 180d window.
--   Multipliers borrow strength across combos: a proven-breeder uplift
--   applies the same way to all morphs, derived from the population
--   average, and stays statistically meaningful.
--
-- The seed values are hand-tuned from breeder forum wisdom for v1. A
-- follow-up cron job (POST /api/training/refresh-adjustments) regresses
-- observed sold prices on these factors over the last 180 days and
-- overwrites the seeds with empirical multipliers, so this table is
-- self-correcting from real data without any code redeploy.
-- ============================================================================

create table if not exists geck_data.price_adjustment_factors (
  id bigserial primary key,
  -- Factor category. Each row defines one bucket within one category.
  category text not null check (category in (
    'age', 'sex', 'proven', 'weight_bucket'
  )),
  -- Category bucket value:
  --   age:           hatchling | juvenile | subadult | adult | proven_breeder
  --   sex:           male | female | unknown
  --   proven:        true | false
  --   weight_bucket: underweight | normal | heavy  (relative to age class)
  bucket text not null,
  -- Multiplier applied to the base price. 1.0 = no adjustment.
  multiplier numeric not null check (multiplier > 0),
  -- How we derived this value. 'seed' for the v1 hand-tuned numbers,
  -- 'empirical_<timestamp>' for the refresh job's writes.
  source text not null default 'seed',
  -- Sample size used to derive the empirical multiplier. NULL for seeds.
  n_samples int,
  updated_at timestamptz not null default now(),
  unique (category, bucket)
);

create index if not exists idx_price_factors_category
  on geck_data.price_adjustment_factors(category);

alter table geck_data.price_adjustment_factors enable row level security;
drop policy if exists "public read price factors" on geck_data.price_adjustment_factors;
create policy "public read price factors" on geck_data.price_adjustment_factors
  for select using (true);

-- ----------------------------------------------------------------------------
-- Seed multipliers. Re-applying this migration is a no-op for any row that
-- has been updated by the refresh job (we ON CONFLICT DO NOTHING so an
-- empirical value isn't overwritten by the seed). To force a reset, the
-- operator can DELETE the row first.
-- ----------------------------------------------------------------------------
insert into geck_data.price_adjustment_factors (category, bucket, multiplier, source) values
  -- Age class. Subadult is the baseline (1.00); hatchlings discounted
  -- because they're a longer hold for the buyer, adults priced as
  -- close-to-breeding stock.
  ('age', 'hatchling',      0.55, 'seed'),
  ('age', 'juvenile',       0.75, 'seed'),
  ('age', 'subadult',       1.00, 'seed'),
  ('age', 'adult',          1.20, 'seed'),
  ('age', 'proven_breeder', 1.40, 'seed'),
  ('age', 'unknown',        1.00, 'seed'),
  -- Sex. Female premium because they produce eggs; males serve one harem.
  ('sex', 'female',  1.15, 'seed'),
  ('sex', 'male',    1.00, 'seed'),
  ('sex', 'unknown', 1.00, 'seed'),
  -- Proven flag, distinct from age=proven_breeder so a young confirmed
  -- breeder also picks up the bonus.
  ('proven', 'true',  1.10, 'seed'),
  ('proven', 'false', 1.00, 'seed'),
  -- Weight relative to age class. Buckets are computed in the endpoint:
  --   adult/proven < 35g  -> underweight
  --   adult/proven >= 60g -> heavy
  --   subadult   < 18g    -> underweight
  --   subadult   >= 40g   -> heavy
  --   etc.: see lib/market/price-adjust.ts
  ('weight_bucket', 'underweight', 0.85, 'seed'),
  ('weight_bucket', 'normal',      1.00, 'seed'),
  ('weight_bucket', 'heavy',       1.05, 'seed')
on conflict (category, bucket) do nothing;

-- ----------------------------------------------------------------------------
-- v_recent_combo_sales: the 5 most recent comparable sales per combo,
-- used by /api/market/fair-price?recent_sales=N to give the morph-card
-- response three or five concrete examples next to the percentile band.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_recent_combo_sales as
select
  geck_data._combo_id_from_traits(coalesce(ml.cached_traits, ml.norm_traits)) as combo_id,
  ml.id                                                                    as listing_id,
  coalesce(ml.price_usd_equivalent, ml.price)                              as sold_usd,
  lse.observed_at                                                          as sold_at,
  lse.days_since_first_seen                                                as days_to_sell,
  ml.seller_name                                                           as seller_name,
  ml.url                                                                   as source_url
from geck_data.market_listings ml
join geck_data.listing_status_events lse
  on lse.listing_id = ml.id
 and lse.status = 'sold'
 and lse.observed_at >= now() - interval '180 days'
where ml.species in ('crested','unknown')
  and coalesce(ml.price_usd_equivalent, ml.price) is not null
  and coalesce(ml.price_usd_equivalent, ml.price) > 0
  and geck_data._combo_id_from_traits(coalesce(ml.cached_traits, ml.norm_traits)) is not null
order by lse.observed_at desc;

-- END SOURCE MIGRATION: 0033_price_adjustment_factors.sql


-- BEGIN SOURCE MIGRATION: 0035_market_indices.sql
-- ============================================================================
-- Geck Data 0035: composite anchor-morph sub-indices + combo daily history.
--
-- Activates the previously-stubbed v_market_sub_index RPC (was referenced
-- by src/lib/market/queries.ts and always returned the empty state) and
-- adds a per-combo daily history table for fast sparkline retrieval.
--
-- All views are CREATE OR REPLACE so the file is replayable. Crested-only;
-- same species filter as 0029.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. v_market_sub_index_weekly
--    Weekly median sold price per anchor morph family. An anchor is a coarse
--    family tag (Lilly White, Axanthic, Cappuccino-line, Harlequin) inferred
--    from cached_traits / norm_traits with case-insensitive substring match.
--    A listing can contribute to multiple anchors (e.g. Lilly White x Axanthic
--    counts towards both); each anchor is computed independently.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_market_sub_index_weekly as
with sold as (
  select
    lse.observed_at,
    date_trunc('week', lse.observed_at)::date as week_start,
    coalesce(ml.price_usd_equivalent, ml.price) as price,
    lower(coalesce(ml.cached_traits, ml.norm_traits, '')) as traits_lower
  from geck_data.market_listings ml
  join geck_data.listing_status_events lse
    on lse.listing_id = ml.id
   and lse.status = 'sold'
   and lse.observed_at >= now() - interval '52 weeks'
  where ml.species in ('crested','unknown')
    and coalesce(ml.price_usd_equivalent, ml.price) is not null
    and coalesce(ml.price_usd_equivalent, ml.price) > 0
    and coalesce(ml.price_usd_equivalent, ml.price) < 100000
),
exploded as (
  select week_start, price, 'Lilly White'::text as anchor
    from sold where traits_lower like '%lilly white%'
  union all
  select week_start, price, 'Axanthic'::text from sold where traits_lower like '%axanthic%'
  union all
  select week_start, price, 'Harlequin'::text from sold
    where traits_lower like '%harlequin%' or traits_lower like '%extreme harlequin%'
  union all
  -- Cappuccino anchor groups the full Cappuccino family (Cappuccino,
  -- Sable, Frappuccino) since they share parentage and price together.
  select week_start, price, 'Cappuccino'::text from sold
    where traits_lower like '%cappuccino%'
       or traits_lower like '%sable%'
       or traits_lower like '%frappuccino%'
)
select
  week_start,
  anchor,
  percentile_cont(0.5) within group (order by price)::numeric as median_price,
  count(*)::bigint as n
from exploded
group by week_start, anchor;

-- ----------------------------------------------------------------------------
-- 2. v_market_sub_index(window_days)
--    Wraps the weekly view, narrows to the requested window, and rebases
--    each anchor's first non-null week to 1000 for chart comparison.
-- ----------------------------------------------------------------------------
create or replace function geck_data.v_market_sub_index(window_days int default 365)
returns table (
  anchor       text,
  week_start   date,
  value        numeric,
  median_price numeric,
  n            bigint
)
language sql
stable
parallel safe
set search_path = geck_data
as $$
  with windowed as (
    select anchor, week_start, median_price, n
    from geck_data.v_market_sub_index_weekly
    where week_start >= current_date - make_interval(days => window_days)
  ),
  anchored as (
    select
      anchor,
      week_start,
      median_price,
      n,
      first_value(median_price) over (
        partition by anchor order by week_start
        rows between unbounded preceding and unbounded following
      ) as base
    from windowed
  )
  select
    anchor,
    week_start,
    case when base is null or base = 0
         then null
         else round((median_price / base) * 1000, 1)
    end as value,
    round(median_price, 2) as median_price,
    n
  from anchored
  order by anchor, week_start;
$$;

-- ----------------------------------------------------------------------------
-- 3. combo_index_daily
--    Materialised per-combo daily history: combo_id, day, median sold price,
--    sample size. Refresh strategy: nightly via the existing
--    apply-migrations.yml-adjacent workflow, or on demand via
--    refresh_combo_index_daily(). The MV is bounded to 365 days so the
--    refresh stays cheap.
-- ----------------------------------------------------------------------------
drop materialized view if exists geck_data.combo_index_daily cascade;
create materialized view geck_data.combo_index_daily as
with daily as (
  select
    geck_data._combo_id_from_traits(coalesce(ml.cached_traits, ml.norm_traits)) as combo_id,
    date_trunc('day', lse.observed_at)::date as day,
    percentile_cont(0.5) within group (order by coalesce(ml.price_usd_equivalent, ml.price))::numeric as median_price,
    count(*)::bigint as n
  from geck_data.market_listings ml
  join geck_data.listing_status_events lse
    on lse.listing_id = ml.id
   and lse.status = 'sold'
   and lse.observed_at >= now() - interval '365 days'
  where ml.species in ('crested','unknown')
    and coalesce(ml.price_usd_equivalent, ml.price) is not null
    and coalesce(ml.price_usd_equivalent, ml.price) > 0
    and coalesce(ml.price_usd_equivalent, ml.price) < 100000
  group by 1, 2
)
select * from daily where combo_id is not null;

create unique index if not exists combo_index_daily_pk
  on geck_data.combo_index_daily (combo_id, day);

create index if not exists combo_index_daily_day_idx
  on geck_data.combo_index_daily (day);

-- Refresh helper. Callable from a scheduled GitHub Action or via
-- supabase MCP execute_sql when the source data has materially changed.
create or replace function geck_data.refresh_combo_index_daily()
returns void
language sql
security definer
as $$
  refresh materialized view concurrently geck_data.combo_index_daily;
$$;

-- ----------------------------------------------------------------------------
-- 4. v_combo_index_summary
--    Convenience view: for each combo, current value (latest day's median),
--    7d / 30d / 90d delta percentages, and the last 90 daily medians for
--    sparkline rendering. Backs the /indices route and the per-combo entity
--    page hero.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_combo_index_summary as
with latest as (
  select distinct on (combo_id)
    combo_id, day as latest_day, median_price as current_value, n as latest_n
  from geck_data.combo_index_daily
  order by combo_id, day desc
),
prior_7d as (
  select distinct on (combo_id)
    combo_id, median_price as v7
  from geck_data.combo_index_daily
  where day <= current_date - 7
  order by combo_id, day desc
),
prior_30d as (
  select distinct on (combo_id)
    combo_id, median_price as v30
  from geck_data.combo_index_daily
  where day <= current_date - 30
  order by combo_id, day desc
),
prior_90d as (
  select distinct on (combo_id)
    combo_id, median_price as v90
  from geck_data.combo_index_daily
  where day <= current_date - 90
  order by combo_id, day desc
)
select
  l.combo_id,
  l.latest_day,
  l.current_value,
  l.latest_n,
  case when p7.v7 is null or p7.v7 = 0 then null
       else round(((l.current_value - p7.v7) / p7.v7) * 100, 2)
  end as delta_7d,
  case when p30.v30 is null or p30.v30 = 0 then null
       else round(((l.current_value - p30.v30) / p30.v30) * 100, 2)
  end as delta_30d,
  case when p90.v90 is null or p90.v90 = 0 then null
       else round(((l.current_value - p90.v90) / p90.v90) * 100, 2)
  end as delta_90d
from latest l
left join prior_7d  p7  on p7.combo_id  = l.combo_id
left join prior_30d p30 on p30.combo_id = l.combo_id
left join prior_90d p90 on p90.combo_id = l.combo_id;

comment on view geck_data.v_market_sub_index_weekly is
  'Weekly median sold price per anchor morph family. Crested only.';
comment on function geck_data.v_market_sub_index(int) is
  'Anchor sub-index rebased to 1000 at window start. Used by /indices and /market.';
comment on materialized view geck_data.combo_index_daily is
  'Per-combo daily median sold price + sample size, 365 day window. Refresh nightly.';
comment on view geck_data.v_combo_index_summary is
  'Per-combo current value + 7/30/90d deltas. Backs /indices and combo entity hero.';

-- END SOURCE MIGRATION: 0035_market_indices.sql


-- BEGIN SOURCE MIGRATION: 0036_indices_use_price_history.sql
-- ============================================================================
-- Geck Data 0036: indices use price_history as substrate.
--
-- v_market_sub_index_weekly and combo_index_daily originally drew from
-- listing_status_events where status='sold'. The sold-events stream is
-- thin (~92 rows over 180d) so most anchor weeks and combo days came up
-- empty even though there is plenty of underlying market activity.
--
-- This migration re-creates both as observations from price_history,
-- which carries ~17K rows over 7585 listings in the last 180 days. The
-- indices change meaning from "median sold price" to "median observed
-- market price" (sold events are a subset of observations). This is an
-- honest reflection of what the data supports and matches Zillow ZHVI's
-- "all observed prices, smoothed" approach.
--
-- The /methodology page is updated in the same push to reflect the
-- definition change. All views are CREATE OR REPLACE; the MV is
-- dropped and recreated since its source query changes.
-- ============================================================================

create or replace view geck_data.v_market_sub_index_weekly as
with obs as (
  select
    date_trunc('week', ph.observed_at)::date as week_start,
    coalesce(ph.price_usd_equivalent, ph.price) as price,
    lower(coalesce(ml.cached_traits, ml.norm_traits, '')) as traits_lower
  from geck_data.price_history ph
  join geck_data.market_listings ml on ml.id = ph.listing_id
  where ph.observed_at >= now() - interval '52 weeks'
    and ml.species in ('crested','unknown')
    and coalesce(ph.price_usd_equivalent, ph.price) is not null
    and coalesce(ph.price_usd_equivalent, ph.price) > 0
    and coalesce(ph.price_usd_equivalent, ph.price) < 100000
),
exploded as (
  select week_start, price, 'Lilly White'::text as anchor
    from obs where traits_lower like '%lilly white%'
  union all
  select week_start, price, 'Axanthic'::text from obs where traits_lower like '%axanthic%'
  union all
  select week_start, price, 'Harlequin'::text from obs
    where traits_lower like '%harlequin%' or traits_lower like '%extreme harlequin%'
  union all
  select week_start, price, 'Cappuccino'::text from obs
    where traits_lower like '%cappuccino%'
       or traits_lower like '%sable%'
       or traits_lower like '%frappuccino%'
)
select
  week_start,
  anchor,
  percentile_cont(0.5) within group (order by price)::numeric as median_price,
  count(*)::bigint as n
from exploded
group by week_start, anchor;

-- v_market_sub_index function signature unchanged; it reads the view above.

drop materialized view if exists geck_data.combo_index_daily cascade;
create materialized view geck_data.combo_index_daily as
with daily as (
  select
    geck_data._combo_id_from_traits(coalesce(ml.cached_traits, ml.norm_traits)) as combo_id,
    date_trunc('day', ph.observed_at)::date as day,
    percentile_cont(0.5) within group (order by coalesce(ph.price_usd_equivalent, ph.price))::numeric as median_price,
    count(*)::bigint as n
  from geck_data.market_listings ml
  join geck_data.price_history ph on ph.listing_id = ml.id
  where ph.observed_at >= now() - interval '365 days'
    and ml.species in ('crested','unknown')
    and coalesce(ph.price_usd_equivalent, ph.price) is not null
    and coalesce(ph.price_usd_equivalent, ph.price) > 0
    and coalesce(ph.price_usd_equivalent, ph.price) < 100000
  group by 1, 2
)
select * from daily where combo_id is not null;

create unique index if not exists combo_index_daily_pk
  on geck_data.combo_index_daily (combo_id, day);

create index if not exists combo_index_daily_day_idx
  on geck_data.combo_index_daily (day);

-- v_combo_index_summary unchanged structurally; it just reads the MV.
-- Re-emit it to pick up any latent changes the MV drop might have rolled
-- through dependency invalidation. CREATE OR REPLACE on a view that
-- references a recreated MV is safe in Postgres 17.
create or replace view geck_data.v_combo_index_summary as
with latest as (
  select distinct on (combo_id)
    combo_id, day as latest_day, median_price as current_value, n as latest_n
  from geck_data.combo_index_daily
  order by combo_id, day desc
),
prior_7d as (
  select distinct on (combo_id)
    combo_id, median_price as v7
  from geck_data.combo_index_daily
  where day <= current_date - 7
  order by combo_id, day desc
),
prior_30d as (
  select distinct on (combo_id)
    combo_id, median_price as v30
  from geck_data.combo_index_daily
  where day <= current_date - 30
  order by combo_id, day desc
),
prior_90d as (
  select distinct on (combo_id)
    combo_id, median_price as v90
  from geck_data.combo_index_daily
  where day <= current_date - 90
  order by combo_id, day desc
)
select
  l.combo_id,
  l.latest_day,
  l.current_value,
  l.latest_n,
  case when p7.v7 is null or p7.v7 = 0 then null
       else round(((l.current_value - p7.v7) / p7.v7) * 100, 2)
  end as delta_7d,
  case when p30.v30 is null or p30.v30 = 0 then null
       else round(((l.current_value - p30.v30) / p30.v30) * 100, 2)
  end as delta_30d,
  case when p90.v90 is null or p90.v90 = 0 then null
       else round(((l.current_value - p90.v90) / p90.v90) * 100, 2)
  end as delta_90d
from latest l
left join prior_7d  p7  on p7.combo_id  = l.combo_id
left join prior_30d p30 on p30.combo_id = l.combo_id
left join prior_90d p90 on p90.combo_id = l.combo_id;

comment on view geck_data.v_market_sub_index_weekly is
  'Weekly median observed market price per anchor morph family. Sourced from price_history (live observations). Crested only.';
comment on materialized view geck_data.combo_index_daily is
  'Per-combo daily median observed market price + sample size, 365 day window. Sourced from price_history. Refresh nightly.';
-- END SOURCE MIGRATION: 0036_indices_use_price_history.sql


-- BEGIN SOURCE MIGRATION: 0037_observed_combos_and_traits.sql
-- ============================================================================
-- Geck Data 0037: data-driven traits + combos. Replace hardcoded list.
--
-- Background: the previous 0035/0036 indices were keyed by
-- _combo_id_from_traits(), which is a 12-row hardcoded recognizer.
-- Most listings fell outside those twelve, so /indices and the
-- anchor tiles surfaced four morph families and roughly a dozen
-- combos. Anything else was invisible to the dashboard.
--
-- This migration adds two general-purpose views and rebuilds
-- combo_index_daily and v_combo_index_summary against the broader
-- universe. The cached_traits column is comma-space delimited
-- ("Lilly White, Axanthic, Tri-color"); we split on comma, trim
-- whitespace, and aggregate.
--
-- The new universe is honest about what we observe instead of what
-- the recognizer's first author thought was interesting.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. v_observed_traits
--    Every distinct morph trait observed in cached_traits with >= 3
--    crested listings, plus its current median price.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_observed_traits as
with split as (
  select
    trim(t) as trait,
    coalesce(ml.price_usd_equivalent, ml.price) as price
  from geck_data.market_listings ml,
       unnest(string_to_array(ml.cached_traits, ',')) as t
  where ml.cached_traits is not null
    and ml.species in ('crested','unknown')
    and coalesce(ml.price_usd_equivalent, ml.price) is not null
    and coalesce(ml.price_usd_equivalent, ml.price) > 0
    and coalesce(ml.price_usd_equivalent, ml.price) < 100000
)
select
  trait,
  count(*)::bigint as n,
  percentile_cont(0.5) within group (order by price)::numeric as median_price
from split
where length(trait) >= 2
  and length(trait) <= 60
group by trait
having count(*) >= 3
order by n desc;

comment on view geck_data.v_observed_traits is
  'Every distinct trait token observed in market_listings.cached_traits with >= 3 listings. Sourced live; no curation. Used by /indices and Pulse anchor tiles.';

-- ----------------------------------------------------------------------------
-- 2. v_observed_combos
--    Every ordered pair (a, b) of traits that co-occur on at least 3
--    crested listings, with their joint median price and count.
--    The combo_name is sorted alphabetically so "Axanthic x Lilly White"
--    and "Lilly White x Axanthic" collapse to one row.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_observed_combos as
with traits_per_listing as (
  select
    ml.id,
    coalesce(ml.price_usd_equivalent, ml.price) as price,
    array_agg(distinct trim(t)) filter (
      where length(trim(t)) >= 2 and length(trim(t)) <= 60
    ) as traits
  from geck_data.market_listings ml,
       unnest(string_to_array(ml.cached_traits, ',')) as t
  where ml.cached_traits is not null
    and ml.species in ('crested','unknown')
    and coalesce(ml.price_usd_equivalent, ml.price) is not null
    and coalesce(ml.price_usd_equivalent, ml.price) > 0
    and coalesce(ml.price_usd_equivalent, ml.price) < 100000
  group by ml.id, coalesce(ml.price_usd_equivalent, ml.price)
),
pairs as (
  select
    least(t.traits[i], t.traits[j]) || ' x ' || greatest(t.traits[i], t.traits[j]) as combo_name,
    t.price
  from traits_per_listing t,
       generate_subscripts(t.traits, 1) i,
       generate_subscripts(t.traits, 1) j
  where i < j
    and array_length(t.traits, 1) >= 2
)
select
  combo_name,
  count(*)::bigint as n,
  percentile_cont(0.5) within group (order by price)::numeric as median_price
from pairs
group by combo_name
having count(*) >= 3
order by n desc;

comment on view geck_data.v_observed_combos is
  'Every observed two-trait combination with >= 3 crested listings. Auto-discovered from cached_traits; not curated. Used by /indices.';

-- ----------------------------------------------------------------------------
-- 3. combo_index_daily REBUILT
--    Switch keying from the 12-row _combo_id_from_traits() recognizer
--    to an auto-discovered combo_name (sorted-trait-pair). Same shape
--    as before so v_combo_index_summary keeps working; just opens up
--    the universe of combos that can render on /indices.
--
--    For each listing-day in price_history, we explode the listing's
--    trait list into every ordered pair and emit one row per pair.
-- ----------------------------------------------------------------------------
drop materialized view if exists geck_data.combo_index_daily cascade;
create materialized view geck_data.combo_index_daily as
with listing_traits as (
  select
    ml.id,
    array_agg(distinct trim(t)) filter (
      where length(trim(t)) >= 2 and length(trim(t)) <= 60
    ) as traits
  from geck_data.market_listings ml,
       unnest(string_to_array(ml.cached_traits, ',')) as t
  where ml.cached_traits is not null
    and ml.species in ('crested','unknown')
  group by ml.id
),
exploded as (
  select
    least(lt.traits[i], lt.traits[j]) || ' x ' || greatest(lt.traits[i], lt.traits[j]) as combo_id,
    date_trunc('day', ph.observed_at)::date as day,
    coalesce(ph.price_usd_equivalent, ph.price) as price
  from listing_traits lt
  join geck_data.price_history ph on ph.listing_id = lt.id,
       generate_subscripts(lt.traits, 1) i,
       generate_subscripts(lt.traits, 1) j
  where i < j
    and array_length(lt.traits, 1) >= 2
    and ph.observed_at >= now() - interval '365 days'
    and coalesce(ph.price_usd_equivalent, ph.price) is not null
    and coalesce(ph.price_usd_equivalent, ph.price) > 0
    and coalesce(ph.price_usd_equivalent, ph.price) < 100000
)
select
  combo_id,
  day,
  percentile_cont(0.5) within group (order by price)::numeric as median_price,
  count(*)::bigint as n
from exploded
group by combo_id, day
having count(*) >= 1;

create unique index combo_index_daily_pk
  on geck_data.combo_index_daily (combo_id, day);

create index combo_index_daily_day_idx
  on geck_data.combo_index_daily (day);

create index combo_index_daily_n_idx
  on geck_data.combo_index_daily (n desc);

comment on materialized view geck_data.combo_index_daily is
  'Per-combo (sorted-trait-pair) daily median observed market price over 365 days. Auto-discovered from cached_traits, no hardcoded combo list. Refresh nightly.';

-- ----------------------------------------------------------------------------
-- 4. v_combo_index_summary unchanged structurally; re-emit so the
--    rebuilt MV is wired in.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_combo_index_summary as
with latest as (
  select distinct on (combo_id)
    combo_id, day as latest_day, median_price as current_value, n as latest_n
  from geck_data.combo_index_daily
  order by combo_id, day desc
),
totals as (
  select combo_id, sum(n)::bigint as total_n
  from geck_data.combo_index_daily
  group by combo_id
),
prior_7d as (
  select distinct on (combo_id)
    combo_id, median_price as v7
  from geck_data.combo_index_daily
  where day <= current_date - 7
  order by combo_id, day desc
),
prior_30d as (
  select distinct on (combo_id)
    combo_id, median_price as v30
  from geck_data.combo_index_daily
  where day <= current_date - 30
  order by combo_id, day desc
),
prior_90d as (
  select distinct on (combo_id)
    combo_id, median_price as v90
  from geck_data.combo_index_daily
  where day <= current_date - 90
  order by combo_id, day desc
)
select
  l.combo_id,
  l.latest_day,
  l.current_value,
  l.latest_n,
  coalesce(tot.total_n, l.latest_n) as total_n,
  case when p7.v7 is null or p7.v7 = 0 then null
       else round(((l.current_value - p7.v7) / p7.v7) * 100, 2)
  end as delta_7d,
  case when p30.v30 is null or p30.v30 = 0 then null
       else round(((l.current_value - p30.v30) / p30.v30) * 100, 2)
  end as delta_30d,
  case when p90.v90 is null or p90.v90 = 0 then null
       else round(((l.current_value - p90.v90) / p90.v90) * 100, 2)
  end as delta_90d
from latest l
left join totals  tot on tot.combo_id = l.combo_id
left join prior_7d  p7  on p7.combo_id  = l.combo_id
left join prior_30d p30 on p30.combo_id = l.combo_id
left join prior_90d p90 on p90.combo_id = l.combo_id;

comment on view geck_data.v_combo_index_summary is
  'Per-combo current value, total sample size, and 7/30/90d trailing deltas. Auto-discovered combos.';

-- END SOURCE MIGRATION: 0037_observed_combos_and_traits.sql


-- BEGIN SOURCE MIGRATION: 0038_capture_scraper_rpcs.sql
-- 0038 - Capture the three scraper RPCs that only existed in prod.
--
-- These functions were created by hand in the Supabase SQL editor back
-- in PR #48 (see the note in 0011_canonical_listings.sql) and were
-- never written down as migration files. The Python scrapers call all
-- three every run, so a database rebuilt from this folder would leave
-- the scrapers throwing on missing functions. The definitions below
-- were read verbatim from production via pg_get_functiondef on
-- 2026-07-07; applying this file to prod is a no-op by design
-- (CREATE OR REPLACE with identical bodies).
--
-- What each one does:
--   mark_unseen_listings_inactive(run_id): after a FULL catalog walk,
--     flips is_active off (and stamps sold_at) for every listing not
--     seen since that run started. Only the weekly resync calls this;
--     delta walks and smoke runs skip it so partial walks cannot rot
--     the catalog.
--   listings_needing_detail_scrape(days): the weekly detail scraper's
--     work queue - active listings never detail-scraped or stale.
--   listings_needing_image_download(): the weekly image downloader's
--     work queue - active listings with a CloudFront primary image URL
--     not yet mirrored to Storage.

CREATE OR REPLACE FUNCTION geck_data.mark_unseen_listings_inactive(target_run_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE listings
    SET is_active = FALSE,
        sold_at = NOW()
    WHERE is_active = TRUE
      AND last_seen_at < (
          SELECT started_at FROM scrape_runs WHERE id = target_run_id
      );
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$function$;

CREATE OR REPLACE FUNCTION geck_data.listings_needing_detail_scrape(stale_after_days integer DEFAULT 7)
 RETURNS TABLE(listing_id text, listing_url text, reason text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    SELECT l.listing_id, l.listing_url,
        CASE
            WHEN l.description IS NULL THEN 'never_scraped_details'
            ELSE 'stale'
        END AS reason
    FROM listings l
    WHERE l.is_active = TRUE
      AND (
          l.description IS NULL
          OR l.last_updated_at < NOW() - (stale_after_days || ' days')::INTERVAL
      );
$function$;

CREATE OR REPLACE FUNCTION geck_data.listings_needing_image_download()
 RETURNS TABLE(listing_id text, primary_image_url text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    SELECT l.listing_id, l.primary_image_url
    FROM listings l
    WHERE l.is_active = TRUE
      AND l.primary_image_url IS NOT NULL
      AND l.primary_image_url LIKE 'https://%cloudfront%';
$function$;

-- END SOURCE MIGRATION: 0038_capture_scraper_rpcs.sql


-- BEGIN SOURCE MIGRATION: 0039_backfill_canonical_traits.sql
-- ============================================================================
-- Geck Data 0039: backfill canonical traits from the scraper era.
--
-- Why the trend charts were frozen
-- --------------------------------
-- combo_index_daily (0035/0036/0037) builds per-combo daily medians by
-- splitting market_listings.cached_traits on commas and pairing the tokens.
-- It joins price_history for the observation dates. The Decodo-era dual
-- write (scripts/lib/canonical.py) copied listings.traits into cached_traits
-- verbatim, and MorphMarket delimits with pipes, so:
--
--   * 5,461 canonical rows never received traits at all, and
--   * the rows that did got 'A | B | C', which string_to_array(x, ',')
--     reads as ONE token, so no pair is ever produced.
--
-- Net effect: every price tick between 2026-05-12 and 2026-06-09 (roughly
-- 28,000 observations over four weeks of real market activity) is invisible
-- to /indices, the /market sparklines and the /reports movers. The
-- materialized view was not stale because the nightly refresh was broken;
-- it was starved because nothing in that window had a parseable trait set.
--
-- What this migration does
-- ------------------------
-- 1. Adds _normalize_trait_csv(text): splits on BOTH pipe and comma, drops
--    the non-trait property segments the scrapers leak ('Diet: Meal
--    Replacement', 'Proven breeder: No', ...) exactly like 0018 did for the
--    extension stream, de-duplicates case-insensitively, and re-joins with
--    ', ' so the 0037 comma tokenizer can read it.
-- 2. Backfills cached_traits + norm_traits on canonical rows that have none,
--    reading from the scraper-side listings.traits we already store.
-- 3. Normalizes the handful of canonical rows whose cached_traits is still
--    pipe-delimited, so they stop being a single opaque token.
--
-- Idempotent: step 2 only touches rows that are still empty, step 3 only
-- touches rows that still contain a pipe. Re-running is a no-op. Nothing is
-- deleted; listings.traits and listings_history remain the source of truth.
--
-- After applying, refresh the view so the recovered history shows up:
--   select geck_data.refresh_combo_index_daily();
-- ============================================================================

create or replace function geck_data._normalize_trait_csv(raw text)
returns text
language sql
immutable
as $$
  select nullif(string_agg(tok, ', ' order by ord), '')
  from (
    select distinct on (lower(trim(both ' ' from t.tok)))
           trim(both ' ' from t.tok) as tok,
           t.ord
    from regexp_split_to_table(coalesce(raw, ''), '\s*[|,]\s*')
         with ordinality as t(tok, ord)
    where trim(both ' ' from t.tok) <> ''
      and trim(both ' ' from t.tok) !~*
          '^(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$)'
    order by lower(trim(both ' ' from t.tok)), t.ord
  ) k;
$$;

comment on function geck_data._normalize_trait_csv(text) is
  'Normalize a raw scraper/extension trait string to comma-delimited morph tokens: splits on pipe or comma, strips non-trait property segments, de-dupes case-insensitively. Returns null when nothing survives.';

-- 1. Backfill canonical rows that never received traits from the scraper era.
update geck_data.market_listings ml
set cached_traits = geck_data._normalize_trait_csv(l.traits),
    norm_traits   = lower(replace(geck_data._normalize_trait_csv(l.traits), ', ', ' '))
from geck_data.listings l
where ml.id = 'mm_' || l.listing_id
  and (ml.cached_traits is null or ml.cached_traits = '')
  and l.traits is not null
  and l.traits <> ''
  and geck_data._normalize_trait_csv(l.traits) is not null;

-- 2. Re-delimit any canonical rows still carrying pipe-separated traits.
update geck_data.market_listings
set cached_traits = geck_data._normalize_trait_csv(cached_traits),
    norm_traits   = coalesce(
      nullif(norm_traits, ''),
      lower(replace(geck_data._normalize_trait_csv(cached_traits), ', ', ' '))
    )
where cached_traits like '%|%'
  and geck_data._normalize_trait_csv(cached_traits) is not null;

-- END SOURCE MIGRATION: 0039_backfill_canonical_traits.sql


-- BEGIN SOURCE MIGRATION: 0040_combo_index_health.sql
-- ============================================================================
-- Geck Data 0040: make a starved or no-op index refresh visible.
--
-- The nightly refresh workflow calls refresh_combo_index_daily() and prints
-- "refreshed combo_index_daily" on any 2xx. That is true but not useful: the
-- refresh returns void, so the job reported success for weeks while the view
-- held five days of history. The refresh was working; the view was starved
-- because almost nothing had parseable traits to build a combo from (see
-- 0039). Either failure mode looked identical from CI.
--
-- combo_index_health() closes that gap. It reports the newest day the view
-- holds against the newest day it COULD hold, using the same eligibility
-- rules as the materialized view itself (crested/unknown, two or more
-- trait tokens of 2..60 chars, a sane price). If lag_days > 0 the view is
-- behind its own inputs and the workflow fails loudly instead of printing
-- a green no-op.
--
-- lag_days = 0 on a quiet day is the healthy steady state: with a weekly
-- ingest most days add no new eligible observations, so "did max(day) move"
-- would false-alarm six days a week. Lag against available input is the
-- signal that actually means something is wrong.
-- ============================================================================

create or replace function geck_data.combo_index_health()
returns table (
  mv_max_day          date,
  newest_eligible_day date,
  lag_days            integer,
  mv_rows             bigint,
  mv_combos           bigint
)
language sql
stable
security definer
set search_path = geck_data
as $$
  with mv as (
    select
      max(day)                    as mv_max_day,
      count(*)::bigint            as mv_rows,
      count(distinct combo_id)::bigint as mv_combos
    from geck_data.combo_index_daily
  ),
  -- Listings the view can actually build a combo from: same filters as the
  -- MV's listing_traits CTE (0037), so this cannot drift into false alarms.
  listing_ok as (
    select ml.id
    from geck_data.market_listings ml,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.species in ('crested','unknown')
    group by ml.id
    having count(distinct trim(both ' ' from t.t))
             filter (where length(trim(both ' ' from t.t)) between 2 and 60) >= 2
  ),
  eligible as (
    select max(date_trunc('day', ph.observed_at)::date) as newest_eligible_day
    from geck_data.price_history ph
    join listing_ok lo on lo.id = ph.listing_id
    where ph.observed_at >= now() - interval '365 days'
      and coalesce(ph.price_usd_equivalent, ph.price) is not null
      and coalesce(ph.price_usd_equivalent, ph.price) > 0
      and coalesce(ph.price_usd_equivalent, ph.price) < 100000
  )
  select
    mv.mv_max_day,
    e.newest_eligible_day,
    case
      when e.newest_eligible_day is null or mv.mv_max_day is null then null
      else (e.newest_eligible_day - mv.mv_max_day)::integer
    end as lag_days,
    mv.mv_rows,
    mv.mv_combos
  from mv, eligible e;
$$;

revoke all on function geck_data.combo_index_health() from public;
grant execute on function geck_data.combo_index_health() to anon, authenticated, service_role;

comment on function geck_data.combo_index_health() is
  'Health probe for combo_index_daily: newest day held vs newest day buildable from price_history. lag_days > 0 means the view is behind its inputs (refresh not running, or not reaching this database).';

-- END SOURCE MIGRATION: 0040_combo_index_health.sql


-- BEGIN SOURCE MIGRATION: 0041_fix_trait_property_grouping.sql
-- ============================================================================
-- Geck Data 0041: fix 0039's trait parse. Pipes group, commas list.
--
-- What 0039 got wrong
-- -------------------
-- _normalize_trait_csv() split on pipe and comma at the same time. That
-- destroys the structure the scrapers actually emit:
--
--   Diet: Cricket, Meal Replacement | Proven breeder: No | Harlequin, Partial Pinstripe
--   ^-- property, values comma-listed   ^-- property      ^-- the real traits
--
-- Pipes separate PROPERTIES; commas list values INSIDE one property.
-- Flattening both at once dropped the 'Diet:' head token but kept its
-- values, so 'Cricket', 'Meal Replacement', 'Roach' and 'BSFL' survived as
-- if they were morphs. After 0039 the largest combos on /indices were
-- 'Harlequin x Meal Replacement' (n=159) and 'Meal Replacement x Roach'.
-- That is the same pseudo-trait contamination 0018 cleaned out of the
-- extension stream, reintroduced through the scraper column.
--
-- The fix
-- -------
-- Parse pipe-first: split into property segments, drop any segment whose
-- head is a non-trait key (dropping ALL of that property's values with it),
-- then comma-split only the segments that survive. Rows whose entire trait
-- string was diet/breeder metadata correctly end up with no traits at all.
--
-- Then recompute every canonical row whose scraper source carries such a
-- property segment, which is exactly the set 0039 corrupted. Rows with no
-- surviving morph token are reset to null: "we have no trait data for this
-- listing" is the honest state, and an empty combo is better than a fake one.
--
-- Refresh the view afterwards:
--   select geck_data.refresh_combo_index_daily();
-- ============================================================================

create or replace function geck_data._normalize_trait_csv(raw text)
returns text
language sql
immutable
as $$
  select nullif(string_agg(tok, ', ' order by ord), '')
  from (
    select distinct on (lower(trim(both ' ' from parts.tok)))
           trim(both ' ' from parts.tok) as tok,
           parts.ord
    from (
      -- Property segments first; a dropped segment takes its values with it.
      select s.tok, (t.ord * 1000 + s.ord) as ord
      from regexp_split_to_table(coalesce(raw, ''), '\s*\|\s*')
           with ordinality as t(seg, ord)
      cross join lateral regexp_split_to_table(t.seg, '\s*,\s*')
           with ordinality as s(tok, ord)
      where trim(both ' ' from t.seg) !~*
            '^(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$)'
    ) parts
    where trim(both ' ' from parts.tok) <> ''
    order by lower(trim(both ' ' from parts.tok)), parts.ord
  ) k;
$$;

comment on function geck_data._normalize_trait_csv(text) is
  'Normalize a raw scraper/extension trait string to comma-delimited morph tokens. Pipes separate properties, commas list values within a property: a non-trait property (Diet, Proven breeder, ...) is dropped whole, values included. De-dupes case-insensitively. Returns null when nothing survives.';

-- Recompute the rows 0039 corrupted: any canonical row whose scraper source
-- carries a non-trait property segment. Idempotent, and a no-op once the
-- values already match.
update geck_data.market_listings ml
set cached_traits = geck_data._normalize_trait_csv(l.traits),
    norm_traits   = lower(replace(geck_data._normalize_trait_csv(l.traits), ', ', ' '))
from geck_data.listings l
where ml.id = 'mm_' || l.listing_id
  and l.traits ~* '(^|\|)\s*(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$)'
  and ml.cached_traits is distinct from geck_data._normalize_trait_csv(l.traits);

-- END SOURCE MIGRATION: 0041_fix_trait_property_grouping.sql


-- BEGIN SOURCE MIGRATION: 0042_species_and_group_lots.sql
-- ============================================================================
-- Geck Data 0042: stamp species, and flag multi-animal listings.
--
-- Two data-quality gaps the shared audit called out, both of which make the
-- public numbers describe something other than what they claim.
--
-- 1. species was 'unknown' on 100% of 10,239 canonical rows even though the
--    ingest only accepts crested geckos and 6,715 rows carry
--    scientific_name 'Correlophus ciliatus'. The UI says crested-only while
--    the column says it does not know. Read paths accept ('crested','unknown')
--    so stamping the ones we can prove changes no page's row set; it just
--    stops the column from lying.
--
-- 2. Group lots, packs, pairs, trios and auctions sit in the same medians as
--    single animals. Their price is for the GROUP: production has "Group Of 5"
--    at $100 total and "Wholesale 5/10 Lot Cresties" at $50, which the landing
--    page then advertised as a 90% discount against a single-animal combo
--    median. A per-animal comp cannot include them.
--
--    This adds a flag rather than deleting or hiding anything. Lot listings
--    stay browsable; comp/median/opportunity paths filter them out. The
--    detector is deliberately eager on the title (a false positive costs one
--    listing's worth of comp breadth, a false negative distorts a median) but
--    it never infers from price alone.
-- ============================================================================

alter table geck_data.market_listings
  add column if not exists is_group_lot boolean not null default false;

create index if not exists idx_market_listings_group_lot
  on geck_data.market_listings(is_group_lot) where is_group_lot;

create or replace function geck_data._looks_like_group_lot(title text, is_auction boolean default false)
returns boolean
language sql
immutable
as $$
  select coalesce(
    title ~* '\m(lot|lots|pack|packs|wholesale|bundle|colony|pair|pairs|trio|trios|quad|group)\M'
    or title ~* '\m(x\s*[2-9]|[2-9]\s*x)\M'
    or title ~* '\m(two|three|four|five|six)\s+(pack|lot|group|of)\M'
    or title ~* '\mgroup\s+of\s+[0-9]+\M',
  false);
$$;

comment on function geck_data._looks_like_group_lot(text, boolean) is
  'Heuristic: does this listing title describe more than one animal (lot/pack/pair/trio/group/xN)? Used to keep group pricing out of single-animal comps. Eager by design.';

-- 1. Stamp species where the source proves it.
update geck_data.market_listings ml
set species = 'crested'
from geck_data.listings l
where ml.id = 'mm_' || l.listing_id
  and ml.species is distinct from 'crested'
  and (l.scientific_name ilike '%correlophus%' or l.category ilike '%crested%');

-- 2. Flag multi-animal listings.
update geck_data.market_listings
set is_group_lot = true
where is_group_lot = false
  and geck_data._looks_like_group_lot(title);

comment on column geck_data.market_listings.is_group_lot is
  'True when the title describes multiple animals (lot, pack, pair, trio, group, xN). Such listings price a group, so they must be excluded from per-animal medians, comps and discount calculations.';

-- END SOURCE MIGRATION: 0042_species_and_group_lots.sql


-- BEGIN SOURCE MIGRATION: 0043_server_side_aggregates.sql
-- ============================================================================
-- Geck Data 0043: compute market aggregates in the database.
--
-- The problem this closes
-- -----------------------
-- Public pages asked PostgREST for 5,000 / 10,000 / 20,000 / 30,000 rows and
-- then aggregated in JavaScript. PostgREST caps rows per response, so those
-- pages were computing medians, maturity mixes and deltas over roughly the
-- first thousand rows the planner happened to return, with no ordering
-- guarantee. Raising .limit() cannot fix that; the aggregate has to run in
-- SQL. The audit measured the symptom directly: /trends showed 995 usable
-- price ticks against 45,632 in the table.
--
-- Three correctness rules are baked in here rather than left to callers:
--
--   1. ONE OBSERVATION PER LISTING PER BUCKET. price_history holds 45,632
--      ticks over 36,439 unique listing-days; one listing was re-scraped 14
--      times in a day. Feeding raw ticks to percentile_cont lets a
--      frequently re-seen listing outvote an identical listing seen once.
--      Every cross-sectional median below reduces to the listing's last
--      observation in the bucket first, then takes the median across
--      listings. n_listings (breadth) and n_observations (density) are both
--      returned so a caller can never confuse them again.
--
--   2. USD ONLY. 1,015 ticks have no price_usd_equivalent and the catalog now
--      carries USD, CAD, EUR and GBP. Mixing nominal currencies into one
--      median is silently wrong, so non-USD-equivalent rows are excluded and
--      counted as exclusions instead of being coerced.
--
--   3. NO SILENT ZERO-FILL. Every weekly series returns a row for each week
--      in the window with its observed_days count. A week with no
--      observation comes back with null metrics and observed_days = 0, so the
--      UI can break the line instead of drawing an outage as a crash to zero.
--
-- Group lots (0042) are excluded from per-animal price series.
--
-- All functions are STABLE, security invoker, and read through the existing
-- public-read RLS policies. Timing on production today: the heaviest one
-- plans and executes in ~115ms, well inside the anon role's 3s statement
-- timeout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- One canonical price observation per listing per week, USD equivalent only.
-- Shared substrate for the weekly series below.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_listing_week_price as
select distinct on (ph.listing_id, date_trunc('week', ph.observed_at))
  date_trunc('week', ph.observed_at)::date as week_start,
  ph.observed_at::date                     as observed_day,
  ph.listing_id,
  ph.price_usd_equivalent                  as price
from geck_data.price_history ph
join geck_data.market_listings ml on ml.id = ph.listing_id
where ph.price_usd_equivalent is not null
  and ph.price_usd_equivalent > 0
  and ph.price_usd_equivalent < 100000
  and ml.species in ('crested', 'unknown')
  and not ml.is_group_lot
order by ph.listing_id, date_trunc('week', ph.observed_at), ph.observed_at desc;

comment on view geck_data.v_listing_week_price is
  'Last USD-equivalent ask observed per listing per week, single animals only. The unit of a cross-sectional market median is a listing, not a scrape tick.';

-- ----------------------------------------------------------------------------
-- trends_weekly_prices: median weekly ask with explicit coverage.
-- Returns EVERY week in the window; weeks with no observation come back null.
-- ----------------------------------------------------------------------------
create or replace function geck_data.trends_weekly_prices(window_days integer default 90)
returns table (
  week_start     date,
  median_price   numeric,
  p25_price      numeric,
  p75_price      numeric,
  n_listings     bigint,
  n_observations bigint,
  observed_days  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('week', timezone('UTC', now())
        - make_interval(days => least(greatest(coalesce(window_days, 90), 1), 730)))::date as from_week,
      date_trunc('week', timezone('UTC', now()))::date as to_week
  ),
  weeks as (
    select generate_series(b.from_week, b.to_week, interval '1 week')::date as week_start
    from bounds b
  ),
  obs as (
    select w.week_start, w.listing_id, w.price, w.observed_day
    from geck_data.v_listing_week_price w, bounds b
    where w.week_start >= b.from_week
  ),
  raw as (
    select date_trunc('week', ph.observed_at)::date as week_start,
           count(*)::bigint as n_observations,
           count(distinct ph.observed_at::date)::bigint as observed_days
    from geck_data.price_history ph, bounds b
    where ph.observed_at >= b.from_week
    group by 1
  )
  select
    wk.week_start,
    round(percentile_cont(0.5) within group (order by o.price)::numeric, 2) as median_price,
    round(percentile_cont(0.25) within group (order by o.price)::numeric, 2) as p25_price,
    round(percentile_cont(0.75) within group (order by o.price)::numeric, 2) as p75_price,
    count(o.listing_id)::bigint as n_listings,
    coalesce(max(r.n_observations), 0)::bigint as n_observations,
    coalesce(max(r.observed_days), 0)::bigint as observed_days
  from weeks wk
  left join obs o on o.week_start = wk.week_start
  left join raw r on r.week_start = wk.week_start
  group by wk.week_start
  order by wk.week_start;
$$;

comment on function geck_data.trends_weekly_prices(integer) is
  'Weekly median/p25/p75 USD ask, one observation per listing per week, single animals only. Emits every week in the window; observed_days = 0 marks an outage week whose metrics are null.';

-- ----------------------------------------------------------------------------
-- trends_arrivals_weekly: new listings per week, on the real listing date
-- when MorphMarket gave us one, with coverage so "no arrivals" and
-- "no coverage" stay distinguishable.
-- ----------------------------------------------------------------------------
create or replace function geck_data.trends_arrivals_weekly(window_days integer default 90)
returns table (
  week_start        date,
  arrivals          bigint,
  arrivals_dated    bigint,
  observed_days     bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('week', timezone('UTC', now())
        - make_interval(days => least(greatest(coalesce(window_days, 90), 1), 730)))::date as from_week,
      date_trunc('week', timezone('UTC', now()))::date as to_week
  ),
  weeks as (
    select generate_series(b.from_week, b.to_week, interval '1 week')::date as week_start
    from bounds b
  ),
  arrivals as (
    select date_trunc('week', coalesce(ml.first_listed_at, ml.first_seen_at))::date as week_start,
           count(*)::bigint as arrivals,
           count(*) filter (where ml.first_listed_at is not null)::bigint as arrivals_dated
    from geck_data.market_listings ml, bounds b
    where coalesce(ml.first_listed_at, ml.first_seen_at) >= b.from_week
      and ml.species in ('crested', 'unknown')
    group by 1
  ),
  cover as (
    select date_trunc('week', ph.observed_at)::date as week_start,
           count(distinct ph.observed_at::date)::bigint as observed_days
    from geck_data.price_history ph, bounds b
    where ph.observed_at >= b.from_week
    group by 1
  )
  select
    wk.week_start,
    coalesce(a.arrivals, 0)::bigint,
    coalesce(a.arrivals_dated, 0)::bigint,
    coalesce(c.observed_days, 0)::bigint
  from weeks wk
  left join arrivals a on a.week_start = wk.week_start
  left join cover c on c.week_start = wk.week_start
  order by wk.week_start;
$$;

comment on function geck_data.trends_arrivals_weekly(integer) is
  'New listings per week bucketed on first_listed_at when present (real MorphMarket listing date), else first_seen_at. observed_days lets the UI tell an empty market apart from a dead feed.';

-- ----------------------------------------------------------------------------
-- trends_maturity_mix: windowed maturity distribution.
-- The old bar chart read the whole live catalog while sitting under a
-- windowed header, so June asks were charted as if they were this window.
-- ----------------------------------------------------------------------------
create or replace function geck_data.trends_maturity_mix(window_days integer default 90)
returns table (
  maturity      text,
  n_listings    bigint,
  median_price  numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 90), 1), 730)) as since
  )
  select
    coalesce(nullif(trim(ml.maturity), ''), 'unreported') as maturity,
    count(*)::bigint as n_listings,
    round(percentile_cont(0.5) within group (order by ml.price_usd_equivalent)::numeric, 2) as median_price
  from geck_data.market_listings ml, bounds b
  where coalesce(ml.first_listed_at, ml.first_seen_at) >= b.since
    and ml.species in ('crested', 'unknown')
    and not ml.is_group_lot
    and ml.price_usd_equivalent is not null
    and ml.price_usd_equivalent > 0
    and ml.price_usd_equivalent < 100000
  group by 1
  order by count(*) desc;
$$;

comment on function geck_data.trends_maturity_mix(integer) is
  'Maturity distribution for listings that ARRIVED inside the window, not the whole live catalog. "unreported" is its own bucket because only ~12% of rows carry maturity.';

-- ----------------------------------------------------------------------------
-- market_price_summary: the landing KPIs, split fresh vs stale.
-- The hero used to count 10,158 "live" listings when only 565 had been
-- re-observed in 48h, and took its median over a capped fetch of that mixed
-- population. Fresh and stale are separate populations and are returned as
-- separate numbers so the page cannot blend them again.
-- ----------------------------------------------------------------------------
create or replace function geck_data.market_price_summary(fresh_hours integer default 48)
returns table (
  fresh_listings      bigint,
  stale_listings      bigint,
  fresh_median_ask    numeric,
  fresh_p25_ask       numeric,
  fresh_p75_ask       numeric,
  stale_median_ask    numeric,
  newest_seen_at      timestamptz,
  oldest_stale_seen_at timestamptz,
  sellers             bigint,
  group_lots_excluded bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cutoff as (
    select timezone('UTC', now())
      - make_interval(hours => least(greatest(coalesce(fresh_hours, 48), 1), 8760)) as fresh_since
  ),
  live as (
    select ml.*, (ml.last_seen_at >= c.fresh_since) as is_fresh
    from geck_data.market_listings ml, cutoff c
    where ml.current_status = 'live'
      and ml.species in ('crested', 'unknown')
  ),
  priced as (
    select * from live
    where price_usd_equivalent is not null
      and price_usd_equivalent > 0
      and price_usd_equivalent < 100000
      and not is_group_lot
  )
  select
    (select count(*) from live where is_fresh)::bigint,
    (select count(*) from live where not is_fresh)::bigint,
    (select round(percentile_cont(0.5) within group (order by price_usd_equivalent)::numeric, 2) from priced where is_fresh),
    (select round(percentile_cont(0.25) within group (order by price_usd_equivalent)::numeric, 2) from priced where is_fresh),
    (select round(percentile_cont(0.75) within group (order by price_usd_equivalent)::numeric, 2) from priced where is_fresh),
    (select round(percentile_cont(0.5) within group (order by price_usd_equivalent)::numeric, 2) from priced where not is_fresh),
    (select max(last_seen_at) from live),
    (select min(last_seen_at) from live where not is_fresh),
    (select count(distinct seller_id) from live where seller_id is not null)::bigint,
    (select count(*) from live where is_group_lot)::bigint;
$$;

comment on function geck_data.market_price_summary(integer) is
  'Landing KPIs with fresh and stale live listings kept apart. A median over the blended population describes a market that no longer exists.';

revoke all on function geck_data.trends_weekly_prices(integer) from public;
revoke all on function geck_data.trends_arrivals_weekly(integer) from public;
revoke all on function geck_data.trends_maturity_mix(integer) from public;
revoke all on function geck_data.market_price_summary(integer) from public;
grant execute on function geck_data.trends_weekly_prices(integer) to anon, authenticated, service_role;
grant execute on function geck_data.trends_arrivals_weekly(integer) to anon, authenticated, service_role;
grant execute on function geck_data.trends_maturity_mix(integer) to anon, authenticated, service_role;
grant execute on function geck_data.market_price_summary(integer) to anon, authenticated, service_role;
grant select on geck_data.v_listing_week_price to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0043_server_side_aggregates.sql


-- BEGIN SOURCE MIGRATION: 0044_bounded_index_deltas.sql
-- ============================================================================
-- Geck Data 0044: index deltas that refuse to lie across a gap.
--
-- Two defects in v_combo_index_summary, both of which render missing history
-- as measured stability:
--
-- 1. WRONG ANCHOR. The 7/30/90d priors were selected with
--    `day <= CURRENT_DATE - N`. For a combo whose newest row is months old,
--    its own latest row satisfies that predicate, so the view compared the
--    value against itself and published +0.00%. The audit screenshotted a
--    whole /indices table reading "+0.0%" everywhere, which a visitor reads
--    as a flat market rather than as absent data. Anchor on each combo's
--    own latest_day instead.
--
-- 2. NO BASELINE AGE BOUND. Even anchored correctly, the nearest prior row
--    can sit on the far side of the 78-day ingest outage, so a "7 day change"
--    was really 81 days of change. A baseline is now only accepted when its
--    lag is inside the labeled horizon plus a tolerance
--    (N + max(7, N/2)): 7d accepts 7..14 days, 30d accepts 30..45, 90d
--    accepts 90..135. Outside that the delta is null, and the UI is expected
--    to say "no baseline in window" rather than draw a zero.
--
-- With today's data that is exactly the honest outcome: 7d and 30d go null
-- (nothing was observed 7 or 30 days before the newest observation) while
-- 90d survives, because 2026-05-31 really is 90 days before 2026-08-29 and
-- both ends have real observations.
--
-- A third rule: when the combo's own latest observation is stale (older than
-- 14 days) every delta is null regardless of baseline. A "7 day change"
-- computed between 2026-05-04 and 2026-05-11 is a real May measurement, but
-- publishing it today under a "7d" header tells a visitor the market moved
-- that way this week. 1,774 of 2,473 combos are in that state, and 1,142 of
-- them were printing exactly 0.00%.
--
-- Every existing column is preserved so current callers keep working; the
-- additions (baseline days, lags, observed_days, is_stale) let the UI
-- disclose exactly what each delta is measured against.
-- ============================================================================

create or replace view geck_data.v_combo_index_summary as
with latest as (
  select distinct on (combo_id)
    combo_id,
    day           as latest_day,
    median_price  as current_value,
    n             as latest_n
  from geck_data.combo_index_daily
  order by combo_id, day desc
),
totals as (
  select
    combo_id,
    sum(n)::bigint       as total_n,
    count(*)::bigint     as observed_days,
    min(day)             as first_day
  from geck_data.combo_index_daily
  group by combo_id
)
select
  -- Existing column order is preserved: CREATE OR REPLACE VIEW can only
  -- append columns, and /indices already selects these by name.
  l.combo_id,
  l.latest_day,
  l.current_value,
  l.latest_n,
  coalesce(t.total_n, l.latest_n) as total_n,

  case when l.latest_day < current_date - 14 then null
       when b7.median_price is null or b7.median_price = 0 then null
       else round((l.current_value - b7.median_price) / b7.median_price * 100, 2)
  end as delta_7d,
  case when l.latest_day < current_date - 14 then null
       when b30.median_price is null or b30.median_price = 0 then null
       else round((l.current_value - b30.median_price) / b30.median_price * 100, 2)
  end as delta_30d,
  case when l.latest_day < current_date - 14 then null
       when b90.median_price is null or b90.median_price = 0 then null
       else round((l.current_value - b90.median_price) / b90.median_price * 100, 2)
  end as delta_90d,

  -- Disclosure columns appended below.
  t.observed_days,
  t.first_day,
  (l.latest_day < current_date - 14) as is_stale,
  (current_date - l.latest_day)      as latest_age_days,
  b7.day  as baseline_7d_day,
  b30.day as baseline_30d_day,
  b90.day as baseline_90d_day,
  case when b7.day  is not null then (l.latest_day - b7.day)  end as baseline_7d_lag_days,
  case when b30.day is not null then (l.latest_day - b30.day) end as baseline_30d_lag_days,
  case when b90.day is not null then (l.latest_day - b90.day) end as baseline_90d_lag_days
from latest l
left join totals t on t.combo_id = l.combo_id
-- Baseline = newest row at least N days before THIS combo's latest day, and
-- no older than N + max(7, N/2), so a delta never spans the outage.
left join lateral (
  select c.day, c.median_price
  from geck_data.combo_index_daily c
  where c.combo_id = l.combo_id
    and c.day <= l.latest_day - 7
    and c.day >= l.latest_day - (7 + greatest(7, 7 / 2))
  order by c.day desc
  limit 1
) b7 on true
left join lateral (
  select c.day, c.median_price
  from geck_data.combo_index_daily c
  where c.combo_id = l.combo_id
    and c.day <= l.latest_day - 30
    and c.day >= l.latest_day - (30 + greatest(7, 30 / 2))
  order by c.day desc
  limit 1
) b30 on true
left join lateral (
  select c.day, c.median_price
  from geck_data.combo_index_daily c
  where c.combo_id = l.combo_id
    and c.day <= l.latest_day - 90
    and c.day >= l.latest_day - (90 + greatest(7, 90 / 2))
  order by c.day desc
  limit 1
) b90 on true;

comment on view geck_data.v_combo_index_summary is
  'Per-combo latest value with 7/30/90d deltas anchored on the combo latest_day and bounded by baseline age. A null delta means no baseline inside the labeled horizon, which is not the same as no change. baseline_*_day and baseline_*_lag_days say what each delta was measured against.';

-- END SOURCE MIGRATION: 0044_bounded_index_deltas.sql


-- BEGIN SOURCE MIGRATION: 0045_coverage_and_sold_truth.sql
-- ============================================================================
-- Geck Data 0045: one computed coverage signal, and an honest sold ledger.
--
-- PART 1: market_coverage()
--
-- StaleDataBanner keys off max(last_seen_at). One fresh batch of 565 rows
-- therefore clears a site-wide warning while 9,274 rows have not been
-- re-observed since June. The same 48h rule also breaks the other way under
-- the new weekly ingest: from Wednesday to Monday every week the newest
-- observation is legitimately older than 48h, so a correct feed would raise
-- an alarm five days out of seven. A banner that cries wolf that often
-- trains people to ignore the one outage that matters.
--
-- Coverage, not recency, is the signal that means something: what share of
-- the catalog did the newest complete pass actually re-observe? This returns
-- both, plus the observed-day counts, so the UI can say
-- "Partial coverage: asks 2h, sold 106d" instead of a green dot.
--
-- PART 2: v_sold_reconciled
--
-- Three ledgers disagree by 35x and the public page reads the smallest:
--   listing_status_events sold  92 rows, all 2026-05-11..05-14
--   market_listings sold        81 rows
--   listings.sold_at         2,849 rows, 2026-05-17..06-07
-- The audit is explicit that these must NOT be blindly unioned: the
-- inference methods and price semantics differ. So this view keeps them
-- side by side with an explicit sold_basis, and callers choose.
--
-- It also suppresses the days_to_sell artifact. 84 of the 92 captured events
-- carry days_since_first_seen = 0 because first_seen and the sold event were
-- stamped in the same bootstrap import, which is why /sold advertised a
-- median time-to-sell of 0 days. Where first_seen and sold land within the
-- same hour the duration is not measured, it is an import coincidence, and
-- days_to_sell comes back null.
-- ============================================================================

create or replace function geck_data.market_coverage(fresh_hours integer default 48)
returns table (
  total_live              bigint,
  fresh_live              bigint,
  stale_live              bigint,
  coverage_pct            numeric,
  newest_observation_at   timestamptz,
  observation_age_hours   numeric,
  last_complete_pass_at   timestamptz,
  observed_days_30        bigint,
  observed_days_90        bigint,
  newest_sold_at          timestamptz,
  sold_age_days           numeric,
  captured_sold_events    bigint,
  inferred_sold_records   bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cutoff as (
    select timezone('UTC', now())
      - make_interval(hours => least(greatest(coalesce(fresh_hours, 48), 1), 8760)) as fresh_since
  ),
  live as (
    select ml.last_seen_at, (ml.last_seen_at >= c.fresh_since) as is_fresh
    from geck_data.market_listings ml, cutoff c
    where ml.current_status = 'live'
      and ml.species in ('crested', 'unknown')
  ),
  agg as (
    select
      count(*)::bigint                          as total_live,
      count(*) filter (where is_fresh)::bigint  as fresh_live,
      count(*) filter (where not is_fresh)::bigint as stale_live,
      max(last_seen_at)                         as newest_observation_at
    from live
  ),
  runs as (
    select max(started_at) as last_complete_pass_at
    from geck_data.scrape_runs
    where status = 'success' and scrape_type = 'listings'
  ),
  days as (
    select
      count(distinct ph.observed_at::date) filter (
        where ph.observed_at >= timezone('UTC', now()) - interval '30 days')::bigint as observed_days_30,
      count(distinct ph.observed_at::date) filter (
        where ph.observed_at >= timezone('UTC', now()) - interval '90 days')::bigint as observed_days_90
    from geck_data.price_history ph
    where ph.observed_at >= timezone('UTC', now()) - interval '90 days'
  ),
  sold as (
    select
      (select max(observed_at) from geck_data.listing_status_events where status = 'sold') as newest_event_at,
      (select count(*) from geck_data.listing_status_events where status = 'sold')::bigint as captured_sold_events,
      (select count(*) from geck_data.listings where sold_at is not null)::bigint          as inferred_sold_records,
      (select max(sold_at) from geck_data.listings)                                        as newest_inferred_at
  )
  select
    a.total_live,
    a.fresh_live,
    a.stale_live,
    case when a.total_live = 0 then null
         else round(a.fresh_live::numeric * 100 / a.total_live, 1) end as coverage_pct,
    a.newest_observation_at,
    case when a.newest_observation_at is null then null
         else round(extract(epoch from (timezone('UTC', now()) - a.newest_observation_at)) / 3600.0, 1)
    end as observation_age_hours,
    r.last_complete_pass_at,
    d.observed_days_30,
    d.observed_days_90,
    greatest(s.newest_event_at, s.newest_inferred_at) as newest_sold_at,
    case when greatest(s.newest_event_at, s.newest_inferred_at) is null then null
         else round(extract(epoch from (timezone('UTC', now()) - greatest(s.newest_event_at, s.newest_inferred_at))) / 86400.0, 1)
    end as sold_age_days,
    s.captured_sold_events,
    s.inferred_sold_records
  from agg a, runs r, days d, sold s;
$$;

comment on function geck_data.market_coverage(integer) is
  'Feed health as coverage, not recency: how much of the live catalog the newest pass re-observed, how old the newest observation and newest sale are, and how many days were observed in the last 30/90. Backs the stale banner and the header status so they cannot disagree.';

-- ----------------------------------------------------------------------------
-- v_sold_reconciled: both sold pools, labeled, never silently merged.
-- ----------------------------------------------------------------------------
create or replace view geck_data.v_sold_reconciled as
-- Pool A: sold transitions the pipeline actually observed.
select
  ml.id,
  ml.seller_id,
  ml.title,
  ml.price,
  ml.price_usd_equivalent,
  ml.maturity,
  ml.sex,
  ml.cached_traits,
  ml.first_seen_at,
  lse.observed_at as sold_at,
  'captured_event'::text as sold_basis,
  lse.source as sold_source,
  ml.is_group_lot,
  -- Only a duration we actually watched elapse. Same-hour stamps come from
  -- one import, not from a listing that sold in under an hour.
  case
    when ml.first_seen_at is null then null
    when lse.observed_at - ml.first_seen_at < interval '1 hour' then null
    else round(extract(epoch from (lse.observed_at - ml.first_seen_at)) / 86400.0)::int
  end as days_to_sell
from geck_data.market_listings ml
join geck_data.listing_status_events lse
  on lse.listing_id = ml.id and lse.status = 'sold'
union all
-- Pool B: listings the catalog walk stopped seeing, inferred sold.
select
  ml.id,
  ml.seller_id,
  ml.title,
  ml.price,
  ml.price_usd_equivalent,
  ml.maturity,
  ml.sex,
  ml.cached_traits,
  ml.first_seen_at,
  l.sold_at,
  'inferred_unseen'::text as sold_basis,
  'scraper'::text as sold_source,
  ml.is_group_lot,
  case
    when ml.first_seen_at is null then null
    when l.sold_at - ml.first_seen_at < interval '1 hour' then null
    else round(extract(epoch from (l.sold_at - ml.first_seen_at)) / 86400.0)::int
  end as days_to_sell
from geck_data.listings l
join geck_data.market_listings ml on ml.id = 'mm_' || l.listing_id
where l.sold_at is not null
  and not exists (
    select 1 from geck_data.listing_status_events e
    where e.listing_id = ml.id and e.status = 'sold'
  );

comment on view geck_data.v_sold_reconciled is
  'Both sold pools with explicit provenance. sold_basis = captured_event (the pipeline saw the transition) or inferred_unseen (the catalog walk stopped seeing the listing, so a sale is inferred). Prices are last observed asks in both cases, never negotiated prices. days_to_sell is null when first_seen and sold were stamped in the same import.';

grant select on geck_data.v_sold_reconciled to anon, authenticated, service_role;
revoke all on function geck_data.market_coverage(integer) from public;
grant execute on function geck_data.market_coverage(integer) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0045_coverage_and_sold_truth.sql


-- BEGIN SOURCE MIGRATION: 0046_trait_ontology_and_breadth.sql
-- ============================================================================
-- Geck Data 0046: stop presenting one trait as a two-trait combo.
--
-- 0037 explodes every pair of comma-separated traits on a listing, so the
-- top "combos" on /indices included Extreme Harlequin x Harlequin,
-- Dalmatian x Super Dalmatian and Red x Red Base. Those are not two
-- independent genetic factors that a breeder can pair. They are the same
-- trait at a different expression level, the homozygous form of the same
-- incomplete dominant, an allelic sibling, or two overlapping labels for the
-- same feature. Charting them as combos invents an economic relationship.
--
-- Approach. Rather than hand-enumerating crested gecko genetics (easy to get
-- subtly wrong, and the trait vocabulary keeps growing), the redundancy test
-- is mostly structural:
--
--   1. MODIFIER PREFIXES. Strip a known qualifier from each side and compare.
--      "Super Dalmatian" and "Dalmatian" reduce to the same root, so do
--      "Extreme Harlequin"/"Harlequin", "Partial Pinstripe"/"Pinstripe",
--      "Het Axanthic"/"Axanthic" and "Pos Dalmatian"/"Dalmatian". A het or
--      possible state is a zygosity claim about one locus, not a second
--      trait, so it cannot combo with its own base trait.
--
--   2. AN EXPLICIT RELATION TABLE for pairs the prefix rule cannot see:
--      allelic siblings (Cappuccino / Sable / Frappuccino share a locus) and
--      overlapping labels (Red / Red Base, Pinstripe / Quad-stripe).
--      Seeded conservatively. Only relationships stated with confidence are
--      included; anything doubtful is left out so the site under-claims
--      rather than over-claims. New rows can be added without a migration.
--
-- Nothing is deleted. combo_index_daily keeps every pair it observes; this
-- adds the flag and the breadth counts so read paths can require a real
-- combo with enough independent evidence before charting it.
--
-- Breadth: the audit's release gate asks for minimum unique LISTINGS and
-- unique SELLERS, because one breeder listing the same project twenty times
-- is not twenty data points. v_combo_breadth supplies both. Measured at
-- ~195ms on production, inside the 3s anon statement timeout.
-- ============================================================================

create table if not exists geck_data.trait_relations (
  trait_a   text not null,
  trait_b   text not null,
  relation  text not null,
  note      text,
  primary key (trait_a, trait_b)
);

comment on table geck_data.trait_relations is
  'Pairs of trait labels that must not be treated as an independent two-trait combo. relation: allelic (same locus), overlapping_label (two names for one feature), expression_level (same trait, different degree).';

alter table geck_data.trait_relations enable row level security;

drop policy if exists trait_relations_public_read on geck_data.trait_relations;
create policy trait_relations_public_read on geck_data.trait_relations for select using (true);

insert into geck_data.trait_relations (trait_a, trait_b, relation, note) values
  ('cappuccino', 'sable',        'allelic', 'Cappuccino and Sable are alleles at the same locus'),
  ('cappuccino', 'frappuccino',  'allelic', 'Frappuccino is the Cappuccino/Sable compound, not an independent trait'),
  ('sable',      'frappuccino',  'allelic', 'Frappuccino is the Cappuccino/Sable compound, not an independent trait'),
  ('red',        'red base',     'overlapping_label', 'Base colour label overlaps the colour label'),
  ('pinstripe',  'quad-stripe',  'expression_level', 'Quad-stripe is a pinstriping expression'),
  ('pinstripe',  'quad stripe',  'expression_level', 'Quad-stripe is a pinstriping expression')
on conflict (trait_a, trait_b) do nothing;

-- Reduce a trait label to its root by stripping qualifier prefixes.
create or replace function geck_data._trait_root(label text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both ' ' from
      regexp_replace(
        lower(coalesce(label, '')),
        '^(super\s+extreme|super|extreme|partial|full|het|poss|pos|possible|reduced|high|low)\s+',
        '',
        'g'
      )
    ),
  '');
$$;

comment on function geck_data._trait_root(text) is
  'Trait label with qualifier prefixes (super, extreme, partial, full, het, pos, ...) removed, so expression levels and zygosity states collapse onto the trait they qualify.';

-- Are these two labels really the same trait wearing different words?
create or replace function geck_data._traits_are_redundant(a text, b text)
returns boolean
language sql
stable
as $$
  select case
    when a is null or b is null then false
    when lower(trim(a)) = lower(trim(b)) then true
    when geck_data._trait_root(a) is not null
     and geck_data._trait_root(a) = geck_data._trait_root(b) then true
    else exists (
      select 1 from geck_data.trait_relations r
      where (r.trait_a = lower(trim(a)) and r.trait_b = lower(trim(b)))
         or (r.trait_a = lower(trim(b)) and r.trait_b = lower(trim(a)))
         or (r.trait_a = geck_data._trait_root(a) and r.trait_b = geck_data._trait_root(b))
         or (r.trait_a = geck_data._trait_root(b) and r.trait_b = geck_data._trait_root(a))
    )
  end;
$$;

comment on function geck_data._traits_are_redundant(text, text) is
  'True when two trait labels describe the same underlying trait (same root after stripping qualifiers, or a seeded allelic/overlapping relation). Such a pair is not a combo.';

-- Per-combo evidence breadth: unique listings and unique sellers, plus the
-- redundancy verdict. Single animals only (group lots price a group).
create or replace view geck_data.v_combo_breadth as
with lt as (
  select
    ml.id,
    ml.seller_id,
    array_agg(distinct trim(both ' ' from t.t))
      filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
  from geck_data.market_listings ml,
       lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
  where ml.cached_traits is not null
    and ml.species in ('crested', 'unknown')
    and not ml.is_group_lot
  group by ml.id, ml.seller_id
),
pairs as (
  select
    (least(lt.traits[i.i], lt.traits[j.j]) || ' x ' || greatest(lt.traits[i.i], lt.traits[j.j])) as combo_id,
    least(lt.traits[i.i], lt.traits[j.j])    as trait_a,
    greatest(lt.traits[i.i], lt.traits[j.j]) as trait_b,
    lt.id,
    lt.seller_id
  from lt,
       lateral generate_subscripts(lt.traits, 1) i(i),
       lateral generate_subscripts(lt.traits, 1) j(j)
  where i.i < j.j
    and array_length(lt.traits, 1) >= 2
)
select
  combo_id,
  min(trait_a) as trait_a,
  min(trait_b) as trait_b,
  count(distinct id)::bigint        as n_listings,
  count(distinct seller_id)::bigint as n_sellers,
  geck_data._traits_are_redundant(min(trait_a), min(trait_b)) as is_redundant_pair
from pairs
group by combo_id;

comment on view geck_data.v_combo_breadth is
  'Evidence breadth per observed trait pair: unique listings and unique sellers, single animals only, plus is_redundant_pair for pairs that are really one trait. Read paths should require a real pair and a minimum breadth before charting a combo.';

grant select on geck_data.v_combo_breadth to anon, authenticated, service_role;
grant select on geck_data.trait_relations to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0046_trait_ontology_and_breadth.sql


-- BEGIN SOURCE MIGRATION: 0047_combo_weekly_prices.sql
-- ============================================================================
-- Geck Data 0047: per-combo weekly history that does not depend on what is
-- live today.
--
-- /combo/[slug] built its 26 week price line from the price_history of the
-- first 200 listings that are CURRENTLY live and match the combo, then merged
-- sold prices into the same series. Three problems in one chart:
--
--   * Survivorship. A listing that sold in May is no longer live, so it drops
--     out of the history entirely. The line therefore describes the animals
--     that did NOT sell, which is the opposite of a market history.
--   * Mixed semantics. Asking-price observations and sold prices were summed
--     into one median without distinction.
--   * A silent cap. .slice(0, 200) on the members and .limit(4000) on the
--     ticks bound the answer with no disclosure.
--
-- This computes the series in SQL over every listing that has ever carried
-- both traits, using the one-observation-per-listing-per-week substrate from
-- 0043, and returns unique listing counts so the page can show its own
-- sample size. Asks only: sold prices are a different measurement and belong
-- in their own series.
-- ============================================================================

create or replace function geck_data.combo_weekly_prices(
  p_trait_a   text,
  p_trait_b   text,
  window_days integer default 180
)
returns table (
  week_start    date,
  median_price  numeric,
  n_listings    bigint,
  observed_days bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select date_trunc('week', timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 180), 1), 730)))::date as from_week
  ),
  members as (
    select ml.id
    from geck_data.market_listings ml
    where ml.cached_traits is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and ml.cached_traits ilike '%' || p_trait_a || '%'
      and ml.cached_traits ilike '%' || p_trait_b || '%'
  )
  select
    w.week_start,
    round(percentile_cont(0.5) within group (order by w.price)::numeric, 2) as median_price,
    count(distinct w.listing_id)::bigint as n_listings,
    count(distinct w.observed_day)::bigint as observed_days
  from geck_data.v_listing_week_price w
  join members m on m.id = w.listing_id
  cross join bounds b
  where w.week_start >= b.from_week
  group by w.week_start
  order by w.week_start;
$$;

comment on function geck_data.combo_weekly_prices(text, text, integer) is
  'Weekly median observed ASK for every listing that has carried both traits, live or not, one observation per listing per week, group lots excluded. Sold prices are deliberately not mixed in.';

revoke all on function geck_data.combo_weekly_prices(text, text, integer) from public;
grant execute on function geck_data.combo_weekly_prices(text, text, integer) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0047_combo_weekly_prices.sql


-- BEGIN SOURCE MIGRATION: 0048_sold_price_band.sql
-- ============================================================================
-- Geck Data 0048: give the valuation engine its comps back.
--
-- /whats-it-worth is the closest thing this site has to a product, and it was
-- pricing animals off f_price_band_for_traits, which joins ONLY
-- listing_status_events where status = 'sold'. That is 92 rows, all observed
-- between 2026-05-11 and 2026-05-14. A Lilly White subadult lookup returned a
-- band built from 13 comps, every one of them from four days in May, under a
-- heading that said "recent".
--
-- Meanwhile 2,840 inferred sales from 2026-05-17 to 2026-06-07 sat unused
-- (see 0045). Those are a different kind of evidence: the catalogue walk
-- stopped seeing the listing, so a sale is inferred rather than observed. The
-- audit is explicit that the two pools must not be silently merged, so this
-- returns them together but counts them separately and reports the date range,
-- letting the caller show the basis and decide what to trust.
--
-- Both pools carry the same price caveat, which the UI has to keep saying:
-- the figure is the last asking price observed before the listing went away,
-- not a negotiated sale price. MorphMarket does not publish what changed
-- hands, and no amount of aggregation invents that.
--
-- Group lots are excluded: their price covers several animals.
--
-- The old function is left in place so nothing breaks mid-deploy.
-- ============================================================================

create or replace function geck_data.sold_price_band(
  p_traits          text[],
  p_lookback_days   integer default 180,
  p_include_inferred boolean default true
)
returns table (
  n                bigint,
  n_captured       bigint,
  n_inferred       bigint,
  p10              numeric,
  p25              numeric,
  p50              numeric,
  p75              numeric,
  p90              numeric,
  mean_usd         numeric,
  newest_sold_at   timestamptz,
  oldest_sold_at   timestamptz,
  n_sellers        bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select
      s.price_usd_equivalent as price_usd,
      s.sold_basis,
      s.sold_at,
      s.seller_id
    from geck_data.v_sold_reconciled s
    where s.sold_at >= timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(p_lookback_days, 180), 1), 1825))
      and not s.is_group_lot
      and s.price_usd_equivalent is not null
      and s.price_usd_equivalent > 0
      and s.price_usd_equivalent < 100000
      and (p_include_inferred or s.sold_basis = 'captured_event')
      and (
        p_traits is null
        or cardinality(p_traits) = 0
        or not exists (
          select 1 from unnest(p_traits) t
          where coalesce(s.cached_traits, '') !~* ('(^|[|,;/ ])' || t || '($|[|,;/ ])')
        )
      )
  )
  select
    count(*)::bigint,
    count(*) filter (where sold_basis = 'captured_event')::bigint,
    count(*) filter (where sold_basis = 'inferred_unseen')::bigint,
    round(percentile_cont(0.10) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.25) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.50) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.75) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.90) within group (order by price_usd)::numeric, 2),
    round(avg(price_usd)::numeric, 2),
    max(sold_at),
    min(sold_at),
    count(distinct seller_id)::bigint
  from matched;
$$;

comment on function geck_data.sold_price_band(text[], integer, boolean) is
  'Price band across BOTH sold pools for listings carrying every requested trait. Returns captured and inferred counts separately, plus the date range and seller breadth, so the caller can disclose what the band rests on. Prices are last observed asks, not negotiated sale prices. Group lots excluded.';

revoke all on function geck_data.sold_price_band(text[], integer, boolean) from public;
grant execute on function geck_data.sold_price_band(text[], integer, boolean) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0048_sold_price_band.sql


-- BEGIN SOURCE MIGRATION: 0049_combo_maturity_baselines.sql
-- ============================================================================
-- Geck Data 0049: a price baseline made of the same kind of animal as the
-- listing being measured against it.
--
-- The landing page called a listing an "opportunity" when it sat 25% under its
-- combo's median asking price. That baseline came from v_combo_rollups over a
-- 365 day window, which applies no freshness filter, keeps multi-animal lots
-- in, and pools every age class together. Checked against production, the
-- result was not a discount signal at all: the strongest "deals" on the page
-- were babies and juveniles measured against a median that included adults.
-- A $60 juvenile against a $350 all-ages median is not an 83% discount, it is
-- a young animal priced like a young animal. The real medians separate hard:
-- Baby $190, Juvenile $200, Subadult $350, Adult $350.
--
-- So the baseline is cut per (combo, maturity), and five filters decide
-- whether a cell is allowed to price anything at all:
--
--   fresh      only rows the ingest re-confirmed inside fresh_hours. A stale
--              ask describes a market that may not exist any more, and the
--              listing being judged is fresh by construction.
--   no lots    a wholesale lot's price covers several geckos.
--   no auctions a live auction's price is the current bid, which opens low by
--              design. Left in, auctions are most of the deepest "discounts".
--   breadth    at least 5 fresh asks from at least 3 distinct sellers, so one
--              seller's pricing cannot become the market it is under.
--   distinct   the redundancy test from 0046, so pairs like Extreme Harlequin
--              x Harlequin never set a price. Those two traits are really one
--              trait, and the "combo" is an artefact of the tokenizer.
--
-- The bar is applied here rather than in the caller, for two reasons: a cell
-- that may not price anything is not a baseline, and returning all 1,938 cells
-- put the result one row under PostgREST's response cap, where a silent
-- truncation would have quietly dropped baselines on a growing catalogue.
--
-- The honest cost of all this: of 1,938 (combo, maturity) cells currently in
-- the catalogue, 34 clear the bar. Every other listing gets no baseline and
-- makes no claim, which is the correct outcome for a weekly ingest holding a
-- few hundred freshly confirmed asks.
-- ============================================================================

drop function if exists geck_data.combo_fresh_medians(integer, integer);
-- An earlier shape of this function took only (fresh_hours, window_days).
-- Left in place it would overload the four-argument version below, and a
-- PostgREST call naming just those two arguments resolves by name, so the
-- request would fail as ambiguous rather than pick one.
drop function if exists geck_data.combo_maturity_baselines(integer, integer);

create or replace function geck_data.combo_maturity_baselines(
  fresh_hours integer default 48,
  window_days integer default 365,
  min_fresh integer default 5,
  min_sellers integer default 3
)
returns table (
  combo_id          text,
  trait_a           text,
  trait_b           text,
  maturity          text,
  n_fresh           bigint,
  n_fresh_sellers   bigint,
  median_fresh_ask  numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      timezone('UTC', now())
        - make_interval(hours => least(greatest(coalesce(fresh_hours, 48), 1), 8760)) as fresh_since,
      timezone('UTC', now())
        - make_interval(days => least(greatest(coalesce(window_days, 365), 1), 1825)) as window_since
  ),
  lt as (
    select
      ml.id,
      ml.seller_id,
      ml.price_usd_equivalent as price,
      ml.maturity,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.market_listings ml
    cross join bounds b,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.maturity is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and not coalesce(ml.is_auction, false)
      and ml.current_status = 'live'
      and ml.last_seen_at >= b.fresh_since
      and ml.price_usd_equivalent is not null
      and ml.price_usd_equivalent > 0
      and ml.price_usd_equivalent < 100000
      and coalesce(ml.first_listed_at, ml.first_seen_at) >= b.window_since
    group by ml.id, ml.seller_id, ml.price_usd_equivalent, ml.maturity
  ),
  pairs as (
    select
      (least(lt.traits[i.i], lt.traits[j.j]) || ' x ' || greatest(lt.traits[i.i], lt.traits[j.j])) as combo_id,
      least(lt.traits[i.i], lt.traits[j.j])    as trait_a,
      greatest(lt.traits[i.i], lt.traits[j.j]) as trait_b,
      lt.maturity, lt.id, lt.seller_id, lt.price
    from lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j
      and array_length(lt.traits, 1) >= 2
  )
  select
    combo_id,
    min(trait_a),
    min(trait_b),
    maturity,
    count(*)::bigint,
    count(distinct seller_id)::bigint,
    round(percentile_cont(0.5) within group (order by price)::numeric, 2)
  from pairs
  group by combo_id, maturity
  having count(*) >= greatest(coalesce(min_fresh, 5), 2)
     and count(distinct seller_id) >= greatest(coalesce(min_sellers, 3), 2)
     and not geck_data._traits_are_redundant(min(trait_a), min(trait_b));
$$;

comment on function geck_data.combo_maturity_baselines(integer, integer, integer, integer) is
  'Median asking price per (trait combo, maturity) over freshly re-confirmed live single-animal listings, excluding group lots and auctions. Only cells with real depth are returned: at least min_fresh asks from at least min_sellers distinct sellers, and never a pair whose two traits are redundant with each other.';

revoke all on function geck_data.combo_maturity_baselines(integer, integer, integer, integer) from public;
grant execute on function geck_data.combo_maturity_baselines(integer, integer, integer, integer) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0049_combo_maturity_baselines.sql


-- BEGIN SOURCE MIGRATION: 0050_price_history_unique_observation.sql
-- ============================================================================
-- Geck Data 0050: one observation per listing per instant, enforced.
--
-- price_history is the spine of every timeline on the site, and nothing has
-- ever stopped it holding the same observation twice. Two writers insert into
-- it (the /api/ingest event handlers and the Python backfill), both with a
-- plain INSERT, so a replayed batch or a listingSeen and a priceDropped event
-- carrying the same occurred_at each land a second row. 104 such rows exist
-- today out of 45,632.
--
-- Duplicated observations do not just inflate a row count. Everything that
-- counts observations per day to decide whether a day has coverage, and
-- everything that averages price per listing per bucket, reads a doubled row
-- as two independent confirmations. The reports gate and the combo index both
-- do exactly that.
--
-- Checked before writing this: all 104 duplicate groups are pairs, and zero of
-- them differ in price, price_usd_equivalent, currency, source or usd_rate_used.
-- They are the same observation recorded twice, so collapsing them loses no
-- history. The losing rows are copied to price_history_dupes_archive first
-- anyway, because a delete against a production table should be reversible
-- even when the analysis says it is safe.
-- ============================================================================

-- 1. Keep a copy of every row this migration removes. Retains the original id
--    so a row can be put back exactly as it was.
create table if not exists geck_data.price_history_dupes_archive (
  like geck_data.price_history including defaults,
  archived_at timestamptz not null default timezone('UTC', now()),
  archived_by text not null default 'migration_0050'
);

comment on table geck_data.price_history_dupes_archive is
  'Rows removed from price_history when the (listing_id, observed_at) unique key was introduced. Every archived row had a surviving twin identical in every column but id.';

alter table geck_data.price_history_dupes_archive enable row level security;

-- 2. Copy, then delete, the extra row in each duplicate group. ctid ordering
--    is arbitrary but stable within the statement, and since the rows are
--    identical in every meaningful column it does not matter which survives.
with ranked as (
  select ctid,
         row_number() over (partition by listing_id, observed_at order by ctid) as rn
  from geck_data.price_history
),
doomed as (
  select ctid from ranked where rn > 1
)
insert into geck_data.price_history_dupes_archive
  (id, listing_id, price, price_usd_equivalent, currency, observed_at, source, usd_rate_used)
select ph.id, ph.listing_id, ph.price, ph.price_usd_equivalent, ph.currency,
       ph.observed_at, ph.source, ph.usd_rate_used
from geck_data.price_history ph
join doomed d on d.ctid = ph.ctid;

with ranked as (
  select ctid,
         row_number() over (partition by listing_id, observed_at order by ctid) as rn
  from geck_data.price_history
)
delete from geck_data.price_history ph
using ranked r
where r.ctid = ph.ctid and r.rn > 1;

-- 3. The key itself. From here a repeated observation is a no-op at the
--    database rather than a silent second row, which is what lets both
--    writers use ON CONFLICT instead of hoping they never overlap.
create unique index if not exists price_history_listing_observed_key
  on geck_data.price_history (listing_id, observed_at);

comment on index geck_data.price_history_listing_observed_key is
  'One price observation per listing per instant. Ingest writers rely on this constraint for idempotency: see src/lib/ingest/events.ts.';

-- END SOURCE MIGRATION: 0050_price_history_unique_observation.sql


-- BEGIN SOURCE MIGRATION: 0051_combo_index_movers.sql
-- ============================================================================
-- Geck Data 0051: movers with two endpoints that are actually different.
--
-- Top Movers has been suppressed on the market dashboard since the audit,
-- and the reason was structural rather than a missing feature. It compared
-- v_combo_rollups(w) against v_combo_rollups(2w). The 2w window contains the
-- w window, so every delta was damped toward zero by construction: a combo
-- that doubled inside w was measured against a baseline that already included
-- the doubling. There is no honest number to recover from nested windows.
--
-- combo_index_daily gives two genuinely disjoint endpoints. It holds one
-- median per combo per observed day, so a mover is that combo's index on its
-- latest observed day against its index on a day at least lookback_days
-- earlier. Nothing is nested and nothing is inferred between the two dates.
--
-- Depth is the whole ballgame here. Ungated, the largest "movers" in this
-- data are combos with one listing on the latest day: a single $5,850 ad
-- currently sets the index for six different combos at once, and produces a
-- +5,057% move on a combo whose latest day has two listings. min_n applies to
-- both endpoints for that reason. At min_n = 5 there are 131 real movers; at
-- min_n = 1 there are 625, and the top of that list is noise.
--
-- What this still cannot say: these are asking prices, not sales, and the
-- current index rests on far fewer listings than the baseline does (typically
-- 6 against 40), because the live catalogue shrank between the two dates. The
-- endpoint counts are returned so a caller can show that rather than bury it,
-- and the two dates are returned so nothing has to imply continuous tracking
-- across a gap where the ingest simply was not running.
-- ============================================================================

create or replace function geck_data.combo_index_movers(
  lookback_days integer default 90,
  min_n integer default 5,
  max_rows integer default 20
)
returns table (
  combo_id     text,
  from_day     date,
  to_day       date,
  from_value   numeric,
  to_value     numeric,
  from_n       bigint,
  to_n         bigint,
  pct_change   numeric,
  span_days    integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select least(greatest(coalesce(lookback_days, 90), 1), 1825) as lookback,
           greatest(coalesce(min_n, 5), 1)                       as floor_n,
           least(greatest(coalesce(max_rows, 20), 1), 200)       as cap
  ),
  latest as (
    select combo_id, max(day) as d
    from geck_data.combo_index_daily
    group by combo_id
  ),
  cur as (
    select c.combo_id, c.day, c.median_price, c.n
    from geck_data.combo_index_daily c
    join latest l on l.combo_id = c.combo_id and l.d = c.day
  ),
  -- The newest observed day at or before the lookback horizon, bounded below
  -- so a baseline cannot silently drift years back when the index has a gap.
  -- Half the lookback is the slack, matching the bounding rule the index
  -- summary view uses for its own deltas.
  base as (
    select distinct on (c.combo_id)
      c.combo_id, c.day, c.median_price, c.n
    from geck_data.combo_index_daily c
    join latest l on l.combo_id = c.combo_id
    cross join params p
    where c.day <= l.d - p.lookback
      and c.day >= l.d - (p.lookback + greatest(14, p.lookback / 2))
    order by c.combo_id, c.day desc
  )
  select
    cur.combo_id,
    base.day,
    cur.day,
    base.median_price,
    cur.median_price,
    base.n,
    cur.n,
    round(100.0 * (cur.median_price - base.median_price) / base.median_price, 1),
    (cur.day - base.day)::integer
  from cur
  join base on base.combo_id = cur.combo_id
  cross join params p
  where base.median_price > 0
    and cur.n >= p.floor_n
    and base.n >= p.floor_n
  order by abs((cur.median_price - base.median_price) / base.median_price) desc
  limit (select cap from params);
$$;

comment on function geck_data.combo_index_movers(integer, integer, integer) is
  'Largest moves in the combo asking-price index between two disjoint observed days: each combo latest observed day against the newest day at least lookback_days earlier. Both endpoints must carry at least min_n listings, since ungated the list is dominated by combos priced off a single ad. Returns both dates and both counts so a caller can show what the move rests on.';

revoke all on function geck_data.combo_index_movers(integer, integer, integer) from public;
grant execute on function geck_data.combo_index_movers(integer, integer, integer) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0051_combo_index_movers.sql


-- BEGIN SOURCE MIGRATION: 0052_observation_span.sql
-- ============================================================================
-- Geck Data 0052: how far back the observations actually go.
--
-- The market dashboard's timeframe control offers 30 days, 90 days, 6 months,
-- 12 months and 24 months. price_history starts on 2026-04-22, so as of today
-- there are 129 days of observation. The last three options therefore return
-- byte-identical results: each one means "everything we have", and picking
-- between them changes the label and nothing else.
--
-- That is the same failure the region, age, lineage and source controls were
-- already disabled for. A control that confirms a change it did not make is
-- worse than no control, and the dashboard already states that rule in
-- FilterBar's header comment. The timeframe control was the one that escaped
-- it, because its longest options break silently rather than visibly.
--
-- The span is not a constant to hard-code: it grows by a day every day, and
-- an option that is meaningless today becomes meaningful once the archive is
-- deep enough. So the client asks, and the answer is measured.
--
-- first_listing_at is deliberately separate. Listings go back to 2023-02-25
-- because MorphMarket reports when the animal was first advertised, but a
-- listing's stated age is not evidence of what we watched. Only price_history
-- says what this warehouse actually observed, so that is what bounds a
-- timeframe.
-- ============================================================================

create or replace function geck_data.observation_span()
returns table (
  first_observed_at timestamptz,
  last_observed_at  timestamptz,
  observed_days     integer,
  span_days         integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    min(ph.observed_at),
    max(ph.observed_at),
    count(distinct ph.observed_at::date)::integer,
    case
      when min(ph.observed_at) is null then 0
      else (max(ph.observed_at)::date - min(ph.observed_at)::date)::integer
    end
  from geck_data.price_history ph;
$$;

comment on function geck_data.observation_span() is
  'Oldest and newest price observation, the number of distinct days carrying one, and the calendar span between the ends. Used to disable timeframe options longer than the archive can distinguish. Deliberately reads price_history rather than listing dates: a listing advertised in 2023 is not evidence this warehouse watched anything in 2023.';

revoke all on function geck_data.observation_span() from public;
grant execute on function geck_data.observation_span() to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0052_observation_span.sql


-- BEGIN SOURCE MIGRATION: 0053_combo_rollups_full_universe.sql
-- ============================================================================
-- Geck Data 0053: the combo lists draw from every combo, not a basket of 8.
--
-- v_combo_rollups feeds the three primary combo surfaces: the landing page's
-- "What's hot", the hero's "deepest combo", and the market dashboard's ranked
-- combos table. It resolved each listing's traits through combo_match(), a
-- curated recognizer that only knows the 12 HIGH_VALUE_COMBOS. On production
-- that matched 338 of 9,930 priced live listings (3.4%) into just 8 combos, so
-- 96.6% of the catalogue was invisible to every one of those surfaces while
-- the auto-discovery machinery built for the index (combo_index_daily,
-- combo_maturity_baselines, v_combo_index_summary at 2,473 rows) sat unused
-- beside it.
--
-- This rebuilds the rollup on the same auto-discovery every other combo
-- surface already uses: expand each listing into its 2-trait pairs and group.
-- The return shape is unchanged, so every caller keeps working; it just sees
-- the full universe. The pair id is emitted as "Trait A x Trait B", the exact
-- form combo_index_daily.combo_id uses, so the ranked table's sparklines and
-- the /combo/<slug> links resolve for every combo instead of only the curated
-- dozen.
--
-- Two honesty carry-overs from the rest of the audit:
--   * the sold side reads v_sold_reconciled (migration 0045), the 2,932-row
--     pool, not the 92-row listing_status_events combo_match used, so sold
--     counts and medians reflect the sales we actually have.
--   * redundant pairs (Extreme Harlequin x Harlequin) are dropped via the
--     0046 test, and group lots are excluded on both sides.
--
-- Bounded deliberately: only pairs with real depth are returned, ordered by
-- depth, capped at 600 rows. That keeps the response clear of PostgREST's
-- ~1,000-row cap (where a silent truncation would drop combos as the
-- catalogue grows) while still covering every combo any surface ranks.
-- ============================================================================

create or replace function geck_data.v_combo_rollups(window_days integer)
returns table (
  combo_name        text,
  sold_count        integer,
  live_count        integer,
  median_sold       numeric,
  median_ask        numeric,
  spread_pct        numeric,
  avg_days_to_sell  numeric,
  confidence_score  integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 365), 1), 1825)) as window_since
  ),
  live_lt as (
    select
      ml.id,
      ml.price_usd_equivalent as price,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.market_listings ml,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and ml.current_status = 'live'
      and ml.price_usd_equivalent is not null
      and ml.price_usd_equivalent > 0
      and ml.price_usd_equivalent < 100000
    group by ml.id, ml.price_usd_equivalent
  ),
  live_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.price
    from live_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  live_agg as (
    select ta, tb,
      count(*)::int as live_count,
      percentile_cont(0.5) within group (order by price) as median_ask
    from live_pairs group by ta, tb
  ),
  sold_lt as (
    select
      s.id,
      s.price_usd_equivalent as price,
      s.days_to_sell,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.v_sold_reconciled s
    cross join bounds b,
         lateral unnest(string_to_array(s.cached_traits, ',')) t(t)
    where s.cached_traits is not null
      and not s.is_group_lot
      and s.price_usd_equivalent is not null
      and s.price_usd_equivalent > 0
      and s.price_usd_equivalent < 100000
      and s.sold_at >= b.window_since
    group by s.id, s.price_usd_equivalent, s.days_to_sell
  ),
  sold_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.price, lt.days_to_sell
    from sold_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  sold_agg as (
    select ta, tb,
      count(*)::int as sold_count,
      percentile_cont(0.5) within group (order by price) as median_sold,
      avg(days_to_sell) as avg_days
    from sold_pairs group by ta, tb
  ),
  merged as (
    select
      coalesce(l.ta, s.ta) as ta,
      coalesce(l.tb, s.tb) as tb,
      coalesce(l.live_count, 0) as live_count,
      coalesce(s.sold_count, 0) as sold_count,
      l.median_ask, s.median_sold, s.avg_days
    from live_agg l
    full outer join sold_agg s on s.ta = l.ta and s.tb = l.tb
  )
  select
    (ta || ' x ' || tb) as combo_name,
    sold_count,
    live_count,
    round(median_sold::numeric, 2),
    round(median_ask::numeric, 2),
    case when median_sold is null or median_sold = 0 then null
         else round((((median_ask - median_sold) / median_sold) * 100)::numeric, 1) end,
    round(avg_days::numeric, 1),
    least(99, greatest(1, round((20 + sold_count * 2 + live_count * 0.5)::numeric)))::int
  from merged
  where not geck_data._traits_are_redundant(ta, tb)
    and (live_count >= 2 or sold_count >= 2)
  order by (live_count + sold_count) desc
  limit 600;
$$;

comment on function geck_data.v_combo_rollups(integer) is
  'Per-combo live/sold rollup over auto-discovered trait pairs (every 2-trait combination in the catalogue), not the 12 curated combos combo_match knew. Sold side reads v_sold_reconciled. Redundant pairs and group lots excluded; depth-floored and capped at the 600 deepest combos to stay under the PostgREST response cap.';

revoke all on function geck_data.v_combo_rollups(integer) from public;
grant execute on function geck_data.v_combo_rollups(integer) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0053_combo_rollups_full_universe.sql


-- BEGIN SOURCE MIGRATION: 0054_sold_activity_weekly_reconciled.sql
-- ============================================================================
-- Geck Data 0054: the weekly sold-activity series counts every reconciled
-- sale, not the 92-row captured slice.
--
-- sold_activity_weekly fed the /sold "Cumulative sales" chart from
-- listing_status_events, which holds 92 sold rows from four days in May, so
-- the chart was a single bar and the page had to label it "captured pool
-- only". v_sold_reconciled (migration 0045) carries every sale we have,
-- captured plus inferred, across the whole window. Group lots are excluded
-- because a lot is one transaction covering several animals.
-- ============================================================================

create or replace function geck_data.sold_activity_weekly(p_weeks integer default 26)
returns table (week_start date, sold_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('week', timezone('UTC', now()))
        - make_interval(weeks => least(greatest(coalesce(p_weeks, 26), 1), 104) - 1)
        as starts_at
  )
  select
    date_trunc('week', timezone('UTC', s.sold_at))::date as week_start,
    count(*)::bigint as sold_count
  from geck_data.v_sold_reconciled s
  cross join bounds
  where s.sold_at is not null
    and not s.is_group_lot
    and s.sold_at >= bounds.starts_at at time zone 'UTC'
  group by 1
  order by 1;
$$;

comment on function geck_data.sold_activity_weekly(integer) is
  'Weekly count of reconciled sales (captured + inferred, migration 0045), group lots excluded, over the trailing p_weeks. Replaces the listing_status_events source, which held only the 92-row captured pool from a single week.';

revoke all on function geck_data.sold_activity_weekly(integer) from public;
grant execute on function geck_data.sold_activity_weekly(integer) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0054_sold_activity_weekly_reconciled.sql


-- BEGIN SOURCE MIGRATION: 0055_market_index_asking_basis.sql
-- ============================================================================
-- Geck Data 0055: rebuild the headline Market Index on the asking-price basis
-- its own sub-indices already use, so the hero stops rendering empty.
--
-- v_market_index was built from listing_status_events (status = 'sold'). The
-- warehouse holds ~81 sold listings across four days in May, so once bucketed
-- by ISO week the index collapsed to a single week and fetchMarketIndex, which
-- needs >= 2 points to draw a line and a delta, fell back to its empty state.
-- The hero card on /market was blank while every other panel had data.
--
-- The four anchor sub-indices under this same hero (Lilly White, Axanthic,
-- Harlequin, Cappuccino) are already an asking-price weekly series
-- (v_market_sub_index_weekly, sourced from price_history) with six weeks and
-- thousands of observations behind each point. Define the headline index as
-- the geometric mean of those same four anchor medians per week, normalized to
-- 1,000 at the earliest week in the window. The index and its four component
-- lines now share one basis and one source, and the basket is asking prices,
-- which is what the card's source badge and subtitle now say. When sold volume
-- grows enough to index weekly on its own, this can move back to a sold basis.
-- ============================================================================

create or replace function geck_data.v_market_index(window_days integer)
returns table (week_start timestamp with time zone, value numeric, combos_in integer)
language sql
stable
parallel safe
set search_path to 'public'
as $function$
  with weekly as (
    -- One row per (week, anchor): the weekly median asking price for each of
    -- the four anchor morphs, straight from the sub-index source view.
    select week_start, anchor, median_price, n
    from geck_data.v_market_sub_index_weekly
    where week_start >= (current_date - make_interval(days => window_days))
      and median_price > 0
  ),
  per_week as (
    -- Basket level for the week = geometric mean of the anchor medians. The
    -- geometric mean keeps a single high-priced anchor from dominating the
    -- level the way an arithmetic mean would.
    select
      week_start,
      exp(avg(ln(median_price)))       as geo_avg,
      count(distinct anchor)::int      as combos_in
    from weekly
    group by week_start
  ),
  anchored as (
    -- Index the basket to 1,000 at the earliest week in view.
    select
      week_start,
      combos_in,
      (geo_avg / first_value(geo_avg) over (order by week_start)) * 1000 as value
    from per_week
  )
  select
    week_start::timestamptz,
    round(value::numeric, 1),
    combos_in
  from anchored
  order by week_start;
$function$;

-- END SOURCE MIGRATION: 0055_market_index_asking_basis.sql


-- BEGIN SOURCE MIGRATION: 0056_breeder_concentration.sql
-- ============================================================================
-- Geck Data 0056: seller concentration over the tracked live catalogue, for
-- the Breeders-tab share chart (the full-page form of the preview's market
-- share panel).
--
-- Aggregated server-side rather than by pulling every attributed row to the
-- client, so the counts never hit PostgREST's row cap and the totals stay
-- exact. Returns json (top-N rows plus the scalars the panel labels itself
-- with) in one round trip.
--
-- Honesty note carried by the shape: `total_attributed` is live listings that
-- carry a seller, and `live_total` is all live listings. Seller identity sits
-- on only ~12% of the catalogue today, not because MorphMarket hides it
-- (listings scraped recently attribute at 100%) but because the rest are stale
-- rows last scraped before seller capture worked and never refreshed. Every
-- share is a share of the attributed pool and the widget states that coverage.
-- ============================================================================

create or replace function geck_data.v_breeder_concentration(top_n integer default 12)
returns json
language sql
stable
set search_path to 'public'
as $function$
  with attributed as (
    select seller_id, seller_name
    from geck_data.market_listings
    where current_status = 'live' and seller_id is not null
  ),
  tally as (
    select seller_id, max(seller_name) as name, count(*) as listings
    from attributed
    group by seller_id
  ),
  tot as (
    select
      (select count(*) from attributed) as total_attributed,
      (select count(*) from tally)      as seller_count,
      (select count(*) from geck_data.market_listings where current_status = 'live')
        as live_total
  ),
  ranked as (
    select
      seller_id,
      coalesce(name, seller_id) as name,
      listings,
      round(100.0 * listings / nullif((select total_attributed from tot), 0), 1)
        as share_pct
    from tally
    order by listings desc
  )
  select json_build_object(
    'rows', coalesce(
      (select json_agg(json_build_object(
          'id', seller_id,
          'name', name,
          'listings', listings,
          'sharePct', share_pct))
       from (select * from ranked limit greatest(coalesce(top_n, 12), 1)) r),
      '[]'::json),
    'totalAttributed', (select total_attributed from tot),
    'sellerCount',     (select seller_count from tot),
    'liveTotal',       (select live_total from tot),
    'top10Pct', coalesce(
      (select round(sum(share_pct), 1)
       from (select share_pct from ranked limit 10) t), 0)
  );
$function$;

-- END SOURCE MIGRATION: 0056_breeder_concentration.sql


-- BEGIN SOURCE MIGRATION: 0057_regional_heatmap_full_universe.sql
-- ============================================================================
-- Geck Data 0055: the regional heatmap (and the arbitrage tab it feeds) draw
-- from every combo, and price on asks where sold data is absent.
--
-- v_regional_heatmap had the same blind spot the combo rollup did before 0053:
-- it resolved traits through combo_match, so only the 8 curated combos ever
-- reached the /market Regional heatmap and the Arbitrage tab. And its sold
-- median came from listing_status_events (92 rows from one week), so it was
-- null in almost every cell, which left the ask-vs-region arbitrage view
-- empty because that view keyed off the sold median.
--
-- This rebuilds it on the same auto-discovery every other combo surface now
-- uses (expand each listing into its trait pairs), keeps region_of() as the
-- region source, and pulls the sold median from v_sold_reconciled (migration
-- 0045) so a cell carries a sold figure wherever a reconciled sale in that
-- region exists. The ask median is the live median, which is populated
-- wherever a region is.
--
-- The honest limit is region coverage, not the combos: region_of() resolves
-- only listings whose seller carries a mappable location, which today is about
-- 15% of the catalogue and splits US / CA only. So the heatmap lights two
-- columns, and the arbitrage tab (0056 on the read side switches it to an
-- asking-price basis) surfaces the ~7 combos that appear in both. That is the
-- real picture; it widens on its own as seller-location coverage grows.
--
-- Return shape is unchanged, so fetchRegionalHeatmap and fetchArbitrage keep
-- working. Redundant pairs are dropped, group lots excluded, cells floored at
-- 2 live listings; ~500 rows, clear of the PostgREST cap.
-- ============================================================================

create or replace function geck_data.v_regional_heatmap(window_days integer)
returns table (
  combo_name        text,
  region            text,
  n                 integer,
  median_sold       numeric,
  median_ask        numeric,
  confidence_score  integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 365), 1), 1825)) as window_since
  ),
  live_lt as (
    select
      ml.id,
      geck_data.region_of(sel.seller_location) as region,
      ml.price_usd_equivalent as price,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.market_listings ml
    left join geck_data.market_sellers sel on sel.seller_id = ml.seller_id,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and ml.current_status = 'live'
      and ml.price_usd_equivalent is not null
      and ml.price_usd_equivalent > 0
      and ml.price_usd_equivalent < 100000
      and geck_data.region_of(sel.seller_location) is not null
    group by ml.id, geck_data.region_of(sel.seller_location), ml.price_usd_equivalent
  ),
  live_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.region, lt.price
    from live_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  live_agg as (
    select ta, tb, region,
      count(*)::int as n,
      percentile_cont(0.5) within group (order by price) as median_ask
    from live_pairs group by ta, tb, region
  ),
  sold_lt as (
    select
      s.id,
      geck_data.region_of(sel.seller_location) as region,
      s.price_usd_equivalent as price,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.v_sold_reconciled s
    left join geck_data.market_sellers sel on sel.seller_id = s.seller_id
    cross join bounds b,
         lateral unnest(string_to_array(s.cached_traits, ',')) t(t)
    where s.cached_traits is not null
      and not s.is_group_lot
      and s.price_usd_equivalent is not null
      and s.price_usd_equivalent > 0
      and s.price_usd_equivalent < 100000
      and s.sold_at >= b.window_since
      and geck_data.region_of(sel.seller_location) is not null
    group by s.id, geck_data.region_of(sel.seller_location), s.price_usd_equivalent
  ),
  sold_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.region, lt.price
    from sold_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  sold_agg as (
    select ta, tb, region,
      percentile_cont(0.5) within group (order by price) as median_sold
    from sold_pairs group by ta, tb, region
  )
  select
    (la.ta || ' x ' || la.tb) as combo_name,
    la.region,
    la.n,
    round(sa.median_sold::numeric, 2),
    round(la.median_ask::numeric, 2),
    least(99, greatest(1, round((20 + la.n * 5)::numeric)))::int
  from live_agg la
  left join sold_agg sa
    on sa.ta = la.ta and sa.tb = la.tb and sa.region = la.region
  where not geck_data._traits_are_redundant(la.ta, la.tb)
    and la.n >= 2;
$$;

comment on function geck_data.v_regional_heatmap(integer) is
  'Per (auto-discovered combo, region) live/sold medians. Combos are every trait pair (not the 8 combo_match knew); region is region_of(seller_location), which resolves only the ~15% of listings with a mappable seller location (US/CA today); sold median reads v_sold_reconciled. Redundant pairs and group lots excluded, cells floored at 2 live listings.';

revoke all on function geck_data.v_regional_heatmap(integer) from public;
grant execute on function geck_data.v_regional_heatmap(integer) to anon, authenticated, service_role;

-- END SOURCE MIGRATION: 0057_regional_heatmap_full_universe.sql


-- BEGIN SOURCE MIGRATION: 20260826014017_sold_activity_weekly.sql
-- The public /sold chart only needs 26 weekly counts. Returning raw event
-- history made every crawler hit transfer and serialize up to 20k rows.
create or replace function geck_data.sold_activity_weekly(p_weeks integer default 26)
returns table (
  week_start date,
  sold_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('week', timezone('UTC', now()))
        - make_interval(weeks => least(greatest(coalesce(p_weeks, 26), 1), 104) - 1)
        as starts_at
  )
  select
    date_trunc('week', timezone('UTC', events.observed_at))::date as week_start,
    count(*)::bigint as sold_count
  from geck_data.listing_status_events as events
  cross join bounds
  where events.status = 'sold'
    and events.observed_at >= bounds.starts_at at time zone 'UTC'
  group by 1
  order by 1;
$$;

revoke all on function geck_data.sold_activity_weekly(integer) from public;
grant execute on function geck_data.sold_activity_weekly(integer) to anon, authenticated, service_role;

comment on function geck_data.sold_activity_weekly(integer) is
  'Weekly sold-event counts for the public cumulative-sales chart; bounded to 1-104 weeks.';

-- END SOURCE MIGRATION: 20260826014017_sold_activity_weekly.sql

-- Explicit API privileges. RLS remains enabled on source tables and controls
-- row visibility; these grants only make the schema objects reachable.
grant usage on schema geck_data to anon, authenticated, service_role;
grant select on all tables in schema geck_data to anon;
grant select, insert, update, delete on all tables in schema geck_data to authenticated, service_role;
grant usage, select on all sequences in schema geck_data to authenticated, service_role;
revoke execute on all functions in schema geck_data from public;
grant execute on all functions in schema geck_data to service_role;

-- Normal views must evaluate the underlying tables' RLS as the caller.
do $geck_data_security_invoker$
declare
  view_record record;
begin
  for view_record in
    select table_schema, table_name
    from information_schema.views
    where table_schema = 'geck_data'
  loop
    execute format(
      'alter view %I.%I set (security_invoker = true)',
      view_record.table_schema,
      view_record.table_name
    );
  end loop;
end
$geck_data_security_invoker$;

alter default privileges for role postgres in schema geck_data
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema geck_data
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema geck_data
  revoke execute on functions from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
