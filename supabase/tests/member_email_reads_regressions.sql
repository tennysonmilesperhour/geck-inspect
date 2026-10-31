-- Members' email addresses off the rows other members read, step 1.
-- Regression checks for supabase/migrations/20261028040000_member_email_reads.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/member_email_reads_regressions.sql
--
-- Each block raises "FAIL: ..." when a rule is broken, and also checks the
-- legitimate use next to it. Step 2 (the column revoke) has its own file,
-- supabase/tests/member_email_columns_revoke_regressions.sql.
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null,
  profile_id text
) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text, p_name text, p_role text default 'user')
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'reads-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
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
     set full_name = p_name, role = p_role, is_public_profile = true, moderation_hidden = false
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
select pg_temp.mk('carol', 'Carol Crested');

-- Fixtures, written as the server would.
create temp table _ids (k text primary key, v text) on commit drop;
grant all on _ids to public;
do $t$
declare v_cat text; v_id text;
begin
  perform pg_temp.as_postgres();
  insert into public.forum_categories (name, description) values ('Reads test', 'Regression fixture') returning id into v_cat;
  insert into public.forum_posts (title, content, category_id, author_name, created_by)
  values ('Lilly White pairing', 'Thoughts on this pairing?', v_cat, 'Bob Breeder', pg_temp.who('bob')) returning id into v_id;
  insert into _ids values ('post', v_id);
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_id, 'Lovely Harlequin', 'Carol Crested', pg_temp.who('carol')) returning id into v_id;
  insert into _ids values ('carol_comment', v_id);
  insert into public.user_badges (user_email, badge_type, badge_name, badge_description, badge_icon, created_by)
  values (pg_temp.who('alice'), 'collector', 'Collector', 'Ten geckos', 'star', pg_temp.who('bob')) returning id into v_id;
  insert into _ids values ('alice_badge', v_id);
  insert into public.user_badges (user_email, badge_type, badge_name, badge_description, badge_icon, created_by)
  values (pg_temp.who('bob'), 'collector', 'Collector', 'Ten geckos', 'star', pg_temp.who('bob'));
end
$t$;

-- =====================================================================
-- 1. my_row_ids: only the caller's own rows
-- =====================================================================
do $t$
declare v_ids text[];
begin
  perform pg_temp.as_member('alice');
  v_ids := public.my_row_ids('user_badges');
  if v_ids is distinct from array[(select v from _ids where k = 'alice_badge')] then
    raise exception 'FAIL: my_row_ids(user_badges) returned % for Alice', v_ids;
  end if;
  perform pg_temp.as_member('bob');
  if cardinality(public.my_row_ids('forum_posts')) <> 1 or not ((select v from _ids where k = 'post') = any (public.my_row_ids('forum_posts'))) then
    raise exception 'FAIL: my_row_ids(forum_posts) missed Bob''s post';
  end if;
  if cardinality(public.my_row_ids('forum_comments')) <> 0 then
    raise exception 'FAIL: my_row_ids(forum_comments) gave Bob someone else''s comment';
  end if;
  -- Only the fixed list of tables, never a table or column the caller names.
  perform pg_temp.must_fail('my_row_ids on an unlisted table', $q$select public.my_row_ids('profiles')$q$, '%does not cover%');
  perform pg_temp.must_fail('my_row_ids with injected SQL', $q$select public.my_row_ids('user_badges t; drop table public.profiles; --')$q$, '%does not cover%');
  -- Signed-out visitors cannot call it at all.
  perform pg_temp.as_anon();
  perform pg_temp.must_fail('anon my_row_ids', $q$select public.my_row_ids('user_badges')$q$, '%permission denied%');
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 2. Forum likes: counts and "liked by me", never who liked
-- =====================================================================
do $t$
declare r record; v_post text := (select v from _ids where k = 'post');
begin
  perform pg_temp.as_member('alice');
  insert into public.forum_likes (target_id, target_type, user_email, created_by)
  values (v_post, 'post', pg_temp.who('alice'), pg_temp.who('alice'));
  perform pg_temp.as_member('carol');
  insert into public.forum_likes (target_id, target_type, user_email, created_by)
  values (v_post, 'post', pg_temp.who('carol'), pg_temp.who('carol'));

  perform pg_temp.as_member('alice');
  select * into r from public.forum_like_state(array[v_post, 'no-such-target']);
  if r.target_id <> v_post or r.like_count <> 2 or r.liked is not true then
    raise exception 'FAIL: forum_like_state for Alice gave %', row_to_json(r);
  end if;
  perform pg_temp.as_member('bob');
  select * into r from public.forum_like_state(array[v_post]);
  if r.like_count <> 2 or r.liked is not false then
    raise exception 'FAIL: forum_like_state for Bob gave %', row_to_json(r);
  end if;
  -- Signed out: the count, never "liked".
  perform pg_temp.as_anon();
  select * into r from public.forum_like_state(array[v_post]);
  if r.like_count <> 2 or r.liked is not false then
    raise exception 'FAIL: forum_like_state signed out gave %', row_to_json(r);
  end if;

  -- Unliking deletes by target only: the row rule keeps it to the caller's own like.
  perform pg_temp.as_member('alice');
  delete from public.forum_likes where target_id = v_post;
  perform pg_temp.as_postgres();
  if (select count(*) from public.forum_likes where target_id = v_post) <> 1
     or not exists (select 1 from public.forum_likes where target_id = v_post and created_by = pg_temp.who('carol')) then
    raise exception 'FAIL: Alice''s unlike removed someone else''s like';
  end if;
end
$t$;

-- =====================================================================
-- 3. Live Feed reactions: counts and "mine", never who
-- =====================================================================
do $t$
declare r record; n integer;
begin
  perform pg_temp.as_member('alice');
  insert into public.community_event_reactions (event_type, event_id, user_email, reaction)
  values ('upload', 'img-1', pg_temp.who('alice'), 'heart');
  perform pg_temp.as_member('bob');
  insert into public.community_event_reactions (event_type, event_id, user_email, reaction)
  values ('upload', 'img-1', pg_temp.who('bob'), 'heart'),
         ('upload', 'img-1', pg_temp.who('bob'), 'fire');

  perform pg_temp.as_member('alice');
  select * into r from public.community_reaction_state(array['upload'], array['img-1']) s where s.reaction = 'heart';
  if r.reaction_count <> 2 or r.mine is not true then
    raise exception 'FAIL: heart for Alice gave %', row_to_json(r);
  end if;
  select * into r from public.community_reaction_state(array['upload'], array['img-1']) s where s.reaction = 'fire';
  if r.reaction_count <> 1 or r.mine is not false then
    raise exception 'FAIL: fire for Alice gave %', row_to_json(r);
  end if;
  perform pg_temp.as_anon();
  select count(*) into n from public.community_reaction_state(array['upload'], array['img-1']) s where s.mine;
  if n <> 0 then raise exception 'FAIL: a signed-out visitor was told a reaction was theirs'; end if;

  -- Removing a reaction without naming the email removes only the caller's own.
  perform pg_temp.as_member('alice');
  delete from public.community_event_reactions where event_type = 'upload' and event_id = 'img-1' and reaction = 'heart';
  perform pg_temp.as_postgres();
  select count(*) into n from public.community_event_reactions where event_id = 'img-1' and reaction = 'heart';
  if n <> 1 then raise exception 'FAIL: Alice''s un-react removed % hearts', 2 - n; end if;
end
$t$;

-- =====================================================================
-- 4. Comment and reply notifications found by the database
-- =====================================================================
do $t$
declare
  v_post text := (select v from _ids where k = 'post');
  v_carol_comment text := (select v from _ids where k = 'carol_comment');
  v_comment text; v_reply text; v_sent boolean; r record; n integer;
begin
  -- Alice comments on Bob's post: Bob hears, with the template's words.
  perform pg_temp.as_member('alice');
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Great pairing', 'Alice Keeper', pg_temp.who('alice')) returning id into v_comment;
  v_sent := public.notify_forum_thread_author(v_comment);
  if v_sent is not true then raise exception 'FAIL: the comment notification was not written'; end if;
  perform pg_temp.as_postgres();
  select * into r from public.notifications where user_email = pg_temp.who('bob') and type = 'new_comment';
  if r.id is null or r.created_by <> pg_temp.who('alice') or r.content <> 'Alice Keeper commented on your forum post.'
     or r.link <> '/ForumPost?id=' || v_post or r.metadata ->> 'post_id' <> v_post then
    raise exception 'FAIL: the comment notification is wrong: %', row_to_json(r);
  end if;

  -- The same again within 10 minutes is skipped, not repeated.
  perform pg_temp.as_member('alice');
  if public.notify_forum_thread_author(v_comment) is not false then
    raise exception 'FAIL: a repeat notification was not skipped';
  end if;

  -- Alice replies to Carol's comment: Carol hears, not Bob.
  insert into public.forum_comments (post_id, content, author_name, created_by, parent_comment_id)
  values (v_post, 'Agreed', 'Alice Keeper', pg_temp.who('alice'), v_carol_comment) returning id into v_reply;
  if public.notify_forum_thread_author(v_reply) is not true then
    raise exception 'FAIL: the reply notification was not written';
  end if;
  perform pg_temp.as_postgres();
  select count(*) into n from public.notifications where user_email = pg_temp.who('carol') and type = 'new_reply' and created_by = pg_temp.who('alice');
  if n <> 1 then raise exception 'FAIL: Carol got % reply notifications', n; end if;
  select count(*) into n from public.notifications where user_email = pg_temp.who('bob') and type = 'new_reply';
  if n <> 0 then raise exception 'FAIL: the reply went to the post author instead of the comment author'; end if;

  -- Bob commenting on his own post tells nobody.
  perform pg_temp.as_member('bob');
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Thanks all', 'Bob Breeder', pg_temp.who('bob')) returning id into v_comment;
  if public.notify_forum_thread_author(v_comment) is not false then
    raise exception 'FAIL: a member was notified about their own post';
  end if;

  -- Nobody can notify on someone else's comment, or on one that does not exist.
  perform pg_temp.as_member('carol');
  perform pg_temp.must_fail('notify on someone else''s comment',
    format('select public.notify_forum_thread_author(%L)', v_comment), '%no comment of yours%');
  perform pg_temp.must_fail('notify on a missing comment',
    $q$select public.notify_forum_thread_author('no-such-comment')$q$, '%no comment of yours%');

  -- A comment waiting for review tells nobody yet.
  perform pg_temp.as_postgres();
  update public.forum_comments set approval_status = 'pending', moderation_hidden = true where id = v_reply;
  delete from public.notifications where user_email = pg_temp.who('carol');
  perform pg_temp.as_member('alice');
  if public.notify_forum_thread_author(v_reply) is not false then
    raise exception 'FAIL: a comment waiting for approval sent a notification';
  end if;

  -- Blocking still stops it, both ways.
  perform pg_temp.as_postgres();
  insert into public.user_blocks (blocker_email, blocked_email) values (pg_temp.who('carol'), pg_temp.who('bob'));
  perform pg_temp.as_member('carol');
  insert into public.forum_comments (post_id, content, author_name, created_by)
  values (v_post, 'Hmm', 'Carol Crested', pg_temp.who('carol')) returning id into v_comment;
  perform pg_temp.must_fail('notify a blocked member',
    format('select public.notify_forum_thread_author(%L)', v_comment), '%cannot notify%');

  -- Signed-out visitors cannot call it.
  perform pg_temp.as_anon();
  perform pg_temp.must_fail('anon notify', format('select public.notify_forum_thread_author(%L)', v_comment), '%permission denied%');
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 5. Giveaway entries: the host check keeps its meaning
-- =====================================================================
do $t$
declare v_g text; n integer;
begin
  perform pg_temp.as_postgres();
  insert into public.giveaways (title, status, created_by) values ('Lilly White hatchling', 'active', pg_temp.who('bob')) returning id into v_g;
  insert into public.giveaway_entries (giveaway_id, user_email, user_name) values
    (v_g, pg_temp.who('alice'), 'Alice'), (v_g, pg_temp.who('carol'), 'Carol');

  perform pg_temp.as_member('bob');
  select count(*) into n from public.giveaway_entries where giveaway_id = v_g;
  if n <> 2 then raise exception 'FAIL: the host sees % entries', n; end if;
  perform pg_temp.as_member('alice');
  select count(*) into n from public.giveaway_entries where giveaway_id = v_g;
  if n <> 1 then raise exception 'FAIL: an entrant sees % entries', n; end if;
  perform pg_temp.as_anon();
  select count(*) into n from public.giveaway_entries where giveaway_id = v_g;
  if n <> 0 then raise exception 'FAIL: a signed-out visitor sees % entries', n; end if;
  -- The read rule no longer asks giveaways.created_by as the member.
  perform pg_temp.as_postgres();
  if exists (select 1 from pg_policies where tablename = 'giveaway_entries' and policyname = 'giveaway_entries_read'
              and qual ilike '%created_by%') then
    raise exception 'FAIL: giveaway_entries_read still reads giveaways.created_by';
  end if;
end
$t$;

-- =====================================================================
-- 6. ID needs panel: member uploads by owner_profile_id
-- =====================================================================
do $t$
declare n integer;
begin
  perform pg_temp.as_postgres();
  insert into public.gecko_images (id, image_url, primary_morph, created_by)
  values ('reads-member-photo', 'https://example.com/member.jpg', 'harlequin', pg_temp.who('alice'));
  insert into public.gecko_images (id, image_url, primary_morph, created_by)
  values ('reads-scraped-photo', 'https://example.com/scraped.jpg', 'harlequin', null);
  -- Both reviewed and public (a new member's photo starts out held).
  update public.gecko_images set approval_status = 'approved', moderation_hidden = false
   where id in ('reads-member-photo', 'reads-scraped-photo');
  perform pg_temp.as_member('bob');
  select count(*) into n from public.next_unvoted_id_candidates(pg_temp.who('bob'), 50) c where c.id = 'reads-member-photo';
  if n <> 1 then raise exception 'FAIL: a member upload is missing from the ID needs panel'; end if;
  select count(*) into n from public.next_unvoted_id_candidates(pg_temp.who('bob'), 50) c where c.id = 'reads-scraped-photo';
  if n <> 0 then raise exception 'FAIL: a scraped photo reached the ID needs panel'; end if;
  perform pg_temp.as_postgres();
  if pg_get_functiondef('public.next_unvoted_id_candidates(text,integer)'::regprocedure) ilike '%created_by%' then
    raise exception 'FAIL: next_unvoted_id_candidates still reads created_by';
  end if;
end
$t$;

-- =====================================================================
-- 7. Who may call the new functions
-- =====================================================================
do $t$
begin
  perform pg_temp.as_postgres();
  if has_function_privilege('anon', 'public.my_row_ids(text)', 'execute')
     or has_function_privilege('anon', 'public.notify_forum_thread_author(text)', 'execute') then
    raise exception 'FAIL: signed-out visitors can call a member-only function';
  end if;
  if not has_function_privilege('authenticated', 'public.my_row_ids(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.notify_forum_thread_author(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.forum_like_state(text[])', 'execute')
     or not has_function_privilege('authenticated', 'public.community_reaction_state(text[],text[])', 'execute')
     or not has_function_privilege('anon', 'public.forum_like_state(text[])', 'execute')
     or not has_function_privilege('anon', 'public.community_reaction_state(text[],text[])', 'execute')
     or not has_function_privilege('anon', 'public.is_giveaway_host(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.is_giveaway_host(text)', 'execute') then
    raise exception 'FAIL: a role lost a function the app calls';
  end if;
  if has_function_privilege('public', 'public.my_row_ids(text)', 'execute') then
    raise exception 'FAIL: PUBLIC can call my_row_ids';
  end if;
end
$t$;

-- =====================================================================
-- my_blocked_profile_ids: blocking a member whose profile is not public
-- still hides what they wrote (the rows carry owner_profile_id only).
-- =====================================================================
do $t$
declare v_ids text[];
begin
  perform pg_temp.as_postgres();
  update public.profiles set is_public_profile = null where email = pg_temp.who('carol');
  insert into public.user_blocks (blocker_email, blocked_email) values (pg_temp.who('alice'), pg_temp.who('carol'));
  perform pg_temp.as_member('alice');
  select array_agg(id) into v_ids from public.my_blocked_profile_ids();
  if v_ids is distinct from array[pg_temp.who('carol', 'profile')] then
    raise exception 'FAIL: my_blocked_profile_ids did not return the blocked member with a non-public profile: %', v_ids;
  end if;
  -- read_profiles, the old way, cannot see that profile: the reason for the helper.
  if exists (select 1 from public.read_profiles(array[pg_temp.who('carol')])) then
    raise exception 'FAIL: expected read_profiles to hide a non-public profile';
  end if;
  -- Another member's blocks are never returned.
  perform pg_temp.as_member('bob');
  if exists (select 1 from public.my_blocked_profile_ids()) then
    raise exception 'FAIL: my_blocked_profile_ids returned another member''s blocks';
  end if;
  perform pg_temp.as_anon();
  perform pg_temp.must_fail('anon calling my_blocked_profile_ids', 'select * from public.my_blocked_profile_ids()', '%permission denied%');
  perform pg_temp.as_postgres();
end
$t$;

rollback;
