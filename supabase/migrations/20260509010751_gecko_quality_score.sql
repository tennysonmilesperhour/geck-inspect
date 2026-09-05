-- P11 Quality Scale: numeric quality score on each gecko.
--
-- Scores are 0.0 to 10.0 (0.5 step granularity, but the column doesn't
-- enforce step size at the DB layer; the UI does). NULL means the gecko
-- has not been graded yet.
--
-- Tier (Pet / Breeder / High-end / Investment) is derived from score
-- in src/lib/quality.js. We continue to populate the legacy
-- `pattern_grade` text column on save so existing Market Pricing
-- aggregations keep working unchanged.

ALTER TABLE public.geckos
  ADD COLUMN IF NOT EXISTS quality_score numeric(3,1)
    CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 10));

COMMENT ON COLUMN public.geckos.quality_score IS
  'Owner-set quality grade on the Geck Inspect Standard 0-10 scale. See docs/specs/P11-quality-rubric.md and /QualityScale. Tier (pet/breeder/high_end/investment) is derived; pattern_grade column mirrors the derived tier for backwards compatibility with Market Pricing.';
