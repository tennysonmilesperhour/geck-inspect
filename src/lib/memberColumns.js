/**
 * Columns a signed-in member reads on the tables where another member's
 * email address sits on the row.
 *
 * Step 1 of taking those addresses away from members (comprehensive
 * review, Part E item E1 4): the app reads these tables with named
 * columns, never `select *` and never the column that holds the author's
 * or owner's email. Step 2, supabase/pending/member_email_columns_revoke.sql,
 * then takes those columns from the authenticated role; once it is applied
 * a signed-in `select *` on these tables fails. "Mine" is found by
 * owner_profile_id, user_id or the database helpers in
 * supabase/migrations/20261028040000_member_email_reads.sql
 * (src/lib/memberReads.js).
 *
 * Each list is every column except the email ones (MEMBER_HIDDEN_COLUMNS,
 * the same set the pending file revokes), less a few columns members keep
 * but no page reads through these lists: the moderation columns other than
 * approval_status (moderation_hidden, approval_revision,
 * approval_hold_reason; the admin queue has its own function), and on
 * gecko_images image_embedding (large), training_meta (a reviewer's email
 * can sit inside it) and user_id (some rows hold an email). The expert
 * review queue reads the last two with its own list
 * (src/lib/reviewQueue.js).
 *
 * The entity layer builds the same lists from the signed-out lists
 * (memberReadColumns in src/api/supabaseEntities.js), because the startup
 * script has no room for these; a test keeps the two in step. Pages that
 * read one of these tables directly import the list they need from here.
 */
import {
  BREEDER_PROFILE_PUBLIC_COLUMNS,
  BREEDER_REVIEW_PUBLIC_COLUMNS,
  MORPH_PRICE_ENTRY_PUBLIC_COLUMNS,
} from '@/lib/publicColumns';

export const GECKO_IMAGE_MEMBER_COLUMNS = [
  'id', 'image_url', 'perceptual_hash', 'primary_morph', 'secondary_morph',
  'secondary_traits', 'base_color', 'pattern_intensity', 'white_amount',
  'confidence_score', 'notes', 'verified', 'age_estimate', 'fired_state',
  'annotations', 'created_date', 'updated_date', 'embedding_model',
  'embedding_date', 'embedding_status', 'embedding_attempts', 'embedding_error',
  'owner_profile_id', 'approval_status',
];

export const FORUM_POST_MEMBER_COLUMNS = [
  'id', 'title', 'content', 'category_id', 'author_name', 'image_urls',
  'is_pinned', 'is_locked', 'view_count', 'created_date', 'updated_date',
  'owner_profile_id', 'approval_status',
];

export const FORUM_COMMENT_MEMBER_COLUMNS = [
  'id', 'post_id', 'content', 'author_name', 'image_urls', 'parent_comment_id',
  'created_date', 'updated_date', 'owner_profile_id', 'approval_status',
];

/** Who liked is never read; counts and "liked by me" come from forum_like_state(). */
export const FORUM_LIKE_MEMBER_COLUMNS = [
  'id', 'target_id', 'target_type', 'created_date', 'updated_date',
];

export const MORPH_GUIDE_COMMENT_MEMBER_COLUMNS = [
  'id', 'morph_guide_id', 'user_name', 'subject', 'content', 'image_url',
  'status', 'rejection_reason', 'is_helpful', 'created_date', 'updated_date',
];

export const USER_BADGE_MEMBER_COLUMNS = [
  'id', 'badge_type', 'badge_name', 'badge_description', 'badge_icon',
  'requirements_met', 'rarity', 'created_date', 'updated_date',
];

export const GIVEAWAY_MEMBER_COLUMNS = [
  'id', 'gecko_id', 'title', 'description', 'entry_method',
  'entry_instructions', 'entry_url', 'prize_type', 'image_urls', 'end_date',
  'max_winners', 'status', 'created_date', 'updated_date',
];

/** Live Feed reactions, read only when the counting function is not there yet. */
export const COMMUNITY_EVENT_REACTION_MEMBER_COLUMNS = [
  'event_type', 'event_id', 'reaction', 'created_date',
];

/** The email columns step 2 takes from signed-in members, by table. */
export const MEMBER_HIDDEN_COLUMNS = {
  gecko_images: ['created_by'],
  forum_posts: ['created_by'],
  forum_comments: ['created_by'],
  forum_likes: ['user_email', 'created_by'],
  breeder_profiles: ['created_by'],
  breeder_reviews: ['created_by'],
  morph_guide_comments: ['user_email', 'created_by'],
  user_badges: ['user_email', 'created_by'],
  giveaways: ['winner_emails', 'created_by'],
  community_event_reactions: ['user_email'],
  morph_price_entries: ['created_by'],
};

/** Every list above, by table. */
export const MEMBER_COLUMNS_BY_TABLE = {
  gecko_images: GECKO_IMAGE_MEMBER_COLUMNS,
  forum_posts: FORUM_POST_MEMBER_COLUMNS,
  forum_comments: FORUM_COMMENT_MEMBER_COLUMNS,
  forum_likes: FORUM_LIKE_MEMBER_COLUMNS,
  breeder_profiles: BREEDER_PROFILE_PUBLIC_COLUMNS,
  breeder_reviews: BREEDER_REVIEW_PUBLIC_COLUMNS,
  morph_price_entries: MORPH_PRICE_ENTRY_PUBLIC_COLUMNS,
  morph_guide_comments: MORPH_GUIDE_COMMENT_MEMBER_COLUMNS,
  user_badges: USER_BADGE_MEMBER_COLUMNS,
  giveaways: GIVEAWAY_MEMBER_COLUMNS,
  community_event_reactions: COMMUNITY_EVENT_REACTION_MEMBER_COLUMNS,
};
