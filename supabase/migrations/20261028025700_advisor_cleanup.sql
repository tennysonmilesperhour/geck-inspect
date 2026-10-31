-- Two performance advisor warnings (28 Oct 2026), both safe to fix while
-- the app is open:
--
-- 1. breeder_inquiries had two identical indexes on (breeder_email,
--    created_at desc): idx_breeder_inquiries_breeder_created from the
--    April baseline and breeder_inquiries_breeder_created_idx from
--    20260929214653. Every insert paid for both. The baseline one goes;
--    the other serves the same queries.
-- 2. morphmarket_links_own_read called auth.uid() once per row. Wrapping it
--    in a select lets Postgres work it out once per query. Same rule, same
--    rows.
--
-- The third warning (agent_hits_admin_read) is rewritten with the admin
-- two-factor work, which points that policy at is_admin().

drop index if exists public.idx_breeder_inquiries_breeder_created;

drop policy if exists morphmarket_links_own_read on public.morphmarket_store_links;
create policy morphmarket_links_own_read on public.morphmarket_store_links
  for select to authenticated
  using (user_id = (select auth.uid()));
