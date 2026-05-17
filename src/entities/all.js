/**
 * Entity exports ,  all backed by Supabase.
 */
import * as sb from '@/api/supabaseEntities';
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';

// User: auth + profile from Supabase
export const User = new Proxy({}, {
  get(_, prop) {
    if (prop === 'me') {
      return async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        // Enrich with Supabase profiles table
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          if (profile) return { ...normalizeSupabaseUser(user), ...profile };
        } catch (err) {
          console.error('User.me profile enrichment failed:', err);
        }
        return normalizeSupabaseUser(user);
      };
    }
    if (prop === 'loginWithRedirect' || prop === 'login') {
      return () => { window.location.href = '/AuthPortal'; };
    }
    if (prop === 'logout') {
      return async () => { await supabase.auth.signOut(); };
    }
    if (prop === 'updateMyUserData') {
      return async (data) => {
        const { data: { user }, error } = await supabase.auth.updateUser({ data });
        if (error) throw error;
        try {
          await supabase.from('profiles')
            .upsert({ email: user.email, ...data, updated_date: new Date().toISOString() }, { onConflict: 'email' });
        } catch (err) {
          console.error('updateMyUserData profile upsert failed:', err);
        }
        return normalizeSupabaseUser(user);
      };
    }
    return sb.UserEntity?.[prop];
  }
});

// All data entities ,  Supabase
export const AppSettings = sb.AppSettings;
export const BreederStorePage = sb.BreederStorePage;
export const BreedingPlan = sb.BreedingPlan;
export const CareGuideSection = sb.CareGuideSection;
export const ChangeLog = sb.ChangeLog;
export const DirectMessage = sb.DirectMessage;
export const Egg = sb.Egg;
export const FeedingGroup = sb.FeedingGroup;
export const ForumCategory = sb.ForumCategory;
export const ForumComment = sb.ForumComment;
export const ForumLike = sb.ForumLike;
export const ForumPost = sb.ForumPost;
export const FutureBreedingPlan = sb.FutureBreedingPlan;
export const SupportMessage = sb.SupportMessage;
export const ErrorLog = sb.ErrorLog;
export const UserEvent = sb.UserEvent;
export const Gecko = sb.Gecko;
export const GeckoEvent = sb.GeckoEvent;
export const GeckoImage = sb.GeckoImage;
export const GeckoOfTheDay = sb.GeckoOfTheDay;
export const LineagePlaceholder = sb.LineagePlaceholder;
export const MarketplaceCost = sb.MarketplaceCost;
export const MarketplaceLike = sb.MarketplaceLike;
export const MorphGuide = sb.MorphGuide;
export const MorphGuideComment = sb.MorphGuideComment;
export const MorphReferenceImage = sb.MorphReferenceImage;
export const Notification = sb.Notification;
export const OtherReptile = sb.OtherReptile;
export const PageConfig = sb.PageConfig;
export const Project = sb.Project;
export const ReptileEvent = sb.ReptileEvent;
export const ScrapedTrainingData = sb.ScrapedTrainingData;
export const Task = sb.Task;
export const UserActivity = sb.UserActivity;
export const UserBadge = sb.UserBadge;
export const UserFollow = sb.UserFollow;
export const WeightRecord = sb.WeightRecord;

// P1 ,  Animal Passport + Ownership Transfer
export const OwnershipRecord = sb.OwnershipRecord;
export const ShedRecord = sb.ShedRecord;
export const VetRecord = sb.VetRecord;
export const TransferRequest = sb.TransferRequest;
export const FeedingRecord = sb.FeedingRecord;
// P2 ,  Market Pricing Intelligence
export const MorphPriceEntry = sb.MorphPriceEntry;
export const PriceAlert = sb.PriceAlert;
export const CollectionValuation = sb.CollectionValuation;
// P3 ,  Breeding ROI Dashboard
export const BreedingProject = sb.BreedingProject;
export const GeneticOutcomePrediction = sb.GeneticOutcomePrediction;
export const Clutch = sb.Clutch;
// P4 ,  Breeding Loan Management
export const BreedingLoan = sb.BreedingLoan;
// P5 ,  Geck Answers
export const Question = sb.Question;
export const Answer = sb.Answer;
export const QuestionVote = sb.QuestionVote;
// P8 ,  Breeder Storefront
export const BreederProfile = sb.BreederProfile;
export const BreederReview = sb.BreederReview;
// Shipping ,  Zero's Geckos integration
export const ShippingOrder = sb.ShippingOrder;
// Pending Sales ,  reserve price system
export const PendingSale = sb.PendingSale;
// Blog system
export const BlogSettings = sb.BlogSettings;
export const BlogPost = sb.BlogPost;
export const BlogCategory = sb.BlogCategory;
export const BlogTag = sb.BlogTag;
export const BlogLog = sb.BlogLog;
// Store ,  supplies, gifts, merch, affiliate
export const StoreVendor = sb.StoreVendor;
export const StoreCategory = sb.StoreCategory;
export const StoreProduct = sb.StoreProduct;
export const StoreCart = sb.StoreCart;
export const StoreCartItem = sb.StoreCartItem;
export const StoreOrder = sb.StoreOrder;
export const StoreOrderItem = sb.StoreOrderItem;
export const StoreFulfillment = sb.StoreFulfillment;
export const StoreAffiliateClick = sb.StoreAffiliateClick;
export const StoreSignupGrant = sb.StoreSignupGrant;
export const StorePromoCode = sb.StorePromoCode;
export const Testimonial = sb.Testimonial;
export const Collection = sb.Collection;
export const CollectionMember = sb.CollectionMember;
// Social Media Manager (Promote)
export const SocialPost = sb.SocialPost;
export const SocialPostVariant = sb.SocialPostVariant;
export const SocialPlatformConnection = sb.SocialPlatformConnection;
export const SocialPostUsage = sb.SocialPostUsage;
export const SocialGenerationLog = sb.SocialGenerationLog;
export const UserBrandVoice = sb.UserBrandVoice;
export const SocialPostPhotoUsage = sb.SocialPostPhotoUsage;
export const SocialReferralBonus = sb.SocialReferralBonus;
export const GeckoWaitlist = sb.GeckoWaitlist;
export const GeckoWaitlistSignup = sb.GeckoWaitlistSignup;
export const PromoteImage = sb.PromoteImage;
