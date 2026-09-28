-- Harlequin is the base pattern (Tennyson's call, 28 Sep). Harlequin is so
-- common that it sits under most other patterns, and any other pattern the
-- breeder tagged takes the main label: "Harlequin, Pinstripe" is a
-- Pinstripe, "Harlequin, Tricolor" is a Tricolor. Extreme and Super
-- Harlequin are their own morphs and keep the main label over any other
-- pattern. The breeder's full list stays in training_meta.breeder_patterns,
-- so evaluation still accepts every pattern the breeder tagged.
--
-- Also: breeder tags are high-quality labels (28 Sep), so the photo lookup
-- weighs scraped breeder photos at 0.90 instead of 0.40.

create or replace function geck_data.pick_primary_morph(ids text[])
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when ids && array['super_harlequin'] then 'super_harlequin'
    when ids && array['extreme_harlequin'] then 'extreme_harlequin'
    else (
      select min(x)
        from unnest(ids) as x
       where not (
             (x = 'harlequin' and exists (select 1 from unnest(ids) as y where y <> 'harlequin'))
          or (x = 'dalmatian' and ids && array['super_dalmatian', 'red_dalmatian'])
          or (x = 'pinstripe' and ids && array['full_pinstripe', 'partial_pinstripe', 'phantom_pinstripe', 'reverse_pinstripe'])
          or (x = 'tiger' and ids && array['super_tiger'])
          or (x = 'brindle' and ids && array['extreme_brindle'])
          or (x = 'flame' and ids && array['chevron_flame'])
       )
    )
  end;
$$;

-- Re-pick the main label on scraped photos from the breeder's own list.
-- 372 photos move (143 Harlequin to Pinstripe, 101 to Tricolor, 65 to
-- Partial Pinstripe, 46 Brindle or Dalmatian to Extreme Harlequin, and a
-- few others). Each keeps its previous label.
with s as (
  select g.id, g.primary_morph as old_pm,
    geck_data.pick_primary_morph(array(
      select jsonb_array_elements_text(g.training_meta->'breeder_patterns'))) as new_pm
  from public.gecko_images g
  where g.created_by is null
    and g.training_meta ? 'breeder_patterns'
    and jsonb_array_length(g.training_meta->'breeder_patterns') > 0
)
update public.gecko_images g
   set primary_morph = s.new_pm,
       training_meta = g.training_meta
         || jsonb_build_object('primary_morph_before_harlequin_base', s.old_pm)
  from s
 where s.id = g.id
   and s.new_pm is not null
   and s.new_pm is distinct from s.old_pm;

create or replace function public.morph_visual_neighbors(query_embedding extensions.vector, match_count integer default 32)
returns table(id text, image_url text, primary_morph text, genetic_traits jsonb, secondary_traits jsonb, base_color text, similarity double precision, label_weight double precision, label_source text, source_cluster text)
language sql
stable
set search_path to ''
as $function$
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
        when g.training_meta->>'provenance' = 'geck-data-scraper' then 0.90
        when g.training_meta->>'provenance' = 'ai_then_expert' then 0.85
        when g.training_meta->>'provenance' = 'community' then 0.60
        when g.training_meta->>'verification_tier' = 'auto_bulk_approved' then 0.40
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
      and coalesce(g.training_meta->>'geck_data_split', '') <> 'test'
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
$function$;
