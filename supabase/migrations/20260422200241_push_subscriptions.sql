-- =============================================================================
-- push_subscriptions: one row per browser/device a user has enabled push on.
-- =============================================================================
--
-- Web-push subscriptions are per-device, per-browser. A single user who has
-- installed the PWA on both their iPhone and an Android tablet will own two
-- rows here, each keyed by a different `endpoint`. The endpoint is globally
-- unique across the whole web (it's the URL the push service hands back when
-- we subscribe), so we enforce uniqueness on it directly — not on
-- (user_email, endpoint) — to make re-subscribe logic simpler.
--
-- Rows are deleted, never soft-deleted: once a push returns 410 Gone (the
-- endpoint has been unsubscribed), the row is useless and the user will
-- re-subscribe from the current device's fresh keys on their next visit.
--
-- `user_email` is the owner. We match existing app convention (profiles,
-- notifications, etc. all key on email) rather than auth.users.id — this
-- keeps RLS policies straightforward and lets the send-push edge function
-- look up subscriptions without joining against auth.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_email   text not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  platform     text,               -- "ios" | "android" | "desktop" | "other"
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_email_idx
  on public.push_subscriptions (user_email);

create index if not exists push_subscriptions_last_seen_idx
  on public.push_subscriptions (last_seen_at desc);

-- Row-level security: a user can only see/delete their own subscriptions.
-- The edge functions that SEND pushes run under the service-role key and
-- bypass RLS entirely — that's fine, they're trusted server code.
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions
  for select
  using ( auth.jwt() ->> 'email' = user_email );

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
  on public.push_subscriptions
  for insert
  with check ( auth.jwt() ->> 'email' = user_email );

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
  on public.push_subscriptions
  for update
  using ( auth.jwt() ->> 'email' = user_email )
  with check ( auth.jwt() ->> 'email' = user_email );

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
  on public.push_subscriptions
  for delete
  using ( auth.jwt() ->> 'email' = user_email );

-- =============================================================================
-- profiles: flags for whether push is enabled, and which notification types
-- the user wants to receive via push.
-- =============================================================================
--
-- Mirrors the existing email-preferences fields on profiles:
--   email_notifications_enabled (bool)
--   email_notification_types (text[])
--
-- Defaults: enabled = false (opt-in gated by the in-app permission flow),
-- allowed types = the same curated list we enable for email by default.
-- Users refine both in Settings.
-- =============================================================================

alter table public.profiles
  add column if not exists push_notifications_enabled boolean default false not null;

alter table public.profiles
  add column if not exists push_notification_types text[]
    default array[
      'new_message',
      'marketplace_inquiry',
      'hatch_alert',
      'feeding_due',
      'new_comment',
      'new_reply',
      'announcement'
    ]::text[];

-- Backfill existing rows where the column was just added as null.
update public.profiles
   set push_notification_types = array[
         'new_message',
         'marketplace_inquiry',
         'hatch_alert',
         'feeding_due',
         'new_comment',
         'new_reply',
         'announcement'
       ]::text[]
 where push_notification_types is null;

comment on column public.profiles.push_notifications_enabled is
  'Master toggle for web push. User must also have an entry in push_subscriptions; this just lets them pause pushes without un-registering the SW.';

comment on column public.profiles.push_notification_types is
  'Which Notification.type values to deliver via web push. Empty array = none.';
