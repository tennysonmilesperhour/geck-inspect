-- 20260515 — Fix review_gecko_image / admin_verify_gecko_image
--
-- secondary_traits on both gecko_images and classification_votes is jsonb,
-- but the RPCs accept p_secondary_traits as text[] and write it straight
-- into those columns. Postgres rejects the assignment with:
--
--   column "secondary_traits" is of type jsonb but expression is of type text[]
--
-- Cast with to_jsonb() at every insert/update site. The parameter stays
-- text[] so the JS client (which passes a plain array of strings) still
-- works without changes.
--
-- Idempotent: drops and recreates with the same signature.

CREATE OR REPLACE FUNCTION public.review_gecko_image(
  p_image_id TEXT,
  p_verdict TEXT,
  p_primary_morph TEXT DEFAULT NULL,
  p_secondary_traits TEXT[] DEFAULT NULL,
  p_edits JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL,
  p_genetic_traits TEXT[] DEFAULT NULL,
  p_base_color TEXT DEFAULT NULL,
  p_pattern_intensity TEXT DEFAULT NULL,
  p_white_amount TEXT DEFAULT NULL,
  p_fired_state TEXT DEFAULT NULL
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
  v_edits JSONB;
  v_secondary_jsonb JSONB := to_jsonb(COALESCE(p_secondary_traits, '{}'::text[]));
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

  v_edits := COALESCE(p_edits, '{}'::jsonb)
    || jsonb_build_object(
      'genetic_traits',    COALESCE(p_genetic_traits,    '{}'::text[]),
      'base_color',        p_base_color,
      'pattern_intensity', p_pattern_intensity,
      'white_amount',      p_white_amount,
      'fired_state',       p_fired_state
    );

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, v_email, p_verdict,
    p_primary_morph, v_secondary_jsonb, v_edits, p_notes
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict          = EXCLUDED.verdict,
        primary_morph    = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits            = EXCLUDED.edits,
        notes            = EXCLUDED.notes,
        created_date     = now();

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
          SET verified          = TRUE,
              primary_morph     = v_existing_primary,
              secondary_traits  = CASE
                WHEN p_secondary_traits IS NULL THEN secondary_traits
                ELSE v_secondary_jsonb
              END,
              base_color        = COALESCE(p_base_color, base_color),
              pattern_intensity = COALESCE(p_pattern_intensity, pattern_intensity),
              white_amount      = COALESCE(p_white_amount, white_amount),
              fired_state       = COALESCE(p_fired_state, fired_state),
              training_meta = COALESCE(training_meta, '{}'::jsonb)
                || jsonb_build_object('genetic_traits',
                    COALESCE(p_genetic_traits, training_meta -> 'genetic_traits')),
              updated_date      = now()
          WHERE id = p_image_id;
      END IF;
    END IF;
  ELSE
    UPDATE gecko_images
      SET notes        = COALESCE(notes,'') ||
                         E'\n[rejected by ' || v_email || ' @ ' ||
                         to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ']',
          updated_date = now()
      WHERE id = p_image_id;
  END IF;

  RETURN jsonb_build_object(
    'image_id',      p_image_id,
    'verdict',       p_verdict,
    'approve_count', v_approve_count,
    'verified',      v_consensus_match
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_gecko_image(
  TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT
) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_verify_gecko_image(
  p_image_id TEXT,
  p_primary_morph TEXT,
  p_secondary_traits TEXT[] DEFAULT NULL,
  p_genetic_traits TEXT[] DEFAULT NULL,
  p_base_color TEXT DEFAULT NULL,
  p_pattern_intensity TEXT DEFAULT NULL,
  p_white_amount TEXT DEFAULT NULL,
  p_fired_state TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
  v_role  TEXT;
  v_edits JSONB;
  v_secondary_jsonb JSONB := to_jsonb(COALESCE(p_secondary_traits, '{}'::text[]));
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE email = v_email;
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  IF p_primary_morph IS NULL OR p_primary_morph = '' THEN
    RAISE EXCEPTION 'primary_morph is required';
  END IF;

  v_edits := jsonb_build_object(
    'genetic_traits',    COALESCE(p_genetic_traits,    '{}'::text[]),
    'base_color',        p_base_color,
    'pattern_intensity', p_pattern_intensity,
    'white_amount',      p_white_amount,
    'fired_state',       p_fired_state,
    'verified_via',      'admin_verify'
  );

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, v_email, 'approve',
    p_primary_morph, v_secondary_jsonb, v_edits, p_notes
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict          = 'approve',
        primary_morph    = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits            = EXCLUDED.edits,
        notes            = EXCLUDED.notes,
        created_date     = now();

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, '__admin_consensus__', 'approve',
    p_primary_morph, v_secondary_jsonb, v_edits,
    'auto-vote from admin_verify_gecko_image by ' || v_email
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict          = 'approve',
        primary_morph    = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits            = EXCLUDED.edits,
        notes            = EXCLUDED.notes,
        created_date     = now();

  UPDATE gecko_images
    SET verified          = TRUE,
        primary_morph     = p_primary_morph,
        secondary_traits  = CASE
          WHEN p_secondary_traits IS NULL THEN secondary_traits
          ELSE v_secondary_jsonb
        END,
        base_color        = COALESCE(p_base_color, base_color),
        pattern_intensity = COALESCE(p_pattern_intensity, pattern_intensity),
        white_amount      = COALESCE(p_white_amount, white_amount),
        fired_state       = COALESCE(p_fired_state, fired_state),
        training_meta = COALESCE(training_meta, '{}'::jsonb)
          || jsonb_build_object(
            'genetic_traits',
            COALESCE(p_genetic_traits, training_meta -> 'genetic_traits'),
            'verified_via', 'admin_verify',
            'verified_by',  v_email
          ),
        updated_date      = now()
    WHERE id = p_image_id;

  RETURN jsonb_build_object(
    'image_id', p_image_id,
    'verdict',  'approve',
    'verified', true,
    'fast_path', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_gecko_image(
  TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
