/**
 * Supabase entity compatibility layer.
 * Backs `api.entities.*` (see appClient.js).
 *
 * API:
 *   Entity.filter(query, sort, limit, skip) → Array
 *   Entity.get(id) → Object
 *   Entity.create(data) → Object
 *   Entity.update(id, data) → Object
 *   Entity.delete(id) → Object
 */
import { supabase } from '@/lib/supabaseClient';
import { blockIfGuest, isGuestMode } from '@/lib/guestMode';
import {
  guestMockFilter,
  guestMockGet,
  guestMockList,
  isMockedEntity,
} from '@/lib/guestMockData';
import { PUBLIC_READ_COLUMNS, EVERYONE_READ_COLUMNS } from '@/lib/publicColumns';
import { noteEntityCreated } from '@/lib/activation';

/**
 * If a Supabase query fails with a JWT / auth error, try refreshing the
 * session once and re-run the query. This handles the common case where a
 * long-idle tab has an expired access token that Supabase's auto-refresh
 * hasn't replaced yet.
 */
async function withAuthRetry(queryFn) {
  const result = await queryFn();
  if (result.error && (result.error.code === 'PGRST301' || result.error.message?.includes('JWT'))) {
    const { error: refreshErr } = await supabase.auth.refreshSession();
    if (!refreshErr) return queryFn();
  }
  return result;
}

// Entities whose tables don't carry a `created_by` text column. The newer
// social_* tables track ownership via `created_by_user_id` / `user_id`
// instead; injecting `created_by` here would make PostgREST reject the
// insert with "Could not find the 'created_by' column ... in the schema
// cache". Add new entities here when you ship a table that doesn't follow
// the legacy `created_by` convention (see supabase/SCHEMA_CONVENTIONS.md).
export const ENTITIES_WITHOUT_CREATED_BY = new Set([
  'GeneticsTraitOverride',
  'SocialPost',
  'SocialPostVariant',
  'SocialPlatformConnection',
  'SocialPostUsage',
  'SocialGenerationLog',
  'UserBrandVoice',
  'SocialPostPhotoUsage',
  'SocialReferralBonus',
  'GeckoWaitlist',
  'GeckoWaitlistSignup',
  'PromoteImage',
  'BreederStorePage',
  'Collection',
  'CollectionMember',
  'Testimonial',
  'AppSettings',
  'GiveawayEntry',
  'StoreVendor',
  'StoreCategory',
  'StoreProduct',
  'StoreCart',
  'StoreCartItem',
  'StoreOrder',
  'StoreOrderItem',
  'StoreFulfillment',
  'StoreAffiliateClick',
  'StoreSignupGrant',
  'StorePromoCode',
]);

// The same problem for the timestamp columns: create() fills in
// created_date and updated_date, and update() fills in updated_date. These
// tables name them differently or leave one out, and the extra column made
// every insert fail. Until 29 Sep 2026 that meant creating a collection,
// inviting a collaborator, adding a testimonial and entering a giveaway had
// never once worked. Checked against production on 29 Sep 2026; a table not
// listed here has both created_date and updated_date.
// null = the table has no such column (the database default fills it).
export const TIMESTAMP_COLUMNS = {
  AppSettings: { created: null, updated: 'updated_at' },
  BlogLog: { created: 'created_date', updated: null },
  Collection: { created: null, updated: 'updated_at' },
  CollectionMember: { created: null, updated: null },
  GeckoWaitlistSignup: { created: null, updated: 'updated_date' },
  GiveawayEntry: { created: 'created_date', updated: null },
  QuestionVote: { created: 'created_date', updated: null },
  SocialGenerationLog: { created: 'created_date', updated: null },
  SocialPostPhotoUsage: { created: null, updated: null },
  SocialReferralBonus: { created: 'created_date', updated: null },
  StoreAffiliateClick: { created: 'created_date', updated: null },
  StoreOrderItem: { created: 'created_date', updated: null },
  StorePromoCode: { created: 'created_date', updated: null },
  StoreSignupGrant: { created: 'created_date', updated: null },
  Testimonial: { created: null, updated: 'updated_at' },
  UserEvent: { created: 'created_date', updated: null },
};

export function timestampColumns(entityName) {
  return TIMESTAMP_COLUMNS[entityName] || { created: 'created_date', updated: 'updated_date' };
}

// An empty date input gives '', and Postgres rejects '' for a date or
// timestamp, so the whole save failed: Project Manager could not create a
// project or task without a due date. Every column named date, *_date,
// *_date_* (hatch_date_actual), *_at, *_since or *_until is a date or
// timestamp (checked 29 Sep 2026), so a blank one is sent as null.
const DATE_COLUMN = /(^date$|_date$|_date_|_at$|_since$|_until$)/;

// Date columns whose names the pattern above misses (checked against
// production on 2 Oct 2026). follow_up is the vet visit's follow-up date:
// without it, saving a visit with no follow-up failed.
export const OTHER_DATE_COLUMNS = new Set([
  'follow_up',
  'loan_start',
  'expected_return',
  'actual_return',
  'planned_start',
  'planned_end',
  'last_updated',
  'deposit_paid_on',
  'refunded_on',
  'hatched_on',
  'event_timestamp',
  'last_triggered',
  'estimated_delivery',
]);

export function isDateColumn(key) {
  return DATE_COLUMN.test(key) || OTHER_DATE_COLUMNS.has(key);
}

export function blankDatesToNull(record) {
  const row = { ...record };
  for (const [key, value] of Object.entries(row)) {
    if (value === '' && isDateColumn(key)) row[key] = null;
  }
  return row;
}

/** The row create() sends: the caller's fields plus the audit columns the table has. */
export function buildInsertRecord(entityName, record, email, now) {
  const { created, updated } = timestampColumns(entityName);
  const row = blankDatesToNull(record);
  if (created) row[created] = record[created] || now;
  if (updated) row[updated] = now;
  if (!ENTITIES_WITHOUT_CREATED_BY.has(entityName)) row.created_by = email;
  return row;
}

/** The patch update() sends: defined fields plus the table's updated column. */
export function buildUpdateRecord(entityName, record, now) {
  const { updated } = timestampColumns(entityName);
  const row = blankDatesToNull(Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)));
  if (updated) row[updated] = now;
  return row;
}

export const TABLE_MAP = {
  AppSettings: 'app_settings',
  BreederStorePage: 'breeder_store_pages',
  BreedingPlan: 'breeding_plans',
  CareGuideSection: 'care_guide_sections',
  ChangeLog: 'change_logs',
  ClassificationVote: 'classification_votes',
  DirectMessage: 'direct_messages',
  Egg: 'eggs',
  ExpertAction: 'expert_actions',
  ExpertVerificationRequest: 'expert_verification_requests',
  FeedingGroup: 'feeding_groups',
  ForumCategory: 'forum_categories',
  ForumComment: 'forum_comments',
  ForumLike: 'forum_likes',
  ForumPost: 'forum_posts',
  FutureBreedingPlan: 'future_breeding_plans',
  Gecko: 'geckos',
  GeckoEvent: 'gecko_events',
  GeckoImage: 'gecko_images',
  GeckoLike: 'gecko_likes',
  GeckoOfTheDay: 'gecko_of_the_day',
  Giveaway: 'giveaways',
  GiveawayEntry: 'giveaway_entries',
  LineagePlaceholder: 'lineage_placeholders',
  MarketplaceCost: 'marketplace_costs',
  MarketplaceLike: 'marketplace_likes',
  MorphGuide: 'morph_guides',
  MorphGuideComment: 'morph_guide_comments',
  MorphPriceCache: 'morph_price_cache',
  MorphReferenceImage: 'morph_reference_images',
  MorphTrait: 'morph_traits',
  Notification: 'notifications',
  OtherReptile: 'other_reptiles',
  PageConfig: 'page_config',
  PaymentEvent: 'payment_events',
  Project: 'projects',
  ReptileEvent: 'reptile_events',
  ScrapedTrainingData: 'scraped_training_data',
  StripeWebhookLog: 'stripe_webhook_logs',
  SupportMessage: 'support_messages',
  ErrorLog: 'error_logs',
  UserEvent: 'user_events',
  Task: 'tasks',
  UserActivity: 'user_activity',
  UserBadge: 'user_badges',
  UserFollow: 'user_follows',
  WeightRecord: 'weight_records',
  User: 'profiles',

  // P1, Animal Passport + Ownership Transfer
  OwnershipRecord: 'ownership_records',
  ShedRecord: 'shed_records',
  VetRecord: 'vet_records',
  TransferRequest: 'transfer_requests',
  FeedingRecord: 'feeding_records',
  // P2, Market Pricing Intelligence
  MorphPriceEntry: 'morph_price_entries',
  PriceAlert: 'price_alerts',
  CollectionValuation: 'collection_valuations',
  // P3, Breeding ROI Dashboard
  BreedingProject: 'breeding_projects',
  GeneticOutcomePrediction: 'genetic_outcome_predictions',
  Clutch: 'clutches',
  // P4, Breeding Loan Management
  BreedingLoan: 'breeding_loans',
  // P5, Geck Answers
  Question: 'questions',
  Answer: 'answers',
  QuestionVote: 'question_votes',
  // P8, Breeder Storefront
  BreederProfile: 'breeder_profiles',
  BreederReview: 'breeder_reviews',
  // Shipping, Zero's Geckos integration
  ShippingOrder: 'shipping_orders',
  // Pending Sales, reserve price system
  PendingSale: 'pending_sales',
  // Blog system
  BlogSettings: 'blog_settings',
  BlogPost: 'blog_posts',
  BlogCategory: 'blog_categories',
  BlogTag: 'blog_tags',
  BlogLog: 'blog_logs',
  // Store, supplies, gifts, merch, affiliate
  StoreVendor: 'store_vendors',
  StoreCategory: 'store_categories',
  StoreProduct: 'store_products',
  StoreCart: 'store_carts',
  StoreCartItem: 'store_cart_items',
  StoreOrder: 'store_orders',
  StoreOrderItem: 'store_order_items',
  StoreFulfillment: 'store_fulfillments',
  StoreAffiliateClick: 'store_affiliate_clicks',
  StoreSignupGrant: 'store_signup_grants',
  StorePromoCode: 'store_promo_codes',
  // Landing page testimonials, admin curated, public-readable when approved
  Testimonial: 'testimonials',
  // Multi-user collaboration: per-collection ownership and shared access
  Collection: 'collections',
  CollectionMember: 'collection_members',
  // Social Media Manager (Promote)
  SocialPost: 'social_posts',
  SocialPostVariant: 'social_post_variants',
  SocialPlatformConnection: 'social_platform_connections',
  SocialPostUsage: 'social_post_usage',
  SocialGenerationLog: 'social_generation_log',
  UserBrandVoice: 'user_brand_voice',
  SocialPostPhotoUsage: 'social_post_photo_usage',
  SocialReferralBonus: 'social_referral_bonuses',
  // Per-gecko waitlists, public-link signups
  GeckoWaitlist: 'gecko_waitlists',
  GeckoWaitlistSignup: 'gecko_waitlist_signups',
  // Promote-only image library (separate from gecko_images)
  PromoteImage: 'promote_images',
  // Genetics calculator: predicted-vs-actual clutch logging (the
  // outcomes flywheel) and the runtime trait-override store.
  PairingOutcomeLog: 'pairing_outcome_logs',
  GeneticsTraitOverride: 'genetics_trait_overrides',
};

// Most tables follow the legacy `created_date` column convention, which
// is the default sort (see supabase/SCHEMA_CONVENTIONS.md). A few tables predate or postdate
// that convention and use `created_at`, and a few have no timestamp
// column at all. Verified against production 2026-07-07. Entities not
// listed here default to 'created_date'; `null` means "this table has no
// timestamp column, so do not apply a default sort."
//
// Without this map, a bare `.list()` / `.filter({})` on these tables
// issued `order('created_date')`, which PostgREST rejects with a 400
// ("column ... does not exist"). Several call sites wrap that in
// `.catch(() => [])`, so the failure was silent: Collection and
// CollectionMember queries returned empty, quietly breaking shared
// collection access.
const ENTITY_SORT_COLUMN = {
  Collection: 'created_at',
  Testimonial: 'created_at',
  AppSettings: null,
  CollectionMember: null,
  SocialPostPhotoUsage: null,
};

function defaultSortColumn(entityName) {
  return entityName in ENTITY_SORT_COLUMN
    ? ENTITY_SORT_COLUMN[entityName]
    : 'created_date';
}

export function parseSort(sort, entityName) {
  const tsColumn = defaultSortColumn(entityName);
  if (!sort) {
    // No sort requested: order by the table's timestamp column, or don't
    // order at all when the table has none.
    return tsColumn ? [{ column: tsColumn, ascending: false }] : [];
  }
  // Support comma-separated sorts: "-created_date,name". Remap a
  // 'created_date' request to the table's actual timestamp column so a
  // caller passing the legacy default can't 400 a created_at-only table;
  // drop it entirely for tables with no timestamp column.
  return sort.split(',').map(s => {
    s = s.trim();
    let ascending = true;
    if (s.startsWith('-')) { ascending = false; s = s.slice(1); }
    if (s === 'created_date' && tsColumn !== 'created_date') {
      if (!tsColumn) return null;
      s = tsColumn;
    }
    return { column: s, ascending };
  }).filter(Boolean);
}

function applyFilter(query, filterObj) {
  if (!filterObj || typeof filterObj !== 'object') return query;
  for (const [key, value] of Object.entries(filterObj)) {
    if (key === '$or') {
      // Build OR string for Supabase .or()
      const parts = value.map(clause => {
        const [[k, v]] = Object.entries(clause);
        if (v === null || v === undefined) return `${k}.is.null`;
        if (typeof v === 'boolean') return `${k}.is.${v}`;
        // For strings, use eq
        return `${k}.eq.${v}`;
      });
      query = query.or(parts.join(','));
    } else if (value === null || value === undefined) {
      query = query.is(key, null);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle operators like { $gt: 5 }
      for (const [op, opVal] of Object.entries(value)) {
        if (op === '$gt') query = query.gt(key, opVal);
        else if (op === '$gte') query = query.gte(key, opVal);
        else if (op === '$lt') query = query.lt(key, opVal);
        else if (op === '$lte') query = query.lte(key, opVal);
        else if (op === '$ne') {
          // `{ $ne: null }` must mean "IS NOT NULL", not "neq null"
          // (PostgREST `neq.null` excludes NULL rows because NULL != NULL
          // is unknown). Route null specifically through `.not('is', null)`.
          if (opVal === null) query = query.not(key, 'is', null);
          else query = query.neq(key, opVal);
        }
        else if (op === '$in') query = query.in(key, opVal);
      }
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

/**
 * The select list for a read. Signed-out visitors get an explicit column
 * list on tables whose rows carry the owner's email (see publicColumns.js);
 * everyone else gets every column, except on the few tables where members
 * lose the email columns too.
 */
export async function readColumns(entityName) {
  if (EVERYONE_READ_COLUMNS[entityName]) return EVERYONE_READ_COLUMNS[entityName];
  const publicColumns = PUBLIC_READ_COLUMNS[entityName];
  if (!publicColumns) return '*';
  const { data } = await supabase.auth.getSession();
  return data?.session ? '*' : publicColumns;
}

function createEntityClient(entityName) {
  const tableName = TABLE_MAP[entityName];
  if (!tableName) {
    console.warn(`[supabaseEntities] No table mapping for entity: ${entityName}`);
  }

  return {
    async filter(filterObj = {}, sort = null, limit = null, skip = null) {
      // In guest mode, serve mocks for any entity we have mocks for and
      // empty arrays for anything else. This avoids making anonymous
      // calls to tables that would hit RLS and flood the console with
      // 401s while the user is just browsing.
      if (isGuestMode() && entityName !== 'PageConfig') {
        if (isMockedEntity(entityName)) {
          return guestMockFilter(entityName, filterObj, sort, limit, skip);
        }
        return [];
      }

      const columns = await readColumns(entityName);
      const run = () => {
        const emailFilter = filterObj?.email;
        const emails = typeof emailFilter === 'string' ? [emailFilter] : emailFilter?.$in || null;
        let query = entityName === 'User'
          ? supabase.rpc('read_profiles', { p_emails: emails }).select('*')
          : supabase.from(tableName).select(columns);
        query = applyFilter(query, filterObj);

        const sorts = parseSort(sort, entityName);
        for (const { column, ascending } of sorts) {
          query = query.order(column, { ascending, nullsFirst: false });
        }

        if (skip && limit) {
          query = query.range(skip, skip + limit - 1);
        } else if (limit) {
          query = query.limit(limit);
        }

        return query;
      };

      const { data, error } = await withAuthRetry(run);
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      if (isGuestMode()) {
        if (isMockedEntity(entityName)) return guestMockGet(entityName, id);
        return null;
      }
      const columns = await readColumns(entityName);
      const { data, error } = await withAuthRetry(() =>
        (entityName === 'User' ? supabase.rpc('read_profiles') : supabase.from(tableName)).select(columns).eq('id', id).maybeSingle()
      );
      if (error) throw error;
      return data;
    },

    async create(record) {
      blockIfGuest('save changes');
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || null;
      const insertRecord = buildInsertRecord(entityName, record, email, new Date().toISOString());

      // insert().select() needs the new row to pass the table's read rule,
      // and Postgres rejects the whole insert when it doesn't. Some writes
      // are for someone else: a notification for another member (new
      // message, reply, follower), an admin broadcast from the system
      // sender, a support message from a signed-out visitor. Those were all
      // failing, so no member ever got a message or reply notification.
      // They are inserted without the read-back and return what was sent.
      const writerCannotRead =
        (entityName === 'Notification' && insertRecord.user_email !== email) ||
        (entityName === 'DirectMessage' && insertRecord.sender_email !== email && insertRecord.recipient_email !== email) ||
        (entityName === 'SupportMessage' && !email);
      if (writerCannotRead) {
        const { error } = await withAuthRetry(() => supabase.from(tableName).insert(insertRecord));
        if (error) throw error;
        return insertRecord;
      }

      const { data, error } = await withAuthRetry(() =>
        supabase
          .from(tableName)
          .insert(insertRecord)
          .select()
          .single()
      );
      if (error) throw error;
      noteEntityCreated(entityName);
      return data;
    },

    async update(id, record) {
      blockIfGuest('save changes');
      const patch = buildUpdateRecord(entityName, record, new Date().toISOString());
      const { data, error } = await withAuthRetry(() =>
        supabase
          .from(tableName)
          .update(patch)
          .eq('id', id)
          .select()
          .single()
      );
      if (error) throw error;
      return data;
    },

    async delete(id) {
      blockIfGuest('delete records');
      const { data, error } = await withAuthRetry(() =>
        supabase.from(tableName).delete().eq('id', id).select().single()
      );
      if (error) throw error;
      return data;
    },

    async list(sort = null) {
      if (isGuestMode()) {
        if (isMockedEntity(entityName)) return guestMockList(entityName, sort);
        return [];
      }
      return this.filter({}, sort);
    },
  };
}

// Named entity exports
export const AppSettings = createEntityClient('AppSettings');
export const BreederStorePage = createEntityClient('BreederStorePage');
export const BreedingPlan = createEntityClient('BreedingPlan');
export const CareGuideSection = createEntityClient('CareGuideSection');
export const ChangeLog = createEntityClient('ChangeLog');
export const ClassificationVote = createEntityClient('ClassificationVote');
export const DirectMessage = createEntityClient('DirectMessage');
export const Egg = createEntityClient('Egg');
export const ExpertAction = createEntityClient('ExpertAction');
export const ExpertVerificationRequest = createEntityClient('ExpertVerificationRequest');
export const FeedingGroup = createEntityClient('FeedingGroup');
export const ForumCategory = createEntityClient('ForumCategory');
export const ForumComment = createEntityClient('ForumComment');
export const ForumLike = createEntityClient('ForumLike');
export const ForumPost = createEntityClient('ForumPost');
export const FutureBreedingPlan = createEntityClient('FutureBreedingPlan');
export const Gecko = createEntityClient('Gecko');
export const GeckoEvent = createEntityClient('GeckoEvent');
export const GeckoImage = createEntityClient('GeckoImage');
export const GeckoLike = createEntityClient('GeckoLike');
export const GeckoOfTheDay = createEntityClient('GeckoOfTheDay');
export const Giveaway = createEntityClient('Giveaway');
export const GiveawayEntry = createEntityClient('GiveawayEntry');
export const LineagePlaceholder = createEntityClient('LineagePlaceholder');
export const MarketplaceCost = createEntityClient('MarketplaceCost');
export const MarketplaceLike = createEntityClient('MarketplaceLike');
export const MorphGuide = createEntityClient('MorphGuide');
export const MorphGuideComment = createEntityClient('MorphGuideComment');
export const MorphPriceCache = createEntityClient('MorphPriceCache');
export const MorphReferenceImage = createEntityClient('MorphReferenceImage');
export const MorphTrait = createEntityClient('MorphTrait');
export const Notification = createEntityClient('Notification');
export const OtherReptile = createEntityClient('OtherReptile');
export const PageConfig = createEntityClient('PageConfig');
export const PaymentEvent = createEntityClient('PaymentEvent');
export const Project = createEntityClient('Project');
export const ReptileEvent = createEntityClient('ReptileEvent');
export const ScrapedTrainingData = createEntityClient('ScrapedTrainingData');
export const StripeWebhookLog = createEntityClient('StripeWebhookLog');
export const SupportMessage = createEntityClient('SupportMessage');
export const ErrorLog = createEntityClient('ErrorLog');
export const UserEvent = createEntityClient('UserEvent');
export const Task = createEntityClient('Task');
export const UserActivity = createEntityClient('UserActivity');
export const UserBadge = createEntityClient('UserBadge');
export const UserFollow = createEntityClient('UserFollow');
export const WeightRecord = createEntityClient('WeightRecord');
export const UserEntity = createEntityClient('User');

// P1, Animal Passport + Ownership Transfer
export const OwnershipRecord = createEntityClient('OwnershipRecord');
export const ShedRecord = createEntityClient('ShedRecord');
export const VetRecord = createEntityClient('VetRecord');
export const TransferRequest = createEntityClient('TransferRequest');
export const FeedingRecord = createEntityClient('FeedingRecord');
// P2, Market Pricing Intelligence
export const MorphPriceEntry = createEntityClient('MorphPriceEntry');
export const PriceAlert = createEntityClient('PriceAlert');
export const CollectionValuation = createEntityClient('CollectionValuation');
// P3, Breeding ROI Dashboard
export const BreedingProject = createEntityClient('BreedingProject');
export const GeneticOutcomePrediction = createEntityClient('GeneticOutcomePrediction');
export const Clutch = createEntityClient('Clutch');
// P4, Breeding Loan Management
export const BreedingLoan = createEntityClient('BreedingLoan');
// P5, Geck Answers
export const Question = createEntityClient('Question');
export const Answer = createEntityClient('Answer');
export const QuestionVote = createEntityClient('QuestionVote');
// P8, Breeder Storefront
export const BreederProfile = createEntityClient('BreederProfile');
export const BreederReview = createEntityClient('BreederReview');
// Shipping, Zero's Geckos integration
export const ShippingOrder = createEntityClient('ShippingOrder');
// Pending Sales, reserve price system
export const PendingSale = createEntityClient('PendingSale');
// Blog system
export const BlogSettings = createEntityClient('BlogSettings');
export const BlogPost = createEntityClient('BlogPost');
export const BlogCategory = createEntityClient('BlogCategory');
export const BlogTag = createEntityClient('BlogTag');
export const BlogLog = createEntityClient('BlogLog');

// Store, supplies, gifts, merch, affiliate
export const StoreVendor = createEntityClient('StoreVendor');
export const StoreCategory = createEntityClient('StoreCategory');
export const StoreProduct = createEntityClient('StoreProduct');
export const StoreCart = createEntityClient('StoreCart');
export const StoreCartItem = createEntityClient('StoreCartItem');
export const StoreOrder = createEntityClient('StoreOrder');
export const StoreOrderItem = createEntityClient('StoreOrderItem');
export const StoreFulfillment = createEntityClient('StoreFulfillment');
export const StoreAffiliateClick = createEntityClient('StoreAffiliateClick');
export const StoreSignupGrant = createEntityClient('StoreSignupGrant');
export const StorePromoCode = createEntityClient('StorePromoCode');
export const Testimonial = createEntityClient('Testimonial');
export const Collection = createEntityClient('Collection');
export const CollectionMember = createEntityClient('CollectionMember');

// Social Media Manager (Promote)
export const SocialPost = createEntityClient('SocialPost');
export const SocialPostVariant = createEntityClient('SocialPostVariant');
export const SocialPlatformConnection = createEntityClient('SocialPlatformConnection');
export const SocialPostUsage = createEntityClient('SocialPostUsage');
export const SocialGenerationLog = createEntityClient('SocialGenerationLog');
export const UserBrandVoice = createEntityClient('UserBrandVoice');
export const SocialPostPhotoUsage = createEntityClient('SocialPostPhotoUsage');
export const SocialReferralBonus = createEntityClient('SocialReferralBonus');
export const GeckoWaitlist = createEntityClient('GeckoWaitlist');
export const GeckoWaitlistSignup = createEntityClient('GeckoWaitlistSignup');
export const PromoteImage = createEntityClient('PromoteImage');

// Genetics calculator flywheel + trait-velocity store
export const PairingOutcomeLog = createEntityClient('PairingOutcomeLog');
export const GeneticsTraitOverride = createEntityClient('GeneticsTraitOverride');
