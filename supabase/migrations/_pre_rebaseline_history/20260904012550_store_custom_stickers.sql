-- =============================================================================
-- Custom pet stickers: personalized trading-card stickers built by the customer
-- =============================================================================
-- A customer uploads a photo of their own animal, fills in trading-card style
-- fields (stage, HP, element, attacks, weakness, resistance, retreat cost,
-- rarity, card number), previews the layout live, and adds it to the normal
-- store cart. $10 per sticker, $5 flat shipping on a stickers-only order.
--
-- Two schema changes make this fit the existing cart:
--
--   1. store_cart_items / store_order_items get a `customization` jsonb blob.
--      Every custom sticker line carries its own design there, so the
--      catalog stays a single product row instead of one row per design.
--
--   2. The unique (cart_id, product_id) constraint on store_cart_items is
--      replaced with a partial unique index that only applies to
--      non-customized lines. Two stickers of different animals are two
--      separate lines; two bags of the same CGD still merge into one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. customization payload on cart + order lines
-- -----------------------------------------------------------------------------
alter table public.store_cart_items
  add column if not exists customization jsonb;

alter table public.store_order_items
  add column if not exists customization jsonb;

comment on column public.store_cart_items.customization is
  'Per-line personalization blob. For custom stickers: {kind:"custom_sticker", version, photo_url, name, hp, element, attacks[], ...}. Null for ordinary catalog lines.';
comment on column public.store_order_items.customization is
  'Snapshot of store_cart_items.customization at payment time. This is what production works from when printing a custom sticker.';

-- -----------------------------------------------------------------------------
-- 2. Allow multiple distinct customized lines for the same product
-- -----------------------------------------------------------------------------
alter table public.store_cart_items
  drop constraint if exists store_cart_items_cart_id_product_id_key;

drop index if exists public.store_cart_items_cart_product_uniq;

create unique index if not exists store_cart_items_cart_product_uniq
  on public.store_cart_items (cart_id, product_id)
  where customization is null;

create index if not exists store_cart_items_customization_idx
  on public.store_cart_items using gin (customization)
  where customization is not null;

create index if not exists store_order_items_customization_idx
  on public.store_order_items using gin (customization)
  where customization is not null;

-- -----------------------------------------------------------------------------
-- 3. Category + product
-- -----------------------------------------------------------------------------
insert into public.store_categories (slug, name, description, display_order, is_gift_category, seo_title, seo_description)
values (
  'custom-stickers',
  'Custom pet stickers',
  'Turn a photo of your own crested gecko into a die-cut trading-card sticker. You pick the element, the HP, the attacks, and the morph line.',
  15,
  true,
  'Custom crested gecko trading card stickers, Geck Inspect',
  'Upload a photo of your gecko and build a die-cut trading-card sticker. $10 each, $5 flat shipping. Pick the element, HP, attacks, weakness, and rarity.'
)
on conflict (slug) do nothing;

insert into public.store_products (
  slug, name, short_description, long_description_md,
  vendor_id, category_id, fulfillment_mode, shipping_class, status,
  our_price_cents, inventory_tracked, images,
  gift_friendly, price_tier, gift_audience, is_featured,
  free_shipping_eligible, weight_grams
)
select
  'custom-pet-sticker',
  'Custom pet trading card sticker',
  'Your gecko, your stats. Upload a photo, build the card, we print and ship the die-cut sticker.',
  $md$
Upload a photo of your own animal and build a trading-card sticker around it.
You choose the card name, the stage, the HP, the element, up to two attacks
with their own damage and flavor text, the weakness, the resistance, the
retreat cost, the rarity, and the morph line printed along the bottom.

Every sticker is die-cut, weatherproof vinyl, printed one at a time from the
design you built. $10 per sticker, $5 flat shipping on a stickers-only order.
Turnaround is about a week.

Upload a photo you own the rights to. We print your design as you built it,
and we do not print third-party logos, characters, or trademarks.
  $md$,
  vendor.id,
  cat.id,
  'direct_self'::public.store_fulfillment_mode,
  'standard'::public.store_shipping_class,
  'active'::public.store_product_status,
  1000,
  false,
  '[]'::jsonb,
  true,
  'under_15',
  array['new_keeper', 'breeder', 'kid', 'partner_of_keeper'],
  true,
  false,
  15
from public.store_vendors vendor
cross join public.store_categories cat
where vendor.slug = 'geck-inspect'
  and cat.slug = 'custom-stickers'
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Pricing knobs, admin-editable without a deploy
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public, description) values
  ('store_custom_sticker_price_cents', '1000'::jsonb, true,
   'Price of one custom pet sticker. Kept in sync with store_products.our_price_cents for slug custom-pet-sticker.'),
  ('store_custom_sticker_shipping_cents', '500'::jsonb, true,
   'Flat shipping charged on an order that contains only custom stickers.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 5. Storage: let a guest upload the photo their sticker is printed from
-- -----------------------------------------------------------------------------
-- uploadFile() writes to geck-inspect-media under `<folder>/<owner>/<file>`,
-- and the sticker builder passes folder = 'sticker-uploads'. Signed-in users
-- are already covered by the bucket's existing policies; this adds the anon
-- path so a guest can build and buy a sticker without making an account.
--
-- Tradeoff worth knowing: this makes `sticker-uploads/` an unauthenticated
-- write path. The store is built for guest checkout, so requiring an account
-- just to upload a photo would block the sale. Keep the bucket's file size
-- limit and allowed MIME types set in the Supabase storage settings, since
-- those are the only server-side guards on this path (the 10 MB cap and the
-- image-type check in src/lib/uploadFile.js are client-side only). Drop this
-- policy if you would rather make sticker buyers sign in.
--
-- Wrapped so a project where storage policies are managed elsewhere (or where
-- the migration role can't touch storage.objects) still applies the rest of
-- this migration cleanly.
-- -----------------------------------------------------------------------------
do $$
begin
  execute $pol$
    drop policy if exists "Sticker uploads writable by anyone" on storage.objects;
  $pol$;
  execute $pol$
    create policy "Sticker uploads writable by anyone"
      on storage.objects for insert
      with check (
        bucket_id = 'geck-inspect-media'
        and (storage.foldername(name))[1] = 'sticker-uploads'
      );
  $pol$;
  execute $pol$
    drop policy if exists "Sticker uploads readable by anyone" on storage.objects;
  $pol$;
  execute $pol$
    create policy "Sticker uploads readable by anyone"
      on storage.objects for select
      using (
        bucket_id = 'geck-inspect-media'
        and (storage.foldername(name))[1] = 'sticker-uploads'
      );
  $pol$;
exception
  when insufficient_privilege or undefined_table or undefined_object then
    raise notice 'Skipped sticker-uploads storage policies: %', sqlerrm;
end $$;
