-- Verified MorphMarket seller (19 Oct 2026). MorphMarket has no "sign in
-- with MorphMarket" and no public API, so a member proves they own a
-- MorphMarket store the way domain checks work: Geck Inspect gives them a
-- short code, they paste it into their MorphMarket store's About text, and
-- the verify-morphmarket-store function finds it on the public store page.
-- Their breeder page then shows "Verified MorphMarket seller" with a link
-- to the store.
--
-- If MorphMarket does not let the function read the page (a bot check, a
-- timeout), the row is flagged for an admin, who opens the store, looks
-- for the code and verifies it from Admin > Breeder verification.
--
-- Additive and safe to run more than once: create if not exists, create or
-- replace, drop policy if exists. The app open in members' browsers never
-- reads this table, so the deploy order does not matter.
--
-- What it adds:
--
-- 1. public.morphmarket_store_links: one row per member (keyed on the auth
--    user, so deleting the account deletes the row). Only the function
--    (service role) and the admin functions below write to it. A member
--    reads their own row; anyone reads verified rows, which only say which
--    store belongs to which breeder (the code is already public in that
--    store's About text). A store can be verified to one member only.
--
-- 2. admin_morphmarket_review_queue(): rows waiting for a check by hand.
--    admin_set_morphmarket_verified(): an admin verifies or removes one.
--    Both check is_admin() themselves.

create table if not exists public.morphmarket_store_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  store_slug text not null check (store_slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  code text not null check (code ~ '^GI-[A-Z0-9]{6}$'),
  status text not null default 'pending' check (status in ('pending', 'verified')),
  needs_review boolean not null default false,
  last_checked_at timestamptz,
  last_check_result text,
  verified_at timestamptz,
  verified_method text check (verified_method in ('automatic', 'admin')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create unique index if not exists morphmarket_store_links_verified_store
  on public.morphmarket_store_links (store_slug)
  where status = 'verified';

alter table public.morphmarket_store_links enable row level security;

revoke all on table public.morphmarket_store_links from anon, authenticated;
grant select on table public.morphmarket_store_links to anon, authenticated;

drop policy if exists morphmarket_links_own_read on public.morphmarket_store_links;
create policy morphmarket_links_own_read on public.morphmarket_store_links
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists morphmarket_links_verified_read on public.morphmarket_store_links;
create policy morphmarket_links_verified_read on public.morphmarket_store_links
  for select to anon, authenticated
  using (status = 'verified');

create or replace function public.admin_morphmarket_review_queue()
returns table (
  user_id uuid,
  email text,
  store_slug text,
  code text,
  last_checked_at timestamptz,
  last_check_result text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select l.user_id, u.email::text, l.store_slug, l.code, l.last_checked_at, l.last_check_result
      from public.morphmarket_store_links l
      join auth.users u on u.id = l.user_id
     where l.status = 'pending' and l.needs_review
     order by l.last_checked_at desc nulls last;
end;
$$;

revoke all on function public.admin_morphmarket_review_queue() from public, anon;
grant execute on function public.admin_morphmarket_review_queue() to authenticated;

create or replace function public.admin_set_morphmarket_verified(p_user_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select store_slug into v_slug from public.morphmarket_store_links where user_id = p_user_id;
  if v_slug is null then
    raise exception 'No MorphMarket store saved for that member';
  end if;

  if p_verified then
    if exists (
      select 1 from public.morphmarket_store_links
       where store_slug = v_slug and status = 'verified' and user_id <> p_user_id
    ) then
      raise exception 'That store is already verified to another member';
    end if;
    update public.morphmarket_store_links
       set status = 'verified', needs_review = false, verified_at = now(),
           verified_method = 'admin', last_check_result = 'verified by an admin',
           updated_date = now()
     where user_id = p_user_id;
  else
    -- "Not found": the admin looked and the code was not there. The member
    -- sees that on My Store and can try again.
    update public.morphmarket_store_links
       set status = 'pending', needs_review = false, verified_at = null,
           verified_method = null, last_check_result = 'code not found by an admin',
           updated_date = now()
     where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_morphmarket_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_morphmarket_verified(uuid, boolean) to authenticated;
