-- Owner emails off public feeding and shed rows. NOT YET APPLIED.
--
-- feeding_records and shed_records are readable by signed-out visitors
-- for a public passport (policy gecko_passport_is_public), and anon had
-- SELECT on every column, including created_by (the logger's email) and
-- logged_by (their user id). Every logging surface now writes per-gecko
-- feeding and shed rows (feature-completeness audit step 13), so far more
-- of these rows will exist on public passports.
--
-- BREAKING for any client that still reads these tables with `select *`
-- while signed out: Postgres refuses the whole query once a column in it
-- is not granted. The deployed passport did exactly that before this
-- change. Apply only after the client that reads explicit columns
-- (PUBLIC_FEEDING_COLUMNS and PUBLIC_SHED_COLUMNS in
-- src/lib/passportUtils.js, used by AnimalPassport and GeckoDetail) is
-- live in production. Same approach as weight_records in
-- 20261003004122_passport_transfers_lineage.sql.
--
-- Signed-in members keep full column access; row rules are unchanged.
-- Idempotent: revoke and grant can run twice.

revoke select on public.feeding_records from anon;
grant select (id, animal_id, date, food_type, accepted, notes, created_date, updated_date)
  on public.feeding_records to anon;

revoke select on public.shed_records from anon;
grant select (id, animal_id, date, quality, notes, created_date, updated_date)
  on public.shed_records to anon;
