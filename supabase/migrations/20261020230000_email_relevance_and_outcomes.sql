-- Email relevance gate and outcomes report, 20 October 2026.
-- docs/marketing/email-brain.md explains both.
--
-- 1. Weekly Gecko Notes go only to members the notes can help: someone
--    with at least one gecko on record, or who signed in within the last
--    60 days. The first note went to 53 members on 18 to 20 October; 40 had
--    no gecko, 38 had not signed in for a month, and none of the 53 opened
--    the app in the 72 hours after it. Mailing people who have stopped
--    listening is how a list turns into noise and a domain into spam.
--    A member who comes back (signs in) or adds a gecko is eligible again
--    on the next hourly run. Nothing is turned off or recorded: the
--    member's switch is untouched.
--
--    weekly_notes_candidates keeps its signature, so create or replace
--    keeps its grants, and claim_weekly_note (which calls it) applies the
--    same gate when it claims a note.
--
-- 2. email_outcomes(p_days) answers "did this email make anyone do
--    anything?" without Resend's open and click tracking: for each
--    getting-started step and each weekly note sent in the window, how
--    many recipients used the app (user_events) and how many recorded
--    something (a gecko, a weight, a feeding or an event) in the 72 hours
--    after it, and how many turned the notes off after it. Admins only.
--
-- Safe for the app version open in members' browsers: no table or column
-- changes, no function signature changes for the app.

-- 1. The gate ----------------------------------------------------------------

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
     -- New in 20261020230000: only members the notes can help, someone
     -- with a gecko on record (the ownership rule claim_weekly_note uses)
     -- or who signed in within 60 days.
     and (
           m.last_sign_in_at > p_now - interval '60 days'
           or exists (select 1 from public.geckos g where lower(g.created_by) = m.email)
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

-- 2. Outcomes ----------------------------------------------------------------

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

revoke all on function public.email_outcomes(integer) from public, anon;
grant execute on function public.email_outcomes(integer) to authenticated, service_role;
