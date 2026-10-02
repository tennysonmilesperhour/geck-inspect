-- Vet follow-up reminders (2 Oct 2026).
--
-- Members can now log vet visits on a gecko's record (date, vet or clinic,
-- reason, findings, treatment, follow-up date, photos of paperwork). When a
-- visit has a follow-up date, this job sends the member who logged it one
-- 'vet_followup' notification on that date, through the normal
-- notifications pipeline (bell, plus push and email by the member's own
-- settings: push rides the "Feeding & weigh-in reminders" switch and email
-- rides "Breeding & Care Updates", see send-push and send-email).
--
-- Rules:
--   * One reminder per visit and follow-up date. Moving the follow-up date
--     to a new day sends one more on the new day.
--   * A run that was missed still catches a follow-up up to 3 days late.
--   * Archived geckos (sold or passed away) get no reminders.

-- 1. Title for the new type.
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
    when 'market_alert'           then 'Watchlist match'
    when 'market_brief'           then 'Your crested gecko market today'
    when 'vet_followup'           then 'Vet follow-up'
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

-- 2. The daily job.
create or replace function public.enqueue_vet_followups()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_body text;
  v_when text;
begin
  for r in
    select v.id, v.created_by, v.animal_id, v.follow_up, v.date as visit_date,
           nullif(trim(v.reason), '') as reason,
           nullif(trim(v.vet_name), '') as vet_name,
           coalesce(nullif(trim(g.name), ''), 'Your gecko') as gecko_name
      from public.vet_records v
      join public.geckos g on g.id = v.animal_id
     where v.follow_up is not null
       and v.created_by is not null
       and v.follow_up between current_date - 3 and current_date
       and coalesce(g.archived, false) = false
       and not exists (
         select 1 from public.notifications n
          where n.user_email = v.created_by
            and n.type = 'vet_followup'
            and n.metadata ->> 'vet_record_id' = v.id::text
            and n.metadata ->> 'follow_up' = v.follow_up::text
       )
  loop
    v_when := case when r.follow_up = current_date then 'is due today'
                   else format('was due %s', to_char(r.follow_up, 'FMMonth FMDD')) end;
    v_body := format('%s''s vet follow-up %s%s%s.',
      r.gecko_name, v_when,
      case when r.reason is not null then format(' (visit for %s on %s)', r.reason, to_char(r.visit_date, 'FMMonth FMDD'))
           else format(' (visit on %s)', to_char(r.visit_date, 'FMMonth FMDD')) end,
      case when r.vet_name is not null then format(' with %s', r.vet_name) else '' end);

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'vet_followup', left(v_body, 500),
      '/GeckoDetail?id=' || r.animal_id,
      jsonb_build_object(
        'vet_record_id', r.id,
        'gecko_id', r.animal_id,
        'follow_up', r.follow_up,
        'source', 'cron'
      ),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_vet_followups() from public, anon, authenticated;
grant execute on function public.enqueue_vet_followups() to service_role;

-- 14:25 UTC is morning across the US (7:25 PT, 10:25 ET), just after the
-- feeding reminders.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'vet-followups-daily') then
    perform cron.unschedule('vet-followups-daily');
  end if;
  perform cron.schedule('vet-followups-daily', '25 14 * * *',
    $cron$ select public.enqueue_vet_followups(); $cron$);
end
$$;
