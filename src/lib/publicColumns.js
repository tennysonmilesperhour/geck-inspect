/**
 * Columns a signed-out visitor may read from geckos and gecko_images.
 *
 * created_by on both tables holds the owner's email address, so it is left
 * out, along with gecko_images.user_id (some rows hold an email there too)
 * and the image embedding (large, and no public page uses it). Pages that
 * need to say who owns a row use owner_profile_id, which the database keeps
 * in step with created_by, and look the name up with read_profiles.
 *
 * The database migration
 * supabase/migrations/20261002230000_anon_hide_owner_email_columns.sql
 * grants the anon role exactly these columns. Once it is applied, a
 * signed-out `select *` on these tables fails, so every signed-out read must
 * use these lists. A test keeps the two in step.
 */

export const GECKO_PUBLIC_COLUMNS = [
  'id', 'name', 'species', 'hatch_date', 'sex', 'sire_id', 'dam_id',
  'sire_name', 'dam_name', 'morphs_traits', 'morph_tags', 'notes', 'status',
  'image_urls', 'gecko_id_code', 'display_order', 'asking_price',
  'weight_grams', 'market_price_estimate', 'morphmarket_id', 'morphmarket_url',
  'palm_street_id', 'palm_street_url', 'marketplace_description', 'is_public',
  'gallery_display', 'image_crop_data', 'incubation_days', 'archived',
  'archived_date', 'archive_reason', 'feeding_group_id', 'is_gravid',
  'gravid_since', 'egg_drop_date', 'created_date', 'updated_date',
  'passport_code', 'pattern_grade', 'genetics_notes', 'breeder_name',
  'breeder_user_id', 'hatch_facility', 'listing_price', 'estimated_hatch_year',
  'collection_id', 'quality_score', 'last_meaningful_change_at', 'tail_status',
  'growth_slideshow_enabled', 'sold_price', 'sale_category', 'owner_profile_id',
];

export const GECKO_IMAGE_PUBLIC_COLUMNS = [
  'id', 'image_url', 'perceptual_hash', 'primary_morph', 'secondary_morph',
  'secondary_traits', 'base_color', 'pattern_intensity', 'white_amount',
  'confidence_score', 'notes', 'verified', 'age_estimate', 'fired_state',
  'annotations', 'created_date', 'updated_date', 'training_meta',
  'embedding_model', 'embedding_date', 'embedding_status',
  'embedding_attempts', 'embedding_error', 'owner_profile_id',
];

/** Signed-out column lists by entity name (see supabaseEntities.js). */
export const PUBLIC_READ_COLUMNS = {
  Gecko: GECKO_PUBLIC_COLUMNS.join(','),
  GeckoImage: GECKO_IMAGE_PUBLIC_COLUMNS.join(','),
};

/** The select list for a geckos read: everything when signed in, the public columns otherwise. */
export function geckoSelect(signedIn) {
  return signedIn ? '*' : PUBLIC_READ_COLUMNS.Gecko;
}
