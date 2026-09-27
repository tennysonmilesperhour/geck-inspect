-- ProfileSettings saves these two storefront links alongside the rest of the
-- profile; without columns the whole save was rejected (see
-- profiles_settings_columns). Owner/admin-only read, like the rest of profiles.
alter table public.profiles
  add column if not exists morphmarket_url text,
  add column if not exists palm_street_url text;
