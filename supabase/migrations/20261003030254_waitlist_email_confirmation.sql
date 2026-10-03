-- Waitlist signups need email confirmation, and confirmed buyers get an
-- email with their place in line and the terms they agreed to (audit
-- step 33). Additive: the deployed page keeps calling join_waitlist(),
-- which is unchanged here. The new page signs up through the
-- waitlist-signup edge function, which calls the service-role-only
-- functions below and mails the confirmation link. A later migration
-- (20261003120000_waitlist_require_confirmation.sql) closes the old
-- join_waitlist() path once the new page is live.
--
-- A signup is waiting for confirmation while confirm_token_hash is set
-- and confirmed_at is null. Rows from before this change, and buyers a
-- breeder adds by hand, have no hash and count as confirmed.

alter table public.gecko_waitlist_signups add column if not exists confirm_token_hash text;
alter table public.gecko_waitlist_signups add column if not exists confirmation_sent_at timestamptz;
alter table public.gecko_waitlist_signups add column if not exists confirmation_send_count integer not null default 0;
alter table public.gecko_waitlist_signups add column if not exists confirmed_at timestamptz;
create unique index if not exists gecko_waitlist_signups_confirm_token_hash_key
  on public.gecko_waitlist_signups (confirm_token_hash) where confirm_token_hash is not null;

comment on column public.gecko_waitlist_signups.confirm_token_hash is 'sha256 (hex) of the emailed confirmation token. Set means the signup came from the public page and must be confirmed.';
comment on column public.gecko_waitlist_signups.confirmed_at is 'When the buyer opened the confirmation link. Null with a token hash means not confirmed yet.';

-- The guard keeps buyers and breeders from writing the confirmation
-- columns; only the service role (the edge function) sets them.
create or replace function public.guard_waitlist_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  is_breeder boolean := exists (
    select 1 from public.gecko_waitlists w
     where w.id = new.waitlist_id and w.breeder_user_id = auth.uid()
  );
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
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
  if tg_op = 'INSERT' and not is_service then
    new.confirm_token_hash := null;
    new.confirmation_sent_at := null;
    new.confirmation_send_count := 0;
    new.confirmed_at := null;
  end if;
  if tg_op = 'UPDATE' then
    new.terms_accepted_at := old.terms_accepted_at;
    new.terms_snapshot := old.terms_snapshot;
    if not is_service then
      new.confirm_token_hash := old.confirm_token_hash;
      new.confirmation_sent_at := old.confirmation_sent_at;
      new.confirmation_send_count := old.confirmation_send_count;
      new.confirmed_at := old.confirmed_at;
    end if;
  end if;
  return new;
end;
$function$;

-- Is this signup in line (not withdrawn or refunded, and confirmed)?
create or replace function public.waitlist_signup_in_line(s public.gecko_waitlist_signups)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select s.status not in ('withdrawn', 'refunded')
     and (s.confirm_token_hash is null or s.confirmed_at is not null);
$$;

-- What the confirmation email and page show. Never includes the
-- breeder's email address.
create or replace function public.waitlist_signup_details(p_signup_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  s public.gecko_waitlist_signups;
  w public.gecko_waitlists;
  place int;
begin
  select * into s from public.gecko_waitlist_signups where id = p_signup_id;
  if not found then return null; end if;
  select * into w from public.gecko_waitlists where id = s.waitlist_id;
  if not found then return null; end if;

  select count(*) into place
    from public.gecko_waitlist_signups o
   where o.waitlist_id = w.id
     and public.waitlist_signup_in_line(o)
     and (o.created_date, o.id) <= (s.created_date, s.id);

  return jsonb_build_object(
    'signup_id', s.id,
    'name', s.name,
    'email', s.email,
    'wanted', s.wanted_outcome,
    'in_line', public.waitlist_signup_in_line(s),
    'position', case when public.waitlist_signup_in_line(s) then place end,
    'confirmed', s.confirm_token_hash is null or s.confirmed_at is not null,
    'terms', s.terms_snapshot,
    'terms_accepted_at', s.terms_accepted_at,
    'title', w.title,
    'slug', w.slug,
    'deposit_amount', w.deposit_amount,
    'deposit_instructions', w.deposit_instructions,
    'currency', w.currency
  );
end;
$$;

-- Sign up from the public page. Same checks as join_waitlist(), but the
-- new row waits for email confirmation: it does not hold a place, count
-- toward the limit, or notify the breeder until it is confirmed.
create or replace function public.waitlist_join_pending(
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
set search_path to 'public'
as $$
declare
  w public.gecko_waitlists;
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_wanted text := nullif(trim(coalesce(p_wanted, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_terms text;
  mine public.gecko_waitlist_signups;
  pending_recent int;
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
    return jsonb_build_object(
      'signup_id', mine.id,
      'already', true,
      'confirmed', mine.confirm_token_hash is null or mine.confirmed_at is not null
    );
  end if;

  if not w.is_open or (w.closes_at is not null and w.closes_at < now()) then
    raise exception 'This waitlist is closed.';
  end if;
  if v_terms is not null and not coalesce(p_accept_terms, false) then
    raise exception 'Please read and agree to the deposit terms to join.';
  end if;
  if w.max_signups is not null and (
    select count(*) from public.gecko_waitlist_signups o
     where o.waitlist_id = w.id and public.waitlist_signup_in_line(o)
  ) >= w.max_signups then
    raise exception 'This waitlist is full.';
  end if;
  -- Unconfirmed signups send email, so cap them per list.
  select count(*) into pending_recent
    from public.gecko_waitlist_signups o
   where o.waitlist_id = w.id
     and o.confirm_token_hash is not null and o.confirmed_at is null
     and o.created_date > now() - interval '1 hour';
  if pending_recent >= 30 then
    raise exception 'Too many signups right now. Please try again in an hour.';
  end if;

  insert into public.gecko_waitlist_signups
    (waitlist_id, name, email, wanted_outcome, notes, terms_accepted_at, terms_snapshot, confirm_token_hash)
  values
    (w.id, v_name, v_email, v_wanted, v_notes,
     case when v_terms is not null then now() end, v_terms,
     -- Placeholder until the edge function stores the emailed token's hash.
     'pending:' || gen_random_uuid()::text)
  returning * into mine;

  return jsonb_build_object('signup_id', mine.id, 'already', false, 'confirmed', false);
end;
$$;

-- Open the emailed link. Returns the details (with place in line) or
-- null when the link is unknown or more than 7 days old.
create or replace function public.confirm_waitlist_signup(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s public.gecko_waitlist_signups;
  w public.gecko_waitlists;
  was_confirmed boolean;
  recent int;
  details jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into s from public.gecko_waitlist_signups where confirm_token_hash = p_token_hash for update;
  if not found then return null; end if;
  select * into w from public.gecko_waitlists where id = s.waitlist_id;
  if not found then return null; end if;

  was_confirmed := s.confirmed_at is not null;
  if not was_confirmed then
    if s.confirmation_sent_at is not null and s.confirmation_sent_at < now() - interval '7 days' then
      return null;
    end if;
    if s.status in ('withdrawn', 'refunded') then
      return null;
    end if;
    if w.max_signups is not null and (
      select count(*) from public.gecko_waitlist_signups o
       where o.waitlist_id = w.id and public.waitlist_signup_in_line(o)
    ) >= w.max_signups then
      raise exception 'This waitlist filled up before you confirmed.';
    end if;

    update public.gecko_waitlist_signups set confirmed_at = now() where id = s.id;

    select count(*) into recent
      from public.notifications
     where type = 'waitlist_signup'
       and metadata->>'waitlist_id' = w.id::text
       and created_date > now() - interval '1 hour';
    if recent < 20 then
      insert into public.notifications (user_email, type, content, link, metadata)
      select u.email,
             'waitlist_signup',
             left(s.name || ' joined your waitlist "' || w.title || '"'
                  || coalesce(', hoping for ' || s.wanted_outcome, '') || '.', 500),
             '/MarketplaceSalesStats?tab=waitlists',
             jsonb_build_object('waitlist_id', w.id)
        from auth.users u
       where u.id = w.breeder_user_id and u.email is not null;
    end if;
  end if;

  details := public.waitlist_signup_details(s.id);
  return details || jsonb_build_object('already_confirmed', was_confirmed);
end;
$$;

revoke all on function public.waitlist_signup_details(uuid) from public, anon, authenticated;
revoke all on function public.waitlist_join_pending(text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.confirm_waitlist_signup(text) from public, anon, authenticated;
grant execute on function public.waitlist_signup_details(uuid) to service_role;
grant execute on function public.waitlist_join_pending(text, text, text, text, text, boolean) to service_role;
grant execute on function public.confirm_waitlist_signup(text) to service_role;
grant execute on function public.waitlist_signup_in_line(public.gecko_waitlist_signups) to anon, authenticated, service_role;
