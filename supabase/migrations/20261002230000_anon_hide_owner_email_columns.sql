-- Owner emails off public gecko rows, step 2 of 2. NOT YET APPLIED.
--
-- BREAKING for any client that still reads geckos or gecko_images with
-- `select *` while signed out: Postgres refuses the whole query once a
-- column in it is not granted. Apply this only after the client that reads
-- explicit column lists (src/lib/publicColumns.js) is live in production.
-- Step 1 is 20261002220914_owner_profile_id_for_public_rows.sql.
--
-- After this, a signed-out visitor can read every column of a public gecko
-- or a gecko photo except:
--   geckos.created_by          (the owner's email)
--   gecko_images.created_by    (the uploader's email)
--   gecko_images.user_id       (some rows hold an email here too)
--   gecko_images.image_embedding (large, and no public page uses it)
-- Signed-in members keep full access; their row rules are unchanged.
-- Columns added to these tables later are not readable when signed out
-- until they are granted here and listed in src/lib/publicColumns.js.
--
-- The column lists below must match src/lib/publicColumns.js. A unit test
-- (src/lib/__tests__/publicColumns.test.js) checks that they do.

revoke select on public.geckos from anon;
revoke select (created_by) on public.geckos from anon;
grant select (
  id, name, species, hatch_date, sex, sire_id, dam_id,
  sire_name, dam_name, morphs_traits, morph_tags, notes, status,
  image_urls, gecko_id_code, display_order, asking_price,
  weight_grams, market_price_estimate, morphmarket_id, morphmarket_url,
  palm_street_id, palm_street_url, marketplace_description, is_public,
  gallery_display, image_crop_data, incubation_days, archived,
  archived_date, archive_reason, feeding_group_id, is_gravid,
  gravid_since, egg_drop_date, created_date, updated_date,
  passport_code, pattern_grade, genetics_notes, breeder_name,
  breeder_user_id, hatch_facility, listing_price, estimated_hatch_year,
  collection_id, quality_score, last_meaningful_change_at, tail_status,
  growth_slideshow_enabled, sold_price, sale_category, owner_profile_id
) on public.geckos to anon;

revoke select on public.gecko_images from anon;
revoke select (created_by, user_id, image_embedding) on public.gecko_images from anon;
grant select (
  id, image_url, perceptual_hash, primary_morph, secondary_morph,
  secondary_traits, base_color, pattern_intensity, white_amount,
  confidence_score, notes, verified, age_estimate, fired_state,
  annotations, created_date, updated_date, training_meta,
  embedding_model, embedding_date, embedding_status,
  embedding_attempts, embedding_error, owner_profile_id
) on public.gecko_images to anon;
