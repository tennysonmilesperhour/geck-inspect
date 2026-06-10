/**
 * trustScore.js, the data layer for the seller trust panel.
 *
 * Philosophy: we surface EVIDENCE, not verdicts. Every signal here is a
 * record the seller built up through normal use of Geck Inspect (animals
 * tracked, weights logged, ownership transfers completed, reviews left by
 * real buyers). Each record is timestamped at creation by the platform
 * and cannot be backdated, so the history is provable rather than
 * asserted. The tier is just a convenience summary of those signals, it
 * is never a judgment of character. We never label anyone untrustworthy:
 * 'new' is neutral framing for an account that simply has not had time
 * to build a record yet. Compare this with marketplaces where reputation
 * is a self-written bio; here the receipts are the reputation.
 *
 * Queries are intentionally cheap (filter + length). At current platform
 * scale this is fine; if any of these tables grow past a few thousand
 * rows per user, switch to PostgREST head-count queries.
 */

import {
  Gecko,
  WeightRecord,
  OwnershipRecord,
  BreederReview,
  BreederProfile,
  UserEntity,
} from '@/api/supabaseEntities';

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

/**
 * Compute the individual trust signals for a seller.
 *
 * @param {string} identifier - the seller's email (contains '@') or their
 *   profile/user id.
 * @returns {Promise<{
 *   accountAgeMonths: number,
 *   animalsTracked: number,
 *   weightLogsCount: number,
 *   ownershipTransfers: number,
 *   reviewCount: number,
 *   avgRating: number|null,
 *   isVerifiedBreeder: boolean,
 *   isFeaturedBreeder: boolean,
 * }>}
 */
export async function computeTrustSignals(identifier) {
  if (!identifier) throw new Error('computeTrustSignals: identifier required');

  // Resolve the profile first; everything else hangs off email + user id.
  const isEmail = String(identifier).includes('@');
  const profile = isEmail
    ? (await UserEntity.filter({ email: identifier }, null, 1))[0]
    : await UserEntity.get(identifier);
  if (!profile) throw new Error('computeTrustSignals: profile not found');

  const email = profile.email;

  // Breeder storefront profile (optional). Reviews are keyed by the
  // breeder profile's auth user_id, so fetch this before reviews.
  const [breederProfile] = await BreederProfile
    .filter({ created_by: email }, null, 1)
    .catch(() => []);
  const reviewUserId = breederProfile?.user_id || profile.user_id || profile.id;

  const [geckos, weights, transfers, reviews] = await Promise.all([
    Gecko.filter({ created_by: email }).catch(() => []),
    WeightRecord.filter({ created_by: email }).catch(() => []),
    OwnershipRecord.filter({ created_by: email }).catch(() => []),
    reviewUserId
      ? BreederReview.filter({ reviewed_user_id: reviewUserId }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const ratings = reviews.map((r) => r.rating).filter((r) => typeof r === 'number');
  const avgRating = ratings.length
    ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
    : null;

  const createdAt = profile.created_date ? new Date(profile.created_date) : null;
  const accountAgeMonths = createdAt && !isNaN(createdAt)
    ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / MS_PER_MONTH))
    : 0;

  return {
    accountAgeMonths,
    animalsTracked: geckos.length,
    weightLogsCount: weights.length,
    ownershipTransfers: transfers.length,
    reviewCount: ratings.length,
    avgRating,
    isVerifiedBreeder: breederProfile?.is_verified === true,
    isFeaturedBreeder: profile.is_featured_breeder === true,
  };
}

/**
 * Summarize signals into a tier. Thresholds (documented so they are
 * auditable, not vibes):
 *
 *   pillar:       12+ months on platform, 20+ animals tracked, consistent
 *                 husbandry records (40+ weight logs), and a 4.5+ average
 *                 over 5+ reviews. The long, deep, well-reviewed record.
 *   established:  6+ months, 10+ animals, 10+ weight logs. A verified
 *                 breeder profile also qualifies an account at this tier
 *                 once it has 6+ months and 5+ animals.
 *   establishing: 2+ months with 3+ animals, or any buyer review on
 *                 record. The record is forming.
 *   new:          everything else. Neutral, every pillar started here.
 *
 * The tier never goes DOWN because of a signal (e.g. a low rating does
 * not push someone below what their record otherwise supports being
 * shown as; the rating itself is displayed alongside, and buyers can
 * read the evidence directly).
 *
 * @param {Awaited<ReturnType<typeof computeTrustSignals>>} signals
 * @returns {'new'|'establishing'|'established'|'pillar'}
 */
export function deriveTrustTier(signals) {
  const s = signals || {};
  const months = s.accountAgeMonths || 0;
  const animals = s.animalsTracked || 0;
  const weights = s.weightLogsCount || 0;
  const reviews = s.reviewCount || 0;
  const rating = s.avgRating;

  if (
    months >= 12 &&
    animals >= 20 &&
    weights >= 40 &&
    reviews >= 5 &&
    rating != null && rating >= 4.5
  ) {
    return 'pillar';
  }

  if (
    (months >= 6 && animals >= 10 && weights >= 10) ||
    (s.isVerifiedBreeder && months >= 6 && animals >= 5)
  ) {
    return 'established';
  }

  if ((months >= 2 && animals >= 3) || reviews >= 1) {
    return 'establishing';
  }

  return 'new';
}

/** Display metadata for each tier, kept here so copy stays in one place. */
export const TRUST_TIER_META = {
  new: {
    label: 'New to Geck Inspect',
    description: 'This account is just starting to build its on-platform record.',
  },
  establishing: {
    label: 'Establishing',
    description: 'This account is actively building a tracked history.',
  },
  established: {
    label: 'Established',
    description: 'A consistent, months-deep record of animals and husbandry data.',
  },
  pillar: {
    label: 'Community Pillar',
    description: 'A long, deep, well-reviewed record built over a year or more.',
  },
};
