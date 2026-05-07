-- =============================================================================
-- app_settings — single source of truth for site-wide knobs
-- =============================================================================
-- Flat key/value table backed by Postgres. Stores tunables admins need
-- to flip without a code deploy: PostHog dashboard embeds, store
-- feature flags, free-shipping thresholds, loyalty thresholds, etc.
--
-- is_public = true rows are readable by anyone (anon). Private rows are
-- admin-only. Writes are always admin-only; service-role server code
-- bypasses RLS.
-- =============================================================================

-- The base44 import left behind an app_settings table with a different shape
-- (id text PK, setting_key, setting_value text). Drop any pre-existing table
-- so the canonical key/value/jsonb schema below applies cleanly.
drop table if exists public.app_settings cascade;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists app_settings_public_idx
  on public.app_settings(is_public) where is_public = true;

alter table public.app_settings enable row level security;

drop policy if exists "Public settings readable by anyone" on public.app_settings;
create policy "Public settings readable by anyone"
  on public.app_settings for select using (is_public = true);

drop policy if exists "Admins read all settings" on public.app_settings;
create policy "Admins read all settings"
  on public.app_settings for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

drop policy if exists "Admins write settings" on public.app_settings;
create policy "Admins write settings"
  on public.app_settings for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.role = 'admin'));

create or replace function public.app_settings_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch
  before update on public.app_settings
  for each row execute function public.app_settings_touch_updated_at();

insert into public.app_settings (key, value, is_public, description)
values
  ('posthog_dashboards', '[]'::jsonb, false,
    'Array of PostHog shared-dashboard embed configs rendered in the Product Analytics admin tab.'),
  ('posthog_project', jsonb_build_object('host', null, 'project_id', null), false,
    'PostHog project metadata used for deep links from the admin Product Analytics tab.')
on conflict (key) do nothing;
