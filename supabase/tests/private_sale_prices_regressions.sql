-- Sale prices kept from other members. Regression checks for
-- supabase/migrations/20261113172624_private_sale_prices.sql.
--
-- The SQL harness runs it with every other file in supabase/tests. On a
-- database built before that migration, the file applies it first, inside
-- its own transaction, so everything rolls back.
--
-- What it proves:
--   * a price saved the way the app saves it (geckos.sold_price, on insert
--     or update) lands in gecko_sale_prices, and the gecko's row reads null;
--   * another member, a signed-out visitor and a collection viewer cannot
--     read it from the row, and only the owner, the collection's members
--     and admins can read it from the new table;
--   * only the owner, a collection editor or an admin can clear it, nobody
--     can write the table directly, and an insert that names another
--     member's gecko ("on conflict do nothing") cannot set its price;
--   * unarchiving a gecko and a change of owner take the price away;
--   * a shared collection's activity feed still lists "sale price" when a
--     member changes one, and adds nothing extra when a sale is undone;
--   * an ownership record's price moves to ownership_record_prices, which
--     only the record's member and admins can read, even when the passport
--     is public;
--   * deleting a gecko deletes its price.
-- Each block raises "FAIL: ..." when a rule is broken.
begin;

select to_regclass('public.gecko_sale_prices') is null as needs_migration \gset
\if :needs_migration
\ir ../migrations/20261113172624_private_sale_prices.sql
\endif

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
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
  v_email text := 'saleprice-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
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
  insert into _who values (p_tag, v_id, v_email);
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
create function pg_temp.id(p_tag text) returns text language sql stable as $$
  select id from _ids where tag = p_tag
$$;
create function pg_temp.price(p_gecko text) returns numeric language sql stable as $$
  select sold_price from public.gecko_sale_prices where gecko_id = p_gecko
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
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('alice', 'Alice Keeper');
select pg_temp.mk('bob', 'Bob Breeder');
select pg_temp.mk('ed', 'Ed Editor');
select pg_temp.mk('vic', 'Vic Viewer');
select pg_temp.mk('admin', 'Site Admin', 'admin');
-- Alice is on the Breeder plan, which allows more than one collaborator.
update public.profiles set membership_tier = 'breeder' where email = pg_temp.who('alice');

-- Alice's geckos, public like most geckos, in her default collection,
-- which she shares with an editor and a viewer.
do $$
declare v_id text; v_cid uuid;
begin
  perform pg_temp.as_member('alice');
  insert into public.geckos (name, created_by, sex, is_public) values ('Mango', pg_temp.who('alice'), 'Female', true)
  returning id, collection_id into v_id, v_cid;
  insert into _ids values ('mango', v_id), ('cid', v_cid::text);
  insert into public.geckos (name, created_by, sex, is_public) values ('Pip', pg_temp.who('alice'), 'Male', true)
  returning id into v_id;
  insert into _ids values ('pip', v_id);
  perform pg_temp.as_postgres();
  insert into public.collection_members (collection_id, member_email, role, status, accepted_at)
  values (v_cid, pg_temp.who('ed'), 'editor', 'accepted', now()),
         (v_cid, pg_temp.who('vic'), 'viewer', 'accepted', now());
end $$;

-- 1. Saving a price: archive as sold, the way My Geckos saves it.
do $$
declare v_col numeric;
begin
  perform pg_temp.as_member('alice');
  update public.geckos
     set archived = true, archive_reason = 'sold', status = 'Sold', sold_price = 300
   where id = pg_temp.id('mango');
  select sold_price into v_col from public.geckos where id = pg_temp.id('mango');
  if v_col is not null then raise exception 'FAIL: the gecko row still holds the price (%)', v_col; end if;
  if pg_temp.price(pg_temp.id('mango')) is distinct from 300 then
    raise exception 'FAIL: the owner cannot read her own price (got %)', pg_temp.price(pg_temp.id('mango'));
  end if;
end $$;

-- 2. A gecko added with a price already on it (the insert path).
do $$
declare v_id text;
begin
  perform pg_temp.as_member('alice');
  insert into public.geckos (name, created_by, sex, is_public, archived, archive_reason, status, sold_price)
  values ('Juno', pg_temp.who('alice'), 'Female', true, true, 'sold', 'Sold', 150)
  returning id into v_id;
  insert into _ids values ('juno', v_id);
  if (select sold_price from public.geckos where id = v_id) is not null then
    raise exception 'FAIL: an insert left the price on the row';
  end if;
  if pg_temp.price(v_id) is distinct from 150 then raise exception 'FAIL: an insert lost the price'; end if;
end $$;

-- 3. Another member: reads the public row, never the price.
do $$
declare v_n int; v_col numeric; v_name text;
begin
  perform pg_temp.as_member('bob');
  select name, sold_price into v_name, v_col from public.geckos where id = pg_temp.id('mango');
  if v_name is null then raise exception 'FAIL: the setup is wrong, Bob cannot see the public gecko'; end if;
  if v_col is not null then raise exception 'FAIL: Bob reads the sale price on the row'; end if;
  select count(*) into v_n from public.gecko_sale_prices;
  if v_n <> 0 then raise exception 'FAIL: Bob reads % sale price row(s)', v_n; end if;
  delete from public.gecko_sale_prices where gecko_id = pg_temp.id('mango');
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('mango')) is distinct from 300 then raise exception 'FAIL: Bob cleared Alice''s price'; end if;
end $$;

select pg_temp.as_member('bob');
select pg_temp.must_fail('Bob writing the price table',
  format($s$insert into public.gecko_sale_prices (gecko_id, sold_price) values (%L, 1)$s$, pg_temp.id('mango')),
  '%permission denied%');
select pg_temp.must_fail('Bob changing a price in the table',
  format($s$update public.gecko_sale_prices set sold_price = 1 where gecko_id = %L$s$, pg_temp.id('mango')),
  '%permission denied%');
select pg_temp.must_fail('Bob setting the price through the gecko row',
  format($s$do $d$ begin
     update public.geckos set sold_price = 1 where id = %L;
     if not found then raise exception 'no row'; end if;
   end $d$$s$, pg_temp.id('mango')),
  '%no row%');

-- The insert trick: name Alice's gecko id on an insert that does nothing.
do $$
begin
  perform pg_temp.as_member('bob');
  insert into public.geckos (id, name, created_by, sold_price)
  values (pg_temp.id('mango'), 'not mine', pg_temp.who('bob'), 1)
  on conflict (id) do nothing;
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('mango')) is distinct from 300 then
    raise exception 'FAIL: an insert that did nothing set Alice''s price to %', pg_temp.price(pg_temp.id('mango'));
  end if;
end $$;

-- 4. Signed out: no price anywhere.
select pg_temp.as_anon();
select pg_temp.must_fail('a signed-out read of the price table',
  'select * from public.gecko_sale_prices', '%permission denied%');
select pg_temp.must_fail('a signed-out read of the old column',
  'select sold_price from public.geckos', '%permission denied%');

-- 5. The shared collection: the viewer reads, the editor may clear, the admin reads all.
do $$
declare v_n int;
begin
  perform pg_temp.as_member('vic');
  if (select sold_price from public.gecko_sale_prices where gecko_id = pg_temp.id('mango')) is distinct from 300 then
    raise exception 'FAIL: a collection viewer cannot read the price';
  end if;
  delete from public.gecko_sale_prices where gecko_id = pg_temp.id('mango');
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('mango')) is distinct from 300 then raise exception 'FAIL: a viewer cleared the price'; end if;

  perform pg_temp.as_member('admin');
  select count(*) into v_n from public.gecko_sale_prices where gecko_id in (pg_temp.id('mango'), pg_temp.id('juno'));
  if v_n <> 2 then raise exception 'FAIL: the admin reads % of 2 prices', v_n; end if;

  perform pg_temp.as_member('ed');
  delete from public.gecko_sale_prices where gecko_id = pg_temp.id('juno');
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('juno')) is not null then raise exception 'FAIL: a collection editor could not clear a price'; end if;
end $$;

-- 6. The activity feed of the shared collection lists the price change.
do $$
declare v_detail text;
begin
  perform pg_temp.as_member('alice');
  update public.geckos set sold_price = 320 where id = pg_temp.id('mango');
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('mango')) is distinct from 320 then raise exception 'FAIL: the price was not changed'; end if;
  select string_agg(detail, ' | ') into v_detail
    from public.collection_activity
   where gecko_id = pg_temp.id('mango') and action = 'edited';
  if coalesce(v_detail, '') not like '%sale price%' then
    raise exception 'FAIL: the activity feed does not list the sale price (%)', v_detail;
  end if;
end $$;

-- 7. Unarchiving undoes the sale: the price goes, quietly. The editor does
-- it, so an extra "sale price" entry would show as a new entry of theirs.
do $$
begin
  perform pg_temp.as_member('ed');
  update public.geckos set archived = false, archived_date = null, archive_reason = null
   where id = pg_temp.id('mango');
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('mango')) is not null then raise exception 'FAIL: unarchiving kept the price'; end if;
  if not exists (select 1 from public.collection_activity
                  where gecko_id = pg_temp.id('mango') and action = 'restored'
                    and actor_email = lower(pg_temp.who('ed'))) then
    raise exception 'FAIL: the activity feed lost the restored entry';
  end if;
  if exists (select 1 from public.collection_activity
              where gecko_id = pg_temp.id('mango') and action = 'edited'
                and actor_email = lower(pg_temp.who('ed')) and detail like '%sale price%') then
    raise exception 'FAIL: undoing a sale also logged a sale price edit';
  end if;
end $$;

-- 8. A new owner: the last owner's price goes.
do $$
begin
  perform pg_temp.as_member('alice');
  update public.geckos set archived = true, archive_reason = 'sold', status = 'Sold', sold_price = 275
   where id = pg_temp.id('pip');
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('pip')) is distinct from 275 then raise exception 'FAIL: the setup price did not save'; end if;
  -- What claim_transfer does, from the server.
  update public.geckos set created_by = pg_temp.who('bob'), collection_id = null, archived = false, sold_price = null
   where id = pg_temp.id('pip');
  if pg_temp.price(pg_temp.id('pip')) is not null then raise exception 'FAIL: the new owner inherited the old owner''s price'; end if;
end $$;

-- 9. Ownership records: the price is the buyer's alone, even on a public passport.
do $$
declare v_rec uuid; v_n int; v_col numeric;
begin
  perform pg_temp.as_postgres();
  update public.geckos set passport_code = 'GI-2026-SALE', is_public = true, moderation_hidden = false
   where id = pg_temp.id('pip');
  insert into public.ownership_records (animal_id, owner_user_id, owner_name, acquired_date, transfer_method, sale_price, created_by)
  values (pg_temp.id('pip'), (select uid from _who where tag = 'bob'), 'Bob Breeder', current_date, 'purchased', 275, pg_temp.who('bob'))
  returning id into v_rec;
  insert into _ids values ('record', v_rec::text);
  if (select sale_price from public.ownership_records where id = v_rec) is not null then
    raise exception 'FAIL: the ownership record still holds the price';
  end if;

  perform pg_temp.as_member('bob');
  if (select sale_price from public.ownership_record_prices where record_id = v_rec) is distinct from 275 then
    raise exception 'FAIL: the buyer cannot read what he paid';
  end if;

  perform pg_temp.as_member('alice');
  select count(*) into v_n from public.ownership_record_prices;
  if v_n <> 0 then raise exception 'FAIL: another member reads % ownership price(s)', v_n; end if;

  perform pg_temp.as_anon();
  select sale_price into v_col from public.ownership_records where id = v_rec;
  if not found then raise exception 'FAIL: the setup is wrong, the public passport''s record is not readable'; end if;
  if v_col is not null then raise exception 'FAIL: a signed-out visitor reads the price on a public passport'; end if;
end $$;

select pg_temp.as_anon();
select pg_temp.must_fail('a signed-out read of ownership prices',
  'select * from public.ownership_record_prices', '%permission denied%');

-- 10. Deleting a gecko deletes its price.
do $$
begin
  perform pg_temp.as_member('alice');
  update public.geckos set archived = true, archive_reason = 'sold', sold_price = 90 where id = pg_temp.id('juno');
  perform pg_temp.as_postgres();
  if pg_temp.price(pg_temp.id('juno')) is distinct from 90 then raise exception 'FAIL: setup'; end if;
  delete from public.geckos where id = pg_temp.id('juno');
  if exists (select 1 from public.gecko_sale_prices where gecko_id = pg_temp.id('juno')) then
    raise exception 'FAIL: a deleted gecko left its price behind';
  end if;
end $$;

-- 11. Nothing left on the old columns, anywhere.
do $$
begin
  perform pg_temp.as_postgres();
  if exists (select 1 from public.geckos where sold_price is not null) then
    raise exception 'FAIL: a gecko row holds a sale price';
  end if;
  if exists (select 1 from public.ownership_records where sale_price is not null) then
    raise exception 'FAIL: an ownership record holds a sale price';
  end if;
end $$;

rollback;
