-- Training-pipeline columns on gecko_images.
--
-- Adds structured metadata for ML training (taxonomy version, provenance,
-- AI/expert corrections, photo quality, genetics context) and an index to
-- keep the /training review queue fast once the dataset grows.
--
-- Safe to re-run — every change uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- 1. training_meta JSONB column -------------------------------------------
-- Consumed by:
--   - /recognition MorphCorrectionPanel (writes AI-original + reviewer edits)
--   - /training ExpertContributionForm  (writes full genetics + photo context)
--   - computeStats() on /training       (reads genetic_traits for gap analysis)
ALTER TABLE IF EXISTS public.gecko_images
  ADD COLUMN IF NOT EXISTS training_meta JSONB DEFAULT '{}'::jsonb;

-- 2. Training-grade fields used by the UI but not guaranteed to exist yet --
ALTER TABLE IF EXISTS public.gecko_images
  ADD COLUMN IF NOT EXISTS confidence_score  NUMERIC,
  ADD COLUMN IF NOT EXISTS pattern_intensity TEXT,
  ADD COLUMN IF NOT EXISTS white_amount      TEXT,
  ADD COLUMN IF NOT EXISTS fired_state       TEXT,
  ADD COLUMN IF NOT EXISTS age_estimate      TEXT;

-- 3. Review-queue index ---------------------------------------------------
-- AIFeedbackQueue filters by verified=false and orders by created_date asc.
-- Partial index keeps it small since the hot set is only unverified rows.
CREATE INDEX IF NOT EXISTS idx_gecko_images_unverified_queue
  ON public.gecko_images (created_date ASC)
  WHERE verified IS NOT TRUE;

-- 4. Dataset-stats index --------------------------------------------------
-- Speeds up the per-morph histogram + coverage calculation on /training.
CREATE INDEX IF NOT EXISTS idx_gecko_images_primary_morph
  ON public.gecko_images (primary_morph)
  WHERE primary_morph IS NOT NULL;

-- 5. GIN index on training_meta so later queries can filter on provenance
--    or genetic_traits without a table scan.
CREATE INDEX IF NOT EXISTS idx_gecko_images_training_meta
  ON public.gecko_images USING gin (training_meta);
