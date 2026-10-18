-- Weekly Gecko Notes: the sixth round of review fixes (18 Oct 2026;
-- docs/planning/weekly-notes-2026-10.md, section 9). A sixth independent
-- check of 20261018150400 found these. Safe to run more than once: create
-- or replace, create index if not exists, and a one-time data fix that
-- changes nothing on a second run. Dated after 20261018152154, the newest
-- file in production when this was written.
--
-- What it fixes, in plain words:
--
-- 1. Both claims lock the inbox, not the spelling. Two accounts on one
--    inbox (a plus-tag or dotted Gmail test account, say) are asked about
--    in the same hourly run; with a lock per spelling their two claims
--    could run at once, both pass the inbox-wide 7-day rule and send the
--    same note twice.
--
-- 2. Account erasure removes the other spellings' rows only when no other
--    account that can sign in remains on the inbox. Erasing a duplicate or
--    test account used to wipe the remaining account's ledger, so that
--    member got the series again from the first note.
--
-- 3. Erasure scrubs the delivery log for every spelling it erases (it was
--    the exact address only).
--
-- 4. Speed: an index on profiles (lower(email)). The member rule reads a
--    member's last choice when their inbox has a visitor stop, and without
--    the index each of those reads was a pass over every profile.
--
-- 5. The stop link no longer marks a spelling that never confirmed as
--    stopped (it only loses its link), so the daily cleanup still deletes
--    it after 30 days; rows the 150400 stop link marked are put back.
--
-- 6. A visitor erasure is refused only when an account that can sign in
--    exists on the inbox, as everywhere else (an unconfirmed sign-up or a
--    deleted login no longer blocks it).
--
-- 7. A run that starts a moment early still counts. The hourly job starts
--    a fraction of a second after :50, by a different amount each time,
--    and stamps the ledger and the poll with that start. The 7-day and
--    20-hour rules compared exact times, so when a run started even 0.2
--    seconds earlier than the one before, the address waited an extra
--    hour: on 18 Oct the 22:50 run skipped 20 members polled at 02:50.
--    About every other week a member's note slid an hour later. Both
--    rules (member, visitor, and the hourly job's own check when it
--    records the ask) now allow 10 minutes, so the run 7 days (or 20
--    hours) later always counts. Runs are an hour apart, so this never
--    lets two notes through in one week.
--
-- A correction to 20261018150400's header: its one-time fix stopped only
-- spellings left confirmed beside a newer stop. Two spellings both
-- confirmed with no stop stay confirmed; the visitor candidates pick one
-- of them per inbox when they read, so only one series goes.

-- 4. Speed ----------------------------------------------------------------------------------------

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- 5. One-time data fix ---------------------------------------------------------------------------
--
-- A spelling the 150400 stop link marked stopped although it never
-- confirmed (from 18 Oct, when that file went live) is put back, so the
-- cleanup can delete it after 30 days.

update public.newsletter_subscribers
   set unsubscribed_at = null,
       updated_at = now()
 where source like 'notes:%'
   and weekly_notes_requested_at is not null
   and confirmed_at is null
   and unsubscribed_at >= '2026-10-18 15:00:00+00';

-- 1. The member claim locks the inbox -----------------------------------------------------------
--
-- The 20261018150400 body with the lock changed (marked).

create or replace function public.claim_weekly_note(
  p_email text,
  p_slugs text[],
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_slug text;
  v_step integer;
  v_has_gecko boolean;
  v_polled timestamptz;
  v_stamp timestamptz;
begin
  if v_email = '' then
    return jsonb_build_object('reason', 'no-email');
  end if;

  if p_slugs is null
     or coalesce(cardinality(p_slugs), 0) = 0
     or cardinality(p_slugs) > 1000
     or array_ndims(p_slugs) <> 1
     or exists (
          select 1 from unnest(p_slugs) s(slug)
           where s.slug is null
              or length(s.slug) > 64
              or s.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
     or (select count(distinct s.slug) from unnest(p_slugs) s(slug)) <> cardinality(p_slugs) then
    return jsonb_build_object('reason', 'bad-catalog');
  end if;

  -- One claim per inbox at a time (changed in 20261018172000: the lock
  -- was per spelling, so two accounts on one inbox could both pass the
  -- inbox-wide 7-day rule and get the same note); the second waits, then
  -- sees the first one's row in the check below.
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes:' || public.email_inbox_key(v_email), 0));

  -- Every rule again: sign-in, both switches, suppression, the 16-day
  -- window, 7 days since the last note, 20 hours since a lifecycle email.
  if not exists (
    select 1 from public.weekly_notes_candidates(p_now, true) c where c.email = v_email
  ) then
    return jsonb_build_object('reason', 'not-eligible');
  end if;

  select s.slug, s.ord::integer
    into v_slug, v_step
    from unnest(p_slugs) with ordinality as s(slug, ord)
   -- Changed in 20261018150400: a note any spelling of the inbox had
   -- counts, so a visitor who joins under another spelling gets no repeats.
   where not exists (
     select 1 from public.weekly_notes_sends w
      where public.email_inbox_key(w.email) = public.email_inbox_key(v_email) and w.slug = s.slug
   )
   order by s.ord
   limit 1;
  if v_slug is null then
    return jsonb_build_object('reason', 'caught-up');
  end if;

  -- The run's time when this claim comes from the job's last ask.
  select w.polled_at into v_polled from public.weekly_notes_polls w where w.email = v_email;
  v_stamp := case
    when v_polled is not null and v_polled <= p_now and v_polled > p_now - interval '1 hour' then v_polled
    else p_now
  end;

  insert into public.weekly_notes_sends (email, step, slug, created_date)
  values (v_email, v_step, v_slug, v_stamp)
  on conflict (email, slug) do nothing;
  if not found then
    return jsonb_build_object('reason', 'already-sent');
  end if;

  -- The same ownership rule the lifecycle emails use.
  v_has_gecko := exists (select 1 from public.geckos g where lower(g.created_by) = v_email);

  return jsonb_build_object('slug', v_slug, 'step', v_step, 'has_gecko', v_has_gecko);
end;
$function$;

revoke all on function public.claim_weekly_note(text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.claim_weekly_note(text, text[], timestamptz) to service_role;

comment on function public.claim_weekly_note(text, text[], timestamptz) is
  'Claims the next Weekly Gecko Note for one address: re-checks every rule under a per-member lock, picks the first slug in p_slugs (step order) the member has not had and writes the ledger row, stamped with the hourly run''s time when the job asked in the last hour. Returns {slug, step, has_gecko} or {reason}. Writes nothing for not-eligible, caught-up or bad-catalog. Service role only (send-email).';

-- 1. The visitor claim locks the inbox ------------------------------------------------------------
--
-- The 20261018150400 body with the lock changed (marked).

create or replace function public.claim_weekly_note_subscriber(
  p_email text,
  p_slugs text[],
  p_now timestamptz default now(),
  p_steps integer[] default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_slug text;
  v_ord integer;
  v_step integer;
  v_polled timestamptz;
  v_stamp timestamptz;
begin
  if v_email = '' then
    return jsonb_build_object('reason', 'no-email');
  end if;

  if p_slugs is null
     or coalesce(cardinality(p_slugs), 0) = 0
     or cardinality(p_slugs) > 1000
     or array_ndims(p_slugs) <> 1
     or exists (
          select 1 from unnest(p_slugs) s(slug)
           where s.slug is null
              or length(s.slug) > 64
              or s.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
     or (select count(distinct s.slug) from unnest(p_slugs) s(slug)) <> cardinality(p_slugs)
     or (p_steps is not null
         and (cardinality(p_steps) <> cardinality(p_slugs)
              or exists (select 1 from unnest(p_steps) t(step) where t.step is null or t.step < 1))) then
    return jsonb_build_object('reason', 'bad-catalog');
  end if;

  -- The same per-inbox lock as claim_weekly_note (changed in
  -- 20261018172000), so no two claims for one inbox can both pass the
  -- 7-day rule.
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes:' || public.email_inbox_key(v_email), 0));

  if not exists (
    select 1 from public.weekly_notes_subscriber_candidates(p_now, true) c where c.email = v_email
  ) then
    return jsonb_build_object('reason', 'not-eligible');
  end if;

  select s.slug, s.ord::integer
    into v_slug, v_ord
    from unnest(p_slugs) with ordinality as s(slug, ord)
   -- Changed in 20261018150400: a note any spelling of the inbox had
   -- counts, so signing up again under another spelling repeats nothing.
   where not exists (
     select 1 from public.weekly_notes_sends w
      where public.email_inbox_key(w.email) = public.email_inbox_key(v_email) and w.slug = s.slug
   )
   order by s.ord
   limit 1;
  if v_slug is null then
    return jsonb_build_object('reason', 'caught-up');
  end if;
  -- The note's step in the whole catalog, when send-email passes it, so
  -- step means the same in member and visitor rows.
  v_step := coalesce(p_steps[v_ord], v_ord);

  select w.polled_at into v_polled from public.weekly_notes_polls w where w.email = v_email;
  v_stamp := case
    when v_polled is not null and v_polled <= p_now and v_polled > p_now - interval '1 hour' then v_polled
    else p_now
  end;

  insert into public.weekly_notes_sends (email, step, slug, created_date)
  values (v_email, v_step, v_slug, v_stamp)
  on conflict (email, slug) do nothing;
  if not found then
    return jsonb_build_object('reason', 'already-sent');
  end if;

  return jsonb_build_object('slug', v_slug, 'step', v_step);
end;
$function$;

revoke all on function public.claim_weekly_note_subscriber(text, text[], timestamptz, integer[]) from public, anon, authenticated;
grant execute on function public.claim_weekly_note_subscriber(text, text[], timestamptz, integer[]) to service_role;

comment on function public.claim_weekly_note_subscriber(text, text[], timestamptz, integer[]) is
  'Claims the next Weekly Gecko Note for one visitor address: the visitor rules again under the same per-address lock as claim_weekly_note, the first slug in p_slugs (the visitor order) the address has not had, and the shared ledger row, whose step is the note''s catalog step from p_steps (or its place in p_slugs when not given). Returns {slug, step} or {reason}. Service role only (send-email).';

-- 5. The stop link ------------------------------------------------------------------------------
--
-- The 20261018150400 body with the update changed (marked).

create or replace function public.unsubscribe_weekly_notes_subscriber(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_id text;
  v_secret text;
  v_email text;
begin
  if p_token is null or length(p_token) > 200 or position('.' in p_token) = 0 then
    return false;
  end if;
  v_id := split_part(p_token, '.', 1);
  if v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'email_unsubscribe_secret'
   limit 1;
  if v_secret is null
     or p_token <> v_id || '.' || encode(extensions.hmac('weekly-notes-visitor:' || v_id, v_secret, 'sha256'), 'hex') then
    return false;
  end if;
  select n.email into v_email from public.newsletter_subscribers n where n.id = v_id::uuid;
  if v_email is null then
    return false;
  end if;
  -- Changed in 20261018150400: the form's per-inbox lock, then every
  -- notes row of the inbox stops and loses its confirmation link, so a
  -- pending link on another spelling cannot start them again.
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes_signup:' || public.email_inbox_key(v_email), 0));
  -- Changed in 20261018172000: a spelling that never confirmed is not
  -- marked stopped (it only loses its link), so the daily cleanup still
  -- drops it 30 days after its last link.
  update public.newsletter_subscribers
     set unsubscribed_at = case
           when id = v_id::uuid or confirmed_at is not null then coalesce(unsubscribed_at, now())
           else unsubscribed_at
         end,
         confirm_token_hash = null,
         updated_at = now()
   where id = v_id::uuid
      or (public.email_inbox_key(email) = public.email_inbox_key(v_email)
          and weekly_notes_requested_at is not null);
  -- The same inbox as a member: the stop means the weekly notes there too,
  -- recorded as the member's choice (as the member stop link does).
  -- Changed from 20261018150000: any spelling of the inbox, and a profile
  -- that was already off with no choice gets the choice too, so a later
  -- first sign-in cannot save the sign-up box over the stop.
  update public.profiles
     set email_weekly_notes_enabled = false,
         email_weekly_notes_choice_at = now()
   where public.email_inbox_key(email) = public.email_inbox_key(v_email)
     and (email_weekly_notes_enabled is distinct from false or email_weekly_notes_choice_at is null);
  return true;
end;
$function$;

revoke all on function public.unsubscribe_weekly_notes_subscriber(text) from public;
grant execute on function public.unsubscribe_weekly_notes_subscriber(text) to anon, authenticated, service_role;

comment on function public.unsubscribe_weekly_notes_subscriber(text) is
  'The stop link in a visitor''s Weekly Gecko Note (/Unsubscribe?scope=visitor and the one-click header): checks the signature, stops every Weekly Gecko Note to that inbox (every visitor row for any spelling of it, and the member switch on any profile for the same inbox, recorded as a choice) and kills every live confirmation link for the inbox. Works signed out.';

-- 3, 6. Erasing a visitor --------------------------------------------------------------------------
--
-- The 20261018150400 body with the account check and the delivery scrub
-- changed (marked).

create or replace function public.admin_erase_weekly_notes_visitor(p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_subscribers integer;
  v_sends integer;
  v_polls integer;
  v_log integer;
  v_deliveries integer;
begin
  -- The same rule as admin_erase_account: the service role, or a direct
  -- database session (the SQL console), never a member's API call.
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'admin_erase_weekly_notes_visitor: service role only';
  end if;
  if v_email = '' then
    return jsonb_build_object('erased', false, 'reason', 'no-email');
  end if;
  -- An account that can sign in on any spelling of the inbox (changed in
  -- 20261018172000: an unconfirmed sign-up or a deleted login does not
  -- count, as everywhere else); admin_erase_account then erases the
  -- visitor rows too.
  if exists (select 1 from auth.users u
              where public.email_inbox_key(u.email) = public.email_inbox_key(v_email)
                and u.email_confirmed_at is not null
                and u.deleted_at is null) then
    -- An account: admin_erase_account erases everything, these rows included.
    return jsonb_build_object('erased', false, 'reason', 'has-account');
  end if;
  -- Every spelling of the inbox (changed in 20261018150400).
  delete from public.newsletter_subscribers
   where lower(email) = v_email or public.email_inbox_key(email) = public.email_inbox_key(v_email);
  get diagnostics v_subscribers = row_count;
  delete from public.weekly_notes_sends
   where email = v_email or public.email_inbox_key(email) = public.email_inbox_key(v_email);
  get diagnostics v_sends = row_count;
  delete from public.weekly_notes_polls
   where email = v_email or public.email_inbox_key(email) = public.email_inbox_key(v_email);
  get diagnostics v_polls = row_count;
  delete from public.weekly_notes_signup_sends
   where email = v_email or inbox_key = public.email_inbox_key(v_email);
  get diagnostics v_log = row_count;
  delete from public.guide_email_sends
   where lower(email) = v_email or inbox_key = public.email_inbox_key(v_email);
  -- As account erasure does: the address and its details leave the
  -- delivery log; the anonymous counts stay. email_suppressions is kept on
  -- purpose (an address that bounced or complained is never mailed again).
  -- Every spelling of the inbox (changed in 20261018172000).
  update public.email_deliveries x
     set email = null,
         detail = '{}'::jsonb
   where lower(x.email) = v_email or public.email_inbox_key(x.email) = public.email_inbox_key(v_email);
  get diagnostics v_deliveries = row_count;
  return jsonb_build_object('erased', true, 'subscribers', v_subscribers, 'notes', v_sends,
                            'polls', v_polls, 'form_emails', v_log, 'deliveries', v_deliveries);
end;
$function$;

revoke all on function public.admin_erase_weekly_notes_visitor(text) from public, anon, authenticated;
grant execute on function public.admin_erase_weekly_notes_visitor(text) to service_role;

comment on function public.admin_erase_weekly_notes_visitor(text) is
  'Erases one visitor address (no account) on request: every spelling of the inbox: newsletter_subscribers rows, Weekly Gecko Notes ledger and poll rows, form send log and guide send log, and scrubs it from the email delivery log. Keeps email_suppressions on purpose. Service role or the SQL console only. An inbox with an account on any spelling is refused: use admin_erase_account.';

-- 2, 3. Account erasure ---------------------------------------------------------------------------
--
-- The full body from 20261018150400_weekly_notes_visitor_fixes_5.sql with
-- one variable added (v_whole_inbox) and the inbox-wide deletes and the
-- delivery scrub made to depend on it. Everything else is unchanged.

CREATE OR REPLACE FUNCTION public.admin_erase_account(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_uid       uuid;
  v_uid_text  text;
  v_tomb      text := 'deleted-' || replace(gen_random_uuid()::text, '-', '') || '@deleted.geckinspect.invalid';
  v_label     constant text := 'Former member';
  v_zero      constant uuid := '00000000-0000-0000-0000-000000000000';
  v_url_re    constant text := '/storage/v1/object/(?:public|sign|authenticated)/([A-Za-z0-9_-]+)/([^?#"'' ]+)';
  v_buckets   constant text[] := array['geck-inspect-media', 'promote-images', 'raw-uploads'];
  v_profile   int := 0;
  v_geckos_deleted int := 0;
  v_geckos_kept    int := 0;
  v_messages  int := 0;
  v_images    int := 0;
  v_files     jsonb;
  v_whole_inbox boolean;
begin
  -- Server only. EXECUTE is also revoked from anon and authenticated, but
  -- this check holds even if a grant is ever restored by mistake: a call
  -- through the API carries a role claim, and only service_role passes. A
  -- direct database session (no claim) is an admin at the console.
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'admin_erase_account: service role only';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'admin_erase_account: an email address is required';
  end if;
  if v_email like '%@deleted.geckinspect.invalid' then
    raise exception 'admin_erase_account: this account was already erased';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'admin') then
    raise exception 'admin_erase_account: remove the admin role before erasing an admin account';
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  v_uid_text := v_uid::text;

  -- 1a. Gather the member's files before the rows that point at them go.
  create temp table if not exists pg_temp._erase_files (bucket text, name text) on commit drop;
  truncate pg_temp._erase_files;

  insert into pg_temp._erase_files (bucket, name)
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id = any (v_buckets)
     and v_uid is not null
     and (o.owner_id = v_uid_text
          or o.owner = v_uid
          or o.name ~ ('(^|/)' || v_uid_text || '/'));

  insert into pg_temp._erase_files (bucket, name)
  select m[1], m[2]
    from (
      select g.image_urls::text as blob from public.geckos g where lower(g.created_by) = v_email
      union all select r.image_urls::text from public.other_reptiles r where lower(r.created_by) = v_email
      union all select i.image_url from public.gecko_images i where lower(i.created_by) = v_email
      union all select p.profile_image_url || ' ' || coalesce(p.cover_image_url, '') from public.profiles p where lower(p.email) = v_email
      union all select l.image_url from public.lineage_placeholders l where lower(l.created_by) = v_email
      union all select coalesce(b.profile_photo, '') || ' ' || coalesce(b.banner_photo, '') from public.breeder_profiles b
               where lower(b.created_by) = v_email or (v_uid is not null and b.user_id = v_uid)
      union all select s.header_image_url from public.breeder_store_pages s where lower(s.owner_email) = v_email
      union all select v.attachments::text from public.vet_records v where lower(v.created_by) = v_email
      union all select c.image_url from public.morph_guide_comments c where lower(c.created_by) = v_email or lower(c.user_email) = v_email
      union all select r.image_url from public.morph_reference_images r
               where lower(r.submitted_by_email) = v_email and coalesce(r.status, '') <> 'approved'
      union all select p.public_url from public.promote_images p where v_uid is not null and p.user_id = v_uid
    ) blobs
    cross join lateral regexp_matches(coalesce(blobs.blob, ''), v_url_re, 'g') as m
   where m[1] = any (v_buckets);

  -- 1b. Lineage: keep the member's geckos that another member's gecko
  --     descends from (any number of generations), or that another
  --     member's breeding plan uses.
  create temp table if not exists pg_temp._erase_keep (id text primary key) on commit drop;
  truncate pg_temp._erase_keep;

  insert into pg_temp._erase_keep (id)
  with recursive mine as (
    select g.id, g.sire_id, g.dam_id from public.geckos g where lower(g.created_by) = v_email
  ),
  seeds as (
    select m.id
      from mine m
     where exists (select 1 from public.geckos o
                    where (o.sire_id = m.id or o.dam_id = m.id)
                      and lower(coalesce(o.created_by, '')) <> v_email)
        or exists (select 1 from public.breeding_plans bp
                    where (bp.sire_id = m.id or bp.dam_id = m.id)
                      and lower(coalesce(bp.created_by, '')) <> v_email)
  ),
  ancestors as (
    select s.id from seeds s
    union
    select m.id
      from ancestors a
      join public.geckos child on child.id = a.id
      join mine m on m.id in (child.sire_id, child.dam_id)
  )
  select distinct id from ancestors
  on conflict do nothing;

  -- Give every child (anyone's) a parent name before the parent is hidden
  -- or deleted.
  update public.geckos c
     set sire_name = p.name
    from public.geckos p
   where c.sire_id = p.id
     and lower(p.created_by) = v_email
     and nullif(btrim(c.sire_name), '') is null;
  update public.geckos c
     set dam_name = p.name
    from public.geckos p
   where c.dam_id = p.id
     and lower(p.created_by) = v_email
     and nullif(btrim(c.dam_name), '') is null;

  -- Other members' records that link to one of the member's geckos with a
  -- plain foreign key (no cascade) would block the delete. Clear the link;
  -- their own text (sire_name, review body) stays.
  update public.breeding_projects bp
     set sire_animal_id = null
   where bp.sire_animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email)
     and not (lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  update public.breeding_projects bp
     set dam_animal_id = null
   where bp.dam_animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email)
     and not (lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  update public.breeder_reviews r
     set animal_id = null
   where r.animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email);

  -- 1c. Kept lineage geckos: anonymise.
  update public.geckos g
     set created_by = v_tomb,
         collection_id = null,
         is_public = false,
         gallery_display = false,
         archived = true,
         archived_date = coalesce(g.archived_date, current_date),
         archive_reason = 'Owner account deleted',
         notes = null,
         genetics_notes = null,
         marketplace_description = null,
         asking_price = null,
         listing_price = null,
         sold_price = null,
         market_price_estimate = null,
         morphmarket_id = null,
         morphmarket_url = null,
         palm_street_id = null,
         palm_street_url = null,
         image_urls = '[]'::jsonb,
         image_crop_data = null,
         passport_code = null,
         breeder_name = null,
         breeder_user_id = null,
         hatch_facility = null,
         feeding_group_id = null,
         growth_slideshow_enabled = false
   where g.id in (select k.id from pg_temp._erase_keep k);
  get diagnostics v_geckos_kept = row_count;

  -- 1d. Chain of custody and transfers on animals other members now hold.
  update public.ownership_records o
     set owner_user_id = null,
         owner_name = v_label,
         owner_avatar_url = null,
         notes = null,
         created_by = case when lower(o.created_by) = v_email then v_tomb else o.created_by end
   where (v_uid is not null and o.owner_user_id = v_uid)
      or lower(coalesce(o.created_by, '')) = v_email;

  delete from public.transfer_requests t
   where t.status <> 'claimed'
     and ((v_uid is not null and (t.from_user_id = v_uid or t.to_user_id = v_uid))
          or lower(t.to_email) = v_email
          or lower(coalesce(t.created_by, '')) = v_email);
  update public.transfer_requests t
     set from_user_id = case when t.from_user_id = v_uid then v_zero else t.from_user_id end,
         to_user_id   = case when t.to_user_id = v_uid then null else t.to_user_id end,
         to_email     = case when lower(t.to_email) = v_email then v_tomb else t.to_email end,
         created_by   = case when lower(t.created_by) = v_email then v_tomb else t.created_by end,
         message      = null
   where (v_uid is not null and (t.from_user_id = v_uid or t.to_user_id = v_uid))
      or lower(t.to_email) = v_email
      or lower(coalesce(t.created_by, '')) = v_email;

  update public.geckos g
     set breeder_user_id = null
   where v_uid is not null and g.breeder_user_id = v_uid;

  -- 1e. Breeding records.
  update public.breeding_loans l
     set breeding_project_id = null
   where l.breeding_project_id in (
     select bp.id from public.breeding_projects bp
      where lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  delete from public.breeding_loans l
   where (v_uid is not null and l.lender_user_id = v_uid)
      or (lower(coalesce(l.created_by, '')) = v_email and (l.lender_user_id is null or l.lender_user_id = v_uid));
  update public.breeding_loans l
     set borrower_user_id = null,
         borrower_email = null,
         borrower_name = v_label,
         created_by = case when lower(l.created_by) = v_email then v_tomb else l.created_by end
   where (v_uid is not null and l.borrower_user_id = v_uid)
      or lower(coalesce(l.borrower_email, '')) = v_email;

  delete from public.eggs e
   where e.breeding_plan_id in (select bp.id from public.breeding_plans bp where lower(bp.created_by) = v_email)
      or lower(coalesce(e.created_by, '')) = v_email;
  delete from public.breeding_plans bp where lower(bp.created_by) = v_email;
  delete from public.future_breeding_plans x where lower(x.created_by) = v_email;
  delete from public.pairing_outcome_logs x where lower(x.created_by) = v_email;
  delete from public.genetic_outcome_predictions x where lower(x.created_by) = v_email;
  delete from public.clutches x where lower(x.created_by) = v_email;
  delete from public.breeding_projects bp
   where lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid);
  delete from geck_data.breeding_pairs x where v_uid is not null and x.owner_id = v_uid;

  -- 1f. Husbandry records the member logged.
  --     On someone else's animal (one they sold or care for in a shared
  --     collection) the record stays with the animal's history, with the
  --     author replaced by the deleted-account address and their notes
  --     removed. On their own animals (including ones kept above for
  --     lineage, already re-addressed in 1c) it is deleted. "Someone
  --     else's" means a gecko or reptile that exists and is not theirs.
  update public.weight_records x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.feeding_records x
     set created_by = case when lower(x.created_by) = v_email then v_tomb else x.created_by end,
         logged_by = case when x.logged_by = v_uid then null else x.logged_by end,
         notes = null
   where (lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid))
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.shed_records x
     set created_by = case when lower(x.created_by) = v_email then v_tomb else x.created_by end,
         logged_by = case when x.logged_by = v_uid then null else x.logged_by end,
         notes = null
   where (lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid))
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.vet_records x
     set created_by = v_tomb
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.gecko_events x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.reptile_events x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.other_reptiles r
                  where r.id = x.reptile_id
                    and lower(coalesce(r.created_by, '')) <> v_email);
  update public.lineage_placeholders x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  -- Everything still in the member's name is on their own animals (or on
  -- an animal that no longer exists).
  delete from public.weight_records x where lower(x.created_by) = v_email;
  delete from public.feeding_records x where lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid);
  delete from public.shed_records x where lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid);
  delete from public.vet_records x where lower(x.created_by) = v_email;
  delete from public.gecko_events x where lower(x.created_by) = v_email;
  delete from public.reptile_events x where lower(x.created_by) = v_email;
  delete from public.lineage_placeholders x where lower(x.created_by) = v_email;

  -- 1g. Animals. Deleting a gecko also removes its weights, feedings, sheds,
  --     vet visits, ownership records, loans and pending transfers (existing
  --     cascades and triggers).
  delete from public.geckos g
   where lower(g.created_by) = v_email
     and g.id not in (select k.id from pg_temp._erase_keep k);
  get diagnostics v_geckos_deleted = row_count;
  -- Geckos with no recorded owner that sit in the member's own collections.
  delete from public.geckos g
   where nullif(btrim(g.created_by), '') is null
     and g.collection_id in (select c.id from public.collections c where lower(c.owner_email) = v_email);
  delete from public.other_reptiles x where lower(x.created_by) = v_email;
  delete from public.feeding_groups x where lower(x.created_by) = v_email;

  -- 1h. Collections. Remove the member from other members' collections,
  --     then delete their own. Clearing is_default first lets the existing
  --     rehome trigger move collaborators' geckos to their own default
  --     collection instead of leaving them in no collection.
  delete from public.collection_members cm
   where lower(cm.member_email) = v_email
     and cm.collection_id not in (select c.id from public.collections c where lower(c.owner_email) = v_email);
  update public.collection_members cm
     set invited_by_email = null
   where lower(cm.invited_by_email) = v_email;
  update public.collections c set is_default = false where lower(c.owner_email) = v_email;
  delete from public.collections c where lower(c.owner_email) = v_email;
  update public.collection_activity a
     set actor_email = null,
         actor_name = v_label
   where lower(a.actor_email) = v_email;
  update public.collection_activity a
     set detail = null
   where position(v_email in lower(coalesce(a.detail, ''))) > 0;

  -- 1i. Photos and the training data on them.
  delete from public.gecko_likes x
   where lower(x.user_email) = v_email
      or lower(x.owner_email) = v_email
      or x.gecko_image_id in (select i.id from public.gecko_images i where lower(i.created_by) = v_email);
  delete from public.gecko_of_the_day x
   where lower(x.uploader_email) = v_email
      or x.gecko_image_id in (select i.id from public.gecko_images i where lower(i.created_by) = v_email);
  delete from public.gecko_images i where lower(i.created_by) = v_email;
  get diagnostics v_images = row_count;
  update public.classification_votes v
     set created_by = case when lower(v.created_by) = v_email then v_tomb else v.created_by end,
         reviewer_email = case when lower(v.reviewer_email) = v_email then null else v.reviewer_email end,
         verified_by = case when lower(v.verified_by) = v_email then null else v.verified_by end
   where lower(coalesce(v.created_by, '')) = v_email
      or lower(coalesce(v.reviewer_email, '')) = v_email
      or lower(coalesce(v.verified_by, '')) = v_email;
  delete from public.morph_reference_images r
   where lower(r.submitted_by_email) = v_email and coalesce(r.status, '') <> 'approved';
  update public.morph_reference_images r
     set submitted_by_email = v_tomb,
         created_by = case when lower(r.created_by) = v_email then v_tomb else r.created_by end
   where lower(r.submitted_by_email) = v_email;
  update public.morph_price_entries p
     set submitted_by = null,
         created_by = case when lower(p.created_by) = v_email then v_tomb else p.created_by end,
         notes = null,
         is_anonymous = true
   where (v_uid is not null and p.submitted_by = v_uid) or lower(coalesce(p.created_by, '')) = v_email;
  delete from public.promote_images x where v_uid is not null and x.user_id = v_uid;

  -- 1j. Messages, notifications and support.
  delete from public.direct_messages d
   where lower(d.sender_email) = v_email
      or lower(d.recipient_email) = v_email
      or lower(coalesce(d.created_by, '')) = v_email;
  get diagnostics v_messages = row_count;
  delete from public.notifications n
   where lower(n.user_email) = v_email or lower(coalesce(n.created_by, '')) = v_email;
  delete from public.support_replies r
   where r.message_id in (
     select s.id::text from public.support_messages s
      where (lower(s.user_email) = v_email or lower(coalesce(s.created_by, '')) = v_email)
        and s.subject is distinct from 'Account deletion request');
  delete from public.support_messages s
   where (lower(s.user_email) = v_email or lower(coalesce(s.created_by, '')) = v_email)
     and s.subject is distinct from 'Account deletion request';
  -- 15 Oct 2026: a deletion request this member filed naming someone else
  -- is kept for the team's records, without the member's address. The
  -- member's own deletion ticket is left alone here: the edge function
  -- that called this closes it (and the guard then clears its filer), and
  -- a retried erasure from the inbox still needs it to be verifiable.
  update public.support_messages s
     set filed_by_email = null,
         created_by = case when lower(coalesce(s.created_by, '')) = v_email then null else s.created_by end
   where lower(s.filed_by_email) = v_email
     and lower(coalesce(s.user_email, '')) <> v_email;
  delete from public.push_subscriptions x where lower(x.user_email) = v_email;
  -- Tables added on 3 Oct 2026.
  delete from public.content_reports x where lower(x.reporter_email) = v_email;
  delete from public.planner_notes x where v_uid is not null and x.user_id = v_uid;
  delete from public.consultant_conversations x where v_uid is not null and x.user_id = v_uid;
  delete from public.forum_post_views x where v_uid is not null and x.viewer_id = v_uid;

  -- 1k. Community.
  update public.forum_posts f
     set author_name = v_label, created_by = v_tomb
   where lower(f.created_by) = v_email;
  update public.forum_comments f
     set author_name = v_label, created_by = v_tomb
   where lower(f.created_by) = v_email;
  delete from public.forum_likes x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  update public.questions q
     set author_id = null, created_by = v_tomb
   where lower(q.created_by) = v_email or (v_uid is not null and q.author_id = v_uid);
  update public.answers a
     set author_id = null, created_by = v_tomb
   where lower(a.created_by) = v_email or (v_uid is not null and a.author_id = v_uid);
  delete from public.question_votes x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.morph_guide_comments x where lower(x.created_by) = v_email or lower(x.user_email) = v_email;
  delete from public.community_event_reactions x where lower(x.user_email) = v_email;
  delete from public.user_follows x
   where lower(x.follower_email) = v_email or lower(x.following_email) = v_email;
  delete from public.user_blocks x
   where lower(x.blocker_email) = v_email or lower(x.blocked_email) = v_email;
  delete from public.marketplace_likes x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.breeder_reviews r where v_uid is not null and r.reviewed_user_id = v_uid;
  update public.breeder_reviews r
     set reviewer_user_id = null,
         created_by = case when lower(r.created_by) = v_email then v_tomb else r.created_by end
   where (v_uid is not null and r.reviewer_user_id = v_uid) or lower(coalesce(r.created_by, '')) = v_email;
  delete from public.giveaway_entries x where lower(x.user_email) = v_email;
  update public.giveaways g
     set winner_emails = coalesce((
           select jsonb_agg(w) from jsonb_array_elements(g.winner_emails) w
            where lower(w #>> '{}') <> v_email), '[]'::jsonb)
   where jsonb_typeof(g.winner_emails) = 'array'
     and exists (select 1 from jsonb_array_elements(g.winner_emails) w where lower(w #>> '{}') = v_email);
  delete from public.user_badges x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.user_activity x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.user_events x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.expert_actions x where lower(x.expert_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.expert_verification_requests x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.mentor_offers x where lower(x.owner_email) = v_email or (v_uid is not null and x.user_id = v_uid);

  -- 1l. Breeder pages, waitlists and inquiries.
  delete from public.breeder_profiles x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.breeder_store_pages x where lower(x.owner_email) = v_email;
  delete from public.breeder_inquiries x where lower(x.buyer_email) = v_email or lower(x.breeder_email) = v_email;
  delete from public.gecko_waitlists x where v_uid is not null and x.breeder_user_id = v_uid;
  delete from public.gecko_waitlist_signups x where lower(x.email) = v_email;

  -- 1m. Business tools and market.
  delete from public.pending_sales x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.marketplace_costs x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.collection_valuations x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.market_value_daily x where lower(x.user_email) = v_email;
  delete from public.price_alerts x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.price_game_guesses x where v_uid is not null and x.user_id = v_uid;
  delete from public.tasks x where lower(x.created_by) = v_email;
  delete from public.projects x where lower(x.created_by) = v_email;
  delete from public.shipping_orders x where lower(x.created_by) = v_email;

  -- 1n. Usage, integrations and subscriptions.
  -- Visitor rows, the ledger, the polls and the delivery log for every
  -- spelling of the inbox go too (20261018150400), so a visitor series
  -- under another spelling cannot start again once the account is gone,
  -- but only when no other account that can sign in remains on the inbox
  -- (20261018172000): its own rows stay, or that member would get the
  -- series again from the first note.
  v_whole_inbox := not exists (
    select 1 from auth.users u
     where public.email_inbox_key(u.email) = public.email_inbox_key(v_email)
       and lower(u.email) <> v_email
       and u.email_confirmed_at is not null
       and u.deleted_at is null);
  delete from public.newsletter_subscribers x where lower(x.email) = v_email or (v_uid is not null and x.user_id = v_uid) or (v_whole_inbox and public.email_inbox_key(x.email) = public.email_inbox_key(v_email));
  delete from public.guide_email_sends x where lower(x.email) = v_email or (v_whole_inbox and x.inbox_key = public.email_inbox_key(v_email));
  -- Email delivery log (20261015151200): keep the counts, drop the
  -- person. The address goes, and so does the detail, which holds the
  -- link they clicked or a bounce message that can quote the address.
  -- email_delivery_stats counts by message and type, so the admin
  -- figures do not change. The lifecycle ledger row goes too, which also
  -- lets someone who signs up again later get the welcome emails.
  -- email_suppressions is kept on purpose: an address that bounced or
  -- marked our email as spam must never be mailed again.
  update public.email_deliveries x
     set email = null,
         detail = '{}'::jsonb
   where lower(x.email) = v_email or (v_whole_inbox and public.email_inbox_key(x.email) = public.email_inbox_key(v_email));
  delete from public.lifecycle_email_sends x where x.email = v_email;
  delete from public.weekly_notes_sends x where x.email = v_email or (v_whole_inbox and public.email_inbox_key(x.email) = public.email_inbox_key(v_email));
  delete from public.weekly_notes_polls x where x.email = v_email or (v_whole_inbox and public.email_inbox_key(x.email) = public.email_inbox_key(v_email));
  -- Every spelling of the member's inbox (plus tags, Gmail dots), as the
  -- form logs it (20261018150300).
  delete from public.weekly_notes_signup_sends x where x.email = v_email or (v_whole_inbox and x.inbox_key = public.email_inbox_key(v_email));
  delete from public.feature_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.morph_id_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.iot_connections x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_posts x where (v_uid is not null and x.created_by_user_id = v_uid) or lower(coalesce(x.created_by_email, '')) = v_email;
  delete from public.social_platform_connections x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_post_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_post_photo_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_generation_log x where v_uid is not null and x.user_id = v_uid;
  delete from public.user_brand_voice x where v_uid is not null and x.user_id = v_uid;
  delete from public.store_carts x where v_uid is not null and x.owner_user_id = v_uid;
  delete from public.revenuecat_entitlements x where v_uid is not null and x.app_user_id = v_uid;
  delete from public.revenuecat_sync_requests x where v_uid is not null and x.app_user_id = v_uid;
  update public.store_affiliate_clicks x set user_id = null where v_uid is not null and x.user_id = v_uid;

  -- 1o. Money and referral records: keep the amounts, drop the person.
  update public.store_orders o
     set customer_email = v_tomb,
         customer_name = null,
         owner_user_id = null,
         ship_to = null,
         notes = null
   where lower(o.customer_email) = v_email or (v_uid is not null and o.owner_user_id = v_uid);
  update public.store_signup_grants g
     set granted_email = case when lower(g.granted_email) = v_email then v_tomb else g.granted_email end,
         redeemed_by_user_id = case when g.redeemed_by_user_id = v_uid then null else g.redeemed_by_user_id end,
         ship_to_postal_hash = null
   where lower(g.granted_email) = v_email or (v_uid is not null and g.redeemed_by_user_id = v_uid);
  update public.payment_events p
     set user_email = v_tomb,
         raw_stripe_payload = null,
         -- What the member typed when cancelling (20261015151400).
         cancellation_comment = null,
         created_by = case when lower(p.created_by) = v_email then v_tomb else p.created_by end
   where lower(p.user_email) = v_email;
  update public.referral_rewards r
     set referrer_email = case when lower(r.referrer_email) = v_email then v_tomb else r.referrer_email end,
         referred_email = case when lower(r.referred_email) = v_email then v_tomb else r.referred_email end
   where lower(r.referrer_email) = v_email or lower(r.referred_email) = v_email;
  update public.social_referral_bonuses b
     set referrer_email = case when lower(b.referrer_email) = v_email then v_tomb else b.referrer_email end,
         referred_email = case when lower(b.referred_email) = v_email then v_tomb else b.referred_email end,
         referrer_user_id = case when b.referrer_user_id = v_uid then null else b.referrer_user_id end,
         referred_user_id = case when b.referred_user_id = v_uid then null else b.referred_user_id end
   where lower(coalesce(b.referrer_email, '')) = v_email
      or lower(coalesce(b.referred_email, '')) = v_email
      or (v_uid is not null and (b.referrer_user_id = v_uid or b.referred_user_id = v_uid));

  -- 1p. Logs.
  update public.error_logs e
     set user_email = null,
         created_by = case when lower(e.created_by) = v_email then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or lower(coalesce(e.created_by, '')) = v_email;
  update geck_data.error_logs e
     set user_email = null,
         created_by = case when e.created_by = v_uid then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or (v_uid is not null and e.created_by = v_uid);
  update geck_data.user_events e
     set user_email = null,
         created_by = case when e.created_by = v_uid then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or (v_uid is not null and e.created_by = v_uid);
  update geck_data.model_invocations m set user_id = null where v_uid is not null and m.user_id = v_uid;
  update geck_data.listing_images li set uploaded_by = null where v_uid is not null and li.uploaded_by = v_uid;
  delete from geck_data.alerts x where v_uid is not null and x.owner_id = v_uid;
  delete from geck_data.user_notification_channels x where v_uid is not null and x.owner_id = v_uid;

  -- 1q. The profile itself.
  delete from public.profiles p where lower(p.email) = v_email;
  get diagnostics v_profile = row_count;
  delete from geck_data.profiles p where lower(p.email) = v_email or (v_uid is not null and p.id = v_uid);

  -- 2. Files to remove: the member's, minus anything a surviving row uses.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.name)), '[]'::jsonb)
    into v_files
    from (
      select distinct ef.bucket, ef.name
        from pg_temp._erase_files ef
        join storage.objects o on o.bucket_id = ef.bucket and o.name = ef.name
    ) f
   where not exists (select 1 from public.geckos x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.other_reptiles x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.gecko_images x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.profiles x
                      where strpos(coalesce(x.profile_image_url, '') || coalesce(x.cover_image_url, ''), f.name) > 0)
     and not exists (select 1 from public.forum_posts x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.forum_comments x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.lineage_placeholders x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.morph_reference_images x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.morph_guides x where strpos(x.example_image_url, f.name) > 0)
     and not exists (select 1 from public.morph_traits x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.care_guide_sections x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.breeder_store_pages x where strpos(x.header_image_url, f.name) > 0)
     and not exists (select 1 from public.breeder_profiles x
                      where strpos(coalesce(x.profile_photo, '') || coalesce(x.banner_photo, ''), f.name) > 0)
     and not exists (select 1 from public.store_products x where strpos(x.images::text, f.name) > 0)
     and not exists (select 1 from public.vet_records x where strpos(x.attachments::text, f.name) > 0)
     and not exists (select 1 from public.breeding_loans x
                      where strpos(coalesce(x.condition_photos_out::text, '') || coalesce(x.condition_photos_in::text, ''), f.name) > 0)
     and not exists (select 1 from public.giveaways x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.blog_posts x where strpos(x.featured_image_url, f.name) > 0)
     and not exists (select 1 from public.testimonials x where strpos(x.avatar_url, f.name) > 0)
     and not exists (select 1 from public.promote_images x where x.storage_path = f.name);

  return jsonb_build_object(
    'email', v_email,
    'auth_user_id', v_uid,
    'profile_deleted', v_profile > 0,
    'geckos_deleted', v_geckos_deleted,
    'geckos_anonymised', v_geckos_kept,
    'photos_deleted', v_images,
    'messages_deleted', v_messages,
    'files', v_files
  );
end;
$function$;

revoke all on function public.admin_erase_account(text) from public;
revoke all on function public.admin_erase_account(text) from anon;
revoke all on function public.admin_erase_account(text) from authenticated;
grant execute on function public.admin_erase_account(text) to service_role;

comment on function public.admin_erase_account(text) is
  'Deletes or anonymises one member''s rows (D16). Service role only; called by the admin-delete-account edge function, which then removes the returned Storage files and the login. Keeps email_suppressions on purpose, so an address that bounced or complained is never mailed again.';

-- 7. The member rule: a run that starts a moment early still counts --------------------------------
--
-- The 20261018150400 body with the 7-day and 20-hour comparisons changed
-- (marked).

create or replace function public.weekly_notes_candidates(
  p_now timestamptz default now(),
  p_ignore_polls boolean default false
)
returns table (email text, last_polled_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with members as (
    select distinct on (lower(u.email))
           lower(u.email) as email
      from auth.users u
      join public.profiles p on lower(p.email) = lower(u.email)
     where u.email is not null
       and u.email_confirmed_at is not null
       and u.deleted_at is null
       and coalesce(u.is_anonymous, false) = false
       and (u.banned_until is null or u.banned_until < p_now)
       -- After the lifecycle window (lifecycle needs > p_now - 16 days).
       and u.created_at <= p_now - interval '16 days'
       and p.email_notifications_enabled is true
       and p.email_weekly_notes_enabled is true
       and not exists (
             select 1 from public.profiles p2
              where lower(p2.email) = lower(u.email)
                and p2.email_weekly_notes_enabled is not true
           )
     order by lower(u.email), p.created_date nulls last
  )
  select m.email, w.polled_at as last_polled_at
    from members m
    left join public.weekly_notes_polls w on w.email = m.email
   -- The inbox match (email_inbox_suppressed), so a spam report under
   -- another spelling of the inbox stops these too.
   where not public.email_inbox_suppressed(m.email)
     -- At most one marketing email in any 20 hours: no weekly note within
     -- 20 hours of a lifecycle email (a day 14 email sent late).
     and not exists (
           select 1 from public.lifecycle_email_sends l
            where l.email = m.email
              and l.created_date > p_now - interval '20 hours'
         )
     -- A stop from a visitor note holds for the inbox once it has an
     -- account, unless the member turned the notes on again afterwards
     -- (the Settings switch: email_weekly_notes_choice_at is newer).
     -- weekly_notes_visitor_stop_at decides what counts as a stop (any
     -- spelling of the inbox, after a request, not followed by a new
     -- sign-up). The member's last choice is read only when there is a
     -- stop, so this costs one index lookup per member.
     and (case
            when public.weekly_notes_visitor_stop_at(m.email) is null then true
            else public.weekly_notes_visitor_stop_at(m.email) < coalesce((
                   select max(p3.email_weekly_notes_choice_at) from public.profiles p3
                    where lower(p3.email) = m.email), '-infinity'::timestamptz)
          end)
     -- At most one weekly note in any 7 days, to any spelling of the inbox.
     -- Changed in 20261018172000: 10 minutes' allowance, so the run 7 days
     -- later counts even when it starts a moment earlier than the last one.
     and not exists (
           select 1 from public.weekly_notes_sends n
            where public.email_inbox_key(n.email) = public.email_inbox_key(m.email)
              and n.created_date > p_now - (interval '7 days' - interval '10 minutes')
         )
     -- Asked about at most once in any 20 hours, with the same allowance
     -- (changed in 20261018172000).
     and (p_ignore_polls
          or w.polled_at is null
          or w.polled_at <= p_now - (interval '20 hours' - interval '10 minutes'));
$function$;

revoke all on function public.weekly_notes_candidates(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.weekly_notes_candidates(timestamptz, boolean) to service_role;

comment on function public.weekly_notes_candidates(timestamptz, boolean) is
  'Members who may get a Weekly Gecko Note at p_now: can sign in, account at least 16 days old, email and weekly switches on (the weekly one on every profile row for the address), not suppressed (email_inbox_suppressed), no lifecycle email in 20 hours, no weekly note to the inbox in 7 days, no visitor stop on their inbox (weekly_notes_visitor_stop_at) newer than the member''s last choice, and (unless p_ignore_polls) not asked about in 20 hours. The 7-day and 20-hour rules allow 10 minutes, so the hourly run that comes 7 days or 20 hours later always counts. Read-only; service role only.';

-- 7. The visitor rule: the same allowance ----------------------------------------------------------
--
-- The 20261018150400 body with the 7-day and 20-hour comparisons changed
-- (marked).

create or replace function public.weekly_notes_subscriber_candidates(
  p_now timestamptz default now(),
  p_ignore_polls boolean default false
)
returns table (email text, last_polled_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- One row per inbox (the first spelling confirmed), chosen before the
  -- 7-day and poll rules, so two spellings of one inbox never make two
  -- series.
  with eligible as (
    select distinct on (public.email_inbox_key(s.email)) s.email
      from public.newsletter_subscribers s
     where s.weekly_notes_requested_at is not null
       and s.confirmed_at is not null
       -- Only a click on a link sent for this request confirms it.
       and s.confirmed_at >= s.weekly_notes_requested_at
       and s.unsubscribed_at is null
       and s.email = lower(s.email)
       -- Members get the notes through the member rules and their own
       -- switch, whichever spelling of the inbox has the account.
       and not exists (select 1 from auth.users u
                        where public.email_inbox_key(u.email) = public.email_inbox_key(s.email)
                          and u.email_confirmed_at is not null
                          and u.deleted_at is null)
       and not public.email_inbox_suppressed(s.email)
       -- A stop on another spelling, newer than this row's confirmation.
       and public.weekly_notes_visitor_stop_at(s.email) is null
     order by public.email_inbox_key(s.email), s.confirmed_at, s.email
  )
  select e.email, w.polled_at as last_polled_at
    from eligible e
    left join public.weekly_notes_polls w on w.email = e.email
   -- At most one note in any 7 days to any spelling of the inbox, and
   -- asked about at most once in any 20 hours, each with 10 minutes'
   -- allowance (changed in 20261018172000).
   where not exists (
           select 1 from public.weekly_notes_sends n
            where public.email_inbox_key(n.email) = public.email_inbox_key(e.email)
              and n.created_date > p_now - (interval '7 days' - interval '10 minutes')
         )
     and (p_ignore_polls
          or w.polled_at is null
          or w.polled_at <= p_now - (interval '20 hours' - interval '10 minutes'));
$function$;

revoke all on function public.weekly_notes_subscriber_candidates(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.weekly_notes_subscriber_candidates(timestamptz, boolean) to service_role;

comment on function public.weekly_notes_subscriber_candidates(timestamptz, boolean) is
  'Visitor addresses that may get a Weekly Gecko Note at p_now: asked on the form, confirmed by a click after the request, not unsubscribed, no account that can sign in on any spelling of the inbox (members follow the member rules), not suppressed (email_inbox_suppressed), no newer stop on another spelling (weekly_notes_visitor_stop_at), one spelling per inbox (the first confirmed), no note to the inbox in 7 days and (unless p_ignore_polls) not asked about in 20 hours. The 7-day and 20-hour rules allow 10 minutes, so the hourly run that comes 7 days or 20 hours later always counts. Read-only; service role only.';

-- 7. The hourly job: the same allowance when it records its ask ------------------------------------
--
-- The 20261018120000 body with the poll comparison changed (marked).
-- Without this the job would find an address the rules above now let
-- through, then skip it as "already taken by an overlapping run".

create or replace function public.enqueue_weekly_notes(
  p_now timestamptz default now(),
  p_limit integer default 20
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_email_url constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-email';
  v_key text;
  v_count integer := 0;
  v_rows integer;
  r record;
begin
  if not exists (
    select 1 from public.app_settings
     where key = 'weekly_notes_enabled' and value = 'true'::jsonb
  ) then
    return 0;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;
  if v_key is null or v_key = '' then
    raise warning 'enqueue_weekly_notes: notification_service_role_key is missing';
    return 0;
  end if;

  for r in
    select c.email, 'member'::text as audience, c.last_polled_at
      from public.weekly_notes_candidates(p_now) c
    union all
    select v.email, 'visitor'::text, v.last_polled_at
      from public.weekly_notes_subscriber_candidates(p_now) v
    order by 2, 3 nulls first, 1
    limit greatest(coalesce(p_limit, 20), 0)
  loop
    insert into public.weekly_notes_polls as w (email, polled_at)
    values (r.email, p_now)
    on conflict (email) do update
      set polled_at = excluded.polled_at
      -- Changed in 20261018172000: the same 10 minutes' allowance as the
      -- candidate rules, so the run 20 hours later can take the address.
      where w.polled_at <= p_now - (interval '20 hours' - interval '10 minutes');
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      -- An overlapping run already took this address.
      continue;
    end if;

    begin
      perform net.http_post(
        url := v_email_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := jsonb_build_object(
          'user_email', r.email,
          'type', 'weekly_notes',
          'weekly', case
            when r.audience = 'visitor' then jsonb_build_object('run_at', p_now, 'audience', 'visitor')
            else jsonb_build_object('run_at', p_now)
          end
        )
      );
      v_count := v_count + 1;
    exception when others then
      -- The poll row stays, so the address is asked again in 20 hours.
      -- Nothing was claimed, so no note is used up.
      raise warning 'enqueue_weekly_notes: send-email call failed: %', sqlerrm;
    end;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.enqueue_weekly_notes(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.enqueue_weekly_notes(timestamptz, integer) to service_role;

comment on function public.enqueue_weekly_notes(timestamptz, integer) is
  'Hourly Weekly Gecko Notes job (weekly-notes-hourly): while app_settings weekly_notes_enabled is true, asks send-email about up to p_limit addresses, members first and then confirmed visitors (weekly.audience visitor), oldest poll first, each at most once in 20 hours (with 10 minutes'' allowance, so the run 20 hours later counts). send-email claims and sends. Returns how many it asked about.';
