-- Give waitlist signup notifications (added 29 Sep 2026 with waitlists
-- with deposits) their own push and email title instead of the generic
-- "Geck Inspect". The rest of the function is unchanged.
CREATE OR REPLACE FUNCTION public.notify_dispatch_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
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
    when 'weighin_reminder'       then 'Weigh-in reminder'
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
    when 'referral_reward'        then 'Your referral paid off'
    when 'referral_grant_ended'   then 'Your free month of Keeper has ended'
    when 'weekly_digest'          then 'Your week on Geck Inspect'
    when 'waitlist_signup'        then 'New waitlist signup'
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
$function$;
