-- Launch hardening, round two (2026-09-04).
--
--   1. Indexes on the legacy core tables. notifications and direct_messages
--      are polled by every open tab every 60 seconds and had only primary
--      keys; geckos, gecko_images, weight_records, eggs, breeding_plans and
--      forum_posts are filtered by created_by on every collection page.
--
--   2. notifications: any signed-in user could insert a notification for
--      any other user with created_by NULL and an arbitrary external link,
--      and the dispatcher would email and push it from the official sender.
--      Inserts from regular users are now attributed to the caller,
--      external links are replaced with '/', and content is capped. Admins
--      and the service role are unaffected.
--
--   3. community_gecko_counts(): per-breeder counts and a cover image over
--      public, non-archived geckos, so the Dashboard and Community pages
--      stop downloading the entire geckos table to do a GROUP BY in the
--      browser (and stop being silently wrong past PostgREST's 1,000 row
--      cap).
--
-- Idempotent; safe to re-apply.

-- ---------------------------------------------------------------------
-- 1. Indexes
-- ---------------------------------------------------------------------
create index if not exists notifications_user_email_is_read_idx on public.notifications (user_email, is_read);
create index if not exists notifications_created_date_idx on public.notifications (created_date desc);
create index if not exists direct_messages_recipient_is_read_idx on public.direct_messages (recipient_email, is_read);
create index if not exists direct_messages_sender_email_idx on public.direct_messages (sender_email);
create index if not exists geckos_created_by_idx on public.geckos (created_by);
create index if not exists geckos_sire_id_idx on public.geckos (sire_id);
create index if not exists geckos_dam_id_idx on public.geckos (dam_id);
create index if not exists gecko_images_created_by_idx on public.gecko_images (created_by);
create index if not exists gecko_images_created_date_idx on public.gecko_images (created_date desc);
create index if not exists weight_records_gecko_id_idx on public.weight_records (gecko_id);
create index if not exists weight_records_created_by_idx on public.weight_records (created_by);
create index if not exists eggs_breeding_plan_id_idx on public.eggs (breeding_plan_id);
create index if not exists eggs_created_by_idx on public.eggs (created_by);
create index if not exists breeding_plans_created_by_idx on public.breeding_plans (created_by);
create index if not exists forum_posts_created_by_idx on public.forum_posts (created_by);
create index if not exists forum_posts_created_date_idx on public.forum_posts (created_date desc);

-- ---------------------------------------------------------------------
-- 2. notifications: attribute user inserts, keep links on-site
-- ---------------------------------------------------------------------
create or replace function public.guard_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := auth.role();
  v_email text := auth.email();
  v_is_admin boolean := false;
begin
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;
  if v_email is not null then
    select exists (
      select 1 from public.profiles p
      where p.email = v_email and p.role = 'admin'
    ) into v_is_admin;
  end if;
  if v_is_admin then
    return new;
  end if;

  -- A regular user is always the author of what they insert.
  new.created_by := v_email;
  -- Only same-site links may ride along into email and push.
  if new.link is not null and new.link !~ '^/' then
    new.link := '/';
  end if;
  if new.content is not null and length(new.content) > 500 then
    new.content := left(new.content, 500);
  end if;
  return new;
end;
$$;

revoke all on function public.guard_notification_insert() from public;

drop trigger if exists notifications_guard_user_insert on public.notifications;
create trigger notifications_guard_user_insert
  before insert on public.notifications
  for each row execute function public.guard_notification_insert();

drop policy if exists notifications_insert_any_authed on public.notifications;
create policy notifications_insert_any_authed
  on public.notifications for insert
  to authenticated
  with check (
    auth.email() is not null
    and (
      created_by = auth.email()
      or exists (
        select 1 from public.profiles p
        where p.email = auth.email() and p.role = 'admin'
      )
    )
  );

-- ---------------------------------------------------------------------
-- 3. Per-breeder gecko counts for community surfaces
-- ---------------------------------------------------------------------
create or replace function public.community_gecko_counts()
returns table (
  created_by text,
  keeping integer,
  selling integer,
  breeding integer,
  cover_image text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    g.created_by,
    count(*) filter (where g.status is distinct from 'Sold')::int as keeping,
    count(*) filter (where g.status = 'For Sale')::int as selling,
    count(*) filter (where g.status in ('Ready to Breed', 'Proven', 'Future Breeder'))::int as breeding,
    (array_agg(g.image_urls ->> 0 order by g.created_date)
       filter (where jsonb_typeof(g.image_urls) = 'array' and jsonb_array_length(g.image_urls) > 0))[1] as cover_image
  from public.geckos g
  where g.created_by is not null
    and coalesce(g.is_public, true)
    and not coalesce(g.archived, false)
  group by g.created_by
$$;

grant execute on function public.community_gecko_counts() to anon, authenticated, service_role;
