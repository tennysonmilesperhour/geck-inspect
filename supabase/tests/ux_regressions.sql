-- Outside reference photos: only commercial-use licences are readable.
-- Regression checks for supabase/migrations/20261015232800_ux.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it adds its own sample rows and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/ux_regressions.sql
--
-- Each block raises "FAIL: ..." when the rule is broken, and also checks
-- that the photos we may show still come through.
begin;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.as_member() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"ux-member@example.com","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.as_anon(), pg_temp.as_member(), pg_temp.as_service(), pg_temp.as_postgres() to public;

-- Sample rows in every licence production holds, plus spellings the policy
-- must not let through. Morph label 'ux_check' keeps them apart from any
-- real rows.
insert into geck_data.external_reference_images
  (source_kind, source_id, species, morph_label, norm_morph_label, license, attribution, image_url)
values
  ('inaturalist', 'ux-cc-by',       'Correlophus ciliatus', 'UX check', 'ux_check', 'cc-by',       'A. Photographer', 'https://example.com/1.jpg'),
  ('inaturalist', 'ux-cc-by-sa',    'Correlophus ciliatus', 'UX check', 'ux_check', 'cc-by-sa',    'B. Photographer', 'https://example.com/2.jpg'),
  ('inaturalist', 'ux-cc0',         'Correlophus ciliatus', 'UX check', 'ux_check', 'cc0',         'C. Photographer', 'https://example.com/3.jpg'),
  ('inaturalist', 'ux-cc-by-nc',    'Correlophus ciliatus', 'UX check', 'ux_check', 'cc-by-nc',    'D. Photographer', 'https://example.com/4.jpg'),
  ('inaturalist', 'ux-cc-by-nc-sa', 'Correlophus ciliatus', 'UX check', 'ux_check', 'cc-by-nc-sa', 'E. Photographer', 'https://example.com/5.jpg'),
  ('inaturalist', 'ux-cc-by-nd',    'Correlophus ciliatus', 'UX check', 'ux_check', 'cc-by-nd',    'F. Photographer', 'https://example.com/6.jpg'),
  ('inaturalist', 'ux-none',        'Correlophus ciliatus', 'UX check', 'ux_check', null,          'G. Photographer', 'https://example.com/7.jpg'),
  ('leopard_gecko_wiki', 'ux-leo',  'Eublepharis macularius', 'UX check', 'ux_check', null,        null,              'https://example.com/8.jpg');

-- =====================================================================
-- 1. Signed-out visitors (the Morph Guide's own query) see only the
--    commercial-use photos, through the public view and the table
-- =====================================================================
do $t$
declare n integer; bad text;
begin
  perform pg_temp.as_anon();
  select count(*), string_agg(license, ',') filter (where license is null or license not in ('cc0', 'pdm', 'cc-by', 'cc-by-sa'))
    into n, bad
    from public.external_reference_images where norm_morph_label = 'ux_check';
  if bad is not null then raise exception 'FAIL: a visitor can read photos licensed %', bad; end if;
  if n <> 3 then raise exception 'FAIL: a visitor should see the 3 commercial-use photos, saw %', n; end if;

  -- The app's own query shape (species and morph, licence list).
  select count(*) into n from public.external_reference_images
   where species = 'Correlophus ciliatus' and norm_morph_label = 'ux_check'
     and license in ('cc0', 'cc-by', 'cc-by-sa', 'pdm');
  if n <> 3 then raise exception 'FAIL: the Morph Guide query should return 3 photos, got %', n; end if;

  -- An old app copy that asks for every licence still gets only the allowed ones.
  select count(*) into n from public.external_reference_images
   where species = 'Correlophus ciliatus' and norm_morph_label = 'ux_check';
  if n <> 3 then raise exception 'FAIL: an unfiltered query should return 3 photos, got %', n; end if;

  select count(*) into n from geck_data.external_reference_images
   where norm_morph_label = 'ux_check' and (license is null or license like '%-nc%' or license like '%-nd%');
  if n <> 0 then raise exception 'FAIL: the table itself shows % restricted photos to a visitor', n; end if;
end
$t$;

-- =====================================================================
-- 2. Signed-in members: the same rule
-- =====================================================================
do $t$
declare n integer;
begin
  perform pg_temp.as_member();
  select count(*) into n from public.external_reference_images where norm_morph_label = 'ux_check';
  if n <> 3 then raise exception 'FAIL: a member should see the 3 commercial-use photos, saw %', n; end if;
  select count(*) into n from public.external_reference_images
   where norm_morph_label = 'ux_check' and (license is null or license like '%-nc%' or license like '%-nd%');
  if n <> 0 then raise exception 'FAIL: a member can read % restricted photos', n; end if;
end
$t$;

-- =====================================================================
-- 3. The server (importer, service role) still reads every row, so
--    nothing is lost and the change can be undone
-- =====================================================================
do $t$
declare n integer;
begin
  perform pg_temp.as_service();
  select count(*) into n from geck_data.external_reference_images where norm_morph_label = 'ux_check';
  if n <> 8 then raise exception 'FAIL: the service role should still read all 8 sample rows, saw %', n; end if;
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 4. Exactly one read policy, the new one
-- =====================================================================
do $t$
declare n integer;
begin
  select count(*) into n from pg_policies
   where schemaname = 'geck_data' and tablename = 'external_reference_images' and cmd = 'SELECT';
  if n <> 1 then raise exception 'FAIL: expected one read policy, found %', n; end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'geck_data' and tablename = 'external_reference_images'
                    and policyname = 'public read commercial-use external_reference_images') then
    raise exception 'FAIL: the commercial-use read policy is missing';
  end if;
end
$t$;

select 'ux regressions passed' as result;
rollback;
