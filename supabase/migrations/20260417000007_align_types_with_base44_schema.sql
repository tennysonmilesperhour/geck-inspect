-- Comprehensive alignment of the /recognition + /training types with the
-- Base44-migrated prod schema. Prior migrations declared my new RPCs with
-- UUID ids and TEXT[] arrays; prod actually stores ids as TEXT and array-
-- shaped data as JSONB. This migration drops and recreates both RPCs so
-- they accept and return the types the UI is already sending.
--
-- Safe to run on fresh projects too: the DROP IF EXISTS handles both
-- previous signatures, and the function bodies don't assume anything about
-- whether the earlier versions existed.

-- ---------------------------------------------------------------------------
-- 1. review_gecko_image — TEXT id, JSONB array
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.review_gecko_image(UUID, TEXT, TEXT, TEXT[], JSONB, TEXT);
DROP FUNCTION IF EXISTS public.review_gecko_image(TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT);
DROP FUNCTION IF EXISTS public.review_gecko_image(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.review_gecko_image(
  p_image_id TEXT,
  p_verdict TEXT,
  p_primary_morph TEXT DEFAULT NULL,
  p_secondary_traits JSONB DEFAULT NULL,
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
    p_primary_morph, COALESCE(p_secondary_traits, '[]'::jsonb),
    COALESCE(p_edits, '{}'::jsonb), p_notes
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

GRANT EXECUTE ON FUNCTION public.review_gecko_image(TEXT, TEXT, TEXT, JSONB, JSONB, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. nearest_training_samples — TEXT id, JSONB array for secondary_traits
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.nearest_training_samples(extensions.vector, INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.nearest_training_samples(vector, INT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.nearest_training_samples(
  query_embedding extensions.vector(768),
  match_count INT DEFAULT 6,
  verified_only BOOLEAN DEFAULT true
) RETURNS TABLE (
  id TEXT,
  image_url TEXT,
  primary_morph TEXT,
  secondary_traits JSONB,
  base_color TEXT,
  similarity FLOAT
)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, extensions
AS $$
  SELECT
    g.id,
    g.image_url,
    g.primary_morph,
    g.secondary_traits,
    g.base_color,
    1 - (g.image_embedding <=> query_embedding) AS similarity
  FROM public.gecko_images g
  WHERE g.image_embedding IS NOT NULL
    AND (NOT verified_only OR g.verified IS TRUE)
  ORDER BY g.image_embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 24));
$$;

GRANT EXECUTE ON FUNCTION public.nearest_training_samples(extensions.vector, INT, BOOLEAN)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. classification_votes.secondary_traits: ensure JSONB
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'classification_votes'
      AND column_name  = 'secondary_traits'
      AND data_type    = 'ARRAY'
  ) THEN
    ALTER TABLE public.classification_votes
      ALTER COLUMN secondary_traits DROP DEFAULT,
      ALTER COLUMN secondary_traits TYPE JSONB USING to_jsonb(secondary_traits),
      ALTER COLUMN secondary_traits SET DEFAULT '[]'::jsonb;
  END IF;
END $$;
