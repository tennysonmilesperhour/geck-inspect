-- Returns the next batch of gecko images the given reviewer hasn't
-- voted on yet, with an AI primary_morph guess present so the dashboard
-- "Help ID these" carousel always has something to confirm or reject.
--
-- Includes verified=true images on purpose: the unverified pool is
-- tiny (typically <5 rows) but every verified image still benefits
-- from community confirmation votes toward the consensus signal that
-- drives morph_ID training.

CREATE OR REPLACE FUNCTION public.next_unvoted_id_candidates(
  reviewer text,
  lim int DEFAULT 20
) RETURNS TABLE (
  id text,
  image_url text,
  primary_morph text,
  base_color text,
  created_date timestamptz,
  verified boolean
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT g.id, g.image_url, g.primary_morph, g.base_color, g.created_date, g.verified
  FROM public.gecko_images g
  WHERE g.primary_morph IS NOT NULL
    AND g.image_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.classification_votes v
      WHERE v.gecko_image_id = g.id
        AND v.reviewer_email = reviewer
    )
  ORDER BY g.created_date DESC NULLS LAST
  LIMIT GREATEST(lim, 1);
$$;

GRANT EXECUTE ON FUNCTION public.next_unvoted_id_candidates(text, int) TO authenticated, anon;
