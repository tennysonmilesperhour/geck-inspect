-- Reactions on community feed events. Polymorphic by (event_type, event_id)
-- so any feed surface can hang lightweight kudos off any underlying row
-- without needing a foreign key into each source table.
CREATE TABLE IF NOT EXISTS public.community_event_reactions (
  event_type text NOT NULL,
  event_id text NOT NULL,
  user_email text NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('heart','congrats','fire')),
  created_date timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_type, event_id, user_email, reaction)
);

CREATE INDEX IF NOT EXISTS community_event_reactions_event_idx
  ON public.community_event_reactions (event_type, event_id);

ALTER TABLE public.community_event_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cer_read_all ON public.community_event_reactions;
CREATE POLICY cer_read_all ON public.community_event_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS cer_insert_own ON public.community_event_reactions;
CREATE POLICY cer_insert_own ON public.community_event_reactions
  FOR INSERT WITH CHECK (auth.email() = user_email);

DROP POLICY IF EXISTS cer_delete_own ON public.community_event_reactions;
CREATE POLICY cer_delete_own ON public.community_event_reactions
  FOR DELETE USING (auth.email() = user_email);

GRANT SELECT ON public.community_event_reactions TO anon, authenticated;
GRANT INSERT, DELETE ON public.community_event_reactions TO authenticated;

-- Unified community activity feed. SECURITY DEFINER so it can reach
-- across tables consistently. Explicitly excludes private breeding
-- plans and private profiles, so nothing leaks here that the owner
-- did not opt to share publicly.
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
    coalesce(p.full_name, p.business_name,
             split_part(coalesce(gi.created_by, 'anon@geckinspect.com'), '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'shared a photo of ' || coalesce(replace(gi.primary_morph, '_', ' '), 'a crested gecko') AS summary,
    gi.image_url,
    '/Gallery'::text AS href
  FROM public.gecko_images gi
  LEFT JOIN public.profiles p ON p.email = gi.created_by
  WHERE gi.created_date IS NOT NULL
    AND gi.image_url IS NOT NULL
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
    coalesce(p.full_name, p.business_name,
             split_part(coalesce(fp.created_by, 'anon@geckinspect.com'), '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'posted "' || left(coalesce(fp.title, 'a new thread'), 80) || '"' AS summary,
    NULL::text AS image_url,
    '/Forum'::text AS href
  FROM public.forum_posts fp
  LEFT JOIN public.profiles p ON p.email = fp.created_by
  WHERE fp.created_date IS NOT NULL
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
    coalesce(p.full_name, p.business_name,
             split_part(coalesce(bp.created_by, 'anon@geckinspect.com'), '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'planned a new pairing' AS summary,
    NULL::text AS image_url,
    '/Breeding'::text AS href
  FROM public.breeding_plans bp
  LEFT JOIN public.profiles p ON p.email = bp.created_by
  WHERE bp.created_date IS NOT NULL
    AND coalesce(bp.is_public, false) = true
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY bp.created_date DESC
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

GRANT EXECUTE ON FUNCTION public.community_feed(int) TO anon, authenticated;

-- Welcome shelf: keepers who joined in the last 7 days, public profiles
-- only, ordered newest first.
CREATE OR REPLACE FUNCTION public.welcome_shelf(p_limit int DEFAULT 6)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT coalesce(json_agg(row_to_json(rows) ORDER BY rows.created_date DESC), '[]'::json)
FROM (
  SELECT
    p.id::text AS id,
    p.email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS display_name,
    p.profile_image_url,
    p.created_date
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
    AND p.created_date > now() - interval '7 days'
  ORDER BY p.created_date DESC
  LIMIT p_limit
) rows;
$$;

GRANT EXECUTE ON FUNCTION public.welcome_shelf(int) TO anon, authenticated;
