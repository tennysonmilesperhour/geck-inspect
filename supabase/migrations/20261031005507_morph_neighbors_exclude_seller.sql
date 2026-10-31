-- Morph ID evaluation: a reference-photo lookup that can leave out the
-- seller of the gecko being graded.
--
-- Why: the accuracy figure in docs/morph-id-eval/README.md leaks. When a test
-- gecko is graded, the photo lookup can find other geckos from the same
-- seller (same background, lighting and naming habits), which a member's own
-- phone photo never can. Step 1 of the plan in that README asks for a lookup
-- that excludes the query's seller while grading.
--
-- How: a NEW function, morph_visual_neighbors_excluding_seller. It is the
-- body of public.morph_visual_neighbors as it runs on production on
-- 31 Oct 2026 (read with pg_get_functiondef; the same as
-- 20260928172832_harlequin_is_the_base.sql), with one added filter. It does
-- not add an argument to morph_visual_neighbors itself, because a second
-- signature with a defaulted third argument would make the live two-argument
-- call from recognize-gecko-morph ambiguous ("function is not unique"), and
-- Morph ID would lose its reference photos until the next deploy.
-- morph_visual_neighbors is not touched, so production calls are unchanged.
--
-- exclude_seller_of_listing is a marketplace listing id
-- (training_meta->>'geck_data_listing_id'). Every reference photo whose
-- seller name or seller slug matches that listing's seller is left out, and
-- so is the listing itself. The argument is a listing id, not a seller name,
-- so an evaluation manifest never needs to carry seller names. With the
-- argument null (the default) the function returns exactly what
-- morph_visual_neighbors returns.
--
-- Service role only, like morph_visual_neighbors. Idempotent: create or
-- replace, then revoke and grant.

create or replace function public.morph_visual_neighbors_excluding_seller(
  query_embedding extensions.vector,
  match_count integer default 32,
  exclude_seller_of_listing text default null
)
returns table(id text, image_url text, primary_morph text, genetic_traits jsonb, secondary_traits jsonb, base_color text, similarity double precision, label_weight double precision, label_source text, source_cluster text)
language sql
stable
set search_path to ''
as $function$
  with excluded as materialized (
    select distinct
      nullif(lower(trim(x.training_meta->>'geck_data_seller_name')), '') as seller_name,
      nullif(lower(trim(x.training_meta->>'geck_data_seller_slug')), '') as seller_slug
    from public.gecko_images as x
    where exclude_seller_of_listing is not null
      and x.training_meta->>'geck_data_listing_id' = exclude_seller_of_listing
  ), nearest as materialized (
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
      -- The one addition: leave out the graded listing and its seller.
      and (
        exclude_seller_of_listing is null
        or (
          coalesce(g.training_meta->>'geck_data_listing_id', '') <> exclude_seller_of_listing
          and not exists (
            select 1
            from excluded as e
            where (e.seller_name is not null
                   and lower(trim(g.training_meta->>'geck_data_seller_name')) = e.seller_name)
               or (e.seller_slug is not null
                   and lower(trim(g.training_meta->>'geck_data_seller_slug')) = e.seller_slug)
          )
        )
      )
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

comment on function public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text) is
  'Morph ID evaluation only. morph_visual_neighbors with an optional listing id whose seller is left out of the reference photos, so grading cannot match a gecko to its own seller''s photos. Null returns the same rows as morph_visual_neighbors. Service role only.';

revoke all on function public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text) from public;
revoke all on function public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text) from anon;
revoke all on function public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text) from authenticated;
grant execute on function public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text) to service_role;
