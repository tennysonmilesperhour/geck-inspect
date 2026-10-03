-- Season Planner on the server (step 15, decision D17), 3 Oct 2026.
--
-- Before this, task reminders and "your planned breeding window is open"
-- notices were created by the Season Planner page itself, so they only
-- happened while that page was open, and notes lived in one browser.
--
-- 1. planner_notes: Season Planner notes, one set per member, synced
--    across devices.
-- 2. future_breeding_plans gains started_breeding_plan_id and started_at,
--    set when "Start this pairing" turns a plan into a real breeding plan.
-- 3. enqueue_season_planner_reminders(), run daily by pg_cron:
--    * a 'task_reminder' notification on a task's due date (and, when the
--      task has "remind me N days before" on, N days earlier), and on a
--      plan's (project's) due date;
--    * a 'future_breeding_ready' notification when a future plan's season
--      window opens (seasons are the calendar quarters in src/lib/seasons.js;
--      winter belongs to the year it ends in).
--    Each reminder is sent once per task, due date and kind. A missed run
--    still catches up to 3 days late. Completed tasks, completed plans and
--    started future plans get nothing.
--
-- Notification titles come from notify_dispatch_on_insert(). 'task_reminder'
-- is new; until that function lists it the push and email title falls back
-- to "Geck Inspect" (the body names the task). It is deliberately not
-- redefined here because pending migrations redefine it.

-- 1. Notes
create table if not exists public.planner_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  body text,
  color text not null default 'Yellow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_notes_length check (
    length(coalesce(title, '')) <= 200 and length(coalesce(body, '')) <= 10000
  )
);

create index if not exists planner_notes_user_created_idx
  on public.planner_notes (user_id, created_at desc);

alter table public.planner_notes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'planner_notes'
                  and policyname = 'planner_notes_select_own') then
    create policy "planner_notes_select_own" on public.planner_notes
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'planner_notes'
                  and policyname = 'planner_notes_insert_own') then
    create policy "planner_notes_insert_own" on public.planner_notes
      for insert to authenticated with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'planner_notes'
                  and policyname = 'planner_notes_update_own') then
    create policy "planner_notes_update_own" on public.planner_notes
      for update to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'planner_notes'
                  and policyname = 'planner_notes_delete_own') then
    create policy "planner_notes_delete_own" on public.planner_notes
      for delete to authenticated using (user_id = (select auth.uid()));
  end if;
end
$$;

-- 2. "Start this pairing"
alter table public.future_breeding_plans
  add column if not exists started_breeding_plan_id text,
  add column if not exists started_at timestamptz;

-- 3. Daily reminders
create or replace function public.season_window_start(p_season text, p_year integer)
returns date
language sql
immutable
as $function$
  select case lower(p_season)
    when 'spring' then make_date(p_year, 3, 1)
    when 'summer' then make_date(p_year, 6, 1)
    when 'fall'   then make_date(p_year, 9, 1)
    when 'winter' then make_date(p_year - 1, 12, 1)
    else null
  end;
$function$;

create or replace function public.season_window_end(p_season text, p_year integer)
returns date
language sql
immutable
as $function$
  select case lower(p_season)
    when 'spring' then make_date(p_year, 5, 31)
    when 'summer' then make_date(p_year, 8, 31)
    when 'fall'   then make_date(p_year, 11, 30)
    when 'winter' then (make_date(p_year, 3, 1) - 1)
    else null
  end;
$function$;

create or replace function public.enqueue_season_planner_reminders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_body text;
  v_when text;
  v_label text;
begin
  -- Only the scheduled job (no signed-in caller), the service role or an
  -- admin may run this.
  if coalesce(auth.role(), '') not in ('', 'service_role') and not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- 3a. Tasks: due-day reminders and "N days before" reminders.
  for r in
    with due_tasks as (
      select t.id, t.title, t.created_by, t.is_recurring,
             (coalesce(case when t.is_recurring then t.next_due_date end, t.due_date) at time zone 'UTC')::date as due,
             case when coalesce(t.reminder_enabled, false) then greatest(coalesce(t.reminder_days_before, 0), 0)::int else 0 end as days_before
        from public.tasks t
        left join public.projects p on p.id = t.project_id
       where coalesce(t.is_completed, false) = false
         and t.created_by is not null
         and coalesce(case when t.is_recurring then t.next_due_date end, t.due_date) is not null
         and (p.id is null or coalesce(p.status, 'active') = 'active')
    ),
    candidates as (
      select d.*, 'due'::text as kind from due_tasks d
       where d.due between current_date - 3 and current_date
      union all
      select d.*, 'early'::text as kind from due_tasks d
       where d.days_before > 0
         and d.due > current_date
         and (d.due - d.days_before) between current_date - 3 and current_date
    )
    select c.* from candidates c
     where not exists (
       select 1 from public.notifications n
        where n.user_email = c.created_by
          and n.type = 'task_reminder'
          and n.metadata ->> 'task_id' = c.id
          and n.metadata ->> 'due' = c.due::text
          and n.metadata ->> 'kind' = c.kind
     )
  loop
    v_label := coalesce(nullif(trim(r.title), ''), 'A task');
    if r.kind = 'early' then
      v_when := case when r.due - current_date = 1 then 'is due tomorrow'
                     else format('is due in %s days (%s)', r.due - current_date, to_char(r.due, 'FMMonth FMDD')) end;
    else
      v_when := case when r.due = current_date then 'is due today'
                     else format('was due %s', to_char(r.due, 'FMMonth FMDD')) end;
    end if;
    v_body := format('Task "%s" %s%s.', v_label, v_when, case when r.is_recurring then ' (repeats)' else '' end);

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'task_reminder', left(v_body, 500), '/ProjectManager?tab=projects',
      jsonb_build_object('task_id', r.id, 'due', r.due, 'kind', r.kind, 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  -- 3b. Plans (projects) on their due date.
  for r in
    select p.id, p.name, p.created_by, p.due_date as due
      from public.projects p
     where coalesce(p.status, 'active') = 'active'
       and p.created_by is not null
       and p.due_date between current_date - 3 and current_date
       and not exists (
         select 1 from public.notifications n
          where n.user_email = p.created_by
            and n.type = 'task_reminder'
            and n.metadata ->> 'project_id' = p.id
            and n.metadata ->> 'due' = p.due_date::text
       )
  loop
    v_label := coalesce(nullif(trim(r.name), ''), 'A plan');
    v_when := case when r.due = current_date then 'is due today'
                   else format('was due %s', to_char(r.due, 'FMMonth FMDD')) end;
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'task_reminder', left(format('Plan "%s" %s.', v_label, v_when), 500), '/ProjectManager?tab=projects',
      jsonb_build_object('project_id', r.id, 'due', r.due, 'kind', 'due', 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  -- 3c. Future breeding plans whose season window is open.
  for r in
    select f.id, f.created_by, f.target_season, f.target_year,
           coalesce(nullif(trim(s.name), ''), 'your sire') as sire_name,
           coalesce(nullif(trim(d.name), ''), 'your dam') as dam_name
      from public.future_breeding_plans f
      left join public.geckos s on s.id = f.sire_id
      left join public.geckos d on d.id = f.dam_id
     where coalesce(f.notified, false) = false
       and f.started_breeding_plan_id is null
       and f.created_by is not null
       and public.season_window_start(f.target_season, f.target_year) is not null
       and current_date between public.season_window_start(f.target_season, f.target_year)
                            and public.season_window_end(f.target_season, f.target_year)
  loop
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'future_breeding_ready',
      left(format('Your %s %s pairing window is open: %s x %s. Open the Season Planner and tap Start this pairing.',
        initcap(r.target_season), r.target_year, r.sire_name, r.dam_name), 500),
      '/ProjectManager?tab=future',
      jsonb_build_object('future_breeding_plan_id', r.id, 'source', 'cron'),
      false, r.created_by
    );
    update public.future_breeding_plans
       set notified = true, notified_date = now()
     where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

-- 14:20 UTC is morning across the US, between the feeding reminders
-- (14:10) and the vet follow-ups (14:25). cron.schedule with an existing
-- job name updates it in place.
do $$
begin
  perform cron.schedule('season-planner-reminders-daily', '20 14 * * *',
    $cron$ select public.enqueue_season_planner_reminders(); $cron$);
end
$$;
