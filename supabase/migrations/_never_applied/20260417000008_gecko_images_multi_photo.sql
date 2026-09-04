-- Multi-photo submissions.
--
-- A single contribution / recognition test can now include up to 5 photos
-- of the same gecko (different angles, fired states, close-ups). The
-- analysis is still one record per submission — the photos render as an
-- auto-advancing slideshow in /recognition and /training.
--
-- `image_url` stays as the "primary / cover" photo for backward compat with
-- every existing query (Gallery, MyGeckos, MorphDetail all read it). The new
-- `image_urls` array holds ALL photos, primary first. Code that was already
-- reading image_url keeps working.

ALTER TABLE IF EXISTS public.gecko_images
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- Backfill existing rows: if image_urls is empty but image_url is set,
-- synthesize a single-element array. Idempotent — only touches rows where
-- the array is still the default empty [].
UPDATE public.gecko_images
  SET image_urls = jsonb_build_array(image_url)
  WHERE image_url IS NOT NULL
    AND (image_urls IS NULL OR image_urls = '[]'::jsonb);
