-- Extend ownership transfers to non-gecko reptiles.
--
-- Ownership transfer previously only worked for geckos: transfer_requests
-- had a hard foreign key to geckos(id), and claim_transfer() always moved
-- the animal by updating the geckos table. Other reptiles live in a separate
-- other_reptiles table (scoped by created_by, no collection_id), so none of
-- that reached them.
--
-- This migration teaches the whole flow which table an animal_id points at.

-- 1. Tag each transfer with the kind of animal it moves. Existing rows are
--    all gecko transfers, so 'gecko' is the right backfill default.
ALTER TABLE transfer_requests
  ADD COLUMN IF NOT EXISTS animal_type TEXT NOT NULL DEFAULT 'gecko';

ALTER TABLE transfer_requests
  DROP CONSTRAINT IF EXISTS transfer_requests_animal_type_check;
ALTER TABLE transfer_requests
  ADD CONSTRAINT transfer_requests_animal_type_check
  CHECK (animal_type IN ('gecko', 'other_reptile'));

-- 2. animal_id can now point at either geckos(id) or other_reptiles(id), so a
--    single foreign key to geckos no longer holds. Drop it. We keep referential
--    hygiene with delete triggers below instead (they also restore the
--    ON DELETE CASCADE cleanup the geckos FK used to provide).
ALTER TABLE transfer_requests
  DROP CONSTRAINT IF EXISTS transfer_requests_animal_id_fkey;

-- 3. When an animal is deleted, drop any transfer requests that referenced it.
--    One shared trigger function, parameterized by animal_type, on both tables.
CREATE OR REPLACE FUNCTION public.cleanup_transfer_requests_on_animal_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  DELETE FROM transfer_requests
   WHERE animal_id = OLD.id
     AND animal_type = TG_ARGV[0];
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_transfer_requests ON geckos;
CREATE TRIGGER trg_cleanup_transfer_requests
  AFTER DELETE ON geckos
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_transfer_requests_on_animal_delete('gecko');

DROP TRIGGER IF EXISTS trg_cleanup_transfer_requests ON other_reptiles;
CREATE TRIGGER trg_cleanup_transfer_requests
  AFTER DELETE ON other_reptiles
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_transfer_requests_on_animal_delete('other_reptile');

-- 4. Teach claim_transfer to reassign whichever table the transfer points at.
--    Geckos are scoped by collection_id + status, other reptiles purely by
--    created_by, so the two branches differ. The chain-of-custody record
--    (ownership_records) is keyed by a text animal_id and works for both.
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
  v_cid   UUID;
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

  -- 2. Reassign the animal to the claimer, per its type.
  IF v_tr.animal_type = 'other_reptile' THEN
    -- Other reptiles are scoped only by created_by. Un-archive so the animal
    -- lands in the recipient's active collection, mirroring how a claimed
    -- gecko becomes 'Owned'.
    UPDATE other_reptiles
    SET created_by = v_email,
        archived = false,
        archived_date = NULL,
        updated_date = v_now
    WHERE id = v_tr.animal_id;
  ELSE
    -- Geckos are scoped by collection_id, not created_by, so the animal has to
    -- leave the sender's collection and join the claimer's default one.
    -- Mirrors geckos_set_default_collection().
    SELECT id INTO v_cid
    FROM collections
    WHERE lower(owner_email) = lower(v_email) AND is_default = true
    LIMIT 1;

    IF v_cid IS NULL THEN
      INSERT INTO collections (owner_email, name, description, is_default)
      VALUES (v_email, 'My collection', 'Default collection.', true)
      RETURNING id INTO v_cid;

      INSERT INTO collection_members
          (collection_id, member_email, role, status, accepted_at)
      VALUES (v_cid, v_email, 'owner', 'accepted', v_now)
      ON CONFLICT (collection_id, lower(member_email)) DO NOTHING;
    END IF;

    UPDATE geckos
    SET created_by = v_email,
        collection_id = v_cid,
        status = 'Owned',
        updated_date = v_now
    WHERE id = v_tr.animal_id;
  END IF;

  -- 3. Append to the chain of custody (same shape for either animal type).
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
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_transfer(TEXT, BOOLEAN) TO authenticated;
