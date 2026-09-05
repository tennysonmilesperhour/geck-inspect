-- Sunday digest (5 Sep 2026), the last open piece of launch review F35.
--
-- Hatch alerts (daily) and weigh-in reminders (weekly) already reach
-- members with the app closed. This adds one weekly summary per member
-- who keeps at least one active gecko: their collection size, eggs
-- incubating and due this week, geckos overdue for a weigh-in, and what
-- the community added. It writes a notification row; the dispatch
-- trigger on notifications turns that into an email (type weekly_digest
-- maps to the "announcements" preference in send-email). Members who
-- turned email off, or announcements off, get the in-app row only.
--
-- Runs Sundays at 16:00 UTC through pg_cron. Skips a member who already
-- received a digest in the last 6 days. Idempotent; safe to re-apply.

create or replace function public.enqueue_weekly_digest()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
  v_uploads integer;
  v_posts integer;
  v_parts text[];
  v_content text;
begin
  select count(*) into v_uploads
    from public.gecko_images
   where created_by is not null
     and created_date > now() - interval '7 days';
  select count(*) into v_posts
    from public.forum_posts
   where created_date > now() - interval '7 days';

  for r in
    select g.created_by as email,
           count(*) as geckos,
           coalesce(e.incubating, 0) as incubating,
           coalesce(e.due_soon, 0) as due_soon,
           coalesce(w.stale, 0) as stale
      from public.geckos g
      left join lateral (
        select count(*) filter (where eg.status = 'Incubating' and coalesce(eg.archived, false) = false) as incubating,
               count(*) filter (where eg.status = 'Incubating' and coalesce(eg.archived, false) = false
                                  and eg.hatch_date_expected between current_date and current_date + 7) as due_soon
          from public.eggs eg
         where eg.created_by = g.created_by
      ) e on true
      left join lateral (
        select count(*) as stale
          from public.geckos g2
          join lateral (
            select max(wr.record_date) as last_weighed
              from public.weight_records wr
             where wr.gecko_id = g2.id
          ) lw on true
         where g2.created_by = g.created_by
           and coalesce(g2.archived, false) = false
           and coalesce(g2.status, '') not in ('Sold')
           and lw.last_weighed is not null
           and lw.last_weighed < current_date - 30
      ) w on true
     where coalesce(g.archived, false) = false
       and g.created_by is not null
       and coalesce(g.status, '') not in ('Sold')
       and not exists (
         select 1 from public.notifications n
          where n.user_email = g.created_by
            and n.type = 'weekly_digest'
            and n.created_date > now() - interval '6 days'
       )
     group by g.created_by, e.incubating, e.due_soon, w.stale
  loop
    v_parts := array[
      format('%s %s in your collection', r.geckos, case when r.geckos = 1 then 'crested gecko' else 'crested geckos' end)
    ];
    if r.incubating > 0 then
      v_parts := v_parts || format('%s %s incubating%s',
        r.incubating,
        case when r.incubating = 1 then 'egg' else 'eggs' end,
        case when r.due_soon > 0
             then format(' (%s due to hatch this week)', r.due_soon)
             else '' end);
    end if;
    if r.stale > 0 then
      v_parts := v_parts || format('%s not weighed in over 30 days', r.stale);
    end if;

    v_content := 'Your week on Geck Inspect: ' || array_to_string(v_parts, ', ') || '.';
    if v_uploads > 0 or v_posts > 0 then
      v_content := v_content || format(' The community added %s %s and %s %s this week.',
        v_uploads, case when v_uploads = 1 then 'photo' else 'photos' end,
        v_posts, case when v_posts = 1 then 'forum post' else 'forum posts' end);
    end if;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.email, 'weekly_digest', v_content, '/Dashboard',
      jsonb_build_object(
        'geckos', r.geckos, 'incubating', r.incubating, 'due_soon', r.due_soon,
        'stale_weighins', r.stale, 'community_uploads', v_uploads, 'community_posts', v_posts,
        'source', 'cron'
      ),
      false, r.email
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.enqueue_weekly_digest() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-digest-sunday') then
    perform cron.unschedule('weekly-digest-sunday');
  end if;
  perform cron.schedule('weekly-digest-sunday', '0 16 * * 0', $cron$ select public.enqueue_weekly_digest(); $cron$);
end
$$;
