-- Public photos for the Morph Guide and project line pages.
--
-- Signed-out visitors must not select gecko_images.training_meta. That
-- JSON can hold a reviewer email. The Morph Guide hero anchors and the
-- project line photo strip used to read it directly, so
-- 20261003220100_anon_hide_owner_email_columns.sql makes those queries
-- fail and the photo strips go empty.
--
-- This function reads the JSON as the owner and returns only the image
-- and three caption fields. A value that contains @ is dropped, so an
-- email stored in a caption does not come back.
--
-- Safe to apply before or after the email-column grants. It does not
-- change those grants. Do not apply this file to production from an
-- agent session. Deploy the frontend in this pull request first.

create or replace function public.public_gecko_photos(
  p_kind text,
  p_query text default null,
  p_limit integer default 24
)
returns table (
  image_url text,
  primary_morph text,
  created_date timestamptz,
  photo_credit text,
  gecko_name text,
  award text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.image_url,
    g.primary_morph,
    g.created_date,
    case
      when position('@' in coalesce(g.training_meta->>'photo_credit', '')) > 0 then null
      else nullif(btrim(g.training_meta->>'photo_credit'), '')
    end,
    case
      when position('@' in coalesce(g.training_meta->>'gecko_name', '')) > 0 then null
      else nullif(btrim(g.training_meta->>'gecko_name'), '')
    end,
    case
      when position('@' in coalesce(g.training_meta->>'award', '')) > 0 then null
      else nullif(btrim(g.training_meta->>'award'), '')
    end
  from public.gecko_images g
  where g.image_url is not null
    and coalesce(g.moderation_hidden, false) = false
    and (
      (
        p_kind = 'hero'
        and g.verified is true
        and g.primary_morph is not null
        and g.training_meta->>'verification_tier' = 'hero_anchor'
      )
      or (
        p_kind = 'search'
        and nullif(btrim(coalesce(p_query, '')), '') is not null
        and g.primary_morph ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
      )
    )
  order by g.created_date desc nulls last
  limit least(greatest(coalesce(p_limit, 24), 1), 200);
$$;

revoke all on function public.public_gecko_photos(text, text, integer) from public;
revoke all on function public.public_gecko_photos(text, text, integer) from anon;
revoke all on function public.public_gecko_photos(text, text, integer) from authenticated;
grant execute on function public.public_gecko_photos(text, text, integer) to anon, authenticated, service_role;

comment on function public.public_gecko_photos(text, text, integer) is
  'Morph Guide and project line photos. Returns image and caption text only. Drops any caption that looks like an email. Does not return training_meta.';
