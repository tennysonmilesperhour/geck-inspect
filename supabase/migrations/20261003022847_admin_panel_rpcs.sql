-- Admin panel (feature-completeness audit, step 22).
--
-- Additive only: three read-only, admin-checked functions. Nothing in the
-- deployed client calls them yet, so applying this cannot break anything.
--
-- Real accounts vs legacy rows: profiles holds 140 rows, but only the ones
-- with a matching login (an auth.users row with the same email, or the
-- same id) are people who can sign in. The rest are legacy rows imported
-- from the old platform with no login. The Overview, the account
-- directory and mass messaging count only real accounts.

create or replace function public.admin_overview_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since30 date := (now() at time zone 'utc')::date - 29;
  v_week timestamptz := now() - interval '7 days';
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  with real_accounts as (
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
      select (joined_at at time zone 'utc')::date d, count(*) n from real_accounts
      where joined_at >= v_since30 group by 1
    ) a on a.d = days.d
    left join (
      select (created_date at time zone 'utc')::date d, count(*) n from public.geckos
      where created_date >= v_since30 group by 1
    ) g on g.d = days.d
    left join (
      select (created_date at time zone 'utc')::date d, count(*) n from public.gecko_images
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
    'real_accounts', (select count(*) from real_accounts),
    'legacy_profiles', (select count(*) from public.profiles) - (select count(*) from real_accounts),
    'new_accounts_7d', (select count(*) from real_accounts where joined_at >= v_week),
    'admins', (select count(*) from real_accounts where role = 'admin'),
    'expert_reviewers', (select count(*) from real_accounts where role = 'expert_reviewer'),
    'experts', (select count(*) from real_accounts where is_expert),
    'geckos', (select count(*) from public.geckos),
    'new_geckos_7d', (select count(*) from public.geckos where created_date >= v_week),
    'images', (select count(*) from public.gecko_images),
    'new_images_7d', (select count(*) from public.gecko_images where created_date >= v_week),
    'forum_posts', (select count(*) from public.forum_posts),
    'new_forum_posts_7d', (select count(*) from public.forum_posts where created_date >= v_week),
    'forum_comments', (select count(*) from public.forum_comments),
    'morph_guides', (select count(*) from public.morph_guides),
    'series', (select to_jsonb(series) from series)
  ) into v_result;

  return v_result;
end;
$$;

-- One row per profile, with whether it has a login. Admin-only (it
-- returns emails). Used by the Overview's newest accounts list, the
-- reviewer screen and the mass message recipient count.
create or replace function public.admin_account_directory()
returns table (
  id text,
  email text,
  full_name text,
  role text,
  is_expert boolean,
  created_date timestamptz,
  has_login boolean,
  joined_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.role,
    coalesce(p.is_expert, false),
    p.created_date,
    (u.id is not null) as has_login,
    coalesce(u.created_at, p.created_date) as joined_at,
    u.last_sign_in_at
  from public.profiles p
  left join lateral (
    select au.id, au.created_at, au.last_sign_in_at
    from auth.users au
    where au.id::text = p.id or lower(au.email) = lower(p.email)
    order by au.created_at
    limit 1
  ) u on true;
end;
$$;

-- Health page: scheduled job status, recent failed HTTP calls made by the
-- database (cron jobs that call edge functions go through pg_net, which
-- keeps responses for about six hours), and the count of unresolved app
-- errors in the last day. Read-only; no job commands or secrets returned.
create or replace function public.admin_health_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jobs jsonb := '[]'::jsonb;
  v_http jsonb := '[]'::jsonb;
  v_client_errors integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  begin
    select coalesce(jsonb_agg(j order by j->>'name'), '[]'::jsonb) into v_jobs
    from (
      select jsonb_build_object(
        'name', job.jobname,
        'schedule', job.schedule,
        'active', job.active,
        'last_status', last.status,
        'last_start', last.start_time,
        'last_end', last.end_time,
        'last_message', left(case when last.status = 'succeeded' then null else last.return_message end, 300),
        'failures_7d', (
          select count(*) from cron.job_run_details d
          where d.jobid = job.jobid and d.status = 'failed' and d.start_time > now() - interval '7 days'
        )
      ) as j
      from cron.job job
      left join lateral (
        select d.status, d.start_time, d.end_time, d.return_message
        from cron.job_run_details d
        where d.jobid = job.jobid
        order by d.start_time desc
        limit 1
      ) last on true
    ) s;
  exception when others then
    v_jobs := jsonb_build_array(jsonb_build_object('error', 'cron_unavailable'));
  end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'status_code', r.status_code,
      'timed_out', r.timed_out,
      'error', left(coalesce(r.error_msg, r.content::text), 300),
      'at', r.created
    ) order by r.created desc), '[]'::jsonb) into v_http
    from (
      select * from net._http_response
      where status_code >= 400 or status_code is null or timed_out or error_msg is not null
      order by created desc
      limit 20
    ) r;
  exception when others then
    v_http := '[]'::jsonb;
  end;

  select count(*) into v_client_errors
  from public.error_logs
  where created_date > now() - interval '24 hours'
    and coalesce(resolved, false) = false;

  return jsonb_build_object(
    'jobs', v_jobs,
    'http_errors', v_http,
    'client_errors_24h', v_client_errors,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.admin_overview_stats() from public, anon;
revoke all on function public.admin_account_directory() from public, anon;
revoke all on function public.admin_health_status() from public, anon;
grant execute on function public.admin_overview_stats() to authenticated;
grant execute on function public.admin_account_directory() to authenticated;
grant execute on function public.admin_health_status() to authenticated;
