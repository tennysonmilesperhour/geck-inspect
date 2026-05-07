-- =============================================================================
-- testimonials — public-facing user quotes shown on the landing page
-- =============================================================================
-- Admin-curated quotes from real users that get rendered on / when at
-- least N approved entries exist. Only `approved = true` rows are
-- returned to the public; everything else is admin-only. Ordering on
-- the landing page is by `sort_order ASC, created_at DESC`.
--
-- Deliberately NO user-submission flow yet — testimonials must be
-- entered by an admin to avoid spam/fake reviews. A later phase can
-- add a "submit your story" form that creates rows with approved=false.
-- =============================================================================

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  author_name text not null,
  author_role text,                       -- e.g. "Crested gecko breeder, 6 years"
  author_handle text,                     -- e.g. Instagram handle, with or without @
  author_url text,                        -- optional link to author's profile
  avatar_url text,                        -- optional image URL
  approved boolean not null default false,
  sort_order int not null default 100,    -- lower = earlier in list
  source_note text,                       -- internal: how we got the quote (DM, email, etc)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null
);

create index if not exists testimonials_approved_idx
  on public.testimonials(approved, sort_order, created_at desc)
  where approved = true;

alter table public.testimonials enable row level security;

-- Public read: anyone (anon + authed) can read approved rows. Used by
-- the <Testimonials/> component on the landing page.
drop policy if exists "Approved testimonials are public" on public.testimonials;
create policy "Approved testimonials are public"
  on public.testimonials
  for select
  using (approved = true);

-- Admin read: admins see everything (pending + rejected + approved).
-- Note: profiles.id is text in this schema, so admin checks use the
-- canonical `p.email = auth.email()` pattern that every other admin
-- policy in the database uses.
drop policy if exists "Admins read all testimonials" on public.testimonials;
create policy "Admins read all testimonials"
  on public.testimonials
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.email = auth.email() and p.role = 'admin'
    )
  );

-- Admin write: insert/update/delete restricted to admins.
drop policy if exists "Admins write testimonials" on public.testimonials;
create policy "Admins write testimonials"
  on public.testimonials
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.email = auth.email() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.email = auth.email() and p.role = 'admin'
    )
  );

-- Touch updated_at automatically, matching the convention used by
-- other admin-managed tables in this schema (app_settings, blog_posts).
create or replace function public.set_testimonials_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists testimonials_set_updated_at on public.testimonials;
create trigger testimonials_set_updated_at
  before update on public.testimonials
  for each row
  execute function public.set_testimonials_updated_at();
