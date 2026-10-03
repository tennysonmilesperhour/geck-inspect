-- Passport, transfers and lineage (feature-completeness audit steps 17 and 27).
--
-- 1. Weigh-ins get the same public-passport read rule as feeding, shed and
--    vet records, so a passport's Weight tab shows data to every visitor.
--    Anonymous readers get every weigh-in column except created_by (which
--    holds the owner's email address).
-- 2. get_passport_visibility() lets the passport page tell "this passport is
--    private" apart from "no such passport" without reading the gecko row.
-- 3. get_transfer_preview() also returns the animal's name, photo and morph,
--    so the claim page shows them even when the gecko is private.
-- 4. claim_transfer() gives the claimed gecko a real app status (not
--    "Owned"), keeps its parent names, and never writes an email address as
--    the public owner name.
-- 5. Parent names are kept when a parent is linked (a trigger fills
--    sire_name / dam_name from the linked record), and existing rows are
--    backfilled, so a tree still shows the sire and dam when the parent is
--    private, deleted or owned by someone else.
-- 6. Collection invites get a read-only preview and a Decline action, so the
--    invite page no longer accepts itself on load.
--
-- Everything is additive and safe to run twice.

-- ---------------------------------------------------------------------------
-- 1. Weigh-in public-passport read rule
-- ---------------------------------------------------------------------------
do $policy$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'weight_records'
       and policyname = 'weight_records_read_passport'
  ) then
    create policy "weight_records_read_passport" on public.weight_records
      for select to anon, authenticated
      using (public.gecko_passport_is_public(gecko_id));
  end if;
end
$policy$;

-- Anonymous visitors may read every column except created_by. Before this
-- migration anon matched no weight_records rows at all, so narrowing the
-- column grant takes nothing away.
revoke select on public.weight_records from anon;
grant select (id, gecko_id, weight_grams, record_date, notes, created_date, updated_date)
  on public.weight_records to anon;

-- ---------------------------------------------------------------------------
-- 2. Passport visibility
-- ---------------------------------------------------------------------------
create or replace function public.get_passport_visibility(p_code text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when g.is_public then 'public' else 'private' end
    from public.geckos g
   where g.passport_code = p_code
     and p_code is not null
     and length(p_code) >= 4
   limit 1;
$$;

revoke all on function public.get_passport_visibility(text) from public;
grant execute on function public.get_passport_visibility(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Transfer preview with the animal's name and photo
-- ---------------------------------------------------------------------------
create or replace function public.get_transfer_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_tr transfer_requests%rowtype;
  v_local text;
  v_domain text;
  v_masked text;
  v_name text;
  v_subtitle text;
  v_image text;
  v_passport text;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v_tr from transfer_requests where token = p_token;
  if not found then
    return null;
  end if;
  v_local := split_part(coalesce(v_tr.to_email, ''), '@', 1);
  v_domain := split_part(coalesce(v_tr.to_email, ''), '@', 2);
  v_masked := case
    when v_local = '' then null
    else left(v_local, 1) || repeat('*', greatest(length(v_local) - 1, 2)) || '@' || v_domain
  end;

  if v_tr.animal_type = 'other_reptile' then
    select r.name,
           nullif(concat_ws(' • ', nullif(r.species, ''), nullif(r.morph, '')), ''),
           case when jsonb_typeof(r.image_urls) = 'array' then r.image_urls ->> 0 end
      into v_name, v_subtitle, v_image
      from other_reptiles r
     where r.id = v_tr.animal_id;
  else
    select g.name,
           nullif(g.morphs_traits, ''),
           case when jsonb_typeof(g.image_urls) = 'array' then g.image_urls ->> 0 end,
           g.passport_code
      into v_name, v_subtitle, v_image, v_passport
      from geckos g
     where g.id = v_tr.animal_id;
  end if;

  return jsonb_build_object(
    'id', v_tr.id,
    'status', v_tr.status,
    'expires_at', v_tr.expires_at,
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type,
    'message', v_tr.message,
    'sale_price', v_tr.sale_price,
    'to_email_masked', v_masked,
    'animal_name', v_name,
    'animal_subtitle', v_subtitle,
    'animal_image', v_image,
    'passport_code', v_passport
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Claim: real status, parent names kept, no email as owner name
-- ---------------------------------------------------------------------------
create or replace function public.claim_transfer(p_token text, p_contribute boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_uid   uuid := auth.uid();
  v_name  text;
  v_tr    transfer_requests%rowtype;
  v_now   timestamptz := now();
  v_cid   uuid;
begin
  if v_email is null or v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_tr
  from transfer_requests
  where token = p_token
  for update;

  if not found then
    raise exception 'transfer not found';
  end if;
  if v_tr.status = 'claimed' then
    raise exception 'already claimed';
  end if;
  if v_tr.status = 'cancelled' then
    raise exception 'transfer cancelled';
  end if;
  if v_tr.status = 'expired' or v_tr.expires_at < v_now then
    raise exception 'transfer expired';
  end if;
  if lower(coalesce(v_tr.to_email, '')) <> lower(v_email) then
    raise exception 'not the intended recipient';
  end if;

  -- The owner name is shown on the public passport, so it must never fall
  -- back to the email address.
  select coalesce(nullif(trim(full_name), ''), nullif(trim(breeder_name), ''), nullif(trim(business_name), ''))
    into v_name
  from profiles where lower(email) = lower(v_email)
  limit 1;
  v_name := coalesce(v_name, 'Geck Inspect keeper');

  update transfer_requests
  set status = 'claimed',
      to_user_id = v_uid,
      claimed_at = v_now,
      updated_date = v_now
  where id = v_tr.id;

  if v_tr.animal_type = 'other_reptile' then
    update other_reptiles
    set created_by = v_email,
        archived = false,
        archived_date = null,
        updated_date = v_now
    where id = v_tr.animal_id;
  else
    select id into v_cid
    from collections
    where lower(owner_email) = lower(v_email) and is_default = true
    limit 1;

    if v_cid is null then
      insert into collections (owner_email, name, description, is_default)
      values (v_email, 'My collection', 'Default collection.', true)
      returning id into v_cid;

      insert into collection_members
          (collection_id, member_email, role, status, accepted_at)
      values (v_cid, v_email, 'owner', 'accepted', v_now)
      on conflict (collection_id, lower(member_email)) do nothing;
    end if;

    -- Status: keep a breeding status the animal has earned, otherwise it is
    -- the buyer's Pet (the app's default for an owned gecko). "For Sale",
    -- "Sold" and "Holdback" describe the seller's plans, not the buyer's.
    -- Parent names are copied from the linked parents now, while the seller
    -- still owns them, so the buyer's tree keeps its sire and dam.
    update geckos g
    set created_by = v_email,
        collection_id = v_cid,
        status = case
          when g.status in ('Future Breeder', 'Ready to Breed', 'Proven', 'Pet') then g.status
          else 'Pet'
        end,
        sire_name = coalesce(nullif(g.sire_name, ''), (select s.name from geckos s where s.id = g.sire_id)),
        dam_name = coalesce(nullif(g.dam_name, ''), (select d.name from geckos d where d.id = g.dam_id)),
        archived = false,
        archived_date = null,
        archive_reason = null,
        sold_price = null,
        sale_category = null,
        updated_date = v_now
    where g.id = v_tr.animal_id;
  end if;

  insert into ownership_records (
    animal_id, owner_user_id, owner_name, acquired_date,
    transfer_method, sale_price, contributed_to_market_data,
    created_by, created_date, updated_date
  ) values (
    v_tr.animal_id, v_uid, v_name, v_now::date,
    'purchased', v_tr.sale_price,
    (p_contribute and v_tr.sale_price is not null),
    v_email, v_now, v_now
  );

  return jsonb_build_object(
    'ok', true,
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Keep parent names when a parent is linked
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: the parent's name is only copied when the
-- person saving the gecko can already read the parent, so linking to an id
-- you cannot see reveals nothing.
create or replace function public.geckos_fill_parent_names()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_parent text;
begin
  if new.sire_id is not null
     and (tg_op = 'INSERT' or new.sire_id is distinct from old.sire_id or coalesce(new.sire_name, '') = '') then
    select nullif(name, '') into v_parent from public.geckos where id = new.sire_id;
    if v_parent is not null then
      new.sire_name := v_parent;
    end if;
  end if;

  v_parent := null;
  if new.dam_id is not null
     and (tg_op = 'INSERT' or new.dam_id is distinct from old.dam_id or coalesce(new.dam_name, '') = '') then
    select nullif(name, '') into v_parent from public.geckos where id = new.dam_id;
    if v_parent is not null then
      new.dam_name := v_parent;
    end if;
  end if;

  return new;
end;
$$;

-- Backfill linked parents that have no stored name. The activity log and
-- change-timestamp triggers are paused so this housekeeping does not show
-- up as an edit in anyone's collection feed.
alter table public.geckos disable trigger geckos_collection_activity;
alter table public.geckos disable trigger geckos_bump_change_ts;

update public.geckos g
   set sire_name = s.name
  from public.geckos s
 where s.id = g.sire_id
   and coalesce(g.sire_name, '') = ''
   and coalesce(s.name, '') <> '';

update public.geckos g
   set dam_name = d.name
  from public.geckos d
 where d.id = g.dam_id
   and coalesce(g.dam_name, '') = ''
   and coalesce(d.name, '') <> '';

alter table public.geckos enable trigger geckos_collection_activity;
alter table public.geckos enable trigger geckos_bump_change_ts;

create or replace trigger geckos_fill_parent_names
  before insert or update of sire_id, dam_id, sire_name, dam_name on public.geckos
  for each row execute function public.geckos_fill_parent_names();

-- ---------------------------------------------------------------------------
-- 6. Collection invites: preview and decline
-- ---------------------------------------------------------------------------
create or replace function public.get_collection_invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_row collection_members%rowtype;
  v_collection text;
  v_inviter text;
  v_local text;
  v_domain text;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v_row from collection_members where invite_token = p_token limit 1;
  if not found then
    return null;
  end if;

  select c.name into v_collection from collections c where c.id = v_row.collection_id;

  -- Display name only; the inviter's email is never returned.
  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.breeder_name), ''), nullif(trim(p.business_name), ''))
    into v_inviter
    from profiles p
   where lower(p.email) = lower(coalesce(v_row.invited_by_email,
           (select c.owner_email from collections c where c.id = v_row.collection_id)))
   limit 1;

  v_local := split_part(coalesce(v_row.member_email, ''), '@', 1);
  v_domain := split_part(coalesce(v_row.member_email, ''), '@', 2);

  return jsonb_build_object(
    'status', case
      when v_row.status = 'pending' and v_row.expires_at is not null and v_row.expires_at < now() then 'expired'
      else v_row.status
    end,
    'role', v_row.role,
    'collection_name', v_collection,
    'inviter_name', v_inviter,
    'expires_at', v_row.expires_at,
    'member_email_masked', case
      when v_local = '' then null
      else left(v_local, 1) || repeat('*', greatest(length(v_local) - 1, 2)) || '@' || v_domain
    end
  );
end;
$$;

revoke all on function public.get_collection_invite_preview(text) from public;
grant execute on function public.get_collection_invite_preview(text) to anon, authenticated;

-- Declining needs only the link: the token was emailed to the invitee, and
-- a decline cannot grant anything (the owner can always invite again).
create or replace function public.decline_collection_invite(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row collection_members%rowtype;
begin
  if p_token is null or length(p_token) < 8 then
    raise exception 'invite not found';
  end if;
  select * into v_row from collection_members where invite_token = p_token limit 1 for update;
  if not found then
    raise exception 'invite not found';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'invite is %', v_row.status;
  end if;

  update collection_members
     set status = 'declined',
         declined_at = now()
   where id = v_row.id;

  return 'declined';
end;
$$;

revoke all on function public.decline_collection_invite(text) from public;
grant execute on function public.decline_collection_invite(text) to anon, authenticated;
