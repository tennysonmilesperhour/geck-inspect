-- =============================================================================
-- profiles.favorite_page_names
-- =============================================================================
-- Stores up to 4 page_name values that the user has pinned as favorites in
-- Settings. The sidebar renders these as a 2x2 grid of larger buttons above
-- the normal nav sections, and they are hidden from their original category
-- so they don't appear twice.
--
-- Enforcement of the 4-item cap lives in the UI (Settings.jsx) and in
-- Layout.jsx (which slice(0, 4)s defensively). The column stays an
-- unconstrained text[] so future tiers can raise the cap without another
-- migration.
-- =============================================================================

alter table public.profiles
  add column if not exists favorite_page_names text[]
    default array[]::text[];

update public.profiles
   set favorite_page_names = array[]::text[]
 where favorite_page_names is null;

comment on column public.profiles.favorite_page_names is
  'Ordered list of PageConfig.page_name values pinned to the top of the sidebar as a 2x2 grid. UI caps at 4 entries.';
