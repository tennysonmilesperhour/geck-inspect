-- The expanded embedding bank contains many animals per seller. Return only
-- the closest animal from each seller/listing source so one breeder's camera
-- style or naming habits cannot crowd the evidence shown to Morph ID.

create or replace function public.morph_visual_neighbors(
  query_embedding extensions.vector(768),
  match_count integer default 32
) returns table (
  id text,
  image_url text,
  primary_morph text,
  genetic_traits jsonb,
  secondary_traits jsonb,
  base_color text,
  similarity double precision,
  label_weight double precision,
  label_source text,
  source_cluster text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with nearest as materialized (
    select
      g.id,
      g.image_url,
      g.primary_morph,
      coalesce(g.training_meta->'genetic_traits', '[]'::jsonb) as genetic_traits,
      coalesce(g.secondary_traits, '[]'::jsonb) as secondary_traits,
      g.base_color,
      g.image_embedding operator(extensions.<=>) query_embedding as distance,
      case
        when g.training_meta->>'verification_tier' = 'hero_anchor' then 1.0
        when g.training_meta->>'provenance' in ('expert_owner', 'expert_reviewed') then 0.95
        when g.training_meta->>'provenance' = 'ai_then_expert' then 0.85
        when g.training_meta->>'provenance' = 'community' then 0.60
        when g.training_meta->>'verification_tier' = 'auto_bulk_approved' then 0.40
        when g.training_meta->>'provenance' = 'geck-data-scraper' then 0.40
        else 0.50
      end::double precision as label_weight,
      coalesce(
        nullif(g.training_meta->>'verification_tier', ''),
        nullif(g.training_meta->>'provenance', ''),
        'unclassified'
      ) as label_source,
      case
        when nullif(trim(g.training_meta->>'geck_data_seller_slug'), '') is not null
          then 'seller:' || lower(trim(g.training_meta->>'geck_data_seller_slug'))
        when nullif(trim(g.training_meta->>'geck_data_seller_name'), '') is not null
          then 'seller:' || lower(trim(g.training_meta->>'geck_data_seller_name'))
        when nullif(g.training_meta->>'listing_id', '') is not null
          then 'listing:' || (g.training_meta->>'listing_id')
        when nullif(g.training_meta->>'geck_data_listing_id', '') is not null
          then 'listing:' || (g.training_meta->>'geck_data_listing_id')
        when nullif(g.training_meta->>'gecko_id', '') is not null
          then 'gecko:' || (g.training_meta->>'gecko_id')
        else g.id
      end as source_cluster
    from public.gecko_images as g
    where g.image_embedding is not null
      and g.embedding_status = 'ready'
      and g.verified is true
      and g.primary_morph is not null
      and g.image_url is not null
    order by g.image_embedding operator(extensions.<=>) query_embedding
    limit greatest(96, least(greatest(match_count, 1) * 24, 2000))
  ), independent as (
    select nearest.*,
      row_number() over (
        partition by nearest.source_cluster
        order by nearest.distance, nearest.id
      ) as source_rank
    from nearest
  )
  select
    independent.id,
    independent.image_url,
    independent.primary_morph,
    independent.genetic_traits,
    independent.secondary_traits,
    independent.base_color,
    1 - independent.distance as similarity,
    independent.label_weight,
    independent.label_source,
    independent.source_cluster
  from independent
  where independent.source_rank = 1
  order by independent.distance, independent.id
  limit greatest(1, least(match_count, 96));
$$;

revoke all on function public.morph_visual_neighbors(extensions.vector, integer)
  from public, anon, authenticated;
grant execute on function public.morph_visual_neighbors(extensions.vector, integer)
  to service_role;

comment on function public.morph_visual_neighbors(extensions.vector, integer) is
  'Service-only Morph ID retrieval. Returns at most one neighbor per independent seller/listing source and exposes provenance weights.';
