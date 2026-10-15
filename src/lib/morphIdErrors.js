import { PROVIDER_UNAVAILABLE_MESSAGE } from '../../supabase/functions/_shared/morph-upstream.ts';

export { PROVIDER_UNAVAILABLE_MESSAGE };

// User-facing error copy keyed by edge-function error code. Admins skip
// this and see the raw upstream message instead, so they can debug a
// provider outage without showing that text to members.
const FRIENDLY_ERROR = {
  morph_id_credits_exhausted: {
    title: "You're out of MorphID credits for this month",
    body: 'Your credits reset on the 1st. Upgrade your plan to identify more geckos now.',
    cta: { label: 'See plans', href: '/Membership' },
  },
  // The per-network daily cap runs before a credit is used, so nothing was
  // charged. Without its own copy this fell through to "try a different
  // photo", which only invited more retries.
  morph_id_ip_daily_exhausted: {
    title: 'Daily Morph ID limit reached on this network',
    body: 'Please try again tomorrow. No credit was used.',
  },
  upstream_rate_limited: {
    title: 'Our AI is busy right now',
    body: 'Lots of geckos under the lens. Please try again in a minute. Nothing was charged.',
  },
  upstream_error: {
    title: PROVIDER_UNAVAILABLE_MESSAGE,
    body: 'Nothing was charged. Your photos are still here.',
  },
  request_timeout: {
    title: PROVIDER_UNAVAILABLE_MESSAGE,
    body: 'Your photos are still here. Press Identify again: if the first try finished, you get that answer back without using another credit.',
  },
  upstream_timeout: {
    title: PROVIDER_UNAVAILABLE_MESSAGE,
    body: 'Nothing was charged. Your photos are still here.',
  },
  morph_id_in_progress: {
    title: 'Still working on these photos',
    body: 'Your last analysis of these photos is still running. Wait a few seconds, then press Identify again. You will not be charged twice.',
  },
  network_error: {
    title: PROVIDER_UNAVAILABLE_MESSAGE,
    body: 'Your photos are still here. Check your connection, then press Identify again. A retry of the same photos is not charged twice.',
  },
  auth_required: {
    title: 'Please sign in to use MorphID',
    body: 'MorphID counts against your monthly plan, so we need to know who you are first.',
    cta: { label: 'Sign in', href: '/AuthPortal' },
  },
  bad_request: {
    title: 'Add a top view and a side view',
    body: 'Morph ID needs one clear photo from above and one from the side. Add both, then press Identify again.',
  },
  image_unreadable: {
    title: "The analyzer couldn't open one of the photos",
    body: 'No credit was used. Retake it as a normal camera photo (JPG or PNG), or pick a different one, then press Identify again.',
  },
  credit_check_failed: {
    title: "We couldn't check your credits",
    body: 'Nothing was charged. Please press Try again in a moment.',
  },
  analyzer_unavailable: {
    title: PROVIDER_UNAVAILABLE_MESSAGE,
    body: 'Nothing was charged. Your photos are still here.',
  },
  config_error: {
    title: 'Morph ID is down for maintenance',
    body: 'Nothing was charged. We have been alerted and it should be back shortly.',
  },
  internal_error: {
    title: 'Something went wrong on our side',
    body: 'Any credit used was refunded automatically. Your photos are still here, so press Try again.',
  },
};

// Errors where pressing Identify again with the same photos can work. The
// request key makes a retry safe: a finished first try is returned, not
// charged twice. analyzer_unavailable is included so a provider outage
// can be retried later without uploading the photos again.
export const MORPH_ID_RETRYABLE = new Set([
  'upstream_rate_limited', 'upstream_error', 'upstream_timeout', 'request_timeout',
  'morph_id_in_progress', 'network_error', 'credit_check_failed', 'internal_error',
  'analyzer_unavailable',
]);

// The server has finished with the ledger: either the scan was handed
// back, or it was refused before a scan was taken. Safe to reload the
// scans-left count. Client timeouts are not in here, because the run may
// still be in flight and a reload could show the reserved scan as gone.
const REFUND_ASSURED_CODES = new Set([
  'upstream_error',
  'upstream_timeout',
  'upstream_rate_limited',
  'analyzer_unavailable',
  'image_unreadable',
  'internal_error',
]);

const SETTLED_QUOTA_CODES = new Set([
  'upstream_error',
  'upstream_timeout',
  'upstream_rate_limited',
  'analyzer_unavailable',
  'image_unreadable',
  'internal_error',
  'credit_check_failed',
  'config_error',
  'morph_id_ip_daily_exhausted',
  'morph_id_credits_exhausted',
  'morph_id_in_progress',
]);

export function morphIdErrorSettledQuota(error) {
  if (!error) return false;
  if (error.credit_refunded === true) return true;
  return SETTLED_QUOTA_CODES.has(error.code);
}

/**
 * Copy the Morph ID page shows for a failed analysis.
 * Provider outages use one sentence so a credit-balance failure, a 5xx,
 * and a timeout all read the same to a member.
 */
export function presentMorphIdError(error, { isFreeTier = false, bonus = 0, keeperCredits = 3 } = {}) {
  if (error?.code === 'morph_id_credits_exhausted' && isFreeTier) {
    return {
      title: bonus > 0 ? 'You have used your Morph ID scans' : "You have used this month's free Morph ID",
      body: `Your next free identification arrives on the 1st. Keeper includes ${keeperCredits} identifications a month.`,
      cta: { label: 'See plans', href: '/Membership' },
      retryable: false,
    };
  }
  const known = FRIENDLY_ERROR[error?.code];
  const copy = known ? { ...known } : {
    title: "We couldn't analyze that photo",
    body: 'Try a different photo, or check your connection and try again.',
  };
  // credit_refunded false means the server tried to hand the scan back and
  // Refund copy is only accurate when the server explicitly confirms it.
  // False and missing confirmations both leave the RPC outcome uncertain.
  if (REFUND_ASSURED_CODES.has(error?.code) && error?.credit_refunded !== true) {
    copy.body = 'Your photos are still here. We could not confirm whether a scan was returned. Please check your remaining scans before trying again.';
  }
  return {
    ...copy,
    retryable: MORPH_ID_RETRYABLE.has(error?.code) || !known,
  };
}
