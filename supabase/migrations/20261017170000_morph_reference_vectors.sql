-- Morph ID's reference-photo lookup reads a narrow table (17 Oct 2026).
--
-- morph_visual_neighbors (migration 20260928172832_harlequin_is_the_base.sql)
-- scanned every eligible gecko_images row, and for each one read the 3 KB
-- photo fingerprint (embedding) from out-of-line storage plus the whole
-- training_meta JSON for the filter and the label columns: about 11,000
-- buffer reads and 280 to 581 ms on the server per Morph ID request, 0.5 to
-- 2.3 s at the edge under load.
--
-- public.morph_reference_vectors holds only the eligible rows (the same
-- filter), with the label columns worked out once and the embedding stored
-- in the row (STORAGE PLAIN, and a row size target that keeps every column
-- in the row). A trigger on gecko_images keeps it in step on insert, update
-- and delete, and this migration fills it once.
--
-- morph_visual_neighbors keeps its name, arguments, result columns, exact
-- ordering (distance, then id), one-per-source pick and limits; only the
-- table it reads changes. No approximate (HNSW) index and no lower-precision
-- vector: the answer must be the same rows in the same order
-- (supabase/tests/morph_neighbors_regressions.sql checks it against a copy
-- of the old query reading every row). Whether production's old function
-- read every row, or used the approximate idx_gecko_images_embedding index,
-- EXPLAIN cannot show (a function with a SET clause is never inlined), so
-- supabase/tests/morph_neighbors_production_check.sql compares its answers
-- with the exact ones on production before this file is merged
-- (docs/planning/deploy-queue-2026-10-03.md). The app version open in
-- members' browsers and the deployed function both keep working, and the
-- function's grants (service role only) are kept by CREATE OR REPLACE.
--
-- Safe to run twice.

create table if not exists public.morph_reference_vectors (
  id text primary key,
  image_url text not null,
  primary_morph text not null,
  genetic_traits jsonb not null,
  secondary_traits jsonb not null,
  base_color text,
  label_weight double precision not null,
  label_source text not null,
  source_cluster text not null,
  embedding extensions.vector(768) not null
) with (toast_tuple_target = 8160);

-- Keep the 3 KB vector in the row instead of out-of-line storage, so the
-- scan reads about one page per two rows and decompresses nothing.
alter table public.morph_reference_vectors alter column embedding set storage plain;

comment on table public.morph_reference_vectors is
  'Morph ID reference photos (verified, embedded, outside the test split) with their labels precomputed and the embedding in the row. Kept in step with gecko_images by trigger gecko_images_sync_morph_reference; read only by morph_visual_neighbors (service role).';

-- Read only through morph_visual_neighbors, which the service role calls.
alter table public.morph_reference_vectors enable row level security;
revoke all on table public.morph_reference_vectors from public, anon, authenticated;
grant select on table public.morph_reference_vectors to service_role;

-- One gecko_images row as a reference row, or no row when it is not
-- eligible. The filter and the label expressions are the ones the old
-- morph_visual_neighbors applied per query; the trigger and the fill below
-- both use this, so they cannot drift apart.
create or replace function public.morph_reference_row(g public.gecko_images)
returns table(
  id text,
  image_url text,
  primary_morph text,
  genetic_traits jsonb,
  secondary_traits jsonb,
  base_color text,
  label_weight double precision,
  label_source text,
  source_cluster text,
  embedding extensions.vector
)
language sql
stable
set search_path to ''
as $function$
  select
    g.id,
    g.image_url,
    g.primary_morph,
    coalesce(g.training_meta->'genetic_traits', '[]'::jsonb),
    coalesce(g.secondary_traits, '[]'::jsonb),
    g.base_color,
    case
      when g.training_meta->>'verification_tier' = 'hero_anchor' then 1.0
      when g.training_meta->>'provenance' in ('expert_owner', 'expert_reviewed') then 0.95
      when g.training_meta->>'provenance' = 'geck-data-scraper' then 0.90
      when g.training_meta->>'provenance' = 'ai_then_expert' then 0.85
      when g.training_meta->>'provenance' = 'community' then 0.60
      when g.training_meta->>'verification_tier' = 'auto_bulk_approved' then 0.40
      else 0.50
    end::double precision,
    coalesce(
      nullif(g.training_meta->>'verification_tier', ''),
      nullif(g.training_meta->>'provenance', ''),
      'unclassified'
    ),
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
    end,
    g.image_embedding
  where g.image_embedding is not null
    and g.embedding_status = 'ready'
    and g.verified is true
    and g.primary_morph is not null
    and g.image_url is not null
    and coalesce(g.training_meta->>'geck_data_split', '') <> 'test';
$function$;

revoke all on function public.morph_reference_row(public.gecko_images) from public, anon, authenticated;

-- Keeps morph_reference_vectors equal to the eligible gecko_images rows.
-- SECURITY DEFINER: members insert and edit their own gecko_images rows
-- under RLS, and the copy must follow whoever made the change.
create or replace function public.sync_morph_reference_vector()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.morph_reference_vectors where id = old.id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.morph_reference_vectors (
      id, image_url, primary_morph, genetic_traits, secondary_traits, base_color,
      label_weight, label_source, source_cluster, embedding
    )
    select s.id, s.image_url, s.primary_morph, s.genetic_traits, s.secondary_traits, s.base_color,
      s.label_weight, s.label_source, s.source_cluster, s.embedding
    from public.morph_reference_row(new) as s;
  end if;
  return null;
end;
$function$;

revoke all on function public.sync_morph_reference_vector() from public, anon, authenticated;

drop trigger if exists gecko_images_sync_morph_reference on public.gecko_images;
create trigger gecko_images_sync_morph_reference
  after insert or delete or update of
    id, image_url, primary_morph, secondary_traits, base_color, verified,
    training_meta, image_embedding, embedding_status
  on public.gecko_images
  for each row execute function public.sync_morph_reference_vector();

-- Fill it from scratch (a second run rebuilds it the same way). The trigger
-- above already exists, so nothing written meanwhile is missed.
delete from public.morph_reference_vectors;
insert into public.morph_reference_vectors (
  id, image_url, primary_morph, genetic_traits, secondary_traits, base_color,
  label_weight, label_source, source_cluster, embedding
)
select s.id, s.image_url, s.primary_morph, s.genetic_traits, s.secondary_traits, s.base_color,
  s.label_weight, s.label_source, s.source_cluster, s.embedding
from public.gecko_images as g
cross join lateral public.morph_reference_row(g) as s;

analyze public.morph_reference_vectors;

-- The same function, reading the narrow table. Signature, result columns,
-- ordering and limits are those of 20260928172832_harlequin_is_the_base.sql;
-- "r.id" after the distance only fixes the order of exact ties, which the
-- old scan left to chance.
create or replace function public.morph_visual_neighbors(query_embedding extensions.vector, match_count integer default 32)
returns table(id text, image_url text, primary_morph text, genetic_traits jsonb, secondary_traits jsonb, base_color text, similarity double precision, label_weight double precision, label_source text, source_cluster text)
language sql
stable
set search_path to ''
as $function$
  with nearest as materialized (
    select
      r.id,
      r.image_url,
      r.primary_morph,
      r.genetic_traits,
      r.secondary_traits,
      r.base_color,
      r.embedding operator(extensions.<=>) query_embedding as distance,
      r.label_weight,
      r.label_source,
      r.source_cluster
    from public.morph_reference_vectors as r
    order by r.embedding operator(extensions.<=>) query_embedding, r.id
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
