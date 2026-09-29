-- Waitlist deposit terms, buyer agreement, refunds, Breeder plan (29 Sep 2026).
--
-- Deposit fights in the hobby come from vague terms, so each waitlist can
-- carry written deposit terms (the app fills in a default the breeder can
-- edit). When a list has terms, join_waitlist() only accepts a signup that
-- agreed to them, and keeps a copy of the exact wording with the time, so
-- editing the terms later never changes what an earlier buyer agreed to.
-- A signup can now be marked refunded (with the amount and date), which
-- takes it out of the line like a withdrawal.
--
-- Creating a waitlist needs the Breeder plan (or Enterprise). Lists that
-- already exist keep working for their owner whatever the plan.

alter table public.gecko_waitlists
  add column if not exists deposit_terms text;

alter table public.gecko_waitlist_signups
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_snapshot text,
  add column if not exists refund_amount numeric check (refund_amount is null or refund_amount >= 0),
  add column if not exists refunded_on date;

alter table public.gecko_waitlist_signups drop constraint if exists gecko_waitlist_signups_status_check;
alter table public.gecko_waitlist_signups add constraint gecko_waitlist_signups_status_check
  check (status in ('waiting', 'deposit_paid', 'matched', 'completed', 'withdrawn', 'refunded'));

drop policy if exists gecko_waitlists_insert_owner on public.gecko_waitlists;
create policy gecko_waitlists_insert_owner on public.gecko_waitlists
  for insert to authenticated
  with check (
    breeder_user_id = (select auth.uid())
    and (select public.effective_tier_for_current_user()) in ('breeder', 'enterprise')
  );

-- Only join_waitlist() can add a signup for someone who is not the
-- breeder (there is no public insert policy), and it records the terms the
-- buyer agreed to. After that nobody, the breeder included, can rewrite
-- what a buyer agreed to.
create or replace function public.guard_waitlist_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_breeder boolean := exists (
    select 1 from public.gecko_waitlists w
     where w.id = new.waitlist_id and w.breeder_user_id = auth.uid()
  );
begin
  new.email := lower(trim(new.email));
  new.name := trim(new.name);
  new.updated_date := now();
  if tg_op = 'INSERT' and not is_breeder then
    new.status := 'waiting';
    new.deposit_paid := null;
    new.deposit_paid_on := null;
    new.matched_gecko_id := null;
    new.breeder_notes := null;
    new.refund_amount := null;
    new.refunded_on := null;
  end if;
  if tg_op = 'INSERT' and is_breeder then
    -- A buyer added by hand has not agreed to anything online.
    new.terms_accepted_at := null;
    new.terms_snapshot := null;
  end if;
  if tg_op = 'UPDATE' then
    new.terms_accepted_at := old.terms_accepted_at;
    new.terms_snapshot := old.terms_snapshot;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_waitlist_signup() from public, anon, authenticated;

drop function if exists public.join_waitlist(text, text, text, text, text);

create function public.join_waitlist(
  p_slug text,
  p_name text,
  p_email text,
  p_wanted text default null,
  p_notes text default null,
  p_accept_terms boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.gecko_waitlists;
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_wanted text := nullif(trim(coalesce(p_wanted, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_terms text;
  mine public.gecko_waitlist_signups;
  already boolean := false;
  place int;
  recent int;
begin
  if v_name = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter your name and a valid email.';
  end if;
  if length(v_name) > 120 or length(v_email) > 200
     or length(coalesce(v_wanted, '')) > 300 or length(coalesce(v_notes, '')) > 1000 then
    raise exception 'That is too long. Please shorten it.';
  end if;

  select * into w from public.gecko_waitlists where slug = p_slug;
  if not found then
    raise exception 'This waitlist link is invalid or has been removed.';
  end if;
  v_terms := nullif(trim(coalesce(w.deposit_terms, '')), '');

  select * into mine
    from public.gecko_waitlist_signups
   where waitlist_id = w.id and lower(email) = v_email and status not in ('withdrawn', 'refunded')
   order by created_date
   limit 1;

  if found then
    already := true;
  else
    if not w.is_open or (w.closes_at is not null and w.closes_at < now()) then
      raise exception 'This waitlist is closed.';
    end if;
    if v_terms is not null and not coalesce(p_accept_terms, false) then
      raise exception 'Please read and agree to the deposit terms to join.';
    end if;
    if w.max_signups is not null and (
      select count(*) from public.gecko_waitlist_signups
       where waitlist_id = w.id and status not in ('withdrawn', 'refunded')
    ) >= w.max_signups then
      raise exception 'This waitlist is full.';
    end if;

    insert into public.gecko_waitlist_signups
      (waitlist_id, name, email, wanted_outcome, notes, terms_accepted_at, terms_snapshot)
    values
      (w.id, v_name, v_email, v_wanted, v_notes,
       case when v_terms is not null then now() end, v_terms)
    returning * into mine;

    select count(*) into recent
      from public.notifications
     where type = 'waitlist_signup'
       and metadata->>'waitlist_id' = w.id::text
       and created_date > now() - interval '1 hour';
    if recent < 20 then
      insert into public.notifications (user_email, type, content, link, metadata)
      select u.email,
             'waitlist_signup',
             left(v_name || ' joined your waitlist "' || w.title || '"'
                  || coalesce(', hoping for ' || v_wanted, '') || '.', 500),
             '/MarketplaceSalesStats?tab=waitlists',
             jsonb_build_object('waitlist_id', w.id)
        from auth.users u
       where u.id = w.breeder_user_id and u.email is not null;
    end if;
  end if;

  select count(*) into place
    from public.gecko_waitlist_signups s
   where s.waitlist_id = w.id
     and s.status not in ('withdrawn', 'refunded')
     and (s.created_date, s.id) <= (mine.created_date, mine.id);

  return jsonb_build_object('position', place, 'already', already);
end;
$$;

revoke execute on function public.join_waitlist(text, text, text, text, text, boolean) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, boolean) to anon, authenticated;
