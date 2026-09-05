-- Fix admin RLS across 11 tables.
--
-- Old (broken) pattern, copy-pasted into a bunch of "admin" policies:
--   using (exists (select 1 from public.profiles p
--                  where p.id = auth.uid()::text and p.role = 'admin'))
--
-- profiles.id is a legacy text column that was never keyed to auth.users.id,
-- so auth.uid()::text never matches an admin row. The policies always
-- evaluated false, blocking BOTH reads and writes (the AdminPanel UI was
-- silently showing empty lists, and "Auto-generate" failed with
-- "new row violates row-level security policy for table admin_tasks").
--
-- The canonical pattern used everywhere else in this codebase (see
-- 20260507_testimonials.sql) is:
--   using (exists (select 1 from public.profiles p
--                  where p.email = auth.email() and p.role = 'admin'))
--
-- This migration drops + recreates every broken policy to use email.

-- admin_tasks
drop policy if exists "Admins read tasks" on public.admin_tasks;
create policy "Admins read tasks" on public.admin_tasks for select
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

drop policy if exists "Admins write tasks" on public.admin_tasks;
create policy "Admins write tasks" on public.admin_tasks for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- app_settings
drop policy if exists "Admins read all settings" on public.app_settings;
create policy "Admins read all settings" on public.app_settings for select
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

drop policy if exists "Admins write settings" on public.app_settings;
create policy "Admins write settings" on public.app_settings for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_affiliate_clicks
drop policy if exists "Admins read affiliate clicks" on public.store_affiliate_clicks;
create policy "Admins read affiliate clicks" on public.store_affiliate_clicks for select
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_categories
drop policy if exists "Admins write categories" on public.store_categories;
create policy "Admins write categories" on public.store_categories for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_fulfillments
drop policy if exists "Admins manage fulfillments" on public.store_fulfillments;
create policy "Admins manage fulfillments" on public.store_fulfillments for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_order_items
drop policy if exists "Admins read all order items" on public.store_order_items;
create policy "Admins read all order items" on public.store_order_items for select
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_orders
drop policy if exists "Admins read all orders" on public.store_orders;
create policy "Admins read all orders" on public.store_orders for select
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

drop policy if exists "Admins write orders" on public.store_orders;
create policy "Admins write orders" on public.store_orders for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_products
drop policy if exists "Admins write products" on public.store_products;
create policy "Admins write products" on public.store_products for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_promo_codes
drop policy if exists "Admins write promo codes" on public.store_promo_codes;
create policy "Admins write promo codes" on public.store_promo_codes for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_signup_grants
drop policy if exists "Admins read signup grants" on public.store_signup_grants;
create policy "Admins read signup grants" on public.store_signup_grants for select
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));

-- store_vendors
drop policy if exists "Admins write vendors" on public.store_vendors;
create policy "Admins write vendors" on public.store_vendors for all
  using (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.email = auth.email() and p.role = 'admin'));
