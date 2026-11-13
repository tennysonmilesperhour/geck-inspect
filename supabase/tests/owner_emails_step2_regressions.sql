-- Owner email addresses off rows other members can read, step 2.
-- Regression checks for supabase/pending/owner_emails_step2.sql (decision
-- E16). When that file moves to supabase/migrations, change the \ir path
-- below to the new name; src/lib/__tests__/ownerRows.test.js checks both.
--
-- The SQL harness runs it with every other file in supabase/tests. It
-- applies step 2 inside its own transaction, so everything rolls back.
--
-- What it proves:
--   * a signed-in read of created_by on any of the seven tables is refused,
--     and so is select *;
--   * every other column is still granted to members, and each column list
--     the app reads with (src/lib/memberColumns.js, OWNED_COLUMNS_BY_TABLE)
--     works;
--   * members still add their own rows, read them back by named columns,
--     find them by owner_profile_id, and edit and delete them through the
--     row rules; another member still cannot;
--   * the functions and row rules step 1 moved off created_by still work:
--     save_gecko_record, recent_weight_records, the sale prices, the
--     ownership prices;
--   * signed-out visitors and the server are unchanged;
--   * a second run changes nothing.
-- Each block raises "FAIL: ..." when a rule is broken.
begin;

\ir ../pending/owner_emails_step2.sql

create temp table _who (tag text primary key, uid uuid not null, email text not null, pid text) on commit drop;
grant all on _who to public;
create temp table _ids (tag text primary key, id text not null) on commit drop;
grant all on _ids to public;

-- The app's lists (src/lib/memberColumns.js); ownerRows.test.js keeps
-- these in step with it.
create temp table _member_lists (tbl text primary key, cols text not null) on commit drop;
grant all on _member_lists to public;
insert into _member_lists values
  ('geckos', 'id,name,species,hatch_date,sex,sire_id,dam_id,sire_name,dam_name,morphs_traits,morph_tags,notes,status,image_urls,gecko_id_code,display_order,asking_price,weight_grams,market_price_estimate,morphmarket_id,morphmarket_url,palm_street_id,palm_street_url,marketplace_description,is_public,gallery_display,image_crop_data,incubation_days,archived,archived_date,archive_reason,feeding_group_id,is_gravid,gravid_since,egg_drop_date,created_date,updated_date,passport_code,pattern_grade,genetics_notes,breeder_name,breeder_user_id,hatch_facility,listing_price,estimated_hatch_year,collection_id,quality_score,last_meaningful_change_at,tail_status,growth_slideshow_enabled,sale_category,owner_profile_id,placeholder_style,inherited_placeholder_style,sold_price,moderation_hidden,status_before_listing'),
  ('breeding_plans', 'id,sire_id,dam_id,breeding_id,pairing_date,copulation_events,egg_check_day,egg_check_count,first_egg_lay_date,expected_lay_interval,laying_active,dormant_since,status,notes,archived,archived_date,breeding_season,is_public,created_date,updated_date,owner_profile_id'),
  ('weight_records', 'id,gecko_id,weight_grams,record_date,notes,created_date,updated_date,client_request_id,owner_profile_id'),
  ('feeding_records', 'id,animal_id,date,food_type,accepted,notes,created_date,updated_date,logged_by,client_request_id,owner_profile_id'),
  ('shed_records', 'id,animal_id,date,quality,notes,created_date,updated_date,logged_by,client_request_id,owner_profile_id'),
  ('vet_records', 'id,animal_id,date,vet_name,reason,findings,treatment,follow_up,attachments,created_date,updated_date,owner_profile_id'),
  ('ownership_records', 'id,animal_id,owner_user_id,owner_name,owner_avatar_url,acquired_date,transfer_method,sale_price,contributed_to_market_data,notes,created_date,updated_date,owner_profile_id');

create function pg_temp.mk(p_tag text, p_name text, p_role text default 'user') returns void language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'step2-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles set full_name = p_name, role = p_role where email = v_email;
  insert into _who select p_tag, v_id, v_email, p.id from public.profiles p where p.email = v_email;
end $$;
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
create function pg_temp.who(p_tag text) returns text language sql stable as $$ select email from _who where tag = p_tag $$;
create function pg_temp.uid(p_tag text) returns uuid language sql stable as $$ select uid from _who where tag = p_tag $$;
create function pg_temp.pid(p_tag text) returns text language sql stable as $$ select pid from _who where tag = p_tag $$;
create function pg_temp.id(p_tag text) returns text language sql stable as $$ select id from _ids where tag = p_tag $$;
create function pg_temp.must_fail(p_label text, p_sql text, p_error_like text default '%') returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not ilike p_error_like then
      raise exception 'FAIL: % failed for the wrong reason: %', p_label, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL: % was allowed', p_label;
end $$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('alice', 'Alice Keeper');
select pg_temp.mk('bob', 'Bob Breeder');
select pg_temp.mk('admin', 'Site Admin', 'admin');

-- Alice's gecko with a public passport and one of every record.
do $$
declare v_mango text; v_pip text; v_id text;
begin
  perform pg_temp.as_member('alice');
  insert into public.geckos (name, created_by, sex, is_public) values ('Mango', pg_temp.who('alice'), 'Female', true) returning id into v_mango;
  insert into public.geckos (name, created_by, sex, is_public) values ('Pip', pg_temp.who('alice'), 'Male', true) returning id into v_pip;
  insert into _ids values ('mango', v_mango), ('pip', v_pip);
  insert into public.breeding_plans (sire_id, dam_id, created_by, is_public) values (v_pip, v_mango, pg_temp.who('alice'), true) returning id into v_id;
  insert into _ids values ('plan', v_id);
  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by) values (v_mango, 41, current_date, pg_temp.who('alice')) returning id into v_id;
  insert into _ids values ('weight', v_id);
  insert into public.feeding_records (animal_id, date, food_type, created_by) values (v_mango, current_date, 'Crested gecko diet', pg_temp.who('alice')) returning id::text into v_id;
  insert into _ids values ('feed', v_id);
  insert into public.shed_records (animal_id, date, created_by) values (v_mango, current_date, pg_temp.who('alice')) returning id::text into v_id;
  insert into _ids values ('shed', v_id);
  insert into public.vet_records (animal_id, date, reason, created_by) values (v_mango, current_date, 'Check-up', pg_temp.who('alice')) returning id::text into v_id;
  insert into _ids values ('vet', v_id);
  perform pg_temp.as_postgres();
  update public.geckos set passport_code = 'GI-2026-STEP', moderation_hidden = false where id = v_mango;
  insert into public.ownership_records (animal_id, owner_user_id, owner_name, acquired_date, transfer_method, sale_price, created_by)
  values (v_mango, pg_temp.uid('alice'), 'Alice Keeper', current_date, 'purchased', 120, pg_temp.who('alice')) returning id::text into v_id;
  insert into _ids values ('record', v_id);
end $$;

-- 1. The grants: created_by gone, every other column kept, the app's lists all granted.
do $$
declare r record; c record;
begin
  for r in select * from _member_lists loop
    if has_column_privilege('authenticated', 'public.' || r.tbl, 'created_by', 'SELECT') then
      raise exception 'FAIL: members can still read %.created_by', r.tbl;
    end if;
    if has_table_privilege('authenticated', 'public.' || r.tbl, 'SELECT') then
      raise exception 'FAIL: members still hold a table-wide read on %', r.tbl;
    end if;
    for c in select a.attname from pg_attribute a
              where a.attrelid = ('public.' || r.tbl)::regclass and a.attnum > 0 and not a.attisdropped and a.attname <> 'created_by' loop
      if not has_column_privilege('authenticated', 'public.' || r.tbl, c.attname, 'SELECT') then
        raise exception 'FAIL: members lost %.%', r.tbl, c.attname;
      end if;
    end loop;
    for c in select trim(x) as col from unnest(string_to_array(r.cols, ',')) x loop
      if not has_column_privilege('authenticated', 'public.' || r.tbl, c.col, 'SELECT') then
        raise exception 'FAIL: the app reads %.%, which members cannot read', r.tbl, c.col;
      end if;
    end loop;
    if not has_column_privilege('service_role', 'public.' || r.tbl, 'created_by', 'SELECT') then
      raise exception 'FAIL: the server lost %.created_by', r.tbl;
    end if;
  end loop;
end $$;

-- 2. Another member: the app's lists work, the email and select * do not.
do $$
declare r record; v_n int;
begin
  perform pg_temp.as_member('bob');
  for r in select * from _member_lists loop
    execute format('select count(*) from (select %s from public.%I) x', r.cols, r.tbl) into v_n;
    if v_n < 1 then raise exception 'FAIL: another member reads no rows of % with the app''s list', r.tbl; end if;
  end loop;
  perform pg_temp.as_postgres();
end $$;

select pg_temp.as_member('bob');
select pg_temp.must_fail('another member reading geckos.created_by', 'select created_by from public.geckos', '%permission denied%');
select pg_temp.must_fail('select * on geckos', 'select * from public.geckos', '%permission denied%');
select pg_temp.must_fail('select * on breeding_plans', 'select * from public.breeding_plans', '%permission denied%');
select pg_temp.must_fail('weight_records.created_by', 'select created_by from public.weight_records', '%permission denied%');
select pg_temp.must_fail('feeding_records.created_by', 'select created_by from public.feeding_records', '%permission denied%');
select pg_temp.must_fail('shed_records.created_by', 'select created_by from public.shed_records', '%permission denied%');
select pg_temp.must_fail('vet_records.created_by', 'select created_by from public.vet_records', '%permission denied%');
select pg_temp.must_fail('ownership_records.created_by', 'select created_by from public.ownership_records', '%permission denied%');
select pg_temp.must_fail('a filter on created_by', format($s$select id from public.geckos where created_by = %L$s$, pg_temp.who('alice')), '%permission denied%');
select pg_temp.as_postgres();

-- 3. The owner: adds, reads back, finds by owner id, edits and deletes.
do $$
declare v_id text; v_n int; v_saved public.geckos;
begin
  perform pg_temp.as_member('alice');
  insert into public.geckos (name, created_by, sex) values ('Satsuma', pg_temp.who('alice'), 'Female') returning id into v_id;
  select count(*) into v_n from public.geckos where owner_profile_id = pg_temp.pid('alice');
  if v_n <> 3 then raise exception 'FAIL: the owner finds % of her 3 geckos by owner id', v_n; end if;
  update public.geckos set notes = 'Lilly White het' where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: the owner cannot edit her gecko'; end if;
  update public.weight_records set notes = 'After a shed' where id = pg_temp.id('weight');
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: the owner cannot edit her weight record'; end if;
  delete from public.vet_records where id = pg_temp.id('vet')::uuid;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: the owner cannot delete her vet record'; end if;
  v_saved := public.save_gecko_record('{"name":"Clementine","estimated_hatch_year":2025}'::jsonb, gen_random_uuid());
  if v_saved.id is null or v_saved.created_by is not null or v_saved.owner_profile_id is distinct from pg_temp.pid('alice') then
    raise exception 'FAIL: save_gecko_record after step 2 returned %', v_saved;
  end if;
  select count(*) into v_n from public.recent_weight_records(8);
  if v_n < 1 then raise exception 'FAIL: recent_weight_records returns nothing after step 2'; end if;
  update public.geckos set sold_price = 300 where id = pg_temp.id('pip');
  select count(*) into v_n from public.gecko_sale_prices where gecko_id = pg_temp.id('pip');
  if v_n <> 1 then raise exception 'FAIL: the owner cannot read her sale price after step 2'; end if;
  select count(*) into v_n from public.ownership_record_prices where record_id = pg_temp.id('record')::uuid;
  if v_n <> 1 then raise exception 'FAIL: the record''s member cannot read the price after step 2'; end if;

  perform pg_temp.as_member('bob');
  update public.geckos set notes = 'Not yours' where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: another member edited Alice''s gecko'; end if;
  delete from public.weight_records where id = pg_temp.id('weight');
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: another member deleted Alice''s weight record'; end if;
  select count(*) into v_n from public.gecko_sale_prices;
  if v_n <> 0 then raise exception 'FAIL: another member reads a sale price'; end if;
  perform pg_temp.as_postgres();
end $$;

-- 4. Admins lose the column too; signed-out visitors and the server are unchanged.
select pg_temp.as_member('admin');
select pg_temp.must_fail('an admin reading geckos.created_by', 'select created_by from public.geckos', '%permission denied%');
select pg_temp.as_anon();
select pg_temp.must_fail('a signed-out read of geckos.created_by', 'select created_by from public.geckos', '%permission denied%');
do $$
declare v_n int;
begin
  perform pg_temp.as_anon();
  select count(*) into v_n from public.geckos where passport_code = 'GI-2026-STEP';
  if v_n <> 1 then raise exception 'FAIL: a signed-out visitor cannot read a public passport gecko'; end if;
  perform pg_temp.as_postgres();
  perform set_config('role', 'service_role', true);
  select count(*) into v_n from public.geckos where created_by = pg_temp.who('alice');
  if v_n < 3 then raise exception 'FAIL: the server cannot filter on created_by'; end if;
  perform pg_temp.as_postgres();
end $$;

-- 5. A second run changes nothing.
\ir ../pending/owner_emails_step2.sql
do $$
begin
  if has_column_privilege('authenticated', 'public.geckos', 'created_by', 'SELECT')
     or not has_column_privilege('authenticated', 'public.geckos', 'owner_profile_id', 'SELECT') then
    raise exception 'FAIL: a second run changed the grants';
  end if;
end $$;

rollback;
