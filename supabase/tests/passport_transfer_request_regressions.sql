-- A buyer's transfer request from a passport page reaches the owner.
-- Regression checks for supabase/migrations/20261024181000_passport_transfer_request.sql.
--
--   bash scripts/sql-harness/run-tests.sh geck_harness supabase/tests/passport_transfer_request_regressions.sql
begin;
\ir ../../scripts/sql-harness/impersonate.sql
select test_helpers.create_user('ptr-owner@example.com', 'Pangea Geckos');
select test_helpers.create_user('ptr-buyer@example.com', 'Alexis');
select test_helpers.create_user('ptr-blocked@example.com', 'Blocked Buyer');
insert into public.geckos (id, name, passport_code, created_by)
values ('ptr-gecko-1', 'Kiwi', 'GI-PTR-0001', 'ptr-owner@example.com'),
       ('ptr-gecko-2', 'Mango', 'GI-PTR-0002', 'ptr-owner@example.com');
insert into public.user_blocks (blocker_email, blocked_email)
values ('ptr-owner@example.com', 'ptr-blocked@example.com');

-- Signed out: refused.
select test_helpers.act_as_anon();
do $$ begin
  perform public.request_passport_transfer('GI-PTR-0001');
  raise exception 'FAIL: a signed-out visitor sent a transfer request';
exception when insufficient_privilege then null;
end $$;

-- The buyer asks: the owner gets a chat message and a transfer_request
-- notification linking to the gecko with the buyer's email.
select test_helpers.act_as('ptr-buyer@example.com');
do $$
declare v jsonb;
begin
  v := public.request_passport_transfer('GI-PTR-0001');
  if v ->> 'status' <> 'sent' then raise exception 'FAIL: first request returned %', v; end if;
  v := public.request_passport_transfer(' GI-PTR-0001 ');
  if v ->> 'status' <> 'already_requested' then raise exception 'FAIL: repeat request returned %', v; end if;
  begin
    perform public.request_passport_transfer('GI-NOPE');
    raise exception 'FAIL: unknown passport accepted';
  exception when no_data_found then null;
  end;
end $$;

select test_helpers.act_as_postgres();
do $$
declare n record;
begin
  if (select count(*) from public.notifications where type = 'transfer_request') <> 1 then
    raise exception 'FAIL: expected exactly one transfer_request notification';
  end if;
  select * into n from public.notifications where type = 'transfer_request';
  if n.user_email <> 'ptr-owner@example.com' or n.created_by <> 'ptr-buyer@example.com' then
    raise exception 'FAIL: notification addressed wrong: % from %', n.user_email, n.created_by;
  end if;
  if n.link <> '/GeckoDetail?id=ptr-gecko-1&transfer_to=ptr-buyer%40example.com' then
    raise exception 'FAIL: notification link is %', n.link;
  end if;
  if n.content <> 'Alexis asked you to transfer Kiwi to their account.' then
    raise exception 'FAIL: notification content is %', n.content;
  end if;
  if (select count(*) from public.direct_messages
       where sender_email = 'ptr-buyer@example.com' and recipient_email = 'ptr-owner@example.com'
         and content like '%Kiwi (GI-PTR-0001)%') <> 1 then
    raise exception 'FAIL: expected one chat message to the owner';
  end if;
end $$;

-- A second gecko from the same owner is its own request.
select test_helpers.act_as('ptr-buyer@example.com');
do $$ begin
  if public.request_passport_transfer('GI-PTR-0002') ->> 'status' <> 'sent' then
    raise exception 'FAIL: a different gecko counted as a repeat';
  end if;
end $$;

-- The owner cannot request their own gecko.
select test_helpers.act_as('ptr-owner@example.com');
do $$ begin
  perform public.request_passport_transfer('GI-PTR-0001');
  raise exception 'FAIL: owner requested their own gecko';
exception when invalid_parameter_value then null;
end $$;

-- A blocked member cannot reach the owner this way.
select test_helpers.act_as('ptr-blocked@example.com');
do $$ begin
  perform public.request_passport_transfer('GI-PTR-0001');
  raise exception 'FAIL: blocked member sent a transfer request';
exception when insufficient_privilege then null;
end $$;

-- A member still cannot write a transfer_request notification to someone
-- else directly (only the function can).
select test_helpers.act_as('ptr-blocked@example.com');
do $$ begin
  insert into public.notifications (user_email, type, content, link)
  values ('ptr-buyer@example.com', 'transfer_request', 'Fake', '/');
  raise exception 'FAIL: member wrote a transfer_request notification directly';
exception when insufficient_privilege then null;
end $$;

rollback;
