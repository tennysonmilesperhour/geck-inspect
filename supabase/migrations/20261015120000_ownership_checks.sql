-- Ownership checks: who may write to a gecko, its records, its transfer,
-- its collection and a member's profile.
--
-- Written 15 Oct 2026 from the two reviews of that week (the adversarial
-- review and docs/planning/comprehensive-review-2026-10-14.md, Part C and
-- section D7). Every function this file replaces was copied from
-- production (project mmuglfphhwlaluyfyxsp) with pg_get_functiondef first,
-- and production matched the repo copy for all of them.
--
-- Plain-language summary. Before this file, many tables only checked that
-- the row said "created_by = me". They never checked that "me" was allowed
-- to touch the animal the row points at. That let a signed-in member:
--
--   1. start a transfer for someone else's gecko, claim it, and become its
--      owner (the worst hole);
--   2. write fake weigh-ins, feedings, sheds, vet visits, events, ownership
--      history and eggs onto someone else's animal or breeding plan;
--   3. as a collection editor, rewrite a gecko's owner (created_by);
--   4. drop geckos into someone else's collection, add a person to their
--      own collection as an already-accepted member, and read a whole
--      collection from a pending invitation without accepting it;
--   5. get past the Keeper gecko cap (only the browser checked it), and get
--      past every cap by adding a gecko archived and then unarchiving it,
--      or by claiming transfers;
--   6. create or keep editing a profile row for an email address that is
--      not theirs, and backdate "member since";
--   7. Separately, the profile guard silently undid the plan change that
--      redeem_signup_grant (store signup codes) is meant to make.
--   8. as a collection editor, delete the owner's geckos (and with them
--      all their care history); as a transfer sender, delete a claimed
--      transfer; and, as a collection owner, not invite someone again
--      after they left (the old seat blocked a new invitation).
--
-- How the fixes work:
--
--   * Small SECURITY DEFINER helpers (can_edit_gecko and friends) answer
--     "may the signed-in member write to this animal / plan / collection?".
--     SECURITY DEFINER means the helper reads the geckos table with the
--     database owner's rights, so it gives the right answer even when the
--     member cannot read the row themselves. Each helper only ever answers
--     about the signed-in member (it reads auth.email() itself), so calling
--     it through the API reveals nothing about anyone else. The write
--     helpers are VOLATILE on purpose: a STABLE function reads the database
--     as it was when the statement started, and would miss a default
--     collection that a trigger created a moment earlier in the same
--     insert. The two that also back read rules (owns_animal and
--     can_edit_breeding_plan) are STABLE, so long lists stay fast.
--   * Row security policies use those helpers in WITH CHECK, which is the
--     rule a new or changed row must pass.
--   * An animal's owner can now see and delete every record on that
--     animal, including ones another account wrote, so forged rows can be
--     found and removed.
--   * Triggers cover what a policy cannot see, such as the old value of a
--     column (a policy only sees the new row).
--   * Two transaction-local switches let trusted server functions do the
--     one thing they exist for. "Transaction-local" means set_config(...,
--     true): the switch turns itself off when the request ends. A member
--     cannot flip these switches: the API only runs functions in the public
--     schema, and set_config is not one of them. This is the same pattern
--     the referral columns already use (geck.referral_bypass).
--       geck.ownership_transfer       set only by claim_transfer()
--       geck.profile_privileged_write set only by redeem_signup_grant()
--
-- Safe to run twice: every function is create or replace, every trigger
-- and policy is dropped (if it exists) and created again, and no data is
-- changed.

-- ===========================================================================
-- 1. Helpers
-- ===========================================================================

-- May the signed-in member write records for this gecko? Yes for the
-- gecko's owner, for the owner or an accepted editor of the collection the
-- gecko sits in (the existing collection permission model, see
-- is_collection_editor), and for admins.
create or replace function public.can_edit_gecko(p_gecko_id text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(auth.email(), '') <> ''
     and (
       exists (
         select 1
           from public.geckos g
          where g.id = p_gecko_id
            and (
              lower(coalesce(g.created_by, '')) = lower(auth.email())
              or public.is_collection_owner(g.collection_id, auth.email())
              or public.is_collection_editor(g.collection_id, auth.email())
            )
       )
       or public.is_admin()
     );
$$;

-- The same question for another reptile (reptile_events). Other reptiles
-- have no collections, so only their owner (or an admin) may write.
create or replace function public.can_edit_reptile(p_reptile_id text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(auth.email(), '') <> ''
     and (
       exists (
         select 1
           from public.other_reptiles r
          where r.id = p_reptile_id
            and lower(coalesce(r.created_by, '')) = lower(auth.email())
       )
       or public.is_admin()
     );
$$;

-- Does the signed-in member own this animal (gecko or other reptile)?
-- Used to let an owner delete any record on their own animal, so a record
-- someone else wrote can always be removed.
create or replace function public.owns_animal(p_animal_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.email(), '') <> ''
     and (
       exists (
         select 1 from public.geckos g
          where g.id = p_animal_id
            and lower(coalesce(g.created_by, '')) = lower(auth.email())
       )
       or exists (
         select 1 from public.other_reptiles r
          where r.id = p_animal_id
            and lower(coalesce(r.created_by, '')) = lower(auth.email())
       )
     );
$$;

-- Does the signed-in member own the animal a transfer names? Only the
-- owner may start or change a transfer. Collection editors may not: a
-- transfer hands the animal to someone else, which is the owner's call.
create or replace function public.is_animal_owner(p_animal_type text, p_animal_id text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(auth.email(), '') <> ''
     and case
       when p_animal_type = 'other_reptile' then exists (
         select 1 from public.other_reptiles r
          where r.id = p_animal_id
            and lower(coalesce(r.created_by, '')) = lower(auth.email())
       )
       else exists (
         select 1 from public.geckos g
          where g.id = p_animal_id
            and lower(coalesce(g.created_by, '')) = lower(auth.email())
       )
     end;
$$;

-- May the signed-in member add eggs to this breeding plan? Breeding plans
-- are not shared through collections, so only the plan's owner or an admin.
create or replace function public.can_edit_breeding_plan(p_plan_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.email(), '') <> ''
     and (
       exists (
         select 1 from public.breeding_plans b
          where b.id = p_plan_id
            and lower(coalesce(b.created_by, '')) = lower(auth.email())
       )
       or public.is_admin()
     );
$$;

-- May the signed-in member put a gecko into this collection? The owner and
-- accepted editors may (the same people the gecko form offers collections
-- to); viewers and pending invitees may not.
create or replace function public.can_write_collection(p_collection_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select public.is_collection_owner(p_collection_id, auth.email())
      or public.is_collection_editor(p_collection_id, auth.email());
$$;

-- Has the signed-in member been invited to this collection and not yet
-- answered? Lets an invitee see the collection's name (so Settings can say
-- "Invitation waiting") without seeing anything inside it.
create or replace function public.is_collection_invitee(p_collection_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(auth.email(), '') <> ''
     and exists (
       select 1 from public.collection_members m
        where m.collection_id = p_collection_id
          and lower(m.member_email) = lower(auth.email())
          and m.status = 'pending'
     );
$$;

-- Plan caps. These mirror TIER_LIMITS in src/lib/tierLimits.js
-- (maxGeckos and maxCollaborators). null means unlimited. If a cap
-- changes there, change it here too. Tiers come from
-- effective_tier_for_email(), the SQL twin of resolveTier().
create or replace function public.gecko_limit_for_tier(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_tier, 'free'))
    when 'breeder' then null
    when 'enterprise' then null
    when 'keeper' then 50
    else 10
  end;
$$;

create or replace function public.collaborator_limit_for_tier(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_tier, 'free'))
    when 'breeder' then null
    when 'enterprise' then null
    when 'keeper' then 5
    else 1
  end;
$$;

-- Row security policies call these helpers as the signed-in member, so
-- they need EXECUTE for authenticated. Nobody else needs them: signed-out
-- visitors never pass a write policy, and the server (service_role)
-- skips row security altogether.
revoke all on function public.can_edit_gecko(text) from public, anon, service_role;
revoke all on function public.can_edit_reptile(text) from public, anon, service_role;
revoke all on function public.owns_animal(text) from public, anon, service_role;
revoke all on function public.is_animal_owner(text, text) from public, anon, service_role;
revoke all on function public.can_edit_breeding_plan(text) from public, anon, service_role;
revoke all on function public.can_write_collection(uuid) from public, anon, service_role;
revoke all on function public.is_collection_invitee(uuid) from public, anon, service_role;
grant execute on function public.can_edit_gecko(text) to authenticated;
grant execute on function public.can_edit_reptile(text) to authenticated;
grant execute on function public.owns_animal(text) to authenticated;
grant execute on function public.is_animal_owner(text, text) to authenticated;
grant execute on function public.can_edit_breeding_plan(text) to authenticated;
grant execute on function public.can_write_collection(uuid) to authenticated;
grant execute on function public.is_collection_invitee(uuid) to authenticated;

revoke all on function public.gecko_limit_for_tier(text) from public, anon;
revoke all on function public.collaborator_limit_for_tier(text) from public, anon;
grant execute on function public.gecko_limit_for_tier(text) to authenticated, service_role;
grant execute on function public.collaborator_limit_for_tier(text) to authenticated, service_role;

-- ===========================================================================
-- 2. Transfers (item 1: gecko takeover)
-- ===========================================================================

-- A transfer row can only be started by the animal's current owner.
-- Checked twice: in the insert policy, and in a trigger that also gives a
-- readable error message and covers edits. claim_transfer() checks again
-- when the buyer claims, because the seller may have sold or lost the
-- animal in between.
drop policy if exists "transfer_requests_insert_own" on public.transfer_requests;
create policy "transfer_requests_insert_own" on public.transfer_requests
  for insert to authenticated
  with check (
    created_by = (select auth.email())
    and public.is_animal_owner(animal_type, animal_id)
  );

create or replace function public.guard_transfer_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(auth.role(), '');
begin
  -- The server (service_role), database jobs (no signed-in caller) and
  -- claim_transfer() itself are trusted.
  if v_role in ('', 'service_role')
     or current_setting('geck.ownership_transfer', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A new transfer always starts as a plain pending request from the
    -- signed-in member; the claim fields are only ever filled by the claim.
    new.from_user_id := auth.uid();
    new.status := 'pending';
    new.to_user_id := null;
    new.claimed_at := null;
    if not public.is_animal_owner(new.animal_type, new.animal_id) then
      raise exception 'Only the owner of this animal can transfer it.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE. Who sent it and who claimed it never change from the browser.
  new.created_by := old.created_by;
  new.from_user_id := old.from_user_id;
  new.to_user_id := old.to_user_id;
  new.claimed_at := old.claimed_at;

  -- A claimed transfer is history (Transfer History and sales stats read
  -- it), so the sender cannot later relabel it as cancelled or expired.
  if old.status = 'claimed' then
    raise exception 'A claimed transfer can no longer be changed.'
      using errcode = '42501';
  end if;

  if new.status = 'claimed' and old.status is distinct from 'claimed' then
    raise exception 'A transfer is only marked claimed when the buyer claims it.'
      using errcode = '42501';
  end if;

  -- Withdrawing a transfer is always allowed, even after the animal has
  -- gone elsewhere, as long as nothing else about it changes.
  if new.status in ('cancelled', 'expired')
     and new.animal_id = old.animal_id
     and new.animal_type = old.animal_type
     and new.to_email = old.to_email
     and new.token = old.token
     and new.sale_price is not distinct from old.sale_price
     and new.expires_at = old.expires_at then
    return new;
  end if;

  if not public.is_animal_owner(new.animal_type, new.animal_id) then
    raise exception 'Only the owner of this animal can change its transfer.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- A sender may delete a transfer only while it is pending or after they
-- cancelled it. A claimed (or expired) transfer is history: Transfer
-- History, sales stats and breeder reviews hang off it, and the guard
-- above already stops the sender relabelling it.
drop policy if exists "transfer_requests_delete_own" on public.transfer_requests;
create policy "transfer_requests_delete_own" on public.transfer_requests
  for delete to authenticated
  using (
    created_by = (select auth.email())
    and status in ('pending', 'cancelled')
  );

revoke all on function public.guard_transfer_request() from public, anon, authenticated;
grant execute on function public.guard_transfer_request() to service_role;

drop trigger if exists transfer_requests_guard on public.transfer_requests;
create trigger transfer_requests_guard
  before insert or update on public.transfer_requests
  for each row execute function public.guard_transfer_request();

-- claim_transfer: production definition (20261003004122) plus two
-- changes, marked "Added 15 Oct 2026":
--   * the person who started the transfer must still own the animal at
--     claim time;
--   * the ownership switch is turned on just for the ownership change, so
--     the new created_by freeze on geckos lets this one function through.
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
  v_owner text;
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

  -- Added 15 Oct 2026: the sender must still own the animal. Without this,
  -- anyone could write a transfer row for someone else's gecko and claim
  -- it. The row is locked so the owner cannot change mid-claim.
  if v_tr.animal_type = 'other_reptile' then
    select created_by into v_owner from other_reptiles where id = v_tr.animal_id for update;
  else
    select created_by into v_owner from geckos where id = v_tr.animal_id for update;
  end if;
  if not found then
    raise exception 'animal not found';
  end if;
  if v_tr.created_by is null or lower(coalesce(v_owner, '')) <> lower(v_tr.created_by) then
    raise exception 'the sender no longer owns this animal';
  end if;

  -- The owner name is shown on the public passport, so it must never fall
  -- back to the email address.
  select coalesce(nullif(trim(full_name), ''), nullif(trim(breeder_name), ''), nullif(trim(business_name), ''))
    into v_name
  from profiles where lower(email) = lower(v_email)
  limit 1;
  v_name := coalesce(v_name, 'Geck Inspect keeper');

  -- Added 15 Oct 2026: lets this function, and only this function, change
  -- created_by and mark the transfer claimed (see guard_gecko_ownership
  -- and guard_transfer_request). Turned off again before returning.
  perform set_config('geck.ownership_transfer', 'on', true);

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

  perform set_config('geck.ownership_transfer', 'off', true);

  -- Added 15 Oct 2026: ownership history is kept for geckos only.
  -- ownership_records.animal_id has a foreign key to geckos, so writing a
  -- row for another reptile failed and made every reptile claim fail.
  if v_tr.animal_type is distinct from 'other_reptile' then
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
  end if;

  return jsonb_build_object(
    'ok', true,
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type
  );
end;
$$;

-- ===========================================================================
-- 3. Geckos: owner freeze, collection checks, plan caps (items 3, 4, 5)
-- ===========================================================================

-- A gecko's owner (created_by) only changes through claim_transfer, an
-- admin, or the server. Before this, a collection editor could set
-- created_by to their own address, and set_owner_profile_id would then
-- show them as the owner everywhere.
-- Also: only the gecko's owner (or the owner of the collection it is
-- leaving) may move it to another collection, so an editor cannot carry
-- someone else's gecko off into a collection of their own. And the
-- collection it moves into must be one the member may write to, or one
-- the gecko's own owner owns (that is how deleting a collection sends
-- each gecko home). This destination check lives here, not in the update
-- policy, because only a trigger can tell whether the collection actually
-- changed: a member who left a shared collection must still be able to
-- rename or archive their own gecko that is still filed there.
create or replace function public.guard_gecko_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(auth.role(), '');
  v_email text := lower(coalesce(auth.email(), ''));
begin
  if new.created_by is not distinct from old.created_by
     and new.collection_id is not distinct from old.collection_id then
    return new;
  end if;
  if v_role in ('', 'service_role')
     or current_setting('geck.ownership_transfer', true) = 'on'
     or public.is_admin() then
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'A gecko''s owner only changes through an ownership transfer.'
      using errcode = '42501';
  end if;

  -- The collection owner may move geckos out (deleting a collection sends
  -- each gecko back to its owner's default collection this way).
  if v_email <> lower(coalesce(old.created_by, ''))
     and not public.is_collection_owner(old.collection_id, v_email) then
    raise exception 'Only the gecko''s owner can move it to another collection.'
      using errcode = '42501';
  end if;

  -- Where it lands: no collection (allowed before this change too), a
  -- collection the member may write to, or one owned by the gecko's owner.
  -- (is_collection_owner only answers for the signed-in member, so the
  -- gecko owner's collection is looked up directly.)
  if new.collection_id is not null
     and not public.can_write_collection(new.collection_id)
     and not exists (
       select 1 from public.collections c
        where c.id = new.collection_id
          and lower(c.owner_email) = lower(coalesce(new.created_by, ''))
     ) then
    raise exception 'You can only move a gecko into a collection you can edit.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_gecko_ownership() from public, anon, authenticated;
grant execute on function public.guard_gecko_ownership() to service_role;

drop trigger if exists geckos_guard_ownership on public.geckos;
create trigger geckos_guard_ownership
  before update of created_by, collection_id on public.geckos
  for each row execute function public.guard_gecko_ownership();

-- Inserts: the gecko must belong to the member adding it, and land either
-- in no collection (the default-collection trigger then picks theirs) or
-- in a collection they may write to.
drop policy if exists "geckos_insert_own" on public.geckos;
create policy "geckos_insert_own" on public.geckos
  for insert to authenticated
  with check (
    (select auth.email()) = created_by
    and (collection_id is null or public.can_write_collection(collection_id))
  );

-- Updates: same people as before (owner or collection editor). Moving a
-- gecko to another collection is checked by guard_gecko_ownership above,
-- only when the collection really changes. Checking the collection here
-- instead would lock a member out of their own gecko once they leave, are
-- removed from, or are made a viewer of the shared collection it sits in.
drop policy if exists "geckos_update_own" on public.geckos;
create policy "geckos_update_own" on public.geckos
  for update to authenticated
  using (
    (select auth.email()) = created_by
    or public.is_collection_editor(collection_id, (select auth.email()))
  )
  with check (
    (select auth.email()) = created_by
    or public.is_collection_editor(collection_id, (select auth.email()))
  );

-- Deletes: only the gecko's owner or an admin. Collection editors used to
-- be able to delete the owner's geckos, which also removes every weight,
-- feeding, shed and vet record on them. Editors keep editing; deleting is
-- the owner's call, like a transfer.
drop policy if exists "geckos_delete_own" on public.geckos;
create policy "geckos_delete_own" on public.geckos
  for delete to authenticated
  using (
    (select auth.email()) = created_by
    or (select public.is_admin())
  );

-- Plan caps on active geckos. Production definition (20261002221052) with
-- these changes:
--   * every capped plan is checked, not only Free (Keeper holds 50);
--   * it also runs on updates that add an active gecko to someone's count:
--     unarchiving, or the owner changing (a claimed transfer). Inserting a
--     gecko as archived and then unarchiving it no longer gets around it;
--   * ordinary edits and archiving are never checked, so an account that
--     is already over its cap keeps editing and archiving its geckos.
-- The message keeps the wording isGeckoLimitError() in src/lib/geckoLimit.js
-- looks for ("holds up to N active geckos") and the gecko_limit_reached hint.
create or replace function public.enforce_free_gecko_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_owner text := nullif(btrim(coalesce(new.created_by, auth.email(), '')), '');
  v_tier text;
  v_limit integer;
  v_active integer;
begin
  if v_owner is null or coalesce(new.archived, false) then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and not coalesce(old.archived, false)
     and lower(coalesce(old.created_by, '')) = lower(v_owner) then
    -- Already active and already this owner's: nothing is being added.
    return new;
  end if;

  v_tier := coalesce(public.effective_tier_for_email(v_owner), 'free');
  v_limit := public.gecko_limit_for_tier(v_tier);
  if v_limit is null then
    return new;
  end if;

  -- Two adds at the same moment (a double tap, a CSV import running
  -- alongside Quick Add) must not both see 9 and both succeed.
  perform pg_advisory_xact_lock(hashtextextended('free_gecko_limit:' || lower(v_owner), 0));

  select count(*) into v_active
    from public.geckos
   where lower(created_by) = lower(v_owner)
     and coalesce(archived, false) = false
     and id is distinct from new.id;

  if v_active >= v_limit then
    raise exception 'The % plan holds up to % active geckos. Archive one you no longer keep, or upgrade your plan to add more.',
      initcap(v_tier), v_limit
      using errcode = 'P0001', hint = 'gecko_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists geckos_enforce_free_limit on public.geckos;
create trigger geckos_enforce_free_limit
  before insert or update of archived, created_by on public.geckos
  for each row execute function public.enforce_free_gecko_limit();

-- ===========================================================================
-- 4. Care records and eggs (item 2: forged records)
-- ===========================================================================
-- For each table: the row must still say created_by = me, and now "me"
-- must also be allowed to edit the animal (or breeding plan) it points
-- at. Policies are limited to signed-in members; signed-out visitors
-- never had a way to pass them. The animal's owner may also see and
-- delete any record on their own animal, so rows written by someone else
-- can be found and removed (a delete only reaches rows the member can see,
-- which is why each table gets a read rule next to its delete rule).

-- weight_records (gecko_id)
drop policy if exists "weight_records_write_own" on public.weight_records;
create policy "weight_records_write_own" on public.weight_records
  for insert to authenticated
  with check ((select auth.email()) = created_by and public.can_edit_gecko(gecko_id));
drop policy if exists "weight_records_update_own" on public.weight_records;
create policy "weight_records_update_own" on public.weight_records
  for update to authenticated
  using ((select auth.email()) = created_by)
  with check ((select auth.email()) = created_by and public.can_edit_gecko(gecko_id));
drop policy if exists "weight_records_read_animal_owner" on public.weight_records;
create policy "weight_records_read_animal_owner" on public.weight_records
  for select to authenticated
  using (public.owns_animal(gecko_id));
drop policy if exists "weight_records_delete_animal_owner" on public.weight_records;
create policy "weight_records_delete_animal_owner" on public.weight_records
  for delete to authenticated
  using (public.owns_animal(gecko_id));

-- gecko_events (gecko_id)
drop policy if exists "gecko_events_write_own" on public.gecko_events;
create policy "gecko_events_write_own" on public.gecko_events
  for insert to authenticated
  with check ((select auth.email()) = created_by and public.can_edit_gecko(gecko_id));
drop policy if exists "gecko_events_update_own" on public.gecko_events;
create policy "gecko_events_update_own" on public.gecko_events
  for update to authenticated
  using ((select auth.email()) = created_by)
  with check ((select auth.email()) = created_by and public.can_edit_gecko(gecko_id));
drop policy if exists "gecko_events_read_animal_owner" on public.gecko_events;
create policy "gecko_events_read_animal_owner" on public.gecko_events
  for select to authenticated
  using (public.owns_animal(gecko_id));
drop policy if exists "gecko_events_delete_animal_owner" on public.gecko_events;
create policy "gecko_events_delete_animal_owner" on public.gecko_events
  for delete to authenticated
  using (public.owns_animal(gecko_id));

-- feeding, shed, vet and ownership records name the gecko in animal_id
-- (each has a foreign key to geckos, so these never point at another
-- reptile).

-- feeding_records (animal_id)
drop policy if exists "feeding_records_insert_own" on public.feeding_records;
create policy "feeding_records_insert_own" on public.feeding_records
  for insert to authenticated
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "feeding_records_update_own" on public.feeding_records;
create policy "feeding_records_update_own" on public.feeding_records
  for update to authenticated
  using (created_by = (select auth.email()))
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "feeding_records_read_animal_owner" on public.feeding_records;
create policy "feeding_records_read_animal_owner" on public.feeding_records
  for select to authenticated
  using (public.owns_animal(animal_id));
drop policy if exists "feeding_records_delete_animal_owner" on public.feeding_records;
create policy "feeding_records_delete_animal_owner" on public.feeding_records
  for delete to authenticated
  using (public.owns_animal(animal_id));

-- shed_records (animal_id)
drop policy if exists "shed_records_insert_own" on public.shed_records;
create policy "shed_records_insert_own" on public.shed_records
  for insert to authenticated
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "shed_records_update_own" on public.shed_records;
create policy "shed_records_update_own" on public.shed_records
  for update to authenticated
  using (created_by = (select auth.email()))
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "shed_records_read_animal_owner" on public.shed_records;
create policy "shed_records_read_animal_owner" on public.shed_records
  for select to authenticated
  using (public.owns_animal(animal_id));
drop policy if exists "shed_records_delete_animal_owner" on public.shed_records;
create policy "shed_records_delete_animal_owner" on public.shed_records
  for delete to authenticated
  using (public.owns_animal(animal_id));

-- vet_records (animal_id)
drop policy if exists "vet_records_insert_own" on public.vet_records;
create policy "vet_records_insert_own" on public.vet_records
  for insert to authenticated
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "vet_records_update_own" on public.vet_records;
create policy "vet_records_update_own" on public.vet_records
  for update to authenticated
  using (created_by = (select auth.email()))
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "vet_records_read_animal_owner" on public.vet_records;
create policy "vet_records_read_animal_owner" on public.vet_records
  for select to authenticated
  using (public.owns_animal(animal_id));
drop policy if exists "vet_records_delete_animal_owner" on public.vet_records;
create policy "vet_records_delete_animal_owner" on public.vet_records
  for delete to authenticated
  using (public.owns_animal(animal_id));

-- ownership_records (animal_id). claim_transfer() writes these as the
-- database owner, so the claim itself is not affected by this policy.
drop policy if exists "ownership_records_insert_own" on public.ownership_records;
create policy "ownership_records_insert_own" on public.ownership_records
  for insert to authenticated
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "ownership_records_update_own" on public.ownership_records;
create policy "ownership_records_update_own" on public.ownership_records
  for update to authenticated
  using (created_by = (select auth.email()))
  with check (created_by = (select auth.email()) and public.can_edit_gecko(animal_id));
drop policy if exists "ownership_records_read_animal_owner" on public.ownership_records;
create policy "ownership_records_read_animal_owner" on public.ownership_records
  for select to authenticated
  using (public.owns_animal(animal_id));
drop policy if exists "ownership_records_delete_animal_owner" on public.ownership_records;
create policy "ownership_records_delete_animal_owner" on public.ownership_records
  for delete to authenticated
  using (public.owns_animal(animal_id));

-- reptile_events (reptile_id): the other-reptile log had the same hole.
drop policy if exists "reptile_events_write_own" on public.reptile_events;
create policy "reptile_events_write_own" on public.reptile_events
  for insert to authenticated
  with check ((select auth.email()) = created_by and public.can_edit_reptile(reptile_id));
drop policy if exists "reptile_events_update_own" on public.reptile_events;
create policy "reptile_events_update_own" on public.reptile_events
  for update to authenticated
  using ((select auth.email()) = created_by)
  with check ((select auth.email()) = created_by and public.can_edit_reptile(reptile_id));
drop policy if exists "reptile_events_read_animal_owner" on public.reptile_events;
create policy "reptile_events_read_animal_owner" on public.reptile_events
  for select to authenticated
  using (public.owns_animal(reptile_id));
drop policy if exists "reptile_events_delete_animal_owner" on public.reptile_events;
create policy "reptile_events_delete_animal_owner" on public.reptile_events
  for delete to authenticated
  using (public.owns_animal(reptile_id));

-- eggs (breeding_plan_id). The egg's gecko_id (the hatchling) is not
-- checked: a hatchling that was later sold belongs to the buyer, and the
-- breeder must still be able to update their own egg record. Eggs are only
-- readable by their creator, so a wrong gecko_id shows up nowhere else.
drop policy if exists "eggs_write_own" on public.eggs;
create policy "eggs_write_own" on public.eggs
  for insert to authenticated
  with check (
    (select auth.email()) = created_by
    and public.can_edit_breeding_plan(breeding_plan_id)
  );
drop policy if exists "eggs_update_own" on public.eggs;
create policy "eggs_update_own" on public.eggs
  for update to authenticated
  using ((select auth.email()) = created_by)
  with check (
    (select auth.email()) = created_by
    and public.can_edit_breeding_plan(breeding_plan_id)
  );
drop policy if exists "eggs_read_plan_owner" on public.eggs;
create policy "eggs_read_plan_owner" on public.eggs
  for select to authenticated
  using (public.can_edit_breeding_plan(breeding_plan_id));
drop policy if exists "eggs_delete_plan_owner" on public.eggs;
create policy "eggs_delete_plan_owner" on public.eggs
  for delete to authenticated
  using (public.can_edit_breeding_plan(breeding_plan_id));

-- ===========================================================================
-- 5. Collections (item 4)
-- ===========================================================================

-- A pending invitation no longer opens the collection. Production
-- definition (20261008063704) with status 'accepted' only; it used to
-- accept 'pending' too, so an invitee could read every gecko before
-- choosing to join. The invitee still sees and answers their invitation
-- through collection_members (their own row), the invite page
-- (get_collection_invite_preview) and accept / decline_collection_invite.
create or replace function public.is_collection_member(p_collection_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.collection_members
     where collection_id = p_collection_id
       and coalesce(auth.email(), '') <> ''
       and lower(member_email) = lower(auth.email())
       and lower(coalesce(p_email, '')) = lower(auth.email())
       and status = 'accepted'
  );
$$;

-- The collection row itself (name, owner) stays visible to a pending
-- invitee, so Settings can show "Invitation waiting". Its geckos do not.
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select to authenticated
  using (
    lower(owner_email) = lower(coalesce((select auth.email()), ''))
    or public.is_collection_member(id, (select auth.email()))
    or public.is_collection_invitee(id)
  );

-- An owner may add their own seat, and may invite other people, but an
-- invitation for someone else always starts as pending and never carries
-- the owner role. Only the invited person can accept it.
drop policy if exists "collection_members_insert_owner" on public.collection_members;
create policy "collection_members_insert_owner" on public.collection_members
  for insert to authenticated
  with check (
    public.is_collection_owner(collection_id, (select auth.email()))
    and (
      lower(member_email) = lower(coalesce((select auth.email()), ''))
      or (status = 'pending' and role <> 'owner')
    )
  );

-- Production definition (20260929061634) with the owner branch tightened:
-- the owner still manages invitations, but cannot accept one on another
-- person's behalf, give someone the owner role, or point an accepted seat
-- at a different person.
-- Inviting someone again after they left: collection_members_unique_invite
-- allows one row per person per collection, so a second insert fails. The
-- app (CollectionsCard) instead reopens the declined row as a fresh
-- pending invitation with a new token, which the owner branch below
-- allows (only "accepted" is refused). The person still has to accept.
create or replace function public.guard_collection_member_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  caller text := lower(coalesce(auth.email(), ''));
begin
  if caller = '' then
    return new;
  end if;
  if new.collection_id is distinct from old.collection_id then
    raise exception 'A membership cannot move to another collection';
  end if;
  if public.is_collection_owner(old.collection_id, caller) then
    if lower(new.member_email) <> caller then
      if new.status = 'accepted' and old.status is distinct from 'accepted' then
        raise exception 'Only the invited person can accept an invitation';
      end if;
      if new.role = 'owner' and old.role is distinct from 'owner' then
        raise exception 'The owner role cannot be given to someone else';
      end if;
      if new.member_email is distinct from old.member_email and new.status <> 'pending' then
        raise exception 'Changing who an invitation is for needs a new, pending invitation';
      end if;
    end if;
    return new;
  end if;
  if new.member_email is distinct from old.member_email
     or new.role is distinct from old.role
     or new.invite_token is distinct from old.invite_token
     or new.invited_by_email is distinct from old.invited_by_email
     or new.invited_at is distinct from old.invited_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Only the collection owner can change an invitation';
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined'))
      or (old.status = 'accepted' and new.status = 'declined')
    ) then
      raise exception 'An invitation cannot go from % to %', old.status, new.status;
    end if;
    if new.status = 'accepted' and old.expires_at is not null and old.expires_at < now() then
      raise exception 'invite expired';
    end if;
  end if;
  return new;
end;
$$;

-- Collaborator cap (TIER_LIMITS.maxCollaborators: Free 1, Keeper 5,
-- Breeder and Enterprise unlimited). Counted the way the Settings card
-- counts it: pending and accepted seats for people other than the owner,
-- across every collection the owner has. Only a new seat is checked, so
-- accepting an invitation, leaving, or an owner who is already over the
-- cap keeping their existing collaborators all keep working.
create or replace function public.enforce_collaborator_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner text;
  v_tier text;
  v_limit integer;
  v_used integer;
begin
  if new.role = 'owner' or new.status not in ('pending', 'accepted') then
    return new;
  end if;
  select c.owner_email into v_owner from public.collections c where c.id = new.collection_id;
  if v_owner is null or lower(new.member_email) = lower(v_owner) then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.role <> 'owner'
     and old.status in ('pending', 'accepted')
     and lower(old.member_email) <> lower(v_owner) then
    -- This seat was already counted.
    return new;
  end if;

  v_tier := coalesce(public.effective_tier_for_email(v_owner), 'free');
  v_limit := public.collaborator_limit_for_tier(v_tier);
  if v_limit is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('collaborator_limit:' || lower(v_owner), 0));

  select count(*) into v_used
    from public.collection_members m
    join public.collections c on c.id = m.collection_id
   where lower(c.owner_email) = lower(v_owner)
     and m.role <> 'owner'
     and m.status in ('pending', 'accepted')
     and lower(m.member_email) <> lower(c.owner_email)
     and m.id is distinct from new.id;

  if v_used >= v_limit then
    raise exception 'The % plan includes up to % active collaborator%. Remove one, or upgrade your plan to invite more.',
      initcap(v_tier), v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001', hint = 'collaborator_limit_reached';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_collaborator_limit() from public, anon, authenticated;
grant execute on function public.enforce_collaborator_limit() to service_role;

drop trigger if exists collection_members_enforce_limit on public.collection_members;
create trigger collection_members_enforce_limit
  before insert or update of status, role, member_email on public.collection_members
  for each row execute function public.enforce_collaborator_limit();

-- ===========================================================================
-- 6. Profiles (items 6 and 7)
-- ===========================================================================

-- A member may only create or edit the profile for their own email
-- (admins may edit any). The old "or created_by = me" clause let a member
-- create a profile for an address that had not signed up yet and keep
-- editing it after the real person arrived.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to public
  with check ((select auth.email()) = email or (select public.is_admin()));

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (email = (select auth.email()) or public.is_admin())
  with check (email = (select auth.email()) or public.is_admin());

-- Production definition (20261003024339) with two changes:
--   * email, created_by and created_date are frozen for members, so a
--     profile cannot be moved to another address or backdated ("member
--     since" feeds the breeder trust tier). On a member's own insert they
--     are set from the session: created_by is their email and created_date
--     is now. The signup trigger (handle_new_auth_user) runs with no
--     signed-in caller and is not affected.
--   * a trusted SECURITY DEFINER function can turn on
--     geck.profile_privileged_write for its own write. This guard used to
--     key only on auth.role(), which is still 'authenticated' inside such a
--     function when a member calls it, so redeem_signup_grant's plan change
--     was silently undone.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text := auth.role();
  v_email text := auth.email();
  v_is_admin boolean := false;
begin
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;
  if current_setting('geck.profile_privileged_write', true) = 'on' then
    return new;
  end if;

  if v_email is not null then
    select exists (
      select 1 from public.profiles p
      where p.email = v_email and p.role = 'admin'
    ) into v_is_admin;
  end if;
  if v_is_admin then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.role := old.role;
    new.is_expert := old.is_expert;
    if coalesce(new.is_featured_breeder, false) is distinct from coalesce(old.is_featured_breeder, false)
       and coalesce(new.is_featured_breeder, false)
       and coalesce(public.effective_tier_for_email(old.email), 'free') not in ('breeder', 'enterprise') then
      new.is_featured_breeder := old.is_featured_breeder;
    end if;
    new.membership_tier := old.membership_tier;
    new.membership_billing_cycle := old.membership_billing_cycle;
    new.membership_expires_at := old.membership_expires_at;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.keeper_trial_used := old.keeper_trial_used;
    new.free_trial_used := old.free_trial_used;
    new.free_trial_started_at := old.free_trial_started_at;
    new.paid_membership_started_at := old.paid_membership_started_at;
    new.social_post_credits := old.social_post_credits;
    -- Added 15 Oct 2026.
    new.id := old.id;
    new.email := old.email;
    new.created_by := old.created_by;
    new.created_date := old.created_date;
  else
    new.role := 'user';
    new.is_expert := false;
    new.is_featured_breeder := false;
    new.membership_tier := 'free';
    new.membership_billing_cycle := null;
    new.membership_expires_at := null;
    new.subscription_status := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.keeper_trial_used := false;
    new.free_trial_used := false;
    new.free_trial_started_at := null;
    new.paid_membership_started_at := null;
    new.social_post_credits := 0;
    -- Added 15 Oct 2026.
    new.created_by := coalesce(v_email, new.email);
    new.created_date := now();
  end if;
  return new;
end;
$$;

-- redeem_signup_grant: production definition with the plan change wrapped
-- in geck.profile_privileged_write, so the guard above lets it through.
-- Audit of every function that writes privileged profile columns (read
-- from production pg_proc on 15 Oct 2026):
--   redeem_signup_grant           members call it: needs the switch (here)
--   award_referral_reward         server only (service_role): already passes
--   charge_social_publish         server only (service_role): already passes
--   referral grant expiry job     scheduled job, no caller: already passes
--                                 (named in words here so the referral
--                                 lapse test keeps finding its own file)
--   clear_lapsed_featured_breeders scheduled job, no caller: already passes
--   moderate_content              admins only (moderation_hidden, which has
--                                 its own guard): already passes
--   apply_referral_code           referral columns only, has its own switch
--   handle_new_auth_user          signup trigger, no caller: already passes
create or replace function public.redeem_signup_grant(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_grant public.store_signup_grants%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_current_expiry timestamptz;
  v_new_expiry timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null then
    return jsonb_build_object('ok', false, 'reason', 'user_email_missing');
  end if;

  select * into v_grant from public.store_signup_grants
   where token = p_token
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token_not_found');
  end if;

  if v_grant.voided_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'voided');
  end if;

  if v_grant.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  if v_grant.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if lower(trim(v_grant.granted_email)) <> lower(trim(v_user_email)) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  select membership_expires_at into v_current_expiry from public.profiles
   where email = v_user_email;

  v_new_expiry := greatest(
    coalesce(v_current_expiry, now()),
    now() + (v_grant.granted_duration_days || ' days')::interval
  );

  -- Added 15 Oct 2026: without this switch the profile guard reverted the
  -- plan change below, because a member is the caller.
  perform set_config('geck.profile_privileged_write', 'on', true);

  update public.profiles
     set membership_tier = case
           when membership_tier in ('breeder', 'enterprise') then membership_tier
           else v_grant.granted_tier
         end,
         membership_expires_at = v_new_expiry,
         updated_date = now()
   where email = v_user_email;

  perform set_config('geck.profile_privileged_write', 'off', true);

  update public.store_signup_grants
     set redeemed_at = now(),
         redeemed_by_user_id = v_user_id
   where id = v_grant.id;

  return jsonb_build_object(
    'ok', true,
    'tier', v_grant.granted_tier,
    'duration_days', v_grant.granted_duration_days,
    'expires_at', v_new_expiry
  );
end;
$$;

notify pgrst, 'reload schema';
