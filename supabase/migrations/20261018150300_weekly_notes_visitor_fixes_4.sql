-- Weekly Gecko Notes for visitors: the fourth round of review fixes
-- (18 Oct 2026; docs/planning/weekly-notes-2026-10.md, section 9). A fourth
-- independent check of 20261018150200 found these. Safe to run more than
-- once: create or replace, create index if not exists, and one-time data
-- fixes that change nothing on a second run.
--
-- Numbered 150300 because 20261018150200 (dated ahead of its time, like
-- the two before it) is already applied; a file must sort after the newest
-- applied one (docs/MIGRATIONS.md).
--
-- The thread through these: an inbox is one person. Plus tags and Gmail
-- dots already counted as one inbox for the form's limits and its quiet
-- rule; now the stop, the member check and the "already signed up" check
-- use the inbox too.
--
-- What it fixes, in plain words:
--
-- 1. One rule for "this inbox stopped the visitor notes"
--    (weekly_notes_visitor_stop_at): the newest stop on any spelling of the
--    inbox, counted only when it came after that row asked for the notes
--    (an older unsubscribe is not a stop of these notes), and only when no
--    spelling of the inbox confirmed a new sign-up after it. The trigger on
--    new profiles, the first-sign-in rule, the member rule and the visitor
--    candidates all use it.
--
-- 2. The stop link records the member's choice when the profile had none,
--    not only when the switch was on, and reaches every spelling of the
--    inbox. Before, a profile already off with no choice kept no choice,
--    and the member's first sign-in saved the ticked sign-up box over the
--    stop. The first-sign-in rule (weekly_notes_region_default) now also
--    checks for a stop itself and records it instead of saving the box.
--
-- 3. Spam complaints silence every spelling of the inbox again; only
--    bounces keep the narrow match from 150200 (some providers refuse plus
--    tags and bounce them, but a complaint proves the mail arrived).
--    email_inbox_suppressed now uses indexes, so its cost no longer grows
--    with the suppression list.
--
-- 4. An inbox with an account is a member everywhere, whichever spelling is
--    typed: the form answers "member", the confirm button too, and visitor
--    candidates leave it out, so one inbox never gets two series. A second
--    spelling of an inbox that is already signed up gets "already", on the
--    form and on the confirm button.
--
-- 5. The form's send log rows for every spelling of a member's inbox go
--    with the account (admin_erase_account) and with a visitor erasure.
--
-- 6. The homepage guide form's send log (guide_email_sends) is deleted
--    after 30 days by the daily cleanup.

-- Indexes for the inbox lookups ------------------------------------------------------------
--
-- Both call email_inbox_key, so a role writing these tables must be allowed
-- to run it. Only the service role (the guide form, through the API) and the
-- database's own functions (record_email_event, the form's functions, the
-- erasure functions) write them, and both may.

create index if not exists email_suppressions_inbox_idx
  on public.email_suppressions (public.email_inbox_key(email));
create index if not exists newsletter_subscribers_inbox_idx
  on public.newsletter_subscribers (public.email_inbox_key(email));

-- 3. Suppressions -----------------------------------------------------------------------------

create or replace function public.email_inbox_suppressed(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_inbox text := public.email_inbox_key(p_email);
begin
  -- The address itself, or the same address without its plus tag.
  if exists (select 1 from public.email_suppressions x where x.email in (v_email, v_inbox)) then
    return true;
  end if;
  -- Any spelling of the inbox when it complained (the mail reached it), and
  -- for Gmail any spelling at all (Gmail delivers every spelling to one
  -- inbox). A bounce on a plus-tag address elsewhere does not count here.
  return exists (
    select 1 from public.email_suppressions x
     where public.email_inbox_key(x.email) = v_inbox
       and (x.reason = 'complained' or split_part(v_inbox, '@', 2) = 'gmail.com')
  );
end;
$function$;

revoke all on function public.email_inbox_suppressed(text) from public, anon, authenticated;
grant execute on function public.email_inbox_suppressed(text) to service_role;

comment on function public.email_inbox_suppressed(text) is
  'True when the address, or the same address without its plus tag, is on email_suppressions; when any spelling of the same inbox complained; and for Gmail, when any spelling of it is there (dots, plus tags, googlemail.com). A bounce on a plus-tag address outside Gmail never covers the plain one, because some providers refuse plus tags and bounce them. Used by the Weekly Gecko Notes visitor form, visitor candidates and the homepage guide form.';

-- 1. One rule for a visitor stop ----------------------------------------------------------------

create or replace function public.weekly_notes_visitor_stop_at(p_email text)
returns timestamptz
language sql
stable
security definer
set search_path to ''
as $function$
  select case when v.stop_at > coalesce(v.consent_at, '-infinity'::timestamptz) then v.stop_at end
    from (
      select max(s.unsubscribed_at) filter (where s.unsubscribed_at >= s.weekly_notes_requested_at) as stop_at,
             max(s.confirmed_at) filter (where s.unsubscribed_at is null
                                           and s.confirmed_at >= s.weekly_notes_requested_at) as consent_at
        from public.newsletter_subscribers s
       where public.email_inbox_key(s.email) = public.email_inbox_key(p_email)
         and s.weekly_notes_requested_at is not null
    ) v;
$function$;

revoke all on function public.weekly_notes_visitor_stop_at(text) from public, anon, authenticated;
grant execute on function public.weekly_notes_visitor_stop_at(text) to service_role;

comment on function public.weekly_notes_visitor_stop_at(text) is
  'When the inbox of p_email (any spelling: plus tags, Gmail dots) stopped Weekly Gecko Notes as a visitor, or null. Counts a stop only when it came after that row asked for the notes, and only when no spelling of the inbox confirmed a new sign-up after it. Used by the profile trigger, weekly_notes_region_default, the member rule and the visitor candidates. Service role only.';

-- 1, 2. The trigger on new profiles --------------------------------------------------------------

create or replace function public.weekly_notes_visitor_stop_on_new_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_stop timestamptz;
begin
  if new.email is not null then
    v_stop := public.weekly_notes_visitor_stop_at(new.email);
  end if;
  if v_stop is not null then
    -- The stop is recorded as the member's choice, dated when they pressed
    -- it, so weekly_notes_region_default finds a choice at the first
    -- sign-in and never saves the sign-up box over it, and the member rule
    -- in weekly_notes_candidates still needs a newer choice (the Settings
    -- switch) before notes go out. This holds in the EEA and the UK too,
    -- where the box starts unticked: a tick at sign-up does not undo a
    -- stop; the Settings switch does.
    new.email_weekly_notes_enabled := false;
    new.email_weekly_notes_choice_at := v_stop;
  end if;
  return new;
end;
$function$;

revoke all on function public.weekly_notes_visitor_stop_on_new_profile() from public, anon, authenticated;

comment on function public.weekly_notes_visitor_stop_on_new_profile() is
  'Trigger: a new profile whose inbox stopped Weekly Gecko Notes as a visitor (weekly_notes_visitor_stop_at) starts with the notes off, recorded as the member''s choice dated at the stop, whatever the sign-up box said; the first sign-in then leaves it alone. Settings shows them off; turning them on there is the member''s newer choice. Runs after profiles_weekly_notes_stamp_choice (trigger names sort that way).';

-- 2. The stop link ---------------------------------------------------------------------------------
--
-- The 20261018150000 body with the profile update changed (marked).

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
  update public.newsletter_subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now()),
         confirm_token_hash = null,
         updated_at = now()
   where id = v_id::uuid
  returning email into v_email;
  if v_email is null then
    return false;
  end if;
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
  'The stop link in a visitor''s Weekly Gecko Note (/Unsubscribe?scope=visitor and the one-click header): checks the signature, stops every Weekly Gecko Note to that inbox (the visitor row, and the member switch on any profile for the same inbox, recorded as a choice) and kills any live confirmation link. Works signed out.';

-- 2. The first-sign-in rule checks for a stop itself ------------------------------------------------
--
-- The 20261018002200 body with one step added before the sign-up box is
-- saved (marked).

create or replace function public.weekly_notes_region_default(p_consent_region boolean)
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_box boolean;
  v_choice_at timestamptz;
begin
  if v_uid is null then
    return 'not-signed-in';
  end if;
  select u.email, u.raw_user_meta_data into v_email, v_meta
    from auth.users u
   where u.id = v_uid;
  if v_email is null or v_email = '' then
    return 'no-profile';
  end if;

  -- Added in 20261018150300: an inbox that stopped the visitor notes keeps
  -- them off. With no choice recorded yet, the stop is recorded as the
  -- choice, so neither the sign-up box nor the region rule acts on it.
  if public.weekly_notes_visitor_stop_at(v_email) is not null then
    update public.profiles p
       set email_weekly_notes_enabled = false,
           email_weekly_notes_choice_at = now()
     where p.email = v_email
       and p.email_weekly_notes_choice_at is null;
  end if;

  if jsonb_typeof(v_meta -> 'weekly_notes_at_signup') = 'boolean' then
    v_box := (v_meta ->> 'weekly_notes_at_signup')::boolean;
  end if;

  -- Each update re-checks "no choice yet" on the row itself, so a Settings
  -- save that lands at the same moment always wins.
  if v_box is not null then
    update public.profiles p
       set email_weekly_notes_enabled = v_box,
           email_weekly_notes_choice_at = now()
     where p.email = v_email
       and p.email_weekly_notes_choice_at is null;
    if found then
      return 'signup-choice';
    end if;
  elsif p_consent_region is true then
    update public.profiles p
       set email_weekly_notes_enabled = false
     where p.email = v_email
       and p.email_weekly_notes_choice_at is null
       and p.email_weekly_notes_enabled is distinct from false;
    if found then
      return 'region-off';
    end if;
  end if;

  select p.email_weekly_notes_choice_at into v_choice_at
    from public.profiles p
   where p.email = v_email;
  if not found then
    return 'no-profile';
  end if;
  return case when v_choice_at is not null then 'chosen' else 'unchanged' end;
end;
$function$;

revoke all on function public.weekly_notes_region_default(boolean) from public, anon, authenticated;
grant execute on function public.weekly_notes_region_default(boolean) to authenticated, service_role;

comment on function public.weekly_notes_region_default(boolean) is
  'Weekly Gecko Notes for the signed-in caller only: when no choice is recorded, keeps the notes off as the choice if the inbox stopped them as a visitor, else saves a sign-up box not saved yet, or (p_consent_region, a browser in the EEA or the UK) turns the notes off without recording a choice. Never acts after a choice. Returns chosen, signup-choice, region-off, unchanged, no-profile or not-signed-in.';

-- 1. The member rule uses the one stop rule ------------------------------------------------------------
--
-- The 20261018150100 body with the visitor-stop clause changed (marked).

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
     -- A stop from a visitor note holds for the inbox once it has an
     -- account, unless the member turned the notes on again afterwards
     -- (the Settings switch: email_weekly_notes_choice_at is newer).
     -- Changed from 20261018150100: weekly_notes_visitor_stop_at decides
     -- what counts as a stop (any spelling of the inbox, after a request,
     -- not followed by a new sign-up).
     and (public.weekly_notes_visitor_stop_at(m.email) >= coalesce((
            select max(p3.email_weekly_notes_choice_at) from public.profiles p3
             where lower(p3.email) = m.email), '-infinity'::timestamptz)) is not true
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
  'Members who may get a Weekly Gecko Note at p_now: can sign in, account at least 16 days old, email and weekly switches on (the weekly one on every profile row for the address), not suppressed, no lifecycle email in 20 hours, no weekly note in 7 days, no visitor stop on their inbox (weekly_notes_visitor_stop_at) newer than the member''s last choice, and (unless p_ignore_polls) not asked about in 20 hours. Read-only; service role only.';

-- 3, 4. The form's database step --------------------------------------------------------------------
--
-- The 20261018150200 body with the member and "already" checks changed
-- (marked).

create or replace function public.request_weekly_notes_signup(
  p_email text,
  p_source text default null,
  p_ip_hash text default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_inbox text;
  v_source text := nullif(left(regexp_replace(coalesce(p_source, ''), '[^a-z0-9:_-]', '', 'g'), 64), '');
  v_ip text := nullif(left(coalesce(p_ip_hash, ''), 64), '');
  v_row public.newsletter_subscribers%rowtype;
  v_member boolean;
  v_member_off boolean;
  v_token text;
  v_kind text;
begin
  -- No spaces, angle brackets, quotes, commas, semicolons, colons, square
  -- brackets or backslashes anywhere; one @; a domain of at least two
  -- dot-separated parts. International and punycode domains pass.
  if length(v_email) > 254
     or v_email !~ '^[^][[:space:]@<>"(),;:\\]+@[^][[:space:]@<>"(),;:\\.]+(\.[^][[:space:]@<>"(),;:\\.]+)+$' then
    return jsonb_build_object('status', 'bad-email');
  end if;
  v_inbox := public.email_inbox_key(v_email);

  -- One request per inbox at a time, so two quick submits make one link.
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes_signup:' || v_inbox, 0));

  -- The limits first, for every kind of address, so the replies cannot
  -- tell a quiet address from any other.
  if (select count(*) from public.weekly_notes_signup_sends s
       where s.inbox_key = v_inbox and s.created_at > p_now - interval '24 hours') >= 2 then
    return jsonb_build_object('status', 'address-limit');
  end if;
  if v_ip is not null and (select count(*) from public.weekly_notes_signup_sends s
       where s.ip_hash = v_ip and s.created_at > p_now - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'network-limit');
  end if;

  -- Changed from 20261018150200: a member is an inbox with an account that
  -- can sign in, whichever spelling was typed, so one inbox never gets a
  -- visitor series beside the member one. "Off" means one of those
  -- accounts turned all email off.
  select coalesce(bool_or(true), false),
         coalesce(bool_or(not exists (select 1 from public.profiles p
                                       where lower(p.email) = lower(u.email)
                                         and p.email_notifications_enabled is true)), false)
    into v_member, v_member_off
    from auth.users u
   where public.email_inbox_key(u.email) = v_inbox
     and u.email_confirmed_at is not null
     and u.deleted_at is null;

  -- Nothing at all for a suppressed inbox (email_inbox_suppressed), or for
  -- the inbox of a member who turned all email off. Logged like any other
  -- request, so the limits treat it the same.
  if public.email_inbox_suppressed(v_email) or v_member_off then
    v_kind := 'quiet';
  else
    select * into v_row from public.newsletter_subscribers n where n.email = v_email for update;

    if v_member then
      v_kind := 'member';
    -- Changed from 20261018150200: signed up and confirmed under any
    -- spelling of the inbox, and not stopped since.
    elsif exists (select 1 from public.newsletter_subscribers n
                   where public.email_inbox_key(n.email) = v_inbox
                     and n.weekly_notes_requested_at is not null
                     and n.confirmed_at >= n.weekly_notes_requested_at
                     and n.unsubscribed_at is null) then
      v_kind := 'already';
    else
      v_kind := 'confirm';
      v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
      if v_row.id is null then
        insert into public.newsletter_subscribers as n
          (email, source, consent_marketing, weekly_notes_requested_at, weekly_notes_source,
           confirm_token_hash, confirm_sent_at, created_at, updated_at)
        values
          (v_email, 'notes:' || coalesce(v_source, 'form'), true, p_now, v_source,
           encode(extensions.digest(v_token, 'sha256'), 'hex'), p_now, p_now, p_now)
        on conflict (email) do update
          set weekly_notes_requested_at = coalesce(n.weekly_notes_requested_at, excluded.weekly_notes_requested_at),
              weekly_notes_source = coalesce(n.weekly_notes_source, excluded.weekly_notes_source),
              confirmed_at = case when n.weekly_notes_requested_at is null then null else n.confirmed_at end,
              confirm_token_hash = excluded.confirm_token_hash,
              confirm_sent_at = excluded.confirm_sent_at,
              updated_at = excluded.updated_at;
      else
        -- An existing row (the guide form's, an unconfirmed request, or an
        -- unsubscribe) keeps its consent and its unsubscribe: only the new
        -- link, once clicked, changes those. Its first notes request also
        -- clears any older confirmation, so only that click confirms.
        update public.newsletter_subscribers
           set confirmed_at = case when weekly_notes_requested_at is null then null else confirmed_at end,
               weekly_notes_requested_at = coalesce(weekly_notes_requested_at, p_now),
               weekly_notes_source = coalesce(weekly_notes_source, v_source),
               confirm_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
               confirm_sent_at = p_now,
               updated_at = p_now
         where id = v_row.id;
      end if;
    end if;
  end if;

  -- Logged before the email goes, so a quick second request already counts it.
  insert into public.weekly_notes_signup_sends (email, inbox_key, ip_hash, kind, created_at)
  values (v_email, v_inbox, v_ip, v_kind, p_now);

  if v_kind = 'confirm' then
    return jsonb_build_object('status', v_kind, 'token', v_token);
  end if;
  return jsonb_build_object('status', v_kind);
end;
$function$;

revoke all on function public.request_weekly_notes_signup(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.request_weekly_notes_signup(text, text, text, timestamptz) to service_role;

comment on function public.request_weekly_notes_signup(text, text, text, timestamptz) is
  'The Weekly Gecko Notes visitor form''s database step (subscribe-weekly-notes): the limits first (2 requests per inbox a day, plus tags and Gmail dots counted as one inbox; 10 per network an hour); then quiet (send nothing) for a suppressed inbox (email_inbox_suppressed) or the inbox of a member with all email off; otherwise {status: member} for an inbox with an account that can sign in, {status: already} for an inbox signed up and confirmed under any spelling, or {status: confirm, token} with a new confirmation link. Logs every request, quiet included. Service role only.';

-- 4. The confirm button: the same member and "already" rules ------------------------------------------
--
-- The 20261018150000 body with the member check by inbox and one check
-- added (marked).

create or replace function public.confirm_weekly_notes_signup_at(p_token text, p_now timestamptz)
returns text
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_row public.newsletter_subscribers%rowtype;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    return 'invalid';
  end if;
  select * into v_row
    from public.newsletter_subscribers n
   where n.confirm_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;
  if not found or v_row.weekly_notes_requested_at is null then
    return 'invalid';
  end if;
  if v_row.confirm_sent_at is null or v_row.confirm_sent_at < p_now - interval '7 days' then
    return 'expired';
  end if;
  -- Changed from 20261018150000: any spelling of the inbox.
  if exists (select 1 from auth.users u
              where public.email_inbox_key(u.email) = public.email_inbox_key(v_row.email)
                and u.email_confirmed_at is not null
                and u.deleted_at is null) then
    return 'member';
  end if;
  if v_row.confirmed_at is not null and v_row.unsubscribed_at is null then
    return 'already';
  end if;
  -- Added: another spelling of the inbox already gets the notes, so this
  -- one does not start a second series.
  if exists (select 1 from public.newsletter_subscribers n
              where public.email_inbox_key(n.email) = public.email_inbox_key(v_row.email)
                and n.id <> v_row.id
                and n.weekly_notes_requested_at is not null
                and n.confirmed_at >= n.weekly_notes_requested_at
                and n.unsubscribed_at is null) then
    return 'already';
  end if;
  update public.newsletter_subscribers
     set confirmed_at = p_now,
         unsubscribed_at = null,
         consent_marketing = true,
         updated_at = p_now
   where id = v_row.id;
  return 'confirmed';
end;
$function$;

revoke all on function public.confirm_weekly_notes_signup_at(text, timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_weekly_notes_signup_at(text, timestamptz) to service_role;

comment on function public.confirm_weekly_notes_signup_at(text, timestamptz) is
  'The confirmation step at a given time (confirm_weekly_notes_signup passes the database''s clock; tests pass their own). Returns confirmed, already (this row, or another spelling of the inbox, already gets the notes), member (an account that can sign in has this inbox), expired (7 days) or invalid. Service role only.';

-- 1, 3, 4. Visitor candidates --------------------------------------------------------------------------
--
-- The 20261018150200 body with the member and stop clauses changed (marked).

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
  select s.email, w.polled_at as last_polled_at
    from public.newsletter_subscribers s
    left join public.weekly_notes_polls w on w.email = s.email
   where s.weekly_notes_requested_at is not null
     and s.confirmed_at is not null
     -- Only a click on a link sent for this request confirms it.
     and s.confirmed_at >= s.weekly_notes_requested_at
     and s.unsubscribed_at is null
     and s.email = lower(s.email)
     -- Members get the notes through the member rules and their own switch.
     -- Changed from 20261018150200: any spelling of the inbox.
     and not exists (select 1 from auth.users u
                      where public.email_inbox_key(u.email) = public.email_inbox_key(s.email)
                        and u.email_confirmed_at is not null
                        and u.deleted_at is null)
     and not public.email_inbox_suppressed(s.email)
     -- Changed: a stop on another spelling of the inbox, newer than this
     -- row's confirmation, holds here too.
     and public.weekly_notes_visitor_stop_at(s.email) is null
     and not exists (
           select 1 from public.weekly_notes_sends n
            where n.email = s.email
              and n.created_date > p_now - interval '7 days'
         )
     and (p_ignore_polls
          or w.polled_at is null
          or w.polled_at <= p_now - interval '20 hours');
$function$;

revoke all on function public.weekly_notes_subscriber_candidates(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.weekly_notes_subscriber_candidates(timestamptz, boolean) to service_role;

comment on function public.weekly_notes_subscriber_candidates(timestamptz, boolean) is
  'Visitor addresses that may get a Weekly Gecko Note at p_now: asked on the form, confirmed by a click after the request, not unsubscribed, no account that can sign in on any spelling of the inbox (members follow the member rules), not suppressed (email_inbox_suppressed), no newer stop on another spelling (weekly_notes_visitor_stop_at), no note in 7 days and (unless p_ignore_polls) not asked about in 20 hours. Read-only; service role only.';

-- 6. The daily cleanup also clears the guide form's send log -------------------------------------------
--
-- The 20261018150100 body with one delete added (marked).

create or replace function public.weekly_notes_visitor_cleanup(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
  v_rows integer;
begin
  -- A request nobody confirmed within 30 days of the newest link is
  -- dropped with that link.
  update public.newsletter_subscribers
     set weekly_notes_requested_at = null,
         weekly_notes_source = null,
         confirm_token_hash = null,
         confirm_sent_at = null,
         updated_at = p_now
   where confirmed_at is null
     and weekly_notes_requested_at is not null
     and coalesce(confirm_sent_at, weekly_notes_requested_at) < p_now - interval '30 days';
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- A link nobody pressed within 30 days on a row confirmed before (a
  -- visitor who stopped and asked again) goes too; the earlier sign-up
  -- and the stop stay.
  update public.newsletter_subscribers
     set confirm_token_hash = null,
         confirm_sent_at = null,
         updated_at = p_now
   where confirm_token_hash is not null
     and confirm_sent_at < p_now - interval '30 days';
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- A row the notes form made, with nothing left on it, goes.
  delete from public.newsletter_subscribers
   where source like 'notes:%'
     and confirmed_at is null
     and weekly_notes_requested_at is null
     and unsubscribed_at is null;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  delete from public.weekly_notes_signup_sends where created_at < p_now - interval '30 days';
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Added in 20261018150300: the homepage guide form's send log, which its
  -- limits read for one day at most, is kept 30 days like this form's.
  delete from public.guide_email_sends where created_at < p_now - interval '30 days';
  get diagnostics v_rows = row_count;
  return v_count + v_rows;
end;
$function$;

revoke all on function public.weekly_notes_visitor_cleanup(timestamptz) from public, anon, authenticated;
grant execute on function public.weekly_notes_visitor_cleanup(timestamptz) to service_role;

comment on function public.weekly_notes_visitor_cleanup(timestamptz) is
  'Daily (weekly-notes-visitor-cleanup): drops Weekly Gecko Notes visitor requests nobody confirmed within 30 days of the newest link, drops any confirmation link nobody pressed in 30 days, deletes rows the notes form made that have nothing left on them, and deletes send-log rows older than 30 days from this form and from the homepage guide form (guide_email_sends). Returns how many rows it changed.';

-- 5. Erasing a visitor: every spelling of the inbox in the form's log -------------------------------------
--
-- The 20261018150000 body with one delete changed (marked).

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
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    -- An account: admin_erase_account erases everything, these rows included.
    return jsonb_build_object('erased', false, 'reason', 'has-account');
  end if;
  delete from public.newsletter_subscribers where lower(email) = v_email;
  get diagnostics v_subscribers = row_count;
  delete from public.weekly_notes_sends where email = v_email;
  get diagnostics v_sends = row_count;
  delete from public.weekly_notes_polls where email = v_email;
  get diagnostics v_polls = row_count;
  -- Changed from 20261018150000: every spelling of the inbox, as the form
  -- logs it.
  delete from public.weekly_notes_signup_sends
   where email = v_email or inbox_key = public.email_inbox_key(v_email);
  get diagnostics v_log = row_count;
  delete from public.guide_email_sends where lower(email) = v_email;
  -- As account erasure does: the address and its details leave the
  -- delivery log; the anonymous counts stay. email_suppressions is kept on
  -- purpose (an address that bounced or complained is never mailed again).
  update public.email_deliveries x
     set email = null,
         detail = '{}'::jsonb
   where lower(x.email) = v_email;
  get diagnostics v_deliveries = row_count;
  return jsonb_build_object('erased', true, 'subscribers', v_subscribers, 'notes', v_sends,
                            'polls', v_polls, 'form_emails', v_log, 'deliveries', v_deliveries);
end;
$function$;

revoke all on function public.admin_erase_weekly_notes_visitor(text) from public, anon, authenticated;
grant execute on function public.admin_erase_weekly_notes_visitor(text) to service_role;

comment on function public.admin_erase_weekly_notes_visitor(text) is
  'Erases one visitor address (no account) on request: its newsletter_subscribers row, Weekly Gecko Notes ledger and poll rows, form send log (every spelling of the inbox) and guide send log, and scrubs it from the email delivery log. Keeps email_suppressions on purpose. Service role or the SQL console only. An address with an account is refused: use admin_erase_account.';

-- 1, 2. One-time data fix --------------------------------------------------------------------------------
--
-- A profile whose inbox has a counted visitor stop and no choice recorded
-- gets the stop as its choice now (off, dated now: the stamp trigger puts
-- the database clock on every choice written), before a first sign-in can
-- save the sign-up box over it.

update public.profiles p
   set email_weekly_notes_enabled = false,
       email_weekly_notes_choice_at = now()
 where p.email_weekly_notes_choice_at is null
   and p.email is not null
   and public.weekly_notes_visitor_stop_at(p.email) is not null;

-- 5. Account erasure: every spelling of the inbox in the form's log ----------------------------------------
--
-- The full body from 20261018150000_weekly_notes_visitor_fixes.sql with one
-- line changed: the member's weekly_notes_signup_sends rows go by inbox key
-- as well as by address. Everything else is unchanged.

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
  delete from public.newsletter_subscribers x where lower(x.email) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.guide_email_sends x where lower(x.email) = v_email;
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
   where lower(x.email) = v_email;
  delete from public.lifecycle_email_sends x where x.email = v_email;
  delete from public.weekly_notes_sends x where x.email = v_email;
  delete from public.weekly_notes_polls x where x.email = v_email;
  -- Every spelling of the member's inbox (plus tags, Gmail dots), as the
  -- form logs it (20261018150300).
  delete from public.weekly_notes_signup_sends x where x.email = v_email or x.inbox_key = public.email_inbox_key(v_email);
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
