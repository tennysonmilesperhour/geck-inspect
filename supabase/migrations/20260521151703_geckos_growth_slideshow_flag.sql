-- Per-gecko toggle for the Growth Slideshow on the detail view.
--
-- When true, the gecko detail modal renders a tagged-life-stage
-- slideshow built from photos the keeper has tagged
-- (hatchling / 3mo / 6mo / 1yr / 2yr / adult) via
-- image_crop_data[url].life_stage. Defaults false so existing
-- geckos stay in the "single primary photo" view until the
-- keeper opts in. Edit form exposes the toggle.

ALTER TABLE IF EXISTS public.geckos
  ADD COLUMN IF NOT EXISTS growth_slideshow_enabled BOOLEAN NOT NULL DEFAULT false;
