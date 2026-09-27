-- Hatch alerts used to repeat every 7 days for as long as an egg stayed
-- "Incubating". Eggs that hatched or failed without a status update kept
-- alerting forever: in the 30 days to 27 Sep 2026, 28 of 48 hatch alerts were
-- for eggs past 120 days, one laid 410 days earlier. Crested gecko eggs hatch
-- in roughly 60 to 120 days depending on temperature.
--
-- Now: weekly alerts run from hatch_alert_days (default 60) until the hatch
-- window closes, which is 30 days past the expected hatch date, or 150 days
-- after lay when there is no estimate. After that the owner gets one final
-- "did it hatch?" reminder per egg, then nothing.

create or replace function public.enqueue_hatch_alerts()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_days_incubating integer;
  v_days_to_expected integer;
  v_body text;
begin
  for r in
    select e.id, e.created_by, e.lay_date, e.hatch_date_expected
      from public.eggs e
      left join public.profiles p on p.email = e.created_by
     where e.status = 'Incubating'
       and coalesce(e.archived, false) = false
       and e.lay_date is not null
       and e.created_by is not null
       and (current_date - e.lay_date) >= coalesce(p.hatch_alert_days, 60)
       and current_date <= coalesce(e.hatch_date_expected + 30, e.lay_date + 150)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = e.created_by
            and n.type = 'hatch_alert'
            and n.metadata ->> 'egg_id' = e.id
            and n.created_date > now() - interval '7 days'
       )
  loop
    v_days_incubating := current_date - r.lay_date;
    v_days_to_expected := case when r.hatch_date_expected is null then null
                               else r.hatch_date_expected - current_date end;
    v_body := case
      when v_days_to_expected is not null and v_days_to_expected >= 0 then
        format('An egg in your incubator is due to hatch in %s day%s (incubating for %s days). Time to check on it.',
               v_days_to_expected, case when v_days_to_expected = 1 then '' else 's' end, v_days_incubating)
      when v_days_to_expected is not null then
        format('An egg in your incubator is %s day%s past its expected hatch date. Check on it as soon as you can.',
               abs(v_days_to_expected), case when abs(v_days_to_expected) = 1 then '' else 's' end)
      else
        format('An egg has been incubating for %s days, within the hatch window.', v_days_incubating)
    end;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'hatch_alert', v_body, '/Breeding',
      jsonb_build_object(
        'egg_id', r.id,
        'lay_date', r.lay_date,
        'hatch_date_expected', r.hatch_date_expected,
        'days_incubating', v_days_incubating,
        'source', 'cron'
      ),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  -- Past the hatch window: one status check per egg, ever.
  for r in
    select e.id, e.created_by, e.lay_date
      from public.eggs e
     where e.status = 'Incubating'
       and coalesce(e.archived, false) = false
       and e.lay_date is not null
       and e.created_by is not null
       and current_date > coalesce(e.hatch_date_expected + 30, e.lay_date + 150)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = e.created_by
            and n.type = 'hatch_alert'
            and n.metadata ->> 'egg_id' = e.id
            and n.metadata ->> 'kind' = 'status_check'
       )
  loop
    v_days_incubating := current_date - r.lay_date;
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'hatch_alert',
      format('An egg laid %s is still marked incubating after %s days, past its hatch window. If it hatched or did not make it, update it on the Breeding page so your records stay accurate. This is the last reminder for this egg.',
             to_char(r.lay_date, 'FMMonth FMDD, YYYY'), v_days_incubating),
      '/Breeding',
      jsonb_build_object(
        'egg_id', r.id,
        'lay_date', r.lay_date,
        'days_incubating', v_days_incubating,
        'kind', 'status_check',
        'source', 'cron'
      ),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;
