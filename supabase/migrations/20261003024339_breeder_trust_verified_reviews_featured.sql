-- Breeder pages and trust (step 10, decisions D9 and D10), 3 Oct 2026.
--
-- D9: a breeder becomes "Verified" only when an admin ticks a short
-- checklist (admin_set_breeder_verified). Before this, nothing could set
-- the badge, and the row rule let any owner set it on their own page.
-- Reviews can be written only by a buyer who claimed a transfer from that
-- breeder (submit_breeder_review); before this anyone signed in could
-- insert any review.
-- D10: "Feature me on the Dashboard" is self-serve for Breeder-plan
-- members. The profile guard used to reset it for everyone but admins.
--
-- Additive for the deployed client: it never wrote is_verified, reviews or
-- user_id changes, and is_featured_breeder saves now stick for Breeder.

-- 1. Verification fields. verified_by_user_id is an auth id, never an
--    email, because breeder_profiles is publicly readable.
alter table public.breeder_profiles
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by_user_id uuid,
  add column if not exists verification_checklist jsonb;

-- 2. Owners cannot set their own badge or point their page at another
--    member's reviews (user_id joins breeder_reviews.reviewed_user_id).
create or replace function public.breeder_profiles_protect_trust_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := auth.role();
begin
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.verified_at := null;
    new.verified_by_user_id := null;
    new.verification_checklist := null;
    new.user_id := auth.uid();
  else
    new.is_verified := old.is_verified;
    new.verified_at := old.verified_at;
    new.verified_by_user_id := old.verified_by_user_id;
    new.verification_checklist := old.verification_checklist;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$function$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'breeder_profiles_protect_trust_columns'
                  and tgrelid = 'public.breeder_profiles'::regclass) then
    create trigger breeder_profiles_protect_trust_columns
      before insert or update on public.breeder_profiles
      for each row execute function public.breeder_profiles_protect_trust_columns();
  end if;
end
$$;

-- 3. Admin checklist and badge. Every item must be ticked to verify.
--    Keys: identity, own_animals, sales_record, policies, clean_record.
create or replace function public.admin_set_breeder_verified(
  p_breeder_profile_id uuid,
  p_verified boolean,
  p_checklist jsonb default '{}'::jsonb
)
returns public.breeder_profiles
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_keys constant text[] := array['identity', 'own_animals', 'sales_record', 'policies', 'clean_record'];
  v_key text;
  v_row public.breeder_profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can verify breeders' using errcode = '42501';
  end if;
  if p_verified then
    foreach v_key in array v_keys loop
      if coalesce((p_checklist ->> v_key)::boolean, false) is not true then
        raise exception 'Tick every checklist item before verifying (missing: %)', v_key
          using errcode = '22023';
      end if;
    end loop;
  end if;

  update public.breeder_profiles
     set is_verified = p_verified,
         verified_at = case when p_verified then now() else null end,
         verified_by_user_id = case when p_verified then auth.uid() else null end,
         verification_checklist = coalesce(p_checklist, '{}'::jsonb),
         updated_date = now()
   where id = p_breeder_profile_id
  returning * into v_row;

  if not found then
    raise exception 'Breeder page not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$function$;


-- Admin review list: each breeder page with the facts the checklist asks
-- about. Admin only.
create or replace function public.admin_breeder_verification_queue()
returns table (
  breeder_profile_id uuid,
  display_name text,
  custom_slug text,
  owner_email text,
  is_verified boolean,
  verified_at timestamptz,
  verification_checklist jsonb,
  gecko_count bigint,
  claimed_transfers bigint,
  store_published boolean,
  has_policies boolean,
  created_date timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Only admins can review breeders' using errcode = '42501';
  end if;
  return query
  select b.id, b.display_name, b.custom_slug, b.created_by, coalesce(b.is_verified, false),
         b.verified_at, b.verification_checklist,
         (select count(*) from public.geckos g
           where lower(g.created_by) = lower(b.created_by) and coalesce(g.archived, false) = false),
         (select count(*) from public.transfer_requests t
           where t.from_user_id = b.user_id and t.status = 'claimed'),
         coalesce((select s.is_published from public.breeder_store_pages s
                    where lower(s.owner_email) = lower(b.created_by) limit 1), false),
         coalesce((select nullif(trim(s.policies), '') is not null from public.breeder_store_pages s
                    where lower(s.owner_email) = lower(b.created_by) limit 1), false),
         b.created_date
    from public.breeder_profiles b
   order by coalesce(b.is_verified, false), b.created_date desc;
end;
$function$;


-- 4. Reviews only from a claimed transfer.
alter table public.breeder_reviews
  add column if not exists transfer_id uuid;
create unique index if not exists breeder_reviews_transfer_id_key
  on public.breeder_reviews (transfer_id) where transfer_id is not null;

-- Direct inserts and edits are closed (the policies keep their names so
-- older tooling still finds them); submit_breeder_review is the only way
-- in. A reviewer can delete their own review.
alter policy "breeder_reviews_insert_own" on public.breeder_reviews
  with check (false);
alter policy "breeder_reviews_update_own" on public.breeder_reviews
  using (false) with check (false);
alter policy "breeder_reviews_delete_own" on public.breeder_reviews
  using (reviewer_user_id = (select auth.uid()));

-- Write or edit the review for one claimed transfer. The reviewer's email
-- is never stored on the row (reviews are public).
create or replace function public.submit_breeder_review(
  p_transfer_id uuid,
  p_rating integer,
  p_title text default null,
  p_body text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tr public.transfer_requests;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to leave a review' using errcode = '42501';
  end if;
  select * into v_tr from public.transfer_requests
   where id = p_transfer_id and to_user_id = v_uid and status = 'claimed';
  if not found then
    raise exception 'Only a buyer who claimed a gecko from this breeder can review them'
      using errcode = '42501';
  end if;
  if v_tr.from_user_id is null or v_tr.from_user_id = v_uid then
    raise exception 'You cannot review yourself' using errcode = '42501';
  end if;
  if not exists (select 1 from public.breeder_profiles b where b.user_id = v_tr.from_user_id) then
    raise exception 'This seller has no breeder page to review' using errcode = 'P0002';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be 1 to 5 stars' using errcode = '22023';
  end if;
  if length(coalesce(p_title, '')) > 120 or length(coalesce(p_body, '')) > 2000 then
    raise exception 'Review is too long' using errcode = '22023';
  end if;

  insert into public.breeder_reviews
    (reviewer_user_id, reviewed_user_id, animal_id, rating, title, body,
     transaction_type, is_verified, created_by, transfer_id)
  values
    (v_uid, v_tr.from_user_id, null, p_rating, nullif(trim(p_title), ''), nullif(trim(p_body), ''),
     'purchase', true, null, p_transfer_id)
  on conflict (transfer_id) where transfer_id is not null do update
    set rating = excluded.rating,
        title = excluded.title,
        body = excluded.body,
        updated_date = now()
  returning id into v_id;
  return v_id;
end;
$function$;


-- The caller's claimed transfers from one breeder, for the "Leave a
-- review" button on that breeder's page.
create or replace function public.my_reviewable_transfers(p_breeder_user_id uuid)
returns table (
  transfer_id uuid,
  gecko_name text,
  claimed_at timestamptz,
  review_id uuid,
  rating integer,
  title text,
  body text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.id,
         coalesce(nullif(trim(g.name), ''), 'Your gecko'),
         t.claimed_at,
         r.id, r.rating, r.title, r.body
    from public.transfer_requests t
    left join public.geckos g on g.id = t.animal_id
    left join public.breeder_reviews r on r.transfer_id = t.id
   where auth.uid() is not null
     and t.to_user_id = auth.uid()
     and t.from_user_id = p_breeder_user_id
     and t.from_user_id <> auth.uid()
     and t.status = 'claimed'
   order by t.claimed_at desc nulls last;
$function$;


-- 5. D10: Breeder-plan members can switch "Feature me on the Dashboard"
--    on themselves. Anyone can switch it off. Same guard otherwise.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := auth.role();
  v_email text := auth.email();
  v_is_admin boolean := false;
begin
  if v_role is null or v_role = '' or v_role = 'service_role' then
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
  end if;
  return new;
end;
$function$;

-- A member who leaves the Breeder plan drops out of the rotation.
create or replace function public.clear_lapsed_featured_breeders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  -- Only the scheduled job (no signed-in caller), the service role or an
  -- admin may run this.
  if coalesce(auth.role(), '') not in ('', 'service_role') and not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.profiles p
     set is_featured_breeder = false
   where p.is_featured_breeder
     and coalesce(public.effective_tier_for_email(p.email), 'free') not in ('breeder', 'enterprise');
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;


-- cron.schedule with an existing job name updates that job in place.
do $$
begin
  perform cron.schedule('clear-lapsed-featured-breeders', '50 4 * * *',
    $cron$ select public.clear_lapsed_featured_breeders(); $cron$);
end
$$;
