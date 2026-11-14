-- Owner email addresses, step 1 of 2. Regression checks for
-- supabase/migrations/20261113215000_owner_emails_step1.sql.
--
-- The SQL harness runs it with every other file in supabase/tests, inside
-- one transaction that rolls back. The file runs the migration a second
-- time first, to prove a rerun changes nothing.
--
-- What it proves, before step 2 (as production is after step 1):
--   * owner_profile_id is set from created_by on every insert into the six
--     record tables, and a value the browser sends is replaced by the true
--     one;
--   * save_gecko_record creates, retries, updates and records a weight as
--     before, accepts a hatch year on its own (estimated_hatch_year), still
--     returns the owner's email to the owner, and refuses another member.
-- Then it takes created_by away from signed-in accounts on the seven tables,
-- the way step 2 will, and proves:
--   * another member reads a public gecko's named columns but not its
--     owner's email (and select * is refused, which is why the app names
--     its columns);
--   * save_gecko_record, recent_weight_records, save_morphmarket_listing
--     and import_morphmarket_listing all still work for the owner and
--     still refuse everyone else;
--   * the row rules of gecko_sale_prices, morphmarket_listing_details and
--     ownership_record_prices, which used to look up created_by in a
--     subquery, still let in exactly the same people;
--   * the seven tables' own rules, which compare their own created_by, still
--     work for reads, updates and deletes.
-- Each block raises "FAIL: ..." when a rule is broken.
begin;

\ir ../migrations/20261113215000_owner_emails_step1.sql

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null,
  pid text
) on commit drop;
grant all on _who to public;

create temp table _ids (tag text primary key, id text not null) on commit drop;
grant all on _ids to public;

create function pg_temp.mk(p_tag text, p_name text, p_role text default 'user')
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'owneremail-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
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
end
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
create function pg_temp.who(p_tag text) returns text language sql stable as $$
  select email from _who where tag = p_tag
$$;
create function pg_temp.uid(p_tag text) returns uuid language sql stable as $$
  select uid from _who where tag = p_tag
$$;
-- Read from _who: a member can read only her own profile.
create function pg_temp.pid(p_tag text) returns text language sql stable as $$
  select pid from _who where tag = p_tag
$$;
create function pg_temp.id(p_tag text) returns text language sql stable as $$
  select id from _ids where tag = p_tag
$$;
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
-- A complete set of the 33 MorphMarket fields, blank but for the ones given.
create function pg_temp.mm_source(p_code text) returns jsonb language sql stable as $$
  select jsonb_object_agg(k, '') || jsonb_build_object('Animal_ID', p_code, 'Category', 'Crested Geckos',
         'Title', 'Listing for ' || p_code, 'Price', '125')
    from unnest(array['Animal_ID','Category','Title','State','Visibility','Enabled','Sex','DOB','Weight',
      'Maturity','Traits','Origin','Diet','Length','Length_Type','Proven_Breeder','Price','Min_Shipping',
      'Max_Shipping','Is_Negotiable','Is_For_Trade','Enable ''Buy Now''','Quantity','Group_Id','Is_Group',
      'Photo_Urls','Video_Url','Is_Rep_Photo','Desc','Wholesale_Price','Wholesale_Only',
      'Wholesale_Description','Private_Notes']) k
$$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('alice', 'Alice Keeper');
select pg_temp.mk('bob', 'Bob Breeder');
select pg_temp.mk('ed', 'Ed Editor');
select pg_temp.mk('admin', 'Site Admin', 'admin');
-- Alice is on the Breeder plan, which allows a collaborator.
update public.profiles set membership_tier = 'breeder' where email = pg_temp.who('alice');

-- Alice's geckos, public like most geckos, in her default collection,
-- which she shares with an editor.
do $$
declare v_id text; v_cid uuid;
begin
  perform pg_temp.as_member('alice');
  insert into public.geckos (name, created_by, sex, is_public, gecko_id_code)
  values ('Mango', pg_temp.who('alice'), 'Female', true, 'MM-A')
  returning id, collection_id into v_id, v_cid;
  insert into _ids values ('mango', v_id), ('cid', v_cid::text);
  insert into public.geckos (name, created_by, sex, is_public) values ('Pip', pg_temp.who('alice'), 'Male', true)
  returning id into v_id;
  insert into _ids values ('pip', v_id);
  insert into public.geckos (name, created_by, sex, is_public) values ('Hidden', pg_temp.who('alice'), 'Male', false)
  returning id into v_id;
  insert into _ids values ('hidden', v_id);
  perform pg_temp.as_postgres();
  insert into public.collection_members (collection_id, member_email, role, status, accepted_at)
  values (v_cid, pg_temp.who('ed'), 'editor', 'accepted', now());
end $$;

-- 1. owner_profile_id follows created_by on the six record tables.
do $$
declare v_plan text; v_weight text; v_feed uuid; v_shed uuid; v_vet uuid; v_rec uuid; v_got text;
begin
  perform pg_temp.as_member('alice');
  -- A browser that names someone else's profile id gets its own.
  insert into public.breeding_plans (sire_id, dam_id, created_by, owner_profile_id)
  values (pg_temp.id('pip'), pg_temp.id('mango'), pg_temp.who('alice'), pg_temp.pid('bob'))
  returning id into v_plan;
  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by, owner_profile_id)
  values (pg_temp.id('mango'), 31, current_date - 7, pg_temp.who('alice'), pg_temp.pid('bob'))
  returning id into v_weight;
  insert into public.feeding_records (animal_id, date, food_type, created_by, owner_profile_id)
  values (pg_temp.id('mango'), current_date, 'Crested gecko diet', pg_temp.who('alice'), pg_temp.pid('bob'))
  returning id into v_feed;
  insert into public.shed_records (animal_id, date, created_by)
  values (pg_temp.id('mango'), current_date, pg_temp.who('alice'))
  returning id into v_shed;
  insert into public.vet_records (animal_id, date, reason, created_by)
  values (pg_temp.id('mango'), current_date, 'Check-up', pg_temp.who('alice'))
  returning id into v_vet;
  insert into _ids values ('plan', v_plan), ('weight', v_weight), ('feed', v_feed::text), ('shed', v_shed::text), ('vet', v_vet::text);

  perform pg_temp.as_postgres();
  insert into public.ownership_records (animal_id, owner_user_id, owner_name, acquired_date, transfer_method, created_by)
  values (pg_temp.id('pip'), pg_temp.uid('bob'), 'Bob Breeder', current_date, 'purchased', pg_temp.who('bob'))
  returning id into v_rec;
  insert into _ids values ('record', v_rec::text);

  if (select owner_profile_id from public.breeding_plans where id = v_plan) is distinct from pg_temp.pid('alice') then
    raise exception 'FAIL: a breeding plan kept the owner id the browser sent';
  end if;
  if (select owner_profile_id from public.weight_records where id = v_weight) is distinct from pg_temp.pid('alice') then
    raise exception 'FAIL: a weight record has the wrong owner id';
  end if;
  if (select owner_profile_id from public.feeding_records where id = v_feed) is distinct from pg_temp.pid('alice') then
    raise exception 'FAIL: a feeding record kept the owner id the browser sent';
  end if;
  if (select owner_profile_id from public.shed_records where id = v_shed) is distinct from pg_temp.pid('alice') then
    raise exception 'FAIL: a shed record has the wrong owner id';
  end if;
  if (select owner_profile_id from public.vet_records where id = v_vet) is distinct from pg_temp.pid('alice') then
    raise exception 'FAIL: a vet record has the wrong owner id';
  end if;
  if (select owner_profile_id from public.ownership_records where id = v_rec) is distinct from pg_temp.pid('bob') then
    raise exception 'FAIL: an ownership record has the wrong owner id';
  end if;

  -- Changing it by hand is undone; a change of owner moves it.
  perform pg_temp.as_member('alice');
  update public.breeding_plans set owner_profile_id = pg_temp.pid('bob') where id = v_plan;
  perform pg_temp.as_postgres();
  select owner_profile_id into v_got from public.breeding_plans where id = v_plan;
  if v_got is distinct from pg_temp.pid('alice') then raise exception 'FAIL: a member re-pointed a plan''s owner id'; end if;
  update public.weight_records set created_by = pg_temp.who('bob') where id = v_weight;
  if (select owner_profile_id from public.weight_records where id = v_weight) is distinct from pg_temp.pid('bob') then
    raise exception 'FAIL: owner_profile_id did not follow a change of owner';
  end if;
  update public.weight_records set created_by = pg_temp.who('alice') where id = v_weight;
end $$;

-- 2. save_gecko_record as production runs it after step 1.
do $$
declare v_row public.geckos; v_again public.geckos; v_req uuid := gen_random_uuid(); v_n int;
begin
  perform pg_temp.as_member('alice');
  v_row := public.save_gecko_record('{"name":"Clementine","estimated_hatch_year":2024}'::jsonb, v_req);
  if v_row.id is null or v_row.name <> 'Clementine' then raise exception 'FAIL: create returned %', v_row; end if;
  if v_row.estimated_hatch_year is distinct from 2024 or v_row.hatch_date is not null then
    raise exception 'FAIL: a hatch year on its own was not saved (year %, date %)', v_row.estimated_hatch_year, v_row.hatch_date;
  end if;
  -- Before step 2 the owner reads her own email on the saved row; since
  -- step 2 (20261114023856) nobody does, and the app puts it back
  -- (src/lib/ownerRows.js).
  if has_column_privilege('authenticated', 'public.geckos', 'created_by', 'SELECT') then
    if v_row.created_by is distinct from pg_temp.who('alice') then
      raise exception 'FAIL: before step 2 the owner should still read her own email on the saved row';
    end if;
  elsif v_row.created_by is not null then
    raise exception 'FAIL: after step 2 the saved row still carries the owner''s email';
  end if;
  if v_row.owner_profile_id is distinct from pg_temp.pid('alice') or v_row.is_public then
    raise exception 'FAIL: the saved row is wrong: owner %, public %', v_row.owner_profile_id, v_row.is_public;
  end if;
  insert into _ids values ('clementine', v_row.id), ('clementine_req', v_req::text);

  -- A retry returns the first result and changes nothing.
  v_again := public.save_gecko_record('{"name":"Renamed on retry"}'::jsonb, v_req);
  if v_again.id is distinct from v_row.id or v_again.name <> 'Clementine' then
    raise exception 'FAIL: a retried create changed the animal or made another';
  end if;

  -- An update that records a weight.
  v_again := public.save_gecko_record('{"name":"Clementine","weight_grams":12.5}'::jsonb, gen_random_uuid(), v_row.id, true, current_date);
  if v_again.weight_grams is distinct from 12.5 then raise exception 'FAIL: the update did not save'; end if;
  perform pg_temp.as_postgres();
  select count(*) into v_n from public.weight_records
   where gecko_id = v_row.id and weight_grams = 12.5 and owner_profile_id = pg_temp.pid('alice');
  if v_n <> 1 then raise exception 'FAIL: the measurement was not recorded once with its owner id (% rows)', v_n; end if;
end $$;

-- Clementine is private, so Bob cannot see her and the insert meets her
-- id instead (as before step 1). Section 5 checks a public gecko's id.
select pg_temp.as_member('bob');
select pg_temp.must_fail('another member reusing a save request',
  format($s$select public.save_gecko_record('{"name":"Taken"}'::jsonb, %L::uuid)$s$, pg_temp.id('clementine_req')),
  '%duplicate key%');
select pg_temp.must_fail('another member editing a public gecko',
  format($s$select public.save_gecko_record('{"name":"Taken"}'::jsonb, gen_random_uuid(), %L)$s$, pg_temp.id('mango')),
  '%cannot edit this animal%');
select pg_temp.must_fail('another member editing a private gecko',
  format($s$select public.save_gecko_record('{"name":"Taken"}'::jsonb, gen_random_uuid(), %L)$s$, pg_temp.id('hidden')),
  '%not found or unavailable%');
select pg_temp.as_postgres();

-- 3. Take created_by away from signed-in accounts, the way step 2 will.
do $$
declare t text; v_cols text;
begin
  foreach t in array array['geckos','breeding_plans','weight_records','feeding_records','shed_records','vet_records','ownership_records'] loop
    select string_agg(format('%I', column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = t and column_name <> 'created_by';
    execute format('revoke select on public.%I from authenticated', t);
    execute format('grant select (%s) on public.%I to authenticated', v_cols, t);
  end loop;
end $$;

-- 4. What another member can read now.
do $$
declare v_name text; v_owner text;
begin
  perform pg_temp.as_member('bob');
  select name, owner_profile_id into v_name, v_owner from public.geckos where id = pg_temp.id('mango');
  if v_name is distinct from 'Mango' or v_owner is distinct from pg_temp.pid('alice') then
    raise exception 'FAIL: another member cannot read a public gecko''s named columns';
  end if;
end $$;
select pg_temp.as_member('bob');
select pg_temp.must_fail('another member reading an owner''s email',
  format($s$select created_by from public.geckos where id = %L$s$, pg_temp.id('mango')), '%permission denied%');
select pg_temp.must_fail('select * on geckos', 'select * from public.geckos', '%permission denied%');
select pg_temp.must_fail('select * on breeding plans', 'select * from public.breeding_plans', '%permission denied%');
select pg_temp.as_postgres();

-- 5. save_gecko_record after step 2.
do $$
declare v_row public.geckos; v_again public.geckos; v_req uuid := gen_random_uuid(); v_n int;
begin
  perform pg_temp.as_member('alice');
  v_row := public.save_gecko_record('{"name":"Satsuma","estimated_hatch_year":2023,"is_public":true}'::jsonb, v_req);
  if v_row.id is null or v_row.name <> 'Satsuma' or v_row.estimated_hatch_year is distinct from 2023 then
    raise exception 'FAIL: create after step 2 returned %', v_row;
  end if;
  if v_row.created_by is not null then raise exception 'FAIL: the saved row carries a column the member cannot read'; end if;
  if v_row.owner_profile_id is distinct from pg_temp.pid('alice') or not v_row.is_public then
    raise exception 'FAIL: the saved row is missing columns the member can read';
  end if;
  insert into _ids values ('satsuma', v_row.id), ('satsuma_req', v_req::text);
  v_again := public.save_gecko_record('{"name":"Renamed on retry"}'::jsonb, v_req);
  if v_again.id is distinct from v_row.id or v_again.name <> 'Satsuma' then
    raise exception 'FAIL: a retried create after step 2 changed the animal or made another';
  end if;
  v_again := public.save_gecko_record('{"name":"Satsuma","weight_grams":9}'::jsonb, gen_random_uuid(), v_row.id, true, current_date);
  if v_again.weight_grams is distinct from 9 then raise exception 'FAIL: an update after step 2 did not save'; end if;

  -- The collection's editor can still edit Alice's gecko.
  perform pg_temp.as_member('ed');
  v_again := public.save_gecko_record('{"name":"Mango","notes":"Edited by Ed"}'::jsonb, gen_random_uuid(), pg_temp.id('mango'));
  if v_again.notes is distinct from 'Edited by Ed' then raise exception 'FAIL: the collection editor cannot save after step 2'; end if;

  perform pg_temp.as_postgres();
  select count(*) into v_n from public.weight_records where gecko_id = v_row.id and weight_grams = 9;
  if v_n <> 1 then raise exception 'FAIL: the measurement after step 2 was not recorded once (% rows)', v_n; end if;
  if (select created_by from public.geckos where id = v_row.id) is distinct from pg_temp.who('alice') then
    raise exception 'FAIL: the gecko was saved without its owner';
  end if;
end $$;

select pg_temp.as_member('bob');
select pg_temp.must_fail('another member reusing a save request after step 2',
  format($s$select public.save_gecko_record('{"name":"Taken"}'::jsonb, %L::uuid)$s$, pg_temp.id('satsuma_req')),
  '%Save request already used%');
select pg_temp.must_fail('another member editing a public gecko after step 2',
  format($s$select public.save_gecko_record('{"name":"Taken"}'::jsonb, gen_random_uuid(), %L)$s$, pg_temp.id('satsuma')),
  '%cannot edit this animal%');
select pg_temp.as_postgres();

-- 6. recent_weight_records: the owner's own, nobody else's.
do $$
declare v_n int; v_other int;
begin
  perform pg_temp.as_member('alice');
  select count(*), count(*) filter (where owner_profile_id is distinct from pg_temp.pid('alice'))
    into v_n, v_other from public.recent_weight_records(8);
  if v_n < 3 then raise exception 'FAIL: recent_weight_records returned % of Alice''s weigh-ins', v_n; end if;
  if v_other <> 0 then raise exception 'FAIL: recent_weight_records returned someone else''s rows'; end if;
  perform pg_temp.as_member('bob');
  select count(*) into v_n from public.recent_weight_records(8);
  if v_n <> 0 then raise exception 'FAIL: another member reads % of Alice''s weigh-ins', v_n; end if;
end $$;

-- 7. Sale prices: same readers and same people who may clear one.
do $$
declare v_n int;
begin
  perform pg_temp.as_member('alice');
  update public.geckos set sold_price = 300 where id = pg_temp.id('pip');
  select count(*) into v_n from public.gecko_sale_prices where gecko_id = pg_temp.id('pip') and sold_price = 300;
  if v_n <> 1 then raise exception 'FAIL: the owner cannot read her sale price after step 2'; end if;

  perform pg_temp.as_member('ed');
  select count(*) into v_n from public.gecko_sale_prices where gecko_id = pg_temp.id('pip');
  if v_n <> 1 then raise exception 'FAIL: the collection''s editor cannot read the sale price'; end if;

  perform pg_temp.as_member('bob');
  select count(*) into v_n from public.gecko_sale_prices;
  if v_n <> 0 then raise exception 'FAIL: another member reads % sale price(s)', v_n; end if;
  delete from public.gecko_sale_prices where gecko_id = pg_temp.id('pip');
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: another member cleared a sale price'; end if;

  perform pg_temp.as_member('ed');
  delete from public.gecko_sale_prices where gecko_id = pg_temp.id('pip');
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: the collection''s editor cannot clear a sale price'; end if;

  perform pg_temp.as_member('alice');
  update public.geckos set sold_price = 250 where id = pg_temp.id('pip');
  delete from public.gecko_sale_prices where gecko_id = pg_temp.id('pip');
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: the owner cannot clear her sale price'; end if;

  perform pg_temp.as_member('admin');
  select count(*) into v_n from public.gecko_sale_prices;
  if v_n <> 0 then raise exception 'FAIL: setup, % price(s) left', v_n; end if;
end $$;

-- 8. MorphMarket listing details: the owner's alone.
do $$
declare v_saved public.morphmarket_listing_details; v_result jsonb; v_n int;
begin
  perform pg_temp.as_member('alice');
  v_saved := public.save_morphmarket_listing(pg_temp.id('mango'), pg_temp.mm_source('MM-A'), pg_temp.mm_source('MM-A'), '{}', 'animals.csv', null);
  if v_saved.gecko_id is distinct from pg_temp.id('mango') then raise exception 'FAIL: the owner cannot save listing details after step 2'; end if;
  select count(*) into v_n from public.morphmarket_listing_details;
  if v_n <> 1 then raise exception 'FAIL: the owner reads % listing detail row(s), expected 1', v_n; end if;

  v_result := public.import_morphmarket_listing('{"gecko_id_code":"MM-A","name":"Do not replace"}', pg_temp.mm_source('MM-A'), '{}', 'animals.csv', gen_random_uuid());
  if (v_result->>'created')::boolean or v_result->>'gecko_id' is distinct from pg_temp.id('mango') then
    raise exception 'FAIL: an import did not find the owner''s gecko by its Animal ID: %', v_result;
  end if;
  v_result := public.import_morphmarket_listing('{"gecko_id_code":"MM-B","name":"Imported","status":"Pet"}', pg_temp.mm_source('MM-B'), '{}', 'animals.csv', gen_random_uuid());
  if not (v_result->>'created')::boolean then raise exception 'FAIL: a new import was not created'; end if;

  -- Another member who uses the same Animal ID gets a gecko of his own.
  perform pg_temp.as_member('bob');
  select count(*) into v_n from public.morphmarket_listing_details;
  if v_n <> 0 then raise exception 'FAIL: another member reads % listing detail row(s)', v_n; end if;
  v_result := public.import_morphmarket_listing('{"gecko_id_code":"MM-A","name":"Bob''s own MM-A"}', pg_temp.mm_source('MM-A'), '{}', 'animals.csv', gen_random_uuid());
  if not (v_result->>'created')::boolean or v_result->>'gecko_id' = pg_temp.id('mango') then
    raise exception 'FAIL: another member''s import matched Alice''s gecko';
  end if;
end $$;

select pg_temp.as_member('bob');
select pg_temp.must_fail('another member saving listing details for Alice''s gecko',
  format($s$select public.save_morphmarket_listing(%L, pg_temp.mm_source('MM-A'), pg_temp.mm_source('MM-A'), '{}', 'animals.csv', null)$s$, pg_temp.id('mango')),
  '%your own geckos%');
select pg_temp.as_postgres();

-- 9. Ownership record prices: the record's member and admins only.
do $$
declare v_n int;
begin
  perform pg_temp.as_postgres();
  update public.ownership_records set sale_price = 275 where id = pg_temp.id('record')::uuid;
  perform pg_temp.as_member('bob');
  if (select sale_price from public.ownership_record_prices where record_id = pg_temp.id('record')::uuid) is distinct from 275 then
    raise exception 'FAIL: the buyer cannot read what he paid after step 2';
  end if;
  perform pg_temp.as_member('alice');
  select count(*) into v_n from public.ownership_record_prices;
  if v_n <> 0 then raise exception 'FAIL: another member reads % ownership price(s)', v_n; end if;
  perform pg_temp.as_member('admin');
  select count(*) into v_n from public.ownership_record_prices where record_id = pg_temp.id('record')::uuid;
  if v_n <> 1 then raise exception 'FAIL: an admin cannot read an ownership price'; end if;
end $$;

-- 10. The seven tables' own rules still work, read by named columns.
do $$
declare v_n int;
begin
  perform pg_temp.as_member('alice');
  select count(*) into v_n from public.breeding_plans where id = pg_temp.id('plan') and owner_profile_id = pg_temp.pid('alice');
  if v_n <> 1 then raise exception 'FAIL: the owner cannot read her breeding plan'; end if;
  update public.weight_records set notes = 'Fed well' where id = pg_temp.id('weight');
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: the owner cannot update her weight record'; end if;
  update public.feeding_records set accepted = true where id = pg_temp.id('feed')::uuid returning 1 into v_n;
  if v_n is null then raise exception 'FAIL: the owner cannot update her feeding record'; end if;
  v_n := null;
  update public.shed_records set quality = 'complete' where id = pg_temp.id('shed')::uuid returning 1 into v_n;
  if v_n is null then raise exception 'FAIL: the owner cannot update her shed record'; end if;
  delete from public.vet_records where id = pg_temp.id('vet')::uuid;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: the owner cannot delete her vet record'; end if;
  insert into public.geckos (name, created_by) values ('Named read', pg_temp.who('alice')) returning 1 into v_n;
  if v_n is null then raise exception 'FAIL: the owner cannot add a gecko reading back named columns'; end if;

  perform pg_temp.as_member('bob');
  update public.weight_records set notes = 'Not yours' where id = pg_temp.id('weight');
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: another member updated Alice''s weight record'; end if;
  select count(*) into v_n from public.ownership_records where id = pg_temp.id('record')::uuid and owner_profile_id = pg_temp.pid('bob');
  if v_n <> 1 then raise exception 'FAIL: the buyer cannot read his ownership record by named columns'; end if;
end $$;

rollback;
