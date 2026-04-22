-- =============================================================================
-- Notification → send-push trigger.
-- =============================================================================
--
-- Every row inserted into `notifications` fires a best-effort pg_net
-- HTTP call to the `send-push` edge function. The function checks
-- per-user preferences and fans out to every device subscription.
--
-- Auth: we pass the project's service-role key in the Authorization
-- header. send-push doesn't verify caller identity beyond checking that
-- the key matches SUPABASE_SERVICE_ROLE_KEY (implicit — Supabase routes
-- service-role-signed requests with full privileges to edge functions
-- regardless of --no-verify-jwt).
--
-- Configuration: two GUCs must be set once per database. We keep them
-- as database-level settings (ALTER DATABASE ... SET ...) so they
-- survive restarts and are readable by the trigger function.
--
--   alter database postgres set "app.send_push_url" = 'https://<ref>.supabase.co/functions/v1/send-push';
--   alter database postgres set "app.service_role_key" = '<service_role_key>';
--
-- The trigger uses NULLIF + try/catch pattern so that if these settings
-- aren't configured yet (first deploy, local dev, etc.), the INSERT on
-- notifications still succeeds — we just skip the push fanout.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_push_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url   text := current_setting('app.send_push_url',     true);
  v_key   text := current_setting('app.service_role_key',  true);
  v_title text;
  v_body  text;
  v_link  text;
begin
  -- Bail cleanly if configuration isn't installed yet.
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    return NEW;
  end if;

  -- Derive friendly title + body from the notification row. `content`
  -- is usually already the full sentence (e.g. "Alice sent you a
  -- message"), so we use the type as the header and content as the
  -- body. send-push can override via its own defaults if we pass null.
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

  -- Fire and forget. pg_net is non-blocking; even on failure we don't
  -- want to rollback the notification insert.
  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'user_email', NEW.user_email,
        'type',       NEW.type,
        'title',      v_title,
        'body',       v_body,
        'url',        v_link,
        'tag',        NEW.type  -- collapse-key so 5 rapid-fire
                                --  "new_message" pushes replace each
                                --  other on the lock screen instead of
                                --  stacking.
      )
    );
  exception when others then
    raise warning 'notify_push_on_insert: pg_net call failed: %', sqlerrm;
  end;

  return NEW;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.notify_push_on_insert();

comment on function public.notify_push_on_insert() is
  'Fires a pg_net POST to the send-push edge function on every new notification. Configure app.send_push_url and app.service_role_key once via ALTER DATABASE.';
