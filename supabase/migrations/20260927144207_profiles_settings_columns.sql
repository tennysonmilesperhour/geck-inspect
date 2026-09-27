-- Settings.jsx saves its whole form to profiles, but 16 of its fields had no
-- column there. PostgREST rejected the upsert, so every Settings save since
-- April 2026 failed after writing only to auth metadata: server-side readers
-- (hatch alerts, notification dispatch, reminders) never saw the change.
-- profiles is readable only by its owner and admins (profiles_read_owner_admin),
-- so the contact fields below are not exposed publicly.

alter table public.profiles
  add column if not exists allow_profile_clicks boolean default true,
  add column if not exists breeder_name text,
  add column if not exists business_address text,
  add column if not exists calendar_alert_types text[],
  add column if not exists calendar_alerts_enabled boolean default true,
  add column if not exists default_gallery_sort text,
  add column if not exists default_gecko_sort text,
  add column if not exists default_reptile_sort text,
  add column if not exists email_contact text,
  add column if not exists favorite_page_names text[],
  add column if not exists feeding_alerts_enabled boolean default true,
  add column if not exists feeding_late_reminders_enabled boolean default false,
  add column if not exists phone_contact text,
  add column if not exists show_username_on_images boolean default true,
  add column if not exists specialties text[],
  add column if not exists years_experience text;

-- Accounts that saved Settings while the upsert was failing have their
-- latest choices in auth metadata only. Copy the notification settings the
-- server reads, so what they chose is what now runs.
update public.profiles p
   set hatch_alert_days = coalesce(nullif(u.raw_user_meta_data->>'hatch_alert_days', '')::numeric, p.hatch_alert_days),
       feeding_alerts_enabled = coalesce((u.raw_user_meta_data->>'feeding_alerts_enabled')::boolean, p.feeding_alerts_enabled),
       feeding_late_reminders_enabled = coalesce((u.raw_user_meta_data->>'feeding_late_reminders_enabled')::boolean, p.feeding_late_reminders_enabled),
       push_notifications_enabled = coalesce((u.raw_user_meta_data->>'push_notifications_enabled')::boolean, p.push_notifications_enabled),
       email_notifications_enabled = coalesce((u.raw_user_meta_data->>'email_notifications_enabled')::boolean, p.email_notifications_enabled),
       updated_date = now()
  from auth.users u
 where u.email = p.email
   and u.raw_user_meta_data ? 'feeding_alerts_enabled';
