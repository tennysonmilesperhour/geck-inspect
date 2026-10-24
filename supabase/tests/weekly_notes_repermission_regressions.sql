-- The re-permission email ("still want Weekly Gecko Notes?"): who is due
-- it, the claim's per-inbox lock, once per inbox, the keep button, the
-- hourly job and its switch, and account erasure. Regression checks for
-- supabase/migrations/20261024150000_weekly_notes_personal_and_repermission.sql
-- and 20261024201200_weekly_notes_repermission_fixes.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser,
-- the same way as supabase/tests/weekly_notes_regressions.sql. It moves the
-- clock with the p_now argument the functions take. Every change rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/weekly_notes_repermission_regressions.sql
--
-- Each block raises "FAIL: ..." when a rule is broken. The last line
-- prints "weekly notes re-permission regressions: all passed".
begin;

create temp table _t0 on commit drop as
  select coalesce((select max(id) from net.http_request_queue), 0) as net_before;
grant all on _t0 to public;

-- A member as Supabase Auth makes one, with a chosen last sign-in.
create function pg_temp.mk(p_email text, p_created timestamptz, p_signed_in timestamptz)
returns void language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email,
          'not-a-real-password', p_created, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
          p_created, p_created, p_signed_in);
  if not exists (select 1 from public.profiles where email = p_email) then
    insert into public.profiles (email) values (p_email);
  end if;
  update public.profiles
     set email_notifications_enabled = true, email_weekly_notes_enabled = true
   where email = p_email;
end $$;

create function pg_temp.rcand(p_email text, p_at timestamptz default now(), p_ignore_polls boolean default true)
returns boolean language sql as $$
  select exists (select 1 from public.weekly_notes_repermission_candidates(p_at, p_ignore_polls) c where c.email = p_email)
$$;

create function pg_temp.wcand(p_email text, p_at timestamptz default now())
returns boolean language sql as $$
  select exists (select 1 from public.weekly_notes_candidates(p_at, true) c where c.email = p_email)
$$;

grant execute on all functions in schema pg_temp to public;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notification_service_role_key') then
    perform vault.create_secret('local-test-key', 'notification_service_role_key', 'test');
  end if;
  if not exists (select 1 from vault.secrets where name = 'email_unsubscribe_secret') then
    perform vault.create_secret('local-unsubscribe-secret', 'email_unsubscribe_secret', 'test');
  end if;
end $$;

-- 1. Who is due it ---------------------------------------------------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '120 days';
begin
  -- No gecko, no sign-in in 60 days, no recent yes: the weekly notes leave
  -- this member out, and the re-permission email is for them.
  perform pg_temp.mk('quiet.keeper@example.com', v_old, v_old);
  if pg_temp.wcand('quiet.keeper@example.com') then
    raise exception 'FAIL: setup, the relevance gate should leave this member out of the weekly notes';
  end if;
  if not pg_temp.rcand('quiet.keeper@example.com') then
    raise exception 'FAIL: a member the relevance gate leaves out is not due the re-permission email';
  end if;
  -- A member with a gecko on record gets the notes, not this email.
  perform pg_temp.mk('busy.keeper@example.com', v_old, v_old);
  insert into public.geckos (name, created_by) values ('Juniper', 'busy.keeper@example.com');
  if pg_temp.rcand('busy.keeper@example.com') then
    raise exception 'FAIL: a member with a gecko on record was asked whether they still want the notes';
  end if;
  -- So does a member who signed in recently.
  perform pg_temp.mk('back.keeper@example.com', v_old, now() - interval '3 days');
  if pg_temp.rcand('back.keeper@example.com') then
    raise exception 'FAIL: a member who signed in this week was asked whether they still want the notes';
  end if;
  -- A member who turned the notes off is never asked.
  perform pg_temp.mk('off.keeper@example.com', v_old, v_old);
  update public.profiles set email_weekly_notes_enabled = false where email = 'off.keeper@example.com';
  if pg_temp.rcand('off.keeper@example.com') then
    raise exception 'FAIL: a member with the notes off was asked whether they still want them';
  end if;
end $$;

-- 2. The claim locks the inbox, and one inbox gets one email --------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '120 days';
  v jsonb;
begin
  -- Two accounts on one Gmail inbox (a dotted and a plus-tag spelling).
  perform pg_temp.mk('dor.mant7@gmail.com', v_old, v_old);
  perform pg_temp.mk('dormant7+test@gmail.com', v_old, v_old);
  if not pg_temp.rcand('dor.mant7@gmail.com') or not pg_temp.rcand('dormant7+test@gmail.com') then
    raise exception 'FAIL: setup, both accounts on the inbox should be due';
  end if;

  v := public.claim_weekly_notes_repermission('dor.mant7@gmail.com', now());
  if v->>'claimed' is distinct from 'true' then
    raise exception 'FAIL: the first claim for the inbox did not go through: %', v;
  end if;
  -- The lock key is the inbox, so the other account's claim waits for this
  -- one and then sees its row (checked here through pg_locks, since one
  -- session cannot race itself).
  if not exists (select 1 from pg_locks l
                  where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.objsubid = 1
                    and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended('weekly_notes:dormant7@gmail.com', 0)) then
    raise exception 'FAIL: the re-permission claim did not lock the inbox';
  end if;
  v := public.claim_weekly_notes_repermission('dormant7+test@gmail.com', now());
  if v->>'reason' is distinct from 'not-eligible' then
    raise exception 'FAIL: the re-permission email went twice to one inbox: %', v;
  end if;
  if pg_temp.rcand('dor.mant7@gmail.com') or pg_temp.rcand('dormant7+test@gmail.com') then
    raise exception 'FAIL: an inbox that had the re-permission email is still due it';
  end if;
end $$;

-- 3. The keep button ---------------------------------------------------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '120 days';
  v_id uuid;
  v_token text;
begin
  perform pg_temp.mk('keeps.them@example.com', v_old, v_old);
  perform public.claim_weekly_notes_repermission('keeps.them@example.com', now());
  select id into v_id from public.profiles where email = 'keeps.them@example.com';
  v_token := public.email_unsubscribe_token(v_id::text);
  if public.keep_weekly_notes_by_token(v_token || 'x') then
    raise exception 'FAIL: the keep button accepted a changed token';
  end if;
  if not public.keep_weekly_notes_by_token(v_token) then
    raise exception 'FAIL: the keep button refused its own token';
  end if;
  if (select kept_at from public.weekly_notes_repermission_sends where email = 'keeps.them@example.com') is null then
    raise exception 'FAIL: the keep button did not record the yes on the re-permission record';
  end if;
  -- A yes on purpose lets the member through the relevance gate.
  if not pg_temp.wcand('keeps.them@example.com') then
    raise exception 'FAIL: a member who pressed keep still gets no weekly notes';
  end if;
end $$;

-- 4. The hourly job and its switch -----------------------------------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '120 days';
  v_n integer;
begin
  perform pg_temp.mk('job.quiet@example.com', v_old, v_old);
  update public.app_settings set value = 'false'::jsonb where key = 'weekly_notes_repermission_enabled';
  if public.enqueue_weekly_notes_repermission(now(), 1000) <> 0 then
    raise exception 'FAIL: the re-permission job asked with its switch off';
  end if;
  update public.app_settings set value = 'true'::jsonb where key = 'weekly_notes_repermission_enabled';
  v_n := public.enqueue_weekly_notes_repermission(now(), 1000);
  if not exists (
    select 1 from net.http_request_queue q
     where q.id > (select net_before from _t0)
       and convert_from(q.body, 'UTF8')::jsonb->>'user_email' = 'job.quiet@example.com'
       and convert_from(q.body, 'UTF8')::jsonb->>'type' = 'weekly_notes_repermission'
  ) then
    raise exception 'FAIL: the re-permission job did not ask about a member who is due (asked %)', v_n;
  end if;
  -- It shares the weekly notes' poll row: asked once, not again within 20 hours.
  if pg_temp.rcand('job.quiet@example.com', now() + interval '1 hour', false) then
    raise exception 'FAIL: the re-permission job would ask about the same member again within 20 hours';
  end if;
  update public.app_settings set value = 'false'::jsonb where key = 'weekly_notes_repermission_enabled';
end $$;

-- 5. Account erasure removes the record ------------------------------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '120 days';
begin
  perform pg_temp.mk('gone.keeper@example.com', v_old, v_old);
  perform public.claim_weekly_notes_repermission('gone.keeper@example.com', now());
  if not exists (select 1 from public.weekly_notes_repermission_sends where email = 'gone.keeper@example.com') then
    raise exception 'FAIL: setup, the claim should have written the record';
  end if;
  perform public.admin_erase_account('gone.keeper@example.com');
  if exists (select 1 from public.weekly_notes_repermission_sends where email = 'gone.keeper@example.com') then
    raise exception 'FAIL: account erasure left the re-permission record';
  end if;
end $$;

select 'weekly notes re-permission regressions: all passed' as result;
rollback;
