-- Email addresses stored where a name belongs. Applied 3 Oct 2026.
--
-- Changes stored rows, so it is left for Tennyson to apply by hand. It is
-- safe to run before or after 20261003220200_anon_hide_email_columns_more.sql
-- and is idempotent (a second run finds nothing to change).
--
-- Found by a scan on 3 Oct 2026:
-- 1. ownership_records.owner_name: 2 rows (two purchases on 18 Aug 2026,
--    written by older transfer code) hold the buyer's email address. They
--    become the buyer's profile name, or "Geck Inspect keeper" when the
--    profile has no name. The current claim_transfer() already writes a
--    name, never an email.
-- 2. forum_comments.author_name: 1 row holds the author's email address.
--    It becomes the profile name, or "Geck Inspect member". The forum now
--    writes a name with the same fallback.
-- 3. gecko_images.notes: 2 scraped photos carry "[rejected by <email> @ ...]"
--    from an old review tool. The email becomes "a reviewer".
-- 4. gecko_images.training_meta: verified_by (73 rows) and
--    auto_approved_by (3,682 rows) hold the reviewer's email address. They
--    become the reviewer's profile id, which keeps the record of who
--    reviewed the photo without the address. (Signed-out visitors lose
--    training_meta altogether once 20261002235000 is applied; this also
--    covers signed-in members.) The photo trigger that bumps the parent
--    gecko's change time is paused so this does not mark geckos as changed.

-- 1. Ownership chain names.
update public.ownership_records o
   set owner_name = coalesce(
         (select coalesce(nullif(p.full_name, ''), nullif(p.business_name, ''))
            from public.profiles p
           where lower(p.email) = lower(o.owner_name)
           limit 1),
         'Geck Inspect keeper')
 where o.owner_name like '%@%';

-- 2. Forum comment author names.
update public.forum_comments c
   set author_name = coalesce(
         (select coalesce(nullif(p.full_name, ''), nullif(p.business_name, ''))
            from public.profiles p
           where lower(p.email) = lower(c.author_name)
           limit 1),
         'Geck Inspect member')
 where c.author_name like '%@%';

alter table public.gecko_images disable trigger gecko_images_bump_parent;

-- 3. Old rejection notes.
update public.gecko_images
   set notes = regexp_replace(notes, '\[rejected by [^\s\]]+@[^\s\]]+', '[rejected by a reviewer', 'g')
 where notes ~ '\[rejected by [^\s\]]+@[^\s\]]+';

-- 4. Reviewer emails inside training_meta.
update public.gecko_images gi
   set training_meta = jsonb_set(
         gi.training_meta, '{verified_by}',
         to_jsonb(coalesce(
           (select p.id::text from public.profiles p
             where lower(p.email) = lower(gi.training_meta ->> 'verified_by') limit 1),
           'reviewer')))
 where jsonb_typeof(gi.training_meta) = 'object'
   and gi.training_meta ->> 'verified_by' like '%@%';

update public.gecko_images gi
   set training_meta = jsonb_set(
         gi.training_meta, '{auto_approved_by}',
         to_jsonb(coalesce(
           (select p.id::text from public.profiles p
             where lower(p.email) = lower(gi.training_meta ->> 'auto_approved_by') limit 1),
           'reviewer')))
 where jsonb_typeof(gi.training_meta) = 'object'
   and gi.training_meta ->> 'auto_approved_by' like '%@%';

alter table public.gecko_images enable trigger gecko_images_bump_parent;
