-- =============================================================================
-- profiles.email_notifications_* + email fanout from notifications-INSERT
-- =============================================================================
--
-- Companion to 20260422200241_push_subscriptions.sql, which set up the
-- push side. The email side was implied by the send-email edge function
-- but the columns it reads were never created and the
-- notifications-INSERT trigger only POSTed to send-push. As a result,
-- nothing in the Settings.jsx Email Notifications card actually
-- persisted, and no transactional emails fired off the notifications
-- table.
--
-- This migration:
--   1. Adds email_notifications_enabled + email_notification_types to
--      profiles, mirroring the push columns.
--   2. Replaces notify_push_on_insert with notify_dispatch_on_insert,
--      which POSTs the same payload to BOTH send-push and send-email
--      via pg_net. Each function checks per-user prefs independently.
--   3. Reads the service-role key from Vault (notification_service_role_key
--      secret). Edge function URLs are hardcoded — they aren't secrets,
--      and ALTER DATABASE for GUCs is not available to any user role on
--      hosted Supabase.
-- =============================================================================

-- 1. profiles columns ------------------------------------------------------

alter table public.profiles
  add column if not exists email_notifications_enabled boolean default true not null;

alter table public.profiles
  add column if not exists email_notification_types text[]
    default array[
      'level_up',
      'expert_status',
      'new_message',
      'new_follower',
      'following_activity',
      'gecko_of_day',
      'forum_replies',
      'breeding_updates',
      'announcements'
    ]::text[];

update public.profiles
   set email_notification_types = array[
         'level_up',
         'expert_status',
         'new_message',
         'new_follower',
         'following_activity',
         'gecko_of_day',
         'forum_replies',
         'breeding_updates',
         'announcements'
       ]::text[]
 where email_notification_types is null;

comment on column public.profiles.email_notifications_enabled is
  'Master toggle for transactional + alert emails.';

comment on column public.profiles.email_notification_types is
  'Which email-grouping keys to deliver. Empty array = all email muted (master toggle still rules).';

-- 2. Replace the trigger with one that fans out to BOTH channels ----------
--
-- Hosted Supabase does not allow ALTER DATABASE postgres SET ... from
-- any role available to users (including the dashboard SQL editor),
-- so a GUC-based config strategy is unreachable. We use Vault for the
-- only actually-secret value (the service-role key) and hardcode the
-- two URLs, which aren't secret — the function names and project ref
-- are visible from the Edge Functions list and every Supabase URL.
--
-- Setup left to the user (one statement in the dashboard SQL editor):
--
--   select vault.create_secret(
--     '<service-role-key>',
--     'notification_service_role_key'
--   );
--
-- Re-issue the same call to rotate the key; vault.create_secret
-- upserts by name.

create or replace function public.notify_dispatch_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_push_url  constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-push';
  v_email_url constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-email';
  v_key       text;
  v_title     text;
  v_body      text;
  v_link      text;
  v_payload   jsonb;
  v_headers   jsonb;
begin
  -- Pull the service-role key from Vault. If it's not configured,
  -- skip both channels cleanly so the notifications INSERT itself
  -- still succeeds.
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;

  if v_key is null or v_key = '' then
    return NEW;
  end if;

  v_title := case NEW.type
    when 'new_message'            then 'New message'
    when 'marketplace_inquiry'    then 'Marketplace inquiry'
    when 'hatch_alert'            then 'Hatch alert'
    when 'feeding_due'            then 'Feeding due'
    when 'new_comment'            then 'New comment'
    when 'new_reply'              then 'New reply'
    when 'new_follower'           then 'New follower'
    when 'new_gecko_listing'      then 'New gecko listed'
    when 'new_breeding_plan'      then 'New breeding plan'
    when 'future_breeding_ready'  then 'Breeding window ready'
    when 'gecko_of_the_day'       then 'Gecko of the Day'
    when 'level_up'               then 'Level up!'
    when 'expert_status'          then 'Expert status update'
    when 'submission_approved'    then 'Submission approved'
    when 'announcement'           then 'Geck Inspect announcement'
    when 'role_change'            then 'Role updated'
    else 'Geck Inspect'
  end;
  v_body := coalesce(NEW.content, '');
  v_link := coalesce(NEW.link, '/');

  v_headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || v_key
  );

  v_payload := jsonb_build_object(
    'user_email', NEW.user_email,
    'type',       NEW.type,
    'title',      v_title,
    'body',       v_body,
    'url',        v_link,
    'tag',        NEW.type
  );

  begin
    perform net.http_post(url := v_push_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-push pg_net call failed: %', sqlerrm;
  end;

  begin
    perform net.http_post(url := v_email_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-email pg_net call failed: %', sqlerrm;
  end;

  return NEW;
end;
$$;

-- Replace the older push-only trigger with the unified dispatcher.
drop trigger if exists notifications_send_push on public.notifications;
drop trigger if exists notifications_send_dispatch on public.notifications;
create trigger notifications_send_dispatch
  after insert on public.notifications
  for each row execute function public.notify_dispatch_on_insert();

-- The old push-only handler is now orphaned. Drop it so the function
-- list stays accurate and the advisor's "anon-callable security
-- definer" warning clears for it.
drop function if exists public.notify_push_on_insert();

-- This is a trigger function, not an RPC. Revoking EXECUTE removes
-- the /rest/v1/rpc surface; the trigger still fires on inserts
-- because Postgres bypasses EXECUTE checks for triggers.
revoke execute on function public.notify_dispatch_on_insert() from anon, authenticated, public;

comment on function public.notify_dispatch_on_insert() is
  'Fires pg_net POSTs to send-push and send-email on every new notification. Configured via app.send_push_url, app.send_email_url, and app.service_role_key DB-level settings.';
