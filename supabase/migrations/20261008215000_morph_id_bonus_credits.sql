-- Bonus Morph ID scans (8 Oct 2026).
--
-- Free accounts get one identification ever. Keeper, Breeder and
-- Enterprise get 3, 6 and 15 a month, with no rollover. Failed scans are
-- handed back by refund_morph_id_credit. There was no way to add scans
-- on top of that, so a Free member who hit the Oct 5-8 outage could not
-- be given 10 extra tries without also changing their plan.
--
-- morph_id_bonus_credits is the grant ledger. Members can read their own
-- rows. Inserts, updates and deletes are service role or SQL editor only:
-- there is no write policy, and authenticated has select only.
--
-- A grant adds to the allowance until expires_at (null means it does not
-- expire). On a paid plan the monthly allowance is used first. Bonus
-- scans are what is left after that month's plan cap, so a refund (which
-- lowers credits_consumed) gives a bonus scan back before a monthly one.
-- The free try is the plan cap of 1 on the first month that uses it.
-- Later free months have a plan cap of 0, and every further scan is bonus.
--
-- credits_included stays the plan cap, not the plan plus the bonus. That
-- is what lets the existing refund function keep working without a second
-- counter. consume_morph_id_credit below is the 5 Oct definition
-- (migration 20261005145947) with that bonus rule added.
--
-- Two known limits. Leave them as they are:
-- A Free account that upgrades to a paid plan in the same month has the
-- scans it already used added onto the new plan cap, so bonus scans spent
-- before that upgrade come back.
-- Scans taken against a grant that later expires still count against any
-- newer grant. Leave expires_at null until that is the behavior you want.
--
-- Not applied to production by this change. Grants are a separate SQL
-- step after Morph ID is confirmed working.

create table if not exists public.morph_id_bonus_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null check (credits > 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, reason)
);

comment on table public.morph_id_bonus_credits is
  'Extra Morph ID scans for one member. Lifetime until expires_at. Written by the service role or the SQL editor, never by the client.';

alter table public.morph_id_bonus_credits enable row level security;

drop policy if exists morph_id_bonus_credits_read_own on public.morph_id_bonus_credits;
create policy morph_id_bonus_credits_read_own
  on public.morph_id_bonus_credits
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.morph_id_bonus_credits from public, anon, authenticated;
grant select on table public.morph_id_bonus_credits to authenticated;
grant all on table public.morph_id_bonus_credits to service_role;

-- month_key_now() calls now() but was marked immutable, so the planner
-- is allowed to fold one month key for the life of a prepared statement.
-- Stable is the honest volatility. The body is unchanged.
create or replace function public.month_key_now()
returns text
language sql
stable
set search_path to 'public'
as $$
  select to_char(now() at time zone 'utc', 'YYYY-MM');
$$;

-- Unused bonus scans: unexpired grants minus scans already taken past
-- the plan cap. A grant that has expired drops out. Scans already taken
-- still count, so they reduce whatever grants are still active.
create or replace function public.morph_id_bonus_left(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when p_user_id is null then 0
    else greatest(
      0,
      coalesce((
        select sum(b.credits)
          from public.morph_id_bonus_credits b
         where b.user_id = p_user_id
           and (b.expires_at is null or b.expires_at > now())
      ), 0)
      - coalesce((
        select sum(greatest(0, u.credits_consumed - u.credits_included))
          from public.morph_id_usage u
         where u.user_id = p_user_id
      ), 0)
    )
  end;
$function$;

-- True when scans taken past the plan cap are more than the unexpired
-- grants. consume_morph_id_credit uses it to undo a race, and only after
-- a scan that itself went past the plan cap. An expired grant must not
-- block this month's paid allowance.
create or replace function public.morph_id_bonus_overdrawn(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
           select sum(greatest(0, u.credits_consumed - u.credits_included))
             from public.morph_id_usage u
            where u.user_id = p_user_id
         ), 0)
       > coalesce((
           select sum(b.credits)
             from public.morph_id_bonus_credits b
            where b.user_id = p_user_id
              and (b.expires_at is null or b.expires_at > now())
         ), 0);
$function$;

revoke all on function public.morph_id_bonus_left(uuid) from public, anon, authenticated, service_role;
revoke all on function public.morph_id_bonus_overdrawn(uuid) from public, anon, authenticated, service_role;

create or replace function public.consume_morph_id_credit(p_user_id uuid, p_tier text, p_credits_included integer)
returns public.morph_id_usage
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec public.morph_id_usage%rowtype;
  mk text := public.month_key_now();
  v_free boolean := coalesce(p_tier, 'free') = 'free';
  v_monthly integer := case
    when v_free then 0
    else greatest(coalesce(p_credits_included, 0), 0)
  end;
  v_included integer;
  v_bonus_left integer;
  v_lifetime integer := 0;
  v_prior integer := 0;
  v_existing_consumed integer := 0;
  v_existing_included integer := 0;
  v_existing_tier text := 'free';
  v_row_exists boolean := false;
  v_cap integer := 0;
begin
  if p_user_id is null then
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  v_bonus_left := public.morph_id_bonus_left(p_user_id);

  if v_free then
    select coalesce(sum(u.credits_consumed), 0),
           coalesce(sum(u.credits_consumed) filter (where u.month_key <> mk), 0)
      into v_lifetime, v_prior
      from public.morph_id_usage u
     where u.user_id = p_user_id;

    -- Plan cap is the one free try, on the first month that uses it.
    -- A later month stays at 0 so those scans count as bonus.
    v_included := case when v_prior > 0 then 0 else 1 end;
    if (case when v_lifetime = 0 then 1 else 0 end) + v_bonus_left <= 0 then
      raise exception 'morph_id_credits_exhausted'
        using errcode = 'P0001';
    end if;
  else
    select u.credits_consumed, u.credits_included, u.tier_at_start
      into v_existing_consumed, v_existing_included, v_existing_tier
      from public.morph_id_usage u
     where u.user_id = p_user_id
       and u.month_key = mk;
    v_row_exists := found;
    v_included := v_monthly;

    if v_row_exists then
      v_cap := greatest(v_existing_included, v_monthly);
      -- First paid call after a free try in the same month: the free
      -- use does not count against the paid allowance (5 Oct 2026).
      -- The same addition credits back bonus scans already used this
      -- month. That is a known limit of the upgrade rule.
      if coalesce(v_existing_tier, 'free') = 'free' then
        v_cap := greatest(v_cap, v_monthly + v_existing_consumed);
      end if;
    else
      v_cap := v_monthly;
    end if;

    -- Room in this month's plan, or bonus scans still unused.
    -- A new paid month with a monthly allowance always has room.
    if not (
      (v_row_exists and v_existing_consumed < v_cap)
      or (not v_row_exists and v_monthly > 0)
      or v_bonus_left > 0
    ) then
      raise exception 'morph_id_credits_exhausted'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.morph_id_usage (
    user_id, month_key, tier_at_start, credits_included, credits_consumed
  )
  values (p_user_id, mk, p_tier, v_included, 1)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        credits_included = greatest(
          public.morph_id_usage.credits_included,
          excluded.credits_included
            + case
                when coalesce(public.morph_id_usage.tier_at_start, 'free') = 'free'
                     and coalesce(excluded.tier_at_start, 'free') <> 'free'
                then public.morph_id_usage.credits_consumed
                else 0
              end
        ),
        credits_consumed = public.morph_id_usage.credits_consumed + 1,
        updated_date = now()
    returning * into rec;

  -- Only a scan past the plan cap can overdraw the bonus. A scan that
  -- still fits in this month's allowance must succeed even when an old
  -- grant has expired and historical bonus use is larger than what is
  -- still active.
  if rec.credits_consumed > rec.credits_included
     and public.morph_id_bonus_overdrawn(p_user_id) then
    update public.morph_id_usage
      set credits_consumed = greatest(rec.credits_consumed - 1, 0),
          updated_date = now()
      where id = rec.id;
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  return rec;
end;
$function$;

revoke all on function public.consume_morph_id_credit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_morph_id_credit(uuid, text, integer) to service_role;

-- One number for the Morph ID page: scans the member can run right now.
-- Free: 1 lifetime try, plus unused unexpired bonus.
-- Paid: this month's plan scans still unused, plus unused unexpired bonus.
-- Monthly numbers match src/lib/tierLimits.js and TIER_MORPH_ID_CREDITS
-- in recognize-gecko-morph. The edge function may pass the monthly
-- number it already resolved. A signed-in member cannot.
create or replace function public.morph_id_scans_remaining(
  p_user_id uuid default null,
  p_tier text default null,
  p_monthly integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_privileged boolean;
  v_uid uuid;
  v_tier text;
  v_monthly integer;
  v_bonus integer;
  v_bonus_left integer;
  v_lifetime integer;
  v_consumed integer;
  v_included integer;
  v_tier_at_start text;
  v_cap integer;
  v_monthly_left integer;
  v_remaining integer;
begin
  -- PostgREST sets the role to anon, authenticated, or service_role, and
  -- security definer does not change current_setting('role'). Supabase
  -- SQL runs as postgres, which is not a superuser, so a superuser check
  -- would reject the admin grant script (42501). Any role other than
  -- anon or authenticated may look up a user. A signed-in member stays
  -- on authenticated and cannot look up someone else.
  v_privileged := coalesce(auth.role(), '') = 'service_role'
    or coalesce(nullif(current_setting('role', true), 'none'), session_user::text)
       not in ('anon', 'authenticated');

  if not v_privileged
     and p_user_id is not null
     and p_user_id is distinct from auth.uid() then
    raise exception 'morph_id_scans_remaining'
      using errcode = '42501';
  end if;

  if v_privileged then
    v_uid := coalesce(p_user_id, auth.uid());
  else
    v_uid := auth.uid();
  end if;

  if v_uid is null then
    return jsonb_build_object('remaining', 0, 'bonus', 0, 'bonus_left', 0);
  end if;

  if v_privileged and nullif(btrim(coalesce(p_tier, '')), '') is not null then
    v_tier := btrim(p_tier);
  elsif auth.uid() is not null then
    v_tier := public.effective_tier_for_current_user();
  else
    v_tier := 'free';
  end if;

  if v_privileged and p_monthly is not null then
    v_monthly := greatest(p_monthly, 0);
  else
    v_monthly := case v_tier
      when 'keeper' then 3
      when 'breeder' then 6
      when 'enterprise' then 15
      else 0
    end;
  end if;

  select coalesce(sum(b.credits), 0)
    into v_bonus
    from public.morph_id_bonus_credits b
   where b.user_id = v_uid
     and (b.expires_at is null or b.expires_at > now());

  v_bonus_left := public.morph_id_bonus_left(v_uid);

  if coalesce(v_tier, 'free') = 'free' then
    select coalesce(sum(u.credits_consumed), 0)
      into v_lifetime
      from public.morph_id_usage u
     where u.user_id = v_uid;
    v_remaining := (case when v_lifetime = 0 then 1 else 0 end) + v_bonus_left;
  else
    select u.credits_consumed, u.credits_included, u.tier_at_start
      into v_consumed, v_included, v_tier_at_start
      from public.morph_id_usage u
     where u.user_id = v_uid
       and u.month_key = public.month_key_now();

    if not found then
      v_monthly_left := v_monthly;
    else
      v_cap := greatest(v_included, v_monthly);
      if coalesce(v_tier_at_start, 'free') = 'free' then
        v_cap := greatest(v_cap, v_monthly + v_consumed);
      end if;
      v_monthly_left := greatest(0, v_cap - v_consumed);
    end if;
    v_remaining := v_monthly_left + v_bonus_left;
  end if;

  return jsonb_build_object(
    'remaining', v_remaining,
    'bonus', v_bonus,
    'bonus_left', v_bonus_left
  );
end;
$function$;

revoke all on function public.morph_id_scans_remaining(uuid, text, integer) from public, anon;
grant execute on function public.morph_id_scans_remaining(uuid, text, integer) to authenticated, service_role;
