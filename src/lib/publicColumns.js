/**
 * Columns a signed-out visitor may read.
 *
 * geckos and gecko_images: created_by on both tables holds the owner's
 * email address, so it is left out, along with gecko_images.user_id (some
 * rows hold an email there too), gecko_images.training_meta (the
 * reviewer's email sits inside it) and the image embedding (large, and no
 * public page uses it). Pages that need to say who owns a row use
 * owner_profile_id, which the database keeps in step with created_by, and
 * look the name up with read_profiles.
 *
 * The database migration
 * supabase/migrations/20261002235000_anon_hide_owner_email_columns.sql
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
  'annotations', 'created_date', 'updated_date',
  'embedding_model', 'embedding_date', 'embedding_status',
  'embedding_attempts', 'embedding_error', 'owner_profile_id',
];

// The same rule for the other tables signed-out pages read. Each list is
// every column except the ones that hold an email address (created_by,
// owner_email, user_email, uploader_email). Pages that need to say who
// wrote a forum post or owns a store page use owner_profile_id.
// The grants live in
// supabase/migrations/20261003120000_anon_hide_email_columns_more.sql.

export const FORUM_POST_PUBLIC_COLUMNS = [
  'id', 'title', 'content', 'category_id', 'author_name', 'image_urls',
  'is_pinned', 'is_locked', 'view_count', 'created_date', 'updated_date',
  'owner_profile_id',
];

export const FORUM_COMMENT_PUBLIC_COLUMNS = [
  'id', 'post_id', 'content', 'author_name', 'image_urls', 'parent_comment_id',
  'created_date', 'updated_date', 'owner_profile_id',
];

/** Likes: signed-out visitors see the counts, never who liked. */
export const FORUM_LIKE_PUBLIC_COLUMNS = [
  'id', 'target_id', 'target_type', 'created_date', 'updated_date',
];

export const FORUM_CATEGORY_PUBLIC_COLUMNS = [
  'id', 'name', 'description', 'order_position', 'is_active', 'created_date',
  'updated_date',
];

export const CARE_GUIDE_SECTION_PUBLIC_COLUMNS = [
  'id', 'title', 'content', 'order_position', 'category', 'image_urls',
  'is_published', 'source_url', 'last_updated', 'created_date', 'updated_date',
];

export const MORPH_GUIDE_PUBLIC_COLUMNS = [
  'id', 'morph_name', 'description', 'key_features', 'example_image_url',
  'rarity', 'breeding_info', 'created_date', 'updated_date',
];

export const PAGE_CONFIG_PUBLIC_COLUMNS = [
  'id', 'page_name', 'display_name', 'category', 'icon', 'is_enabled',
  'requires_auth', 'order_position', 'created_date', 'updated_date', 'section',
];

/**
 * Gecko of the Day. Nobody needs the uploader's email here, signed in or
 * not: the Dashboard finds the uploader from the photo's owner_profile_id.
 * Members get this list too (see EVERYONE_READ_COLUMNS).
 */
export const GECKO_OF_THE_DAY_COLUMNS = [
  'id', 'date', 'gecko_image_id', 'appreciative_message', 'created_date',
  'updated_date',
];

export const BREEDER_STORE_PAGE_PUBLIC_COLUMNS = [
  'id', 'slug', 'title', 'tagline', 'description', 'header_image_url',
  'contact_link', 'secondary_link', 'is_published', 'created_date',
  'updated_date', 'policies', 'external_links', 'featured_gecko_ids',
  'featured_breeding_plan_ids', 'slug_changed_at', 'slug_change_count',
  'owner_profile_id',
];

export const BREEDING_PLAN_PUBLIC_COLUMNS = [
  'id', 'sire_id', 'dam_id', 'breeding_id', 'pairing_date', 'copulation_events',
  'egg_check_day', 'egg_check_count', 'first_egg_lay_date',
  'expected_lay_interval', 'laying_active', 'dormant_since', 'status', 'notes',
  'archived', 'archived_date', 'breeding_season', 'is_public', 'created_date',
  'updated_date',
];

// Care records on a public passport. The passport page reads these lists
// for everyone, signed in or not, since it never needs the owner's email.

/** Matches the anon grant in 20261003004122_passport_transfers_lineage.sql. */
export const WEIGHT_RECORD_PUBLIC_COLUMNS = [
  'id', 'gecko_id', 'weight_grams', 'record_date', 'notes', 'created_date',
  'updated_date',
];

export const FEEDING_RECORD_PUBLIC_COLUMNS = [
  'id', 'animal_id', 'date', 'food_type', 'accepted', 'notes',
  'created_date', 'updated_date',
];

export const SHED_RECORD_PUBLIC_COLUMNS = [
  'id', 'animal_id', 'date', 'quality', 'notes', 'created_date',
  'updated_date',
];

export const VET_RECORD_PUBLIC_COLUMNS = [
  'id', 'animal_id', 'date', 'vet_name', 'reason', 'findings', 'treatment',
  'follow_up', 'attachments', 'created_date', 'updated_date',
];

export const OWNERSHIP_RECORD_PUBLIC_COLUMNS = [
  'id', 'animal_id', 'owner_user_id', 'owner_name', 'owner_avatar_url',
  'acquired_date', 'transfer_method', 'sale_price', 'contributed_to_market_data',
  'notes', 'created_date', 'updated_date',
];

/**
 * Tables signed-out visitors cannot read at all once
 * 20261003120000_anon_hide_email_columns_more.sql is applied. No signed-out
 * page reads them; a test checks that none of them has a public list.
 */
export const NO_ANON_READ_TABLES = [
  'user_activity', 'gecko_likes', 'questions', 'answers', 'morph_traits',
  'morph_price_cache',
];

/** Signed-out column lists by entity name (see supabaseEntities.js). */
export const PUBLIC_READ_COLUMNS = {
  Gecko: GECKO_PUBLIC_COLUMNS.join(','),
  GeckoImage: GECKO_IMAGE_PUBLIC_COLUMNS.join(','),
  ForumPost: FORUM_POST_PUBLIC_COLUMNS.join(','),
  ForumComment: FORUM_COMMENT_PUBLIC_COLUMNS.join(','),
  ForumLike: FORUM_LIKE_PUBLIC_COLUMNS.join(','),
  ForumCategory: FORUM_CATEGORY_PUBLIC_COLUMNS.join(','),
  CareGuideSection: CARE_GUIDE_SECTION_PUBLIC_COLUMNS.join(','),
  MorphGuide: MORPH_GUIDE_PUBLIC_COLUMNS.join(','),
  PageConfig: PAGE_CONFIG_PUBLIC_COLUMNS.join(','),
  GeckoOfTheDay: GECKO_OF_THE_DAY_COLUMNS.join(','),
  BreederStorePage: BREEDER_STORE_PAGE_PUBLIC_COLUMNS.join(','),
  BreedingPlan: BREEDING_PLAN_PUBLIC_COLUMNS.join(','),
  WeightRecord: WEIGHT_RECORD_PUBLIC_COLUMNS.join(','),
  FeedingRecord: FEEDING_RECORD_PUBLIC_COLUMNS.join(','),
  ShedRecord: SHED_RECORD_PUBLIC_COLUMNS.join(','),
  VetRecord: VET_RECORD_PUBLIC_COLUMNS.join(','),
  OwnershipRecord: OWNERSHIP_RECORD_PUBLIC_COLUMNS.join(','),
};

/**
 * Entities read with the explicit list even when signed in, because
 * members lose the email columns too (the database grants match).
 */
export const EVERYONE_READ_COLUMNS = {
  GeckoOfTheDay: GECKO_OF_THE_DAY_COLUMNS.join(','),
};

/** The select list for a geckos read: everything when signed in, the public columns otherwise. */
export function geckoSelect(signedIn) {
  return signedIn ? '*' : PUBLIC_READ_COLUMNS.Gecko;
}

/** A stored name, or the fallback when it is empty or looks like an email address. */
export function nameWithoutEmail(name, fallback = 'Geck Inspect keeper') {
  const trimmed = String(name ?? '').trim();
  if (!trimmed || trimmed.includes('@')) return fallback;
  return trimmed;
}

/** A display name for a profile that never falls back to an email address. */
export function publicDisplayName(profile, fallback = 'Geck Inspect keeper') {
  return nameWithoutEmail(
    profile?.full_name || profile?.business_name || profile?.breeder_name,
    fallback,
  );
}
