-- Starts from the current live welcome_shelf definition (24 October 2026).
CREATE OR REPLACE FUNCTION public.welcome_shelf(p_limit integer DEFAULT 6)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT coalesce(json_agg(row_to_json(rows) ORDER BY rows.created_date DESC), '[]'::json)
FROM (
  SELECT
    p.id::text AS id,
    coalesce(nullif(p.full_name, ''), nullif(p.business_name, ''), 'Geck Inspect keeper') AS display_name,
    p.profile_image_url,
    p.created_date
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND p.is_public_profile = true
    AND p.moderation_hidden = false
    AND p.created_date > now() - interval '7 days'
  ORDER BY p.created_date DESC
  LIMIT least(greatest(coalesce(p_limit, 6), 1), 24)
) rows;
$function$
