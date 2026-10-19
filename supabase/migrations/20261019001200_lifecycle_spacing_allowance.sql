-- Getting-started emails: the 20-hour spacing allows for the run's clock
-- (19 Oct 2026; docs/planning/lifecycle-emails-2026-10.md). Safe to run
-- more than once: one create or replace. Dated after 20261018152154, the
-- newest file in production when this was written, and after
-- 20261018172000 (Weekly Gecko Notes, sixth round, waiting in a draft PR).
--
-- What it fixes, in plain words:
--
-- The hourly job (lifecycle-emails-hourly, 35 past) stamps each
-- lifecycle_email_sends row with the time its run started, and that time
-- moves by a fraction of a second from run to run. The 20-hour rule
-- compared stamps exactly, so when a run started even 0.2 seconds earlier
-- in its minute than the run 20 hours before it, the member was left out
-- and waited an extra hour. The same pattern made the 22:50 Weekly Gecko
-- Notes run on 18 Oct skip 20 members.
--
-- The rule now allows 10 minutes: an email holds back the next one while
-- it is less than 19 hours 50 minutes old. Runs are an hour apart, so the
-- run 19 hours after an email is still held back, and the soonest a second
-- one can go is the run 20 hours after it, give or take that fraction of
-- a second. The promise stays: at most one getting-started email per
-- member in any 20 hours.
--
-- Only day0 and day1 can meet this rule (day0 is due from 1 hour to 2
-- days after joining, day1 from 1 to 3 days with no gecko), so in practice
-- it is the catch-up right after the switch went on. Day1 had hours left
-- in its window after the extra hour, so nothing was lost. In production
-- no member had reached the boundary when this was written.
--
-- lifecycle_email_candidates below is the 20261015151200 body (it matched
-- production's, checked by checksum on 19 Oct) with one change, the
-- 20-hour comparison, and the comments about it. Same grants.
-- enqueue_lifecycle_emails is unchanged: it still stamps the run's time.
--
-- Not changed: the rule in weekly_notes_candidates (no weekly note within
-- 20 hours of a getting-started email) compares a stamp from 35 past with
-- a weekly run at 50 past, so its boundary is always 15 minutes from any
-- run and a fraction of a second cannot move a member across it.

-- 7. Who is due a lifecycle email ------------------------------------------
--
-- Read-only, so it can be run by hand to preview the next batch
-- (select * from public.lifecycle_email_candidates();) whether the switch
-- is on or not. At most one row per member: the earliest step that is due.
-- At most one lifecycle email per member in any 20 hours, with 10 minutes
-- allowed for the hourly run's clock (from 20261019001200).

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
       -- a day apart, not in the same minute. Changed in 20261019001200:
       -- 10 minutes are allowed for the run's clock. Each stamp is the
       -- start of an hourly run, which moves by a fraction of a second, and
       -- an exact 20 hours left a member out when a run started that much
       -- early. Runs are an hour apart, so the run 19 hours on is still
       -- held back.
       and not exists (
         select 1 from public.lifecycle_email_sends l
          where l.email = lower(u.email)
            and l.created_date > p_now - (interval '20 hours' - interval '10 minutes')
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
      -- The welcome waits until the account is an hour old, so it is
      -- written from what the member did in onboarding (a first gecko, a
      -- first weight) instead of greeting them as empty a minute after
      -- they joined.
      cross join (values
        ('day0', 0, interval '1 hour', interval '2 days'),
        ('day1', 1, interval '1 day', interval '3 days'),
        ('day3', 2, interval '3 days', interval '5 days'),
        ('day7', 3, interval '7 days', interval '9 days'),
        ('day14', 4, interval '14 days', interval '16 days')
      ) as s(step, ord, from_age, to_age)
     where f.age >= s.from_age
       and f.age < s.to_age
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
