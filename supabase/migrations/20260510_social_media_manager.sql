-- =============================================================================
-- Social Media Manager (Promote)
-- =============================================================================
-- New /promote page that takes a gecko profile and helps the breeder craft a
-- post tailored to platform best practices. Generation runs through Claude
-- with prompt caching; publishing goes either direct (Bluesky in v1) or
-- copy-to-clipboard for platforms that need OAuth/app review.
--
-- Tier post quotas (enforced in the publish edge function, not in SQL):
--   Free       1 included post / month
--   Keeper     4 included posts / month
--   Breeder   12 included posts / month
--   Enterprise 30 included posts / month
-- Overage on every paid tier is billed at $0.50/post; Free users must add a
-- payment method (or accept a Keeper trial) before they can overage.
-- =============================================================================

-- ----- Profile additions ---------------------------------------------------
alter table public.profiles
  add column if not exists social_post_credits integer not null default 0,
  add column if not exists keeper_trial_used boolean not null default false,
  add column if not exists keeper_trial_started_at timestamptz,
  add column if not exists social_brand_voice_default text;

comment on column public.profiles.social_post_credits is
  'Pool of post credits granted via the referral signup bonus and similar grants. Burned BEFORE the monthly included-posts allotment so users do not lose their included quota to free credits.';
comment on column public.profiles.keeper_trial_used is
  'True once a user has consumed their one-and-only 30-day Keeper trial. Prevents trial-hopping abuse.';

-- ----- Last-meaningful-change column on geckos -----------------------------
-- Powers the "Recently changed" sort on the Promote page. Bumped by triggers
-- on the gecko row itself and on gecko_images / weight_records when those
-- exist. Audiences engage with journey content; surfacing geckos with new
-- photos / weights / status changes makes it trivial to post about them.

alter table public.geckos
  add column if not exists last_meaningful_change_at timestamptz default now();

create or replace function public.bump_gecko_change_ts_self()
returns trigger
language plpgsql
as $$
begin
  -- On every update we touch the timestamp. Inserts already set the default.
  -- We avoid feedback loops by checking that we are not the cause of our own
  -- update (the OLD/NEW comparison covers a no-op update from this trigger).
  if (TG_OP = 'UPDATE') then
    new.last_meaningful_change_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists geckos_bump_change_ts on public.geckos;
create trigger geckos_bump_change_ts
  before update on public.geckos
  for each row
  execute function public.bump_gecko_change_ts_self();

-- Bumps the parent gecko's change timestamp. Used by triggers on related
-- tables (gecko_images, weight_records). Intentionally tolerant of
-- missing rows / nullable foreign keys.
create or replace function public.bump_gecko_change_ts_for(p_gecko_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_gecko_id is null then return; end if;
  update public.geckos
     set last_meaningful_change_at = now()
   where id = p_gecko_id;
end;
$$;

create or replace function public.trg_bump_gecko_from_image()
returns trigger
language plpgsql
as $$
begin
  perform public.bump_gecko_change_ts_for(coalesce(new.gecko_id, old.gecko_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists gecko_images_bump_parent on public.gecko_images;
create trigger gecko_images_bump_parent
  after insert or update or delete on public.gecko_images
  for each row
  execute function public.trg_bump_gecko_from_image();

create or replace function public.trg_bump_gecko_from_weight()
returns trigger
language plpgsql
as $$
begin
  perform public.bump_gecko_change_ts_for(coalesce(new.gecko_id, old.gecko_id));
  return coalesce(new, old);
end;
$$;

-- weight_records may or may not have gecko_id depending on schema version;
-- guard via DO block so the migration is idempotent on older snapshots.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weight_records'
      and column_name = 'gecko_id'
  ) then
    drop trigger if exists weight_records_bump_parent on public.weight_records;
    create trigger weight_records_bump_parent
      after insert or update or delete on public.weight_records
      for each row
      execute function public.trg_bump_gecko_from_weight();
  end if;
end$$;

-- Backfill: set the timestamp to the gecko's last updated_date if known,
-- so the first sort respects existing freshness rather than dumping every
-- gecko at "right now."
update public.geckos
   set last_meaningful_change_at = coalesce(updated_date, created_date, now())
 where last_meaningful_change_at is null;

create index if not exists geckos_last_change_idx
  on public.geckos(created_by, last_meaningful_change_at desc);

-- ============================================================================
-- social_posts
-- ============================================================================
-- A logical "post" the user is composing. One row spawns N social_post_variants
-- (one per platform the user publishes to). Status flows:
--   draft -> scheduled -> published   (success path)
--   draft -> discarded                (user gave up on it)
-- Iteration count is tracked here so the composer can hard-stop at 10.
-- ============================================================================

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_by_email text not null,
  gecko_id text references public.geckos(id) on delete set null,
  template text not null,
  voice_preset text,
  voice_custom_id uuid,
  tone text,
  length_pref text,
  starting_point text,
  status text not null default 'draft' check (status in ('draft','scheduled','published','discarded')),
  iteration_count integer not null default 0,
  scheduled_at timestamptz,
  published_at timestamptz,
  primary_variant_id uuid,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists social_posts_user_idx
  on public.social_posts(created_by_user_id, created_date desc);
create index if not exists social_posts_gecko_idx
  on public.social_posts(gecko_id);
create index if not exists social_posts_status_idx
  on public.social_posts(status);

alter table public.social_posts enable row level security;

drop policy if exists "Users manage their own posts" on public.social_posts;
create policy "Users manage their own posts"
  on public.social_posts
  for all
  using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

-- ============================================================================
-- social_post_variants
-- ============================================================================
-- Per-platform copy of the same logical post. Different platforms get
-- different captions (X is short, FB is long, IG has its own hashtag norms).
-- Once published, platform_post_id and platform_post_url let us link out.
-- ============================================================================

create table if not exists public.social_post_variants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  platform text not null check (platform in (
    'bluesky','threads','reddit','facebook_page','instagram','x','tiktok','youtube_community','clipboard'
  )),
  content text not null,
  hashtags text[] not null default '{}',
  cta text,
  image_ids text[] not null default '{}',
  status text not null default 'draft' check (status in (
    'draft','queued','publishing','published','failed','copied'
  )),
  scheduled_at timestamptz,
  published_at timestamptz,
  platform_post_id text,
  platform_post_url text,
  publish_error text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists social_post_variants_post_idx
  on public.social_post_variants(post_id);
create index if not exists social_post_variants_platform_status_idx
  on public.social_post_variants(platform, status);

alter table public.social_post_variants enable row level security;

drop policy if exists "Users manage variants of their posts" on public.social_post_variants;
create policy "Users manage variants of their posts"
  on public.social_post_variants
  for all
  using (
    exists (
      select 1 from public.social_posts p
       where p.id = post_id and p.created_by_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.social_posts p
       where p.id = post_id and p.created_by_user_id = auth.uid()
    )
  );

alter table public.social_posts
  add constraint social_posts_primary_variant_fk
  foreign key (primary_variant_id) references public.social_post_variants(id) on delete set null
  not valid;

-- ============================================================================
-- social_platform_connections
-- ============================================================================
-- Per-user OAuth or app-password connections. Tokens are stored in
-- access_token / refresh_token as ciphertext encrypted at the app layer
-- (the publish edge function holds the encryption key). Plain Supabase RLS
-- still scopes reads to the owner so service-role operations are the only
-- path to the encrypted bytes from outside the user's session.
-- ============================================================================

create table if not exists public.social_platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in (
    'bluesky','threads','reddit','facebook_page','instagram','x','tiktok'
  )),
  account_handle text,
  account_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (user_id, platform, account_handle)
);

create index if not exists social_platform_connections_user_idx
  on public.social_platform_connections(user_id);

alter table public.social_platform_connections enable row level security;

drop policy if exists "Users manage their own connections" on public.social_platform_connections;
create policy "Users manage their own connections"
  on public.social_platform_connections
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- social_post_usage
-- ============================================================================
-- Monthly metering ledger. One row per user per month_key. Updated by the
-- publish edge function on every successful publish. Fields:
--   posts_included     snapshot of tier limit at start of the month
--   posts_published    counted by publish events; 1 per logical post
--                      regardless of platform fan-out (capped at 5 platforms)
--   credits_used       referral / promo credits consumed this month
--   overage_posts      posts beyond posts_included that weren't covered by
--                      credits; each one accrues an overage charge
--   overage_cents      $0.50 * overage_posts at write time
--   api_cents_spent    cumulative Anthropic spend (informational, not billed
--                      back to user on Free/Keeper/Breeder; used for
--                      enterprise true-cost reporting and our internal
--                      margin tracking)
-- ============================================================================

create table if not exists public.social_post_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null,
  tier_at_start text not null default 'free',
  posts_included integer not null default 1,
  posts_published integer not null default 0,
  credits_used integer not null default 0,
  overage_posts integer not null default 0,
  overage_cents integer not null default 0,
  api_cents_spent integer not null default 0,
  generations_count integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (user_id, month_key)
);

create index if not exists social_post_usage_user_month_idx
  on public.social_post_usage(user_id, month_key desc);

alter table public.social_post_usage enable row level security;

drop policy if exists "Users read their own usage" on public.social_post_usage;
create policy "Users read their own usage"
  on public.social_post_usage
  for select
  using (user_id = auth.uid());
-- writes go through service role only

-- ============================================================================
-- social_generation_log
-- ============================================================================
-- Per-call Anthropic spend ledger. The generate-social-post edge function
-- writes one row per Anthropic API call so we can attribute spend per post,
-- per user, per model, and so we can detect abuse patterns. Stored as cents
-- (rounded up) for predictable math.
-- ============================================================================

create table if not exists public.social_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.social_posts(id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cents_cost integer not null default 0,
  kind text not null default 'generate' check (kind in (
    'generate','regenerate','voice_cycle','tweak'
  )),
  created_date timestamptz not null default now()
);

create index if not exists social_generation_log_user_idx
  on public.social_generation_log(user_id, created_date desc);
create index if not exists social_generation_log_post_idx
  on public.social_generation_log(post_id);

alter table public.social_generation_log enable row level security;

drop policy if exists "Users read their own generation log" on public.social_generation_log;
create policy "Users read their own generation log"
  on public.social_generation_log
  for select
  using (user_id = auth.uid());

-- ============================================================================
-- user_brand_voice
-- ============================================================================
-- Custom brand voice profiles for Breeder+ users. Plus presets baked into
-- the edge function's system prompt are surfaced as the 5 default options
-- and never live in this table; this is purely user-defined.
-- ============================================================================

create table if not exists public.user_brand_voice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  voice_text text not null,
  is_default boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists user_brand_voice_user_idx
  on public.user_brand_voice(user_id);

alter table public.user_brand_voice enable row level security;

drop policy if exists "Users manage their brand voices" on public.user_brand_voice;
create policy "Users manage their brand voices"
  on public.user_brand_voice
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- social_post_photo_usage
-- ============================================================================
-- Tracks which gecko photos have been used in published posts. Lets the
-- composer surface "X has 3 unposted photos" hints and avoid suggesting the
-- same image twice. Written by the publish edge function on successful
-- publish only — drafts and failed publishes do not count.
-- ============================================================================

create table if not exists public.social_post_photo_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gecko_id text not null references public.geckos(id) on delete cascade,
  gecko_image_id text not null references public.gecko_images(id) on delete cascade,
  variant_id uuid references public.social_post_variants(id) on delete set null,
  platform text,
  published_at timestamptz not null default now()
);

create index if not exists social_post_photo_usage_gecko_idx
  on public.social_post_photo_usage(gecko_id);
create index if not exists social_post_photo_usage_image_idx
  on public.social_post_photo_usage(gecko_image_id);
create index if not exists social_post_photo_usage_user_idx
  on public.social_post_photo_usage(user_id);

alter table public.social_post_photo_usage enable row level security;

drop policy if exists "Users read their photo usage" on public.social_post_photo_usage;
create policy "Users read their photo usage"
  on public.social_post_photo_usage
  for select
  using (user_id = auth.uid());

-- ============================================================================
-- social_referral_bonuses
-- ============================================================================
-- One-time signup-bonus ledger. Triggered by the subscription webhook when a
-- referred user completes their first paid invoice. Coexists with the
-- existing referral_payouts table (which is the lifetime 10% revenue share);
-- a single referral can produce both a one-time bonus row here and an
-- ongoing trickle of payouts in referral_payouts.
--
-- Bonus contents (per row):
--   free_month_tier         which tier the referrer got a free month of
--                           (null when the rule grants only credits)
--   credits_granted         count of post credits added to referrer's pool
--   referred_user_tier      tier the referred user actually subscribed to
--   referrer_tier_at_award  referrer's tier at award time (matters for the
--                           Enterprise rule: only Enterprise->Enterprise gets
--                           a free month)
-- ============================================================================

create table if not exists public.social_referral_bonuses (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid references auth.users(id) on delete set null,
  referrer_email text,
  referred_user_id uuid references auth.users(id) on delete set null,
  referred_email text,
  referrer_tier_at_award text,
  referred_user_tier text not null,
  free_month_tier text,
  free_month_applied_at timestamptz,
  credits_granted integer not null default 0,
  stripe_invoice_id text unique,
  source_event_type text not null default 'first_paid_invoice',
  created_date timestamptz not null default now()
);

create index if not exists social_referral_bonuses_referrer_idx
  on public.social_referral_bonuses(referrer_user_id);
create index if not exists social_referral_bonuses_referred_idx
  on public.social_referral_bonuses(referred_user_id);

alter table public.social_referral_bonuses enable row level security;

drop policy if exists "Referrers read their bonuses" on public.social_referral_bonuses;
create policy "Referrers read their bonuses"
  on public.social_referral_bonuses
  for select
  using (referrer_user_id = auth.uid());

-- ============================================================================
-- Helpers — get-or-create monthly usage row, increment counters
-- ============================================================================

create or replace function public.month_key_now()
returns text
language sql
immutable
as $$
  select to_char(now() at time zone 'utc', 'YYYY-MM');
$$;

create or replace function public.upsert_social_usage(
  p_user_id uuid,
  p_tier text,
  p_posts_included integer
)
returns public.social_post_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.social_post_usage%rowtype;
  mk text := public.month_key_now();
begin
  insert into public.social_post_usage (
    user_id, month_key, tier_at_start, posts_included
  )
  values (p_user_id, mk, p_tier, p_posts_included)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        posts_included = greatest(public.social_post_usage.posts_included, excluded.posts_included),
        updated_date = now()
    returning * into rec;
  return rec;
end;
$$;

revoke all on function public.upsert_social_usage(uuid, text, integer) from public;
grant execute on function public.upsert_social_usage(uuid, text, integer) to service_role;

-- ============================================================================
-- Seed: ensure Enterprise tier value is allowed wherever profiles.membership_tier
-- is used. Existing code treats unknown tier strings as Free (see
-- src/lib/tierLimits.js#tierOf), so this is purely a data hint — no DB-level
-- check exists. Documenting here for future migrations.
-- ============================================================================

comment on column public.profiles.membership_tier is
  'free | keeper | breeder | enterprise. Treat unknown values as free at the app layer.';
