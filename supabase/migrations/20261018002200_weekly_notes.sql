-- Weekly Gecko Notes: one short email a week after a member's first two
-- weeks, in order, for as long as they stay subscribed (18 Oct 2026). The
-- design, the switch and how a session adds notes are in
-- docs/planning/weekly-notes-2026-10.md.
--
-- Additive only and safe to run more than once: create if not exists,
-- create or replace, on conflict do nothing, a guarded column add, and
-- cron.schedule with a fixed job name (which replaces the schedule).
--
-- What it adds, in plain words:
--
-- 1. A switch, app_settings 'weekly_notes_enabled', set to false and not
--    public. While it is false the hourly job does one lookup and stops.
--    Turn it on only after the EMAIL_POSTAL_ADDRESS function secret is set
--    (send-email skips every note without it anyway):
--      update public.app_settings set value = 'true'::jsonb
--       where key = 'weekly_notes_enabled';
--
-- 2. profiles.email_weekly_notes_enabled, the member's own switch (on by
--    default). Its own column, not a key in email_notification_types, so
--    the Settings page's whole-form save (or a stale Settings tab) can
--    never switch it back on. Added once with a one-time backfill: an
--    existing member who turned off Platform Announcements (or whose list
--    is empty, which send-email reads as all off), or who has email off
--    altogether, starts opted out. The guard means a second run never
--    touches the column, so a migration can never undo an opt-out.
--    profiles has no column-level grants, so the member's existing own-row
--    update policy covers it, and it is not one of the columns
--    protect_profile_privileged_columns guards.
--
--    Stopping all email stops the notes too, for good: a trigger turns the
--    weekly switch off whenever email_notifications_enabled goes from on to
--    off (the all-email unsubscribe link, the Settings master switch, an
--    admin). Turning email back on later (or a stale Settings tab saving
--    the old master value) does not bring the notes back; only the
--    member's own weekly switch does.
--
-- 3. public.weekly_notes_sends, the ledger: one row per member and note,
--    unique on (email, slug), written by claim_weekly_note before the email
--    goes. Keyed on the slug, not the step, so adding or renumbering notes
--    later can never send one again; step records where the note sat when
--    it was sent, for reporting.
--
-- 4. public.weekly_notes_polls: one row per member, when the job last asked
--    send-email about them, so each member is asked at most once in any
--    20 hours.
--
-- 5. weekly_notes_candidates(): who may get a note now. claim_weekly_note():
--    the per-member claim send-email makes. enqueue_weekly_notes(): the
--    hourly job. unsubscribe_weekly_notes_by_token(): the "stop Weekly Gecko
--    Notes" link, which works signed out.
--
-- 6. The job weekly-notes-hourly at 50 past each hour (the lifecycle job
--    runs at 35 past).
--
-- Why send-email decides: only it can see the EMAIL_POSTAL_ADDRESS secret
-- and the catalog of written notes (bundled with the function). The job
-- only asks; send-email checks the address, the login, the suppression list
-- and the unsubscribe token, and then claims. So a member skipped for a
-- missing address, or caught up with every written note, gets no ledger
-- row and keeps their next note, and is asked again 20 to 21 hours later:
-- a new note reaches them within a day of the merge that adds it.
--
-- The two series never overlap: lifecycle emails need an account younger
-- than 16 days and weekly notes need one at least 16 days old, and a
-- weekly note waits 20 hours after any lifecycle email (a day 14 email sent
-- late, on day 15).
--
-- Account deletion: admin_erase_account changes in the next file,
-- 20261018002300_erase_weekly_notes.sql, to delete both tables' rows.
--
-- Every function ends with an explicit revoke and grant: since
-- 20261015130000 the default privileges no longer grant EXECUTE
-- (supabase/SCHEMA_CONVENTIONS.md, 4a).

-- 1. The switch ------------------------------------------------------------

insert into public.app_settings (key, value, is_public, description)
values (
  'weekly_notes_enabled',
  'false'::jsonb,
  false,
  'Sends Weekly Gecko Notes. Leave off until the EMAIL_POSTAL_ADDRESS function secret is set. See docs/planning/weekly-notes-2026-10.md.'
)
on conflict (key) do nothing;

-- 2. The member's switch ---------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'email_weekly_notes_enabled'
  ) then
    alter table public.profiles
      add column email_weekly_notes_enabled boolean not null default true;
    -- One time only: members who turned off Platform Announcements (or
    -- whose list is empty), or who have email off altogether, start opted
    -- out of the weekly notes too.
    update public.profiles
       set email_weekly_notes_enabled = false
     where not ('announcements' = any(coalesce(email_notification_types, '{}'::text[])))
        or email_notifications_enabled is not true;
  end if;
end $$;

comment on column public.profiles.email_weekly_notes_enabled is
  'Weekly Gecko Notes on or off for this member. Defaults to on; members who had Platform Announcements or all email off when it was added started off. Changed by the Settings switch (its own save, never the whole-form save) and by unsubscribe_weekly_notes_by_token, and turned off by profiles_weekly_notes_follow_email_off whenever all email is switched off. Turning it off keeps every other email.';

-- Stopping all email stops the weekly notes too. The trigger only ever
-- turns the weekly switch off, so turning email back on never restarts the
-- notes by itself. It runs as whoever made the update (no definer rights)
-- and touches only the row being updated.
create or replace function public.weekly_notes_follow_email_off()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  new.email_weekly_notes_enabled := false;
  return new;
end;
$function$;

revoke all on function public.weekly_notes_follow_email_off() from public, anon, authenticated;

comment on function public.weekly_notes_follow_email_off() is
  'Trigger: when profiles.email_notifications_enabled goes from on to off, turns email_weekly_notes_enabled off too, so stopping all email stops Weekly Gecko Notes for good.';

drop trigger if exists profiles_weekly_notes_follow_email_off on public.profiles;
create trigger profiles_weekly_notes_follow_email_off
  before update of email_notifications_enabled on public.profiles
  for each row
  when (old.email_notifications_enabled is true and new.email_notifications_enabled is not true)
  execute function public.weekly_notes_follow_email_off();

-- 3. The ledger --------------------------------------------------------------

create table if not exists public.weekly_notes_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  step integer not null check (step >= 1),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  created_date timestamptz not null default now(),
  constraint weekly_notes_sends_once unique (email, slug)
);

create index if not exists weekly_notes_sends_email_created_idx
  on public.weekly_notes_sends (email, created_date desc);

alter table public.weekly_notes_sends enable row level security;

drop policy if exists weekly_notes_sends_admin_read on public.weekly_notes_sends;
create policy weekly_notes_sends_admin_read on public.weekly_notes_sends
  for select to authenticated
  using (public.is_admin());

revoke all on table public.weekly_notes_sends from public, anon, authenticated;
grant select on table public.weekly_notes_sends to authenticated;
grant all on table public.weekly_notes_sends to service_role;

comment on table public.weekly_notes_sends is
  'Weekly Gecko Notes ledger: which note (slug, and its step when sent) went to which address and when. Unique on (email, slug), so a note is never sent twice. Written only by claim_weekly_note; admins read it; account deletion erases the member''s rows.';

-- 4. When the job last asked about each member --------------------------------

create table if not exists public.weekly_notes_polls (
  email text primary key check (email = lower(email)),
  polled_at timestamptz not null
);

alter table public.weekly_notes_polls enable row level security;

drop policy if exists weekly_notes_polls_admin_read on public.weekly_notes_polls;
create policy weekly_notes_polls_admin_read on public.weekly_notes_polls
  for select to authenticated
  using (public.is_admin());

revoke all on table public.weekly_notes_polls from public, anon, authenticated;
grant select on table public.weekly_notes_polls to authenticated;
grant all on table public.weekly_notes_polls to service_role;

comment on table public.weekly_notes_polls is
  'Weekly Gecko Notes: when enqueue_weekly_notes last asked send-email about each address, so each member is asked at most once in any 20 hours. Account deletion erases the member''s row.';

-- 5. Who may get a weekly note -------------------------------------------------
--
-- Read-only, so it can be run by hand to preview the next run
-- (select * from public.weekly_notes_candidates();) whether the switch is
-- on or not. The member rules copy lifecycle_email_candidates
-- (20261015151200) exactly, with an account at least 16 days old instead of
-- younger, and the member's weekly switch on. An address with more than one
-- profile row (an imported row that differs only in case) must have the
-- switch on in every one of them, because the stop link and the Settings
-- switch each change one row. p_ignore_polls is for the claim, which runs
-- after the poll was written.

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
   where not exists (
           select 1 from public.email_suppressions s where s.email = m.email
         )
     -- At most one marketing email in any 20 hours: no weekly note within
     -- 20 hours of a lifecycle email (a day 14 email sent late).
     and not exists (
           select 1 from public.lifecycle_email_sends l
            where l.email = m.email
              and l.created_date > p_now - interval '20 hours'
         )
     -- At most one weekly note in any 7 days.
     and not exists (
           select 1 from public.weekly_notes_sends n
            where n.email = m.email
              and n.created_date > p_now - interval '7 days'
         )
     -- Asked about at most once in any 20 hours.
     and (p_ignore_polls
          or w.polled_at is null
          or w.polled_at <= p_now - interval '20 hours');
$function$;

revoke all on function public.weekly_notes_candidates(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.weekly_notes_candidates(timestamptz, boolean) to service_role;

comment on function public.weekly_notes_candidates(timestamptz, boolean) is
  'Members who may get a Weekly Gecko Note at p_now: can sign in, account at least 16 days old, email and weekly switches on (the weekly one on every profile row for the address), not suppressed, no lifecycle email in 20 hours, no weekly note in 7 days and (unless p_ignore_polls) not asked about in 20 hours. Read-only; service role only.';

-- 6. The claim -------------------------------------------------------------------
--
-- send-email calls this after every check that can skip (postal address,
-- login, suppression, unsubscribe token) and sends only when it returns a
-- slug. p_slugs is the catalog in step order. Under a lock for the member it
-- re-checks every rule, picks the first slug the member has not had and
-- writes the ledger row. A caught-up member gets {reason: 'caught-up'} and
-- no row, so they get the next note written as soon as it exists.
--
-- The row's time is the hourly run's time (the member's poll row, when the
-- job wrote it in the last hour), not the moment of the claim, which comes
-- a few seconds later. The 7-day rule is checked against the run's clock,
-- so stamping the claim's own clock would leave the member out one week
-- later at the same minute, and each note would arrive an hour after the
-- last. The rules themselves are still checked at p_now.

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

  -- One claim per member at a time; the second waits, then sees the
  -- first one's row (and the 7-day rule) in the check below.
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes:' || v_email, 0));

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
   where not exists (
     select 1 from public.weekly_notes_sends w
      where w.email = v_email and w.slug = s.slug
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

-- 7. The job -------------------------------------------------------------------
--
-- Asks send-email about each candidate, oldest poll first, at most p_limit
-- members a run (20 spreads the first switch-on for 64 accounts over about
-- four hours and keeps send-email under Resend's rate limit; raise it when
-- eligible members per day pass about 400). The poll row is claimed first,
-- so an overlapping run skips a member this run already took. Returns how
-- many it asked about. While the switch is off its first statement returns
-- 0, one lookup an hour.

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
    select c.email
      from public.weekly_notes_candidates(p_now) c
     order by c.last_polled_at nulls first, c.email
     limit greatest(coalesce(p_limit, 20), 0)
  loop
    insert into public.weekly_notes_polls as w (email, polled_at)
    values (r.email, p_now)
    on conflict (email) do update
      set polled_at = excluded.polled_at
      where w.polled_at <= p_now - interval '20 hours';
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      -- An overlapping run already took this member.
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
          'weekly', jsonb_build_object('run_at', p_now)
        )
      );
      v_count := v_count + 1;
    exception when others then
      -- The poll row stays, so the member is asked again in 20 hours.
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
  'Hourly Weekly Gecko Notes job (weekly-notes-hourly): while app_settings weekly_notes_enabled is true, asks send-email about up to p_limit candidates (oldest poll first), each at most once in 20 hours. send-email claims and sends. Returns how many it asked about.';

-- 8. "Stop Weekly Gecko Notes" ------------------------------------------------
--
-- A copy of unsubscribe_email_by_token (20261003031622): the same token
-- check through email_unsubscribe_token, which also checks the id's
-- pattern. The only difference is the column it turns off, so reminders
-- and the other emails the member chose keep coming. A repeat call returns
-- true again. It touches no column protect_profile_privileged_columns
-- guards. Open to signed-out visitors, because the page and the mail app's
-- one-click button call it with no sign-in: the signature is the proof.

create or replace function public.unsubscribe_weekly_notes_by_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_id text;
  v_expected text;
begin
  if p_token is null or length(p_token) > 200 or position('.' in p_token) = 0 then
    return false;
  end if;
  v_id := split_part(p_token, '.', 1);
  v_expected := public.email_unsubscribe_token(v_id);
  if v_expected is null or v_expected <> p_token then
    return false;
  end if;
  update public.profiles
     set email_weekly_notes_enabled = false
   where id = v_id;
  return found;
end;
$function$;

revoke all on function public.unsubscribe_weekly_notes_by_token(text) from public;
grant execute on function public.unsubscribe_weekly_notes_by_token(text) to anon, authenticated, service_role;

comment on function public.unsubscribe_weekly_notes_by_token(text) is
  'The "stop Weekly Gecko Notes" link: checks the signed unsubscribe token and turns off only profiles.email_weekly_notes_enabled. Works signed out.';

-- 9. The schedule ----------------------------------------------------------------
--
-- Every hour at 50 past. A member who is caught up, or was skipped for a
-- missing postal address, is asked again 20 to 21 hours later, so a new
-- note reaches them within a day of being added. While the switch is off
-- each run is one lookup.

select cron.schedule('weekly-notes-hourly', '50 * * * *', $$ select public.enqueue_weekly_notes(); $$);
