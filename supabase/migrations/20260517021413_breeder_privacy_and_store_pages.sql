-- 1. Per-profile flag: show the Breeders tab on the public profile?
-- Defaults to true so existing behavior is preserved for everyone
-- except keepers who explicitly opt out.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_breeders_publicly boolean DEFAULT true;

-- 2. Custom store pages for Breeder / Enterprise tier members.
-- One page per keeper (owner_email is UNIQUE). Slug is the URL fragment
-- for /store/:slug. Pages are drafts until the owner flips
-- is_published, at which point they become world-readable.
CREATE TABLE IF NOT EXISTS public.breeder_store_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  tagline text,
  description text,
  header_image_url text,
  contact_link text,
  secondary_link text,
  is_published boolean NOT NULL DEFAULT false,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS breeder_store_pages_owner_email_idx
  ON public.breeder_store_pages (owner_email);
CREATE INDEX IF NOT EXISTS breeder_store_pages_slug_idx
  ON public.breeder_store_pages (slug);

ALTER TABLE public.breeder_store_pages ENABLE ROW LEVEL SECURITY;

-- Published pages are public; owners can always see their own draft.
DROP POLICY IF EXISTS breeder_store_pages_read ON public.breeder_store_pages;
CREATE POLICY breeder_store_pages_read ON public.breeder_store_pages
  FOR SELECT USING (is_published OR auth.email() = owner_email);

DROP POLICY IF EXISTS breeder_store_pages_insert_own ON public.breeder_store_pages;
CREATE POLICY breeder_store_pages_insert_own ON public.breeder_store_pages
  FOR INSERT WITH CHECK (auth.email() = owner_email);

DROP POLICY IF EXISTS breeder_store_pages_update_own ON public.breeder_store_pages;
CREATE POLICY breeder_store_pages_update_own ON public.breeder_store_pages
  FOR UPDATE USING (auth.email() = owner_email);

DROP POLICY IF EXISTS breeder_store_pages_delete_own ON public.breeder_store_pages;
CREATE POLICY breeder_store_pages_delete_own ON public.breeder_store_pages
  FOR DELETE USING (auth.email() = owner_email);

GRANT SELECT ON public.breeder_store_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.breeder_store_pages TO authenticated;
