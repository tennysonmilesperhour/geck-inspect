-- =============================================================================
-- Store catalog seed — 18 tee designs + curated affiliate starters
-- =============================================================================
-- Everything seeded here is status='draft' so it doesn't appear in the
-- public store until the admin reviews + activates each row from the
-- admin CRUD page. The user is responsible for:
--   1. Apparel  — uploading designs to Printful, copying the Printful
--                 variant IDs into vendor_extra.printful_variant_id, then
--                 setting our_cost_cents from Printful's quote and
--                 status='active'.
--   2. Affiliate — replacing the placeholder vendor_product_url with
--                  their actual partner-tagged URL once Amazon
--                  Associates / Chewy Partnerize / direct programs are
--                  approved, then setting status='active'.
--
-- Naming + short_description is intentionally evocative-not-infringing
-- per the proposal: pop-culture parodies use copy and color cues but
-- not protected logos / character art.
-- =============================================================================

-- Helper CTE-ish lookups for vendor + category IDs by slug. Used
-- inline below.

-- ---------------------------------------------------------------------------
-- Apparel — 18 tees + a starter sticker pack + mug
-- ---------------------------------------------------------------------------
insert into public.store_products (
  slug, name, short_description, long_description_md,
  vendor_id, category_id, fulfillment_mode, shipping_class, status,
  our_price_cents, compare_at_price_cents,
  pricing_constraint, vendor_extra,
  inventory_tracked,
  images, lifecycle_stage_tags, gift_friendly, price_tier, gift_audience,
  is_featured, free_shipping_eligible
)
select
  v.slug_p, v.name_p, v.short_p, v.long_p,
  vendor.id, cat.id,
  'direct_pod'::public.store_fulfillment_mode,
  'standard'::public.store_shipping_class,
  'draft'::public.store_product_status,
  v.price_p, v.compare_p,
  'none'::public.store_pricing_constraint,
  jsonb_build_object('printful_variant_id', null, 'design_brief', v.brief_p),
  false,
  '[]'::jsonb,
  '{}'::text[], v.gift_p, v.tier_p, v.audience_p,
  v.featured_p, true
from (values
  -- Pop-culture-evoking (handled carefully — no logos / character art)
  ('tee-this-is-the-way',              'Tee — This Is The Way',                'Stylized minimalist armor + crested gecko silhouette. For the keeper who knows the way.', 'A nod to the bounty-hunter universe done with original art only — minimalist beskar-grey palette, no helmet shapes or trademarked typography. Comfortable cotton/poly blend. Unisex sizing.',  'tee-this-is-the-way-design-brief', 2499::bigint, 2999::bigint, true,  'under_25', '{new_keeper,partner_of_keeper}'::text[], true),
  ('tee-wheres-the-gecko',             'Tee — Where''s the Gecko?',            'Densely illustrated foliage with one hidden crestie. Find them.',                          'Original densely illustrated dark-leafy print across the chest with exactly one crested gecko hidden in the foliage. A conversation-starter shirt.',                                          'tee-wheres-the-gecko-design-brief', 2499, 2999, true,  'under_25', '{new_keeper,kid,partner_of_keeper}'::text[], true),
  ('tee-happy-little-geckos',          'Tee — Happy Little Geckos',            'Watercolor crestie on a branch with a kindly script. No mistakes, only happy little geckos.', 'Watercolor-style crested gecko on a branch with hand-lettered script. The "give one to your art teacher" shirt.',                                                                            'tee-happy-little-geckos-design-brief', 2499, null, true,  'under_25', '{new_keeper,partner_of_keeper}'::text[], false),
  ('tee-crest-side-of-the-moon',       'Tee — Crest Side of the Moon',         'Prism refracting light into a rainbow with a gecko silhouette inside.',                       'Prism + rainbow design with an embedded crested gecko silhouette. Album-cover-evocative without reproducing any protected art.',                                                              'tee-crest-side-of-the-moon-design-brief', 2499, null, false, 'under_25', '{breeder,new_keeper}'::text[], true),
  ('tee-demogeckon',                   'Tee — Demogeckon',                     'Original creature illustration: gecko meets ''80s horror typography.',                       'A horror-evocative original illustration of a gecko with a flower-petal mouth, ''80s sci-fi typography. Doesn''t reproduce the Demogorgon design.',                                            'tee-demogeckon-design-brief', 2499, null, false, 'under_25', '{breeder}'::text[], false),
  ('tee-run-cgd',                      'Tee — Run CGD',                        'Block-letter homage to ''80s hip-hop with a gecko twist.',                                   'Block-letter typography in a layout style that has been parodied by countless brands. CGD = crested gecko diet.',                                                                              'tee-run-cgd-design-brief', 2499, null, false, 'under_25', '{breeder,new_keeper}'::text[], false),
  ('tee-got-cgd',                      'Tee — Got CGD?',                       'Milk-mustache gecko in a serif "Got ___?" parody layout.',                                    'Milk-mustache crested gecko illustrated for the parody. Wordmark is original; layout is generic-classic.',                                                                                    'tee-got-cgd-design-brief', 2499, null, false, 'under_25', '{new_keeper,kid}'::text[], false),
  ('tee-i-want-to-believe',            'Tee — I Want To Believe',              'UFO over a misty New Caledonia silhouette with a tiny gecko.',                              'Cryptid-poster vibe. Silhouetted New Caledonia island shape under a saucer light, gecko peeking from foliage.',                                                                              'tee-i-want-to-believe-design-brief', 2499, null, false, 'under_25', '{breeder}'::text[], false),
  -- Wordplay & breeder humor
  ('tee-cresties-before-resties',      'Tee — Cresties Before Resties',        'For the breeder running on coffee and 2 a.m. lay-box checks.',                              'Sleep-meme adjacent. For the keeper who has admitted defeat to their geckos'' nocturnal schedule.',                                                                                            'tee-cresties-before-resties-design-brief', 2499, null, false, 'under_25', '{breeder}'::text[], false),
  ('tee-just-one-more-pairing',        'Tee — Just One More Pairing',          'Two geckos eyeing each other. The lie every breeder tells.',                                'The breeder''s little white lie, illustrated. Subtle for the in-crowd.',                                                                                                                      'tee-just-one-more-pairing-design-brief', 2499, null, false, 'under_25', '{breeder}'::text[], false),
  ('tee-will-work-for-pangea',         'Tee — Will Work for Pangea',           'Gecko holding a tiny cardboard sign.',                                                       'Cute. Funny. The keeper who only feeds the good stuff knows.',                                                                                                                                'tee-will-work-for-pangea-design-brief', 2499, null, false, 'under_25', '{new_keeper,kid,partner_of_keeper}'::text[], false),
  ('tee-heterozygous-and-proud',       'Tee — Heterozygous and Proud',         'Punnett-square typography. For the breeder who actually knows.',                            'Genetics-class homage. The "I crossed lilly white x super dalmatian and I''ll explain it to you over dinner" shirt.',                                                                          'tee-heterozygous-and-proud-design-brief', 2499, null, false, 'under_25', '{breeder}'::text[], false),
  ('tee-stick-with-me',                'Tee — Stick With Me',                  'Macro toe-pad illustration. Small detail, big charm.',                                       'Toe-pad close-up done as line art. Subtle for the people who notice.',                                                                                                                        'tee-stick-with-me-design-brief', 2499, null, false, 'under_25', '{new_keeper}'::text[], false),
  ('tee-threw-tail',                   'Tee — My Gecko Threw Their Tail',      'Long-form classic-tourist-tee parody.',                                                      'Long-form: "My gecko threw their tail and all I got was this lousy t-shirt." For the keeper with stories.',                                                                                  'tee-threw-tail-design-brief', 2499, null, false, 'under_25', '{breeder,new_keeper}'::text[], false),
  ('tee-crested-thing',                'Tee — It''s a Crested Thing',          'Subtle gatekeep humor, no aggression.',                                                      '"It''s a crested thing, you wouldn''t understand." Subtle gatekeep, all in fun.',                                                                                                              'tee-crested-thing-design-brief', 2499, null, false, 'under_25', '{breeder}'::text[], false),
  -- Aesthetic / non-meme
  ('tee-harlequin-portrait',           'Tee — Harlequin Pinstripe Portrait',   'High-detail crestie illustration on a clean shirt.',                                         'Photorealistic harlequin pinstripe gecko portrait. The "I just want a nice gecko shirt" pick.',                                                                                              'tee-harlequin-portrait-design-brief', 2799, null, true,  'under_50', '{new_keeper,breeder,partner_of_keeper}'::text[], true),
  ('tee-pattern-as-art',               'Tee — Pattern as Art',                 'Pinstripe / quad-stripe rendered as abstract typography.',                                   'Abstract pattern art. No animal. The minimalist option that pairs with anything.',                                                                                                            'tee-pattern-as-art-design-brief', 2799, null, true,  'under_50', '{new_keeper,partner_of_keeper}'::text[], false),
  ('tee-correlophus-ciliatus',         'Tee — Correlophus ciliatus',           'Clean Latin-name typography. The taxonomy nerd shirt.',                                       'Just the Latin name done in elegant typography. For the keeper who has opinions about the genus reclassification.',                                                                          'tee-correlophus-ciliatus-design-brief', 2499, null, true,  'under_25', '{breeder}'::text[], false)
) as v(slug_p, name_p, short_p, long_p, brief_p, price_p, compare_p, gift_p, tier_p, audience_p, featured_p)
join public.store_vendors vendor on vendor.slug = 'printful'
join public.store_categories cat on cat.slug = 'apparel'
on conflict (slug) do nothing;

-- Sticker pack + mug — quick-add merch beyond the tee slate
insert into public.store_products (
  slug, name, short_description, long_description_md,
  vendor_id, category_id, fulfillment_mode, shipping_class, status,
  our_price_cents, vendor_extra, inventory_tracked,
  images, gift_friendly, price_tier, gift_audience, is_featured
)
select
  v.slug_p, v.name_p, v.short_p, v.long_p,
  vendor.id, cat.id,
  'direct_pod'::public.store_fulfillment_mode,
  'standard'::public.store_shipping_class,
  'draft'::public.store_product_status,
  v.price_p,
  jsonb_build_object('printful_variant_id', null, 'design_brief', v.brief_p),
  false, '[]'::jsonb, true, v.tier_p, '{new_keeper,kid,partner_of_keeper}'::text[], v.featured_p
from (values
  ('sticker-pack-starter', 'Sticker pack — starter set',  'Five vinyl die-cut gecko stickers.',     'Five-pack of die-cut vinyl stickers. Original Geck Inspect art. Laptop-safe, water-resistant, the cheapest way to flair up your husbandry rack.', 'sticker-pack-starter-design-brief', 999::bigint,  'under_15', false),
  ('mug-cresties-fuel',    'Mug — Cresties Fuel',         '11oz ceramic mug for keepers who like coffee almost as much as their geckos.', 'Standard 11oz ceramic mug printed with our "Cresties Fuel" design. Microwave-safe, dishwasher-safe.',                                              'mug-cresties-fuel-design-brief', 1599,             'under_25', false)
) as v(slug_p, name_p, short_p, long_p, brief_p, price_p, tier_p, featured_p)
join public.store_vendors vendor on vendor.slug = 'printful'
join public.store_categories cat on cat.slug = 'accessories'
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Affiliate starters — placeholder URLs until partner tags are issued
-- ---------------------------------------------------------------------------
-- Status remains 'draft' until the admin replaces vendor_product_url with
-- a real tagged URL. Each row carries an internal note in vendor_extra so
-- the admin CRUD UI can surface "needs partner tag" warnings.
-- ---------------------------------------------------------------------------

-- Heat & temperature
insert into public.store_products (
  slug, name, short_description, vendor_id, category_id, fulfillment_mode,
  status, our_price_cents, vendor_product_url, vendor_extra, inventory_tracked,
  gift_friendly, price_tier, gift_audience
)
select v.slug_p, v.name_p, v.short_p, vendor.id, cat.id,
  'affiliate_redirect'::public.store_fulfillment_mode,
  'draft'::public.store_product_status,
  v.price_p, v.url_p,
  jsonb_build_object('needs_partner_tag', true, 'note', 'Replace URL with tagged affiliate link once partner program is active.'),
  false, v.gift_p, v.tier_p, v.audience_p
from (values
  ('aff-inkbird-itc308',        'Inkbird ITC-308 Thermostat',       'Plug-and-play digital temp controller. Standard for crestie heat-panel rigs.', 3499::bigint, 'https://www.amazon.com/s?k=Inkbird+ITC-308',          true,  'under_50',  '{new_keeper,breeder}'::text[]),
  ('aff-inkbird-iptcwifi',      'Inkbird IPT-2CH Wi-Fi Thermostat', 'Two-channel Wi-Fi thermostat for racks. Phone alerts when something fails.',  6999::bigint, 'https://www.amazon.com/s?k=Inkbird+IPT-2CH',          false, 'under_100', '{breeder}'::text[]),
  ('aff-arcadia-dhp-50w',       'Arcadia 50W Deep Heat Projector',  'IR-A heat without visible light. Pairs with the right thermostat.',           4999::bigint, 'https://www.lightyourreptiles.com/?s=deep+heat+projector', true,  'under_50',  '{breeder}'::text[])
) as v(slug_p, name_p, short_p, price_p, url_p, gift_p, tier_p, audience_p)
join public.store_vendors vendor on vendor.slug = 'amazon'
join public.store_categories cat on cat.slug = 'heat-control'
on conflict (slug) do nothing;

-- Misters & humidity
insert into public.store_products (
  slug, name, short_description, vendor_id, category_id, fulfillment_mode,
  status, our_price_cents, vendor_product_url, vendor_extra, inventory_tracked,
  gift_friendly, price_tier, gift_audience
)
select v.slug_p, v.name_p, v.short_p, vendor.id, cat.id,
  'affiliate_redirect'::public.store_fulfillment_mode,
  'draft'::public.store_product_status,
  v.price_p, v.url_p,
  jsonb_build_object('needs_partner_tag', true),
  false, v.gift_p, v.tier_p, v.audience_p
from (values
  ('aff-mistking-starter-v5',   'MistKing Starter v5 Misting System', 'The standard for vivarium misting. Quiet, reliable, infinitely tweakable.', 16999::bigint, 'https://www.mistking.com/starter-misting-system-v5/', true,  'over_100', '{breeder}'::text[]),
  ('aff-govee-hygrometer',      'Govee Bluetooth Hygrometer',         'Phone-readable humidity log. Pair one per enclosure.',                       1599::bigint, 'https://www.amazon.com/s?k=Govee+hygrometer',         true,  'under_25', '{new_keeper,breeder,partner_of_keeper}'::text[])
) as v(slug_p, name_p, short_p, price_p, url_p, gift_p, tier_p, audience_p)
join public.store_vendors vendor on vendor.slug = 'amazon'
join public.store_categories cat on cat.slug = 'humidity'
on conflict (slug) do nothing;

-- Diet (CGD) — affiliate while wholesale Pangea is pending
insert into public.store_products (
  slug, name, short_description, vendor_id, category_id, fulfillment_mode,
  status, our_price_cents, vendor_product_url, vendor_extra, inventory_tracked,
  gift_friendly, price_tier, gift_audience, lifecycle_stage_tags
)
select v.slug_p, v.name_p, v.short_p, vendor.id, cat.id,
  'affiliate_redirect'::public.store_fulfillment_mode,
  'draft'::public.store_product_status,
  v.price_p, v.url_p,
  jsonb_build_object('needs_partner_tag', true, 'note', 'Switch to dropship_wholesale once Pangea wholesale account is active.'),
  false, v.gift_p, v.tier_p, v.audience_p, v.stages_p
from (values
  ('aff-pangea-watermelon-mango', 'Pangea Watermelon Mango CGD',       'Crowd-favorite Pangea flavor for pickier eaters.',         2299::bigint, 'https://www.pangeareptile.com/products/pangea-fruit-mix-complete-with-watermelon-and-mango', false, 'under_25', '{new_keeper,breeder}'::text[], '{hatchling,juvenile,sub_adult,adult,breeder}'::text[]),
  ('aff-pangea-with-insects',     'Pangea With Insects CGD',           'Pangea flavor with insect protein, popular for breeders.', 2299::bigint, 'https://www.pangeareptile.com/products/pangea-fruit-mix-complete-with-insects',          false, 'under_25', '{breeder}'::text[],         '{adult,breeder,gravid_female}'::text[]),
  ('aff-repashy-mrp',             'Repashy Crested Gecko MRP',         'The original. Rooted in the bloodline of crestie keeping.', 1999::bigint, 'https://www.repashy.com/superfoods/superfoods-meal-replacements/crested-gecko-mrp.html', false, 'under_25', '{new_keeper,breeder}'::text[], '{hatchling,juvenile,sub_adult,adult}'::text[])
) as v(slug_p, name_p, short_p, price_p, url_p, gift_p, tier_p, audience_p, stages_p)
join public.store_vendors vendor on vendor.slug = 'pangea-reptile'
join public.store_categories cat on cat.slug = 'diet'
on conflict (slug) do nothing;

-- Enclosures — affiliate to Zen Habitats / Custom Reptile Habitats
insert into public.store_products (
  slug, name, short_description, vendor_id, category_id, fulfillment_mode,
  status, our_price_cents, vendor_product_url, vendor_extra, inventory_tracked,
  shipping_class, gift_friendly, price_tier, gift_audience
)
select v.slug_p, v.name_p, v.short_p, vendor.id, cat.id,
  'affiliate_redirect'::public.store_fulfillment_mode,
  'draft'::public.store_product_status,
  v.price_p, v.url_p,
  jsonb_build_object('needs_partner_tag', true),
  false,
  'oversized'::public.store_shipping_class,
  v.gift_p, v.tier_p, v.audience_p
from (values
  ('aff-zen-4x2x2',  'Zen Habitats 4x2x2 PVC',         'PVC adult enclosure for crested geckos.',         44900::bigint, 'https://www.zenhabitats.com/collections/pvc',         true,  'over_100', '{breeder}'::text[]),
  ('aff-zen-2x2x2',  'Zen Habitats 2x2x2 PVC',         'Sub-adult or single-adult PVC build.',           34900::bigint, 'https://www.zenhabitats.com/collections/pvc',         true,  'over_100', '{new_keeper,breeder}'::text[])
) as v(slug_p, name_p, short_p, price_p, url_p, gift_p, tier_p, audience_p)
join public.store_vendors vendor on vendor.slug = 'zen-habitats'
join public.store_categories cat on cat.slug = 'enclosures'
on conflict (slug) do nothing;

-- Books
insert into public.store_products (
  slug, name, short_description, vendor_id, category_id, fulfillment_mode,
  status, our_price_cents, vendor_product_url, vendor_extra, inventory_tracked,
  gift_friendly, price_tier, gift_audience
)
select v.slug_p, v.name_p, v.short_p, vendor.id, cat.id,
  'affiliate_redirect'::public.store_fulfillment_mode,
  'draft'::public.store_product_status,
  v.price_p, v.url_p,
  jsonb_build_object('needs_partner_tag', true),
  false, v.gift_p, v.tier_p, v.audience_p
from (values
  ('aff-rhacodactylus-book', 'Rhacodactylus: The Complete Guide', 'de Vosjoli''s deep dive on the genus. Well-thumbed for a reason.', 4999::bigint, 'https://www.amazon.com/s?k=Rhacodactylus+The+Complete+Guide', true, 'under_50', '{new_keeper,breeder,partner_of_keeper}'::text[])
) as v(slug_p, name_p, short_p, price_p, url_p, gift_p, tier_p, audience_p)
join public.store_vendors vendor on vendor.slug = 'amazon'
join public.store_categories cat on cat.slug = 'books'
on conflict (slug) do nothing;
