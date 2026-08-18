-- Fix: accepting an ownership transfer never moved the animal.
--
-- ClaimAnimal.jsx did the claim as three separate client-side writes. The
-- UPDATE on geckos was blocked by the geckos_update_own RLS policy, which
-- only lets the CURRENT owner (or a collection editor) update a row. The
-- person claiming the transfer is neither yet, so the update matched zero
-- rows (RLS filters silently, no error), the animal kept its old created_by,
-- and it never appeared in the claimer's collection. The success screen
-- still showed because none of the writes checked their result.
--
-- This function performs the whole claim atomically as SECURITY DEFINER so
-- it can reassign ownership across the RLS boundary, after validating the
-- token, status, and expiry itself.

CREATE OR REPLACE FUNCTION public.claim_transfer(
  p_token TEXT,
  p_contribute BOOLEAN DEFAULT false
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
  v_uid   UUID := auth.uid();
  v_name  TEXT;
  v_tr    transfer_requests%ROWTYPE;
  v_now   TIMESTAMPTZ := now();
BEGIN
  IF v_email IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Lock the transfer row so two claim attempts can't race.
  SELECT * INTO v_tr
  FROM transfer_requests
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found';
  END IF;

  IF v_tr.status = 'claimed' THEN
    RAISE EXCEPTION 'already claimed';
  END IF;
  IF v_tr.status = 'cancelled' THEN
    RAISE EXCEPTION 'transfer cancelled';
  END IF;
  IF v_tr.status = 'expired' OR v_tr.expires_at < v_now THEN
    RAISE EXCEPTION 'transfer expired';
  END IF;

  -- Best-effort display name for the ownership record.
  SELECT COALESCE(full_name, v_email) INTO v_name
  FROM profiles WHERE email = v_email;
  v_name := COALESCE(v_name, v_email);

  -- 1. Mark the transfer claimed.
  UPDATE transfer_requests
  SET status = 'claimed',
      to_user_id = v_uid,
      claimed_at = v_now,
      updated_date = v_now
  WHERE id = v_tr.id;

  -- 2. Reassign the animal to the claimer.
  UPDATE geckos
  SET created_by = v_email,
      status = 'Owned',
      updated_date = v_now
  WHERE id = v_tr.animal_id;

  -- 3. Append to the chain of custody.
  INSERT INTO ownership_records (
    animal_id, owner_user_id, owner_name, acquired_date,
    transfer_method, sale_price, contributed_to_market_data,
    created_by, created_date, updated_date
  ) VALUES (
    v_tr.animal_id, v_uid, v_name, v_now::date,
    'purchased', v_tr.sale_price,
    (p_contribute AND v_tr.sale_price IS NOT NULL),
    v_email, v_now, v_now
  );

  RETURN jsonb_build_object(
    'ok', true,
    'animal_id', v_tr.animal_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_transfer(TEXT, BOOLEAN) TO authenticated;
