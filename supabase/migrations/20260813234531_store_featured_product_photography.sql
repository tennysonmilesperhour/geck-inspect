-- Original Geck Inspect catalog photography for the featured Amazon essentials.
-- These images depict the product type without reproducing vendor packaging.
update public.store_products as product
set images = jsonb_build_array(
  jsonb_build_object(
    'url', '/store/products/' || photo.file_name,
    'alt', photo.alt_text,
    'is_primary', true,
    'kind', 'representative',
    'source', 'geck_inspect_original'
  )
)
from (
  values
    ('aff-kitchen-gram-scale-amazon', 'digital-gram-scale.jpg', 'Digital gram scale with a ventilated weighing cup'),
    ('aff-artificial-vines-amazon', 'artificial-reptile-vines.jpg', 'Coiled artificial reptile vines with green leaves'),
    ('aff-hanging-foliage-amazon', 'hanging-reptile-foliage.jpg', 'Hanging artificial reptile foliage with a suction cup'),
    ('aff-pangea-small-cups-amazon', 'small-gecko-feeding-cups.jpg', 'Small disposable gecko feeding cups'),
    ('aff-pangea-large-cups-amazon', 'large-gecko-feeding-cups.jpg', 'Large disposable gecko feeding cups'),
    ('aff-magnetic-feeding-ledge-amazon', 'magnetic-gecko-feeding-ledge.jpg', 'Magnetic gecko feeding ledge with two cups'),
    ('aff-cork-bark-flats-amazon', 'natural-cork-bark-flats.jpg', 'Natural cork bark flats for terrarium hardscape'),
    ('aff-cork-bark-rounds-amazon', 'natural-cork-bark-rounds.jpg', 'Natural hollow cork bark rounds'),
    ('aff-pangea-fig-insects-amazon', 'fig-insects-gecko-diet.jpg', 'Representative fig and insect crested gecko diet pouch'),
    ('aff-pangea-watermelon-amazon', 'watermelon-gecko-diet.jpg', 'Representative watermelon crested gecko diet pouch'),
    ('aff-pangea-insects-amazon', 'insect-protein-gecko-diet.jpg', 'Representative insect protein crested gecko diet pouch'),
    ('aff-repashy-cgd-amazon', 'crested-gecko-mrp.jpg', 'Representative crested gecko meal replacement powder jar'),
    ('aff-18x18x24-terrarium-amazon', '18x18x24-glass-terrarium.jpg', 'Front-opening 18 by 18 by 24 inch glass terrarium'),
    ('aff-24x18x36-enclosure-amazon', '24x18x36-arboreal-enclosure.jpg', 'Tall 24 by 18 by 36 inch arboreal enclosure'),
    ('aff-zilla-vertical-tropical-kit-amazon', 'vertical-tropical-starter-kit.jpg', 'Vertical tropical enclosure with starter accessories'),
    ('aff-continuous-mist-bottle-amazon', 'continuous-mist-spray-bottle.jpg', 'Continuous fine-mist spray bottle'),
    ('aff-govee-wifi-hygrometer-amazon', 'wifi-thermometer-hygrometer.jpg', 'Digital thermometer and hygrometer with phone graph'),
    ('aff-abg-substrate-amazon', 'abg-bioactive-substrate.jpg', 'Coarse ABG-style bioactive substrate mix'),
    ('aff-coco-fiber-brick-amazon', 'coco-fiber-substrate-brick.jpg', 'Compressed coco fiber substrate bricks'),
    ('aff-sphagnum-moss-amazon', 'long-fiber-sphagnum-moss.jpg', 'Long-fiber sphagnum moss'),
    ('aff-magnolia-leaf-litter-amazon', 'magnolia-leaf-litter.jpg', 'Dry magnolia leaf litter')
) as photo(slug, file_name, alt_text)
where product.slug = photo.slug
  and product.status = 'active';
