-- Secure QR transfers. Written 17 Oct 2026 as 20261017200248; re-dated on
-- 24 Oct to run after main's newest migration, and released on Tennyson's
-- instruction to merge the open pull requests.
-- claim_transfer starts from 20261015120000_ownership_checks.sql.
-- get_transfer_preview starts from 20261003004122_passport_transfers_lineage.sql.
-- Existing signatures and email transfers remain supported. New links are
-- server-issued, scoped to one animal, valid for 72 hours and revocable.
-- No related record RLS is broadened. Private keeper notes stay with the sender.

alter table public.transfer_requests
  add column if not exists claim_mode text not null default 'email';

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.transfer_requests'::regclass
                 and conname = 'transfer_requests_claim_mode_check') then
    alter table public.transfer_requests add constraint transfer_requests_claim_mode_check
      check (claim_mode in ('email', 'link'));
  end if;
end $$;

create index if not exists transfer_requests_pending_animal_idx
  on public.transfer_requests (animal_type, animal_id) where status = 'pending';

-- Keep notes without giving the recipient or the recipient's collaborators
-- access to them. These follow the transfer history's existing retention;
-- deleting the sender account removes the archive through auth.users too.
create table if not exists public.gecko_transfer_private_notes (
  transfer_id uuid primary key references public.transfer_requests(id) on delete cascade,
  animal_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  notes text not null,
  created_date timestamptz not null default now()
);
create index if not exists gecko_transfer_private_notes_owner_idx
  on public.gecko_transfer_private_notes (owner_user_id);
alter table public.gecko_transfer_private_notes enable row level security;
revoke all on public.gecko_transfer_private_notes from public, anon, authenticated;
grant select on public.gecko_transfer_private_notes to authenticated;
grant all on public.gecko_transfer_private_notes to service_role;
drop policy if exists gecko_transfer_private_notes_owner_read on public.gecko_transfer_private_notes;
create policy gecko_transfer_private_notes_owner_read on public.gecko_transfer_private_notes
  for select to authenticated using (owner_user_id = (select auth.uid()));

-- Definer helpers are kept outside the exposed API schema. Public entry
-- points below have fixed bodies, fixed search paths and explicit grants.
create or replace function geck_private.transfer_actor_email()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select u.email into v_email from auth.users u
   where u.id = auth.uid() and u.email_confirmed_at is not null
     and not u.is_anonymous and u.deleted_at is null
     and (u.banned_until is null or u.banned_until <= now());
  if v_email is null then
    raise exception 'verified email required' using errcode = '42501';
  end if;
  -- Reject a stale token after an account email change.
  if lower(v_email) is distinct from lower(auth.jwt() ->> 'email') then
    raise exception 'sign in again' using errcode = '42501';
  end if;
  return v_email;
end $$;

-- RLS needs a safe current-account check too: the original email policy
-- compared empty to_email with COALESCE(missing JWT email, ''), exposing open
-- QR tokens to authenticated anonymous/phone-only sessions. This helper has
-- no caller-supplied identity and reveals only the caller's verified email.
create or replace function public.transfer_verified_email()
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  return geck_private.transfer_actor_email();
exception when insufficient_privilege then
  return null;
end $$;

drop policy if exists "Sender and recipient read transfer requests" on public.transfer_requests;
drop policy if exists transfer_requests_claimant_read on public.transfer_requests;
create policy "Sender and recipient read transfer requests" on public.transfer_requests
  for select to authenticated
  using (
    (select public.transfer_verified_email()) is not null
    and (
      from_user_id = (select auth.uid())
      or (nullif(trim(to_email), '') is not null
          and lower(to_email) = lower((select public.transfer_verified_email())))
      or (status = 'claimed' and to_user_id = (select auth.uid()))
    )
  );

-- Start from the 15 Oct guard. Browser updates can now only cancel/expire
-- pending requests; they cannot revive a revoked link, extend its life, change
-- its recipient or retarget its token. Older browsers still insert email rows.
create or replace function public.guard_transfer_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('', 'service_role')
     or current_setting('geck.ownership_transfer', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.from_user_id := auth.uid();
    new.status := 'pending';
    new.to_user_id := null;
    new.claimed_at := null;
    if not public.is_animal_owner(new.animal_type, new.animal_id) then
      raise exception 'Only the owner of this animal can transfer it.' using errcode = '42501';
    end if;
    if new.claim_mode <> 'email' or nullif(trim(new.to_email), '') is null then
      raise exception 'Create a QR transfer with create_transfer.' using errcode = '42501';
    end if;
    if new.expires_at <= now() then
      raise exception 'A transfer link is valid for up to 72 hours.' using errcode = '22023';
    end if;
    -- Older browser builds calculate this timestamp on the device. Bound it
    -- with the server clock without rejecting harmless device clock drift.
    new.expires_at := least(new.expires_at, now() + interval '72 hours');
    return new;
  end if;
  if old.status = 'claimed' then
    raise exception 'A claimed transfer can no longer be changed.' using errcode = '42501';
  end if;
  if old.status <> 'pending' then
    raise exception 'A cancelled or expired transfer can no longer be changed.' using errcode = '42501';
  end if;
  if new.status not in ('cancelled', 'expired')
     or (to_jsonb(new) - 'status' - 'updated_date') is distinct from
        (to_jsonb(old) - 'status' - 'updated_date') then
    raise exception 'Cancel this transfer and create a new link to change it.' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function geck_private.create_transfer(
  p_animal_id text, p_animal_type text default 'gecko', p_to_email text default null,
  p_sale_price numeric default null, p_message text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := geck_private.transfer_actor_email();
  v_to text := lower(nullif(trim(p_to_email), ''));
  v_owner text;
  v_tr public.transfer_requests%rowtype;
begin
  if p_animal_type not in ('gecko', 'other_reptile') or p_animal_type is null then
    raise exception 'animal not found';
  end if;
  if v_to is null and p_animal_type <> 'gecko' then
    raise exception 'QR transfers are available for geckos.' using errcode = '22023';
  end if;
  if v_to is not null and (length(v_to) > 320 or v_to !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Enter a valid recipient email.' using errcode = '22023';
  end if;
  if v_to = lower(v_email) then raise exception 'cannot transfer to yourself'; end if;
  if p_sale_price is not null and (p_sale_price < 0 or p_sale_price > 99999999.99 or p_sale_price = 'NaN'::numeric) then
    raise exception 'Enter a valid sale price.' using errcode = '22023';
  end if;
  if length(coalesce(p_message, '')) > 2000 then
    raise exception 'Keep the transfer message under 2000 characters.' using errcode = '22023';
  end if;
  -- Every create/claim/revoke locks the animal before the request. Two
  -- different links for one gecko cannot race into two successful claims.
  if p_animal_type = 'other_reptile' then
    select r.created_by into v_owner from public.other_reptiles r where r.id = p_animal_id for update;
  else
    select g.created_by into v_owner from public.geckos g where g.id = p_animal_id for update;
  end if;
  if v_owner is null or lower(v_owner) <> lower(v_email) then
    raise exception 'Only the owner of this animal can transfer it.' using errcode = '42501';
  end if;
  perform set_config('geck.ownership_transfer', 'on', true);
  -- Creating a replacement invalidates every outstanding offer for this
  -- animal, including offers from earlier keepers after a round trip.
  update public.transfer_requests set status = 'cancelled', updated_date = now()
   where animal_id = p_animal_id and animal_type = p_animal_type and status = 'pending';
  insert into public.transfer_requests (
    animal_id, animal_type, from_user_id, to_email, token, claim_mode,
    sale_price, message, created_by, expires_at
  ) values (
    p_animal_id, p_animal_type, auth.uid(), coalesce(v_to, ''),
    encode(extensions.gen_random_bytes(32), 'hex'), case when v_to is null then 'link' else 'email' end,
    p_sale_price, nullif(trim(p_message), ''), v_email, now() + interval '72 hours'
  ) returning * into v_tr;
  perform set_config('geck.ownership_transfer', 'off', true);
  return jsonb_build_object('id', v_tr.id, 'token', v_tr.token,
    'expires_at', v_tr.expires_at, 'claim_mode', v_tr.claim_mode, 'status', v_tr.status);
end $$;

create or replace function public.create_transfer(
  p_animal_id text, p_animal_type text default 'gecko', p_to_email text default null,
  p_sale_price numeric default null, p_message text default null
) returns jsonb language sql security definer set search_path = '' as $$
  select geck_private.create_transfer(p_animal_id, p_animal_type, p_to_email, p_sale_price, p_message);
$$;

create or replace function geck_private.revoke_transfer(p_transfer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := geck_private.transfer_actor_email();
  v_tr public.transfer_requests%rowtype;
  v_owner text;
begin
  select * into v_tr from public.transfer_requests where id = p_transfer_id;
  if not found or v_tr.from_user_id is distinct from auth.uid() then raise exception 'transfer not found'; end if;
  if v_tr.animal_type = 'other_reptile' then
    select created_by into v_owner from public.other_reptiles where id = v_tr.animal_id for update;
  else
    select created_by into v_owner from public.geckos where id = v_tr.animal_id for update;
  end if;
  select * into v_tr from public.transfer_requests where id = p_transfer_id for update;
  if not found or v_tr.from_user_id is distinct from auth.uid() then raise exception 'transfer not found'; end if;
  if v_tr.status = 'claimed' then raise exception 'already claimed'; end if;
  -- A sender may always withdraw their own unused offer after losing the
  -- animal too. This only removes access; it never grants any ownership.
  if v_tr.status = 'pending' then
    update public.transfer_requests set status = 'cancelled', updated_date = now() where id = v_tr.id;
    v_tr.status := 'cancelled';
  end if;
  return jsonb_build_object('status', v_tr.status);
end $$;

create or replace function public.revoke_transfer(p_transfer_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select geck_private.revoke_transfer(p_transfer_id);
$$;

create or replace function geck_private.get_transfer_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tr public.transfer_requests%rowtype;
  v_email text;
  v_owner text;
  v_sender_valid boolean;
  v_authorized boolean := false;
  v_claimed_by_you boolean := false;
  v_status text;
  v_result jsonb;
  v_name text;
  v_subtitle text;
  v_image text;
  v_passport text;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 128 then return null; end if;
  select * into v_tr from public.transfer_requests where token = p_token;
  if not found then return null; end if;
  -- Anonymous users and stale/unverified sessions receive no private details.
  if auth.uid() is not null then
    begin v_email := geck_private.transfer_actor_email();
    exception when insufficient_privilege then v_email := null; end;
  end if;
  if v_tr.animal_type = 'other_reptile' then
    select created_by into v_owner from public.other_reptiles where id = v_tr.animal_id;
  else
    select created_by into v_owner from public.geckos where id = v_tr.animal_id;
  end if;
  v_sender_valid := lower(coalesce(v_owner, '')) = lower(coalesce(v_tr.created_by, ''))
    and exists (select 1 from auth.users u where u.id = v_tr.from_user_id
      and lower(u.email) = lower(v_tr.created_by) and u.deleted_at is null);
  v_status := case when v_tr.status <> 'pending' then v_tr.status
    when v_tr.expires_at <= now() then 'expired'
    when not v_sender_valid then 'cancelled'
    else 'pending' end;
  v_claimed_by_you := v_tr.status = 'claimed' and v_tr.to_user_id = auth.uid()
    and lower(v_owner) = lower(v_email);
  v_authorized := v_email is not null and (
    (v_tr.from_user_id = auth.uid() and lower(v_owner) = lower(v_email))
    or (v_status = 'pending' and v_tr.claim_mode = 'email' and lower(v_tr.to_email) = lower(v_email))
    or v_claimed_by_you
  );
  v_result := jsonb_build_object('status', v_status, 'expires_at', v_tr.expires_at,
    'claim_mode', v_tr.claim_mode, 'recipient_authorized', coalesce(v_authorized, false),
    'claimed_by_you', coalesce(v_claimed_by_you, false));
  if not coalesce(v_authorized, false) then return v_result; end if;
  if v_tr.animal_type = 'other_reptile' then
    select r.name, nullif(concat_ws(' • ', nullif(r.species, ''), nullif(r.morph, '')), ''),
      case when jsonb_typeof(r.image_urls) = 'array' then r.image_urls ->> 0 end
      into v_name, v_subtitle, v_image from public.other_reptiles r where r.id = v_tr.animal_id;
  else
    select g.name, nullif(g.morphs_traits, ''),
      case when jsonb_typeof(g.image_urls) = 'array' then g.image_urls ->> 0 end, g.passport_code
      into v_name, v_subtitle, v_image, v_passport from public.geckos g where g.id = v_tr.animal_id;
  end if;
  return v_result || jsonb_build_object('id', v_tr.id, 'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type, 'message', v_tr.message, 'sale_price', v_tr.sale_price,
    'to_email_masked', null, 'animal_name', v_name, 'animal_subtitle', v_subtitle,
    'animal_image', v_image, 'passport_code', v_passport);
end $$;

create or replace function public.get_transfer_preview(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select geck_private.get_transfer_preview(p_token);
$$;

create or replace function geck_private.claim_transfer(p_token text, p_contribute boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := geck_private.transfer_actor_email();
  v_uid uuid := auth.uid();
  v_name text;
  v_tr public.transfer_requests%rowtype;
  v_now timestamptz;
  v_cid uuid;
  v_owner text;
  v_notes text;
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 128 then raise exception 'transfer not found'; end if;
  select * into v_tr from public.transfer_requests where token = p_token;
  if not found then raise exception 'transfer not found'; end if;
  -- Lock animal first, then reread/lock the request. The trigger makes the
  -- animal scope immutable, and all privileged transfer paths share this order.
  if v_tr.animal_type = 'other_reptile' then
    select created_by into v_owner from public.other_reptiles where id = v_tr.animal_id for update;
  else
    select created_by, notes into v_owner, v_notes from public.geckos where id = v_tr.animal_id for update;
  end if;
  if not found then raise exception 'animal not found'; end if;
  select * into v_tr from public.transfer_requests where token = p_token for update;
  if not found then raise exception 'transfer not found'; end if;
  -- The wait for the animal/offer lock can cross the expiry boundary.
  -- Evaluate the clock after acquiring both locks, not at transaction start.
  v_now := clock_timestamp();
  if v_tr.status = 'claimed' then
    if v_tr.to_user_id = v_uid and lower(v_owner) = lower(v_email) then
      return jsonb_build_object('ok', true, 'animal_id', v_tr.animal_id,
        'animal_type', v_tr.animal_type, 'already_claimed', true);
    end if;
    raise exception 'already claimed';
  end if;
  if v_tr.status = 'cancelled' then raise exception 'transfer cancelled'; end if;
  if v_tr.status = 'expired' or v_tr.expires_at <= v_now then raise exception 'transfer expired'; end if;
  if v_tr.claim_mode = 'email' and lower(v_tr.to_email) <> lower(v_email) then
    raise exception 'not the intended recipient';
  end if;
  if v_tr.created_by is null or lower(coalesce(v_owner, '')) <> lower(v_tr.created_by)
     or not exists (select 1 from auth.users u where u.id = v_tr.from_user_id
                    and lower(u.email) = lower(v_tr.created_by) and u.deleted_at is null) then
    raise exception 'the sender no longer owns this animal';
  end if;
  if v_tr.from_user_id = v_uid or lower(v_owner) = lower(v_email) then raise exception 'cannot transfer to yourself'; end if;
  -- Lock the recipient's profile to serialize default-collection creation.
  select coalesce(nullif(trim(full_name), ''), nullif(trim(breeder_name), ''), nullif(trim(business_name), ''))
    into v_name from public.profiles where lower(email) = lower(v_email) limit 1 for update;
  if not found then raise exception 'account setup incomplete'; end if;
  v_name := coalesce(v_name, 'Geck Inspect keeper');

  perform set_config('geck.ownership_transfer', 'on', true);
  update public.transfer_requests set status = 'claimed', to_user_id = v_uid,
    claimed_at = v_now, updated_date = v_now where id = v_tr.id;
  -- Invalidate sibling offers permanently, including older email links.
  update public.transfer_requests set status = 'cancelled', updated_date = v_now
   where animal_id = v_tr.animal_id and animal_type = v_tr.animal_type
     and status = 'pending' and id <> v_tr.id;
  if v_tr.animal_type = 'other_reptile' then
    update public.other_reptiles set created_by = v_email, archived = false,
      archived_date = null, updated_date = v_now where id = v_tr.animal_id;
  else
    select id into v_cid from public.collections
     where lower(owner_email) = lower(v_email) and is_default = true limit 1;
    if v_cid is null then
      insert into public.collections (owner_email, name, description, is_default)
        values (v_email, 'My collection', 'Default collection.', true) returning id into v_cid;
      insert into public.collection_members (collection_id, member_email, role, status, accepted_at)
        values (v_cid, v_email, 'owner', 'accepted', v_now)
        on conflict (collection_id, lower(member_email)) do nothing;
    end if;
    if nullif(v_notes, '') is not null then
      insert into public.gecko_transfer_private_notes (transfer_id, animal_id, owner_user_id, notes)
        values (v_tr.id, v_tr.animal_id, v_tr.from_user_id, v_notes);
    end if;
    update public.geckos g set created_by = v_email, collection_id = v_cid,
      status = case when g.status in ('Future Breeder', 'Ready to Breed', 'Proven', 'Pet') then g.status else 'Pet' end,
      sire_name = coalesce(nullif(g.sire_name, ''), (select s.name from public.geckos s where s.id = g.sire_id)),
      dam_name = coalesce(nullif(g.dam_name, ''), (select d.name from public.geckos d where d.id = g.dam_id)),
      notes = null, archived = false, archived_date = null, archive_reason = null,
      sold_price = null, sale_category = null, updated_date = v_now
     where g.id = v_tr.animal_id;
  end if;
  perform set_config('geck.ownership_transfer', 'off', true);
  if v_tr.animal_type <> 'other_reptile' then
    insert into public.ownership_records (animal_id, owner_user_id, owner_name, acquired_date,
      transfer_method, sale_price, contributed_to_market_data, created_by, created_date, updated_date)
    values (v_tr.animal_id, v_uid, v_name, v_now::date, 'purchased', v_tr.sale_price,
      (coalesce(p_contribute, false) and v_tr.sale_price is not null), v_email, v_now, v_now);
  end if;
  return jsonb_build_object('ok', true, 'animal_id', v_tr.animal_id, 'animal_type', v_tr.animal_type);
end $$;

create or replace function public.claim_transfer(p_token text, p_contribute boolean default false)
returns jsonb language sql security definer set search_path = '' as $$
  select geck_private.claim_transfer(p_token, p_contribute);
$$;

revoke all on function geck_private.transfer_actor_email() from public, anon, authenticated, service_role;
revoke all on function geck_private.create_transfer(text, text, text, numeric, text) from public, anon, authenticated, service_role;
revoke all on function geck_private.revoke_transfer(uuid) from public, anon, authenticated, service_role;
revoke all on function geck_private.get_transfer_preview(text) from public, anon, authenticated, service_role;
revoke all on function geck_private.claim_transfer(text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.guard_transfer_request() from public, anon, authenticated;
grant execute on function public.guard_transfer_request() to service_role;
revoke all on function public.transfer_verified_email() from public, anon;
grant execute on function public.transfer_verified_email() to authenticated, service_role;
revoke all on function public.create_transfer(text, text, text, numeric, text) from public, anon;
grant execute on function public.create_transfer(text, text, text, numeric, text) to authenticated, service_role;
revoke all on function public.revoke_transfer(uuid) from public, anon;
grant execute on function public.revoke_transfer(uuid) to authenticated, service_role;
revoke all on function public.get_transfer_preview(text) from public;
grant execute on function public.get_transfer_preview(text) to anon, authenticated, service_role;
revoke all on function public.claim_transfer(text, boolean) from public, anon;
grant execute on function public.claim_transfer(text, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
