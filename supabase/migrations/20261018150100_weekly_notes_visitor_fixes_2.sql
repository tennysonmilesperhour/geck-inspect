-- Weekly Gecko Notes for visitors: the second round of review fixes
-- (18 Oct 2026; docs/planning/weekly-notes-2026-10.md, section 9). A second
-- independent check of 20261018150000 found these. Safe to run more than
-- once: create or replace, drop/add of a named constraint, drop trigger if
-- exists, and one-time data fixes that change nothing on a second run.
--
-- Numbered 150100 because 20261018150000 (dated ahead of its time by
-- mistake) is already applied; a file must sort after the newest applied
-- one (docs/MIGRATIONS.md).
--
-- What it fixes, in plain words:
--
-- 1. A visitor's stop beats the sign-up box. Someone who stopped the notes
--    as a visitor and later makes an account starts with the notes off and
--    no choice recorded, whether or not the sign-up box was ticked (it is
--    ticked by default outside the EEA and the UK, so leaving it is not a
--    new choice). Settings then shows them off, and turning them on there
--    is the member's own newer choice. A trigger on new profile rows does
--    this (weekly_notes_visitor_stop_on_new_profile).
--
-- 2. The member rule only counts a stop from a row that asked for the
--    notes, and stop dates in the future (possible only through the old
--    public insert policy) are set to now, so an odd row can never block a
--    member for good. (Restated weekly_notes_candidates: the 20261018150000
--    body with that clause changed.)
--
-- 3. The form's limits come before the quiet rule, and a quiet request is
--    logged (kind quiet) and counted like any other, so its replies match
--    an ordinary address's. The quiet rule checks the inbox (plus tags and
--    Gmail dots) against the suppression list, and only treats an address
--    as a member with email off when it has an account that can sign in
--    (an imported profile with no login can still sign up as a visitor).
--
-- 4. The address rule accepts international domains and punycode again,
--    while still refusing angle brackets, quotes, commas, spaces and the
--    like.
--
-- 5. A confirmation dated before the request is not trusted: such rows are
--    cleared, and visitor candidates need confirmed_at on or after the
--    request.
--
-- 6. The cleanup also drops a confirmation link nobody pressed in 30 days
--    on a row that was confirmed before (a visitor who stopped and asked
--    again).

-- 3. A quiet request is logged ---------------------------------------------------

alter table public.weekly_notes_signup_sends drop constraint if exists weekly_notes_signup_sends_kind_check;
alter table public.weekly_notes_signup_sends
  add constraint weekly_notes_signup_sends_kind_check check (kind in ('confirm', 'already', 'member', 'quiet'));

comment on column public.weekly_notes_signup_sends.kind is
  'What the form did: confirm, already or member (one email sent), or quiet (nothing sent: the address is suppressed or a member turned all email off). Every kind counts toward the limits, so a quiet address answers like any other.';

-- 2, 5. One-time data fixes -----------------------------------------------------------

update public.newsletter_subscribers
   set confirmed_at = null, updated_at = now()
 where confirmed_at is not null
   and (weekly_notes_requested_at is null or confirmed_at < weekly_notes_requested_at);

update public.newsletter_subscribers
   set unsubscribed_at = now(), updated_at = now()
 where unsubscribed_at > now();

-- 3, 4. The form's database step ----------------------------------------------------------

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

  v_member := exists (select 1 from auth.users u
                       where lower(u.email) = v_email
                         and u.email_confirmed_at is not null
                         and u.deleted_at is null);

  -- Nothing at all for an inbox that bounced or marked our email as spam,
  -- or for a member (an account that can sign in) who turned all email
  -- off. Logged like any other request, so the limits treat it the same.
  if exists (select 1 from public.email_suppressions x where public.email_inbox_key(x.email) = v_inbox)
     or (v_member and not exists (select 1 from public.profiles p
                                   where lower(p.email) = v_email and p.email_notifications_enabled is true)) then
    v_kind := 'quiet';
  else
    select * into v_row from public.newsletter_subscribers n where n.email = v_email for update;

    if v_member then
      v_kind := 'member';
    elsif v_row.id is not null
          and v_row.weekly_notes_requested_at is not null
          and v_row.confirmed_at is not null
          and v_row.unsubscribed_at is null then
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
  'The Weekly Gecko Notes visitor form''s database step (subscribe-weekly-notes): the limits first (2 requests per inbox a day, plus tags and Gmail dots counted as one inbox; 10 per network an hour); then quiet (send nothing) for a suppressed inbox or a member with all email off; otherwise {status: confirm, token} with a new confirmation link, {status: already}, or {status: member} for an address with an account that can sign in. Logs every request, quiet included. Service role only.';

-- 1. A visitor's stop beats the sign-up box ------------------------------------------------

create or replace function public.weekly_notes_visitor_stop_on_new_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.email is not null and exists (
    select 1 from public.newsletter_subscribers s
     where s.email = lower(new.email)
       and s.weekly_notes_requested_at is not null
       and s.unsubscribed_at is not null
  ) then
    new.email_weekly_notes_enabled := false;
    new.email_weekly_notes_choice_at := null;
  end if;
  return new;
end;
$function$;

revoke all on function public.weekly_notes_visitor_stop_on_new_profile() from public, anon, authenticated;

comment on function public.weekly_notes_visitor_stop_on_new_profile() is
  'Trigger: a new profile for an address that stopped Weekly Gecko Notes as a visitor starts with the notes off and no choice recorded, whatever the sign-up box said. Settings shows them off; turning them on there is the member''s newer choice. Runs after profiles_weekly_notes_stamp_choice (trigger names sort that way).';

drop trigger if exists profiles_weekly_notes_visitor_stop on public.profiles;
create trigger profiles_weekly_notes_visitor_stop
  before insert on public.profiles
  for each row execute function public.weekly_notes_visitor_stop_on_new_profile();

-- 5. Visitor candidates need a confirmation after the request ---------------------------------

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
     and not exists (select 1 from auth.users u
                      where lower(u.email) = s.email
                        and u.email_confirmed_at is not null
                        and u.deleted_at is null)
     and not exists (select 1 from public.email_suppressions x where x.email = s.email)
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
  'Visitor addresses that may get a Weekly Gecko Note at p_now: asked on the form, confirmed by a click after the request, not unsubscribed, no account that can sign in (members follow the member rules), not suppressed, no note in 7 days and (unless p_ignore_polls) not asked about in 20 hours. Read-only; service role only.';

-- 6. The cleanup also drops an unpressed link on a row confirmed before ----------------------

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
  return v_count + v_rows;
end;
$function$;

revoke all on function public.weekly_notes_visitor_cleanup(timestamptz) from public, anon, authenticated;
grant execute on function public.weekly_notes_visitor_cleanup(timestamptz) to service_role;

comment on function public.weekly_notes_visitor_cleanup(timestamptz) is
  'Daily (weekly-notes-visitor-cleanup): drops Weekly Gecko Notes visitor requests nobody confirmed within 30 days of the newest link, drops any confirmation link nobody pressed in 30 days, deletes rows the notes form made that have nothing left on them, and deletes form send-log rows older than 30 days. Returns how many rows it changed.';

-- 2. The member rules: only a real, past visitor stop counts ------------------------------------
--
-- The body from 20261018150000_weekly_notes_visitor_fixes.sql with the
-- visitor-stop clause narrowed (marked in the function).

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
     -- A stop from a visitor note holds for the address once it has an
     -- account, unless the member turned the notes on again afterwards
     -- (the Settings switch: email_weekly_notes_choice_at is newer). Only a
     -- row that asked for the notes counts, so a guide-form row can never
     -- block a member. (Stop dates in the future were set to now by this
     -- migration, and only database functions write the column now.)
     and not exists (
           select 1 from public.newsletter_subscribers s
            where s.email = m.email
              and s.weekly_notes_requested_at is not null
              and s.unsubscribed_at is not null
              and s.unsubscribed_at >= coalesce((
                    select max(p3.email_weekly_notes_choice_at) from public.profiles p3
                     where lower(p3.email) = m.email), '-infinity'::timestamptz)
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
  'Members who may get a Weekly Gecko Note at p_now: can sign in, account at least 16 days old, email and weekly switches on (the weekly one on every profile row for the address), not suppressed, no lifecycle email in 20 hours, no weekly note in 7 days, no stop from a visitor note newer than the member''s last choice, and (unless p_ignore_polls) not asked about in 20 hours. Read-only; service role only.';
