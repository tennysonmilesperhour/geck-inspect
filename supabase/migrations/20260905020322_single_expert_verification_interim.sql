-- Interim Morph ID verification policy.
--
-- Geck Inspect currently has one approved expert reviewer. A complete approval
-- from that reviewer promotes a sample to the verified corpus. Vote records,
-- full-label fingerprints, and reviewer identity stay intact so the threshold
-- can return to two independent matching experts without changing the model.

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
  v_email text := auth.jwt() ->> 'email';
  v_role text;
  v_edits jsonb;
  v_secondary_jsonb jsonb := to_jsonb(COALESCE(p_secondary_traits, '{}'::text[]));
  v_genetic_jsonb jsonb := to_jsonb(COALESCE(p_genetic_traits, '{}'::text[]));
  v_sorted_secondary jsonb;
  v_sorted_genetics jsonb;
  v_label jsonb;
  v_fingerprint text;
  v_matching_count int := 0;
  v_total_approve_count int := 0;
  v_required_approve_count int := 1;
  v_verified boolean := false;
  v_review_status text := 'pending_review';
  v_already_verified boolean := false;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE email = v_email;
  IF v_role IS NULL OR v_role NOT IN ('admin', 'expert_reviewer') THEN
    RAISE EXCEPTION 'not an expert reviewer';
  END IF;

  IF p_verdict NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'verdict must be approve or reject';
  END IF;

  IF p_verdict = 'approve' AND COALESCE(p_primary_morph, '') = '' THEN
    RAISE EXCEPTION 'primary_morph is required for approval';
  END IF;

  SELECT verified INTO v_already_verified
    FROM public.gecko_images
    WHERE id = p_image_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gecko image not found';
  END IF;
  IF COALESCE(v_already_verified, false) THEN
    RAISE EXCEPTION 'gecko image is already verified';
  END IF;

  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
    INTO v_sorted_secondary
    FROM jsonb_array_elements_text(v_secondary_jsonb);
  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
    INTO v_sorted_genetics
    FROM jsonb_array_elements_text(v_genetic_jsonb);

  v_label := jsonb_build_object(
    'primary_morph', COALESCE(p_primary_morph, ''),
    'secondary_traits', v_sorted_secondary,
    'genetic_traits', v_sorted_genetics,
    'base_color', COALESCE(p_base_color, ''),
    'pattern_intensity', COALESCE(p_pattern_intensity, ''),
    'white_amount', COALESCE(p_white_amount, ''),
    'fired_state', COALESCE(p_fired_state, '')
  );
  v_fingerprint := md5(v_label::text);
  v_edits := COALESCE(p_edits, '{}'::jsonb) || jsonb_build_object(
    'genetic_traits', v_genetic_jsonb,
    'base_color', p_base_color,
    'pattern_intensity', p_pattern_intensity,
    'white_amount', p_white_amount,
    'fired_state', p_fired_state,
    'label_set', v_label
  );

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict, primary_morph,
    secondary_traits, edits, notes, label_fingerprint
  ) VALUES (
    p_image_id, v_email, p_verdict, p_primary_morph,
    v_secondary_jsonb, v_edits, p_notes, v_fingerprint
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict = EXCLUDED.verdict,
        primary_morph = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits = EXCLUDED.edits,
        notes = EXCLUDED.notes,
        label_fingerprint = EXCLUDED.label_fingerprint,
        created_date = now();

  IF p_verdict = 'reject' THEN
    v_review_status := 'rejected';
  ELSE
    SELECT COUNT(*) INTO v_total_approve_count
      FROM classification_votes
      WHERE gecko_image_id = p_image_id AND verdict = 'approve';
    SELECT COUNT(*) INTO v_matching_count
      FROM classification_votes
      WHERE gecko_image_id = p_image_id
        AND verdict = 'approve'
        AND label_fingerprint = v_fingerprint;

    IF v_matching_count >= v_required_approve_count THEN
      v_verified := true;
      v_review_status := 'verified';
    END IF;
  END IF;

  UPDATE gecko_images
    SET verified = CASE WHEN v_verified THEN true ELSE verified END,
        primary_morph = CASE WHEN v_verified THEN p_primary_morph ELSE primary_morph END,
        secondary_traits = CASE WHEN v_verified THEN v_secondary_jsonb ELSE secondary_traits END,
        base_color = CASE WHEN v_verified THEN p_base_color ELSE base_color END,
        pattern_intensity = CASE WHEN v_verified THEN p_pattern_intensity ELSE pattern_intensity END,
        white_amount = CASE WHEN v_verified THEN p_white_amount ELSE white_amount END,
        fired_state = CASE WHEN v_verified THEN p_fired_state ELSE fired_state END,
        training_meta = COALESCE(training_meta, '{}'::jsonb) || jsonb_build_object(
          'review_status', v_review_status,
          'verification_policy', 'single_expert_interim',
          'required_approve_count', v_required_approve_count,
          'matching_approve_count', v_matching_count,
          'total_approve_count', v_total_approve_count,
          'verified_by', CASE WHEN v_verified THEN v_email ELSE training_meta ->> 'verified_by' END,
          'genetic_traits', CASE
            WHEN v_verified THEN v_genetic_jsonb
            ELSE COALESCE(training_meta -> 'genetic_traits', '[]'::jsonb)
          END
        ),
        notes = CASE
          WHEN p_verdict = 'reject' THEN COALESCE(notes, '') || E'\n[expert rejected: ' || COALESCE(p_notes, 'no reason supplied') || ']'
          ELSE notes
        END,
        updated_date = now()
    WHERE id = p_image_id;

  RETURN jsonb_build_object(
    'image_id', p_image_id,
    'verdict', p_verdict,
    'matching_approve_count', v_matching_count,
    'required_approve_count', v_required_approve_count,
    'total_approve_count', v_total_approve_count,
    'approve_count', v_matching_count,
    'review_status', v_review_status,
    'verification_policy', 'single_expert_interim',
    'verified', v_verified
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_gecko_image(
  TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT
) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_gecko_image(
  TEXT, TEXT, TEXT, TEXT[], JSONB, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT
) TO authenticated;
