-- A buyer who scans a gecko's passport QR code can ask the owner for an
-- ownership transfer, and the owner is actually told.
--
-- Until now the passport's "Ask the seller for a transfer invitation" button
-- only opened an empty chat with the owner. Nothing reached the owner unless
-- the buyer typed and sent a message, and even then the owner got a plain
-- "sent you a message" with no link to start the transfer. On 24 Oct 2026 a
-- buyer scanned a QR code, tapped the button and waited for a transfer that
-- the owner never knew about.
--
-- request_passport_transfer(passport_code) does it in one step, as the
-- signed-in buyer:
--   * writes a chat message from the buyer to the owner naming the gecko,
--     so the conversation is there for both of them;
--   * writes a transfer_request notification to the owner (in-app, and the
--     email and push the notifications trigger sends). Its link opens the
--     gecko in the owner's collection with the transfer form already open
--     and the buyer's email filled in.
-- Repeats are quiet: the same buyer asking about the same gecko again within
-- a day gets 'already_requested' and nothing new is sent. A buyer can ask
-- about at most 10 geckos an hour.
--
-- notify_dispatch_on_insert: the production body read with
-- pg_get_functiondef on 24 Oct 2026 (last written by
-- 20261015151100_reminders_and_offline_logging), with one new title line
-- for transfer_request. send-email and send-push map the type to the
-- "new message" preference in the same commit.

create or replace function public.request_passport_transfer(p_passport_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_me text := auth.email();
  v_gecko record;
  v_owner text;
  v_gecko_name text;
  v_sender_name text;
  v_tpl text;
  v_encoded text;
  v_recent integer;
begin
  if v_me is null or coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'Sign in to ask for a transfer' using errcode = '42501';
  end if;

  select g.id, g.name, g.passport_code, g.created_by
    into v_gecko
    from public.geckos g
   where g.passport_code = btrim(coalesce(p_passport_code, ''))
     and coalesce(g.archived, false) = false
   limit 1;
  if v_gecko.id is null or coalesce(btrim(v_gecko.created_by), '') = '' then
    raise exception 'Passport not found' using errcode = 'P0002';
  end if;

  v_owner := lower(btrim(v_gecko.created_by));
  if v_owner = lower(v_me) then
    raise exception 'You already own this gecko' using errcode = '22023';
  end if;

  -- Blocking stops this in both directions, as it does messages.
  if exists (select 1 from public.user_blocks b
              where (lower(b.blocker_email) = v_owner and lower(b.blocked_email) = lower(v_me))
                 or (lower(b.blocker_email) = lower(v_me) and lower(b.blocked_email) = v_owner)) then
    raise exception 'This conversation is unavailable' using errcode = '42501';
  end if;

  -- Once a day per gecko is enough: the owner already has the request.
  if exists (select 1 from public.notifications n
              where n.created_by = v_me and n.type = 'transfer_request'
                and lower(n.user_email) = v_owner
                and n.metadata ->> 'gecko_id' = v_gecko.id
                and n.created_date > now() - interval '1 day') then
    return jsonb_build_object('status', 'already_requested');
  end if;

  select count(*) into v_recent
    from public.notifications n
   where n.created_by = v_me and n.type = 'transfer_request'
     and n.created_date > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'Too many transfer requests in the last hour. Try again later.' using errcode = '54000';
  end if;

  -- The owner's own name for their own gecko, going to their own inbox.
  v_gecko_name := left(regexp_replace(btrim(coalesce(v_gecko.name, '')), '[[:space:][:cntrl:]]+', ' ', 'g'), 60);
  if v_gecko_name = '' then
    v_gecko_name := 'your gecko';
  end if;

  -- The buyer's name is member text reaching the owner from the official
  -- sender, so it goes through the same check as message notifications
  -- (_member_notification), which falls back to "A Geck Inspect member".
  v_tpl := public._member_notification(v_me, v_owner, 'new_message') ->> 'content';
  v_sender_name := regexp_replace(coalesce(v_tpl, ''), ' sent you a message\.$', '');
  if v_sender_name = '' then
    v_sender_name := 'A Geck Inspect member';
  end if;

  insert into public.direct_messages (sender_email, recipient_email, content, message_type, created_by)
  values (
    v_me,
    v_owner,
    'Hi! I scanned the passport for ' || coalesce(nullif(btrim(v_gecko.name), ''), 'this gecko')
      || ' (' || v_gecko.passport_code || ') and would like the ownership transferred to my Geck Inspect account ('
      || v_me || '). You can send the transfer from the gecko''s page in your collection.',
    'direct',
    v_me
  );

  v_encoded := replace(replace(replace(replace(replace(replace(replace(replace(
                 v_me, '%', '%25'), '+', '%2B'), '&', '%26'), '#', '%23'),
                 '?', '%3F'), '=', '%3D'), ' ', '%20'), '@', '%40');

  insert into public.notifications (user_email, type, content, link, metadata, created_by, is_read)
  values (
    v_owner,
    'transfer_request',
    v_sender_name || ' asked you to transfer ' || v_gecko_name || ' to their account.',
    case when v_gecko.id ~ '^[A-Za-z0-9_-]{1,64}$'
         then '/GeckoDetail?id=' || v_gecko.id || '&transfer_to=' || v_encoded
         else '/Messages?recipient=' || v_encoded end,
    jsonb_build_object('gecko_id', v_gecko.id, 'passport_code', v_gecko.passport_code, 'requester_email', v_me),
    v_me,
    false
  );

  return jsonb_build_object('status', 'sent');
end;
$function$;

revoke all on function public.request_passport_transfer(text) from public, anon;
grant execute on function public.request_passport_transfer(text) to authenticated;

create or replace function public.notify_dispatch_on_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'vault'
as $function$
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
  -- A hatch alert for an egg already counted in the day's grouped alert.
  if NEW.type = 'hatch_alert' and NEW.metadata ->> 'quiet' = 'true' then
    return NEW;
  end if;

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
    when 'transfer_request'       then 'Ownership transfer request'
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
    when 'submission_rejected'    then 'Photo not added to the Morph Guide'
    when 'announcement'           then 'Geck Inspect announcement'
    when 'role_change'            then 'Role updated'
    when 'referral_reward'        then 'Your referral paid off'
    when 'referral_grant_ended'   then 'Your free month of Keeper has ended'
    when 'weekly_digest'          then 'Your week on Geck Inspect'
    when 'waitlist_signup'        then 'New waitlist signup'
    when 'market_alert'           then 'Watchlist match'
    when 'market_brief'           then 'Your crested gecko market today'
    when 'vet_followup'           then 'Vet follow-up'
    when 'account_deletion_request' then 'Account deletion request'
    when 'task_reminder'          then 'Task reminder'
    when 'support_reply'          then 'Reply from Geck Inspect support'
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
