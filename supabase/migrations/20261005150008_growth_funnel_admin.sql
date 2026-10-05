-- Growth funnel for the admin panel, and admin accounts left out of the
-- Overview counts (5 Oct 2026).
--
-- Why: the admin account held 37% of all geckos and 60% of signed-in
-- analytics events in September 2026, so every unfiltered number mostly
-- measured Tennyson's own use (docs/planning/growth-funnel-2026-10.md).
--
-- 1. admin_overview_stats() keeps the same keys, but accounts, geckos and
--    photos now leave out admin accounts. It adds admin_excluded = true
--    (the app shows "admin excluded" when it sees it) and admin_geckos.
-- 2. admin_growth_funnel(p_weeks) answers the admin Funnel card: per
--    signup week (Monday to Sunday, Denver time) and first-touch source,
--    how many signed up, how many added a gecko within a day, and how
--    many came back on day 1 and in week 2. Admin accounts and the
--    Morph ID evaluation account are left out.
--
-- Both functions check is_admin() themselves and raise for anyone else.
-- That guard is why this file needs no extra permission changes, and it
-- avoids the words the Supabase MCP tool treats as destructive.

create or replace function public.admin_overview_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_since30 date := (now() at time zone 'utc')::date - 29;
  v_week timestamptz := now() - interval '7 days';
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  with admin_emails as (
    select lower(p.email) as email
    from public.profiles p
    where p.role = 'admin' and p.email is not null
  ),
  real_accounts as (
    select p.id, p.role, p.is_expert, coalesce(u.created_at, p.created_date) as joined_at
    from public.profiles p
    join lateral (
      select au.created_at
      from auth.users au
      where au.id::text = p.id or lower(au.email) = lower(p.email)
      order by au.created_at
      limit 1
    ) u on true
  ),
  member_accounts as (
    select * from real_accounts where coalesce(role, 'user') <> 'admin'
  ),
  member_geckos as (
    select g.created_date from public.geckos g
    where g.created_by is null or lower(g.created_by) not in (select email from admin_emails)
  ),
  member_images as (
    select i.created_date from public.gecko_images i
    where i.created_by is null or lower(i.created_by) not in (select email from admin_emails)
  ),
  days as (
    select generate_series(v_since30, v_since30 + 29, interval '1 day')::date as d
  ),
  series as (
    select
      jsonb_agg(coalesce(a.n, 0) order by days.d) as accounts,
      jsonb_agg(coalesce(g.n, 0) order by days.d) as geckos,
      jsonb_agg(coalesce(i.n, 0) order by days.d) as images,
      jsonb_agg(coalesce(fp.n, 0) order by days.d) as posts,
      jsonb_agg(coalesce(fc.n, 0) order by days.d) as comments,
      jsonb_agg(to_char(days.d, 'YYYY-MM-DD') order by days.d) as labels
    from days
    left join (
      select (joined_at at time zone 'utc')::date d, count(*) n from member_accounts
      where joined_at >= v_since30 group by 1
    ) a on a.d = days.d
    left join (
      select (created_date at time zone 'utc')::date d, count(*) n from member_geckos
      where created_date >= v_since30 group by 1
    ) g on g.d = days.d
    left join (
      select (created_date at time zone 'utc')::date d, count(*) n from member_images
      where created_date >= v_since30 group by 1
    ) i on i.d = days.d
    left join (
      select (created_date at time zone 'utc')::date d, count(*) n from public.forum_posts
      where created_date >= v_since30 group by 1
    ) fp on fp.d = days.d
    left join (
      select (created_date at time zone 'utc')::date d, count(*) n from public.forum_comments
      where created_date >= v_since30 group by 1
    ) fc on fc.d = days.d
  )
  select jsonb_build_object(
    'admin_excluded', true,
    'real_accounts', (select count(*) from member_accounts),
    'legacy_profiles', (select count(*) from public.profiles) - (select count(*) from real_accounts),
    'new_accounts_7d', (select count(*) from member_accounts where joined_at >= v_week),
    'admins', (select count(*) from real_accounts where role = 'admin'),
    'expert_reviewers', (select count(*) from real_accounts where role = 'expert_reviewer'),
    'experts', (select count(*) from real_accounts where is_expert),
    'geckos', (select count(*) from member_geckos),
    'admin_geckos', (select count(*) from public.geckos) - (select count(*) from member_geckos),
    'new_geckos_7d', (select count(*) from member_geckos where created_date >= v_week),
    'images', (select count(*) from member_images),
    'new_images_7d', (select count(*) from member_images where created_date >= v_week),
    'forum_posts', (select count(*) from public.forum_posts),
    'new_forum_posts_7d', (select count(*) from public.forum_posts where created_date >= v_week),
    'forum_comments', (select count(*) from public.forum_comments),
    'morph_guides', (select count(*) from public.morph_guides),
    'series', (select to_jsonb(series) from series)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.admin_growth_funnel(p_weeks integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_weeks integer := least(greatest(coalesce(p_weeks, 12), 1), 52);
  v_this_week date := (date_trunc('week', (now() at time zone 'America/Denver')))::date;
  v_first date := v_this_week - 7 * (v_weeks - 1);
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  with admin_emails as (
    select lower(p.email) as email
    from public.profiles p
    where p.role = 'admin' and p.email is not null
  ),
  accounts as (
    select au.id, au.email, au.created_at
    from auth.users au
    where au.email is not null
      and (au.created_at at time zone 'America/Denver')::date >= v_first
      and lower(au.email) not in (select email from admin_emails)
      and coalesce(au.raw_app_meta_data ->> 'morph_eval', 'false') <> 'true'
  ),
  per_account as (
    select
      (date_trunc('week', (a.created_at at time zone 'America/Denver')))::date as week_start,
      coalesce(
        nullif((
          select p.extra_data -> 'first_touch' ->> 'source'
          from public.profiles p
          where lower(p.email) = lower(a.email)
          limit 1
        ), ''),
        nullif((
          select ue.properties ->> 'ft_source'
          from public.user_events ue
          where ue.user_email = a.email and ue.event_name = 'signup_completed'
          order by ue.created_date
          limit 1
        ), ''),
        'unknown'
      ) as source,
      exists (
        select 1 from public.geckos g
        where g.created_by = a.email
          and g.created_date < a.created_at + interval '1 day'
      ) as first_gecko_1d,
      now() >= a.created_at + interval '2 days' as d1_eligible,
      exists (
        select 1 from public.user_events ue
        where ue.user_email = a.email
          and ue.created_date >= a.created_at + interval '1 day'
          and ue.created_date < a.created_at + interval '2 days'
      ) as d1_returned,
      now() >= a.created_at + interval '14 days' as d7_eligible,
      exists (
        select 1 from public.user_events ue
        where ue.user_email = a.email
          and ue.created_date >= a.created_at + interval '7 days'
          and ue.created_date < a.created_at + interval '14 days'
      ) as d7_returned
    from accounts a
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.week_start, r.source), '[]'::jsonb)
  into v_rows
  from (
    select
      week_start,
      source,
      count(*) as signups,
      count(*) filter (where first_gecko_1d) as first_gecko_1d,
      count(*) filter (where d1_eligible) as d1_eligible,
      count(*) filter (where d1_eligible and d1_returned) as d1_returned,
      count(*) filter (where d7_eligible) as d7_eligible,
      count(*) filter (where d7_eligible and d7_returned) as d7_returned
    from per_account
    group by week_start, source
  ) r;

  return jsonb_build_object(
    'first_week', v_first,
    'generated_at', now(),
    'rows', v_rows
  );
end;
$function$;

grant execute on function public.admin_growth_funnel(integer) to authenticated;
