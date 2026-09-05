-- Fix MyStore save crash: geckos.id and future_breeding_plans.id are
-- TEXT (base44-era ObjectIDs like '69522eb0be42985632e9641e'), not UUID.
-- The featured_*_ids columns on breeder_store_pages were declared
-- uuid[], so every save with a featured pick failed with:
--   invalid input syntax for type uuid: "69522eb0..."
--
-- Convert both columns to text[] to match the upstream ID types.
-- Table is empty at the time of this migration; no row migration needed.

ALTER TABLE public.breeder_store_pages
  ALTER COLUMN featured_gecko_ids DROP DEFAULT,
  ALTER COLUMN featured_gecko_ids TYPE text[] USING featured_gecko_ids::text[],
  ALTER COLUMN featured_gecko_ids SET DEFAULT '{}'::text[];

ALTER TABLE public.breeder_store_pages
  ALTER COLUMN featured_breeding_plan_ids DROP DEFAULT,
  ALTER COLUMN featured_breeding_plan_ids TYPE text[] USING featured_breeding_plan_ids::text[],
  ALTER COLUMN featured_breeding_plan_ids SET DEFAULT '{}'::text[];
