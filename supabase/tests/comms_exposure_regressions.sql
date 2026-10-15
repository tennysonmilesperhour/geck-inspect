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
  if r.metadata ? 'sender_email' then raise exception 'FAIL: member metadata kept'; end if;

  -- Links: a member's note to themselves keeps an in-app link, and any
  -- other link becomes "/".
  perform pg_temp.as_member('bob');
  insert into public.notifications (user_email, type, content, link) values
    (pg_temp.who('bob'), 'level_up', 'one', '//evil.example'),
    (pg_temp.who('bob'), 'level_up', 'two', '/\evil.example'),
    (pg_temp.who('bob'), 'level_up', 'three', 'https://evil.example'),
    (pg_temp.who('bob'), 'hatch_alert', 'four', '/Breeding');
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

select 'comms_exposure_regressions: all checks passed' as result;
rollback;
