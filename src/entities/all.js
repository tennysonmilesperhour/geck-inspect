/**
 * Entity exports.
 *
 * MIGRATION STATUS: Currently backed by Base44 for data.
 * After running /AdminMigration to copy all data to Supabase,
 * swap these to use the Supabase entities from @/api/supabaseEntities.
 */
import { base44 } from '@/api/base44Client';
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';

// User auth + profile comes from Supabase; other User entity ops fall through to Base44.
export const User = new Proxy({}, {
  get(_, prop) {
    if (prop === 'me') {
      return async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        // Try enriching with Supabase profile
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          if (profile) return { ...normalizeSupabaseUser(user), ...profile };
        } catch {}
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
            .update({ ...data, updated_date: new Date().toISOString() })
            .eq('email', user.email);
        } catch {}
        return normalizeSupabaseUser(user);
      };
    }
    // Fall through to Base44 for filter/get/create/update/delete
    return base44.entities.User?.[prop];
  }
});

// Data entities — still backed by Base44 until migration runs.
// After running /AdminMigration, replace these with imports from @/api/supabaseEntities.
export const AppSettings = base44.entities.AppSettings;
export const BreedingPlan = base44.entities.BreedingPlan;
export const CareGuideSection = base44.entities.CareGuideSection;
export const ChangeLog = base44.entities.ChangeLog;
export const DirectMessage = base44.entities.DirectMessage;
export const Egg = base44.entities.Egg;
export const FeedingGroup = base44.entities.FeedingGroup;
export const ForumCategory = base44.entities.ForumCategory;
export const ForumComment = base44.entities.ForumComment;
export const ForumLike = base44.entities.ForumLike;
export const ForumPost = base44.entities.ForumPost;
export const Gecko = base44.entities.Gecko;
export const GeckoEvent = base44.entities.GeckoEvent;
export const GeckoImage = base44.entities.GeckoImage;
export const GeckoOfTheDay = base44.entities.GeckoOfTheDay;
export const LineagePlaceholder = base44.entities.LineagePlaceholder;
export const MarketplaceCost = base44.entities.MarketplaceCost;
export const MarketplaceLike = base44.entities.MarketplaceLike;
export const MorphGuide = base44.entities.MorphGuide;
export const MorphGuideComment = base44.entities.MorphGuideComment;
export const MorphReferenceImage = base44.entities.MorphReferenceImage;
export const Notification = base44.entities.Notification;
export const OtherReptile = base44.entities.OtherReptile;
export const PageConfig = base44.entities.PageConfig;
export const Project = base44.entities.Project;
export const ReptileEvent = base44.entities.ReptileEvent;
export const ScrapedTrainingData = base44.entities.ScrapedTrainingData;
export const Task = base44.entities.Task;
export const UserActivity = base44.entities.UserActivity;
export const UserBadge = base44.entities.UserBadge;
export const UserFollow = base44.entities.UserFollow;
export const WeightRecord = base44.entities.WeightRecord;
