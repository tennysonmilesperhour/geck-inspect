/**
 * Supabase entity compatibility layer.
 * Provides the same API as base44.entities.* so pages work without changes.
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

export const TABLE_MAP = {
  AppSettings: 'app_settings',
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

  // P1 ,  Animal Passport + Ownership Transfer
  OwnershipRecord: 'ownership_records',
  ShedRecord: 'shed_records',
  VetRecord: 'vet_records',
  TransferRequest: 'transfer_requests',
  FeedingRecord: 'feeding_records',
  // P2 ,  Market Pricing Intelligence
  MorphPriceEntry: 'morph_price_entries',
  PriceAlert: 'price_alerts',
  CollectionValuation: 'collection_valuations',
  // P3 ,  Breeding ROI Dashboard
  BreedingProject: 'breeding_projects',
  GeneticOutcomePrediction: 'genetic_outcome_predictions',
  Clutch: 'clutches',
  // P4 ,  Breeding Loan Management
  BreedingLoan: 'breeding_loans',
  // P5 ,  Geck Answers
  Question: 'questions',
  Answer: 'answers',
  QuestionVote: 'question_votes',
  // P8 ,  Breeder Storefront
  BreederProfile: 'breeder_profiles',
  BreederReview: 'breeder_reviews',
  // Shipping ,  Zero's Geckos integration
  ShippingOrder: 'shipping_orders',
  // Pending Sales ,  reserve price system
  PendingSale: 'pending_sales',
  // Blog system
  BlogSettings: 'blog_settings',
  BlogPost: 'blog_posts',
  BlogCategory: 'blog_categories',
  BlogTag: 'blog_tags',
  BlogLog: 'blog_logs',
  // Store ,  supplies, gifts, merch, affiliate
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
  // Landing page testimonials ,  admin curated, public-readable when approved
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
};

function parseSort(sort) {
  if (!sort) return [{ column: 'created_date', ascending: false }];
  // Support comma-separated sorts: "-created_date,name"
  return sort.split(',').map(s => {
    s = s.trim();
    if (s.startsWith('-')) return { column: s.slice(1), ascending: false };
    return { column: s, ascending: true };
  });
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
        else if (op === '$ne') query = query.neq(key, opVal);
        else if (op === '$in') query = query.in(key, opVal);
      }
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
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
      if (isGuestMode()) {
        if (isMockedEntity(entityName)) {
          return guestMockFilter(entityName, filterObj, sort, limit, skip);
        }
        return [];
      }

      const run = () => {
        let query = supabase.from(tableName).select('*');
        query = applyFilter(query, filterObj);

        const sorts = parseSort(sort);
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
      const { data, error } = await withAuthRetry(() =>
        supabase.from(tableName).select('*').eq('id', id).maybeSingle()
      );
      if (error) throw error;
      return data;
    },

    async create(record) {
      blockIfGuest('save changes');
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || null;
      const now = new Date().toISOString();

      const { data, error } = await withAuthRetry(() =>
        supabase
          .from(tableName)
          .insert({
            ...record,
            created_by: email,
            created_date: record.created_date || now,
            updated_date: now,
          })
          .select()
          .single()
      );
      if (error) throw error;
      return data;
    },

    async update(id, record) {
      blockIfGuest('save changes');
      const now = new Date().toISOString();
      // Remove undefined keys
      const cleaned = Object.fromEntries(
        Object.entries(record).filter(([, v]) => v !== undefined)
      );
      const { data, error } = await withAuthRetry(() =>
        supabase
          .from(tableName)
          .update({ ...cleaned, updated_date: now })
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

// Named entity exports (same names as Base44)
export const AppSettings = createEntityClient('AppSettings');
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

// P1 ,  Animal Passport + Ownership Transfer
export const OwnershipRecord = createEntityClient('OwnershipRecord');
export const ShedRecord = createEntityClient('ShedRecord');
export const VetRecord = createEntityClient('VetRecord');
export const TransferRequest = createEntityClient('TransferRequest');
export const FeedingRecord = createEntityClient('FeedingRecord');
// P2 ,  Market Pricing Intelligence
export const MorphPriceEntry = createEntityClient('MorphPriceEntry');
export const PriceAlert = createEntityClient('PriceAlert');
export const CollectionValuation = createEntityClient('CollectionValuation');
// P3 ,  Breeding ROI Dashboard
export const BreedingProject = createEntityClient('BreedingProject');
export const GeneticOutcomePrediction = createEntityClient('GeneticOutcomePrediction');
export const Clutch = createEntityClient('Clutch');
// P4 ,  Breeding Loan Management
export const BreedingLoan = createEntityClient('BreedingLoan');
// P5 ,  Geck Answers
export const Question = createEntityClient('Question');
export const Answer = createEntityClient('Answer');
export const QuestionVote = createEntityClient('QuestionVote');
// P8 ,  Breeder Storefront
export const BreederProfile = createEntityClient('BreederProfile');
export const BreederReview = createEntityClient('BreederReview');
// Shipping ,  Zero's Geckos integration
export const ShippingOrder = createEntityClient('ShippingOrder');
// Pending Sales ,  reserve price system
export const PendingSale = createEntityClient('PendingSale');
// Blog system
export const BlogSettings = createEntityClient('BlogSettings');
export const BlogPost = createEntityClient('BlogPost');
export const BlogCategory = createEntityClient('BlogCategory');
export const BlogTag = createEntityClient('BlogTag');
export const BlogLog = createEntityClient('BlogLog');

// Store ,  supplies, gifts, merch, affiliate
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
