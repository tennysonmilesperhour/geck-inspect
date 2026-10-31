-- Regression checks for
-- supabase/migrations/20261031005507_morph_neighbors_exclude_seller.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser.
-- Every change rolls back. It is not meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/morph_neighbors_exclude_seller_regressions.sql
--
-- It checks that morph_visual_neighbors_excluding_seller:
--   1. with no listing given, returns exactly what morph_visual_neighbors returns;
--   2. with a listing given, leaves out that listing and every photo from its
--      seller, matched by seller name or by seller slug;
--   3. still leaves out the old test split and keeps other sellers;
--   4. is callable by the service role only.
begin;

create function pg_temp.vec(p_first real, p_second real) returns extensions.vector
language sql immutable as $$
  select ('[' || p_first || ',' || p_second || ',' ||
          array_to_string(array_fill(1::real, array[766]), ',') || ']')::extensions.vector
$$;

insert into public.gecko_images (id, image_url, primary_morph, verified, embedding_status, image_embedding, training_meta)
values
  -- The graded listing and two more from the same seller (one matched by name,
  -- one only by slug).
  ('t-alpha-1', 'https://example.com/a1.webp', 'harlequin', true, 'ready', pg_temp.vec(1, 1),
     '{"geck_data_listing_id":"L1","geck_data_seller_name":"Alpha Geckos","geck_data_seller_slug":"alphageckos","geck_data_split":"val"}'),
  ('t-alpha-2', 'https://example.com/a2.webp', 'harlequin', true, 'ready', pg_temp.vec(1.01, 1),
     '{"geck_data_listing_id":"L2","geck_data_seller_name":" alpha geckos ","geck_data_split":"train"}'),
  ('t-alpha-3', 'https://example.com/a3.webp', 'tricolor', true, 'ready', pg_temp.vec(1.02, 1),
     '{"geck_data_listing_id":"L3","geck_data_seller_name":"Alpha Reptiles","geck_data_seller_slug":"AlphaGeckos","geck_data_split":"train"}'),
  -- Other sellers.
  ('t-beta-1', 'https://example.com/b1.webp', 'dalmatian', true, 'ready', pg_temp.vec(1.5, 1),
     '{"geck_data_listing_id":"L4","geck_data_seller_name":"Beta Crested","geck_data_split":"train"}'),
  ('t-gamma-1', 'https://example.com/g1.webp', 'pinstripe', true, 'ready', pg_temp.vec(2, 1),
     '{"geck_data_listing_id":"L5","geck_data_seller_name":"Gamma Geckos","geck_data_split":"train"}'),
  -- In the old test split: never a reference photo.
  ('t-delta-1', 'https://example.com/d1.webp', 'tiger', true, 'ready', pg_temp.vec(1, 1),
     '{"geck_data_listing_id":"L6","geck_data_seller_name":"Delta","geck_data_split":"test"}');

do $$
declare
  q extensions.vector := pg_temp.vec(1, 1);
  v_old text;
  v_new text;
  v_ex text;
begin
  select string_agg(id || ':' || round(similarity::numeric, 6), ',' order by ord)
    into v_old
    from public.morph_visual_neighbors(q, 48) with ordinality as n(id, image_url, primary_morph, genetic_traits, secondary_traits, base_color, similarity, label_weight, label_source, source_cluster, ord)
   where id like 't-%';
  select string_agg(id || ':' || round(similarity::numeric, 6), ',' order by ord)
    into v_new
    from public.morph_visual_neighbors_excluding_seller(q, 48) with ordinality as n(id, image_url, primary_morph, genetic_traits, secondary_traits, base_color, similarity, label_weight, label_source, source_cluster, ord)
   where id like 't-%';
  if v_old is distinct from v_new then
    raise exception 'FAIL: with no listing the new function differs: % vs %', v_new, v_old;
  end if;
  if v_old not like '%t-alpha-1%' or v_old like '%t-delta-1%' then
    raise exception 'FAIL: unexpected baseline rows: %', v_old;
  end if;

  select string_agg(id, ',' order by ord)
    into v_ex
    from public.morph_visual_neighbors_excluding_seller(q, 48, 'L1') with ordinality as n(id, image_url, primary_morph, genetic_traits, secondary_traits, base_color, similarity, label_weight, label_source, source_cluster, ord)
   where id like 't-%';
  if v_ex is distinct from 't-beta-1,t-gamma-1' then
    raise exception 'FAIL: excluding L1 should leave only other sellers, got %', v_ex;
  end if;

  -- An unknown listing id leaves out nothing but that id.
  select string_agg(id, ',' order by ord)
    into v_ex
    from public.morph_visual_neighbors_excluding_seller(q, 48, 'no-such-listing') with ordinality as n(id, image_url, primary_morph, genetic_traits, secondary_traits, base_color, similarity, label_weight, label_source, source_cluster, ord)
   where id like 't-%';
  if v_ex not like '%t-alpha-1%' or v_ex not like '%t-beta-1%' then
    raise exception 'FAIL: unknown listing should exclude nothing, got %', v_ex;
  end if;

  if has_function_privilege('anon', 'public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text)', 'execute')
     or has_function_privilege('authenticated', 'public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text)', 'execute') then
    raise exception 'FAIL: members or visitors can call the evaluation lookup';
  end if;
  if not has_function_privilege('service_role', 'public.morph_visual_neighbors_excluding_seller(extensions.vector, integer, text)', 'execute') then
    raise exception 'FAIL: the service role cannot call the evaluation lookup';
  end if;

  -- The live two-argument call must still resolve to one function.
  perform public.morph_visual_neighbors(query_embedding => q, match_count => 48);
end $$;

rollback;
