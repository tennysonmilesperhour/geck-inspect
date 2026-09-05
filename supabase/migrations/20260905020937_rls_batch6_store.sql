-- RLS consolidation, batch 6: store tables (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
-- Catalog tables had "active rows readable by anyone" plus an admin FOR
-- ALL; admins saw inactive rows only through the FOR ALL. One SELECT now
-- says both (active, or admin), and admin write is INSERT, UPDATE and
-- DELETE. Orders, order items and fulfillments merge their two reader
-- rules into one. Testimonials: approved rows for everyone, all rows for
-- admins. No member or visitor gains or loses access. Idempotent.

-- Catalog tables
drop policy if exists "Admins write categories" on public.store_categories;
drop policy if exists "Active categories readable by anyone" on public.store_categories;
drop policy if exists store_categories_select on public.store_categories;
create policy store_categories_select on public.store_categories for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "Admins write products" on public.store_products;
drop policy if exists "Active products readable by anyone" on public.store_products;
drop policy if exists store_products_select on public.store_products;
create policy store_products_select on public.store_products for select to anon, authenticated
  using (status = 'active'::store_product_status or public.is_admin());

drop policy if exists "Admins write promo codes" on public.store_promo_codes;
drop policy if exists "Active promo codes readable by anyone" on public.store_promo_codes;
drop policy if exists store_promo_codes_select on public.store_promo_codes;
create policy store_promo_codes_select on public.store_promo_codes for select to anon, authenticated
  using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
    or public.is_admin()
  );

drop policy if exists "Admins write vendors" on public.store_vendors;
drop policy if exists "Active vendors readable by anyone" on public.store_vendors;
drop policy if exists store_vendors_select on public.store_vendors;
create policy store_vendors_select on public.store_vendors for select to anon, authenticated
  using (is_active or public.is_admin());

-- Orders
drop policy if exists "Admins write orders" on public.store_orders;
drop policy if exists "Admins read all orders" on public.store_orders;
drop policy if exists "Users read own orders" on public.store_orders;
drop policy if exists store_orders_select on public.store_orders;
create policy store_orders_select on public.store_orders for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or customer_email = (select auth.email())
    or public.is_admin()
  );

drop policy if exists "Admins read all order items" on public.store_order_items;
drop policy if exists "Users read own order items" on public.store_order_items;
drop policy if exists store_order_items_select on public.store_order_items;
create policy store_order_items_select on public.store_order_items for select to authenticated
  using (
    public.is_admin()
    or order_id in (
      select o.id from public.store_orders o
      where o.owner_user_id = (select auth.uid()) or o.customer_email = (select auth.email())
    )
  );

drop policy if exists "Admins manage fulfillments" on public.store_fulfillments;
drop policy if exists "Users read own fulfillments" on public.store_fulfillments;
drop policy if exists store_fulfillments_select on public.store_fulfillments;
create policy store_fulfillments_select on public.store_fulfillments for select to authenticated
  using (
    public.is_admin()
    or order_id in (
      select o.id from public.store_orders o
      where o.owner_user_id = (select auth.uid()) or o.customer_email = (select auth.email())
    )
  );

-- Testimonials
drop policy if exists "Admins write testimonials" on public.testimonials;
drop policy if exists "Admins read all testimonials" on public.testimonials;
drop policy if exists "Approved testimonials are public" on public.testimonials;
drop policy if exists testimonials_select on public.testimonials;
create policy testimonials_select on public.testimonials for select to anon, authenticated
  using (approved = true or public.is_admin());

-- Admin write rules for all of the above
do $$
declare
  t text;
begin
  foreach t in array array['store_categories', 'store_products', 'store_promo_codes', 'store_vendors', 'store_orders', 'store_fulfillments', 'testimonials'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_admin', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_admin', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_admin', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_insert_admin', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_update_admin', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_delete_admin', t);
  end loop;
end $$;
