-- Does production's morph_visual_neighbors return the exact nearest
-- reference photos? A read-only check for the Supabase SQL editor, to run
-- before merging 20261017170000_morph_reference_vectors.sql and again after
-- (docs/planning/deploy-queue-2026-10-03.md, "Morph ID speed", step 2).
--
-- Why a comparison and not EXPLAIN: morph_visual_neighbors has
-- "set search_path to ''", and Postgres never inlines a function with a SET
-- clause, so EXPLAIN on a call to it shows one "Function Scan" node and
-- nothing about whether the query inside used the approximate (HNSW) index
-- idx_gecko_images_embedding. So this compares what the function returns
-- with the exact answer worked out next to it.
--
-- For 20 stored embeddings it asks morph_visual_neighbors(embedding, 48),
-- the call Morph ID makes, and works out the exact answer from gecko_images
-- with the function's own filter, labels, limits and order. The "+ 0" on the
-- distance keeps the HNSW index out of the exact side, so every eligible row
-- is compared there.
--
-- One row comes back. "different" counts the embeddings whose reference
-- photos (which ones, and in what order) are not the exact ones.
--   different = 0: the function is exact. Before the migration, that means
--     the old function was exact, and the new one (proved equal to the exact
--     old query by morph_neighbors_regressions.sql) returns the same photos.
--   different > 0: before the migration, the old function was approximate
--     and the new one would change Morph ID's reference photos. Do not merge.
--
-- It reads only, and takes about 10 to 30 seconds (two scans of every
-- reference photo for each embedding). If the editor times out, change
-- "limit 20" to "limit 10". In CI it runs on an empty schema copy, which
-- checks only that it still parses and plans.
with samples as (
  select g.id as sample_id, g.image_embedding as e
  from public.gecko_images as g
  where g.image_embedding is not null
    and g.embedding_status = 'ready'
    and g.verified is true
  order by md5(g.id)
  limit 20
),
live as (
  select s.sample_id, string_agg(n.id, ',' order by n.ordinality) as ids
  from samples as s
  cross join lateral public.morph_visual_neighbors(s.e, 48) with ordinality as n
  group by s.sample_id
),
exact as (
  select s.sample_id, string_agg(p.id, ',' order by p.distance, p.id) as ids
  from samples as s
  cross join lateral (
    select c.id, c.distance
    from (
      select k.id, k.distance,
        row_number() over (partition by k.source_cluster order by k.distance, k.id) as source_rank
      from (
        select
          g.id,
          g.image_embedding operator(extensions.<=>) s.e as distance,
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
        -- The function's candidate pool for match_count 48:
        -- greatest(96, least(48 * 24, 2000)) = 1152.
        order by (g.image_embedding operator(extensions.<=>) s.e) + 0, g.id
        limit 1152
      ) as k
    ) as c
    where c.source_rank = 1
    order by c.distance, c.id
    limit 48
  ) as p
  group by s.sample_id
)
select
  count(*) as samples,
  count(*) filter (where live.ids is distinct from exact.ids) as different,
  case
    when count(*) = 0 then 'no stored embeddings to check'
    when count(*) filter (where live.ids is distinct from exact.ids) = 0 then 'exact: same reference photos in the same order'
    else 'NOT exact: do not merge the migration yet'
  end as verdict
from samples as s
left join live using (sample_id)
left join exact using (sample_id);
