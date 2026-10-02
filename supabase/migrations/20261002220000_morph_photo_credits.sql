-- Morph Guide photo submissions: show approved photos with credit, and
-- stop exposing submitters' emails (2 Oct 2026, feature audit step 4, D3).
--
-- What this does:
--
-- 1. public.morph_community_photos(p_slug, p_limit): the one public way to
--    read approved member photos for a morph page. It returns the photo,
--    its date and a display name for the contributor. It never returns an
--    email. The name is the member's business name or breeder name, or
--    their full name when their profile is public, otherwise null (the
--    page then says "a Geck Inspect member"). Anything containing "@" is
--    treated as an email and dropped.
--
--    morph_guide_id holds the built-in morph slug (for example
--    'lilly-white') for submissions made after 2 Oct 2026. The table was
--    empty when this was written, so there are no older database-id rows
--    to translate.
--
-- 2. RLS on morph_reference_images. Before this, anyone (signed out
--    included) could read every row, pending and rejected ones too, with
--    the submitter's email; members could insert a row already marked
--    approved; and a member could update their own row to approved.
--    Now: members read their own rows, admins read all; members insert
--    only pending rows for themselves; only admins update.
--
-- 3. Notification title for the new 'submission_rejected' type, so a
--    rejection is no longer titled "Submission approved". The function
--    body is the 30 Sep 2026 version (20260930060855) plus one line.
--
-- Idempotent: create or replace, drop policy if exists.

-- 1. Public read of approved photos, with a safe credit name.
create or replace function public.morph_community_photos(p_slug text, p_limit integer default 12)
returns table (
  id text,
  image_url text,
  contributor_name text,
  created_date timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    m.id,
    m.image_url,
    (
      select n
        from unnest(array[
          nullif(btrim(p.business_name), ''),
          nullif(btrim(p.breeder_name), ''),
          case when p.is_public_profile is true then nullif(btrim(p.full_name), '') end
        ]) with ordinality as c(n, ord)
       where n is not null and position('@' in n) = 0
       order by ord
       limit 1
    ) as contributor_name,
    m.created_date
  from public.morph_reference_images m
  left join public.profiles p
    on lower(p.email) = lower(m.submitted_by_email)
  where m.status = 'approved'
    and m.morph_guide_id = p_slug
    and m.image_url is not null
  order by m.created_date desc
  limit least(greatest(coalesce(p_limit, 12), 1), 48);
$function$;

revoke all on function public.morph_community_photos(text, integer) from public;
grant execute on function public.morph_community_photos(text, integer) to anon, authenticated;

-- 2. Row level security on the submissions table.
alter table public.morph_reference_images enable row level security;

drop policy if exists morph_reference_images_read_all on public.morph_reference_images;
drop policy if exists morph_reference_images_read_own_or_admin on public.morph_reference_images;
create policy morph_reference_images_read_own_or_admin
  on public.morph_reference_images
  for select
  to authenticated
  using (
    (select auth.email()) = created_by
    or (select auth.email()) = submitted_by_email
    or (select public.is_admin())
  );

drop policy if exists morph_reference_images_write_own on public.morph_reference_images;
create policy morph_reference_images_write_own
  on public.morph_reference_images
  for insert
  to authenticated
  with check (
    (select auth.email()) = created_by
    and (select auth.email()) = submitted_by_email
    and status = 'pending'
  );

drop policy if exists morph_reference_images_update on public.morph_reference_images;
drop policy if exists morph_reference_images_update_admin on public.morph_reference_images;
create policy morph_reference_images_update_admin
  on public.morph_reference_images
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 3. Title for the rejection notice.
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
