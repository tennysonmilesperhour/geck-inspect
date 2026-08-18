-- Pairing outcome logs: the calculator's predicted-vs-actual flywheel.
--
-- Every row is one real hatched clutch logged against the prediction
-- the calculator made for that pairing. Own-data views (per-pairing
-- "prediction vs reality", the season scorecard) read these directly;
-- community-level aggregated cross statistics are a later, consented
-- step and deliberately have no read path here yet.

CREATE TABLE IF NOT EXISTS pairing_outcome_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Parents from the user's collection. geckos.id is TEXT (base44-era
  -- identifiers), so these must be TEXT, not UUID.
  sire_id TEXT,
  dam_id TEXT,
  sire_label TEXT NOT NULL DEFAULT '',
  dam_label TEXT NOT NULL DEFAULT '',
  -- Stable per-user pairing identity (sire_id|dam_id)
  pairing_key TEXT NOT NULL,
  -- Canonical genetics of the pairing at log time, for future
  -- aggregated cross statistics ("across N logged eggs of het x het")
  tag_key TEXT NOT NULL DEFAULT '',
  -- Snapshot of the predicted distribution: [{label, probability}]
  predicted JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Observed phenotype label per egg: ["Lilly White", "did not hatch"]
  observed JSONB NOT NULL DEFAULT '[]'::jsonb,
  eggs INT NOT NULL DEFAULT 2 CHECK (eggs BETWEEN 1 AND 4),
  hatched_on DATE,
  notes TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pairing_outcome_logs_owner
  ON pairing_outcome_logs (created_by);
CREATE INDEX IF NOT EXISTS idx_pairing_outcome_logs_pairing
  ON pairing_outcome_logs (pairing_key);
CREATE INDEX IF NOT EXISTS idx_pairing_outcome_logs_tag_key
  ON pairing_outcome_logs (tag_key);

ALTER TABLE pairing_outcome_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own outcome logs" ON pairing_outcome_logs;
CREATE POLICY "Users manage their own outcome logs"
  ON pairing_outcome_logs FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));
