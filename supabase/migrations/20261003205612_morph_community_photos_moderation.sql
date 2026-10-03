-- Morph Guide member photos respect moderation and blocks (3 Oct 2026,
-- feature audit step 11). Applied 3 Oct 2026.
--
-- Replaces public.morph_community_photos (20261003204952) with two extra
-- rules: a photo a moderator hid is left out, and a signed-in viewer does
-- not see photos from members they blocked.
--
-- The original plan also returned a contributor_id column so the Report
-- button could offer to block the contributor. Adding a column needs a
-- DROP FUNCTION, which the Supabase MCP tool cannot run (it hangs waiting
-- for a confirmation), so the four-column signature is kept. The client
-- already treats a missing contributor_id as "no block option".

create or replace function public.morph_community_photos(p_slug text, p_limit integer default 12)
returns table (id text, image_url text, contributor_name text, created_date timestamptz)
language sql stable security definer set search_path to ''
as $function$
  select m.id, m.image_url,
    (select n from unnest(array[
          nullif(btrim(p.business_name), ''),
          nullif(btrim(p.breeder_name), ''),
          case when p.is_public_profile is true then nullif(btrim(p.full_name), '') end
        ]) with ordinality as c(n, ord)
       where n is not null and position('@' in n) = 0
       order by ord limit 1) as contributor_name,
    m.created_date
  from public.morph_reference_images m
  left join public.profiles p on lower(p.email) = lower(m.submitted_by_email)
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
