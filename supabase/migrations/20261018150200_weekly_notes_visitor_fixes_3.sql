-- Weekly Gecko Notes for visitors: the third round of review fixes
-- (18 Oct 2026; docs/planning/weekly-notes-2026-10.md, section 9). A third
-- independent check of 20261018150100 found these. Safe to run more than
-- once: create or replace, and one-time data fixes that change nothing on
-- a second run.
--
-- Numbered 150200 because 20261018150100 (dated ahead of its time, like
-- 150000) is already applied; a file must sort after the newest applied
-- one (docs/MIGRATIONS.md).
--
-- What it fixes, in plain words:
--
-- 1. A visitor's stop now really beats the sign-up box. The 150100 trigger
--    turned the notes off on the new profile but left no choice recorded,
--    and on the member's first sign-in weekly_notes_region_default reads
--    "no choice" as "the sign-up box is not saved yet" and saves it (ticked
--    by default outside the EEA and the UK), so the notes came back on. The
--    trigger now records the stop as the member's choice (off, dated when
--    they pressed stop), so the first sign-in finds a choice and changes
--    nothing. Turning the
--    notes on in Settings is still the member's own newer choice. A
--    profile the old trigger already left without a choice gets one now.
--
-- 2. The form's quiet rule matches the suppression list without silencing
--    a working address: an exact match, the address without its plus tag
--    (a bounce on jane@ also covers jane+notes@), and for Gmail every
--    spelling of the same inbox. A bounce on kim+notes@yahoo.com (Yahoo has
--    no plus addresses) no longer silences kim@yahoo.com. The visitor
--    candidates use the same match (email_inbox_suppressed).
--
-- 3. "A member who turned all email off" is matched by inbox too, so a
--    plus-tag or Gmail-dot spelling of that member's address gets nothing.
--
-- 4. A confirmation dated in the future (possible only through the old
--    public insert policy) is cleared, like one dated before the request.

-- 1, 4. One-time data fixes ---------------------------------------------------------------

update public.newsletter_subscribers
   set confirmed_at = null, updated_at = now()
 where confirmed_at > now();

-- A profile the 150100 trigger left off with no choice recorded gets a
-- choice now, before its first sign-in can save the sign-up box. It is
-- dated now (profiles_weekly_notes_stamp_choice puts the database clock on
-- every choice written), and the switch stays off. (A profile that existed
-- at the stop already has a choice: the stop link records one.)
update public.profiles p
   set email_weekly_notes_choice_at = now()
 where p.email_weekly_notes_choice_at is null
   and p.email_weekly_notes_enabled is false
   and exists (select 1 from public.newsletter_subscribers s
                where s.email = lower(p.email)
                  and s.weekly_notes_requested_at is not null
                  and s.unsubscribed_at is not null);

-- 2. The suppression match for visitor addresses ---------------------------------------------

create or replace function public.email_inbox_suppressed(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.email_suppressions x
     where x.email = v.e
        or x.email = v.k
        or (split_part(v.k, '@', 2) = 'gmail.com' and public.email_inbox_key(x.email) = v.k)
  )
  from (select lower(trim(coalesce(p_email, ''))) as e,
               public.email_inbox_key(p_email) as k) v;
$function$;

revoke all on function public.email_inbox_suppressed(text) from public, anon, authenticated;
grant execute on function public.email_inbox_suppressed(text) to service_role;

comment on function public.email_inbox_suppressed(text) is
  'True when the address, or the same address without its plus tag, is on email_suppressions; for Gmail, any spelling of the same inbox (dots, plus tags, googlemail.com). Used by the Weekly Gecko Notes visitor form and visitor candidates. A suppression on a plus-tag address never covers the plain one outside Gmail, because some providers refuse plus tags and bounce them.';

-- 2, 3. The form's database step --------------------------------------------------------------
--
-- The 20261018150100 body with the quiet rule changed (marked below).

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

  -- Nothing at all for a suppressed inbox (email_inbox_suppressed), or for
  -- an inbox that belongs to a member (an account that can sign in) who
  -- turned all email off, whichever spelling of it was typed. Logged like
  -- any other request, so the limits treat it the same.
  -- Changed from 20261018150100: both checks match by inbox, and the
  -- suppression match no longer lets a plus-tag bounce silence the plain
  -- address outside Gmail.
  if public.email_inbox_suppressed(v_email)
     or exists (select 1 from auth.users u
                 where public.email_inbox_key(u.email) = v_inbox
                   and u.email_confirmed_at is not null
                   and u.deleted_at is null
                   and not exists (select 1 from public.profiles p
                                    where lower(p.email) = lower(u.email)
                                      and p.email_notifications_enabled is true)) then
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
  'The Weekly Gecko Notes visitor form''s database step (subscribe-weekly-notes): the limits first (2 requests per inbox a day, plus tags and Gmail dots counted as one inbox; 10 per network an hour); then quiet (send nothing) for a suppressed inbox (email_inbox_suppressed) or the inbox of a member with all email off; otherwise {status: confirm, token} with a new confirmation link, {status: already}, or {status: member} for an address with an account that can sign in. Logs every request, quiet included. Service role only.';

-- 1. A visitor's stop beats the sign-up box, at the first sign-in too ------------------------------

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
    select s.unsubscribed_at into v_stop
      from public.newsletter_subscribers s
     where s.email = lower(new.email)
       and s.weekly_notes_requested_at is not null
       and s.unsubscribed_at is not null;
  end if;
  if v_stop is not null then
    -- The stop is recorded as the member's choice, dated when they pressed
    -- it, so weekly_notes_region_default finds a choice at the first
    -- sign-in and never saves the sign-up box over it, and the member rule
    -- in weekly_notes_candidates still needs a newer choice (the Settings
    -- switch) before notes go out.
    new.email_weekly_notes_enabled := false;
    new.email_weekly_notes_choice_at := v_stop;
  end if;
  return new;
end;
$function$;

revoke all on function public.weekly_notes_visitor_stop_on_new_profile() from public, anon, authenticated;

comment on function public.weekly_notes_visitor_stop_on_new_profile() is
  'Trigger: a new profile for an address that stopped Weekly Gecko Notes as a visitor starts with the notes off, recorded as the member''s choice dated at the stop, whatever the sign-up box said; the first sign-in then leaves it alone. Settings shows them off; turning them on there is the member''s newer choice. Runs after profiles_weekly_notes_stamp_choice (trigger names sort that way).';

-- 2. Visitor candidates use the same suppression match ---------------------------------------------
--
-- The 20261018150100 body with the suppression clause changed (marked).

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
     -- Changed from 20261018150100: the inbox match, not only the exact address.
     and not public.email_inbox_suppressed(s.email)
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
  'Visitor addresses that may get a Weekly Gecko Note at p_now: asked on the form, confirmed by a click after the request, not unsubscribed, no account that can sign in (members follow the member rules), not suppressed (email_inbox_suppressed), no note in 7 days and (unless p_ignore_polls) not asked about in 20 hours. Read-only; service role only.';
