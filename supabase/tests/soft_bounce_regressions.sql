-- Regression checks for supabase/migrations/20261028025800_soft_bounce_suppression.sql:
-- an address that soft bounced on 3 different emails within 30 days goes
-- on email_suppressions as 'soft_bounced', and a stronger reason (a hard
-- bounce, a spam report) always wins. Run on a copy of the harness
-- template (scripts/sql-harness/run-tests.sh); everything rolls back.

begin;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'full.box@example.com',
        'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
       ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'one.email@example.com',
        'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
       ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'hard.later@example.com',
        'x', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

create function pg_temp.soft(p_key text, p_email_id text, p_email text, p_at timestamptz default now())
returns boolean language sql as $$
  select public.record_email_event('bounced', p_key, p_email_id, p_email, 'weekly_notes', p_at,
                                   '{"bounce_type":"Transient","bounce_subtype":"MailboxFull"}'::jsonb)
$$;

do $$
begin
  -- Two soft bounces: still mailed.
  perform pg_temp.soft('b1', 'em-1', 'full.box@example.com');
  perform pg_temp.soft('b2', 'em-2', 'full.box@example.com');
  if exists (select 1 from public.email_suppressions where email = 'full.box@example.com') then
    raise exception 'FAIL: two soft bounces suppressed the address';
  end if;
  -- The third, on a third email: suppressed as soft_bounced.
  perform pg_temp.soft('b3', 'em-3', 'full.box@example.com');
  if (select reason from public.email_suppressions where email = 'full.box@example.com') is distinct from 'soft_bounced' then
    raise exception 'FAIL: three soft bounces on three emails did not suppress the address';
  end if;
  if not public.email_inbox_suppressed('full.box@example.com') then
    raise exception 'FAIL: the soft-bounced address still counts as mailable';
  end if;

  -- Three soft-bounce events on one email (retries) are one email, not three.
  perform pg_temp.soft('c1', 'em-9', 'one.email@example.com');
  perform pg_temp.soft('c2', 'em-9', 'one.email@example.com');
  perform pg_temp.soft('c3', 'em-9', 'one.email@example.com');
  if exists (select 1 from public.email_suppressions where email = 'one.email@example.com') then
    raise exception 'FAIL: retries of one email counted as three soft bounces';
  end if;
  -- Older than 30 days does not count.
  perform pg_temp.soft('c4', 'em-10', 'one.email@example.com', now() - interval '40 days');
  perform pg_temp.soft('c5', 'em-11', 'one.email@example.com');
  if exists (select 1 from public.email_suppressions where email = 'one.email@example.com') then
    raise exception 'FAIL: a soft bounce older than 30 days was counted';
  end if;

  -- A replayed webhook event (same key) adds nothing.
  if pg_temp.soft('c5', 'em-11', 'one.email@example.com') then
    raise exception 'FAIL: a replayed event was recorded twice';
  end if;

  -- A soft-bounced address that later hard bounces becomes 'bounced';
  -- a soft bounce never downgrades a hard bounce or a complaint.
  perform pg_temp.soft('d1', 'em-21', 'hard.later@example.com');
  perform pg_temp.soft('d2', 'em-22', 'hard.later@example.com');
  perform pg_temp.soft('d3', 'em-23', 'hard.later@example.com');
  perform public.record_email_event('bounced', 'd4', 'em-24', 'hard.later@example.com', 'weekly_notes', now(),
                                    '{"bounce_type":"Permanent","bounce_subtype":"General"}'::jsonb);
  if (select reason from public.email_suppressions where email = 'hard.later@example.com') is distinct from 'bounced' then
    raise exception 'FAIL: a hard bounce did not replace soft_bounced';
  end if;
  perform pg_temp.soft('d5', 'em-25', 'hard.later@example.com');
  if (select reason from public.email_suppressions where email = 'hard.later@example.com') is distinct from 'bounced' then
    raise exception 'FAIL: a soft bounce replaced a hard bounce';
  end if;
  perform public.record_email_event('complained', 'd6', 'em-26', 'hard.later@example.com', 'weekly_notes', now(), '{}'::jsonb);
  perform pg_temp.soft('d7', 'em-27', 'hard.later@example.com');
  if (select reason from public.email_suppressions where email = 'hard.later@example.com') is distinct from 'complained' then
    raise exception 'FAIL: the spam report did not stay the reason';
  end if;

  -- A visitor address (no login) is not kept in the log, so it cannot be counted.
  perform pg_temp.soft('v1', 'em-31', 'visitor.box@example.com');
  perform pg_temp.soft('v2', 'em-32', 'visitor.box@example.com');
  perform pg_temp.soft('v3', 'em-33', 'visitor.box@example.com');
  if exists (select 1 from public.email_suppressions where email = 'visitor.box@example.com') then
    raise exception 'FAIL: expected no soft-bounce suppression for an address the log does not keep';
  end if;
end $$;

rollback;
