-- Morph ID bonus credits.
--
-- Plain SQL script for local Postgres. It needs a superuser: it creates
-- roles and uses SET SESSION AUTHORIZATION. It is not pgTAP, and it is
-- not meant to be pasted into the Supabase SQL editor.
-- Every change rolls back.
--
-- Free with and without a bonus, paid monthly scans with a bonus used
-- only after that month's allowance, expiry, a refund giving the scan
-- back, a signed-in member who cannot insert a grant, and a
-- non-superuser role (not anon or authenticated) that can look up
-- another member.
begin;

create temp table _bonus_fixture (
  kind text primary key,
  user_id uuid not null,
  email text not null
) on commit drop;

create or replace function pg_temp.scans(p_user uuid, p_tier text, p_monthly integer)
returns integer
language sql
stable
as $$
  select (public.morph_id_scans_remaining(p_user, p_tier, p_monthly)->>'remaining')::integer;
$$;

create or replace function pg_temp.expect_exhausted(p_user uuid, p_tier text, p_included integer)
returns void
language plpgsql
as $$
begin
  perform public.consume_morph_id_credit(p_user, p_tier, p_included);
  raise exception 'expected morph_id_credits_exhausted for %', p_tier;
exception
  when others then
    if sqlerrm is distinct from 'morph_id_credits_exhausted' then
      raise;
    end if;
end;
$$;

create or replace function pg_temp.make_user(p_tier text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'morph-bonus-' || v_id::text || '@example.com';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, 'not-a-real-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

  begin
    insert into public.profiles (email, membership_tier, role)
    values (v_email, p_tier, 'user');
  exception
    when unique_violation then
      update public.profiles
         set membership_tier = p_tier, role = 'user'
       where lower(email) = lower(v_email);
  end;

  insert into _bonus_fixture (kind, user_id, email)
  values (p_tier || '-' || v_id::text, v_id, v_email);

  return v_id;
end;
$$;

do $test$
declare
  v_free uuid;
  v_bonus uuid;
  v_bonus_email text;
  v_paid uuid;
  v_keeper uuid;
  v_prior uuid;
  v_expired_keeper uuid;
  v_earlier_free uuid;
  v_upgrade uuid;
  v_expire uuid;
  v_base uuid;
  n integer;
  v_included integer;
  v_consumed integer;
begin
  if (select provolatile from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'month_key_now') <> 's' then
    raise exception 'month_key_now should be stable';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.proname = 'consume_morph_id_credit'
       and p.prosecdef
       and 'search_path=public' = any (p.proconfig)
  ) then
    raise exception 'consume_morph_id_credit must stay security definer with search_path public';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.proname = 'morph_id_scans_remaining'
       and p.prosecdef
       and 'search_path=public' = any (p.proconfig)
  ) then
    raise exception 'morph_id_scans_remaining must be security definer with search_path public';
  end if;

  if (select c.confdeltype::text
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace ns on ns.oid = t.relnamespace
       where ns.nspname = 'public'
         and t.relname = 'morph_id_bonus_credits'
         and c.contype = 'f') <> 'c' then
    raise exception 'bonus credits must cascade when the auth user is deleted';
  end if;

  if has_function_privilege('authenticated', 'public.consume_morph_id_credit(uuid,text,integer)', 'execute') then
    raise exception 'authenticated can execute consume_morph_id_credit';
  end if;
  if has_function_privilege('anon', 'public.consume_morph_id_credit(uuid,text,integer)', 'execute') then
    raise exception 'anon can execute consume_morph_id_credit';
  end if;
  if not has_function_privilege('service_role', 'public.consume_morph_id_credit(uuid,text,integer)', 'execute') then
    raise exception 'service_role cannot execute consume_morph_id_credit';
  end if;
  if has_function_privilege('authenticated', 'public.morph_id_bonus_left(uuid)', 'execute') then
    raise exception 'authenticated can execute morph_id_bonus_left';
  end if;
  if not has_function_privilege('authenticated', 'public.morph_id_scans_remaining(uuid,text,integer)', 'execute') then
    raise exception 'authenticated cannot execute morph_id_scans_remaining';
  end if;
  if has_table_privilege('authenticated', 'public.morph_id_bonus_credits', 'insert')
     or has_table_privilege('authenticated', 'public.morph_id_bonus_credits', 'update')
     or has_table_privilege('authenticated', 'public.morph_id_bonus_credits', 'delete') then
    raise exception 'authenticated can write morph_id_bonus_credits';
  end if;
  if not has_table_privilege('authenticated', 'public.morph_id_bonus_credits', 'select') then
    raise exception 'authenticated cannot read morph_id_bonus_credits';
  end if;
  if has_table_privilege('anon', 'public.morph_id_bonus_credits', 'select') then
    raise exception 'anon can read morph_id_bonus_credits';
  end if;

  -- Free, no bonus.
  v_free := pg_temp.make_user('free');
  if pg_temp.scans(v_free, 'free', 0) <> 1 then
    raise exception 'free without bonus should start at 1, got %', pg_temp.scans(v_free, 'free', 0);
  end if;
  perform public.consume_morph_id_credit(v_free, 'free', 0);
  if pg_temp.scans(v_free, 'free', 0) <> 0 then
    raise exception 'free try should be spent';
  end if;
  perform pg_temp.expect_exhausted(v_free, 'free', 0);
  perform public.refund_morph_id_credit(v_free);
  if pg_temp.scans(v_free, 'free', 0) <> 1 then
    raise exception 'refund should restore the free try, got %', pg_temp.scans(v_free, 'free', 0);
  end if;

  -- Free plus 10 bonus scans. The first scan is the free try, not bonus.
  v_bonus := pg_temp.make_user('free');
  select email into v_bonus_email from _bonus_fixture where user_id = v_bonus;
  update _bonus_fixture set kind = 'bonus' where user_id = v_bonus;
  insert into public.morph_id_bonus_credits (user_id, credits, reason)
  values (v_bonus, 10, 'morph-outage-2026-10');
  if pg_temp.scans(v_bonus, 'free', 0) <> 11 then
    raise exception 'free plus 10 bonus should be 11, got %', pg_temp.scans(v_bonus, 'free', 0);
  end if;
  perform public.consume_morph_id_credit(v_bonus, 'free', 0);
  select greatest(0, credits_consumed - credits_included) into n
    from public.morph_id_usage
   where user_id = v_bonus and month_key = public.month_key_now();
  if n <> 0 or pg_temp.scans(v_bonus, 'free', 0) <> 10 then
    raise exception 'first free scan should not draw bonus (overflow %, left %)',
      n, pg_temp.scans(v_bonus, 'free', 0);
  end if;
  for n in 1..10 loop
    perform public.consume_morph_id_credit(v_bonus, 'free', 0);
  end loop;
  if pg_temp.scans(v_bonus, 'free', 0) <> 0 then
    raise exception '11 scans should spend the free try and the bonus, got %', pg_temp.scans(v_bonus, 'free', 0);
  end if;
  perform pg_temp.expect_exhausted(v_bonus, 'free', 0);
  perform public.refund_morph_id_credit(v_bonus);
  if pg_temp.scans(v_bonus, 'free', 0) <> 1 then
    raise exception 'refund should restore one bonus scan, got %', pg_temp.scans(v_bonus, 'free', 0);
  end if;

  begin
    insert into public.morph_id_bonus_credits (user_id, credits, reason)
    values (v_bonus, 10, 'morph-outage-2026-10');
    raise exception 'duplicate reason was inserted';
  exception
    when unique_violation then null;
  end;

  begin
    insert into public.morph_id_bonus_credits (user_id, credits, reason)
    values (v_bonus, 0, 'zero-credits');
    raise exception 'zero credit grant was inserted';
  exception
    when check_violation then null;
  end;

  -- Keeper with no bonus still stops at 3, and a refund gives one back.
  v_keeper := pg_temp.make_user('keeper');
  if pg_temp.scans(v_keeper, 'keeper', 3) <> 3 then
    raise exception 'keeper should start at 3, got %', pg_temp.scans(v_keeper, 'keeper', 3);
  end if;
  for n in 1..3 loop
    perform public.consume_morph_id_credit(v_keeper, 'keeper', 3);
  end loop;
  perform pg_temp.expect_exhausted(v_keeper, 'keeper', 3);
  perform public.refund_morph_id_credit(v_keeper);
  if pg_temp.scans(v_keeper, 'keeper', 3) <> 1 then
    raise exception 'refund should restore one keeper scan, got %', pg_temp.scans(v_keeper, 'keeper', 3);
  end if;

  -- Bonus on a paid plan is used only after the monthly allowance.
  v_paid := pg_temp.make_user('keeper');
  update _bonus_fixture set kind = 'paid' where user_id = v_paid;
  insert into public.morph_id_bonus_credits (user_id, credits, reason)
  values (v_paid, 2, 'paid-bonus');
  if pg_temp.scans(v_paid, 'keeper', 3) <> 5 then
    raise exception 'keeper plus 2 bonus should be 5, got %', pg_temp.scans(v_paid, 'keeper', 3);
  end if;
  for n in 1..3 loop
    perform public.consume_morph_id_credit(v_paid, 'keeper', 3);
  end loop;
  select credits_included, credits_consumed into v_included, v_consumed
    from public.morph_id_usage
   where user_id = v_paid and month_key = public.month_key_now();
  if v_consumed <> 3 or v_included <> 3 or pg_temp.scans(v_paid, 'keeper', 3) <> 2 then
    raise exception 'monthly scans should not draw bonus (consumed %, included %, left %)',
      v_consumed, v_included, pg_temp.scans(v_paid, 'keeper', 3);
  end if;
  perform public.consume_morph_id_credit(v_paid, 'keeper', 3);
  if pg_temp.scans(v_paid, 'keeper', 3) <> 1 then
    raise exception 'fourth keeper scan should draw one bonus, got %', pg_temp.scans(v_paid, 'keeper', 3);
  end if;
  perform public.refund_morph_id_credit(v_paid);
  select greatest(0, credits_consumed - credits_included) into n
    from public.morph_id_usage
   where user_id = v_paid and month_key = public.month_key_now();
  if n <> 0 or pg_temp.scans(v_paid, 'keeper', 3) <> 2 then
    raise exception 'refund should give the bonus scan back (overflow %, left %)',
      n, pg_temp.scans(v_paid, 'keeper', 3);
  end if;
  perform public.consume_morph_id_credit(v_paid, 'keeper', 3);
  perform public.consume_morph_id_credit(v_paid, 'keeper', 3);
  if pg_temp.scans(v_paid, 'keeper', 3) <> 0 then
    raise exception 'both bonus scans should now be spent, got %', pg_temp.scans(v_paid, 'keeper', 3);
  end if;
  perform pg_temp.expect_exhausted(v_paid, 'keeper', 3);

  -- A past expiry adds nothing. A future expiry counts until it passes.
  -- Scans already taken still count against grants that remain active.
  v_expire := pg_temp.make_user('free');
  insert into public.morph_id_bonus_credits (user_id, credits, reason, expires_at)
  values (v_expire, 5, 'already-expired', now() - interval '1 day');
  if pg_temp.scans(v_expire, 'free', 0) <> 1 then
    raise exception 'expired bonus must not add a scan, got %', pg_temp.scans(v_expire, 'free', 0);
  end if;
  insert into public.morph_id_bonus_credits (user_id, credits, reason, expires_at)
  values
    (v_expire, 2, 'used-then-expired', now() + interval '1 day'),
    (v_expire, 5, 'still-good', null);
  if pg_temp.scans(v_expire, 'free', 0) <> 8 then
    raise exception 'free plus 7 unexpired bonus should be 8, got %', pg_temp.scans(v_expire, 'free', 0);
  end if;
  for n in 1..3 loop
    perform public.consume_morph_id_credit(v_expire, 'free', 0);
  end loop;
  if pg_temp.scans(v_expire, 'free', 0) <> 5 then
    raise exception 'three scans should leave 5, got %', pg_temp.scans(v_expire, 'free', 0);
  end if;
  update public.morph_id_bonus_credits
     set expires_at = now() - interval '1 minute'
   where user_id = v_expire and reason = 'used-then-expired';
  -- 2 bonus scans were taken. The 2-credit grant has now expired, so
  -- those scans reduce the 5 that are still active.
  if pg_temp.scans(v_expire, 'free', 0) <> 3 then
    raise exception 'expired grant should drop out and past bonus use should still count, got %',
      pg_temp.scans(v_expire, 'free', 0);
  end if;

  -- Bonus spent in an earlier month stays spent. This month's plan is fresh.
  v_prior := pg_temp.make_user('keeper');
  insert into public.morph_id_usage (user_id, month_key, tier_at_start, credits_included, credits_consumed)
  values (v_prior, '2020-01', 'keeper', 3, 5);
  insert into public.morph_id_bonus_credits (user_id, credits, reason)
  values (v_prior, 2, 'spent-last-month');
  if pg_temp.scans(v_prior, 'keeper', 3) <> 3 then
    raise exception 'last month bonus use should leave this month at 3, got %',
      pg_temp.scans(v_prior, 'keeper', 3);
  end if;

  -- Same history, then the grant expires. The two bonus scans from last
  -- month are over the active grants, but this month's 3 plan scans
  -- still have to go through. The overdrawn check must not run on them.
  v_expired_keeper := pg_temp.make_user('keeper');
  insert into public.morph_id_usage (user_id, month_key, tier_at_start, credits_included, credits_consumed)
  values (v_expired_keeper, '2020-01', 'keeper', 3, 5);
  insert into public.morph_id_bonus_credits (user_id, credits, reason, expires_at)
  values (v_expired_keeper, 2, 'expired-after-use', now() - interval '1 day');
  if pg_temp.scans(v_expired_keeper, 'keeper', 3) <> 3 then
    raise exception 'expired bonus should leave this month at 3, got %',
      pg_temp.scans(v_expired_keeper, 'keeper', 3);
  end if;
  for n in 1..3 loop
    perform public.consume_morph_id_credit(v_expired_keeper, 'keeper', 3);
  end loop;
  if pg_temp.scans(v_expired_keeper, 'keeper', 3) <> 0 then
    raise exception 'keeper should still scan 3 times after an expired grant, got %',
      pg_temp.scans(v_expired_keeper, 'keeper', 3);
  end if;
  perform pg_temp.expect_exhausted(v_expired_keeper, 'keeper', 3);

  -- Free try spent in an earlier month. This month's scans are bonus.
  v_earlier_free := pg_temp.make_user('free');
  insert into public.morph_id_usage (user_id, month_key, tier_at_start, credits_included, credits_consumed)
  values (v_earlier_free, '2020-01', 'free', 1, 1);
  insert into public.morph_id_bonus_credits (user_id, credits, reason)
  values (v_earlier_free, 3, 'later-month');
  if pg_temp.scans(v_earlier_free, 'free', 0) <> 3 then
    raise exception 'spent free try should leave the 3 bonus, got %',
      pg_temp.scans(v_earlier_free, 'free', 0);
  end if;
  perform public.consume_morph_id_credit(v_earlier_free, 'free', 0);
  select credits_included, credits_consumed into v_included, v_consumed
    from public.morph_id_usage
   where user_id = v_earlier_free and month_key = public.month_key_now();
  if v_included <> 0 or v_consumed <> 1 or pg_temp.scans(v_earlier_free, 'free', 0) <> 2 then
    raise exception 'later-month bonus scan should use a 0 plan cap (included %, consumed %, left %)',
      v_included, v_consumed, pg_temp.scans(v_earlier_free, 'free', 0);
  end if;

  -- Free try, then Breeder in the same month: the free try does not eat
  -- the 6 (5 Oct 2026), and no bonus is involved.
  v_upgrade := pg_temp.make_user('free');
  perform public.consume_morph_id_credit(v_upgrade, 'free', 0);
  perform public.consume_morph_id_credit(v_upgrade, 'breeder', 6);
  select credits_included, credits_consumed into v_included, v_consumed
    from public.morph_id_usage
   where user_id = v_upgrade and month_key = public.month_key_now();
  if v_included <> 7 or v_consumed <> 2 or pg_temp.scans(v_upgrade, 'breeder', 6) <> 5 then
    raise exception 'upgrade should keep the free try off the paid cap (included %, consumed %, left %)',
      v_included, v_consumed, pg_temp.scans(v_upgrade, 'breeder', 6);
  end if;

  v_base := pg_temp.make_user('free');
  if pg_temp.scans(v_base, 'breeder', 6) <> 6 then
    raise exception 'breeder baseline should be 6, got %', pg_temp.scans(v_base, 'breeder', 6);
  end if;
  if pg_temp.scans(v_base, 'enterprise', 15) <> 15 then
    raise exception 'enterprise baseline should be 15, got %', pg_temp.scans(v_base, 'enterprise', 15);
  end if;

  perform set_config(
    'request.jwt.claims',
    (select jsonb_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text
       from _bonus_fixture where kind = 'bonus'),
    true
  );
end;
$test$;

-- Signed-in member: read own grant, not someone else's, and no writes.
set local role authenticated;

do $rls$
begin
  if (select count(*) from public.morph_id_bonus_credits) <> 1 then
    raise exception 'member should see only their own grant, saw %',
      (select count(*) from public.morph_id_bonus_credits);
  end if;
  if (select reason from public.morph_id_bonus_credits) <> 'morph-outage-2026-10' then
    raise exception 'member saw the wrong grant';
  end if;

  begin
    insert into public.morph_id_bonus_credits (user_id, credits, reason)
    values (auth.uid(), 1, 'self-grant');
    raise exception 'member inserted a bonus grant';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.morph_id_bonus_credits set credits = 99;
    raise exception 'member updated a bonus grant';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.morph_id_bonus_credits;
    raise exception 'member deleted a bonus grant';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.consume_morph_id_credit(auth.uid(), 'free', 0);
    raise exception 'member called consume_morph_id_credit';
  exception
    when insufficient_privilege then null;
  end;
end;
$rls$;

reset role;
set local role anon;

do $anon$
begin
  perform count(*) from public.morph_id_bonus_credits;
  raise exception 'anon read bonus credits';
exception
  when insufficient_privilege then null;
end;
$anon$;

reset role;

do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'morph_id_bonus_tester') then
    create role morph_id_bonus_tester nosuperuser nologin inherit;
  end if;
end;
$role$;

grant authenticated to morph_id_bonus_tester;
grant usage on schema public to morph_id_bonus_tester;

select set_config(
  'morph_bonus.other_id',
  (select user_id::text from _bonus_fixture where kind = 'paid'),
  true
);

set local session authorization morph_id_bonus_tester;
-- The tester is not anon or authenticated. Without this, the privilege
-- check would treat the session as an admin and allow the cross-user read.
set local role authenticated;

do $guard$
declare
  n integer;
  v_role text;
begin
  v_role := coalesce(nullif(current_setting('role', true), 'none'), session_user::text);
  if v_role is distinct from 'authenticated' then
    raise exception 'denial check must run as authenticated, role is %', v_role;
  end if;

  n := (public.morph_id_scans_remaining()->>'remaining')::integer;
  if n <> 1 then
    raise exception 'member remaining should be the restored bonus scan, got %', n;
  end if;
  if (public.morph_id_scans_remaining()->>'bonus')::integer <> 10 then
    raise exception 'member should see their own unexpired bonus';
  end if;

  begin
    perform public.morph_id_scans_remaining(current_setting('morph_bonus.other_id')::uuid);
    raise exception 'cross-user remaining was allowed';
  exception
    when insufficient_privilege then null;
  end;
end;
$guard$;

reset role;
reset session authorization;

-- Mirrors Supabase's postgres role: not a superuser, and not anon or
-- authenticated. That session must be able to look up another member,
-- which is what the admin grant script does.
do $editor_role$
begin
  if not exists (select 1 from pg_roles where rolname = 'morph_id_bonus_editor') then
    create role morph_id_bonus_editor nosuperuser nologin inherit;
  end if;
end;
$editor_role$;

grant usage on schema public to morph_id_bonus_editor;
grant execute on function public.morph_id_scans_remaining(uuid, text, integer) to morph_id_bonus_editor;

set local session authorization morph_id_bonus_editor;

do $editor$
declare
  v_row jsonb;
  v_role text;
begin
  if session_user is distinct from 'morph_id_bonus_editor' then
    raise exception 'expected morph_id_bonus_editor, got %', session_user;
  end if;
  if (select rolsuper from pg_roles where rolname = session_user) then
    raise exception 'morph_id_bonus_editor must not be a superuser';
  end if;
  v_role := coalesce(nullif(current_setting('role', true), 'none'), session_user::text);
  if v_role in ('anon', 'authenticated') then
    raise exception 'editor must not be running as anon or authenticated, role is %', v_role;
  end if;

  v_row := public.morph_id_scans_remaining(
    current_setting('morph_bonus.other_id')::uuid, 'keeper', 3
  );
  if (v_row->>'bonus')::integer <> 2 or (v_row->>'remaining')::integer <> 0 then
    raise exception 'non-superuser editor should see the other keeper (bonus 2, remaining 0), got %', v_row;
  end if;
end;
$editor$;

reset session authorization;
rollback;
