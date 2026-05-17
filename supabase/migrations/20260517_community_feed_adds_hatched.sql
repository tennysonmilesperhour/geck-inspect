-- Add "hatched" events to the live community feed. Hatchings surface
-- only when the parent breeding_plan is is_public AND the keeper's
-- profile is is_public_profile. The egg row itself stays private;
-- the feed reveals only that a hatch happened, not clutch numbering
-- or any other metadata. hatch_date_actual drives ordering.
CREATE OR REPLACE FUNCTION public.community_feed(p_limit int DEFAULT 25)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH uploads AS (
  SELECT
    'upload'::text AS event_type,
    gi.id::text AS event_id,
    gi.created_date,
    gi.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'shared a photo of ' || coalesce(replace(gi.primary_morph, '_', ' '), 'a crested gecko') AS summary,
    gi.image_url,
    '/Gallery'::text AS href
  FROM public.gecko_images gi
  INNER JOIN public.profiles p ON p.email = gi.created_by
  WHERE gi.created_date IS NOT NULL
    AND gi.image_url IS NOT NULL
    AND gi.created_by IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY gi.created_date DESC
  LIMIT 30
),
posts AS (
  SELECT
    'forum_post'::text AS event_type,
    fp.id::text AS event_id,
    fp.created_date,
    fp.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'posted "' || left(coalesce(fp.title, 'a new thread'), 80) || '"' AS summary,
    NULL::text AS image_url,
    '/Forum'::text AS href
  FROM public.forum_posts fp
  INNER JOIN public.profiles p ON p.email = fp.created_by
  WHERE fp.created_date IS NOT NULL
    AND fp.created_by IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY fp.created_date DESC
  LIMIT 30
),
plans AS (
  SELECT
    'breeding_plan'::text AS event_type,
    bp.id::text AS event_id,
    bp.created_date,
    bp.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'planned a new pairing' AS summary,
    NULL::text AS image_url,
    '/Breeding'::text AS href
  FROM public.breeding_plans bp
  INNER JOIN public.profiles p ON p.email = bp.created_by
  WHERE bp.created_date IS NOT NULL
    AND bp.created_by IS NOT NULL
    AND coalesce(bp.is_public, false) = true
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY bp.created_date DESC
  LIMIT 30
),
hatched AS (
  SELECT
    'hatched'::text AS event_type,
    e.id::text AS event_id,
    e.hatch_date_actual::timestamptz AS created_date,
    e.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'just hatched a new gecko' AS summary,
    NULL::text AS image_url,
    '/Breeding'::text AS href
  FROM public.eggs e
  INNER JOIN public.profiles p ON p.email = e.created_by
  INNER JOIN public.breeding_plans bp ON bp.id = e.breeding_plan_id
  WHERE e.status = 'Hatched'
    AND e.hatch_date_actual IS NOT NULL
    AND coalesce(e.archived, false) = false
    AND coalesce(p.is_public_profile, true) = true
    AND coalesce(bp.is_public, false) = true
  ORDER BY e.hatch_date_actual DESC
  LIMIT 30
),
joins AS (
  SELECT
    'join'::text AS event_type,
    p.id::text AS event_id,
    p.created_date,
    p.email AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'joined the community' AS summary,
    NULL::text AS image_url,
    ('/PublicProfile?userId=' || p.id::text)::text AS href
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
    AND p.created_date > now() - interval '30 days'
  ORDER BY p.created_date DESC
  LIMIT 30
),
combined AS (
  SELECT * FROM uploads
  UNION ALL SELECT * FROM posts
  UNION ALL SELECT * FROM plans
  UNION ALL SELECT * FROM hatched
  UNION ALL SELECT * FROM joins
),
ranked AS (
  SELECT * FROM combined
  ORDER BY created_date DESC
  LIMIT p_limit
)
SELECT coalesce(json_agg(row_to_json(ranked) ORDER BY ranked.created_date DESC), '[]'::json)
FROM ranked;
$$;
