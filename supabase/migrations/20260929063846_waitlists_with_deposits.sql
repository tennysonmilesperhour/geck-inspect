-- Waitlists with deposits (P9.2, 29 Sep 2026).
--
-- A waitlist can now belong to a pairing. It keeps the pairing's projected
-- outcomes and their odds (worked out in the app by the genetics engine
-- when the breeder creates it, so the public page never needs the parents'
-- private records), the deposit the breeder asks for and how to pay it.
-- Each signup says which outcome the buyer hopes for, and the breeder
-- tracks it from waiting, to deposit paid, to matched with a hatchling, to
-- completed (or withdrawn). Geck Inspect records deposits; it does not take
-- payments.
--
-- Signups go through join_waitlist(), which checks the list is open and
-- has room, stops the same email joining twice, returns the buyer's place
-- in line and notifies the breeder (at most 20 notifications per list per
-- hour, so a flood of fake signups cannot flood the breeder's inbox). The
-- direct public insert policy is dropped (no waitlists existed yet), and a
-- trigger keeps the status and deposit fields for the breeder alone.

alter table public.gecko_waitlists
  add column if not exists breeding_plan_id text references public.breeding_plans(id) on delete set null,
  add column if not exists outcomes jsonb not null default '[]'::jsonb,
  add column if not exists deposit_amount numeric check (deposit_amount is null or deposit_amount >= 0),
  add column if not exists deposit_instructions text,
  add column if not exists currency text not null default 'USD';

create index if not exists gecko_waitlists_breeding_plan_idx on public.gecko_waitlists (breeding_plan_id);
create index if not exists gecko_waitlists_breeder_idx on public.gecko_waitlists (breeder_user_id);

alter table public.gecko_waitlist_signups
  add column if not exists wanted_outcome text,
  add column if not exists status text not null default 'waiting',
  add column if not exists deposit_paid numeric check (deposit_paid is null or deposit_paid >= 0),
  add column if not exists deposit_paid_on date,
  add column if not exists matched_gecko_id text,
  add column if not exists breeder_notes text,
  add column if not exists updated_date timestamptz not null default now();

alter table public.gecko_waitlist_signups drop constraint if exists gecko_waitlist_signups_status_check;
alter table public.gecko_waitlist_signups add constraint gecko_waitlist_signups_status_check
  check (status in ('waiting', 'deposit_paid', 'matched', 'completed', 'withdrawn'));

create index if not exists gecko_waitlist_signups_waitlist_idx
  on public.gecko_waitlist_signups (waitlist_id, created_date, id);

drop policy if exists "Anyone can sign up to a waitlist" on public.gecko_waitlist_signups;

drop policy if exists "Breeders update their waitlist signups" on public.gecko_waitlist_signups;
create policy "Breeders update their waitlist signups" on public.gecko_waitlist_signups
  for update to authenticated
  using (exists (
    select 1 from public.gecko_waitlists w
     where w.id = gecko_waitlist_signups.waitlist_id and w.breeder_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.gecko_waitlists w
     where w.id = gecko_waitlist_signups.waitlist_id and w.breeder_user_id = (select auth.uid())
  ));

drop policy if exists "Breeders delete their waitlist signups" on public.gecko_waitlist_signups;
create policy "Breeders delete their waitlist signups" on public.gecko_waitlist_signups
  for delete to authenticated
  using (exists (
    select 1 from public.gecko_waitlists w
     where w.id = gecko_waitlist_signups.waitlist_id and w.breeder_user_id = (select auth.uid())
  ));

-- Breeders can add someone by hand (a buyer who asked in person).
drop policy if exists "Breeders add waitlist signups" on public.gecko_waitlist_signups;
create policy "Breeders add waitlist signups" on public.gecko_waitlist_signups
  for insert to authenticated
  with check (exists (
    select 1 from public.gecko_waitlists w
     where w.id = gecko_waitlist_signups.waitlist_id and w.breeder_user_id = (select auth.uid())
  ));

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
  end if;
  return new;
end;
$$;

drop trigger if exists gecko_waitlist_signups_guard on public.gecko_waitlist_signups;
create trigger gecko_waitlist_signups_guard
  before insert or update on public.gecko_waitlist_signups
  for each row execute function public.guard_waitlist_signup();

create or replace function public.join_waitlist(
  p_slug text,
  p_name text,
  p_email text,
  p_wanted text default null,
  p_notes text default null
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

  select * into mine
    from public.gecko_waitlist_signups
   where waitlist_id = w.id and lower(email) = v_email and status <> 'withdrawn'
   order by created_date
   limit 1;

  if found then
    already := true;
  else
    if not w.is_open or (w.closes_at is not null and w.closes_at < now()) then
      raise exception 'This waitlist is closed.';
    end if;
    if w.max_signups is not null and (
      select count(*) from public.gecko_waitlist_signups
       where waitlist_id = w.id and status <> 'withdrawn'
    ) >= w.max_signups then
      raise exception 'This waitlist is full.';
    end if;

    insert into public.gecko_waitlist_signups (waitlist_id, name, email, wanted_outcome, notes)
    values (w.id, v_name, v_email, v_wanted, v_notes)
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
     and s.status <> 'withdrawn'
     and (s.created_date, s.id) <= (mine.created_date, mine.id);

  return jsonb_build_object('position', place, 'already', already);
end;
$$;

revoke execute on function public.join_waitlist(text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text) to anon, authenticated;
