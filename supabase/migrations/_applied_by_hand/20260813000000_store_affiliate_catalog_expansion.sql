-- =============================================================================
-- Store affiliate catalog expansion, keeper-relevant draft products
-- =============================================================================
-- These rows fill out the supply catalog without publishing unreviewed links.
-- Keep status='draft' until the vendor_product_url has the correct affiliate
-- tag/account ID and the product is reviewed in Admin > Store.
--
-- Amazon rows can use the existing Amazon Associates account. Chewy,
-- Pangea, MistKing, The Bio Dude, Josh's Frogs, Dubia.com, Zen Habitats,
-- Custom Reptile Habitats, Repashy, and Reptile Basics need their own
-- partner/wholesale setup before activation.
-- =============================================================================

update public.store_vendors
   set affiliate_program = case slug
     when 'zen-habitats' then coalesce(affiliate_program, 'direct_partner')
     when 'custom-reptile-habitats' then coalesce(affiliate_program, 'direct_partner')
     when 'the-bio-dude' then coalesce(affiliate_program, 'direct_partner')
     when 'joshs-frogs' then coalesce(affiliate_program, 'direct_partner')
     when 'dubia-com' then coalesce(affiliate_program, 'direct_partner')
     when 'mistking' then coalesce(affiliate_program, 'direct_partner')
     when 'repashy' then coalesce(affiliate_program, 'direct_partner')
     when 'reptile-basics' then coalesce(affiliate_program, 'direct_partner')
     else affiliate_program
   end,
       notes = trim(both from concat_ws(' ', notes, case slug
     when 'zen-habitats' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     when 'custom-reptile-habitats' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     when 'the-bio-dude' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     when 'joshs-frogs' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     when 'dubia-com' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     when 'mistking' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     when 'repashy' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     when 'reptile-basics' then 'Confirm affiliate or wholesale terms before activating catalog links.'
     else null
   end))
 where slug in (
   'zen-habitats',
   'custom-reptile-habitats',
   'the-bio-dude',
   'joshs-frogs',
   'dubia-com',
   'mistking',
   'repashy',
   'reptile-basics'
 );

insert into public.store_products (
  slug, name, short_description, long_description_md,
  vendor_id, category_id, fulfillment_mode, shipping_class, status,
  our_price_cents, vendor_product_url, vendor_extra, inventory_tracked,
  gift_friendly, price_tier, gift_audience, lifecycle_stage_tags, is_featured
)
select
  v.slug_p, v.name_p, v.short_p, v.long_p,
  vendor.id, cat.id,
  'affiliate_redirect'::public.store_fulfillment_mode,
  v.shipping_p::public.store_shipping_class,
  'draft'::public.store_product_status,
  v.price_p, v.url_p,
  jsonb_build_object(
    'needs_partner_tag', true,
    'source_verified_at', '2026-08-13',
    'source_note', v.note_p
  ),
  false,
  v.gift_p, v.tier_p, v.audience_p, v.stages_p, v.featured_p
from (values
  -- Lighting
  (
    'aff-arcadia-shadedweller-arboreal-prot5',
    'Arcadia ShadeDweller Arboreal ProT5 UVB Kit',
    'Low-output arboreal UVB kit suited to planted crestie enclosures.',
    'A sensible UVB option for keepers building light-and-shade gradients in taller, planted crested gecko habitats. Use with species-appropriate distances and a meter when possible.',
    'amazon',
    'lighting',
    6999::bigint,
    'https://www.amazon.com/s?k=Arcadia+ShadeDweller+Arboreal+ProT5+2.4%25',
    true,
    'under_100',
    '{new_keeper,breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    true,
    'Arcadia documents the ShadeDweller Arboreal line as 2.4% UV-B / 12% UV-A for arboreal species.'
  ),
  (
    'aff-arcadia-jungle-dawn-led-bar',
    'Arcadia Jungle Dawn LED Bar',
    'Bright plant light for bioactive crested gecko enclosures.',
    'For keepers running live plants, this fills the plant-light slot without relying on heat bulbs. Size to the enclosure and plant density.',
    'amazon',
    'lighting',
    7499,
    'https://www.amazon.com/s?k=Arcadia+Jungle+Dawn+LED+bar',
    false,
    'under_100',
    '{breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until the exact variant and tag are selected.'
  ),
  (
    'aff-kasa-smart-plug-mini',
    'Kasa Smart Plug Mini',
    'App-controlled timer for plant lights, misting pumps, and room gear.',
    'Useful for automating non-life-critical equipment. Thermostats should still control heat devices directly.',
    'amazon',
    'lighting',
    1299,
    'https://www.amazon.com/s?k=Kasa+Smart+Plug+Mini',
    true,
    'under_25',
    '{new_keeper,breeder,partner_of_keeper}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until the exact pack size and tag are selected.'
  ),

  -- Enclosures
  (
    'aff-dubia-24x18x36-arboreal-enclosure',
    'Dubia.com 24x18x36 Arboreal Enclosure',
    'Tall PVC-style habitat footprint for adult crestie builds.',
    'A common adult crested gecko target size with height for climbing, cover, feeding ledges, and plant growth.',
    'dubia-com',
    'enclosures',
    21999,
    'https://dubiaroaches.com/search?q=24x18x36+arboreal+enclosure',
    true,
    'over_100',
    '{new_keeper,breeder}'::text[],
    '{adult,breeder}'::text[],
    'oversized',
    true,
    'Dubia.com publishes instructions for 24x18x36 arboreal enclosure models.'
  ),
  (
    'aff-custom-reptile-habitats-2x2x4',
    'Custom Reptile Habitats 2x2x4 PVC Habitat',
    'Premium tall PVC enclosure for display adults.',
    'A high-end enclosure pick for keepers who want a taller planted display habitat and are willing to spend for finish quality.',
    'custom-reptile-habitats',
    'enclosures',
    49900,
    'https://customreptilehabitats.com/search?q=2x2x4',
    true,
    'over_100',
    '{breeder,partner_of_keeper}'::text[],
    '{adult,breeder}'::text[],
    'oversized',
    false,
    'Needs direct-partner or affiliate account confirmation.'
  ),

  -- Diet
  (
    'aff-repashy-mango-superblend',
    'Repashy Mango Superblend Crested Gecko Diet',
    'Fruit-forward Repashy flavor for rotation with Pangea diets.',
    'A useful rotation food for keepers who want multiple complete-diet flavors on hand, especially for picky eaters.',
    'repashy',
    'diet',
    1099,
    'https://www.shop.repashy.com/products/repashy-crested-gecko-diet-mango-superblend',
    false,
    'under_15',
    '{new_keeper,breeder}'::text[],
    '{hatchling,juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Repashy shop page lists 3oz, 6oz, and 12oz variants.'
  ),
  (
    'aff-repashy-classic-cgd',
    'Repashy Classic Crested Gecko Diet',
    'Classic complete gecko diet with banana, date, and fig.',
    'A baseline complete diet option that belongs in a crestie food rotation next to Pangea staples.',
    'repashy',
    'diet',
    1099,
    'https://www.shop.repashy.com/products/repashy-crested-gecko-diet-classic',
    false,
    'under_15',
    '{new_keeper,breeder}'::text[],
    '{hatchling,juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Repashy shop page describes Classic as a remix of the original formula.'
  ),

  -- Feeders
  (
    'aff-dubia-small-roaches',
    'Dubia.com Small Dubia Roaches',
    'Feeder roaches for occasional protein enrichment.',
    'Use appropriately sized feeders and remove uneaten insects. Best as enrichment, not a replacement for complete CGD.',
    'dubia-com',
    'feeders',
    1299,
    'https://dubiaroaches.com/search?q=small+dubia+roaches',
    false,
    'under_25',
    '{breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'live_insect',
    false,
    'Needs Dubia.com affiliate/partner setup before activation.'
  ),
  (
    'aff-dubia-black-soldier-fly-larvae',
    'Dubia.com Black Soldier Fly Larvae',
    'Soft-bodied feeder option for occasional insect days.',
    'Good for keepers who rotate feeder insects carefully. Size and frequency should match the animal.',
    'dubia-com',
    'feeders',
    999,
    'https://dubiaroaches.com/search?q=black+soldier+fly+larvae',
    false,
    'under_15',
    '{new_keeper,breeder}'::text[],
    '{juvenile,sub_adult,adult}'::text[],
    'live_insect',
    false,
    'Needs Dubia.com affiliate/partner setup before activation.'
  ),
  (
    'aff-pangea-gecko-treat',
    'Pangea Gecko Treat',
    'Occasional treat powder for variety, not a complete diet.',
    'A small add-on for keepers who understand treats are supplemental. Label clearly so it is not confused with complete CGD.',
    'pangea-reptile',
    'feeders',
    899,
    'https://www.pangeareptile.com/search?q=gecko+treat',
    true,
    'under_15',
    '{new_keeper,kid,partner_of_keeper}'::text[],
    '{juvenile,sub_adult,adult}'::text[],
    'standard',
    false,
    'Needs Pangea affiliate or wholesale account before activation.'
  ),

  -- Substrate & bioactive
  (
    'aff-biodude-terra-fauna',
    'The Bio Dude Terra Fauna Substrate',
    'Bioactive substrate blend for humid, forest-style enclosures.',
    'A practical bioactive base for planted crested gecko builds, usually paired with leaf litter, cleanup crew, drainage, and live plants.',
    'the-bio-dude',
    'substrate',
    2499,
    'https://www.thebiodude.com/search?q=terra+fauna',
    false,
    'under_50',
    '{new_keeper,breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    true,
    'Needs The Bio Dude partner setup before activation.'
  ),
  (
    'aff-joshs-frogs-abg-mix',
    'Josh''s Frogs ABG Mix',
    'Classic bioactive substrate base for tropical vivariums.',
    'A familiar substrate blend for planted vivariums and cleanup crews. Pair with proper drainage and maintenance.',
    'joshs-frogs',
    'substrate',
    2499,
    'https://www.joshsfrogs.com/search?q=ABG+mix',
    false,
    'under_50',
    '{new_keeper,breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Needs Josh''s Frogs partner setup before activation.'
  ),
  (
    'aff-joshs-frogs-springtail-culture',
    'Josh''s Frogs Springtail Culture',
    'Cleanup crew staple for bioactive crestie habitats.',
    'Springtails help process mold and waste in bioactive setups. Useful add-on for planted enclosures and breeder bins with bioactive substrate.',
    'joshs-frogs',
    'substrate',
    999,
    'https://www.joshsfrogs.com/search?q=springtail+culture',
    false,
    'under_15',
    '{new_keeper,breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'live_insect',
    false,
    'Needs Josh''s Frogs partner setup before activation.'
  ),
  (
    'aff-magnolia-leaf-litter',
    'Magnolia Leaf Litter',
    'Leaf litter for cover, humidity pockets, and cleanup crews.',
    'Adds visual cover and microhabitat structure for bioactive enclosures. Rinse or prepare according to vendor instructions.',
    'amazon',
    'substrate',
    1499,
    'https://www.amazon.com/s?k=magnolia+leaf+litter+reptile',
    true,
    'under_25',
    '{new_keeper,breeder,partner_of_keeper}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until the exact source and tag are selected.'
  ),

  -- Decor & feeding ledges
  (
    'aff-pangea-magnetic-silicone-ledge-small',
    'Pangea Magnetic Silicone Gecko Eco Food Ledge',
    'Reusable magnetic feeding ledge for small Pangea cups.',
    'A clean, reusable ledge that avoids suction cup fatigue and fits the small-cup feeding workflow many crestie keepers use.',
    'chewy',
    'decor',
    1999,
    'https://www.chewy.com/pangea-magnetic-silicone-gecko-eco/dp/3320254',
    true,
    'under_25',
    '{new_keeper,breeder,partner_of_keeper}'::text[],
    '{hatchling,juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    true,
    'Chewy page shows in-stock Pangea magnetic silicone ledge and cup compatibility.'
  ),
  (
    'aff-pangea-small-feeding-cups-100',
    'Pangea Small Gecko Feeding Cups, 100 Count',
    'Bulk 0.5-oz cups for ledges and hatchling racks.',
    'A boring but very useful reorder product for keepers with multiple animals or anyone who wants cleaner feeding nights.',
    'chewy',
    'decor',
    699,
    'https://www.chewy.com/pangea-biodegradable-gecko-feeding/dp/3320270',
    false,
    'under_15',
    '{new_keeper,breeder}'::text[],
    '{hatchling,juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    true,
    'Chewy page lists 100-count small 0.5-oz Pangea cups.'
  ),
  (
    'aff-pangea-large-feeding-cups-100',
    'Pangea Large Gecko Feeding Cups, 100 Count',
    'Bulk 1.5-oz cups for larger ledges and breeder feeding.',
    'Useful for adult enclosures, breeder racks, and anyone trying to standardize cup sizes.',
    'chewy',
    'decor',
    899,
    'https://www.chewy.com/pangea-plastic-gecko-feeding-cup-100/dp/3320406',
    false,
    'under_15',
    '{breeder}'::text[],
    '{adult,breeder}'::text[],
    'standard',
    false,
    'Chewy page lists 100-count large 1.5-oz Pangea cups.'
  ),
  (
    'aff-cork-bark-flats',
    'Natural Cork Bark Flats',
    'Climbing texture, cover, and hardscape for arboreal builds.',
    'A foundational decor item for cresties because it adds vertical routes, hides, and natural texture without forcing a novelty theme.',
    'amazon',
    'decor',
    2499,
    'https://www.amazon.com/s?k=cork+bark+flats+reptile',
    true,
    'under_50',
    '{new_keeper,breeder,partner_of_keeper}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until the exact size and tag are selected.'
  ),
  (
    'aff-reptile-safe-artificial-vines',
    'Artificial Reptile Vines',
    'Extra climbing routes and visual cover for simple setups.',
    'Useful for quarantine bins, temporary setups, and young animals when live planting is overkill.',
    'amazon',
    'decor',
    1599,
    'https://www.amazon.com/s?k=reptile+artificial+vines+crested+gecko',
    true,
    'under_25',
    '{new_keeper,kid,partner_of_keeper}'::text[],
    '{hatchling,juvenile,sub_adult,adult}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until the exact material quality is reviewed.'
  ),

  -- Heat & monitoring
  (
    'aff-govee-wifi-hygrometer',
    'Govee Wi-Fi Thermometer Hygrometer',
    'Remote temp and humidity checks for gecko rooms.',
    'A step up from Bluetooth-only monitoring for keepers who want alerts while away from home.',
    'amazon',
    'humidity',
    3999,
    'https://www.amazon.com/s?k=Govee+WiFi+thermometer+hygrometer',
    true,
    'under_50',
    '{new_keeper,breeder,partner_of_keeper}'::text[],
    '{hatchling,juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact model is selected.'
  ),
  (
    'aff-mistking-value-l-nozzle',
    'MistKing Value L Nozzle',
    'Expansion nozzle for MistKing misting systems.',
    'Useful add-on for expanding from one enclosure to multiple planted habitats.',
    'mistking',
    'humidity',
    1399,
    'https://www.mistking.com/search.php?substring=Value+L+Nozzle',
    false,
    'under_25',
    '{breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Needs MistKing partner setup before activation.'
  ),

  -- Hatchling & incubation
  (
    'aff-8oz-deli-cups-vented-lids',
    '8-oz Deli Cups with Vented Lids',
    'Temporary hatchling cups, feeder cups, and show transport basics.',
    'A practical breeder consumable for short-term holding, feeding insects, and organized hatchling workflows.',
    'amazon',
    'hatchling',
    1999,
    'https://www.amazon.com/s?k=8+oz+deli+cups+vented+lids+reptile',
    false,
    'under_25',
    '{breeder}'::text[],
    '{hatchling}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until the exact count and vent style are selected.'
  ),
  (
    'aff-reptile-basics-simdeli',
    'SIM Container / Deli Incubation Supplies',
    'Incubation containers for organized egg management.',
    'A breeder-focused pick for cleaner egg organization alongside Geck Inspect clutch records.',
    'reptile-basics',
    'hatchling',
    2499,
    'https://www.reptilebasics.com/search?q=SIM+container',
    false,
    'under_50',
    '{breeder}'::text[],
    '{breeder,gravid_female}'::text[],
    'standard',
    false,
    'Needs Reptile Basics partner setup before activation.'
  ),
  (
    'aff-digital-incubator-thermometer',
    'Digital Incubator Thermometer Hygrometer',
    'Small probe monitor for incubation bins and hatchling racks.',
    'A cheap redundancy layer for breeders tracking incubation and room stability.',
    'amazon',
    'hatchling',
    1299,
    'https://www.amazon.com/s?k=digital+incubator+thermometer+hygrometer+probe',
    true,
    'under_25',
    '{breeder,partner_of_keeper}'::text[],
    '{breeder,gravid_female}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact model is selected.'
  ),

  -- Breeding & lab
  (
    'aff-aws-gram-scale',
    'AWS Digital Gram Scale',
    'Reliable gram scale for weight tracking.',
    'Pairs directly with Geck Inspect weight logs. Pick a model with 0.1g resolution for smaller juveniles.',
    'amazon',
    'breeding',
    1599,
    'https://www.amazon.com/s?k=AWS+digital+gram+scale+0.1g',
    true,
    'under_25',
    '{new_keeper,breeder,partner_of_keeper}'::text[],
    '{hatchling,juvenile,sub_adult,adult,breeder,gravid_female}'::text[],
    'standard',
    true,
    'Amazon search link kept generic until exact resolution and capacity are selected.'
  ),
  (
    'aff-brother-p-touch-label-maker',
    'Brother P-touch Label Maker',
    'Rack labels, tub IDs, clutch cards, and quarantine tags.',
    'A quietly high-value breeder tool. Works well with Geck Inspect animal IDs and project-line organization.',
    'amazon',
    'breeding',
    3499,
    'https://www.amazon.com/s?k=Brother+P-touch+label+maker',
    true,
    'under_50',
    '{breeder,partner_of_keeper}'::text[],
    '{breeder}'::text[],
    'standard',
    true,
    'Amazon search link kept generic until exact model is selected.'
  ),
  (
    'aff-digital-calipers',
    'Digital Calipers',
    'Useful for eggs, hatchlings, and record-keeping photos.',
    'For breeders who like precise measurements and repeatable photo documentation.',
    'amazon',
    'breeding',
    1999,
    'https://www.amazon.com/s?k=digital+calipers',
    true,
    'under_25',
    '{breeder,partner_of_keeper}'::text[],
    '{hatchling,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact model is selected.'
  ),

  -- Health, supplements, cleaning
  (
    'aff-repashy-calcium-plus',
    'Repashy Calcium Plus',
    'All-in-one calcium and vitamin dust for feeder insects.',
    'A common supplement for insect-feeding days. Use according to label and species-appropriate feeding plans.',
    'repashy',
    'health',
    999,
    'https://www.shop.repashy.com/products/repashy-calcium-plus',
    true,
    'under_15',
    '{new_keeper,breeder}'::text[],
    '{juvenile,sub_adult,adult,breeder,gravid_female}'::text[],
    'standard',
    false,
    'Repashy shop lists Calcium Plus from $9.99.'
  ),
  (
    'aff-f10sc-veterinary-disinfectant',
    'F10SC Veterinary Disinfectant',
    'Concentrated disinfectant for quarantine and rack cleaning.',
    'A serious cleaning pick for keepers managing quarantine, illness follow-up, or breeder rack hygiene.',
    'amazon',
    'cleaning',
    2999,
    'https://www.amazon.com/s?k=F10SC+veterinary+disinfectant',
    false,
    'under_50',
    '{breeder}'::text[],
    '{hatchling,juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact bottle size and seller are selected.'
  ),
  (
    'aff-reptile-feeding-tongs',
    'Stainless Reptile Feeding Tongs',
    'Long tongs for feeders, shed checks, and enclosure work.',
    'Simple keeper tool that belongs in every supply drawer.',
    'amazon',
    'cleaning',
    999,
    'https://www.amazon.com/s?k=stainless+reptile+feeding+tongs',
    true,
    'under_15',
    '{new_keeper,kid,partner_of_keeper}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact length and tip style are selected.'
  ),
  (
    'aff-pressure-spray-bottle',
    'Continuous Mist Spray Bottle',
    'Manual misting bottle for small collections and quarantine tubs.',
    'A cheap, non-electronic humidity tool for new keepers and backup use.',
    'amazon',
    'humidity',
    999,
    'https://www.amazon.com/s?k=continuous+mist+spray+bottle',
    true,
    'under_15',
    '{new_keeper,kid,partner_of_keeper}'::text[],
    '{hatchling,juvenile,sub_adult,adult}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact bottle is selected.'
  ),

  -- Shipping
  (
    'aff-shipyourreptiles-insulated-box-kit',
    'Insulated Reptile Shipping Box Kit',
    'Basic insulated box setup for legal, weather-aware shipping workflows.',
    'For experienced sellers only. Pair with carrier rules, weather holds, live-arrival terms, and Geck Inspect sales records.',
    'amazon',
    'shipping',
    2499,
    'https://www.amazon.com/s?k=insulated+reptile+shipping+box+kit',
    false,
    'under_50',
    '{breeder}'::text[],
    '{breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact box size and compliance notes are reviewed.'
  ),
  (
    'aff-uniheat-40-hour-packs',
    'UniHeat 40-Hour Heat Packs',
    'Cold-weather shipping supply for eligible live animal shipments.',
    'Breeder-only supply. Use only with proper temperature checks, box ventilation, and carrier/legal compliance.',
    'amazon',
    'shipping',
    1999,
    'https://www.amazon.com/s?k=UniHeat+40+hour+heat+packs',
    false,
    'under_25',
    '{breeder}'::text[],
    '{breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact pack count and seller are selected.'
  ),

  -- Photography & morph ID
  (
    'aff-portable-photo-light-box',
    'Portable Photo Light Box',
    'Consistent lighting for sale photos and morph-ID submissions.',
    'A useful bridge between marketplace listings and AI morph-ID photos. Choose a size that lets the gecko sit on safe, clean props.',
    'amazon',
    'photography',
    3999,
    'https://www.amazon.com/s?k=portable+photo+light+box',
    true,
    'under_50',
    '{breeder,partner_of_keeper}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    true,
    'Amazon search link kept generic until exact size and lighting quality are selected.'
  ),
  (
    'aff-xrite-colorchecker-gray-card',
    'Photo Gray Card / Color Reference Card',
    'Helps normalize color in morph photos.',
    'A small photography upgrade for breeders who sell online or submit training images where color accuracy matters.',
    'amazon',
    'photography',
    1199,
    'https://www.amazon.com/s?k=photo+gray+card+color+checker',
    true,
    'under_25',
    '{breeder,partner_of_keeper}'::text[],
    '{juvenile,sub_adult,adult,breeder}'::text[],
    'standard',
    false,
    'Amazon search link kept generic until exact card is selected.'
  )
) as v(
  slug_p, name_p, short_p, long_p, vendor_slug_p, category_slug_p, price_p, url_p,
  gift_p, tier_p, audience_p, stages_p, shipping_p, featured_p, note_p
)
join public.store_vendors vendor on vendor.slug = v.vendor_slug_p
join public.store_categories cat on cat.slug = v.category_slug_p
on conflict (slug) do update
   set name = excluded.name,
       short_description = excluded.short_description,
       long_description_md = excluded.long_description_md,
       vendor_id = excluded.vendor_id,
       category_id = excluded.category_id,
       fulfillment_mode = excluded.fulfillment_mode,
       shipping_class = excluded.shipping_class,
       our_price_cents = excluded.our_price_cents,
       vendor_product_url = excluded.vendor_product_url,
       vendor_extra = excluded.vendor_extra,
       gift_friendly = excluded.gift_friendly,
       price_tier = excluded.price_tier,
       gift_audience = excluded.gift_audience,
       lifecycle_stage_tags = excluded.lifecycle_stage_tags,
       is_featured = excluded.is_featured
 where public.store_products.status = 'draft';
