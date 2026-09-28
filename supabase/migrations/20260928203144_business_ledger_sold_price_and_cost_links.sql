-- Business Tools profit and loss (business sprint step 2, 28 Sep 2026).
--
-- 1. A sold gecko's revenue was its asking price, and its revenue
--    category lived only in the browser. sold_price and sale_category
--    keep both on the gecko. Existing sold geckos keep counting their
--    asking price until the breeder enters what they sold for, so no
--    total changes.
-- 2. Costs can be tied to a gecko or a pairing, for profit per pairing.
-- 3. claim_transfer now clears the seller's archive and sale fields when a
--    gecko changes hands, so the buyer's copy is not counted as sold and
--    does not carry the seller's sold price. The seller's sale is read from
--    transfer_requests.sale_price.

alter table public.geckos
  add column if not exists sold_price numeric,
  add column if not exists sale_category text;

alter table public.marketplace_costs
  add column if not exists gecko_id text,
  add column if not exists breeding_plan_id text;

create index if not exists marketplace_costs_gecko_id_idx
  on public.marketplace_costs (gecko_id) where gecko_id is not null;
create index if not exists marketplace_costs_breeding_plan_id_idx
  on public.marketplace_costs (breeding_plan_id) where breeding_plan_id is not null;

create or replace function public.claim_transfer(p_token text, p_contribute boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  select coalesce(full_name, v_email) into v_name
  from profiles where email = v_email;
  v_name := coalesce(v_name, v_email);

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

    update geckos
    set created_by = v_email,
        collection_id = v_cid,
        status = 'Owned',
        archived = false,
        archived_date = null,
        archive_reason = null,
        sold_price = null,
        sale_category = null,
        updated_date = v_now
    where id = v_tr.animal_id;
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
$function$;
