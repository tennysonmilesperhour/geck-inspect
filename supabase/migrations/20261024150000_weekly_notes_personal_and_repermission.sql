-- Weekly Gecko Notes: personal and seasonal notes, and one re-permission
-- email for dormant members. 24 October 2026. docs/marketing/email-brain.md
-- (sections 5 and 6) and docs/planning/weekly-notes-2026-10.md explain both.
--
-- 1. weekly_note_facts(p_email). What send-email needs to pick and
--    personalise a note: how many geckos the member keeps, the gecko
--    waiting longest for a weigh-in, a female (an adult one first) and
--    whether they breed. Service role only.
--
-- 2. claim_weekly_note_from(p_email, p_slugs, p_steps, p_now). The same
--    claim as claim_weekly_note, but send-email passes only the notes that
--    fit this member and this month, with each note's catalog step, so the
--    ledger keeps the real step. claim_weekly_note stays for a rollback.
--
-- 3. The relevance gate (20261020230000) also lets in a member who said
--    yes on purpose within the last year: the Settings switch, the sign-up
--    box or the "keep them coming" button in the re-permission email.
--
-- 4. The re-permission email. Members the gate leaves out (no gecko, no
--    sign-in in 60 days, no recent yes) get one email, once, asking whether
--    they still want the notes. Pressing "Yes, keep them coming" on the
--    /KeepNotes page (keep_weekly_notes_by_token) records a yes, which
--    lets them through the gate. Doing nothing changes nothing: the gate
--    already leaves them out, and signing in or adding a gecko lets them
--    back in. The ledger (weekly_notes_repermission_sends) is written by
--    send-email's claim after every check, so a skipped send uses nothing
--    up. Off until app_settings weekly_notes_repermission_enabled is true.
--
-- 5. email_outcomes adds a row for the re-permission email and counts the
--    members who pressed keep.
--
-- Safe for the app version open in members' browsers: new functions and one
-- new table; the replaced functions keep their signatures and grants.

-- 1. Facts --------------------------------------------------------------------

create or replace function public.weekly_note_facts(p_email text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with mine as (
    select g.id, g.name, g.sex, g.hatch_date, g.weight_grams, g.created_date
      from public.geckos g
     where lower(g.created_by) = lower(trim(coalesce(p_email, '')))
       and coalesce(g.archived, false) = false
       and coalesce(g.status, '') <> 'Sold'
  ),
  weighed as (
    select m.*,
           w.weight_grams as last_weight_grams,
           w.record_date as last_weight_date
      from mine m
      left join lateral (
        select r.weight_grams, r.record_date
          from public.weight_records r
         where r.gecko_id = m.id
         order by r.record_date desc nulls last, r.created_date desc
         limit 1
      ) w on true
  ),
  stale as (
    select * from weighed
     order by last_weight_date nulls first, created_date
     limit 1
  ),
  female as (
    select *,
           (coalesce(last_weight_grams, weight_grams, 0) >= 35
            or (hatch_date is not null and hatch_date <= (now() - interval '18 months')::date)) as adult
      from weighed
     where sex = 'Female'
     order by adult desc, coalesce(last_weight_grams, weight_grams, 0) desc, created_date
     limit 1
  )
  select jsonb_build_object(
    'gecko_count', (select count(*) from mine),
    'stale', (select jsonb_build_object(
                'id', s.id, 'name', s.name,
                'last_weight_grams', s.last_weight_grams,
                'last_weight_date', s.last_weight_date) from stale s),
    'female', (select jsonb_build_object('id', f.id, 'name', f.name, 'adult', f.adult) from female f),
    'breeder', exists (
      select 1 from public.breeding_plans b
       where lower(b.created_by) = lower(trim(coalesce(p_email, '')))
         and coalesce(b.archived, false) = false
    ) or exists (
      select 1 from public.eggs e
       where lower(e.created_by) = lower(trim(coalesce(p_email, '')))
    ) or exists (
      select 1 from public.clutches c
       where lower(c.created_by) = lower(trim(coalesce(p_email, '')))
    )
  );
$function$;

revoke all on function public.weekly_note_facts(text) from public, anon, authenticated;
grant execute on function public.weekly_note_facts(text) to service_role;

-- 3. The gate (before the claim, which calls it) --------------------------------

create or replace function public.weekly_notes_candidates(
  p_now timestamp with time zone default now(),
  p_ignore_polls boolean default false
)
returns table(email text, last_polled_at timestamp with time zone)
language sql
stable security definer
set search_path to 'public'
as $function$
  with members as (
    select distinct on (lower(u.email))
           lower(u.email) as email,
           u.last_sign_in_at
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
   where not public.email_inbox_suppressed(m.email)
     -- Only members the notes can help (20261020230000): a gecko on
     -- record or a sign-in within 60 days. New in 20261024150000: or a yes
     -- on purpose within a year (Settings, sign-up box, the keep button).
     and (
           m.last_sign_in_at > p_now - interval '60 days'
           or exists (select 1 from public.geckos g where lower(g.created_by) = m.email)
           or exists (select 1 from public.profiles p4
                       where lower(p4.email) = m.email
                         and p4.email_weekly_notes_enabled is true
                         and p4.email_weekly_notes_choice_at > p_now - interval '365 days')
         )
     -- At most one marketing email in any 20 hours: no weekly note within
     -- 20 hours of a lifecycle email (a day 14 email sent late).
     and not exists (
           select 1 from public.lifecycle_email_sends l
            where l.email = m.email
              and l.created_date > p_now - interval '20 hours'
         )
     -- A stop from a visitor note holds for the inbox once it has an
     -- account, unless the member turned the notes on again afterwards.
     and (case
            when public.weekly_notes_visitor_stop_at(m.email) is null then true
            else public.weekly_notes_visitor_stop_at(m.email) < coalesce((
                   select max(p3.email_weekly_notes_choice_at) from public.profiles p3
                    where lower(p3.email) = m.email), '-infinity'::timestamptz)
          end)
     -- At most one weekly note in any 7 days, to any spelling of the inbox.
     and not exists (
           select 1 from public.weekly_notes_sends n
            where public.email_inbox_key(n.email) = public.email_inbox_key(m.email)
              and n.created_date > p_now - interval '7 days'
         )
     -- Asked about at most once in any 20 hours.
     and (p_ignore_polls
          or w.polled_at is null
          or w.polled_at <= p_now - interval '20 hours');
$function$;

-- 2. The claim with steps ------------------------------------------------------

create or replace function public.claim_weekly_note_from(
  p_email text,
  p_slugs text[],
  p_steps integer[],
  p_now timestamp with time zone default now()
)
returns jsonb
language plpgsql
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

  -- An empty list is a member with nothing in season or for them yet.
  if p_slugs is not null and coalesce(cardinality(p_slugs), 0) = 0
     and coalesce(cardinality(p_steps), 0) = 0 then
    return jsonb_build_object('reason', 'caught-up');
  end if;

  if p_slugs is null or p_steps is null
     or cardinality(p_slugs) > 1000
     or array_ndims(p_slugs) <> 1
     or array_ndims(p_steps) <> 1
     or cardinality(p_steps) <> cardinality(p_slugs)
     or exists (
          select 1 from unnest(p_slugs) s(slug)
           where s.slug is null
              or length(s.slug) > 64
              or s.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
     or exists (select 1 from unnest(p_steps) t(step) where t.step is null or t.step < 1)
     or (select count(distinct s.slug) from unnest(p_slugs) s(slug)) <> cardinality(p_slugs) then
    return jsonb_build_object('reason', 'bad-catalog');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('weekly_notes:' || v_email, 0));

  if not exists (
    select 1 from public.weekly_notes_candidates(p_now, true) c where c.email = v_email
  ) then
    return jsonb_build_object('reason', 'not-eligible');
  end if;

  select s.slug, p_steps[s.ord::integer]
    into v_slug, v_step
    from unnest(p_slugs) with ordinality as s(slug, ord)
   where not exists (
     select 1 from public.weekly_notes_sends w
      where public.email_inbox_key(w.email) = public.email_inbox_key(v_email) and w.slug = s.slug
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

  v_has_gecko := exists (select 1 from public.geckos g where lower(g.created_by) = v_email);

  return jsonb_build_object('slug', v_slug, 'step', v_step, 'has_gecko', v_has_gecko);
end;
$function$;

revoke all on function public.claim_weekly_note_from(text, text[], integer[], timestamp with time zone) from public, anon, authenticated;
grant execute on function public.claim_weekly_note_from(text, text[], integer[], timestamp with time zone) to service_role;

-- 4. Re-permission -------------------------------------------------------------

insert into public.app_settings (key, value, is_public, description)
values (
  'weekly_notes_repermission_enabled',
  'false'::jsonb,
  false,
  'Sends one "still keeping crested geckos?" email to members the Weekly Gecko Notes relevance gate leaves out. docs/marketing/email-brain.md.'
)
on conflict (key) do nothing;

create table if not exists public.weekly_notes_repermission_sends (
  email text primary key,
  created_date timestamptz not null default now(),
  -- When the member pressed "Yes, keep them coming".
  kept_at timestamptz
);

alter table public.weekly_notes_repermission_sends enable row level security;
revoke all on table public.weekly_notes_repermission_sends from public, anon, authenticated;
grant select on table public.weekly_notes_repermission_sends to authenticated;
grant all on table public.weekly_notes_repermission_sends to service_role;

drop policy if exists "Admins read re-permission sends" on public.weekly_notes_repermission_sends;
create policy "Admins read re-permission sends"
  on public.weekly_notes_repermission_sends
  for select to authenticated
  using (public.is_admin());

-- Who is due the re-permission email: every weekly-notes rule except the
-- relevance gate, failing that gate, and never asked before.
create or replace function public.weekly_notes_repermission_candidates(
  p_now timestamp with time zone default now(),
  p_ignore_polls boolean default false
)
returns table(email text, last_polled_at timestamp with time zone)
language sql
stable security definer
set search_path to 'public'
as $function$
  with members as (
    select distinct on (lower(u.email))
           lower(u.email) as email,
           u.last_sign_in_at
      from auth.users u
      join public.profiles p on lower(p.email) = lower(u.email)
     where u.email is not null
       and u.email_confirmed_at is not null
       and u.deleted_at is null
       and coalesce(u.is_anonymous, false) = false
       and (u.banned_until is null or u.banned_until < p_now)
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
   where not public.email_inbox_suppressed(m.email)
     -- The gate in weekly_notes_candidates, failed.
     and not (
           m.last_sign_in_at > p_now - interval '60 days'
           or exists (select 1 from public.geckos g where lower(g.created_by) = m.email)
           or exists (select 1 from public.profiles p4
                       where lower(p4.email) = m.email
                         and p4.email_weekly_notes_enabled is true
                         and p4.email_weekly_notes_choice_at > p_now - interval '365 days')
         )
     and not exists (
           select 1 from public.weekly_notes_repermission_sends r
            where public.email_inbox_key(r.email) = public.email_inbox_key(m.email)
         )
     and not exists (
           select 1 from public.lifecycle_email_sends l
            where l.email = m.email
              and l.created_date > p_now - interval '20 hours'
         )
     and public.weekly_notes_visitor_stop_at(m.email) is null
     and not exists (
           select 1 from public.weekly_notes_sends n
            where public.email_inbox_key(n.email) = public.email_inbox_key(m.email)
              and n.created_date > p_now - interval '7 days'
         )
     and (p_ignore_polls
          or w.polled_at is null
          or w.polled_at <= p_now - interval '20 hours');
$function$;

revoke all on function public.weekly_notes_repermission_candidates(timestamp with time zone, boolean) from public, anon, authenticated;
grant execute on function public.weekly_notes_repermission_candidates(timestamp with time zone, boolean) to service_role;

-- send-email's claim: the last step before sending. One row per inbox, ever.
create or replace function public.claim_weekly_notes_repermission(
  p_email text,
  p_now timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' then
    return jsonb_build_object('reason', 'no-email');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('weekly_notes:' || v_email, 0));
  if not exists (
    select 1 from public.weekly_notes_repermission_candidates(p_now, true) c where c.email = v_email
  ) then
    return jsonb_build_object('reason', 'not-eligible');
  end if;
  insert into public.weekly_notes_repermission_sends (email, created_date)
  values (v_email, p_now)
  on conflict (email) do nothing;
  if not found then
    return jsonb_build_object('reason', 'already-sent');
  end if;
  return jsonb_build_object('claimed', true);
end;
$function$;

revoke all on function public.claim_weekly_notes_repermission(text, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.claim_weekly_notes_repermission(text, timestamp with time zone) to service_role;

-- The keep button. Checked like the unsubscribe links: the signed token is
-- the proof, so it works signed out. A yes turns the notes on (they are
-- already on for everyone who got the email) and records the choice.
create or replace function public.keep_weekly_notes_by_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_id text;
  v_expected text;
  v_email text;
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
     set email_weekly_notes_enabled = true,
         email_weekly_notes_choice_at = now()
   where id = v_id
  returning lower(email) into v_email;
  if not found then
    return false;
  end if;
  update public.weekly_notes_repermission_sends
     set kept_at = coalesce(kept_at, now())
   where email = v_email;
  return true;
end;
$function$;

revoke all on function public.keep_weekly_notes_by_token(text) from public;
grant execute on function public.keep_weekly_notes_by_token(text) to anon, authenticated, service_role;

create or replace function public.enqueue_weekly_notes_repermission(
  p_now timestamp with time zone default now(),
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
     where key = 'weekly_notes_repermission_enabled' and value = 'true'::jsonb
  ) then
    return 0;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;
  if v_key is null or v_key = '' then
    raise warning 'enqueue_weekly_notes_repermission: notification_service_role_key is missing';
    return 0;
  end if;

  for r in
    select c.email from public.weekly_notes_repermission_candidates(p_now) c
     order by c.last_polled_at nulls first, c.email
     limit greatest(coalesce(p_limit, 20), 0)
  loop
    -- The weekly notes' poll row: one ask per inbox in any 20 hours,
    -- shared with the weekly notes, so the two never land on one day.
    insert into public.weekly_notes_polls as w (email, polled_at)
    values (r.email, p_now)
    on conflict (email) do update
      set polled_at = excluded.polled_at
      where w.polled_at <= p_now - interval '20 hours';
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
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
          'type', 'weekly_notes_repermission',
          'repermission', jsonb_build_object('run_at', p_now)
        )
      );
      v_count := v_count + 1;
    exception when others then
      raise warning 'enqueue_weekly_notes_repermission: send-email call failed: %', sqlerrm;
    end;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.enqueue_weekly_notes_repermission(timestamp with time zone, integer) from public, anon, authenticated;
grant execute on function public.enqueue_weekly_notes_repermission(timestamp with time zone, integer) to service_role;

select cron.schedule(
  'weekly-notes-repermission-hourly',
  '55 * * * *',
  $$ select public.enqueue_weekly_notes_repermission(); $$
);

-- 5. Outcomes ------------------------------------------------------------------

create or replace function public.email_outcomes(p_days integer default 60)
returns table(
  kind text,
  sent bigint,
  came_back_72h bigint,
  recorded_72h bigint,
  stopped_after bigint
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  return query
  with sends as (
    select l.email, 'getting-started ' || l.step as kind, l.created_date as sent_at
      from public.lifecycle_email_sends l
     where l.created_date > now() - make_interval(days => greatest(coalesce(p_days, 60), 1))
    union all
    select w.email, 'weekly ' || lpad(w.step::text, 3, '0') || ' ' || w.slug, w.created_date
      from public.weekly_notes_sends w
     where w.created_date > now() - make_interval(days => greatest(coalesce(p_days, 60), 1))
    union all
    -- For the re-permission email, "recorded" also counts pressing keep.
    select r.email, 're-permission', r.created_date
      from public.weekly_notes_repermission_sends r
     where r.created_date > now() - make_interval(days => greatest(coalesce(p_days, 60), 1))
  )
  select s.kind,
         count(*) as sent,
         count(*) filter (where exists (
           select 1 from public.user_events e
            where lower(e.user_email) = s.email
              and e.created_date between s.sent_at and s.sent_at + interval '72 hours'
         )) as came_back_72h,
         count(*) filter (where
              exists (select 1 from public.geckos g
                       where lower(g.created_by) = s.email
                         and g.created_date between s.sent_at and s.sent_at + interval '72 hours')
           or exists (select 1 from public.weight_records r
                       where lower(r.created_by) = s.email
                         and r.created_date between s.sent_at and s.sent_at + interval '72 hours')
           or exists (select 1 from public.feeding_records f
                       where lower(f.created_by) = s.email
                         and f.created_date between s.sent_at and s.sent_at + interval '72 hours')
           or exists (select 1 from public.gecko_events v
                       where lower(v.created_by) = s.email
                         and v.created_date between s.sent_at and s.sent_at + interval '72 hours')
           or (s.kind = 're-permission' and exists (
                 select 1 from public.weekly_notes_repermission_sends k
                  where k.email = s.email and k.kept_at is not null))
         ) as recorded_72h,
         count(*) filter (where exists (
           select 1 from public.profiles p
            where lower(p.email) = s.email
              and p.email_weekly_notes_enabled is not true
              and p.email_weekly_notes_choice_at > s.sent_at
         )) as stopped_after
    from sends s
   group by s.kind
   order by s.kind;
end;
$function$;
