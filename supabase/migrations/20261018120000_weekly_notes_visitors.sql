-- Weekly Gecko Notes for visitors without an account (18 Oct 2026): a sign-up
-- form on the public guide pages, a confirmation email, then the same weekly
-- notes members get. docs/planning/weekly-notes-2026-10.md, section 9, has
-- the design.
--
-- Additive and safe to run more than once: add column if not exists, create
-- if not exists, create or replace, drop policy if exists, and cron.schedule
-- with fixed job names (which replaces the schedule).
--
-- What it does, in plain words:
--
-- 1. Closes newsletter_subscribers to the public API. Until now anyone could
--    insert any row with the anon key (policy anyone_can_subscribe), which
--    would let a script put a stranger's address on the list already
--    "confirmed". Every write now goes through the service role (the
--    subscribe-and-send-guides and subscribe-weekly-notes functions) or the
--    database functions below. Admins can read it. No app code wrote to the
--    table directly.
--
-- 2. Adds the visitor sign-up to newsletter_subscribers:
--      weekly_notes_requested_at  when the address asked for the notes
--      weekly_notes_source        the page the form was on
--      confirm_token_hash         sha256 of the one confirmation link that
--                                 is live; the link itself is never stored
--      confirm_sent_at            when that link was sent (it lasts 7 days)
--    A visitor gets notes only once confirmed_at is set, which only the
--    confirmation link does. Rows from the homepage guide form have no
--    request and never get notes.
--
-- 3. public.weekly_notes_signup_sends: one row per email the form sends
--    (confirmation, "you already get them", "you have an account"), with a
--    keyed hash of the network, for the rate limits. Kept 30 days.
--
-- 4. request_weekly_notes_signup(): the form's database step, called by the
--    subscribe-weekly-notes function. It applies the rate limits, decides
--    which email to send and, for a confirmation, makes the link.
--    confirm_weekly_notes_signup(): the button on /WeeklyNotes?t=...
--
-- 5. The stop link: weekly_notes_subscriber_token() signs one per address
--    (the same Vault secret as members' links, with its own prefix inside
--    the signature, so a visitor's link can never act on a member and the
--    other way round). unsubscribe_weekly_notes_subscriber() is what the
--    /Unsubscribe page and the mail app's one-click button call.
--
-- 6. weekly_notes_subscriber_candidates() and claim_weekly_note_subscriber():
--    the visitor copies of the member rules. A visitor is never one of the
--    members: an address with a sign-in account gets the notes through the
--    member rules and its own Settings switch, never this way. The ledger
--    (weekly_notes_sends, unique on address and note) and the poll table are
--    shared, so a visitor who later makes an account carries on where they
--    were and never gets a note twice. Both claims take the same lock.
--
-- 7. enqueue_weekly_notes() asks about visitors too, after members, within
--    the same limit per run, with weekly.audience = 'visitor'. A send-email
--    older than this change treats that call as a member it cannot find
--    and skips it, with nothing claimed, so the deploy order does not
--    matter.
--
-- 8. weekly_notes_visitor_cleanup(), daily: a confirmation link nobody used
--    in 30 days is dropped with the request, a row made only for it is
--    deleted, and the send log keeps 30 days.
--
-- 9. admin_erase_weekly_notes_visitor(): erases one visitor address on
--    request (they have no account for admin_erase_account to find). Run
--    it in the SQL console: select public.admin_erase_weekly_notes_visitor('name@example.com');
--
-- Every function ends with an explicit revoke and grant: since
-- 20261015130000 the default privileges no longer grant EXECUTE
-- (supabase/SCHEMA_CONVENTIONS.md, 4a).

-- 1. Close the table to the public API ---------------------------------------

drop policy if exists anyone_can_subscribe on public.newsletter_subscribers;
drop policy if exists no_select_for_users on public.newsletter_subscribers;
drop policy if exists newsletter_subscribers_admin_read on public.newsletter_subscribers;

alter table public.newsletter_subscribers enable row level security;

create policy newsletter_subscribers_admin_read on public.newsletter_subscribers
  for select to authenticated
  using (public.is_admin());

revoke all on table public.newsletter_subscribers from public, anon, authenticated;
grant select on table public.newsletter_subscribers to authenticated;
grant all on table public.newsletter_subscribers to service_role;

-- 2. The visitor sign-up columns ------------------------------------------------

alter table public.newsletter_subscribers
  add column if not exists weekly_notes_requested_at timestamptz,
  add column if not exists weekly_notes_source text,
  add column if not exists confirm_token_hash text,
  add column if not exists confirm_sent_at timestamptz;

create unique index if not exists newsletter_subscribers_confirm_token_idx
  on public.newsletter_subscribers (confirm_token_hash)
  where confirm_token_hash is not null;

create index if not exists newsletter_subscribers_weekly_notes_idx
  on public.newsletter_subscribers (email)
  where weekly_notes_requested_at is not null and confirmed_at is not null and unsubscribed_at is null;

comment on column public.newsletter_subscribers.weekly_notes_requested_at is
  'When this address asked for Weekly Gecko Notes on the visitor form (subscribe-weekly-notes). Notes go only once confirmed_at is set too, and stop at unsubscribed_at. Rows from the homepage guide form have none.';
comment on column public.newsletter_subscribers.weekly_notes_source is
  'The page the Weekly Gecko Notes form was on when this address asked, for example notes:morph-detail.';
comment on column public.newsletter_subscribers.confirm_token_hash is
  'sha256 (hex) of the one live confirmation link for this address. The link itself is never stored. Replaced by each new request, cleared by unsubscribing and by the 30-day cleanup.';
comment on column public.newsletter_subscribers.confirm_sent_at is
  'When the live confirmation link was sent. It works for 7 days.';

-- 3. The form's send log, for the rate limits -------------------------------------

create table if not exists public.weekly_notes_signup_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  ip_hash text,
  kind text not null check (kind in ('confirm', 'already', 'member')),
  created_at timestamptz not null default now()
);

create index if not exists weekly_notes_signup_sends_email_idx
  on public.weekly_notes_signup_sends (email, created_at desc);
create index if not exists weekly_notes_signup_sends_ip_idx
  on public.weekly_notes_signup_sends (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.weekly_notes_signup_sends enable row level security;

drop policy if exists weekly_notes_signup_sends_admin_read on public.weekly_notes_signup_sends;
create policy weekly_notes_signup_sends_admin_read on public.weekly_notes_signup_sends
  for select to authenticated
  using (public.is_admin());

revoke all on table public.weekly_notes_signup_sends from public, anon, authenticated;
grant select on table public.weekly_notes_signup_sends to authenticated;
grant all on table public.weekly_notes_signup_sends to service_role;

comment on table public.weekly_notes_signup_sends is
  'One row per email the Weekly Gecko Notes visitor form sent (kind confirm, already or member), with a keyed hash of the sender''s network. Read by request_weekly_notes_signup for the rate limits; rows older than 30 days are deleted daily.';

-- 4. The form's database step -----------------------------------------------------
--
-- Returns {status} and, for a confirmation, {token}: the link's secret part,
-- which only the caller sees and only its hash is kept.
--   confirm        send the confirmation email with the token
--   already        the address already gets the notes: say so
--   member         the address has a sign-in account: point to Settings
--   address-limit  this address had 2 emails from the form in 24 hours
--   network-limit  this network had 10 in the last hour
--   bad-email      not an address
-- Nothing is written for the last three. An unsubscribed address can sign
-- up again, because only a click on the new link turns the notes back on.

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
  v_source text := nullif(left(regexp_replace(coalesce(p_source, ''), '[^a-z0-9:_-]', '', 'g'), 64), '');
  v_ip text := nullif(left(coalesce(p_ip_hash, ''), 64), '');
  v_row public.newsletter_subscribers%rowtype;
  v_token text;
  v_kind text;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then
    return jsonb_build_object('status', 'bad-email');
  end if;

  -- One request per address at a time, so two quick submits make one link.
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes_signup:' || v_email, 0));

  if (select count(*) from public.weekly_notes_signup_sends s
       where s.email = v_email and s.created_at > p_now - interval '24 hours') >= 2 then
    return jsonb_build_object('status', 'address-limit');
  end if;
  if v_ip is not null and (select count(*) from public.weekly_notes_signup_sends s
       where s.ip_hash = v_ip and s.created_at > p_now - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'network-limit');
  end if;

  select * into v_row from public.newsletter_subscribers n where n.email = v_email for update;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
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
            confirm_token_hash = excluded.confirm_token_hash,
            confirm_sent_at = excluded.confirm_sent_at,
            updated_at = excluded.updated_at;
    else
      -- An existing row (the guide form's, an unconfirmed request, or an
      -- unsubscribe) keeps its consent and its unsubscribe: only the new
      -- link, once clicked, changes those.
      update public.newsletter_subscribers
         set weekly_notes_requested_at = coalesce(weekly_notes_requested_at, p_now),
             weekly_notes_source = coalesce(weekly_notes_source, v_source),
             confirm_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
             confirm_sent_at = p_now,
             updated_at = p_now
       where id = v_row.id;
    end if;
  end if;

  -- Logged before the email goes, so a quick second request already counts it.
  insert into public.weekly_notes_signup_sends (email, ip_hash, kind, created_at)
  values (v_email, v_ip, v_kind, p_now);

  if v_kind = 'confirm' then
    return jsonb_build_object('status', v_kind, 'token', v_token);
  end if;
  return jsonb_build_object('status', v_kind);
end;
$function$;

revoke all on function public.request_weekly_notes_signup(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.request_weekly_notes_signup(text, text, text, timestamptz) to service_role;

comment on function public.request_weekly_notes_signup(text, text, text, timestamptz) is
  'The Weekly Gecko Notes visitor form''s database step (subscribe-weekly-notes): rate limits (2 emails per address a day, 10 per network an hour), then {status: confirm, token} with a new confirmation link, {status: already}, or {status: member} for an address with a sign-in account. Logs every email it asks for. Service role only.';

-- The confirmation button. Returns confirmed, already, member, expired or
-- invalid. A link works for 7 days and only the latest one sent works.
-- Pressing it turns the notes on (clearing an earlier unsubscribe, since
-- the owner of the address just asked again).

create or replace function public.confirm_weekly_notes_signup(p_token text, p_now timestamptz default now())
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
  if exists (select 1 from auth.users u where lower(u.email) = v_row.email) then
    return 'member';
  end if;
  if v_row.confirmed_at is not null and v_row.unsubscribed_at is null then
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

revoke all on function public.confirm_weekly_notes_signup(text, timestamptz) from public;
grant execute on function public.confirm_weekly_notes_signup(text, timestamptz) to anon, authenticated, service_role;

comment on function public.confirm_weekly_notes_signup(text, timestamptz) is
  'The Confirm button on /WeeklyNotes?t=...: turns Weekly Gecko Notes on for the visitor address whose latest confirmation link this is (7 days). Returns confirmed, already, member, expired or invalid. Works signed out: the link is the proof.';

-- 5. The visitor's stop link -------------------------------------------------------

create or replace function public.weekly_notes_subscriber_token(p_email text)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_id uuid;
  v_secret text;
begin
  select n.id into v_id from public.newsletter_subscribers n where n.email = lower(trim(coalesce(p_email, '')));
  if v_id is null then
    return null;
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'email_unsubscribe_secret'
   limit 1;
  if v_secret is null then
    return null;
  end if;
  return v_id::text || '.' ||
    encode(extensions.hmac('weekly-notes-visitor:' || v_id::text, v_secret, 'sha256'), 'hex');
end;
$function$;

revoke all on function public.weekly_notes_subscriber_token(text) from public, anon, authenticated;
grant execute on function public.weekly_notes_subscriber_token(text) to service_role;

comment on function public.weekly_notes_subscriber_token(text) is
  'The signed stop link for a Weekly Gecko Notes visitor address (newsletter_subscribers id plus an HMAC with its own prefix, so it can never pass as a member''s token). Service role only (send-email).';

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
   where id = v_id::uuid;
  return found;
end;
$function$;

revoke all on function public.unsubscribe_weekly_notes_subscriber(text) from public;
grant execute on function public.unsubscribe_weekly_notes_subscriber(text) to anon, authenticated, service_role;

comment on function public.unsubscribe_weekly_notes_subscriber(text) is
  'The stop link in a visitor''s Weekly Gecko Note (/Unsubscribe?scope=visitor and the one-click header): checks the signature and stops every email to that visitor address. Also kills any live confirmation link. Works signed out.';

-- 6. Who may get a note, and the claim ------------------------------------------

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
     and s.unsubscribed_at is null
     and s.email = lower(s.email)
     -- Members get the notes through the member rules and their own switch.
     and not exists (select 1 from auth.users u where lower(u.email) = s.email)
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
  'Visitor addresses that may get a Weekly Gecko Note at p_now: asked on the form, confirmed, not unsubscribed, no sign-in account (members follow the member rules), not suppressed, no note in 7 days and (unless p_ignore_polls) not asked about in 20 hours. Read-only; service role only.';

create or replace function public.claim_weekly_note_subscriber(
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

  -- The same lock as claim_weekly_note, so a member claim and a visitor
  -- claim for one address can never both pass the 7-day rule.
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes:' || v_email, 0));

  if not exists (
    select 1 from public.weekly_notes_subscriber_candidates(p_now, true) c where c.email = v_email
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

revoke all on function public.claim_weekly_note_subscriber(text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.claim_weekly_note_subscriber(text, text[], timestamptz) to service_role;

comment on function public.claim_weekly_note_subscriber(text, text[], timestamptz) is
  'Claims the next Weekly Gecko Note for one visitor address: the visitor rules again under the same per-address lock as claim_weekly_note, the first slug in p_slugs (the visitor order) the address has not had, and the shared ledger row. Returns {slug, step} or {reason}. Service role only (send-email).';

-- 7. The hourly job asks about visitors too ---------------------------------------
--
-- The member half is unchanged. Visitors come after members, in the same
-- limit per run, oldest poll first.

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
      where w.polled_at <= p_now - interval '20 hours';
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
  'Hourly Weekly Gecko Notes job (weekly-notes-hourly): while app_settings weekly_notes_enabled is true, asks send-email about up to p_limit addresses, members first and then confirmed visitors (weekly.audience visitor), oldest poll first, each at most once in 20 hours. send-email claims and sends. Returns how many it asked about.';

-- 8. The daily cleanup ----------------------------------------------------------------

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
  -- A request nobody confirmed in 30 days is dropped with its link.
  update public.newsletter_subscribers
     set weekly_notes_requested_at = null,
         weekly_notes_source = null,
         confirm_token_hash = null,
         confirm_sent_at = null,
         updated_at = p_now
   where confirmed_at is null
     and weekly_notes_requested_at is not null
     and weekly_notes_requested_at < p_now - interval '30 days';
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
  'Daily (weekly-notes-visitor-cleanup): drops Weekly Gecko Notes visitor requests nobody confirmed in 30 days, deletes rows the notes form made that have nothing left on them, and deletes form send-log rows older than 30 days. Returns how many rows it changed.';

select cron.schedule('weekly-notes-visitor-cleanup', '25 4 * * *', $$ select public.weekly_notes_visitor_cleanup(); $$);

-- 9. Erasing a visitor on request ----------------------------------------------------

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
  delete from public.weekly_notes_signup_sends where email = v_email;
  get diagnostics v_log = row_count;
  delete from public.guide_email_sends where lower(email) = v_email;
  return jsonb_build_object('erased', true, 'subscribers', v_subscribers, 'notes', v_sends,
                            'polls', v_polls, 'form_emails', v_log);
end;
$function$;

revoke all on function public.admin_erase_weekly_notes_visitor(text) from public, anon, authenticated;
grant execute on function public.admin_erase_weekly_notes_visitor(text) to service_role;

comment on function public.admin_erase_weekly_notes_visitor(text) is
  'Erases one visitor address (no account) on request: its newsletter_subscribers row, Weekly Gecko Notes ledger and poll rows, form send log and guide send log. Service role or the SQL console only. An address with an account is refused: use admin_erase_account.';
