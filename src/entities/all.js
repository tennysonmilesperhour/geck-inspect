/**
 * Entity exports — all backed by Supabase.
 *
 * Data was migrated from Base44 via /AdminMigration.
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
            .upsert({ email: user.email, ...data, updated_date: new Date().toISOString() }, { onConflict: 'email' });
        } catch {}
        return normalizeSupabaseUser(user);
      };
    }
    return sb.UserEntity?.[prop];
  }
});

// All data entities — Supabase
export const AppSettings = sb.AppSettings;
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
