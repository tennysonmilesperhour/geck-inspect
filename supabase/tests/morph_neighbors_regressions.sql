-- Morph ID's reference-photo lookup on the narrow table.
-- Regression checks for supabase/migrations/20261017170000_morph_reference_vectors.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser.
-- Every change rolls back. It is not meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/morph_neighbors_regressions.sql
--
-- It checks that:
--   1. For 20 stored embeddings and several match counts, the new
--      morph_visual_neighbors returns exactly what a copy of the old query
--      (which read gecko_images) returns: the same rows in the same order,
--      the same label columns, and similarity equal to within 1e-9.
--   2. Inserting, verifying, unverifying, moving a row into the test split,
--      changing its embedding, its labels or its status, and deleting it
--      each leave morph_reference_vectors equal to the eligible
--      gecko_images rows.
--   3. Members and signed-out visitors cannot read the new table or call
--      the new helper functions.
begin;

-- The old query must be exact for the comparison: take the approximate
-- (HNSW) index out of its way inside this transaction. Production keeps the
-- index, so whether its old function was exact is checked there by
-- supabase/tests/morph_neighbors_production_check.sql before the merge.
drop index if exists public.idx_gecko_images_embedding;

-- A random but repeatable corpus: 400 photos from 40 sellers, with every
-- kind of row the filter has to drop.
select setseed(0.4217);
insert into public.gecko_images (id, image_url, primary_morph, secondary_traits, base_color,
                                 verified, training_meta, image_embedding, embedding_status)
select
  'mnr-' || lpad(i::text, 4, '0'),
  'https://ref.example.com/' || i || '.webp',
  case when i % 53 = 0 then null else (array['harlequin', 'pinstripe', 'dalmatian', 'tricolor', 'flame', 'extreme_harlequin'])[1 + i % 6] end,
  case when i % 4 = 0 then '["white_fringe"]'::jsonb when i % 9 = 0 then null else '[]'::jsonb end,
  case when i % 3 = 0 then 'red' else null end,
  i % 7 <> 0,
  jsonb_strip_nulls(jsonb_build_object(
    'geck_data_seller_slug', case when i % 5 <> 0 then ' Seller-' || (i % 40) || ' ' end,
    'geck_data_seller_name', case when i % 5 = 0 and i % 2 = 0 then 'Name ' || (i % 11) end,
    'listing_id', case when i % 5 = 0 and i % 2 = 1 and i % 3 = 0 then 'L' || i end,
    'gecko_id', case when i % 5 = 0 and i % 2 = 1 and i % 3 = 1 then 'G' || (i % 17) end,
    'provenance', (array['geck-data-scraper', 'expert_owner', 'community', 'ai_then_expert', 'expert_reviewed', ''])[1 + i % 6],
    'verification_tier', case when i % 23 = 0 then 'hero_anchor' when i % 29 = 0 then 'auto_bulk_approved' end,
    'genetic_traits', case when i % 8 = 0 then '["lily_white"]'::jsonb end,
    'geck_data_split', case when i % 11 = 0 then 'test' when i % 13 = 0 then 'val' end
  )),
  case when i % 31 = 0 then null
       -- "d * 0 + i * 0" keeps the aggregate inside the subquery and the
       -- subquery tied to the row, so each photo gets its own vector.
       else (select array_agg(random() - 0.5 + d * 0 + i * 0) from generate_series(1, 768) as d)::extensions.vector(768) end,
  case when i % 19 = 0 then 'pending' when i % 31 = 0 then 'failed' else 'ready' end
from generate_series(1, 400) as i;

-- Two photos with the same embedding (the same picture uploaded twice), so
-- an exact tie is in the set.
insert into public.gecko_images (id, image_url, primary_morph, verified, training_meta, image_embedding, embedding_status)
select 'mnr-dup-' || n, 'https://ref.example.com/dup-' || n || '.webp', 'harlequin', true,
       jsonb_build_object('geck_data_seller_slug', 'dup-seller-' || n, 'provenance', 'community'),
       (select image_embedding from public.gecko_images where id = 'mnr-0002'), 'ready'
from generate_series(1, 2) as n;

-- The old function body (20260928172832_harlequin_is_the_base.sql), reading
-- gecko_images.
create function pg_temp.old_neighbors(query_embedding extensions.vector, match_count integer default 32)
returns table(id text, image_url text, primary_morph text, genetic_traits jsonb, secondary_traits jsonb, base_color text, similarity double precision, label_weight double precision, label_source text, source_cluster text)
language sql stable as $function$
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

-- What morph_reference_vectors must hold: the eligible gecko_images rows,
-- with the old query's label expressions (copied above, not shared with
-- the migration).
create function pg_temp.expected_rows()
returns table(id text, image_url text, primary_morph text, genetic_traits jsonb, secondary_traits jsonb, base_color text, label_weight double precision, label_source text, source_cluster text, embedding text)
language sql stable as $function$
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
    g.image_embedding::text
  from public.gecko_images as g
  where g.image_embedding is not null
    and g.embedding_status = 'ready'
    and g.verified is true
    and g.primary_morph is not null
    and g.image_url is not null
    and coalesce(g.training_meta->>'geck_data_split', '') <> 'test'
$function$;

create function pg_temp.assert_in_sync(p_step text) returns void language plpgsql as $$
declare
  v_missing int;
  v_extra int;
begin
  select count(*) into v_missing from (
    select * from pg_temp.expected_rows()
    except
    select r.id, r.image_url, r.primary_morph, r.genetic_traits, r.secondary_traits, r.base_color,
           r.label_weight, r.label_source, r.source_cluster, r.embedding::text
    from public.morph_reference_vectors as r
  ) as x;
  select count(*) into v_extra from (
    select r.id, r.image_url, r.primary_morph, r.genetic_traits, r.secondary_traits, r.base_color,
           r.label_weight, r.label_source, r.source_cluster, r.embedding::text
    from public.morph_reference_vectors as r
    except
    select * from pg_temp.expected_rows()
  ) as x;
  if v_missing <> 0 or v_extra <> 0 then
    raise exception 'FAIL: after %, morph_reference_vectors is out of step (% missing, % extra)', p_step, v_missing, v_extra;
  end if;
end $$;

-- ---------------------------------------------------------------- 1. results
do $$
declare
  v_total int;
  v_eligible int;
  v_query record;
  v_count int;
  v_checked int := 0;
begin
  select count(*) into v_total from public.gecko_images where id like 'mnr-%';
  select count(*) into v_eligible from public.morph_reference_vectors where id like 'mnr-%';
  if v_eligible < 150 or v_eligible >= v_total then
    raise exception 'FAIL: the test corpus should mix eligible and ineligible rows (% of %)', v_eligible, v_total;
  end if;
  perform pg_temp.assert_in_sync('the fill');

  for v_query in
    select id, image_embedding from public.gecko_images
    where id like 'mnr-%' and image_embedding is not null
    order by id limit 20
  loop
    foreach v_count in array array[1, 8, 32, 48, 96, 200] loop
      if (select array_agg(t.id order by t.ordinality) from pg_temp.old_neighbors(v_query.image_embedding, v_count) with ordinality as t)
         is distinct from
         (select array_agg(t.id order by t.ordinality) from public.morph_visual_neighbors(v_query.image_embedding, v_count) with ordinality as t)
      then
        raise exception 'FAIL: different neighbors or order for % with match_count %', v_query.id, v_count;
      end if;
      if exists (
        select 1
        from pg_temp.old_neighbors(v_query.image_embedding, v_count) with ordinality as o
        join public.morph_visual_neighbors(v_query.image_embedding, v_count) with ordinality as n
          on n.ordinality = o.ordinality
        where o.id is distinct from n.id
           or o.image_url is distinct from n.image_url
           or o.primary_morph is distinct from n.primary_morph
           or o.genetic_traits is distinct from n.genetic_traits
           or o.secondary_traits is distinct from n.secondary_traits
           or o.base_color is distinct from n.base_color
           or o.label_weight is distinct from n.label_weight
           or o.label_source is distinct from n.label_source
           or o.source_cluster is distinct from n.source_cluster
           or abs(o.similarity - n.similarity) > 1e-9
      ) then
        raise exception 'FAIL: a neighbor for % (match_count %) differs in its labels or similarity', v_query.id, v_count;
      end if;
      v_checked := v_checked + 1;
    end loop;
  end loop;
  if v_checked <> 120 then
    raise exception 'FAIL: expected 20 query embeddings times 6 match counts, checked %', v_checked;
  end if;

  -- The exact tie (two copies of mnr-0002's photo from different sellers)
  -- comes back in id order, next to the original.
  if (select array_agg(t.id order by t.ordinality)
      from public.morph_visual_neighbors((select image_embedding from public.gecko_images where id = 'mnr-0002'), 3) with ordinality as t)
     is distinct from array['mnr-0002', 'mnr-dup-1', 'mnr-dup-2'] then
    raise exception 'FAIL: exact ties are not in id order';
  end if;
end $$;

-- ------------------------------------------------------------- 2. the trigger
insert into public.gecko_images (id, image_url, primary_morph, verified, training_meta, image_embedding, embedding_status)
values ('mnr-new', 'https://ref.example.com/new.webp', 'pinstripe', true,
        '{"geck_data_seller_slug":"fresh","provenance":"expert_owner"}',
        (select image_embedding from public.gecko_images where id = 'mnr-0003'), 'ready');
select pg_temp.assert_in_sync('an eligible insert');
do $$ begin
  if not exists (select 1 from public.morph_reference_vectors where id = 'mnr-new' and source_cluster = 'seller:fresh' and label_weight = 0.95) then
    raise exception 'FAIL: an eligible insert was not copied with its labels';
  end if;
end $$;

insert into public.gecko_images (id, image_url, primary_morph, verified, training_meta, image_embedding, embedding_status)
values ('mnr-unverified', 'https://ref.example.com/u.webp', 'flame', false, '{}',
        (select image_embedding from public.gecko_images where id = 'mnr-0004'), 'ready');
select pg_temp.assert_in_sync('an unverified insert');

update public.gecko_images set verified = true where id = 'mnr-unverified';
select pg_temp.assert_in_sync('verifying a row');
do $$ begin
  if not exists (select 1 from public.morph_reference_vectors where id = 'mnr-unverified') then
    raise exception 'FAIL: a verified row was not added';
  end if;
end $$;

update public.gecko_images set verified = false where id = 'mnr-new';
select pg_temp.assert_in_sync('unverifying a row');

update public.gecko_images set verified = true where id = 'mnr-new';
update public.gecko_images set training_meta = training_meta || '{"geck_data_split":"test"}' where id = 'mnr-new';
select pg_temp.assert_in_sync('moving a row into the test split');
do $$ begin
  if exists (select 1 from public.morph_reference_vectors where id = 'mnr-new') then
    raise exception 'FAIL: a test-split row stayed in the reference table';
  end if;
end $$;

update public.gecko_images set training_meta = training_meta - 'geck_data_split' where id = 'mnr-new';
update public.gecko_images
   set image_embedding = (select image_embedding from public.gecko_images where id = 'mnr-0005')
 where id = 'mnr-new';
select pg_temp.assert_in_sync('changing an embedding');

update public.gecko_images
   set training_meta = training_meta || '{"geck_data_seller_slug":"renamed","verification_tier":"hero_anchor"}',
       secondary_traits = '["portholes"]', base_color = 'dark', primary_morph = 'harlequin'
 where id = 'mnr-new';
select pg_temp.assert_in_sync('changing labels');

update public.gecko_images set embedding_status = 'failed' where id = 'mnr-0006';
select pg_temp.assert_in_sync('a failed embedding status');

update public.gecko_images set image_embedding = null where id = 'mnr-0008';
select pg_temp.assert_in_sync('a removed embedding');

update public.gecko_images set primary_morph = null where id = 'mnr-0010';
select pg_temp.assert_in_sync('a removed pattern');

update public.gecko_images set notes = 'only a note' where id = 'mnr-0012';
select pg_temp.assert_in_sync('an unrelated update');

update public.gecko_images set id = 'mnr-renamed' where id = 'mnr-0014';
select pg_temp.assert_in_sync('a changed id');

delete from public.gecko_images where id in ('mnr-new', 'mnr-0016');
select pg_temp.assert_in_sync('deleting rows');

-- ------------------------------------------------------------- 3. exposure
do $$ begin
  if has_table_privilege('anon', 'public.morph_reference_vectors', 'select')
     or has_table_privilege('authenticated', 'public.morph_reference_vectors', 'select') then
    raise exception 'FAIL: members or visitors can read morph_reference_vectors';
  end if;
  if not has_table_privilege('service_role', 'public.morph_reference_vectors', 'select') then
    raise exception 'FAIL: the service role cannot read morph_reference_vectors';
  end if;
  if has_function_privilege('anon', 'public.morph_reference_row(public.gecko_images)', 'execute')
     or has_function_privilege('authenticated', 'public.morph_reference_row(public.gecko_images)', 'execute')
     or has_function_privilege('authenticated', 'public.sync_morph_reference_vector()', 'execute') then
    raise exception 'FAIL: members or visitors can call the reference helpers';
  end if;
  if (select relrowsecurity from pg_class where oid = 'public.morph_reference_vectors'::regclass) is not true then
    raise exception 'FAIL: row level security is off on morph_reference_vectors';
  end if;
  if (select attstorage from pg_attribute
      where attrelid = 'public.morph_reference_vectors'::regclass and attname = 'embedding') <> 'p' then
    raise exception 'FAIL: the embedding is not stored in the row (STORAGE PLAIN)';
  end if;
end $$;

rollback;
