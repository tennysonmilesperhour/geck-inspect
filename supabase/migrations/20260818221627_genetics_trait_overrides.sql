-- Genetics trait overrides: the calculator's trait-velocity store.
--
-- The Foundation Genetics engine is vendored as a package, so shipping
-- a brand-new proven gene (or downgrading a confidence badge when the
-- science moves) used to require a package rebuild and a deploy. This
-- table lets those become DATA changes: rows are merged over the
-- static calculator catalog at runtime by
-- src/lib/genetics/traitOverrides.js.
--
-- patch shapes:
--   { "confidence": "proven" }                        adjust an existing trait
--   { "blurb": "..." }                                update copy
--   { "new": true, "slug": "...", "label": "...",
--     "locus": "...", "dominance": "recessive", ... } add a provisional trait
--
-- Writes are deliberately NOT exposed to app users: no INSERT/UPDATE
-- policies exist, so only the service role (Supabase dashboard /
-- admin tooling) can change genetic facts. Reads are public: the
-- calculator serves signed-out visitors.

CREATE TABLE IF NOT EXISTS genetics_trait_overrides (
  id TEXT PRIMARY KEY,
  patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE genetics_trait_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trait overrides are public to read" ON genetics_trait_overrides;
CREATE POLICY "Trait overrides are public to read"
  ON genetics_trait_overrides FOR SELECT
  USING (enabled = true);
