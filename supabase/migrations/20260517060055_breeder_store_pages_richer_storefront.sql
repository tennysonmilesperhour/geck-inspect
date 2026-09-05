-- Richer breeder storefronts: featured stock, policies, multi-link footer,
-- and slug change tracking so we can enforce a cooldown after the first
-- rename (so backlinks on MorphMarket, Instagram bios, etc. don't get
-- broken every other day).

ALTER TABLE public.breeder_store_pages
  ADD COLUMN IF NOT EXISTS policies text,
  ADD COLUMN IF NOT EXISTS external_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS featured_gecko_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS featured_breeding_plan_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS slug_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS slug_change_count integer NOT NULL DEFAULT 0;

-- external_links shape: [{ kind: text, label: text, url: text }]
-- Known kinds: morphmarket, palmstreet, instagram, tiktok, youtube,
-- facebook, twitter, website, other. Unknown kinds render as a generic
-- external link. Validation lives in the app, not the DB, so new kinds
-- can be added without a migration.
