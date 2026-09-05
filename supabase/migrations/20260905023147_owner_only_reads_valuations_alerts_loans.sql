-- Owner-only reads for collection valuations, price alerts and breeding loans (5 Sep 2026).
--
-- These three tables were readable by anyone holding the anon key
-- ("Public read ..." USING true). They hold a member's collection worth,
-- their buying intent, and stud fees and loan terms between two members.
-- None of that is shown on a public page: Portfolio reads a member's own
-- valuations, nothing in the app reads price_alerts at all, and the
-- Breeding Loans page shows loans where the member is lender or borrower.
--
-- Reads are now limited to the row's author, the lender or borrower (by
-- user id or by email), and admins. Writes were already owner-only after
-- RLS batch 4. Idempotent.

drop policy if exists "Public read collection valuations" on public.collection_valuations;
drop policy if exists collection_valuations_select on public.collection_valuations;
create policy collection_valuations_select
  on public.collection_valuations for select
  to authenticated
  using (
    created_by = (select auth.email())
    or user_id = (select auth.uid())
    or public.is_admin()
  );

drop policy if exists "Public read price alerts" on public.price_alerts;
drop policy if exists price_alerts_select on public.price_alerts;
create policy price_alerts_select
  on public.price_alerts for select
  to authenticated
  using (
    created_by = (select auth.email())
    or user_id = (select auth.uid())
    or public.is_admin()
  );

drop policy if exists "Public read breeding loans" on public.breeding_loans;
drop policy if exists breeding_loans_select on public.breeding_loans;
create policy breeding_loans_select
  on public.breeding_loans for select
  to authenticated
  using (
    created_by = (select auth.email())
    or lender_user_id = (select auth.uid())
    or borrower_user_id = (select auth.uid())
    or lower(borrower_email) = lower(coalesce((select auth.email()), ''))
    or public.is_admin()
  );
