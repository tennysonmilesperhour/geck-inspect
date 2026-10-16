-- Newest weigh-ins per gecko (My Geckos).
-- Regression checks for supabase/migrations/20261016090200_perf.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/perf_regressions.sql
--
-- It checks that recent_weight_records() gives each gecko its true latest
-- weigh-in even when the member has far more than the API's 1,000-row
-- page, returns only the member's own records, keeps the per-gecko count
-- in range, runs as the member (so the read rules still apply), and is
-- not callable by signed-out visitors.
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text) returns void language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'perf-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  insert into _who values (p_tag, v_id, v_email);
end $$;
create function pg_temp.who(p_tag text) returns text language sql stable as $$
  select email from _who where tag = p_tag
$$;
create function pg_temp.as_member(p_tag text) returns void language plpgsql as $$
declare w record;
begin
  perform set_config('role', 'postgres', true);
  select * into w from _who where tag = p_tag;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', w.uid, 'email', w.email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('breeder');
select pg_temp.mk('other');

-- breeder: 60 geckos weighed 25 times each (1,500 records, more than one
-- API page). Gecko n's newest weigh-in is on day n, at n + 0.5 grams, so
-- the expected latest weight of every gecko is known. (Archived only so
-- the Free plan's 10-gecko limit does not stop the setup; the function
-- does not look at the gecko row.)
insert into public.geckos (id, name, created_by, is_public, archived, status)
select 'perf-g' || n, 'Perf ' || n, pg_temp.who('breeder'), false, true, 'Pet'
from generate_series(1, 60) n;
-- Geckos 1 to 10 were last weighed in 2024 (sold, or weighed elsewhere);
-- the other 50 have 1,250 newer records between them, so the old
-- newest-first page of 1,000 never reached geckos 1 to 10.
insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by, created_date)
select 'perf-w' || n || '-' || k, 'perf-g' || n,
       case when k = 0 then n + 0.5 else 10 + k end,
       case when n <= 10 then date '2024-01-01' else date '2026-01-01' end + n - k * 7,
       pg_temp.who('breeder'), now() - make_interval(days => k)
from generate_series(1, 60) n, generate_series(0, 24) k;

-- other: one gecko of their own, and a record they wrote long ago on one
-- of breeder's geckos (possible for old rows). Neither may reach breeder.
insert into public.geckos (id, name, created_by, is_public, archived, status)
values ('perf-other-g', 'Other', pg_temp.who('other'), false, false, 'Pet');
insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by)
values ('perf-other-w1', 'perf-other-g', 33, date '2026-09-01', pg_temp.who('other')),
       ('perf-other-w2', 'perf-g1', 999, date '2026-12-31', pg_temp.who('other'));

do $t$
declare
  v_rows int;
  v_geckos int;
  v_wrong int;
  v_max int;
  v_old_read int;
begin
  -- Runs as the member, with an explicit execute grant.
  if (select prosecdef from pg_proc where oid = 'public.recent_weight_records(integer)'::regprocedure) then
    raise exception 'FAIL: recent_weight_records must be SECURITY INVOKER so the read rules apply';
  end if;
  if has_function_privilege('anon', 'public.recent_weight_records(integer)', 'execute') then
    raise exception 'FAIL: signed-out visitors must not be able to call recent_weight_records';
  end if;
  if not has_function_privilege('authenticated', 'public.recent_weight_records(integer)', 'execute') then
    raise exception 'FAIL: members need execute on recent_weight_records';
  end if;

  perform pg_temp.as_member('breeder');

  -- The old read, as the API serves it: newest first, one 1,000-row page.
  select count(distinct gecko_id) into v_old_read
  from (select gecko_id from public.weight_records where created_by = pg_temp.who('breeder')
        order by record_date desc limit 1000) page;
  if v_old_read >= 60 then
    raise exception 'FAIL: the test data no longer reproduces the 1,000-row cap (old read covered % geckos)', v_old_read;
  end if;

  select count(*), count(distinct gecko_id) into v_rows, v_geckos
  from public.recent_weight_records();
  if v_rows <> 60 * 8 or v_geckos <> 60 then
    raise exception 'FAIL: expected 8 records for each of 60 geckos, got % rows over % geckos', v_rows, v_geckos;
  end if;

  -- Every gecko's first row is its true latest weigh-in (n + 0.5 grams).
  select count(*) into v_wrong
  from (
    select distinct on (gecko_id) gecko_id, weight_grams
    from public.recent_weight_records()
    order by gecko_id, record_date desc
  ) latest
  where latest.weight_grams <> substring(latest.gecko_id from 7)::int + 0.5;
  if v_wrong <> 0 then
    raise exception 'FAIL: % geckos got the wrong latest weight', v_wrong;
  end if;

  -- Only the member's own records: not the other member's gecko, and not
  -- the record the other member wrote on breeder's gecko.
  if exists (select 1 from public.recent_weight_records(50) where created_by <> pg_temp.who('breeder')) then
    raise exception 'FAIL: recent_weight_records returned someone else''s record';
  end if;

  -- The per-gecko count stays between 1 and 50.
  select max(c) into v_max from (select count(*) c from public.recent_weight_records(0) group by gecko_id) s;
  if v_max <> 1 then raise exception 'FAIL: p_per_gecko 0 should mean 1, got %', v_max; end if;
  select max(c) into v_max from (select count(*) c from public.recent_weight_records(1000) group by gecko_id) s;
  if v_max <> 25 then raise exception 'FAIL: p_per_gecko 1000 should be capped (25 records exist), got %', v_max; end if;
  select max(c) into v_max from (select count(*) c from public.recent_weight_records(null) group by gecko_id) s;
  if v_max <> 8 then raise exception 'FAIL: p_per_gecko null should mean 8, got %', v_max; end if;

  -- The other member sees only their own gecko.
  perform pg_temp.as_member('other');
  select count(*), count(distinct gecko_id) into v_rows, v_geckos from public.recent_weight_records();
  if v_rows <> 2 or v_geckos <> 2 then
    raise exception 'FAIL: other member should get their 2 own records, got % over % geckos', v_rows, v_geckos;
  end if;

  perform pg_temp.as_postgres();
  raise notice 'old read covered % of 60 geckos; recent_weight_records covers all 60', v_old_read;
end
$t$;

-- Signed-out visitors cannot call it at all.
do $t$
begin
  perform pg_temp.as_anon();
  begin
    perform public.recent_weight_records();
    raise exception 'FAIL: anon could call recent_weight_records';
  exception when insufficient_privilege then
    null;
  end;
  perform pg_temp.as_postgres();
end
$t$;

select 'perf_regressions: all checks passed' as result;
rollback;
