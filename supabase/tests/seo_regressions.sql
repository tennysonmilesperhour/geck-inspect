-- The Price Index minimum sample.
-- Regression checks for supabase/migrations/20261016090300_seo.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it writes its own market rows, then reads the index as a signed-out
-- visitor (request.jwt.claims plus SET ROLE, the way the API does). Every
-- change rolls back. It is not meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/seo_regressions.sql
--
-- It checks that a row needs 30 listings, that rows under 100 are marked
-- thin, that a monthly median only counts days with 30 or more listings,
-- and that signed-out visitors can still call the function.
begin;

-- A market of its own so real rows in the copy do not interfere.
delete from geck_data.market_daily where market = 'ZZ';
insert into geck_data.market_daily (day, market, trait, checked, full_check, for_sale, p25, p50, p75, new_listings, cuts)
values
  -- latest full check
  ('2026-10-10', 'ZZ', '',            500, true, 500, 100, 200, 300, 10, 2),
  ('2026-10-10', 'ZZ', 'Harlequin',   500, true,   6, 100, 900, 950,  1, 0),
  ('2026-10-10', 'ZZ', 'Pinstripe',   500, true,  29, 100, 150, 200,  1, 0),
  ('2026-10-10', 'ZZ', 'Dalmatian',   500, true,  30, 100, 160, 210,  1, 0),
  ('2026-10-10', 'ZZ', 'Lilly White', 500, true,  99, 300, 400, 500,  1, 0),
  ('2026-10-10', 'ZZ', 'Axanthic',    500, true, 100, 900, 1500, 2000, 1, 0),
  -- a later partial check never counts
  ('2026-10-11', 'ZZ', 'Pinstripe',   100, false, 400, 1, 1, 1, 0, 0),
  -- earlier full checks in the same month, for the monthly median
  ('2026-10-01', 'ZZ', 'Pinstripe',   500, true,  40, 100, 120, 200,  1, 0),
  ('2026-10-02', 'ZZ', 'Pinstripe',   500, true,  10, 100, 9000, 9999, 1, 0);

do $test$
declare
  idx jsonb;
  zz jsonb;
  pin jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  idx := public.open_price_index();
  reset role;

  select coalesce(jsonb_agg(r), '[]'::jsonb) into zz
  from jsonb_array_elements(idx -> 'latest') r where r ->> 'market' = 'ZZ';

  if (idx ->> 'min_listings')::int <> 30 or (idx ->> 'thin_below')::int <> 100 then
    raise exception 'index does not state its sample rule: %', idx ->> 'min_listings';
  end if;
  if exists (select 1 from jsonb_array_elements(zz) r where (r ->> 'listings')::int < 30) then
    raise exception 'a row under 30 listings was published';
  end if;
  if exists (select 1 from jsonb_array_elements(zz) r where r ->> 'trait' in ('Harlequin', 'Pinstripe')) then
    raise exception 'the 6 and 29 listing rows should be left out';
  end if;
  if not exists (select 1 from jsonb_array_elements(zz) r where r ->> 'trait' = 'Dalmatian' and (r ->> 'thin')::boolean) then
    raise exception 'a 30 listing row should be published and marked thin';
  end if;
  if not exists (select 1 from jsonb_array_elements(zz) r where r ->> 'trait' = 'Lilly White' and (r ->> 'thin')::boolean) then
    raise exception 'a 99 listing row should be marked thin';
  end if;
  if not exists (select 1 from jsonb_array_elements(zz) r where r ->> 'trait' = 'Axanthic' and not (r ->> 'thin')::boolean) then
    raise exception 'a 100 listing row should not be marked thin';
  end if;
  if not exists (select 1 from jsonb_array_elements(zz) r where r ->> 'trait' is null and (r ->> 'listings')::int = 500) then
    raise exception 'the all-geckos row is missing';
  end if;

  -- Monthly: only the 1 Oct day (40 listings) counts for Pinstripe; the
  -- 2 Oct day with 10 listings and its 9000 median must not.
  select r into pin from jsonb_array_elements(idx -> 'monthly') r
  where r ->> 'market' = 'ZZ' and r ->> 'trait' = 'Pinstripe' and r ->> 'month' = '2026-10';
  if pin is null then raise exception 'monthly Pinstripe row missing'; end if;
  if (pin ->> 'full_checks')::int <> 1 or (pin ->> 'median')::numeric <> 120 then
    raise exception 'monthly median counted a day under 30 listings: %', pin;
  end if;
end $test$;

-- Still callable by the API roles (and only by them), still a definer
-- function with a pinned path.
do $test$
begin
  if not has_function_privilege('anon', 'public.open_price_index()', 'execute') then
    raise exception 'anon lost execute on open_price_index';
  end if;
  if not has_function_privilege('authenticated', 'public.open_price_index()', 'execute') then
    raise exception 'authenticated lost execute on open_price_index';
  end if;
  -- Named grants only: PUBLIC (every role, present and future) has none.
  if exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.open_price_index()'::regprocedure and a.grantee = 0
  ) then
    raise exception 'open_price_index is still executable by PUBLIC';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.open_price_index()'::regprocedure) then
    raise exception 'open_price_index is no longer security definer';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = 'public.open_price_index()'::regprocedure
      and proconfig @> array['search_path=public, geck_data']
  ) then
    raise exception 'open_price_index lost its pinned search_path';
  end if;
end $test$;

rollback;
