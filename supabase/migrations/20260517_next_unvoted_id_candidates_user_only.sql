-- Restrict the Help-ID-these carousel to genuine user-submitted
-- images. The scraper inserts gecko_images rows with created_by NULL
-- for training data (show winners, trophy shots, etc.), and those
-- shouldn't surface in the community moderation queue.
--
-- Filter is "created_by IS NOT NULL", which currently selects ~31
-- legit community ID-request uploads and excludes ~3,760 scraped
-- training rows.

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
    AND g.created_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.classification_votes v
      WHERE v.gecko_image_id = g.id
        AND v.reviewer_email = reviewer
    )
  ORDER BY g.created_date DESC NULLS LAST
  LIMIT GREATEST(lim, 1);
$$;
