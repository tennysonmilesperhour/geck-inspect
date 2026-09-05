-- Custom gecko tee (5 Sep 2026).
--
-- A T-shirt printed with the customer's own crested gecko, built in the
-- shirt studio at /Store/tees. Same mechanics as the custom sticker: the
-- design (photo URL, colour, size, fit, placement, style, name, morph line)
-- rides on the cart line as the customization jsonb blob, and the checkout
-- function labels the Stripe line from it. Lives in the existing apparel
-- category. Price and shipping are placeholders Tennyson can change in
-- app_settings and on the product row without a deploy. Idempotent.

insert into public.store_products (
  slug, name, short_description, long_description_md,
  vendor_id, category_id, fulfillment_mode, shipping_class, status,
  our_price_cents, inventory_tracked, images,
  gift_friendly, price_tier, gift_audience, is_featured,
  free_shipping_eligible, weight_grams
)
select
  'custom-gecko-tee',
  'Custom gecko tee',
  'Your crested gecko on a heavyweight cotton shirt. Six colours, sizes S to 3XL, four print styles.',
  $md$
Upload a photo of your own crested gecko and build the shirt around it. Pick
the colour, the size and fit, where the print sits (full front, left chest or
back) and the style: photo in a circle, a squared-off photo, a poster with
the name and morph line stacked under it, or a round badge. The name and
morph line print exactly as you type them.

Heavyweight ring-spun cotton, direct-to-garment print. Standard store
shipping. Turnaround is about two weeks.

Upload a photo you own the rights to. We print your design as you built it,
and we do not print third-party logos, characters, or trademarks.
  $md$,
  vendor.id,
  cat.id,
  'direct_self'::public.store_fulfillment_mode,
  'standard'::public.store_shipping_class,
  'active'::public.store_product_status,
  2800,
  false,
  '[]'::jsonb,
  true,
  'under_50',
  array['new_keeper', 'breeder', 'kid', 'partner_of_keeper'],
  true,
  false,
  180
from public.store_vendors vendor
cross join public.store_categories cat
where vendor.slug = 'geck-inspect'
  and cat.slug = 'apparel'
on conflict (slug) do nothing;

insert into public.app_settings (key, value, is_public, description) values
  ('store_custom_tee_price_cents', '2800'::jsonb, true,
   'Price of one custom gecko tee. Kept in sync with store_products.our_price_cents for slug custom-gecko-tee.')
on conflict (key) do nothing;
