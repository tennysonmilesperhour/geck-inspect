-- Server-side aggregates for the /training dataset-stats tab.
--
-- Replaces the client-side `GeckoImage.list()` + in-memory reduce with a
-- single round-trip that returns everything the stats tab and gap-analysis
-- need. Safe for anon callers (read-only aggregates; no per-row data).
--
-- Returns:
--   total, verified, recent_week, morph_categories_seen, avg_confidence,
--   top_morphs (array of {id, count}),
--   undersampled_morphs (array of {id, count}) — known primary morphs with
--                                                fewer than 5 samples,
--   seen_genetic_traits (array of ids) — aggregated from training_meta plus
--                                        legacy secondary_morph fallback.

CREATE OR REPLACE FUNCTION public.gecko_image_stats()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  WITH base AS (
    SELECT
      id,
      primary_morph,
      secondary_morph,
      verified,
      confidence_score,
      created_date,
      training_meta
    FROM public.gecko_images
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE verified IS TRUE)::bigint AS verified,
      COUNT(*) FILTER (WHERE created_date > now() - interval '7 days')::bigint
        AS recent_week,
      COUNT(DISTINCT primary_morph) FILTER (WHERE primary_morph IS NOT NULL)::bigint
        AS morph_categories_seen,
      AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL)::numeric
        AS avg_confidence
    FROM base
  ),
  morph_counts AS (
    SELECT primary_morph, COUNT(*)::bigint AS count
    FROM base
    WHERE primary_morph IS NOT NULL
    GROUP BY primary_morph
  ),
  top AS (
    SELECT jsonb_agg(jsonb_build_object('id', primary_morph, 'count', count)
                     ORDER BY count DESC) AS top_morphs
    FROM (
      SELECT primary_morph, count FROM morph_counts
      ORDER BY count DESC LIMIT 8
    ) t
  ),
  undersampled AS (
    SELECT jsonb_agg(jsonb_build_object('id', primary_morph, 'count', count)
                     ORDER BY count ASC) AS undersampled_morphs
    FROM morph_counts WHERE count < 5
  ),
  genetics AS (
    SELECT jsonb_agg(DISTINCT g) AS seen_genetic_traits
    FROM (
      SELECT secondary_morph AS g FROM base WHERE secondary_morph IS NOT NULL
      UNION ALL
      SELECT jsonb_array_elements_text(training_meta -> 'genetic_traits') AS g
      FROM base
      WHERE training_meta ? 'genetic_traits'
    ) x
    WHERE g IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total',                   COALESCE(t.total, 0),
    'verified',                COALESCE(t.verified, 0),
    'recent_week',             COALESCE(t.recent_week, 0),
    'morph_categories_seen',   COALESCE(t.morph_categories_seen, 0),
    'avg_confidence',          t.avg_confidence,
    'top_morphs',              COALESCE(top.top_morphs, '[]'::jsonb),
    'undersampled_morphs',     COALESCE(undersampled.undersampled_morphs, '[]'::jsonb),
    'seen_genetic_traits',     COALESCE(genetics.seen_genetic_traits, '[]'::jsonb)
  )
  FROM totals t, top, undersampled, genetics;
$$;

GRANT EXECUTE ON FUNCTION public.gecko_image_stats() TO anon, authenticated;
