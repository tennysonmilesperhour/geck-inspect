-- Consensus layer for /training review queue.
--
-- A sample is promoted to `verified=true` only after two distinct expert
-- reviewers agree on the labels. This keeps a single over-enthusiastic
-- reviewer from pushing low-quality labels into the training corpus.
--
-- Flow (implemented by the review_gecko_image RPC below):
--   1. Reviewer A calls review_gecko_image(image_id, 'approve', edits).
--      -> first vote row inserted, verified stays false.
--   2. Reviewer B calls review_gecko_image(image_id, 'approve', edits).
--      -> second vote inserted. If labels match A's, verified flips to true.
--   3. Either reviewer can 'reject' at any time; verified stays false and
--      notes get annotated.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.classification_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gecko_image_id UUID NOT NULL REFERENCES public.gecko_images(id) ON DELETE CASCADE,
  reviewer_email TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('approve', 'reject')),
  primary_morph TEXT,
  secondary_traits TEXT[] DEFAULT '{}',
  edits JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gecko_image_id, reviewer_email)
);

CREATE INDEX IF NOT EXISTS idx_classification_votes_image
  ON public.classification_votes (gecko_image_id);

ALTER TABLE public.classification_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classification_votes read" ON public.classification_votes;
CREATE POLICY "classification_votes read" ON public.classification_votes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "classification_votes insert self" ON public.classification_votes;
CREATE POLICY "classification_votes insert self" ON public.classification_votes
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_email = auth.jwt() ->> 'email');

-- No UPDATE/DELETE — votes are append-only. The unique constraint above
-- means a reviewer can't change their mind by re-inserting; to change
-- their vote they must rely on a new version of the sample.

-- ============================================================================
-- RPC: review_gecko_image
-- ============================================================================
-- Call from the /training UI. Handles both insertion of the vote row and
-- (on 'approve') the consensus check that flips verified=true.
--
-- Returns a JSONB summary so the UI can show vote count + current state.
CREATE OR REPLACE FUNCTION public.review_gecko_image(
  p_image_id UUID,
  p_verdict TEXT,
  p_primary_morph TEXT DEFAULT NULL,
  p_secondary_traits TEXT[] DEFAULT NULL,
  p_edits JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
  v_role  TEXT;
  v_approve_count INT;
  v_consensus_match BOOLEAN := false;
  v_existing_primary TEXT;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE email = v_email;
  IF v_role NOT IN ('admin', 'expert_reviewer') THEN
    RAISE EXCEPTION 'not an expert reviewer';
  END IF;

  IF p_verdict NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'verdict must be approve or reject';
  END IF;

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, v_email, p_verdict,
    p_primary_morph, p_secondary_traits, COALESCE(p_edits, '{}'::jsonb), p_notes
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict = EXCLUDED.verdict,
        primary_morph = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits = EXCLUDED.edits,
        notes = EXCLUDED.notes,
        created_date = now();

  -- On approve: count approvals on this image and check whether the top two
  -- agree on primary_morph. If so, flip verified + adopt the agreed labels.
  IF p_verdict = 'approve' THEN
    SELECT COUNT(*) INTO v_approve_count
      FROM classification_votes
      WHERE gecko_image_id = p_image_id AND verdict = 'approve';

    IF v_approve_count >= 2 THEN
      -- Pick the most-voted primary_morph. Ties break to the latest vote.
      SELECT primary_morph INTO v_existing_primary
        FROM (
          SELECT primary_morph, COUNT(*) AS c, MAX(created_date) AS latest
            FROM classification_votes
            WHERE gecko_image_id = p_image_id AND verdict = 'approve'
            GROUP BY primary_morph
            ORDER BY c DESC, latest DESC
            LIMIT 1
        ) winner;

      IF v_existing_primary IS NOT NULL THEN
        v_consensus_match := true;
        UPDATE gecko_images
          SET verified = TRUE,
              primary_morph = v_existing_primary,
              secondary_traits = COALESCE(p_secondary_traits, secondary_traits),
              updated_date = now()
          WHERE id = p_image_id;
      END IF;
    END IF;
  ELSE
    -- Any reject annotates the sample's notes but does not flip anything.
    UPDATE gecko_images
      SET notes = COALESCE(notes,'') ||
                  E'\n[rejected by ' || v_email || ' @ ' ||
                  to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ']',
          updated_date = now()
      WHERE id = p_image_id;
  END IF;

  RETURN jsonb_build_object(
    'image_id', p_image_id,
    'verdict', p_verdict,
    'approve_count', v_approve_count,
    'verified', v_consensus_match
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_gecko_image(UUID, TEXT, TEXT, TEXT[], JSONB, TEXT)
  TO authenticated;
