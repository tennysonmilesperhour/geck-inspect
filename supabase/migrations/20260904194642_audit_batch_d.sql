-- Audit batch D (4 Sep 2026).
-- F38: vet, feeding, shed and ownership records were readable by anyone
--      holding the anon key ("Public can read ..." USING true). Reads are
--      now limited to the owner, the record's author, admins, and anyone
--      viewing a gecko whose owner made its passport public. The passport
--      page (AnimalPassport.jsx) is the only public reader of these tables
--      and it already refuses to show a non-public gecko.
-- F35: hatch and weigh-in reminders only existed as browser pollers, so a
--      member who closed the tab heard nothing. Two pg_cron jobs now write
--      the same notification rows server-side; the existing dispatch
--      trigger on notifications turns them into push and email.

-- ---------------------------------------------------------------------
-- F38. Scoped SELECT policies
-- ---------------------------------------------------------------------
create or replace function public.gecko_passport_is_public(p_animal_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.geckos g
     where g.id = p_animal_id
       and g.passport_code is not null
       and g.is_public = true
  );
$$;
revoke all on function public.gecko_passport_is_public(text) from public;
grant execute on function public.gecko_passport_is_public(text) to anon, authenticated, service_role;

drop policy if exists "Public can read vet records" on public.vet_records;
drop policy if exists vet_records_read on public.vet_records;
create policy vet_records_read on public.vet_records
  for select to anon, authenticated
  using (
    created_by = auth.email()
    or public.is_admin()
    or public.gecko_passport_is_public(animal_id)
  );

drop policy if exists "Public can read feeding records" on public.feeding_records;
drop policy if exists feeding_records_read on public.feeding_records;
create policy feeding_records_read on public.feeding_records
  for select to anon, authenticated
  using (
    created_by = auth.email()
    or logged_by = auth.uid()
    or public.is_admin()
    or public.gecko_passport_is_public(animal_id)
  );

drop policy if exists "Public can read shed records" on public.shed_records;
drop policy if exists shed_records_read on public.shed_records;
create policy shed_records_read on public.shed_records
  for select to anon, authenticated
  using (
    created_by = auth.email()
    or public.is_admin()
    or public.gecko_passport_is_public(animal_id)
  );

drop policy if exists "Public can read ownership records" on public.ownership_records;
drop policy if exists ownership_records_read on public.ownership_records;
create policy ownership_records_read on public.ownership_records
  for select to anon, authenticated
  using (
    created_by = auth.email()
    or owner_user_id = auth.uid()
    or public.is_admin()
    or public.gecko_passport_is_public(animal_id)
  );

create index if not exists vet_records_animal_id_idx on public.vet_records (animal_id);
create index if not exists feeding_records_animal_id_idx on public.feeding_records (animal_id);
create index if not exists shed_records_animal_id_idx on public.shed_records (animal_id);
create index if not exists ownership_records_animal_id_idx on public.ownership_records (animal_id);
create index if not exists geckos_passport_code_idx on public.geckos (passport_code) where passport_code is not null;

-- ---------------------------------------------------------------------
-- F35. Server-side reminders
-- ---------------------------------------------------------------------
-- Mirrors HatchAlertSystem.jsx: an egg is due once it has incubated for
-- the owner's hatch_alert_days (default 60). One alert per egg per week,
-- shared with the browser poller through the notifications table.
create or replace function public.enqueue_hatch_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
  return v_count;
end;
$$;
revoke all on function public.enqueue_hatch_alerts() from public, anon, authenticated;

-- One weekly nudge per member whose active geckos have gone 30+ days
-- without a weigh-in. Sold geckos are skipped.
create or replace function public.enqueue_weighin_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select g.created_by, count(*) as stale
      from public.geckos g
      join lateral (
        select max(w.record_date) as last_weighed
          from public.weight_records w
         where w.gecko_id = g.id
      ) lw on true
     where coalesce(g.archived, false) = false
       and g.created_by is not null
       and coalesce(g.status, '') not in ('Sold')
       and lw.last_weighed is not null
       and lw.last_weighed < current_date - 30
       and not exists (
         select 1 from public.notifications n
          where n.user_email = g.created_by
            and n.type = 'weighin_reminder'
            and n.created_date > now() - interval '6 days'
       )
     group by g.created_by
  loop
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'weighin_reminder',
      format('%s of your geckos %s not been weighed in over 30 days. A quick weigh-in keeps growth charts and breeding readiness accurate.',
             r.stale, case when r.stale = 1 then 'has' else 'have' end),
      '/MyGeckos',
      jsonb_build_object('stale_count', r.stale, 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.enqueue_weighin_reminders() from public, anon, authenticated;

-- 13:00 UTC is 06:00 Arizona, before most keepers check enclosures.
select cron.schedule('hatch-alerts-daily', '0 13 * * *', $cron$ select public.enqueue_hatch_alerts(); $cron$);
select cron.schedule('weighin-reminders-weekly', '0 15 * * 0', $cron$ select public.enqueue_weighin_reminders(); $cron$);
