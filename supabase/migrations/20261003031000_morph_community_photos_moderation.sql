-- Morph Guide member photos respect moderation and blocks (3 Oct 2026,
-- feature audit step 11). NOT YET APPLIED.
--
-- Apply AFTER 20261002220000_morph_photo_credits.sql, which creates
-- public.morph_community_photos. This file replaces that function with the
-- same signature and two extra rules:
--   * a photo a moderator hid (morph_reference_images.moderation_hidden,
--     added by 20261003024242_content_reports_and_moderation.sql) is left out;
--   * a signed-in viewer does not see photos from members they blocked.
-- It also returns contributor_id (the member's profile id, never an email)
-- so the Report button can offer to block the contributor.
--
-- The return type gains a column, so the old function has to go first.
-- That is the only reason for the drop below; nothing else is removed.

drop function if exists public.morph_community_photos(text, integer);

create function public.morph_community_photos(p_slug text, p_limit integer default 12)
returns table (
  id text,
  image_url text,
  contributor_name text,
  created_date timestamptz,
  contributor_id text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    m.id,
    m.image_url,
    (
      select n
        from unnest(array[
          nullif(btrim(p.business_name), ''),
          nullif(btrim(p.breeder_name), ''),
          case when p.is_public_profile is true then nullif(btrim(p.full_name), '') end
        ]) with ordinality as c(n, ord)
       where n is not null and position('@' in n) = 0
       order by ord
       limit 1
    ) as contributor_name,
    m.created_date,
    case when p.moderation_hidden is not true then p.id end as contributor_id
  from public.morph_reference_images m
  left join public.profiles p
    on lower(p.email) = lower(m.submitted_by_email)
  where m.status = 'approved'
    and m.morph_guide_id = p_slug
    and m.image_url is not null
    and m.moderation_hidden = false
    and not exists (
      select 1 from public.user_blocks b
       where b.blocker_email = auth.email()
         and lower(b.blocked_email) = lower(m.submitted_by_email)
    )
  order by m.created_date desc
  limit least(greatest(coalesce(p_limit, 12), 1), 48);
$function$;

revoke all on function public.morph_community_photos(text, integer) from public;
grant execute on function public.morph_community_photos(text, integer) to anon, authenticated;
