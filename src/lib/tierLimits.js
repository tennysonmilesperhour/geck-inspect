/**
 * Tier limits ,  single source of truth for what each membership tier
 * unlocks. Imported by upload validation, the Settings storage card,
 * the Subscription page, the Promote (social media) page, and any
 * feature gate that needs to know whether a user has hit a quota.
 *
 * Storage and collaborator caps mirror Reptidex (Free 1GB, Pro 10GB,
 * Premium unlimited) with collaborator gating set to Free 1 / Keeper 5
 * / Breeder unlimited. Gecko count caps are kept tighter than storage
 * to keep Free a real funnel into Keeper.
 *
 * Social-media post quotas (`monthlySocialPosts`) are MONTHLY INCLUDED
 * counts, not hard caps. Every paid tier can overage at $0.50/post.
 * Free can overage too, but only after they've added a payment method
 * (or accepted a Keeper trial). Enterprise's "unlimited" label is
 * marketing copy; the actual included count is 30, with overage at the
 * same flat rate.
 *
 * AI Morph ID credits (`monthlyMorphIDCredits`) are a HARD monthly cap,
 * not overageable. Each successful identification consumes 1 credit;
 * when a user runs out, the edge function returns 402 and the UI shows
 * an upgrade CTA. Admins bypass the limit entirely. See
 * supabase/migrations/20260516_morph_id_credits.sql for the ledger.
 *
 * `null` means unlimited. Always check `if (limit == null)` before
 * comparing usage ,  never treat null as 0.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const TIER_LIMITS = {
  free: {
    label: 'Free',
    tagline: 'Hobbyist',
    maxGeckos: 10,
    maxStorageBytes: 1 * GB,
    maxCollaborators: 1,
    monthlySocialPosts: 1,
    monthlyMorphIDCredits: 1,
    // Promote-only image library. Separate budget from collection
    // storage so a free user can't bury the social tooling under
    // their gecko photo backlog.
    promoteImageStorageBytes: 25 * MB,
    promoteImageMaxCount: 10,
    scheduledPostsMax: 1,
  },
  keeper: {
    label: 'Keeper',
    tagline: 'Pro',
    maxGeckos: 50,
    maxStorageBytes: 10 * GB,
    maxCollaborators: 5,
    monthlySocialPosts: 4,
    monthlyMorphIDCredits: 3,
    promoteImageStorageBytes: 200 * MB,
    promoteImageMaxCount: 100,
    scheduledPostsMax: 5,
  },
  breeder: {
    label: 'Breeder',
    tagline: 'Premium',
    maxGeckos: null,
    maxStorageBytes: null,
    maxCollaborators: null,
    monthlySocialPosts: 12,
    monthlyMorphIDCredits: 6,
    promoteImageStorageBytes: 1 * GB,
    promoteImageMaxCount: 500,
    scheduledPostsMax: 10,
  },
  enterprise: {
    label: 'Enterprise',
    tagline: 'Unlimited',
    maxGeckos: null,
    maxStorageBytes: null,
    maxCollaborators: null,
    monthlySocialPosts: 30,
    monthlyMorphIDCredits: 15,
    promoteImageStorageBytes: 5 * GB,
    promoteImageMaxCount: 2000,
    scheduledPostsMax: 10,
  },
};

// Flat overage rate per post once a user exceeds their monthly included
// allotment. Same rate across every tier so billing stays predictable
// and Enterprise never pays more per overage post than a Free user.
export const SOCIAL_POST_OVERAGE_CENTS = 50;

/**
 * Resolve the tier ID for a user record. Treats grandfathered users
 * as breeder-tier and unknown / missing tiers as free.
 */
export function tierOf(user) {
  if (!user) return 'free';
  if (user.subscription_status === 'grandfathered') return 'breeder';
  const t = user.membership_tier;
  return TIER_LIMITS[t] ? t : 'free';
}

export function getTierLimits(user) {
  return TIER_LIMITS[tierOf(user)] || TIER_LIMITS.free;
}

export function formatBytes(bytes) {
  if (bytes == null) return 'Unlimited';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

export function bytesUsedPercent(used, limit) {
  if (limit == null) return 0;
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
