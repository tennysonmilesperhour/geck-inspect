/**
 * Tier limits — single source of truth for what each membership tier
 * unlocks. Imported by upload validation, the Settings storage card,
 * the Subscription page, and any feature gate that needs to know
 * whether a user has hit a quota.
 *
 * The numbers below were chosen on 2026-05-07 to align with a more
 * generous free tier than the Reptidex baseline (Reptidex Free is
 * 10 animals / 1 GB; we go 10 / 500 MB but compensate by giving
 * Pro 5 GB instead of their 10 GB and unlimited animals on Premium).
 *
 * `null` means unlimited. Always check `if (limit == null)` before
 * comparing usage — never treat null as 0.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const TIER_LIMITS = {
  free: {
    label: 'Free',
    tagline: 'Hobbyist',
    maxGeckos: 10,
    maxStorageBytes: 500 * MB,
    maxCollaborators: 0,
  },
  keeper: {
    label: 'Keeper',
    tagline: 'Pro',
    maxGeckos: 50,
    maxStorageBytes: 5 * GB,
    maxCollaborators: 2,
  },
  breeder: {
    label: 'Breeder',
    tagline: 'Premium',
    maxGeckos: null,
    maxStorageBytes: null,
    maxCollaborators: null,
  },
};

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
