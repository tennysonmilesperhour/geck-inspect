-- Owner email addresses: the two functions that run as their owner.
-- Regression checks for
-- supabase/migrations/20261113225505_owner_emails_functions.sql.
--
-- What it proves:
--   * public_profile_content gives the public profile's geckos and plans to
--     a signed-out visitor, another member and the owner, with no
--     created_by on any row;
--   * nobody but the service role can run community_gecko_counts, which
--     returned every keeper's email;
--   * a second run of the migration changes nothing.
-- Each block raises "FAIL: ..." when a rule is broken.
begin;

\ir ../migrations/20261113225505_owner_emails_functions.sql

create temp table _who (tag text primary key, uid uuid not null, email text not null, pid text) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text, p_name text) returns void language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'ownerfn-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles set full_name = p_name, is_public_profile = true, moderation_hidden = false where email = v_email;
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
create function pg_temp.pid(p_tag text) returns text language sql stable as $$ select pid from _who where tag = p_tag $$;
create function pg_temp.who(p_tag text) returns text language sql stable as $$ select email from _who where tag = p_tag $$;
-- What the page receives, checked the same way for every caller.
create function pg_temp.check_profile(p_label text, p_profile text) returns void language plpgsql as $$
declare v jsonb := public.public_profile_content(p_profile);
begin
  if v is null then raise exception 'FAIL: % got no profile content', p_label; end if;
  if jsonb_array_length(v->'geckos') <> 1 or v->'geckos'->0->>'name' <> 'Mango' then
    raise exception 'FAIL: % did not get the public gecko: %', p_label, v->'geckos';
  end if;
  if jsonb_array_length(v->'breeding_plans') <> 1 then
    raise exception 'FAIL: % did not get the public plan', p_label;
  end if;
  if exists (select 1 from jsonb_array_elements(v->'geckos') e where e ? 'created_by')
     or exists (select 1 from jsonb_array_elements(v->'breeding_plans') e where e ? 'created_by') then
    raise exception 'FAIL: % received the owner''s email on a row', p_label;
  end if;
  if v::text ilike '%' || pg_temp.who('alice') || '%' then
    raise exception 'FAIL: % received the owner''s email somewhere in the content', p_label;
  end if;
end $$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('alice', 'Alice Keeper');
select pg_temp.mk('bob', 'Bob Breeder');

do $$
declare v_mango text; v_pip text;
begin
  perform pg_temp.as_member('alice');
  insert into public.geckos (name, created_by, sex, is_public) values ('Mango', pg_temp.who('alice'), 'Female', true) returning id into v_mango;
  insert into public.geckos (name, created_by, sex, is_public) values ('Pip', pg_temp.who('alice'), 'Male', false) returning id into v_pip;
  insert into public.breeding_plans (sire_id, dam_id, created_by, is_public) values (v_pip, v_mango, pg_temp.who('alice'), true);
  perform set_config('role', 'postgres', true);
end $$;

-- 1. The public profile page: everyone gets the rows, nobody the email.
do $$
begin
  perform pg_temp.as_member('bob');
  perform pg_temp.check_profile('another member', pg_temp.pid('alice'));
  perform pg_temp.as_anon();
  perform pg_temp.check_profile('a signed-out visitor', pg_temp.pid('alice'));
  perform pg_temp.as_member('alice');
  perform pg_temp.check_profile('the owner', pg_temp.pid('alice'));
  perform set_config('role', 'postgres', true);
end $$;

-- 2. The old counts function: the service role only.
do $$
begin
  if has_function_privilege('anon', 'public.community_gecko_counts()', 'execute')
     or has_function_privilege('authenticated', 'public.community_gecko_counts()', 'execute') then
    raise exception 'FAIL: members or visitors can still run community_gecko_counts';
  end if;
  if not has_function_privilege('service_role', 'public.community_gecko_counts()', 'execute') then
    raise exception 'FAIL: the service role lost community_gecko_counts';
  end if;
  if not has_function_privilege('anon', 'public.public_profile_content(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.public_profile_content(text)', 'execute') then
    raise exception 'FAIL: the public profile page can no longer read its content';
  end if;
  perform pg_temp.as_member('bob');
  begin
    perform * from public.community_gecko_counts();
    raise exception 'FAIL: a member ran community_gecko_counts';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('role', 'postgres', true);
end $$;

-- 3. A second run changes nothing.
\ir ../migrations/20261113225505_owner_emails_functions.sql
do $$
begin
  perform pg_temp.as_member('bob');
  perform pg_temp.check_profile('another member, after a rerun', pg_temp.pid('alice'));
  perform set_config('role', 'postgres', true);
end $$;

rollback;
