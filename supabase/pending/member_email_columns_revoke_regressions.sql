-- Members' email addresses off the rows other members read, step 2.
-- Regression checks for supabase/pending/member_email_columns_revoke.sql.
--
-- Run it with psql on a scratch copy of the harness template (it needs
-- step 1, supabase/migrations/20261028040000_member_email_reads.sql, which
-- the template already has):
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/pending/member_email_columns_revoke_regressions.sql
--
-- When the copy does not have step 2 yet, the file applies it first, inside
-- its own transaction, so everything rolls back. When step 2 moves to
-- supabase/migrations, move this file to supabase/tests in the same commit;
-- the template then has step 2 and the include below is skipped.
--
-- What it proves:
--   * a signed-in read of gecko_images.created_by (and every other email
--     column in the list) is refused, and so is `select *`;
--   * every other column is still granted to members, and each column list
--     the app reads with (src/lib/memberColumns.js and the named lists in
--     the pages) still works;
--   * members still write their own rows, read them back with the column
--     list, edit and delete them through the row rules, and the database
--     helpers from step 1 still answer;
--   * signed-out visitors and the server are unchanged.
-- Each block raises "FAIL: ..." when a rule is broken.
begin;

select has_table_privilege('authenticated', 'public.gecko_images', 'select') as needs_step2 \gset
\if :needs_step2
\ir member_email_columns_revoke.sql
\endif

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
  v_email text := 'revoke-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
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

-- The email columns step 2 takes away (the same list as the pending file
-- and MEMBER_HIDDEN_COLUMNS in src/lib/memberColumns.js).
create temp table _hidden (tbl text primary key, cols text[] not null) on commit drop;
grant all on _hidden to public;
insert into _hidden values
  ('gecko_images',              array['created_by']),
  ('forum_posts',               array['created_by']),
  ('forum_comments',            array['created_by']),
  ('forum_likes',               array['user_email', 'created_by']),
  ('breeder_profiles',          array['created_by']),
  ('breeder_reviews',           array['created_by']),
  ('morph_guide_comments',      array['user_email', 'created_by']),
  ('user_badges',               array['user_email', 'created_by']),
  ('giveaways',                 array['winner_emails', 'created_by']),
  ('community_event_reactions', array['user_email']),
  ('morph_price_entries',       array['created_by']);

-- The column lists the app reads with as a signed-in member. A test in
-- src/lib/__tests__/memberColumns.test.js checks these match
-- src/lib/memberColumns.js exactly.
create temp table _member_lists (tbl text primary key, cols text not null) on commit drop;
grant all on _member_lists to public;
insert into _member_lists values
  ('gecko_images', 'id, image_url, perceptual_hash, primary_morph, secondary_morph, secondary_traits, base_color, pattern_intensity, white_amount, confidence_score, notes, verified, age_estimate, fired_state, annotations, created_date, updated_date, embedding_model, embedding_date, embedding_status, embedding_attempts, embedding_error, owner_profile_id, approval_status'),
  ('forum_posts', 'id, title, content, category_id, author_name, image_urls, is_pinned, is_locked, view_count, created_date, updated_date, owner_profile_id, approval_status'),
  ('forum_comments', 'id, post_id, content, author_name, image_urls, parent_comment_id, created_date, updated_date, owner_profile_id, approval_status'),
  ('forum_likes', 'id, target_id, target_type, created_date, updated_date'),
  ('breeder_profiles', 'id, user_id, display_name, custom_slug, bio, location, years_breeding, specialty_morphs, social_links, profile_photo, banner_photo, is_verified, accepts_inquiries, ships_to, created_date, updated_date, moderation_hidden, verified_at, verified_by_user_id, verification_checklist'),
  ('breeder_reviews', 'id, reviewer_user_id, reviewed_user_id, animal_id, rating, title, body, transaction_type, is_verified, created_date, updated_date, transfer_id'),
  ('morph_price_entries', 'id, base_morph, morph_traits, pattern_grade, sex, age_category, sale_price, sale_date, source, submitted_by, is_anonymous, verified, notes, created_date, updated_date'),
  ('morph_guide_comments', 'id, morph_guide_id, user_name, subject, content, image_url, status, rejection_reason, is_helpful, created_date, updated_date'),
  ('user_badges', 'id, badge_type, badge_name, badge_description, badge_icon, requirements_met, rarity, created_date, updated_date'),
  ('giveaways', 'id, gecko_id, title, description, entry_method, entry_instructions, entry_url, prize_type, image_urls, end_date, max_winners, status, created_date, updated_date'),
  ('community_event_reactions', 'event_type, event_id, reaction, created_date');

-- Other named reads the app makes on these tables as a member.
create temp table _other_reads (label text primary key, sql text not null) on commit drop;
grant all on _other_reads to public;
insert into _other_reads values
  ('expert review queue (src/lib/reviewQueue.js)',
   $q$select id, image_url, user_id, primary_morph, secondary_morph, secondary_traits, base_color, pattern_intensity, white_amount, fired_state, age_estimate, confidence_score, notes, verified, training_meta, created_date from public.gecko_images where verified = false and user_id is not null limit 1$q$),
  ('Morph Guide photos (MorphIndexData.js, MorphDetail.jsx)',
   $q$select id, image_url, primary_morph, owner_profile_id from public.gecko_images where verified = true and owner_profile_id is not null limit 1$q$),
  ('photo strip fallback (publicGeckoPhotos.js)',
   $q$select image_url, primary_morph, created_date from public.gecko_images where image_url is not null limit 1$q$),
  ('sidebar photo count (Layout.jsx)',
   $q$select count(id) from public.gecko_images where owner_profile_id = 'x'$q$),
  ('admin latest posts (AdminOverview.jsx)',
   $q$select id, title, author_name, owner_profile_id, created_date from public.forum_posts order by created_date desc limit 5$q$),
  ('admin analytics (AnalyticsDashboard.jsx)',
   $q$select id, owner_profile_id, created_date from public.forum_comments order by created_date, id limit 1$q$),
  ('breeder page reviews (BreederReviews.jsx)',
   $q$select id, rating, title, body, is_verified, created_date, updated_date from public.breeder_reviews where is_verified = true limit 1$q$),
  ('my breeder profile (MyStore.jsx)',
   $q$select id from public.breeder_profiles where user_id = auth.uid()$q$),
  ('forum reply counts',
   $q$select * from public.forum_reply_counts(null)$q$);

-- =====================================================================
-- 1. The grant list
-- =====================================================================
do $t$
declare r record; v_col text; v_bad text := '';
begin
  perform pg_temp.as_postgres();
  for r in select * from _hidden loop
    if has_table_privilege('authenticated', 'public.' || r.tbl, 'select') then
      raise exception 'FAIL: members still have a table-wide read of %', r.tbl;
    end if;
    for v_col in
      select a.attname from pg_attribute a
       where a.attrelid = ('public.' || r.tbl)::regclass and a.attnum > 0 and not a.attisdropped
    loop
      if v_col = any (r.cols) then
        if has_column_privilege('authenticated', 'public.' || r.tbl, v_col, 'select') then
          v_bad := v_bad || format(' %s.%s still readable;', r.tbl, v_col);
        end if;
        -- The server keeps it.
        if not has_column_privilege('service_role', 'public.' || r.tbl, v_col, 'select') then
          v_bad := v_bad || format(' %s.%s lost by the server;', r.tbl, v_col);
        end if;
      elsif not has_column_privilege('authenticated', 'public.' || r.tbl, v_col, 'select') then
        v_bad := v_bad || format(' %s.%s no longer granted;', r.tbl, v_col);
      end if;
    end loop;
    -- Writes are untouched.
    if not has_table_privilege('authenticated', 'public.' || r.tbl, 'insert') then
      v_bad := v_bad || format(' %s lost insert;', r.tbl);
    end if;
  end loop;
  if v_bad <> '' then raise exception 'FAIL:%', v_bad; end if;

  -- Signed-out visitors are as before: no email column, the public ones still there.
  if has_column_privilege('anon', 'public.gecko_images', 'created_by', 'select')
     or not has_column_privilege('anon', 'public.gecko_images', 'image_url', 'select')
     or has_column_privilege('anon', 'public.forum_posts', 'created_by', 'select')
     or not has_column_privilege('anon', 'public.forum_posts', 'title', 'select') then
    raise exception 'FAIL: the signed-out grants changed';
  end if;
  -- Not in this step: geckos.created_by (identity migration, E4 32).
  if not has_column_privilege('authenticated', 'public.geckos', 'created_by', 'select') then
    raise exception 'FAIL: geckos.created_by was taken from members, which every owner check needs';
  end if;
end
$t$;

-- =====================================================================
-- 2. A signed-in read of another member's email is refused
-- =====================================================================
do $t$
declare r record; v_col text;
begin
  perform pg_temp.as_member('alice');
  -- The done-when of Part E item E1 4.
  perform pg_temp.must_fail('member read of gecko_images.created_by',
    'select created_by from public.gecko_images limit 1', '%permission denied%');
  for r in select * from _hidden loop
    foreach v_col in array r.cols loop
      perform pg_temp.must_fail(format('member read of %s.%s', r.tbl, v_col),
        format('select %I from public.%I limit 1', v_col, r.tbl), '%permission denied%');
      perform pg_temp.must_fail(format('member filter on %s.%s', r.tbl, v_col),
        format('select count(*) from public.%I where %I is not null', r.tbl, v_col), '%permission denied%');
    end loop;
    perform pg_temp.must_fail(format('member select * from %s', r.tbl),
      format('select * from public.%I limit 1', r.tbl), '%permission denied%');
  end loop;
  -- Admins are signed-in accounts too.
  perform pg_temp.as_member('admin');
  perform pg_temp.must_fail('admin read of forum_posts.created_by',
    'select created_by from public.forum_posts limit 1', '%permission denied%');
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 3. The app's own reads still work
-- =====================================================================
do $t$
declare r record;
begin
  perform pg_temp.as_member('alice');
  for r in select * from _member_lists loop
    begin
      execute format('select %s from public.%I limit 1', r.cols, r.tbl);
    exception when others then
      raise exception 'FAIL: the member list for % fails: %', r.tbl, sqlerrm;
    end;
  end loop;
  for r in select * from _other_reads loop
    begin
      execute r.sql;
    exception when others then
      raise exception 'FAIL: % fails: %', r.label, sqlerrm;
    end;
  end loop;
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 4. Members still write, read back and change their own rows
-- =====================================================================
do $t$
declare
  v_cat text; v_post text; v_comment text; v_bob_post text; v_photo text; v_bp uuid;
  v_list text; n integer; v_sent boolean; r record;
begin
  perform pg_temp.as_postgres();
  insert into public.forum_categories (name, description) values ('Revoke test', 'Regression fixture') returning id into v_cat;
  insert into public.forum_posts (title, content, category_id, author_name, created_by)
  values ('Phantom question', 'Is this a Phantom?', v_cat, 'Bob Breeder', pg_temp.who('bob')) returning id into v_bob_post;

  -- Insert with created_by, read back with the member list (what
  -- supabaseEntities.create does). RETURNING * is refused.
  perform pg_temp.as_member('alice');
  select cols into v_list from _member_lists where tbl = 'forum_posts';
  execute format($q$with ins as (insert into public.forum_posts (title, content, category_id, author_name, created_by)
                    values ('Sable pairing', 'Thoughts?', %L, 'Alice Keeper', %L) returning %s) select id from ins$q$,
                 v_cat, pg_temp.who('alice'), v_list) into v_post;
  if v_post is null then raise exception 'FAIL: the member insert returned nothing'; end if;
  perform pg_temp.must_fail('insert returning *',
    format($q$insert into public.forum_posts (title, content, category_id, author_name, created_by)
              values ('x', 'y', %L, 'Alice Keeper', %L) returning *$q$, v_cat, pg_temp.who('alice')),
    '%permission denied%');

  -- The owner's profile id is filled in, so "mine" is found without the email.
  select count(*) into n from public.forum_posts where id = v_post and owner_profile_id = pg_temp.who('alice', 'profile');
  if n <> 1 then raise exception 'FAIL: owner_profile_id was not set on the member''s post'; end if;

  -- Edit and delete through the row rules (they compare created_by with
  -- the member's email, which the member cannot read but the rule can).
  execute format($q$update public.forum_posts set content = 'Edited' where id = %L returning %s$q$, v_post, v_list);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the owner could not edit their post'; end if;
  update public.forum_posts set content = 'Hijacked' where id = v_bob_post;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a member edited someone else''s post'; end if;

  -- Comment, notify the post's author (the database finds Bob), delete.
  select cols into v_list from _member_lists where tbl = 'forum_comments';
  execute format($q$with ins as (insert into public.forum_comments (post_id, content, author_name, created_by)
                    values (%L, 'Looks like a Phantom to me', 'Alice Keeper', %L) returning %s) select id from ins$q$,
                 v_bob_post, pg_temp.who('alice'), v_list) into v_comment;
  v_sent := public.notify_forum_thread_author(v_comment);
  if v_sent is not true then raise exception 'FAIL: the comment notification failed after step 2'; end if;
  delete from public.forum_comments where id = v_comment;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the owner could not delete their comment'; end if;

  -- A photo, found again by owner_profile_id.
  select cols into v_list from _member_lists where tbl = 'gecko_images';
  execute format($q$with ins as (insert into public.gecko_images (image_url, primary_morph, verified, created_by)
                    values ('https://example.com/alice-lilly.jpg', 'lilly_white', false, %L) returning %s) select id from ins$q$,
                 pg_temp.who('alice'), v_list) into v_photo;
  select count(*) into n from public.gecko_images where owner_profile_id = pg_temp.who('alice', 'profile') and id = v_photo;
  if n <> 1 then raise exception 'FAIL: the member''s own photo is not found by owner_profile_id'; end if;
  execute format($q$delete from public.gecko_images where id = %L returning %s$q$, v_photo, v_list);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the owner could not delete their photo'; end if;

  -- A breeder profile, found by user_id (MyStore), edited by its owner.
  select cols into v_list from _member_lists where tbl = 'breeder_profiles';
  execute format($q$with ins as (insert into public.breeder_profiles (display_name, custom_slug, user_id, created_by)
                    values ('Alice Cresties', 'revoke-test-alice', %L, %L) returning %s) select id from ins$q$,
                 pg_temp.who('alice', 'uid'), pg_temp.who('alice'), v_list) into v_bp;
  select count(*) into n from public.breeder_profiles where user_id = auth.uid();
  if n <> 1 then raise exception 'FAIL: the member''s breeder profile is not found by user_id'; end if;
  execute format($q$update public.breeder_profiles set bio = 'Harlequin and Pinstripe lines' where id = %L returning %s$q$, v_bp, v_list);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the owner could not edit their breeder profile'; end if;

  -- Likes and reactions: added, counted, removed without naming an email.
  insert into public.forum_likes (target_id, target_type, user_email, created_by)
  values (v_bob_post, 'post', pg_temp.who('alice'), pg_temp.who('alice'));
  select * into r from public.forum_like_state(array[v_bob_post]);
  if r.like_count <> 1 or r.liked is not true then raise exception 'FAIL: forum_like_state after step 2 gave %', row_to_json(r); end if;
  delete from public.forum_likes where target_id = v_bob_post;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: unlike removed % rows', n; end if;

  insert into public.community_event_reactions (event_type, event_id, user_email, reaction)
  values ('forum_post', v_bob_post, pg_temp.who('alice'), 'fire');
  select * into r from public.community_reaction_state(array['forum_post'], array[v_bob_post]);
  if r.reaction_count <> 1 or r.mine is not true then raise exception 'FAIL: community_reaction_state after step 2 gave %', row_to_json(r); end if;
  delete from public.community_event_reactions where event_type = 'forum_post' and event_id = v_bob_post and reaction = 'fire';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: removing a reaction removed % rows', n; end if;

  -- Badges by id (MyProfile).
  perform pg_temp.as_postgres();
  insert into public.user_badges (user_email, badge_type, badge_name, badge_description, badge_icon, created_by)
  values (pg_temp.who('alice'), 'collector', 'Collector', 'Ten geckos', 'star', pg_temp.who('admin'));
  perform pg_temp.as_member('alice');
  select cols into v_list from _member_lists where tbl = 'user_badges';
  execute format('select count(*) from (select %s from public.user_badges where id = any (public.my_row_ids(%L))) b', v_list, 'user_badges') into n;
  if n <> 1 then raise exception 'FAIL: the member''s badges are not found by id after step 2'; end if;

  -- The ID needs panel (runs with the member's rights).
  perform count(*) from public.next_unvoted_id_candidates(pg_temp.who('alice'), 5);
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 5. Giveaway entries: the read rule no longer reads giveaways.created_by
-- =====================================================================
do $t$
declare v_g text; n integer;
begin
  perform pg_temp.as_postgres();
  insert into public.giveaways (title, status, created_by) values ('Axanthic hatchling', 'active', pg_temp.who('bob')) returning id into v_g;
  insert into public.giveaway_entries (giveaway_id, user_email, user_name) values (v_g, pg_temp.who('alice'), 'Alice');
  perform pg_temp.as_member('bob');
  select count(*) into n from public.giveaway_entries where giveaway_id = v_g;
  if n <> 1 then raise exception 'FAIL: the giveaway host sees % entries after step 2', n; end if;
  perform pg_temp.as_member('alice');
  select count(*) into n from public.giveaway_entries;
  if n <> 1 then raise exception 'FAIL: an entrant sees % entries after step 2', n; end if;
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 6. Signed-out visitors and the server are unchanged
-- =====================================================================
do $t$
declare n integer;
begin
  perform pg_temp.as_anon();
  perform count(*) from (select id, title, owner_profile_id from public.forum_posts) p;
  perform count(*) from (select id, image_url, owner_profile_id from public.gecko_images) g;
  perform pg_temp.must_fail('anon read of gecko_images.created_by',
    'select created_by from public.gecko_images limit 1', '%permission denied%');
  perform pg_temp.as_service();
  select count(created_by) into n from public.forum_posts;
  if n < 1 then raise exception 'FAIL: the server can no longer read created_by'; end if;
  perform pg_temp.as_postgres();
end
$t$;

rollback;
