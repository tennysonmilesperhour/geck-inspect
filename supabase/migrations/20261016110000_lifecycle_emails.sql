-- Lifecycle emails and the email delivery log (plan items E2 16 and 20,
-- comprehensive review of 14 Oct 2026). NOT APPLIED YET.
--
-- Additive only and safe to run more than once: create if not exists,
-- create or replace, on conflict do nothing, and cron.schedule with a
-- fixed job name replaces the schedule.
--
-- What it adds, in plain words:
--
-- 1. A master switch, app_settings 'lifecycle_emails_enabled', set to
--    false. Nothing in this file sends an email while it is false.
--    Tennyson approves the copy in docs/planning/lifecycle-emails-2026-10.md
--    and then turns it on with:
--      update public.app_settings set value = 'true'::jsonb
--       where key = 'lifecycle_emails_enabled';
--
-- 2. Five short emails in a new member's first two weeks, built from the
--    member's own records (the copy itself lives in send-email, so a
--    wording change is a function deploy, not a migration):
--      day0   welcome with one next step, always
--      day1   only when they still have no gecko
--      day3   lineage: add the parents, see the tree (needs a gecko)
--      day7   weigh-in nudge for their first gecko (needs a gecko)
--      day14  the same nudge a week later (needs a gecko)
--    The review counts day 7 and day 14 as one "weigh-in" email, which is
--    why the plan calls these four lifecycle emails.
--    lifecycle_email_sends is the ledger: one row per member per step,
--    unique, written before the email is handed to send-email, so a
--    second run (or two runs at once) can never send a step twice. At most
--    one lifecycle email per member in any 20 hours. Each step has a two
--    day window and is dropped once the window passes, so a member who
--    joined months ago never gets a "welcome", and turning the switch on
--    only reaches members from the last 16 days.
--    Who gets them: accounts that can sign in (an auth.users row with a
--    confirmed address, not deleted, not banned) whose profile has email
--    notifications on and whose address has not bounced or complained.
--    send-email then applies the per-type preference (announcements for
--    day 0, 1 and 3, care updates for day 7 and 14), the no-login check and
--    the unsubscribe links, exactly as for every other notification email.
--
-- 3. email_deliveries, the delivery log. send-email writes a 'sent' row
--    for every email it hands to Resend, and the new resend-webhook
--    function writes delivered, delivery_delayed, opened, clicked, bounced
--    and complained rows from Resend's webhooks. The service role writes;
--    admins read. email_delivery_stats sums it by email type and week for
--    the admin Funnel card.
--
-- 4. email_suppressions. A hard bounce or a spam complaint puts the
--    address here, and send-email stops sending it non-transactional mail
--    (notifications, digests, reminders, lifecycle). Sending again to an
--    address that bounced or complained is what gets a domain blocked.
--    An admin can delete a row to lift it.
--
-- Every function grants EXECUTE explicitly: since 20261015130000 the
-- default privileges no longer do (supabase/SCHEMA_CONVENTIONS.md, 4a).

-- 1. The switch ----------------------------------------------------------

insert into public.app_settings (key, value, is_public, description)
values (
  'lifecycle_emails_enabled',
  'false'::jsonb,
  false,
  'Sends the new-member lifecycle emails (day 0, 1, 3, 7, 14). Off until the copy in docs/planning/lifecycle-emails-2026-10.md is approved.'
)
on conflict (key) do nothing;

-- 2. Delivery log ----------------------------------------------------------

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  -- One row per webhook delivery (the svix-id header) or per send
  -- ('sent:<resend id>'), so Resend retrying a webhook never counts twice.
  event_key text not null unique,
  resend_email_id text,
  email text,
  email_type text,
  event text not null check (event in (
    'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained'
  )),
  occurred_at timestamptz not null default now(),
  -- Only what is needed to act on it: bounce type and message, the link
  -- that was clicked. Never the whole webhook body.
  detail jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now()
);

create index if not exists email_deliveries_resend_id_idx
  on public.email_deliveries (resend_email_id);
create index if not exists email_deliveries_email_idx
  on public.email_deliveries (lower(email));
create index if not exists email_deliveries_occurred_idx
  on public.email_deliveries (occurred_at);

alter table public.email_deliveries enable row level security;

drop policy if exists email_deliveries_admin_read on public.email_deliveries;
create policy email_deliveries_admin_read on public.email_deliveries
  for select to authenticated
  using (public.is_admin());

revoke all on table public.email_deliveries from public, anon, authenticated;
grant select on table public.email_deliveries to authenticated;
grant all on table public.email_deliveries to service_role;

-- 3. Suppressions ----------------------------------------------------------

create table if not exists public.email_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null check (reason in ('bounced', 'complained')),
  resend_email_id text,
  detail jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;

drop policy if exists email_suppressions_admin_read on public.email_suppressions;
create policy email_suppressions_admin_read on public.email_suppressions
  for select to authenticated
  using (public.is_admin());

-- Lifting a suppression (a member fixed their mailbox and asked) is a
-- delete by an admin.
drop policy if exists email_suppressions_admin_delete on public.email_suppressions;
create policy email_suppressions_admin_delete on public.email_suppressions
  for delete to authenticated
  using (public.is_admin());

revoke all on table public.email_suppressions from public, anon, authenticated;
grant select, delete on table public.email_suppressions to authenticated;
grant all on table public.email_suppressions to service_role;

-- 4. Lifecycle ledger ------------------------------------------------------

create table if not exists public.lifecycle_email_sends (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  step text not null check (step in ('day0', 'day1', 'day3', 'day7', 'day14')),
  gecko_id text,
  created_date timestamptz not null default now(),
  constraint lifecycle_email_sends_once unique (email, step)
);

alter table public.lifecycle_email_sends enable row level security;

drop policy if exists lifecycle_email_sends_admin_read on public.lifecycle_email_sends;
create policy lifecycle_email_sends_admin_read on public.lifecycle_email_sends
  for select to authenticated
  using (public.is_admin());

revoke all on table public.lifecycle_email_sends from public, anon, authenticated;
grant select on table public.lifecycle_email_sends to authenticated;
grant all on table public.lifecycle_email_sends to service_role;

-- 5. Recording an event ------------------------------------------------------
--
-- Called by send-email ('sent') and resend-webhook (everything else) with
-- the service role. Returns true when the event was new. A hard bounce or
-- a complaint also suppresses the address. A soft bounce (Resend marks it
-- Transient or Undetermined: a full mailbox, a server that was down) is
-- logged but does not suppress, because the next email may well arrive.

create or replace function public.record_email_event(
  p_event text,
  p_event_key text,
  p_resend_email_id text default null,
  p_email text default null,
  p_email_type text default null,
  p_occurred_at timestamptz default null,
  p_detail jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_type text := nullif(trim(coalesce(p_email_type, '')), '');
  v_detail jsonb := case when jsonb_typeof(p_detail) = 'object' then p_detail else '{}'::jsonb end;
  v_known_type text;
  v_known_email text;
  v_new boolean;
begin
  if p_event is null or p_event not in (
       'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained')
     or nullif(trim(coalesce(p_event_key, '')), '') is null then
    return false;
  end if;

  -- Webhooks for mail sent before tags existed carry no type; borrow it
  -- (and the address) from the 'sent' row of the same email.
  if p_resend_email_id is not null and (v_type is null or v_email is null) then
    select d.email_type, d.email
      into v_known_type, v_known_email
      from public.email_deliveries d
     where d.resend_email_id = p_resend_email_id
       and (d.email_type is not null or d.email is not null)
     order by d.occurred_at
     limit 1;
    v_type := coalesce(v_type, v_known_type);
    v_email := coalesce(v_email, v_known_email);
  end if;

  insert into public.email_deliveries
    (event_key, resend_email_id, email, email_type, event, occurred_at, detail)
  values
    (left(p_event_key, 200), left(p_resend_email_id, 200), left(v_email, 320), left(v_type, 64),
     p_event, coalesce(p_occurred_at, now()), v_detail)
  on conflict (event_key) do nothing;
  v_new := found;

  if v_new and v_email is not null and (
       p_event = 'complained'
       or (p_event = 'bounced'
           and coalesce(v_detail->>'bounce_type', '') !~* '^(transient|undetermined)$')
     ) then
    insert into public.email_suppressions (email, reason, resend_email_id, detail)
    values (v_email, p_event, p_resend_email_id, v_detail)
    on conflict (email) do update
      set reason = case when excluded.reason = 'complained' then 'complained' else email_suppressions.reason end,
          resend_email_id = excluded.resend_email_id,
          detail = excluded.detail,
          updated_date = now();
  end if;

  return v_new;
end;
$function$;

revoke all on function public.record_email_event(text, text, text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_email_event(text, text, text, text, text, timestamptz, jsonb)
  to service_role;

-- Has this address hard bounced or complained? send-email asks before any
-- non-transactional email. Service role only: it says whether an address
-- is a member, which must not be open to the public.
create or replace function public.email_is_suppressed(p_email text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.email_suppressions s
     where s.email = lower(trim(coalesce(p_email, '')))
  );
$function$;

revoke all on function public.email_is_suppressed(text) from public, anon, authenticated;
grant execute on function public.email_is_suppressed(text) to service_role;

-- 6. Weekly numbers for the admin Funnel card --------------------------------
--
-- One row per email type and week (the week the email was sent, Monday
-- start, UTC). Each column counts emails, not events: an email opened
-- five times counts once under opened. security_invoker makes the
-- table's admin-only read rule apply to whoever reads the view.

create or replace view public.email_delivery_stats
with (security_invoker = true)
as
with per_email as (
  select coalesce(d.resend_email_id, d.event_key) as message,
         coalesce(max(d.email_type), 'other') as email_type,
         min(d.occurred_at) as first_seen,
         bool_or(d.event = 'sent') as sent,
         bool_or(d.event = 'delivered') as delivered,
         bool_or(d.event = 'opened') as opened,
         bool_or(d.event = 'clicked') as clicked,
         bool_or(d.event = 'bounced') as bounced,
         bool_or(d.event = 'complained') as complained
    from public.email_deliveries d
   group by 1
)
select (date_trunc('week', first_seen at time zone 'utc'))::date as week,
       email_type,
       count(*) filter (where sent or delivered or bounced) as sent,
       count(*) filter (where delivered) as delivered,
       count(*) filter (where opened) as opened,
       count(*) filter (where clicked) as clicked,
       count(*) filter (where bounced) as bounced,
       count(*) filter (where complained) as complained
  from per_email
 group by 1, 2;

revoke all on table public.email_delivery_stats from public, anon, authenticated;
grant select on table public.email_delivery_stats to authenticated, service_role;

-- 7. Who is due a lifecycle email ------------------------------------------
--
-- Read-only, so it can be run by hand to preview the next batch
-- (select * from public.lifecycle_email_candidates();) whether the switch
-- is on or not. At most one row per member: the earliest step that is due.

create or replace function public.lifecycle_email_candidates(p_now timestamptz default now())
returns table (email text, step text, gecko_id text, facts jsonb)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with members as (
    select distinct on (lower(u.email))
           lower(u.email) as email,
           u.created_at as signed_up_at,
           p_now - u.created_at as age,
           nullif(left(split_part(trim(coalesce(p.full_name, '')), ' ', 1), 40), '') as first_name
      from auth.users u
      join public.profiles p on lower(p.email) = lower(u.email)
     where u.email is not null
       and u.email_confirmed_at is not null
       and u.deleted_at is null
       and coalesce(u.is_anonymous, false) = false
       and (u.banned_until is null or u.banned_until < p_now)
       and u.created_at > p_now - interval '16 days'
       and u.created_at <= p_now
       and p.email_notifications_enabled is true
       and not exists (
         select 1 from public.email_suppressions s where s.email = lower(u.email)
       )
       -- One lifecycle email per member in any 20 hours, so a member who
       -- is due two steps at once (the switch was just turned on) gets them
       -- a day apart, not in the same minute.
       and not exists (
         select 1 from public.lifecycle_email_sends l
          where l.email = lower(u.email)
            and l.created_date > p_now - interval '20 hours'
       )
     order by lower(u.email), p.created_date nulls last
  ),
  facts as (
    select m.*,
           gc.n as gecko_count,
           fg.id as first_gecko_id,
           fg.name as first_gecko_name,
           fg.morph as first_gecko_morph,
           coalesce(fg.has_sire, false) as has_sire,
           coalesce(fg.has_dam, false) as has_dam,
           coalesce(wc.n, 0) as weight_count,
           wc.last_grams,
           wc.last_date
      from members m
      cross join lateral (
        select count(*)::int as n
          from public.geckos g
         where lower(g.created_by) = m.email
           and coalesce(g.archived, false) = false
      ) gc
      -- The first gecko they added that they still keep.
      left join lateral (
        select g.id,
               nullif(left(trim(coalesce(g.name, '')), 60), '') as name,
               nullif(left(trim(coalesce(g.morphs_traits, '')), 80), '') as morph,
               (g.sire_id is not null or nullif(trim(coalesce(g.sire_name, '')), '') is not null) as has_sire,
               (g.dam_id is not null or nullif(trim(coalesce(g.dam_name, '')), '') is not null) as has_dam
          from public.geckos g
         where lower(g.created_by) = m.email
           and coalesce(g.archived, false) = false
           and coalesce(g.status, '') <> 'Sold'
         order by g.created_date, g.id
         limit 1
      ) fg on true
      left join lateral (
        select count(*)::int as n,
               (array_agg(w.weight_grams order by w.record_date desc, w.created_date desc))[1] as last_grams,
               max(w.record_date) as last_date
          from public.weight_records w
         where w.gecko_id = fg.id
      ) wc on true
  ),
  due as (
    select f.*, s.step, s.ord
      from facts f
      cross join (values
        ('day0', 0, 0, 2),
        ('day1', 1, 1, 3),
        ('day3', 2, 3, 5),
        ('day7', 3, 7, 9),
        ('day14', 4, 14, 16)
      ) as s(step, ord, from_day, to_day)
     where f.age >= make_interval(days => s.from_day)
       and f.age < make_interval(days => s.to_day)
       and case s.step
             when 'day0' then true
             when 'day1' then f.gecko_count = 0
             else f.first_gecko_id is not null
           end
       and not exists (
         select 1 from public.lifecycle_email_sends l
          where l.email = f.email and l.step = s.step
       )
  )
  select distinct on (d.email)
         d.email,
         d.step,
         d.first_gecko_id,
         jsonb_strip_nulls(jsonb_build_object(
           'first_name', d.first_name,
           'signed_up_at', d.signed_up_at,
           'gecko_count', d.gecko_count,
           'gecko_id', d.first_gecko_id,
           'gecko_name', d.first_gecko_name,
           'gecko_morph', d.first_gecko_morph,
           'has_sire', d.has_sire,
           'has_dam', d.has_dam,
           'weight_count', d.weight_count,
           'last_weight_grams', d.last_grams,
           'last_weight_date', d.last_date
         ))
    from due d
   order by d.email, d.ord;
$function$;

revoke all on function public.lifecycle_email_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.lifecycle_email_candidates(timestamptz) to service_role;

-- 8. The job ---------------------------------------------------------------
--
-- Claims each candidate's step in the ledger, then hands the email to
-- send-email through pg_net with the same Vault key the notification
-- dispatcher uses. Returns how many it handed over. While the switch is
-- off, or the key is missing, it claims nothing and returns 0, so turning
-- it on later still reaches everyone inside their windows.

create or replace function public.enqueue_lifecycle_emails(p_now timestamptz default now())
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
  r record;
begin
  if not exists (
    select 1 from public.app_settings
     where key = 'lifecycle_emails_enabled' and value = 'true'::jsonb
  ) then
    return 0;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;
  if v_key is null or v_key = '' then
    raise warning 'enqueue_lifecycle_emails: notification_service_role_key is missing';
    return 0;
  end if;

  for r in select * from public.lifecycle_email_candidates(p_now) loop
    -- created_date is the run's clock, so the 20-hour spacing and the
    -- windows all read the same time.
    insert into public.lifecycle_email_sends (email, step, gecko_id, created_date)
    values (r.email, r.step, r.gecko_id, p_now)
    on conflict (email, step) do nothing;
    if not found then
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
          'type', 'lifecycle_' || r.step,
          'facts', r.facts
        )
      );
      v_count := v_count + 1;
    exception when others then
      -- The ledger row stays: one missed lifecycle email is better than
      -- the risk of sending the same one twice.
      raise warning 'enqueue_lifecycle_emails: send-email call failed for %: %', r.step, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.enqueue_lifecycle_emails(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_lifecycle_emails(timestamptz) to service_role;

-- Every hour at 35 past. A daily run would send the welcome up to a day
-- after someone joins; hourly lands it within the hour, and each later
-- step arrives at about the time of day the member signed up. The ledger
-- makes the extra runs harmless, and while the switch is off each run is
-- one lookup.
select cron.schedule('lifecycle-emails-hourly', '35 * * * *', $$ select public.enqueue_lifecycle_emails(); $$);
