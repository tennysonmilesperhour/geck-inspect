-- Per-feeding-group reminder switch. Mirrors
-- public.other_reptiles.feeding_reminder_enabled so the alert system can
-- gate both entity types on the same flag. Defaults to true so groups
-- created before this column existed keep firing alerts (matching the
-- prior behavior).
alter table public.feeding_groups
  add column if not exists feeding_reminder_enabled boolean not null default true;
