-- Owner emails off signed-out pages, part 2, step 1 of 2 (additive, safe
-- for the client that is live today).
--
-- A scan as the signed-out (anon) role on 3 Oct 2026 found email addresses
-- in forum posts, forum comments, store pages and more. Step 2
-- (20261003220200_anon_hide_email_columns_more.sql, applied only after the
-- new client is deployed) takes those columns away from signed-out
-- visitors. Before that can happen, signed-out pages need another way to
-- say who wrote a post or owns a store page:
--
-- 1. owner_profile_id on forum_posts and forum_comments, kept in step with
--    created_by by the same trigger function geckos already use.
-- 2. owner_profile_id on breeder_store_pages, kept in step with
--    owner_email by a small trigger function of its own.
-- 3. welcome_shelf() stops returning email addresses to signed-out
--    callers and never builds a name out of an email. Signed-in callers
--    still get the email key for now, because the live client follows a
--    keeper by email. Step 2 removes it for everyone.

alter table public.forum_posts add column if not exists owner_profile_id text;
alter table public.forum_comments add column if not exists owner_profile_id text;
alter table public.breeder_store_pages add column if not exists owner_profile_id text;

create or replace trigger forum_posts_set_owner_profile_id
  before insert or update on public.forum_posts
  for each row execute function public.set_owner_profile_id();

create or replace trigger forum_comments_set_owner_profile_id
  before insert or update on public.forum_comments
  for each row execute function public.set_owner_profile_id();

create or replace function public.set_store_owner_profile_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.owner_profile_id := (
    select p.id from public.profiles p where p.email = new.owner_email
  );
  return new;
end;
$$;

revoke all on function public.set_store_owner_profile_id() from public, anon, authenticated;

create or replace trigger breeder_store_pages_set_owner_profile_id
  before insert or update on public.breeder_store_pages
  for each row execute function public.set_store_owner_profile_id();

-- Backfill.
update public.forum_posts f
   set owner_profile_id = p.id
  from public.profiles p
 where p.email = f.created_by
   and f.owner_profile_id is distinct from p.id;

update public.forum_comments f
   set owner_profile_id = p.id
  from public.profiles p
 where p.email = f.created_by
   and f.owner_profile_id is distinct from p.id;

update public.breeder_store_pages s
   set owner_profile_id = p.id
  from public.profiles p
 where p.email = s.owner_email
   and s.owner_profile_id is distinct from p.id;

create index if not exists forum_posts_owner_profile_id_idx on public.forum_posts (owner_profile_id);
create index if not exists forum_comments_owner_profile_id_idx on public.forum_comments (owner_profile_id);
create index if not exists breeder_store_pages_owner_profile_id_idx on public.breeder_store_pages (owner_profile_id);

-- New keepers rail. Signed-out callers get no email key, and a keeper with
-- no name shows as "Geck Inspect keeper" for everyone (it used to show the
-- first half of their email address).
create or replace function public.welcome_shelf(p_limit integer default 6)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
SELECT coalesce(json_agg(
  CASE WHEN auth.uid() IS NOT NULL THEN to_jsonb(rows)
       ELSE to_jsonb(rows) - 'email' END
  ORDER BY rows.created_date DESC), '[]'::json)
FROM (
  SELECT
    p.id::text AS id,
    p.email,
    coalesce(nullif(p.full_name, ''), nullif(p.business_name, ''), 'Geck Inspect keeper') AS display_name,
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
