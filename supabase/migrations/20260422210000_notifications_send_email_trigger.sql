-- =============================================================================
-- Extend notify_push_on_insert() to also fan out to send-email.
-- =============================================================================
--
-- We reuse the same function (renaming would break the trigger we set
-- up in the previous migration) and add a second pg_net POST to the
-- send-email endpoint. Each call is wrapped in its own exception
-- handler so a failure in one channel never blocks the other, and
-- neither ever blocks the originating INSERT.
--
-- Configuration: one new GUC `app.send_email_url`. If it's not set,
-- we silently skip email delivery and keep sending push.
--
--   alter database postgres set "app.send_email_url" = 'https://<ref>.supabase.co/functions/v1/send-email';
--
-- The service-role key is reused from app.service_role_key.
-- =============================================================================

create or replace function public.notify_push_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_push_url   text := current_setting('app.send_push_url',     true);
  v_email_url  text := current_setting('app.send_email_url',    true);
  v_key        text := current_setting('app.service_role_key',  true);
  v_title      text;
  v_body       text;
  v_link       text;
  v_payload    jsonb;
begin
  -- No service role, no outbound calls — silent exit.
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

  v_payload := jsonb_build_object(
    'user_email', NEW.user_email,
    'type',       NEW.type,
    'title',      v_title,
    'body',       v_body,
    'url',        v_link,
    'tag',        NEW.type
  );

  -- Web push
  if v_push_url is not null and v_push_url <> '' then
    begin
      perform net.http_post(
        url := v_push_url,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := v_payload
      );
    exception when others then
      raise warning 'notify_push_on_insert: send-push call failed: %', sqlerrm;
    end;
  end if;

  -- Email
  if v_email_url is not null and v_email_url <> '' then
    begin
      perform net.http_post(
        url := v_email_url,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := v_payload
      );
    exception when others then
      raise warning 'notify_push_on_insert: send-email call failed: %', sqlerrm;
    end;
  end if;

  return NEW;
end;
$$;
