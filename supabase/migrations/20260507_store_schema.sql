-- =============================================================================
-- Store schema — supplies, gifts, merch, affiliate redirects, unified cart
-- =============================================================================
-- Backbone for the new Manage > Supplies tab. Designed around four
-- fulfillment modes so a single catalog handles in-house inventory,
-- print-on-demand, wholesale dropship, and affiliate redirects:
--
--   direct_self        — we hold inventory and ship (private label, branded)
--   direct_pod         — Printful/Printify; we API-trigger production on order
--   dropship_wholesale — we re-order on a wholesale account (Pangea, Repashy,
--                        Lugarti, BPZ, Reptile Basics) once approved
--   affiliate_redirect — we don't take payment; outbound link, commission only
--                        (Amazon Associates, Chewy/Partnerize, NEHERP, MistKing)
--
-- Cart-eligible modes: direct_self, direct_pod, dropship_wholesale.
-- Affiliate-redirect items are NEVER added to the cart; they're rendered
-- with a "Buy at <vendor>" button that fires store_affiliate_clicks and
-- 302s to the vendor URL with our partner tag.
--
-- All money is stored in cents (bigint) in USD. Tables are public.* with
-- RLS; service role (used by edge functions) bypasses RLS for re-pricing,
-- order finalization, and affiliate click logging.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.store_fulfillment_mode as enum (
    'direct_self', 'direct_pod', 'dropship_wholesale', 'affiliate_redirect'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_pricing_constraint as enum ('none', 'map');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_shipping_class as enum (
    'standard', 'oversized', 'live_animal', 'live_insect', 'digital'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_order_status as enum (
    'pending', 'paid', 'processing', 'shipped', 'delivered',
    'refunded', 'partial_refund', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_fulfillment_status as enum (
    'pending', 'processing', 'shipped', 'delivered', 'refunded', 'cancelled'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- store_vendors
-- -----------------------------------------------------------------------------
-- Geck Inspect itself is a vendor (vendor of record for direct_self / pod).
-- Every other vendor is either a wholesale supplier or an affiliate program.
-- -----------------------------------------------------------------------------
create table if not exists public.store_vendors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  homepage_url text,
  logo_url text,
  affiliate_program text,                    -- 'amazon_associates' | 'chewy_partnerize' | 'pangea_uppromote' | etc.
  affiliate_default_tag text,                -- partner tag we append to outbound URLs (rotatable)
  affiliate_disclosure text,                 -- per-vendor extra disclosure text if needed
  notes text,
  is_active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- store_categories — taxonomy + URL slugs
-- -----------------------------------------------------------------------------
create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parent_id uuid references public.store_categories(id) on delete set null,
  display_order integer not null default 100,
  is_gift_category boolean not null default false,  -- true for gifts/* sub-pages
  hero_image_url text,
  seo_title text,
  seo_description text,
  -- Long-form copy rendered above and below the product grid for SEO.
  -- Split into two so we can put the punchy intro above the products and
  -- the deep-dive content below where it doesn't push fold above.
  seo_intro_md text,
  seo_outro_md text,
  is_active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists store_categories_parent_idx on public.store_categories(parent_id);
create index if not exists store_categories_gift_idx on public.store_categories(is_gift_category) where is_gift_category;

-- -----------------------------------------------------------------------------
-- store_products — master catalog
-- -----------------------------------------------------------------------------
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  long_description_md text,                  -- markdown for PDP body
  vendor_id uuid not null references public.store_vendors(id) on delete restrict,
  category_id uuid references public.store_categories(id) on delete set null,

  fulfillment_mode public.store_fulfillment_mode not null,
  shipping_class public.store_shipping_class not null default 'standard',
  status public.store_product_status not null default 'draft',

  -- Pricing (cents, USD). our_price_cents is what we charge customers.
  -- our_cost_cents is COGS (POD cost, wholesale cost). compare_at is
  -- used for "was $X" strikethrough display only.
  our_price_cents bigint check (our_price_cents is null or our_price_cents >= 0),
  our_cost_cents bigint check (our_cost_cents is null or our_cost_cents >= 0),
  compare_at_price_cents bigint check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  pricing_constraint public.store_pricing_constraint not null default 'none',
  map_floor_cents bigint,                    -- minimum-advertised-price floor when pricing_constraint='map'

  -- Vendor-specific identifiers.
  vendor_sku text,
  vendor_product_url text,                   -- live URL for affiliate items; canonical source for shopify-sync
  vendor_extra jsonb,                        -- mode-specific blob (printful_variant_id, shopify_variant_id, etc.)

  -- Inventory. inventory_tracked=false means we never block "out of stock"
  -- (pod, affiliate). inventory_count is only meaningful when tracked.
  inventory_tracked boolean not null default false,
  inventory_count integer not null default 0,

  -- Display & search
  images jsonb not null default '[]'::jsonb, -- [{url, alt, is_primary}]
  attributes jsonb not null default '{}'::jsonb, -- size, color, weight, etc.
  lifecycle_stage_tags text[] not null default '{}',  -- hatchling | juvenile | sub_adult | adult | breeder | gravid_female
  gift_friendly boolean not null default false,
  price_tier text check (price_tier is null or price_tier in (
    'under_15', 'under_25', 'under_50', 'under_100', 'over_100'
  )),
  gift_audience text[] not null default '{}', -- new_keeper | breeder | kid | partner_of_keeper

  -- Search vector for Postgres FTS. Maintained by trigger below.
  search_vector tsvector,

  -- Metadata
  is_featured boolean not null default false,
  weight_grams integer,
  free_shipping_eligible boolean not null default true,
  ships_only_to_us boolean not null default true,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists store_products_status_idx on public.store_products(status);
create index if not exists store_products_category_idx on public.store_products(category_id);
create index if not exists store_products_vendor_idx on public.store_products(vendor_id);
create index if not exists store_products_fulfillment_idx on public.store_products(fulfillment_mode);
create index if not exists store_products_gift_idx on public.store_products(gift_friendly) where gift_friendly;
create index if not exists store_products_search_idx on public.store_products using gin(search_vector);
create index if not exists store_products_lifecycle_idx on public.store_products using gin(lifecycle_stage_tags);
create index if not exists store_products_audience_idx on public.store_products using gin(gift_audience);

create or replace function public.store_products_update_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
      setweight(to_tsvector('english', coalesce(new.name, '')), 'A')
   || setweight(to_tsvector('english', coalesce(new.short_description, '')), 'B')
   || setweight(to_tsvector('english', coalesce(new.long_description_md, '')), 'C');
  new.updated_date := now();
  return new;
end;
$$;

drop trigger if exists store_products_search_trg on public.store_products;
create trigger store_products_search_trg
  before insert or update on public.store_products
  for each row execute function public.store_products_update_search_vector();

-- -----------------------------------------------------------------------------
-- store_carts + store_cart_items
-- -----------------------------------------------------------------------------
-- Carts are persistent and survive logout/login. Guest carts use a
-- session_token (UUID stored in localStorage). On login we merge the
-- guest cart into the user cart (see store-cart-merge edge function).
-- -----------------------------------------------------------------------------
create table if not exists public.store_carts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  session_token text unique,                 -- non-null for guest carts
  status text not null default 'open' check (status in ('open', 'converted', 'abandoned')),
  promo_code text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  expires_at timestamptz,
  -- Each cart is owned by exactly one of: a user or a session_token.
  constraint cart_owner_xor check (
    (owner_user_id is not null and session_token is null) or
    (owner_user_id is null and session_token is not null)
  )
);

create index if not exists store_carts_user_idx on public.store_carts(owner_user_id);
create index if not exists store_carts_session_idx on public.store_carts(session_token);
create index if not exists store_carts_status_idx on public.store_carts(status);

create table if not exists public.store_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.store_carts(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  -- Snapshot at add-to-cart time. Server re-prices at checkout for safety.
  unit_price_cents_snapshot bigint not null check (unit_price_cents_snapshot >= 0),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index if not exists store_cart_items_cart_idx on public.store_cart_items(cart_id);

-- -----------------------------------------------------------------------------
-- store_orders + store_order_items + store_fulfillments
-- -----------------------------------------------------------------------------
-- One order per Stripe Checkout Session. Order items mirror cart items at
-- payment time; pricing is locked here so refunds and history are honest.
-- Fulfillments are separate from order_items because one item can ship in
-- pieces (e.g., POD ships separately from dropship in the same order).
-- -----------------------------------------------------------------------------
create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,         -- human-readable: GI-{YYMMDD}-{seq}
  owner_user_id uuid references auth.users(id) on delete set null,
  customer_email text not null,              -- captured from Stripe Checkout
  customer_name text,
  status public.store_order_status not null default 'pending',

  -- Stripe identifiers
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,

  -- Money snapshots
  subtotal_cents bigint not null default 0,
  shipping_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  currency text not null default 'usd',

  -- Loyalty perk on this order (computed at checkout, fulfilled by admin)
  loyalty_cgd_sample_added boolean not null default false,

  -- Ship-to address (denormalized; Stripe captures this at checkout)
  ship_to jsonb,                             -- {name, line1, line2, city, state, postal_code, country}

  -- Trial-grant on this order (guest checkout flow)
  signup_grant_id uuid,                      -- FK added below after signup_grants table

  promo_code text,
  notes text,
  created_date timestamptz not null default now(),
  paid_at timestamptz,
  updated_date timestamptz not null default now()
);

create index if not exists store_orders_user_idx on public.store_orders(owner_user_id);
create index if not exists store_orders_email_idx on public.store_orders(customer_email);
create index if not exists store_orders_status_idx on public.store_orders(status);
create index if not exists store_orders_stripe_idx on public.store_orders(stripe_checkout_session_id);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete restrict,
  vendor_id uuid not null references public.store_vendors(id) on delete restrict,
  fulfillment_mode public.store_fulfillment_mode not null,
  product_name_snapshot text not null,
  vendor_sku_snapshot text,
  quantity integer not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  fulfillment_status public.store_fulfillment_status not null default 'pending',
  vendor_extra_snapshot jsonb,               -- printful variant id, etc., locked at order
  created_date timestamptz not null default now()
);

create index if not exists store_order_items_order_idx on public.store_order_items(order_id);
create index if not exists store_order_items_status_idx on public.store_order_items(fulfillment_status);

create table if not exists public.store_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  order_item_id uuid not null references public.store_order_items(id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  external_order_id text,                    -- Printful order id, etc.
  external_payload jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists store_fulfillments_order_idx on public.store_fulfillments(order_id);

-- -----------------------------------------------------------------------------
-- store_affiliate_clicks — outbound click attribution
-- -----------------------------------------------------------------------------
create table if not exists public.store_affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.store_products(id) on delete set null,
  vendor_id uuid references public.store_vendors(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  session_token text,
  source_path text,                          -- in-app path the click came from
  user_agent text,
  destination_url text not null,
  created_date timestamptz not null default now()
);

create index if not exists store_affiliate_clicks_product_idx on public.store_affiliate_clicks(product_id);
create index if not exists store_affiliate_clicks_vendor_idx on public.store_affiliate_clicks(vendor_id);
create index if not exists store_affiliate_clicks_user_idx on public.store_affiliate_clicks(user_id);
create index if not exists store_affiliate_clicks_created_idx on public.store_affiliate_clicks(created_date);

-- -----------------------------------------------------------------------------
-- store_signup_grants — trial-grant tokens issued in receipts
-- -----------------------------------------------------------------------------
-- Guest checkouts emit a single-use token. The receipt email links to
-- AuthPortal with ?grant=<token>; on signup, we atomically apply the
-- granted membership tier for the granted duration. Tokens expire at
-- expires_at; redemption marks redeemed_at + redeemed_by_user_id.
--
-- Anti-fraud: one active grant per email and per shipping address; min
-- order amount enforced at issuance time.
-- -----------------------------------------------------------------------------
create table if not exists public.store_signup_grants (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                -- urlsafe random, ~32 bytes
  source_order_id uuid references public.store_orders(id) on delete cascade,
  granted_email text not null,
  granted_tier text not null default 'keeper',
  granted_duration_days integer not null default 90,
  ship_to_postal_hash text,                  -- hash of ship_to country+postal for dedup
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_user_id uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_date timestamptz not null default now()
);

create index if not exists store_signup_grants_token_idx on public.store_signup_grants(token);
create index if not exists store_signup_grants_email_idx on public.store_signup_grants(granted_email);

-- Wire the FK from store_orders.signup_grant_id now that the table exists.
do $$ begin
  alter table public.store_orders
    add constraint store_orders_signup_grant_fk
    foreign key (signup_grant_id) references public.store_signup_grants(id)
    on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- store_promo_codes
-- -----------------------------------------------------------------------------
create table if not exists public.store_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  kind text not null check (kind in ('percent_off', 'amount_off', 'free_shipping')),
  amount_cents bigint,                       -- when kind='amount_off'
  percent integer check (percent is null or (percent between 1 and 100)),
  min_subtotal_cents bigint not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  redemptions integer not null default 0,
  per_user_limit integer not null default 1,
  is_active boolean not null default true,
  created_date timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.store_vendors enable row level security;
alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.store_carts enable row level security;
alter table public.store_cart_items enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_fulfillments enable row level security;
alter table public.store_affiliate_clicks enable row level security;
alter table public.store_signup_grants enable row level security;
alter table public.store_promo_codes enable row level security;

-- -- Anon read on the catalog -------------------------------------------------
drop policy if exists "Active vendors readable by anyone" on public.store_vendors;
create policy "Active vendors readable by anyone"
  on public.store_vendors for select using (is_active);

drop policy if exists "Active categories readable by anyone" on public.store_categories;
create policy "Active categories readable by anyone"
  on public.store_categories for select using (is_active);

drop policy if exists "Active products readable by anyone" on public.store_products;
create policy "Active products readable by anyone"
  on public.store_products for select using (status = 'active');

drop policy if exists "Active promo codes readable by anyone" on public.store_promo_codes;
create policy "Active promo codes readable by anyone"
  on public.store_promo_codes for select using (
    is_active and (starts_at is null or starts_at <= now())
              and (ends_at is null or ends_at >= now())
  );

-- -- Admin write on the catalog -----------------------------------------------
drop policy if exists "Admins write vendors" on public.store_vendors;
create policy "Admins write vendors" on public.store_vendors for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

drop policy if exists "Admins write categories" on public.store_categories;
create policy "Admins write categories" on public.store_categories for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

drop policy if exists "Admins write products" on public.store_products;
create policy "Admins write products" on public.store_products for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

drop policy if exists "Admins write promo codes" on public.store_promo_codes;
create policy "Admins write promo codes" on public.store_promo_codes for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

-- -- User cart RLS -----------------------------------------------------------
-- Authenticated users read/write their own cart only. Guest carts go through
-- the store-cart edge function with service role; no anon RLS path needed.
drop policy if exists "Users manage own cart" on public.store_carts;
create policy "Users manage own cart" on public.store_carts for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Users manage own cart items" on public.store_cart_items;
create policy "Users manage own cart items" on public.store_cart_items for all
  using (
    cart_id in (select id from public.store_carts where owner_user_id = auth.uid())
  )
  with check (
    cart_id in (select id from public.store_carts where owner_user_id = auth.uid())
  );

-- -- Orders RLS --------------------------------------------------------------
-- Owners read their own orders and items. Writes happen server-side only.
drop policy if exists "Users read own orders" on public.store_orders;
create policy "Users read own orders" on public.store_orders for select
  using (
    owner_user_id = auth.uid()
    or customer_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "Admins read all orders" on public.store_orders;
create policy "Admins read all orders" on public.store_orders for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

drop policy if exists "Admins write orders" on public.store_orders;
create policy "Admins write orders" on public.store_orders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

drop policy if exists "Users read own order items" on public.store_order_items;
create policy "Users read own order items" on public.store_order_items for select
  using (
    order_id in (
      select id from public.store_orders
      where owner_user_id = auth.uid() or customer_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Admins read all order items" on public.store_order_items;
create policy "Admins read all order items" on public.store_order_items for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

drop policy if exists "Users read own fulfillments" on public.store_fulfillments;
create policy "Users read own fulfillments" on public.store_fulfillments for select
  using (
    order_id in (
      select id from public.store_orders
      where owner_user_id = auth.uid() or customer_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Admins manage fulfillments" on public.store_fulfillments;
create policy "Admins manage fulfillments" on public.store_fulfillments for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

-- -- Affiliate clicks: anon insert, admin read ------------------------------
drop policy if exists "Anyone logs affiliate clicks" on public.store_affiliate_clicks;
create policy "Anyone logs affiliate clicks" on public.store_affiliate_clicks for insert
  with check (true);

drop policy if exists "Admins read affiliate clicks" on public.store_affiliate_clicks;
create policy "Admins read affiliate clicks" on public.store_affiliate_clicks for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

-- -- Signup grants: server-managed; user can read by token only (via fn) ----
-- We do NOT expose direct row reads to anon — token redemption goes through
-- a SECURITY DEFINER function so the token is never returned to the client.
drop policy if exists "Admins read signup grants" on public.store_signup_grants;
create policy "Admins read signup grants" on public.store_signup_grants for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

-- =============================================================================
-- Seed reference data
-- =============================================================================
-- Vendors
insert into public.store_vendors (slug, name, homepage_url, affiliate_program)
values
  ('geck-inspect', 'Geck Inspect', 'https://geckinspect.com', null),
  ('printful', 'Printful', 'https://www.printful.com', null),
  ('printify', 'Printify', 'https://printify.com', null),
  ('amazon', 'Amazon', 'https://www.amazon.com', 'amazon_associates'),
  ('chewy', 'Chewy', 'https://www.chewy.com', 'chewy_partnerize'),
  ('pangea-reptile', 'Pangea Reptile', 'https://www.pangeareptile.com', 'pangea_uppromote'),
  ('zen-habitats', 'Zen Habitats', 'https://www.zenhabitats.com', null),
  ('custom-reptile-habitats', 'Custom Reptile Habitats', 'https://customreptilehabitats.com', null),
  ('the-bio-dude', 'The Bio Dude', 'https://www.thebiodude.com', null),
  ('joshs-frogs', 'Josh''s Frogs', 'https://www.joshsfrogs.com', null),
  ('dubia-com', 'Dubia.com', 'https://dubiaroaches.com', null),
  ('mistking', 'MistKing', 'https://www.mistking.com', null),
  ('repashy', 'Repashy', 'https://www.store.repashy.com', null),
  ('reptile-basics', 'Reptile Basics', 'https://www.reptilebasics.com', null),
  ('inkbird', 'Inkbird', 'https://www.inkbird.com', null)
on conflict (slug) do nothing;

-- Top-level categories
insert into public.store_categories (slug, name, description, display_order, is_gift_category)
values
  ('apparel',         'Apparel',                'T-shirts, hoodies, hats — original Geck Inspect designs.', 10,  false),
  ('accessories',     'Accessories',            'Stickers, mugs, pins, and small gear.',                    20,  false),
  ('enclosures',      'Enclosures',             'Glass and PVC habitats from yearling tubs to adult builds.', 30,  false),
  ('diet',            'Diet',                   'Crested gecko diet (CGD) from the brands we trust.',        40,  false),
  ('feeders',         'Live & freeze-dried feeders','Crickets, BSFL, dubia, hornworms.',                       50,  false),
  ('substrate',       'Substrate & bioactive',  'ABG, leaf litter, isopods, springtails.',                   60,  false),
  ('lighting',        'Lighting',               'UVB T5, plant LEDs, fixtures, timers.',                     70,  false),
  ('heat-control',    'Heat & temperature',     'Thermostats, panels, deep heat projectors.',                80,  false),
  ('humidity',        'Misters & humidity',     'Misters, foggers, hygrometers, humidistats.',               90,  false),
  ('decor',           'Decor',                  'Cork, magnetic ledges, foliage, hides, feeding cups.',      100, false),
  ('hatchling',       'Hatchling & incubation', 'Incubators, deli cups, vermiculite, lay boxes.',            110, false),
  ('breeding',        'Breeding & lab',         'Scales, calipers, label printers.',                         120, false),
  ('health',          'Health & supplements',   'Calcium, multivit, F10, Reptaid (no Rx items).',            130, false),
  ('cleaning',        'Cleaning & tools',       'Disinfectants, tongs, spray bottles.',                      140, false),
  ('shipping',        'Shipping supplies',      'Boxes, heat packs, deli cups, foam.',                       150, false),
  ('photography',     'Photography & morph-ID', 'Light boxes, macro clips, color checkers.',                 160, false),
  ('books',           'Books & education',      'Care guides and references.',                               170, false),
  ('kits',            'Curated kits',           'Bundled setups for hatchlings, adults, breeders.',          180, false),
  ('gifts',           'Gift ideas',             'Crested gecko themed gifts for keepers, breeders, and the people who love them.', 5, true)
on conflict (slug) do nothing;

-- Gift sub-categories — separate URL slugs for SEO. Parent set after seeding.
insert into public.store_categories (slug, name, description, display_order, is_gift_category, seo_title, seo_description)
values
  ('gifts/under-25',
    'Crested gecko gifts under $25',
    'Affordable, thoughtful gifts for crested gecko owners — mugs, stickers, prints, and small accessories under $25.',
    10, true,
    'Crested gecko gifts under $25 — Geck Inspect',
    'Affordable crested gecko gift ideas under $25. Curated picks for the gecko keeper in your life.'),
  ('gifts/under-50',
    'Crested gecko gifts under $50',
    'Mid-range crested gecko gifts: apparel, decor, and starter accessories under $50.',
    20, true,
    'Crested gecko gifts under $50 — Geck Inspect',
    'The best crested gecko gifts under $50. Curated picks for keepers, breeders, and gecko-obsessed friends.'),
  ('gifts/christmas',
    'Crested gecko Christmas gifts',
    'Holiday gift guide for crested gecko owners. Stocking stuffers, themed apparel, and useful supplies for the gecko person in your life.',
    1, true,
    'Crested gecko Christmas gifts 2026 — Geck Inspect',
    'The complete crested gecko Christmas gift guide. Hand-curated by breeders for keepers of every level.'),
  ('gifts/birthday',
    'Crested gecko birthday gifts',
    'Birthday gift ideas for the crested gecko keeper in your life. From silly tees to genuinely useful gear.',
    30, true,
    'Crested gecko birthday gifts — Geck Inspect',
    'Find the perfect birthday gift for a crested gecko keeper. Curated by people who actually keep them.'),
  ('gifts/for-new-keepers',
    'Crested gecko gifts for new keepers',
    'Setup essentials and care guides for someone just starting with crested geckos.',
    40, true,
    'Crested gecko gifts for new keepers — Geck Inspect',
    'The most useful crested gecko gifts for someone new to the hobby. Picked by experienced keepers.'),
  ('gifts/for-breeders',
    'Crested gecko gifts for breeders',
    'Tools and gear that breeders actually want — scales, label printers, lay-box kits.',
    50, true,
    'Crested gecko gifts for breeders — Geck Inspect',
    'Practical crested gecko gifts for breeders. Things they''ll actually use and not return.'),
  ('gifts/stocking-stuffers',
    'Crested gecko stocking stuffers',
    'Small, fun gecko-themed stocking stuffers under $15.',
    60, true,
    'Crested gecko stocking stuffers — Geck Inspect',
    'Stocking-stuffer-sized crested gecko gifts. Stickers, magnets, small decor.')
on conflict (slug) do nothing;

-- Set parent_id on gift sub-categories now that the parent exists.
update public.store_categories sub
   set parent_id = parent.id
  from public.store_categories parent
 where parent.slug = 'gifts'
   and sub.slug like 'gifts/%'
   and sub.parent_id is null;

-- =============================================================================
-- Default app_settings entries for the store
-- =============================================================================
insert into public.app_settings (key, value, is_public, description) values
  ('store_enabled', 'false'::jsonb, true, 'Master kill-switch for the entire Supplies tab.'),
  ('store_free_shipping_threshold_cents', '5000'::jsonb, true, 'Free shipping when subtotal_cents >= this. Phase 1 = $50.'),
  ('store_signup_grant_min_order_cents', '1000'::jsonb, false, 'Minimum order subtotal that earns a guest the 3-month Keeper trial.'),
  ('store_signup_grant_duration_days', '90'::jsonb, false, 'How long the guest-checkout trial lasts.'),
  ('store_signup_grant_tier', '"keeper"'::jsonb, false, 'Membership tier granted by guest-checkout receipt link.'),
  ('store_loyalty_cgd_min_cart_cents', '4000'::jsonb, true, 'Subscriber loyalty perk: spend at least this in a single order.'),
  ('store_loyalty_cgd_min_tenure_days', '60'::jsonb, false, 'Subscriber loyalty perk: minimum days as a paid subscriber.'),
  ('store_loyalty_cgd_cooldown_days', '60'::jsonb, false, 'Subscriber loyalty perk: cooldown between samples per account.'),
  ('store_loyalty_samples_enabled', 'false'::jsonb, false, 'Master flag for the free-CGD-sample loyalty perk. Off until wholesale Pangea is live.'),
  ('store_affiliate_max_share_per_category_pct', '30'::jsonb, false, 'Cap on the share of a category page that can be affiliate-redirect items.')
on conflict (key) do nothing;

-- =============================================================================
-- Comments
-- =============================================================================
comment on table public.store_products is
  'Master catalog. fulfillment_mode drives every routing decision. direct_self/direct_pod/dropship_wholesale items are cart-eligible; affiliate_redirect items are linked out via store_affiliate_clicks.';
comment on column public.store_products.pricing_constraint is
  'When ''map'', enforce map_floor_cents on display so we don''t violate Repashy / similar dealer agreements.';
comment on table public.store_signup_grants is
  'Single-use trial tokens emitted in guest-checkout receipts. Redeemed at AuthPortal signup.';
