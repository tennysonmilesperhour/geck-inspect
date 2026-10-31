-- Members' email addresses off the rows other members read, step 2 of 2.
--
-- NOT A MIGRATION YET. Move this file to supabase/migrations, with a fresh
-- version (the time you move it, after production's newest), only when
-- step 1 (supabase/migrations/20261028040000_member_email_reads.sql and the
-- app change merged with it) has been live for 3 days. Members keep the app
-- open for hours and the site can deploy before or after a migration; an
-- open tab from before step 1 still asks for these columns, and this file
-- makes that request fail. Check first that step 1 is live (use its
-- re-dated version if the integrator renamed it):
--   select version from supabase_migrations.schema_migrations
--    where version = '20261028040000';
-- Move the test next to it (member_email_columns_revoke_regressions.sql)
-- into supabase/tests in the same commit.
--
-- What it does: signed-in members lose SELECT on the columns that hold
-- another member's email address, the same way 20261015130000 (section 7)
-- did for signed-out visitors. The table grant becomes a column grant of
-- every other column. Writes are unchanged: members still insert their own
-- rows with created_by set, and the row rules (which compare created_by
-- with auth.email()) still work, because a row rule's own columns are not
-- checked against the member's column rights.
--   gecko_images.created_by            forum_posts.created_by
--   forum_comments.created_by          forum_likes.user_email, .created_by
--   breeder_profiles.created_by        breeder_reviews.created_by
--   morph_guide_comments.user_email, .created_by
--   user_badges.user_email, .created_by
--   giveaways.winner_emails, .created_by
--   community_event_reactions.user_email
--   morph_price_entries.created_by
-- Admins are signed-in members too, so they lose these columns as well;
-- the admin screens find authors by owner_profile_id and read_profiles
-- (withOwnerEmails in src/lib/adminData.js) since step 1. The server (service_role) and our
-- own SECURITY DEFINER functions are unaffected.
--
-- Not covered here: geckos.created_by (every owner check uses it; it waits
-- for the identity migration, Part E item E4 32) and gecko_images.user_id
-- (the expert review queue filters on it; one production row holds an
-- address there).
--
-- After this, the app reads these tables with the member column lists in
-- src/lib/memberColumns.js (MEMBER_COLUMNS_BY_TABLE). A column added to one of
-- these tables later is not readable by members until it is granted here or
-- in a later migration (and added to that list).
--
-- Safe to run more than once: the table grant is swapped only the first
-- time, and the column revokes are no-ops the second time.

do $$
declare
  r record;
  v_cols text;
begin
  for r in
    select * from (values
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
      ('morph_price_entries',       array['created_by'])
    ) t(tbl, hidden)
  loop
    if to_regclass('public.' || r.tbl) is null then
      continue;
    end if;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
      from pg_attribute a
     where a.attrelid = ('public.' || r.tbl)::regclass
       and a.attnum > 0 and not a.attisdropped
       and a.attname <> all (r.hidden);
    -- Only the first time: once the table grant is gone, a second run
    -- must not hand back a column added and deliberately left out since.
    if has_table_privilege('authenticated', 'public.' || r.tbl, 'select') then
      execute format('revoke select on public.%I from authenticated', r.tbl);
      execute format('grant select (%s) on public.%I to authenticated', v_cols, r.tbl);
    end if;
    execute format('revoke select (%s) on public.%I from authenticated',
                   (select string_agg(quote_ident(h), ', ') from unnest(r.hidden) h), r.tbl);
  end loop;
end
$$;
