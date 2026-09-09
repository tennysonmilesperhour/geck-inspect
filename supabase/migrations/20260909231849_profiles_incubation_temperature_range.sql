alter table public.profiles
  add column if not exists incubation_temperature_range text;

alter table public.profiles
  drop constraint if exists profiles_incubation_temperature_range_check;

alter table public.profiles
  add constraint profiles_incubation_temperature_range_check
  check (incubation_temperature_range is null or incubation_temperature_range in ('cool', 'balanced', 'warm'));

update public.profiles
set incubation_temperature_range = 'balanced',
    hatch_alert_days = 65
where incubation_temperature_range is null
  and (hatch_alert_days is null or hatch_alert_days = 60);

comment on column public.profiles.incubation_temperature_range is
  'Default crested gecko egg incubation profile used for hatch estimates and alert timing.';
