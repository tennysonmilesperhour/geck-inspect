-- MorphMarket listing photos carry trait tags the breeder chose for their own
-- animal. When a breeder's tags mapped to more than one pattern class, the
-- import view kept primary_morph_ids[1] of a DISTINCT aggregate, which is
-- alphabetical. So a breeder's "Dalmatian" + "Super Dalmatian" became
-- dalmatian (116 photos), and a third of all photos (1,291) got whichever of
-- their tagged patterns sorts first. That was our conversion, not the breeder.
--
-- 1. pick_primary_morph drops a general pattern when the breeder also tagged
--    its stronger form (super/extreme/full, the pinstripe variants, and so
--    on). Across different pattern families it keeps the previous rule, since
--    the breeder did not rank them.
-- 2. Every scraped photo keeps the breeder's full pattern list in
--    training_meta.breeder_patterns, so evaluation can count a prediction as
--    right when it matches any pattern the breeder tagged.
-- 3. Relabeled rows keep their old label in training_meta.primary_morph_before_20260928.
-- 4. Visual retrieval skips the held-out test split (220 listings), so a
--    Morph ID evaluation on that split cannot retrieve the same gecko.

create or replace function geck_data.pick_primary_morph(ids text[])
returns text
language sql
immutable
set search_path to ''
as $$
  select min(x)
    from unnest(ids) as x
   where not (
         (x = 'dalmatian' and ids && array['super_dalmatian', 'red_dalmatian'])
      or (x = 'harlequin' and ids && array['extreme_harlequin', 'super_harlequin'])
      or (x = 'extreme_harlequin' and ids && array['super_harlequin'])
      or (x = 'pinstripe' and ids && array['full_pinstripe', 'partial_pinstripe', 'phantom_pinstripe', 'reverse_pinstripe'])
      or (x = 'tiger' and ids && array['super_tiger'])
      or (x = 'brindle' and ids && array['extreme_brindle'])
      or (x = 'flame' and ids && array['chevron_flame'])
   );
$$;

create or replace view geck_data.v_morph_training_canonical as
 with rows as (
         select v.image_url, v.listing_id, v.traits, v.sex, v.maturity, v.price,
                v.currency, v.source, v.split, l.seller_name, l.seller_slug
           from geck_data.v_morph_training v
           left join geck_data.listings l on l.listing_id = v.listing_id
          where array_length(coalesce(v.traits, '{}'::text[]), 1) > 0
        ), mapped as (
         select r.image_url, r.listing_id, r.traits, r.sex, r.maturity, r.price,
                r.currency, r.source, r.split, r.seller_name, r.seller_slug,
            (select array_agg(distinct c.canonical_id order by c.canonical_id)
               from unnest(r.traits) t(t)
               join geck_data.crested_morph_taxonomy c on c.canonical_name = t.t
              where c.canonical_id is not null and c.trait_kind = 'primary_morph') as primary_morph_ids,
            (select array_agg(distinct c.canonical_id)
               from unnest(r.traits) t(t)
               join geck_data.crested_morph_taxonomy c on c.canonical_name = t.t
              where c.canonical_id is not null and c.trait_kind = 'genetic_trait') as genetic_trait_ids,
            (select array_agg(distinct c.canonical_id)
               from unnest(r.traits) t(t)
               join geck_data.crested_morph_taxonomy c on c.canonical_name = t.t
              where c.canonical_id is not null and c.trait_kind = 'secondary_trait') as secondary_trait_ids,
            (select c.canonical_id
               from unnest(r.traits) t(t)
               join geck_data.crested_morph_taxonomy c on c.canonical_name = t.t
              where c.canonical_id is not null and c.trait_kind = 'base_color'
              limit 1) as base_color_id
           from rows r
        )
 select image_url,
        listing_id,
        geck_data.pick_primary_morph(primary_morph_ids) as primary_morph,
        coalesce(genetic_trait_ids, '{}'::text[]) as genetic_traits,
        coalesce(secondary_trait_ids, '{}'::text[]) as secondary_traits,
        base_color_id as base_color,
        sex, maturity, price, currency, source, split,
        traits as original_traits,
        seller_name,
        seller_slug,
        coalesce(primary_morph_ids, '{}'::text[]) as breeder_patterns
   from mapped
  where primary_morph_ids[1] is not null;

with s as (
  select g.id, g.primary_morph as old_pm,
    (select array_agg(distinct c.canonical_id order by c.canonical_id)
       from jsonb_array_elements_text(g.training_meta->'scraper_traits') t
       join geck_data.crested_morph_taxonomy c on c.canonical_name = t
      where c.trait_kind = 'primary_morph' and c.canonical_id is not null) as pms
  from public.gecko_images g
  where g.created_by is null
    and g.primary_morph is not null
    and g.training_meta ? 'scraper_traits'
)
update public.gecko_images g
   set training_meta = g.training_meta
         || jsonb_build_object('breeder_patterns', to_jsonb(s.pms))
         || case when geck_data.pick_primary_morph(s.pms) is distinct from s.old_pm
                 then jsonb_build_object('primary_morph_before_20260928', s.old_pm)
                 else '{}'::jsonb end,
       primary_morph = coalesce(geck_data.pick_primary_morph(s.pms), g.primary_morph)
  from s
 where s.id = g.id
   and s.pms is not null;

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