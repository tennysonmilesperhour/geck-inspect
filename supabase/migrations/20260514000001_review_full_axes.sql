-- 20260514 — Review queue full-axes support
--
-- Two changes:
--
-- 1. Extend public.review_gecko_image() to accept the four additional
--    label axes that the gecko_images table already stores (genetic_traits,
--    base_color, pattern_intensity, white_amount, fired_state). They're
--    stored in classification_votes.edits.* on every vote and applied to
--    gecko_images when the row is promoted (>= 2 approve consensus).
--
-- 2. Add public.admin_verify_gecko_image() so a profile.role='admin' can
--    promote a sample to verified in a single click without waiting for a
--    second reviewer. Records a synthetic 2-vote audit trail in
--    classification_votes so downstream consumers don't see an unverified
--    row with zero votes. Expert-reviewer role gets the existing 2-vote
--    consensus path; admin gets this fast-path.
--
-- Idempotent: drops the prior signature, recreates with the new one.

DROP FUNCTION IF EXISTS public.review_gecko_image(TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT);

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

  -- Bake the extra-axis edits into the vote's edits JSON so they're an
  -- explicit per-vote record, not just sitting on the row.
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
    p_primary_morph, p_secondary_traits, v_edits, p_notes
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
              secondary_traits  = COALESCE(p_secondary_traits, secondary_traits),
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


-- ============================================================================
-- admin_verify_gecko_image — admin one-click verify with full edits
-- ============================================================================
-- Admins can promote a sample to verified=TRUE in a single call, applying
-- their edits across all label axes. Skips the 2-vote consensus that
-- expert_reviewers must satisfy. The audit trail in classification_votes
-- still gets two synthetic 'approve' rows so any downstream consumer that
-- counts votes sees a sensible record (reviewer_email = the admin email,
-- plus a second row with the special sentinel '__admin_consensus__').
-- ============================================================================

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

  -- Record the admin's vote.
  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, v_email, 'approve',
    p_primary_morph, p_secondary_traits, v_edits, p_notes
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict          = 'approve',
        primary_morph    = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits            = EXCLUDED.edits,
        notes            = EXCLUDED.notes,
        created_date     = now();

  -- Synthetic second vote so downstream counters see consensus.
  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, '__admin_consensus__', 'approve',
    p_primary_morph, p_secondary_traits, v_edits,
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
        secondary_traits  = COALESCE(p_secondary_traits, secondary_traits),
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


-- ============================================================================
-- is_admin — companion of is_expert_reviewer for client gating
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
