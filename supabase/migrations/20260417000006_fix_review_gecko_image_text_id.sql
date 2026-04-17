-- Fix: gecko_images.id is TEXT in prod (Base44 legacy), not UUID.
--
-- The earlier classification_votes migration declared review_gecko_image
-- with a UUID arg. That signature can't accept the TEXT ids the UI passes
-- in, so every approve/reject call would 400.
--
-- This migration drops the UUID-signature function and recreates it with a
-- TEXT arg, matching the actual id column type. Idempotent: if nothing was
-- applied yet, the DROP is a no-op.

DROP FUNCTION IF EXISTS public.review_gecko_image(UUID, TEXT, TEXT, TEXT[], JSONB, TEXT);
DROP FUNCTION IF EXISTS public.review_gecko_image(TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.review_gecko_image(
  p_image_id TEXT,
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

  IF p_verdict = 'approve' THEN
    SELECT COUNT(*) INTO v_approve_count
      FROM classification_votes
      WHERE gecko_image_id = p_image_id AND verdict = 'approve';

    IF v_approve_count >= 2 THEN
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

GRANT EXECUTE ON FUNCTION public.review_gecko_image(TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT)
  TO authenticated;

-- Also ensure classification_votes.gecko_image_id is TEXT (it already is in
-- prod, but being explicit lets a fresh project work too).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'classification_votes'
      AND column_name  = 'gecko_image_id'
      AND data_type    = 'uuid'
  ) THEN
    ALTER TABLE public.classification_votes
      ALTER COLUMN gecko_image_id TYPE TEXT USING gecko_image_id::text;
  END IF;
END $$;
