-- Follow-ups from the final review of round 1.
-- Regression checks for supabase/migrations/20261016090000_followups.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/followups_regressions.sql
--
-- Each block raises "FAIL: ..." when the problem is back, and also checks
-- that the legitimate flow next to it still works. Every block fails on a
-- copy that has round 1 (20261015120000, 20261015130000) but not this
-- migration.
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null,
  profile_id text
) on commit drop;
grant all on _who to public;

-- Members are created the way Supabase Auth does it (the auth.users
-- trigger makes the profile row).
create function pg_temp.mk(p_tag text, p_name text, p_role text default 'user', p_public boolean default true)
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'fu-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles
     set full_name = p_name, role = p_role, is_public_profile = p_public, moderation_hidden = false
   where email = v_email;
  insert into _who values (p_tag, v_id, v_email, (select id from public.profiles where email = v_email));
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
create function pg_temp.who(p_tag text, p_field text default 'email') returns text language sql stable as $$
  select case p_field when 'email' then email when 'uid' then uid::text else profile_id end from _who where tag = p_tag
$$;
-- Runs a statement that must fail; a different error than expected fails too.
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
-- A plain message insert, the way the app's DirectMessage.create sends it.
create function pg_temp.dm(p_to text, p_type text default null) returns text language plpgsql as $$
declare v_id text;
begin
  insert into public.direct_messages (sender_email, recipient_email, content, message_type, created_by)
  values (auth.email(), p_to, 'Is the Lilly White female still available?', coalesce(p_type, 'direct'), auth.email())
  returning id into v_id;
  return v_id;
end $$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('alice', 'Alice Keeper');
select pg_temp.mk('bob', 'Bob Breeder');
select pg_temp.mk('carol', null);
select pg_temp.mk('priv', 'Private Keeper', 'user', false);
select pg_temp.mk('privseller', 'Quiet Seller', 'user', false);
select pg_temp.mk('admin', 'Site Admin', 'admin', false);

-- =====================================================================
-- 1. The breeder page trust panel answers signed-out visitors
-- =====================================================================
do $t$
declare r record; v_slug text := 'fu-breeder-' || left(gen_random_uuid()::text, 8); v_g text; v_hidden text; n integer;
begin
  perform pg_temp.as_postgres();
  update public.profiles set created_date = now() - interval '400 days', is_featured_breeder = true
   where email = pg_temp.who('alice');
  insert into public.breeder_profiles (display_name, custom_slug, created_by, user_id, is_verified)
  values ('Alice Keeper Geckos', v_slug, pg_temp.who('alice'), pg_temp.who('alice', 'uid')::uuid, true);
  -- Two public geckos (one with a passport), one private gecko.
  insert into public.geckos (name, created_by, sex, is_public, passport_code)
  values ('Harlequin female', pg_temp.who('alice'), 'Female', true, 'FU-PASS-1') returning id into v_g;
  insert into public.geckos (name, created_by, sex, is_public) values ('Phantom male', pg_temp.who('alice'), 'Male', true);
  insert into public.geckos (name, created_by, sex, is_public, passport_code)
  values ('Holdback', pg_temp.who('alice'), 'Female', false, 'FU-PASS-2') returning id into v_hidden;
  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by)
  select v_g, 30 + g, current_date - g, pg_temp.who('alice') from generate_series(1, 3) g;
  -- Weigh-ins on the private gecko are not counted.
  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by)
  values (v_hidden, 40, current_date, pg_temp.who('alice'));
  insert into public.breeder_reviews (reviewed_user_id, rating, is_verified)
  values (pg_temp.who('alice', 'uid')::uuid, 5, true), (pg_temp.who('alice', 'uid')::uuid, 4, true),
         (pg_temp.who('alice', 'uid')::uuid, 1, false);

  perform pg_temp.as_anon();
  select * into r from public.breeder_page_trust(v_slug);
  if r is null or r.animals_tracked is distinct from 2 then
    raise exception 'FAIL: signed-out trust panel: animals %', r.animals_tracked;
  end if;
  if r.account_age_months < 12 or r.weight_logs_count <> 3 or r.review_count <> 2
     or r.avg_rating <> 4.5 or not r.is_verified_breeder or not r.is_featured_breeder then
    raise exception 'FAIL: signed-out trust panel numbers: %', row_to_json(r);
  end if;
  if row_to_json(r)::text like '%@%' then
    raise exception 'FAIL: the trust panel handed out an email: %', row_to_json(r);
  end if;
  -- An owner who went private, or a hidden page, gets no panel.
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = false where email = pg_temp.who('alice');
  perform pg_temp.as_anon();
  select count(*) into n from public.breeder_page_trust(v_slug);
  if n <> 0 then raise exception 'FAIL: trust panel answered for a private owner'; end if;
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = true where email = pg_temp.who('alice');
  update public.breeder_profiles set moderation_hidden = true where custom_slug = v_slug;
  perform pg_temp.as_anon();
  select count(*) into n from public.breeder_page_trust(v_slug);
  if n <> 0 then raise exception 'FAIL: trust panel answered for a hidden breeder page'; end if;
  perform pg_temp.as_postgres();
  -- Signed-in members get it too.
  update public.breeder_profiles set moderation_hidden = false where custom_slug = v_slug;
  perform pg_temp.as_member('bob');
  select count(*) into n from public.breeder_page_trust(v_slug);
  if n <> 1 then raise exception 'FAIL: trust panel did not answer a signed-in member'; end if;
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 2 and 3. Display names: business punctuation in, team look-alikes out
-- =====================================================================
do $t$
declare v_name text; v_got text;
begin
  perform pg_temp.as_postgres();
  -- Ordinary business names now show as written.
  foreach v_name in array array[
    'Pangea & Co. Geckos',
    'Smith, Jones and Sons',
    'J. R. Cresties',
    'Harlequin House Co.',
    'Lilly White Geckos Inc.',
    'Supportive Keeper',
    'Staffordshire Cresties',
    'Tenny''s Cresties 2'
  ] loop
    update public.profiles set full_name = v_name, business_name = null, breeder_name = null
     where email = pg_temp.who('carol');
    v_got := public._member_notification(pg_temp.who('carol'), pg_temp.who('bob'), 'new_follower') ->> 'content';
    if v_got <> v_name || ' started following you.' then
      raise exception 'FAIL: the plain name % became: %', v_name, v_got;
    end if;
  end loop;
  update public.profiles set full_name = null where email = pg_temp.who('carol');
end
$t$;

do $t$
declare v_name text; v_got text;
begin
  perform pg_temp.as_postgres();
  -- Still blocked: web addresses in any spelling (round 1's list), team
  -- words with digits or joined to other words, and phone numbers.
  foreach v_name in array array[
    -- round 1 bypasses
    'Security alert: verify at bit.ly/gi-verify',
    'Verify at gi-help.ru',
    'evil[.]com',
    'evil' || chr(65294) || 'com',
    'G e c k Inspect Support',
    'Geck Insp' || chr(1077) || 'ct Team',
    'GeckInspect',
    'Geck 1nspect',
    'bob@example.com',
    'https://evil.example',
    'ev' || chr(305) || 'l.com',                    -- dotless i
    -- dots that make an address
    'Pangea.co Geckos',
    'Visit evil.com today',
    'Co..uk',
    -- team words in disguise
    'Supp0rt Team',
    'Adm1n',
    '0fficial Notice',
    'Officia1 Notice',
    'GeckSupport',
    'Securityteam',
    'SupportDesk',
    'Billing & Accounts',
    'Admins, Moderators',
    'Staff.',
    '5upport',
    -- phone numbers
    'Call 18005550199 now',
    'Text 555 0199 123'
  ] loop
    update public.profiles set full_name = v_name, business_name = null, breeder_name = null
     where email = pg_temp.who('carol');
    v_got := public._member_notification(pg_temp.who('carol'), pg_temp.who('bob'), 'new_follower') ->> 'content';
    if v_got <> 'A Geck Inspect member started following you.' then
      raise exception 'FAIL: display name % reached the notification as: %', v_name, v_got;
    end if;
  end loop;
  update public.profiles set full_name = null where email = pg_temp.who('carol');
end
$t$;

-- =====================================================================
-- 4. A member's plain message insert reaches only who it should
-- =====================================================================
do $t$
declare v_id text; v_type text; n integer; i integer;
begin
  -- Not a stranger with a private profile.
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('plain message to a private member',
    format('select pg_temp.dm(%L)', pg_temp.who('priv')), '%row-level security%');
  -- Nor an address that never signed up.
  perform pg_temp.must_fail('plain message to an unknown address',
    $q$select pg_temp.dm('nobody-here@example.com')$q$, '%row-level security%');

  -- A public member: fine, in any capitalisation.
  perform pg_temp.dm(upper(pg_temp.who('alice')));
  -- The owner of a public gecko (gecko page, marketplace, passport): fine.
  perform pg_temp.as_postgres();
  insert into public.geckos (name, created_by, sex, is_public, status)
  values ('Axanthic female', pg_temp.who('privseller'), 'Female', true, 'For Sale');
  perform pg_temp.as_member('bob');
  perform pg_temp.dm(pg_temp.who('privseller'), 'marketplace_inquiry');

  -- A private member who messaged you can be answered.
  perform pg_temp.as_postgres();
  insert into public.direct_messages (sender_email, recipient_email, content, created_by)
  values (pg_temp.who('priv'), pg_temp.who('bob'), 'Hi Bob', pg_temp.who('priv'));
  perform pg_temp.as_member('bob');
  perform pg_temp.dm(pg_temp.who('priv'));
  -- And the private member keeps replying to Bob.
  perform pg_temp.as_member('priv');
  perform pg_temp.dm(pg_temp.who('bob'));

  -- Admins reach anyone; members reach the admin who wrote to them.
  perform pg_temp.as_member('admin');
  perform pg_temp.dm(pg_temp.who('carol'));
  perform pg_temp.as_member('carol');
  perform pg_temp.dm(pg_temp.who('admin'));

  -- Nobody sends as someone else.
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('message sent as another member',
    format($q$insert into public.direct_messages (sender_email, recipient_email, content, created_by)
              values (%L, %L, 'x', %L)$q$, pg_temp.who('alice'), pg_temp.who('carol'), pg_temp.who('bob')),
    '%row-level security%');

  -- send_direct_message_to_profile still works.
  perform public.send_direct_message_to_profile(pg_temp.who('alice', 'profile'), 'Directory hello');

  -- 20 new conversations an hour, as for send_direct_message_to_profile.
  perform pg_temp.as_postgres();
  for i in 1..21 loop
    perform pg_temp.mk('crowd' || i, 'Crowd Keeper ' || i);
  end loop;
  perform pg_temp.as_member('carol');
  -- Carol has written to the admin already (1 recipient this hour).
  for i in 1..19 loop
    perform pg_temp.dm(pg_temp.who('crowd' || i));
  end loop;
  perform pg_temp.must_fail('the 21st new conversation in an hour',
    format('select pg_temp.dm(%L)', pg_temp.who('crowd20')), '%Too many new conversations%');
  -- An existing conversation is not limited.
  perform pg_temp.dm(pg_temp.who('crowd1'));
  perform pg_temp.dm(pg_temp.who('admin'));
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 5. "system" in any spacing is still the team's
-- =====================================================================
do $t$
declare v_type text; v_id text;
begin
  perform pg_temp.as_member('bob');
  foreach v_type in array array[' system', 'system ', E'system\n', E'\tSYSTEM', 'System' || chr(160),
                                'sys' || chr(8203) || 'tem', chr(65279) || 'system'] loop
    perform pg_temp.must_fail(format('member message of type %L', v_type),
      format('select pg_temp.dm(%L, %L)', pg_temp.who('alice'), v_type), '%Only Geck Inspect sends system messages%');
  end loop;
  -- An ordinary type is stored trimmed and lower-cased.
  v_id := pg_temp.dm(pg_temp.who('alice'), E' Marketplace_Inquiry\n');
  perform pg_temp.as_postgres();
  select message_type into v_type from public.direct_messages where id = v_id;
  if v_type is distinct from 'marketplace_inquiry' then
    raise exception 'FAIL: message type stored as %', v_type;
  end if;
  -- An admin's " system " is stored as "system", so Messages shows the
  -- team bubble.
  perform pg_temp.as_member('admin');
  v_id := pg_temp.dm(pg_temp.who('alice'), ' system ');
  perform pg_temp.as_postgres();
  select message_type into v_type from public.direct_messages where id = v_id;
  if v_type is distinct from 'system' then
    raise exception 'FAIL: admin system message stored as %', v_type;
  end if;
end
$t$;

-- =====================================================================
-- 6. Signed-out visitors cannot read members' emails on seven more tables
-- =====================================================================
do $t$
declare v_bad text;
begin
  perform pg_temp.as_postgres();
  select string_agg(t.tbl, ', ') into v_bad
    from (values ('breeding_projects'), ('clutches'), ('genetic_outcome_predictions'), ('question_votes'),
                 ('blog_categories'), ('blog_posts'), ('blog_tags')) t(tbl)
   where has_column_privilege('anon', 'public.' || t.tbl, 'created_by', 'select')
      or not has_column_privilege('authenticated', 'public.' || t.tbl, 'created_by', 'select');
  if v_bad is not null then raise exception 'FAIL: created_by wrongly granted on: %', v_bad; end if;
  -- Every other column stays readable.
  select string_agg(c.relname || '.' || a.attname, ', ') into v_bad
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('breeding_projects', 'clutches', 'genetic_outcome_predictions', 'question_votes',
                       'blog_categories', 'blog_posts', 'blog_tags')
     and a.attname <> 'created_by'
     and not has_column_privilege('anon', c.oid, a.attnum, 'select');
  if v_bad is not null then raise exception 'FAIL: signed-out visitors lost ordinary columns: %', v_bad; end if;

  perform pg_temp.as_anon();
  perform pg_temp.must_fail('signed-out read of breeding project authors',
    'select created_by from public.breeding_projects', '%permission denied%');
  perform pg_temp.must_fail('signed-out read of blog post authors',
    'select created_by from public.blog_posts', '%permission denied%');
  -- The blog pages' column lists still work.
  perform id, title, slug, status, published_at, author_name from public.blog_posts limit 1;
  perform id, name, slug, is_active from public.blog_categories limit 1;
  perform id, name, slug, is_active from public.blog_tags limit 1;
  perform pg_temp.as_postgres();
end
$t$;

select 'followups_regressions: all checks passed' as result;
rollback;
