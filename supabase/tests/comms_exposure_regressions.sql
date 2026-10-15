-- Notifications, messages, data exposure and account erasure.
-- Regression checks for supabase/migrations/20261015130000_comms_and_exposure.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/comms_exposure_regressions.sql
--
-- Each block raises "FAIL: ..." when a hole is open again, and also checks
-- that the legitimate flow next to it still works.
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
create function pg_temp.mk(p_tag text, p_name text, p_role text default 'user', p_tier text default 'free')
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'comms-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
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
     set full_name = p_name, role = p_role, membership_tier = p_tier,
         is_public_profile = true, moderation_hidden = false
   where email = v_email;
  insert into _who values (p_tag, v_id, v_email, (select id from public.profiles where email = v_email));
end
$$;

-- Act as a signed-in member, a signed-out visitor, the service role, or
-- go back to the superuser. The session user is a superuser, so switching
-- back from a member works.
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
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('alice', 'Alice Keeper');
select pg_temp.mk('bob', 'Bob Breeder');
select pg_temp.mk('carol', null);
select pg_temp.mk('admin', 'Site Admin', 'admin');
select pg_temp.mk('ent', 'Enterprise Breeder', 'user', 'enterprise');

-- =====================================================================
-- 1. Notifications
-- =====================================================================
do $t$
declare n integer; r record; i integer;
begin
  -- A member cannot send another member an announcement in their own words.
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('member announcement to another member',
    format($q$insert into public.notifications (user_email, type, content, link)
              values (%L, 'announcement', 'Your account is locked, sign in at evil.example', '//evil.example')$q$,
           pg_temp.who('alice')));
  -- Nor a "new message" without having sent one.
  perform pg_temp.must_fail('message notification with no message',
    format($q$insert into public.notifications (user_email, type, content, link)
              values (%L, 'new_message', 'hi', '/Messages')$q$, pg_temp.who('alice')));

  -- After a real message, the notification goes through, with our words
  -- and our link whatever the browser sent.
  insert into public.direct_messages (sender_email, recipient_email, content, created_by)
  values (pg_temp.who('bob'), pg_temp.who('alice'), 'Is Zeus still for sale?', pg_temp.who('bob'));
  insert into public.notifications (user_email, type, content, link, metadata)
  values (pg_temp.who('alice'), 'new_message', 'Verify your account at http://evil.example', '//evil.example',
          '{"sender_email":"x@example.com"}');
  -- A second one inside 10 minutes is dropped, not sent again.
  insert into public.notifications (user_email, type, content, link)
  values (pg_temp.who('alice'), 'new_message', 'again', '/Messages');
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications where user_email = pg_temp.who('alice') and type = 'new_message';
  if n <> 1 then raise exception 'FAIL: expected one message notification, found %', n; end if;
  select * into r from public.notifications where user_email = pg_temp.who('alice') and type = 'new_message';
  if r.content <> 'Bob Breeder sent you a message.' then raise exception 'FAIL: member text reached the notification: %', r.content; end if;
  if r.link not like '/Messages?recipient=comms-bob-%' then raise exception 'FAIL: member link kept: %', r.link; end if;
  -- The sender's address is percent-encoded in the link, "@" included.
  if position('@' in r.link) > 0 or r.link not like '%\%40example.com' then
    raise exception 'FAIL: the @ in the Messages link is not encoded: %', r.link;
  end if;
  if r.metadata ? 'sender_email' then raise exception 'FAIL: member metadata kept'; end if;

  -- Links: a member's note to themselves keeps an in-app link, and any
  -- other link becomes "/".
  perform pg_temp.as_member('bob');
  insert into public.notifications (user_email, type, content, link) values
    (pg_temp.who('bob'), 'level_up', 'one', '//evil.example'),
    (pg_temp.who('bob'), 'level_up', 'two', '/\evil.example'),
    (pg_temp.who('bob'), 'level_up', 'three', 'https://evil.example'),
    (pg_temp.who('bob'), 'level_up', 'four', '/Breeding');
  perform pg_temp.as_postgres();
  for r in select content, link from public.notifications where user_email = pg_temp.who('bob') loop
    if r.content in ('one', 'two', 'three') and r.link <> '/' then
      raise exception 'FAIL: off-site link kept: %', r.link;
    end if;
    if r.content = 'four' and r.link <> '/Breeding' then raise exception 'FAIL: in-app link changed: %', r.link; end if;
  end loop;

  -- At most 30 notes to oneself an hour.
  perform pg_temp.as_member('carol');
  for i in 1..30 loop
    insert into public.notifications (user_email, type, content, link) values (pg_temp.who('carol'), 'level_up', 'n' || i, '/MyGeckos');
  end loop;
  perform pg_temp.must_fail('31st note to self in an hour',
    format($q$insert into public.notifications (user_email, type, content) values (%L, 'level_up', 'too many')$q$, pg_temp.who('carol')),
    '%Too many notifications%');

  -- Signed-out visitors cannot write notifications at all.
  perform pg_temp.as_anon();
  perform pg_temp.must_fail('signed-out notification',
    format($q$insert into public.notifications (user_email, type, content) values (%L, 'announcement', 'x')$q$, pg_temp.who('alice')));

  -- Admins still send announcements in their own words; links are still in-app.
  perform pg_temp.as_member('admin');
  insert into public.notifications (user_email, type, content, link)
  values (pg_temp.who('alice'), 'announcement', 'Shipping week starts Monday', '//evil.example');
  perform pg_temp.as_postgres();
  select * into r from public.notifications where user_email = pg_temp.who('alice') and type = 'announcement';
  if r.content <> 'Shipping week starts Monday' or r.link <> '/' then
    raise exception 'FAIL: admin announcement: % %', r.content, r.link;
  end if;
  perform pg_temp.as_postgres();
end
$t$;

-- Forum replies, follows and new listings still notify, from templates.
do $t$
declare v_cat text; v_post text; r record; n integer;
begin
  perform pg_temp.as_postgres();
  insert into public.forum_categories (name, description) values ('Comms test', 'Regression fixture') returning id into v_cat;
  insert into public.forum_posts (title, content, category_id, author_name, created_by)
  values ('Lilly White pairing', 'Thoughts?', v_cat, 'Alice Keeper', pg_temp.who('alice')) returning id into v_post;

  perform pg_temp.as_member('bob');
  -- Not before Bob has commented.
  perform pg_temp.must_fail('comment notification with no comment',
    format($q$insert into public.notifications (user_email, type, content, metadata) values (%L, 'new_comment', 'x', %L)$q$,
           pg_temp.who('alice'), jsonb_build_object('post_id', v_post)));
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Great project', 'Bob Breeder', pg_temp.who('bob'));
  insert into public.notifications (user_email, type, content, link, metadata)
  values (pg_temp.who('alice'), 'new_comment', 'free text', '//evil.example', jsonb_build_object('post_id', v_post));
  -- Only to someone who posted in the thread.
  perform pg_temp.must_fail('comment notification to a stranger',
    format($q$insert into public.notifications (user_email, type, content, metadata) values (%L, 'new_comment', 'x', %L)$q$,
           pg_temp.who('carol'), jsonb_build_object('post_id', v_post)));

  -- Follow by profile id: the member is notified by the database.
  if not public.follow_profile(pg_temp.who('alice', 'profile'), true) then raise exception 'FAIL: follow did not stick'; end if;
  if (select count(*) from public.follow_state(array[pg_temp.who('alice', 'profile'), pg_temp.who('carol', 'profile')])) <> 1 then
    raise exception 'FAIL: follow_state';
  end if;
  -- Alice can now hear about Bob's new geckos (Bob follows Alice, not the
  -- other way round, so this one is refused).
  perform pg_temp.must_fail('listing notification to a non-follower',
    format($q$insert into public.notifications (user_email, type, content) values (%L, 'new_gecko_listing', 'x')$q$, pg_temp.who('alice')));

  perform pg_temp.as_postgres();
  select * into r from public.notifications where user_email = pg_temp.who('alice') and type = 'new_comment';
  if r.content <> 'Bob Breeder commented on your forum post.' or r.link <> '/ForumPost?id=' || v_post then
    raise exception 'FAIL: comment notification: % %', r.content, r.link;
  end if;
  select * into r from public.notifications where user_email = pg_temp.who('alice') and type = 'new_follower';
  if r.content <> 'Bob Breeder started following you.' or r.link <> '/PublicProfile?userId=' || pg_temp.who('bob', 'profile') then
    raise exception 'FAIL: follower notification: % %', r.content, r.link;
  end if;

  -- Alice lists a gecko: her follower Bob hears about it.
  perform pg_temp.as_member('alice');
  insert into public.notifications (user_email, type, content, link)
  values (pg_temp.who('bob'), 'new_gecko_listing', 'anything', '//evil.example');
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications
   where user_email = pg_temp.who('bob') and type = 'new_gecko_listing' and content = 'Alice Keeper listed a new gecko.';
  if n <> 1 then raise exception 'FAIL: follower listing notification missing'; end if;

  -- Unfollow.
  perform pg_temp.as_member('bob');
  if public.follow_profile(pg_temp.who('alice', 'profile'), false) then raise exception 'FAIL: unfollow'; end if;
  perform pg_temp.as_postgres();
end
$t$;

-- Blocking stops notifications, and an old follow cannot announce itself
-- again and again.
do $t$
declare v_cat text; v_post text; n integer;
begin
  perform pg_temp.as_postgres();
  insert into public.forum_categories (name, description) values ('Comms block test', 'Regression fixture') returning id into v_cat;
  insert into public.forum_posts (title, content, category_id, author_name, created_by)
  values ('Harlequin pairing', 'Thoughts?', v_cat, 'Alice Keeper', pg_temp.who('alice')) returning id into v_post;

  -- Alice blocks Bob.
  perform pg_temp.as_member('alice');
  perform public.block_profile(pg_temp.who('bob', 'profile'));

  -- Bob follows Alice by writing the follow row himself (skipping
  -- follow_profile), comments on her post, then tries to notify her.
  perform pg_temp.as_member('bob');
  insert into public.user_follows (follower_email, following_email, created_by)
  values (pg_temp.who('bob'), pg_temp.who('alice'), pg_temp.who('bob'));
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Nice Harlequin', 'Bob Breeder', pg_temp.who('bob'));
  perform pg_temp.must_fail('follower notification from a blocked member',
    format($q$insert into public.notifications (user_email, type, content) values (%L, 'new_follower', 'x')$q$,
           pg_temp.who('alice')), '%cannot notify%');
  perform pg_temp.must_fail('comment notification from a blocked member',
    format($q$insert into public.notifications (user_email, type, content, metadata) values (%L, 'new_comment', 'x', %L)$q$,
           pg_temp.who('alice'), jsonb_build_object('post_id', v_post)), '%cannot notify%');
  -- And the other way round: Alice cannot notify the member she blocked.
  perform pg_temp.as_member('alice');
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Thanks', 'Alice Keeper', pg_temp.who('alice'));
  perform pg_temp.must_fail('reply notification to a blocked member',
    format($q$insert into public.notifications (user_email, type, content, metadata) values (%L, 'new_reply', 'x', %L)$q$,
           pg_temp.who('bob'), jsonb_build_object('post_id', v_post)), '%cannot notify%');
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications
   where user_email = pg_temp.who('alice') and created_by = pg_temp.who('bob')
     and metadata ->> 'post_id' is not distinct from v_post;
  if n <> 0 then raise exception 'FAIL: a blocked member reached the member who blocked him (% notifications)', n; end if;

  -- Carol follows Alice directly. The first "started following you" goes
  -- out; the same follow cannot send it again later.
  perform pg_temp.as_member('carol');
  insert into public.user_follows (follower_email, following_email, created_by)
  values (pg_temp.who('carol'), pg_temp.who('alice'), pg_temp.who('carol'));
  insert into public.notifications (user_email, type, content) values (pg_temp.who('alice'), 'new_follower', 'x');
  perform pg_temp.as_postgres();
  update public.notifications set created_date = now() - interval '11 minutes'
   where user_email = pg_temp.who('alice') and created_by = pg_temp.who('carol') and type = 'new_follower';
  perform pg_temp.as_member('carol');
  insert into public.notifications (user_email, type, content) values (pg_temp.who('alice'), 'new_follower', 'x');
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications
   where user_email = pg_temp.who('alice') and created_by = pg_temp.who('carol') and type = 'new_follower';
  if n <> 1 then raise exception 'FAIL: the same follow announced itself % times', n; end if;
  -- A day later the follow is old, so it cannot be announced at all.
  update public.notifications set created_date = now() - interval '2 days'
   where user_email = pg_temp.who('alice') and created_by = pg_temp.who('carol') and type = 'new_follower';
  update public.user_follows set created_date = now() - interval '2 days'
   where follower_email = pg_temp.who('carol') and following_email = pg_temp.who('alice');
  perform pg_temp.as_member('carol');
  perform pg_temp.must_fail('follower notification for an old follow',
    format($q$insert into public.notifications (user_email, type, content) values (%L, 'new_follower', 'x')$q$,
           pg_temp.who('alice')), '%just followed%');

  -- Clean up so later sections start from plain members.
  perform pg_temp.as_postgres();
  delete from public.user_blocks where blocker_email = pg_temp.who('alice');
  delete from public.user_follows where following_email = pg_temp.who('alice');
end
$t$;

-- A display name that reads as the team never reaches an email.
do $t$
declare r record;
begin
  perform pg_temp.as_postgres();
  update public.profiles set full_name = 'Geck Inspect Team' where email = pg_temp.who('carol');
  perform pg_temp.as_member('carol');
  insert into public.direct_messages (sender_email, recipient_email, content, created_by)
  values (pg_temp.who('carol'), pg_temp.who('bob'), 'Hello', pg_temp.who('carol'));
  insert into public.notifications (user_email, type, content) values (pg_temp.who('bob'), 'new_message', 'x');
  perform pg_temp.as_postgres();
  select * into r from public.notifications where user_email = pg_temp.who('bob') and created_by = pg_temp.who('carol');
  if r.content <> 'A Geck Inspect member sent you a message.' then
    raise exception 'FAIL: a team-like display name reached the notification: %', r.content;
  end if;
  update public.profiles set full_name = null where email = pg_temp.who('carol');
end
$t$;

-- =====================================================================
-- 2. Direct messages
-- =====================================================================
do $t$
declare v_id text; r record; n integer;
begin
  perform pg_temp.as_member('bob');
  insert into public.direct_messages (sender_email, recipient_email, content, created_by)
  values (pg_temp.who('bob'), pg_temp.who('alice'), 'Original words', pg_temp.who('bob'))
  returning id into v_id;

  perform pg_temp.as_member('alice');
  perform pg_temp.must_fail('recipient rewrites a message',
    format($q$update public.direct_messages set content = 'Forged words' where id = %L$q$, v_id));
  perform pg_temp.must_fail('recipient changes the sender',
    format($q$update public.direct_messages set sender_email = %L where id = %L$q$, pg_temp.who('carol'), v_id));
  -- Marking it read still works.
  update public.direct_messages set is_read = true, updated_date = now() where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: recipient could not mark the message read'; end if;

  -- The sender cannot edit what they sent either.
  perform pg_temp.as_member('bob');
  update public.direct_messages set content = 'Edited later', is_read = false where id = v_id;
  perform pg_temp.as_postgres();
  select * into r from public.direct_messages where id = v_id;
  if r.content <> 'Original words' or r.sender_email <> pg_temp.who('bob') or r.is_read is not true then
    raise exception 'FAIL: message changed: % % %', r.content, r.sender_email, r.is_read;
  end if;
end
$t$;

-- =====================================================================
-- 3. Morph ID usage log
-- =====================================================================
do $t$
declare n integer;
begin
  perform pg_temp.as_postgres();
  insert into geck_data.model_invocations (surface, model, user_id, tier, ip_hash, est_cost_cents)
  values ('morph_id_production', 'test', pg_temp.who('alice', 'uid')::uuid, 'free', 'hash-a', 1.5),
         ('morph_id_production', 'test', pg_temp.who('bob', 'uid')::uuid, 'breeder', 'hash-b', 2.5);
  perform pg_temp.as_member('alice');
  select count(*) into n from geck_data.model_invocations where model = 'test';
  if n <> 1 then raise exception 'FAIL: a member sees % usage rows, expected only their own', n; end if;
  perform pg_temp.as_member('admin');
  select count(*) into n from geck_data.model_invocations where model = 'test';
  if n <> 2 then raise exception 'FAIL: admin sees % usage rows, expected 2', n; end if;
  perform pg_temp.as_anon();
  perform pg_temp.must_fail('signed-out read of the usage log',
    'select count(*) from geck_data.model_invocations', '%permission denied%');
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 4. Members' email addresses
-- =====================================================================
do $t$
declare r record; v_feed jsonb; v_msg public.direct_messages; v_vec text;
begin
  perform pg_temp.as_member('bob');
  select * into r from public.read_profiles() where id = pg_temp.who('alice', 'profile');
  if r.id is null then raise exception 'FAIL: public profile missing from read_profiles'; end if;
  if r.email is not null then raise exception 'FAIL: read_profiles gave a member another member''s email'; end if;
  -- Still returned when the caller already has the address, and for oneself.
  select * into r from public.read_profiles(array[pg_temp.who('alice')]) where id = pg_temp.who('alice', 'profile');
  if r.email is distinct from pg_temp.who('alice') then raise exception 'FAIL: email lookup by address broke'; end if;
  select * into r from public.read_profiles() where id = pg_temp.who('bob', 'profile');
  if r.email is distinct from pg_temp.who('bob') then raise exception 'FAIL: own email missing'; end if;

  -- The community feed: no email, and no email prefix as a name.
  v_feed := public.community_feed(50)::jsonb;
  if v_feed::text ilike '%comms-%@example.com%' or v_feed::text like '%actor_email%' then
    raise exception 'FAIL: community_feed leaks an email';
  end if;
  if v_feed::text like '%"actor_name": "comms-carol%' or v_feed::text like '%"actor_name":"comms-carol%' then
    raise exception 'FAIL: community_feed uses an email prefix as a name';
  end if;

  -- Visual search: owner email only for the owner.
  perform pg_temp.as_postgres();
  v_vec := '[' || array_to_string(array_fill(0.5::float8, array[768]), ',') || ']';
  execute format($q$insert into public.gecko_images (image_url, created_by, image_embedding) values
    ('https://example.com/a.jpg', %L, %L::extensions.vector),
    ('https://example.com/b.jpg', %L, %L::extensions.vector)$q$, pg_temp.who('alice'), v_vec, pg_temp.who('alice'), v_vec);
  perform pg_temp.as_member('bob');
  if exists (select 1 from public.similar_gecko_images_by_url('https://example.com/a.jpg', 5) s where s.created_by is not null) then
    raise exception 'FAIL: visual search gives another member''s email';
  end if;
  perform pg_temp.as_member('alice');
  if not exists (select 1 from public.similar_gecko_images_by_url('https://example.com/a.jpg', 5) s where s.created_by = pg_temp.who('alice')) then
    raise exception 'FAIL: owner lost their own email in visual search';
  end if;

  -- Messaging and blocking by profile id.
  perform pg_temp.as_member('carol');
  v_msg := public.send_direct_message_to_profile(pg_temp.who('alice', 'profile'), 'Hello from the directory');
  if v_msg.sender_email <> pg_temp.who('carol') or v_msg.recipient_email <> pg_temp.who('alice') then
    raise exception 'FAIL: message by profile id went astray';
  end if;
  perform pg_temp.as_member('alice');
  perform public.block_profile(pg_temp.who('carol', 'profile'));
  perform pg_temp.as_member('carol');
  perform pg_temp.must_fail('message to someone who blocked you',
    format('select public.send_direct_message_to_profile(%L, %L)', pg_temp.who('alice', 'profile'), 'again'),
    '%unavailable%');
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 5. Market Intelligence
-- =====================================================================
do $t$
declare v_id uuid;
begin
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('free member reads the market brief', 'select public.market_brief()', '%Enterprise%');
  perform pg_temp.must_fail('free member reads the live feed', 'select * from public.market_tape()', '%Enterprise%');
  perform pg_temp.must_fail('free member lists watches', 'select * from public.market_watch_list()', '%Enterprise%');
  perform pg_temp.must_fail('free member reads watch matches', 'select * from public.market_watch_matches(5)', '%Enterprise%');
  perform pg_temp.must_fail('free member saves a watch',
    $q$select public.market_watch_save(null, array['Lilly White'], 500)$q$, '%Enterprise%');
  -- Nor by writing the watch table directly (geck_data is reachable
  -- through the API).
  perform pg_temp.must_fail('free member inserts a watch directly',
    format($q$insert into geck_data.alerts (owner_id, name, query, active)
              values (%L, 'x', '{"species":"crested","max_price":500}', true)$q$, pg_temp.who('bob', 'uid')),
    '%permission denied%');

  -- Enterprise members and admins use it.
  perform pg_temp.as_member('ent');
  v_id := public.market_watch_save(null, array['Lilly White'], 500);
  perform * from public.market_watch_list();
  perform * from public.market_watch_matches(5);
  perform * from public.market_tape();
  perform pg_temp.as_member('admin');
  perform * from public.market_watch_list();

  -- A member who left Enterprise can still switch a watch off or remove it.
  perform pg_temp.as_postgres();
  update public.profiles set membership_tier = 'free' where email = pg_temp.who('ent');
  perform pg_temp.as_member('ent');
  perform public.market_watch_set_active(v_id, false);
  perform pg_temp.must_fail('switch a watch back on without Enterprise',
    format('select public.market_watch_set_active(%L, true)', v_id), '%Enterprise%');
  perform pg_temp.must_fail('switch a watch back on directly',
    format('update geck_data.alerts set active = true where id = %L', v_id), '%permission denied%');
  -- Members still read their own watches directly.
  if (select count(*) from geck_data.alerts where id = v_id) <> 1 then
    raise exception 'FAIL: a member can no longer read their own watch';
  end if;
  perform public.market_watch_remove(v_id);
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 6. Account deletion requests
-- =====================================================================
do $t$
declare r record; n integer;
begin
  -- Signed out, naming Alice: an ordinary support message, no alert.
  perform pg_temp.as_anon();
  insert into public.support_messages (user_email, subject, body, created_by, status)
  values (pg_temp.who('alice'), 'Account deletion request', 'Delete me', pg_temp.who('alice'), 'resolved');
  -- Bob, signed in, naming Alice: no alert either.
  perform pg_temp.as_member('bob');
  insert into public.support_messages (user_email, subject, body)
  values (pg_temp.who('alice'), 'Account deletion request', 'Delete me');
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications where type = 'account_deletion_request' and user_email = pg_temp.who('admin');
  if n <> 0 then raise exception 'FAIL: a forged deletion request alerted admins (% alerts)', n; end if;
  select * into r from public.support_messages where body = 'Delete me' and filed_by_email is null;
  if r.id is null or r.created_by is not null or r.status <> 'new' then
    raise exception 'FAIL: signed-out message kept the filer or status it claimed';
  end if;
  select * into r from public.support_messages where body = 'Delete me' and filed_by_email = pg_temp.who('bob');
  if r.id is null then raise exception 'FAIL: signed-in filer not stamped'; end if;

  -- Alice, signed in, about her own account: admins are alerted (this
  -- also proves our own server code can still notify other members).
  perform pg_temp.as_member('alice');
  insert into public.support_messages (user_email, subject, body)
  values (pg_temp.who('alice'), 'Account deletion request', 'Please delete my account');
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications where type = 'account_deletion_request' and user_email = pg_temp.who('admin');
  if n <> 1 then raise exception 'FAIL: a genuine deletion request did not alert the admin (% alerts)', n; end if;
  -- And the filer cannot be rewritten later, even by an admin.
  perform pg_temp.as_member('admin');
  update public.support_messages set filed_by_email = pg_temp.who('bob'), status = 'in_progress'
   where body = 'Please delete my account';
  perform pg_temp.as_postgres();
  if (select filed_by_email from public.support_messages where body = 'Please delete my account') <> pg_temp.who('alice') then
    raise exception 'FAIL: filed_by_email was rewritten';
  end if;
end
$t$;

-- =====================================================================
-- 7 and 8. Column and table privileges
-- =====================================================================
do $t$
declare v_bad text;
begin
  perform pg_temp.as_postgres();
  if has_column_privilege('anon', 'public.geckos', 'sold_price', 'select') then
    raise exception 'FAIL: signed-out visitors can read sold prices';
  end if;
  if not has_column_privilege('anon', 'public.geckos', 'sire_id', 'select')
     or not has_column_privilege('anon', 'public.geckos', 'dam_id', 'select') then
    raise exception 'FAIL: passport lineage columns lost';
  end if;

  select string_agg(n.nspname || '.' || c.relname || ':' || r.rolname || ':' || p.priv, ', ') into v_bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) r(rolname)
    cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
   where n.nspname in ('public', 'geck_data') and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_table_privilege(r.rolname, c.oid, p.priv);
  if v_bad is not null then raise exception 'FAIL: API roles still hold %', left(v_bad, 300); end if;

  -- Objects created from now on.
  create table public._comms_future_table (id int);
  create function public._comms_future_fn() returns int language sql as 'select 1';
  if has_table_privilege('anon', 'public._comms_future_table', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public._comms_future_table', 'TRIGGER') then
    raise exception 'FAIL: new tables still give TRUNCATE or TRIGGER to the API roles';
  end if;
  if not has_table_privilege('authenticated', 'public._comms_future_table', 'SELECT') then
    raise exception 'FAIL: new tables lost their ordinary grants';
  end if;
  if has_function_privilege('anon', 'public._comms_future_fn()', 'execute')
     or has_function_privilege('authenticated', 'public._comms_future_fn()', 'execute') then
    raise exception 'FAIL: new functions are executable by the API roles without a grant';
  end if;
  if not has_function_privilege('service_role', 'public._comms_future_fn()', 'execute') then
    raise exception 'FAIL: new functions lost the service role';
  end if;
  -- Existing functions keep their grants.
  if not has_function_privilege('anon', 'public.read_profiles(text[])', 'execute')
     or not has_function_privilege('authenticated', 'public.community_feed(integer)', 'execute') then
    raise exception 'FAIL: an existing function lost its grant';
  end if;
end
$t$;

-- =====================================================================
-- 1b. Links in notification emails cannot carry markup
-- =====================================================================
-- forum_posts.id and profiles.id are chosen by the client. A post id with
-- a quote in it used to land in the template link and then, unescaped,
-- in the email's href, so a member could put their own markup and links
-- in an email from the official sender.
do $t$
declare v_cat text; v_post text := 'x"><img src=x>&next=https://evil.com'; r record; v_link text; v_bad text;
begin
  -- Links with quotes, brackets, backticks, backslashes or control
  -- characters become "/".
  foreach v_bad in array array['/Forum"onmouseover="x', '/Forum''x', '/Forum<b>', '/Forum>x', '/Forum`x',
                               '/Forum\x', '/Forum' || chr(1) || 'x', '/Forum' || chr(10) || 'x', '/a b'] loop
    if public.safe_internal_link(v_bad) <> '/' then
      raise exception 'FAIL: safe_internal_link kept %', v_bad;
    end if;
  end loop;
  if public.safe_internal_link('/ForumPost?id=abc_1-2&tab=x') <> '/ForumPost?id=abc_1-2&tab=x' then
    raise exception 'FAIL: safe_internal_link changed a plain in-app link';
  end if;

  perform pg_temp.as_postgres();
  insert into public.forum_categories (name, description) values ('Comms link test', 'Regression fixture') returning id into v_cat;
  insert into public.forum_posts (id, title, content, category_id, author_name, created_by)
  values (v_post, 'Pairing', 'Thoughts?', v_cat, 'Bob Breeder', pg_temp.who('bob'));
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Lovely Harlequin', 'Alice Keeper', pg_temp.who('alice'));
  -- Bob replies in his own thread and notifies Alice.
  perform pg_temp.as_member('bob');
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Thanks', 'Bob Breeder', pg_temp.who('bob'));
  insert into public.notifications (user_email, type, content, metadata)
  values (pg_temp.who('alice'), 'new_reply', 'x', jsonb_build_object('post_id', v_post));
  perform pg_temp.as_postgres();
  select * into r from public.notifications
   where user_email = pg_temp.who('alice') and created_by = pg_temp.who('bob') and type = 'new_reply';
  if r.id is null then raise exception 'FAIL: the reply notification was not written'; end if;
  if r.link <> '/Notifications' then
    raise exception 'FAIL: a quote-bearing post id reached the link: %', r.link;
  end if;

  -- A profile id with markup in it never reaches a follower link.
  insert into public.profiles (id, email, full_name, is_public_profile)
  values ('p"><a href=//evil.example>', 'comms-oddid@example.com', 'Odd Id', true);
  v_link := public._member_notification('comms-oddid@example.com', pg_temp.who('alice'), 'new_follower') ->> 'link';
  if v_link <> '/Notifications' then raise exception 'FAIL: a markup profile id reached the link: %', v_link; end if;
  v_link := public._member_notification(pg_temp.who('bob'), pg_temp.who('alice'), 'new_follower') ->> 'link';
  if v_link <> '/PublicProfile?userId=' || pg_temp.who('bob', 'profile') then
    raise exception 'FAIL: a plain profile link changed: %', v_link;
  end if;
  delete from public.profiles where email = 'comms-oddid@example.com';
end
$t$;

-- =====================================================================
-- 1c. Display names: only plain names reach another member
-- =====================================================================
do $t$
declare v_name text; v_got text;
begin
  perform pg_temp.as_postgres();
  -- Each of these went out unchanged before: web addresses in any
  -- spelling, and names that read as the team.
  foreach v_name in array array[
    'Security alert: verify at bit.ly/gi-verify',
    'Verify at gi-help.ru',
    'evil[.]com',
    'evil' || chr(65294) || 'com',                  -- fullwidth full stop
    'G e c k Inspect Support',
    'Geck Insp' || chr(1077) || 'ct Team',          -- Cyrillic e
    'G' || chr(1077) || 'ck Inspect Billing',
    'GeckInspect',
    'Geck-Inspect Crew',
    'Geck 1nspect',
    'G' || chr(232) || 'ck Inspect',                -- e with grave accent
    'Official Breeder',
    'Staff Picks',
    'Admin',
    'Moderators Desk',
    'Support Team',
    'billing',
    'bob@example.com',
    'https://evil.example',
    'Lilly White Geckos of the Pacific Northwest 2',  -- 46 characters
    '   ',
    '-'
  ] loop
    update public.profiles set full_name = v_name, business_name = null, breeder_name = null
     where email = pg_temp.who('carol');
    v_got := public._member_notification(pg_temp.who('carol'), pg_temp.who('bob'), 'new_follower') ->> 'content';
    if v_got <> 'A Geck Inspect member started following you.' then
      raise exception 'FAIL: display name % reached the notification as: %', v_name, v_got;
    end if;
  end loop;

  -- Ordinary names, including Latin-1 letters and apostrophes, still show.
  foreach v_name in array array['Bob Breeder', 'Chlo' || chr(233) || ' O' || chr(8217) || 'Neil-Smith',
                                'Tenny''s Cresties 2', chr(216) || 'lstad Geckos', 'Supportive Keeper'] loop
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

-- =====================================================================
-- 1d. Notes to oneself: server notes and hatch alerts
-- =====================================================================
do $t$
declare v_g1 text; v_g2 text; v_plan text; v_eggs text[] := '{}'; v_id text; i integer; n integer; v_other text;
begin
  perform pg_temp.as_postgres();
  -- A busy day of server notes (briefs, digests, reminders) with
  -- created_by = the member, as the cron jobs write them.
  insert into public.notifications (user_email, type, content, link, created_by)
  select pg_temp.who('alice'), t, 'server note ' || g, '/Dashboard', pg_temp.who('alice')
    from unnest(array['market_brief', 'weekly_digest', 'feeding_due', 'weighin_reminder', 'referral_reward']) t,
         generate_series(1, 8) g;
  -- They do not block the member's own note.
  perform pg_temp.as_member('alice');
  insert into public.notifications (user_email, type, content, link)
  values (pg_temp.who('alice'), 'level_up', 'Gecko Keeper', '/MyGeckos');
  -- A member cannot write the server's kinds for themselves.
  perform pg_temp.must_fail('member writes a market brief to themselves',
    format($q$insert into public.notifications (user_email, type, content) values (%L, 'market_brief', 'x')$q$, pg_temp.who('alice')),
    '%writes this kind%');

  -- A breeder with 40 eggs due: one hatch alert per egg, all accepted.
  perform pg_temp.as_postgres();
  insert into public.geckos (name, created_by, sex) values ('Sire', pg_temp.who('alice'), 'Male') returning id into v_g1;
  insert into public.geckos (name, created_by, sex) values ('Dam', pg_temp.who('alice'), 'Female') returning id into v_g2;
  insert into public.breeding_plans (sire_id, dam_id, created_by) values (v_g1, v_g2, pg_temp.who('alice')) returning id into v_plan;
  for i in 1..40 loop
    insert into public.eggs (breeding_plan_id, lay_date, status, created_by)
    values (v_plan, current_date - 60, 'Incubating', pg_temp.who('alice')) returning id into v_id;
    v_eggs := v_eggs || v_id;
  end loop;
  perform pg_temp.as_member('alice');
  for i in 1..40 loop
    insert into public.notifications (user_email, type, content, link, metadata)
    values (pg_temp.who('alice'), 'hatch_alert', 'An egg is due', '/Breeding', jsonb_build_object('egg_id', v_eggs[i]));
  end loop;
  -- The same egg again is dropped, not sent twice.
  insert into public.notifications (user_email, type, content, link, metadata)
  values (pg_temp.who('alice'), 'hatch_alert', 'An egg is due', '/Breeding', jsonb_build_object('egg_id', v_eggs[1]));
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications where user_email = pg_temp.who('alice') and type = 'hatch_alert';
  if n <> 40 then raise exception 'FAIL: expected 40 hatch alerts, found %', n; end if;
  -- And the hourly limit for other notes is not used up by them.
  perform pg_temp.as_member('alice');
  insert into public.notifications (user_email, type, content, link)
  values (pg_temp.who('alice'), 'level_up', 'Hobbyist', '/MyGeckos');

  -- A hatch alert must name one of the member's own eggs.
  perform pg_temp.as_postgres();
  insert into public.geckos (name, created_by, sex) values ('B sire', pg_temp.who('bob'), 'Male') returning id into v_g1;
  insert into public.geckos (name, created_by, sex) values ('B dam', pg_temp.who('bob'), 'Female') returning id into v_g2;
  insert into public.breeding_plans (sire_id, dam_id, created_by) values (v_g1, v_g2, pg_temp.who('bob')) returning id into v_plan;
  insert into public.eggs (breeding_plan_id, lay_date, status, created_by)
  values (v_plan, current_date - 60, 'Incubating', pg_temp.who('bob')) returning id into v_other;
  perform pg_temp.as_member('alice');
  perform pg_temp.must_fail('hatch alert for someone else''s egg',
    format($q$insert into public.notifications (user_email, type, content, metadata) values (%L, 'hatch_alert', 'x', %L)$q$,
           pg_temp.who('alice'), jsonb_build_object('egg_id', v_other)), '%own eggs%');
  perform pg_temp.must_fail('hatch alert with no egg',
    format($q$insert into public.notifications (user_email, type, content) values (%L, 'hatch_alert', 'x')$q$,
           pg_temp.who('alice')), '%own eggs%');

  perform pg_temp.as_postgres();
  delete from public.notifications where user_email = pg_temp.who('alice');
end
$t$;

-- =====================================================================
-- 1e. Times come from the database, not the browser
-- =====================================================================
do $t$
declare v_cat text; v_post text; r record; n integer;
begin
  perform pg_temp.as_postgres();
  insert into public.forum_categories (name, description) values ('Comms clock test', 'Regression fixture') returning id into v_cat;
  insert into public.forum_posts (title, content, category_id, author_name, created_by)
  values ('Axanthic pairing', 'Thoughts?', v_cat, 'Alice Keeper', pg_temp.who('alice')) returning id into v_post;

  -- Bob's browser clock is three hours slow.
  perform pg_temp.as_member('bob');
  insert into public.direct_messages (sender_email, recipient_email, content, created_by, created_date)
  values (pg_temp.who('bob'), pg_temp.who('carol'), 'Hello', pg_temp.who('bob'), now() - interval '3 hours');
  insert into public.notifications (user_email, type, content, created_date)
  values (pg_temp.who('carol'), 'new_message', 'x', now() - interval '3 hours');
  insert into public.forum_comments (post_id, content, author_name, created_by, created_date)
  values (v_post, 'Nice Axanthic', 'Bob Breeder', pg_temp.who('bob'), now() - interval '3 hours');
  insert into public.notifications (user_email, type, content, metadata)
  values (pg_temp.who('alice'), 'new_comment', 'x', jsonb_build_object('post_id', v_post));
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications
   where created_by = pg_temp.who('bob') and type in ('new_message', 'new_comment')
     and user_email in (pg_temp.who('carol'), pg_temp.who('alice'))
     and created_date > now() - interval '1 minute';
  if n <> 2 then raise exception 'FAIL: a slow browser clock blocked or backdated notifications (% of 2)', n; end if;
  if exists (select 1 from public.direct_messages where sender_email = pg_temp.who('bob') and created_date < now() - interval '1 minute')
     or exists (select 1 from public.forum_comments where created_by = pg_temp.who('bob') and post_id = v_post
                  and created_date < now() - interval '1 minute') then
    raise exception 'FAIL: the browser''s created_date was kept';
  end if;
  -- An edit keeps the original time.
  update public.forum_comments set created_date = now() - interval '1 day' where post_id = v_post;
  perform pg_temp.as_member('bob');
  update public.forum_comments set content = 'Nice Axanthic!', created_date = now() where post_id = v_post;
  perform pg_temp.as_postgres();
  select * into r from public.forum_comments where post_id = v_post;
  if r.content <> 'Nice Axanthic!' or r.created_date > now() - interval '23 hours' then
    raise exception 'FAIL: editing a comment moved its time';
  end if;
  delete from public.notifications where created_by = pg_temp.who('bob');
end
$t$;

-- =====================================================================
-- 2b. System messages come only from admins and the server
-- =====================================================================
do $t$
declare n integer;
begin
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('member sends a system message',
    format($q$insert into public.direct_messages (sender_email, recipient_email, content, message_type, created_by)
              values (%L, %L, 'Your account is locked', 'system', %L)$q$,
           pg_temp.who('bob'), pg_temp.who('alice'), pg_temp.who('bob')), '%system messages%');
  perform pg_temp.must_fail('member sends a System message',
    format($q$insert into public.direct_messages (sender_email, recipient_email, content, message_type, created_by)
              values (%L, %L, 'Your account is locked', 'SYSTEM', %L)$q$,
           pg_temp.who('bob'), pg_temp.who('alice'), pg_temp.who('bob')), '%system messages%');
  insert into public.direct_messages (sender_email, recipient_email, content, message_type, created_by)
  values (pg_temp.who('bob'), pg_temp.who('alice'), 'Hello', 'direct', pg_temp.who('bob'));
  perform pg_temp.as_member('admin');
  insert into public.direct_messages (sender_email, recipient_email, content, message_type, created_by)
  values (pg_temp.who('admin'), pg_temp.who('alice'), 'Shipping week starts Monday', 'system', pg_temp.who('admin'));
  perform pg_temp.as_postgres();
  select count(*) into n from public.direct_messages where message_type = 'system' and recipient_email = pg_temp.who('alice');
  if n <> 1 then raise exception 'FAIL: expected only the admin''s system message, found %', n; end if;
end
$t$;

-- =====================================================================
-- 4b. Follows, and looking members up by address
-- =====================================================================
do $t$
declare n integer; r record;
begin
  -- A follow row only for an existing public member.
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('follow an address that is not a member',
    format($q$insert into public.user_follows (follower_email, following_email, created_by) values (%L, 'stranger@gmail.com', %L)$q$,
           pg_temp.who('bob'), pg_temp.who('bob')), '%row-level security%');
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = false where email = pg_temp.who('carol');
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('follow a private member directly',
    format($q$insert into public.user_follows (follower_email, following_email, created_by) values (%L, %L, %L)$q$,
           pg_temp.who('bob'), pg_temp.who('carol'), pg_temp.who('bob')), '%row-level security%');
  perform pg_temp.must_fail('follow a private member by profile id',
    format('select public.follow_profile(%L, true)', pg_temp.who('carol', 'profile')), '%could not be found%');
  -- A public member can still be followed directly.
  insert into public.user_follows (follower_email, following_email, created_by)
  values (pg_temp.who('bob'), pg_temp.who('alice'), pg_temp.who('bob'));

  -- Unfollowing works after the member went private.
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = true where email = pg_temp.who('carol');
  perform pg_temp.as_member('bob');
  perform public.follow_profile(pg_temp.who('carol', 'profile'), true);
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = false where email = pg_temp.who('carol');
  perform pg_temp.as_member('bob');
  if public.follow_profile(pg_temp.who('carol', 'profile'), false) then raise exception 'FAIL: unfollow returned true'; end if;
  perform pg_temp.as_postgres();
  select count(*) into n from public.user_follows where follower_email = pg_temp.who('bob') and following_email = pg_temp.who('carol');
  if n <> 0 then raise exception 'FAIL: could not unfollow a member who went private'; end if;
  update public.profiles set is_public_profile = true where email = pg_temp.who('carol');
  delete from public.user_follows where follower_email = pg_temp.who('bob');

  -- read_profiles by address needs a signed-in caller.
  perform pg_temp.as_anon();
  select count(*) into n from public.read_profiles(array[pg_temp.who('alice')]);
  if n <> 0 then raise exception 'FAIL: a signed-out visitor can look members up by address'; end if;
  select count(*) into n from public.read_profiles() where id = pg_temp.who('alice', 'profile');
  if n <> 1 then raise exception 'FAIL: signed-out visitors lost public profiles'; end if;
  select * into r from public.read_profiles() where id = pg_temp.who('alice', 'profile');
  if r.email is not null then raise exception 'FAIL: read_profiles gave a signed-out visitor an email'; end if;
  perform pg_temp.as_member('bob');
  select count(*) into n from public.read_profiles(array[pg_temp.who('alice')]);
  if n <> 1 then raise exception 'FAIL: signed-in lookup by address broke'; end if;
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 5b. Market Intelligence on the server: analytics, brief and alerts
-- =====================================================================
do $t$
declare v_ent_alert uuid; v_bob_alert uuid; n integer; v_res jsonb;
begin
  -- Section 5 above moved Ent to Free; Ent has Enterprise again here.
  perform pg_temp.as_postgres();
  update public.profiles set membership_tier = 'enterprise' where email = pg_temp.who('ent');
  -- Business Tools market analytics: Enterprise and admins only.
  perform pg_temp.as_member('bob');
  perform pg_temp.must_fail('free member reads market analytics', 'select public.market_analytics_v2()', '%Enterprise%');
  perform pg_temp.as_anon();
  perform pg_temp.must_fail('signed-out market analytics', 'select public.market_analytics_v2()', '%permission denied%');
  perform pg_temp.as_member('ent');
  perform public.market_analytics_v2();
  perform pg_temp.as_member('admin');
  perform public.market_analytics_v2();
  perform pg_temp.as_service();
  perform public.market_analytics_v2();
  perform pg_temp.as_postgres();
  perform public.market_analytics_v2();

  -- The gate is not callable from the API, and a token cannot switch it off.
  if has_function_privilege('authenticated', 'public.require_market_intelligence()', 'execute')
     or has_function_privilege('anon', 'public.require_market_intelligence()', 'execute') then
    raise exception 'FAIL: the API roles can call require_market_intelligence directly';
  end if;
  perform set_config('request.jwt.claims', '{"email":"x@example.com"}', true);
  perform set_config('role', 'authenticated', true);
  perform pg_temp.must_fail('a token with no role or user skips the gate', 'select public.market_brief()', '%Sign in%');
  perform pg_temp.as_postgres();

  -- Fixtures: a fresh market day and one new listing.
  insert into geck_data.market_daily (day, market, trait, checked, after_gap)
  values ((now() at time zone 'UTC')::date, 'US', '', 100, false)
  on conflict do nothing;
  insert into geck_data.listings (listing_id, name, price, currency, is_active, first_seen_at, last_seen_at, species, trait_array)
  values ('comms-test-listing-1', 'Lilly White female', 300, 'USD', true, now() - interval '1 hour', now(), 'crested', array['Lilly White']);
  insert into geck_data.market_listings (id) values ('mm_comms-test-listing-1');
  refresh materialized view geck_data.listing_market_mv;
  refresh materialized view geck_data.listing_facts_mv;
  insert into geck_data.alert_matcher_state (id, last_run_at) values (1, now() - interval '2 hours')
  on conflict (id) do update set last_run_at = excluded.last_run_at;

  -- Bob (Free) has a watch from before (or wrote one when he had
  -- Enterprise); Ent has one too.
  insert into geck_data.alerts (owner_id, name, query, active)
  values (pg_temp.who('ent', 'uid')::uuid, 'Ent watch', '{"species":"crested","max_price":500}', true) returning id into v_ent_alert;
  insert into geck_data.alerts (owner_id, name, query, active)
  values (pg_temp.who('bob', 'uid')::uuid, 'Bob watch', '{"species":"crested","max_price":500}', true) returning id into v_bob_alert;

  v_res := geck_data.match_alerts();
  if (select count(*) from geck_data.alert_matches where alert_id = v_ent_alert) <> 1 then
    raise exception 'FAIL: an Enterprise watch did not match (%)', v_res;
  end if;
  if exists (select 1 from geck_data.alert_matches where alert_id = v_bob_alert)
     or exists (select 1 from public.notifications where user_email = pg_temp.who('bob') and type = 'market_alert') then
    raise exception 'FAIL: a watch of a member without Enterprise still matched or alerted';
  end if;
  if not exists (select 1 from public.notifications where user_email = pg_temp.who('ent') and type = 'market_alert') then
    raise exception 'FAIL: the Enterprise member got no watch alert';
  end if;

  -- The morning brief. Bob switched it on himself (any member can), and
  -- has a watch match from before, so his brief would have content.
  perform pg_temp.as_member('bob');
  update public.profiles set market_brief_enabled = true where email = pg_temp.who('bob');
  perform pg_temp.as_postgres();
  update public.profiles set market_brief_enabled = true where email = pg_temp.who('ent');
  insert into geck_data.alert_matches (alert_id, listing_id, matched_at, payload)
  values (v_bob_alert, 'mm_comms-test-listing-1', now(), '{"trigger":"new","price":300}');
  perform public.enqueue_market_briefs();
  select count(*) into n from public.notifications where user_email = pg_temp.who('bob') and type = 'market_brief';
  if n <> 0 then raise exception 'FAIL: a Free member got the Enterprise morning brief'; end if;
  select count(*) into n from public.notifications where user_email = pg_temp.who('ent') and type = 'market_brief';
  if n <> 1 then raise exception 'FAIL: the Enterprise member did not get the morning brief (%)', n; end if;

  -- When a subscription ends the webhook sets the plan back to Free, and
  -- the server agrees with the app at once.
  update public.profiles set membership_tier = 'free' where email = pg_temp.who('ent');
  delete from geck_data.alert_matches;
  update geck_data.alert_matcher_state set last_run_at = now() - interval '2 hours' where id = 1;
  perform geck_data.match_alerts();
  if exists (select 1 from geck_data.alert_matches where alert_id = v_ent_alert) then
    raise exception 'FAIL: watches keep matching after the member left Enterprise';
  end if;
  update public.profiles set membership_tier = 'enterprise', market_brief_enabled = false
   where email = pg_temp.who('ent');
  update public.profiles set market_brief_enabled = false where email = pg_temp.who('bob');
  delete from public.notifications where type in ('market_alert', 'market_brief');
end
$t$;

-- =====================================================================
-- 7b. Signed-out visitors cannot read members' emails on these tables
-- =====================================================================
do $t$
declare v_bad text; v_slug text := 'comms-test-breeder'; r record; n integer;
begin
  perform pg_temp.as_postgres();
  select string_agg(t.tbl || '.' || t.col, ', ') into v_bad
    from (values
      ('breeder_profiles', 'created_by'), ('breeder_reviews', 'created_by'),
      ('morph_guide_comments', 'user_email'), ('morph_guide_comments', 'created_by'),
      ('user_badges', 'user_email'), ('user_badges', 'created_by'),
      ('giveaways', 'winner_emails'), ('giveaways', 'created_by'),
      ('community_event_reactions', 'user_email'), ('morph_price_entries', 'created_by')
    ) t(tbl, col)
   where has_column_privilege('anon', 'public.' || t.tbl, t.col, 'select')
      or not has_column_privilege('authenticated', 'public.' || t.tbl, t.col, 'select');
  if v_bad is not null then raise exception 'FAIL: email columns wrongly granted: %', v_bad; end if;
  -- Every other column stays readable (src/lib/publicColumns.js lists them).
  select string_agg(c.relname || '.' || a.attname, ', ') into v_bad
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('breeder_profiles', 'breeder_reviews', 'morph_guide_comments', 'user_badges',
                       'giveaways', 'community_event_reactions', 'morph_price_entries')
     and a.attname not in ('created_by', 'user_email', 'winner_emails')
     and not has_column_privilege('anon', c.oid, a.attnum, 'select');
  if v_bad is not null then raise exception 'FAIL: signed-out visitors lost ordinary columns: %', v_bad; end if;

  -- What signed-out pages read still works.
  insert into public.breeder_profiles (display_name, custom_slug, created_by)
  values ('Alice Keeper Geckos', v_slug, pg_temp.who('alice'));
  insert into public.morph_price_entries (base_morph, sale_price, sale_date, source, created_by)
  values ('Harlequin', 250, current_date, 'user_submitted', pg_temp.who('alice'));
  perform pg_temp.as_anon();
  select * into r from public.breeder_page_owner(v_slug);
  if r.profile_id is distinct from pg_temp.who('alice', 'profile') then
    raise exception 'FAIL: breeder_page_owner did not find the owner''s profile';
  end if;
  select count(*) into n from public.breeder_profiles where custom_slug = v_slug;
  if n <> 1 then raise exception 'FAIL: signed-out breeder page lookup broke'; end if;
  perform id, display_name, bio, user_id from public.breeder_profiles where custom_slug = v_slug;
  perform id, rating, title, body, is_verified, created_date from public.breeder_reviews limit 1;
  perform id, base_morph, sale_price, sale_date, source, is_anonymous from public.morph_price_entries limit 1;
  perform event_type, event_id, reaction from public.community_event_reactions limit 1;
  perform pg_temp.must_fail('signed-out read of breeder emails',
    'select created_by from public.breeder_profiles', '%permission denied%');
  perform pg_temp.must_fail('signed-out read of reaction emails',
    'select user_email from public.community_event_reactions', '%permission denied%');
  perform pg_temp.must_fail('signed-out read of giveaway winners',
    'select winner_emails from public.giveaways', '%permission denied%');
  -- A hidden breeder page, or an owner who went private, is not found.
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = false where email = pg_temp.who('alice');
  perform pg_temp.as_anon();
  if exists (select 1 from public.breeder_page_owner(v_slug)) then
    raise exception 'FAIL: breeder_page_owner answered for a private owner';
  end if;
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = true where email = pg_temp.who('alice');
end
$t$;

-- =====================================================================
-- 9. Account erasure keeps the history of animals sold on
-- =====================================================================
do $t$
declare v_own text; v_sold text; r record; n integer;
begin
  perform pg_temp.as_postgres();
  -- Alice's own gecko, and one she sold to Bob (Bob owns it now).
  insert into public.geckos (name, created_by) values ('Zeus', pg_temp.who('alice')) returning id into v_own;
  insert into public.geckos (name, created_by) values ('Tiger', pg_temp.who('bob')) returning id into v_sold;
  insert into public.weight_records (gecko_id, weight_grams, record_date, notes, created_by) values
    (v_own, 40, current_date, 'own animal', pg_temp.who('alice')),
    (v_sold, 35, current_date - 30, 'weighed at Alice''s house', pg_temp.who('alice')),
    (v_sold, 38, current_date, 'Bob''s own weigh-in', pg_temp.who('bob'));
  insert into public.shed_records (animal_id, logged_by, date, notes, created_by)
  values (v_sold, pg_temp.who('alice', 'uid')::uuid, current_date - 20, 'clean shed', pg_temp.who('alice'));

  perform public.admin_erase_account(pg_temp.who('alice'));

  select count(*) into n from public.weight_records where gecko_id = v_own;
  if n <> 0 then raise exception 'FAIL: records on the member''s own gecko survived'; end if;
  select count(*) into n from public.weight_records where gecko_id = v_sold;
  if n <> 2 then raise exception 'FAIL: the sold gecko lost its history (% weigh-ins left)', n; end if;
  select * into r from public.weight_records where gecko_id = v_sold and weight_grams = 35;
  if r.created_by not like 'deleted-%@deleted.geckinspect.invalid' or r.notes is not null then
    raise exception 'FAIL: the kept weigh-in was not anonymised: % %', r.created_by, r.notes;
  end if;
  select * into r from public.shed_records where animal_id = v_sold;
  if r.id is null or r.logged_by is not null or r.created_by not like 'deleted-%' or r.notes is not null then
    raise exception 'FAIL: the kept shed record was not anonymised';
  end if;
  if exists (select 1 from public.weight_records where created_by = pg_temp.who('bob') and weight_grams = 38) is not true then
    raise exception 'FAIL: the new owner''s own record changed';
  end if;
end
$t$;

-- Erasure leaves no filer address on support tickets: neither on the
-- member's own deletion ticket once the edge function closes it, nor on a
-- deletion request the member filed naming someone else.
do $t$
declare v_own text; v_other text; v_email text := pg_temp.who('carol'); r record;
begin
  perform pg_temp.as_member('carol');
  insert into public.support_messages (user_email, subject, body)
  values (v_email, 'Account deletion request', 'Carol wants out') returning id into v_own;
  insert into public.support_messages (user_email, subject, body)
  values (pg_temp.who('bob'), 'Account deletion request', 'Carol names Bob') returning id into v_other;

  perform pg_temp.as_postgres();
  perform public.admin_erase_account(v_email);
  -- The member's own ticket still verifies after the SQL step, so a retried
  -- erasure from the inbox is not refused.
  if (select filed_by_email from public.support_messages where id = v_own) is distinct from v_email then
    raise exception 'FAIL: the member''s own deletion ticket lost its filer before the edge function closed it';
  end if;
  select * into r from public.support_messages where id = v_other;
  if r.filed_by_email is not null or r.created_by is not null then
    raise exception 'FAIL: a ticket the erased member filed about someone else kept her address';
  end if;

  -- What delete-my-account (and admin-delete-account) do to close the
  -- member's own ticket, as the service role.
  perform pg_temp.as_service();
  update public.support_messages
     set status = 'resolved', resolved_by = 'self-service', resolved_date = now(),
         user_email = 'deleted-' || replace(gen_random_uuid()::text, '-', '') || '@deleted.geckinspect.invalid',
         created_by = null, body = 'Account deletion request. The member deleted the account from Settings.'
   where id = v_own;
  perform pg_temp.as_postgres();
  if exists (select 1 from public.support_messages s
              where lower(coalesce(s.filed_by_email, '')) = v_email
                 or lower(coalesce(s.user_email, '')) = v_email
                 or lower(coalesce(s.created_by, '')) = v_email) then
    raise exception 'FAIL: the erased member''s email is still on a support ticket';
  end if;
end
$t$;

-- Changing the capital letters in an address does not get past the
-- notification limits. send-email and send-push lower-case the address,
-- so every spelling of a@x.com is the same inbox: it must also be the same
-- person for the 10-minute repeat check and the 30-an-hour count. Even a
-- member with a private profile is covered.
do $t$
declare n integer; v_to text; v_variant text; v_ok integer := 0; m integer; i integer; r record;
begin
  perform pg_temp.mk('casevic', 'Case Victim');
  perform pg_temp.mk('casesnd', 'Case Sender');
  update public.profiles set is_public_profile = false where email = pg_temp.who('casevic');
  v_to := pg_temp.who('casevic');
  -- Since 20261016090000 a member can write to a private member only once
  -- that member has written to them, so the victim starts the conversation.
  insert into public.direct_messages (sender_email, recipient_email, content, created_by)
  values (v_to, pg_temp.who('casesnd'), 'Hello', v_to);

  perform pg_temp.as_member('casesnd');
  for m in 0..63 loop
    v_variant := '';
    for i in 1..length(v_to) loop
      v_variant := v_variant || case when i <= 6 and (m >> (i - 1)) & 1 = 1
                                     then upper(substr(v_to, i, 1)) else substr(v_to, i, 1) end;
    end loop;
    if m = 63 then v_variant := '  ' || upper(v_to) || ' '; end if;
    insert into public.direct_messages (sender_email, recipient_email, content, created_by)
    values (pg_temp.who('casesnd'), v_variant, 'x', pg_temp.who('casesnd'));
    begin
      insert into public.notifications (user_email, type, content, created_by)
      values (v_variant, 'new_message', 'x', pg_temp.who('casesnd'));
      v_ok := v_ok + 1;
    exception when others then
      raise exception 'FAIL: a case variant notification raised instead of being dropped: %', sqlerrm;
    end;
  end loop;
  -- A direct call with a capitalised address sees the same person too.
  if (public.member_notification_template(upper(v_to), 'new_message', null) ->> 'skip')::boolean is not true then
    raise exception 'FAIL: member_notification_template treats a capitalised address as a new person';
  end if;

  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications where lower(user_email) = v_to and type = 'new_message';
  if n <> 1 then raise exception 'FAIL: % notifications reached one member through case variants', n; end if;
  select * into r from public.notifications where lower(user_email) = v_to and type = 'new_message';
  if r.user_email <> v_to then raise exception 'FAIL: the stored address was not lower-cased: %', r.user_email; end if;
  -- The messages land in the member's real inbox, where they can see and
  -- block the sender.
  select count(*) into n from public.direct_messages where recipient_email = v_to and sender_email = pg_temp.who('casesnd');
  if n <> 64 then raise exception 'FAIL: case variant messages missed the inbox (% of 64)', n; end if;

  -- Eleven minutes later one more goes out, not one per spelling.
  update public.notifications set created_date = created_date - interval '11 minutes' where created_by = pg_temp.who('casesnd');
  update public.direct_messages set created_date = created_date - interval '11 minutes' where sender_email = pg_temp.who('casesnd');
  perform pg_temp.as_member('casesnd');
  insert into public.direct_messages (sender_email, recipient_email, content, created_by)
  values (pg_temp.who('casesnd'), upper(v_to), 'x', pg_temp.who('casesnd'));
  insert into public.notifications (user_email, type, content, created_by) values (upper(v_to), 'new_message', 'x', pg_temp.who('casesnd'));
  insert into public.notifications (user_email, type, content, created_by) values (initcap(v_to), 'new_message', 'x', pg_temp.who('casesnd'));
  insert into public.notifications (user_email, type, content, created_by) values (v_to, 'new_message', 'x', pg_temp.who('casesnd'));
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications where lower(user_email) = v_to and type = 'new_message';
  if n <> 2 then raise exception 'FAIL: expected 2 notifications after the second round, found %', n; end if;

  -- The 30-different-people count is per person, not per spelling: thirty
  -- spellings of one address leave room for a real second person.
  perform pg_temp.mk('casethird', 'Case Third');
  perform pg_temp.as_member('casesnd');
  insert into public.direct_messages (sender_email, recipient_email, content, created_by)
  values (pg_temp.who('casesnd'), pg_temp.who('casethird'), 'x', pg_temp.who('casesnd'));
  insert into public.notifications (user_email, type, content, created_by)
  values (upper(pg_temp.who('casethird')), 'new_message', 'x', pg_temp.who('casesnd'));
  -- The member's own address, in any case, is still a note to themselves.
  insert into public.notifications (user_email, type, content)
  values (upper(pg_temp.who('casesnd')), 'level_up', 'Level 2');
  perform pg_temp.as_postgres();
  if not exists (select 1 from public.notifications where user_email = pg_temp.who('casethird') and type = 'new_message') then
    raise exception 'FAIL: a real notification to a second member was lost';
  end if;
  if not exists (select 1 from public.notifications where user_email = pg_temp.who('casesnd') and type = 'level_up') then
    raise exception 'FAIL: a capitalised self note was not stored under the member''s own address';
  end if;
end
$t$;

select 'comms_exposure_regressions: all checks passed' as result;
rollback;
