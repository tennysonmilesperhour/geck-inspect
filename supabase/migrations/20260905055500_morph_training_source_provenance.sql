-- Carry breeder identity with future raw-data imports. This lets Morph ID
-- evaluate and retrieve across independent sellers instead of learning one
-- shop's lighting/background or counting its catalog repeatedly.

create or replace view geck_data.v_morph_training_canonical as
with rows as (
  select v.image_url, v.listing_id, v.traits, v.sex, v.maturity,
         v.price, v.currency, v.source, v.split,
         l.seller_name, l.seller_slug
  from geck_data.v_morph_training v
  left join geck_data.listings l on l.listing_id = v.listing_id
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
  traits as original_traits,
  seller_name,
  seller_slug
from mapped
where (primary_morph_ids)[1] is not null;

comment on view geck_data.v_morph_training_canonical is
  'Canonical weak-label Morph ID rows with listing and breeder provenance for source-independent retrieval and evaluation.';
