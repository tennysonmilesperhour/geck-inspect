/**
 * Plan list lines that depend on live state, for the Membership page.
 *
 * AI Consultant allowances (feature-completeness audit, step 25). The
 * monthly message counts come from TIER_LIMITS, which match the server's
 * feature_credit_allotments (10, 100, 400 and 1000 in October 2026). The
 * line is only added while the AI Consultant page is switched on in the
 * admin Pages tool: listing an allowance for a page members cannot open
 * would break the rule that every Membership line is true (D11).
 */
import { TIER_LIMITS } from '@/lib/tierLimits';

export function consultantAllowanceLine(tierKey) {
  const n = TIER_LIMITS[tierKey]?.monthlyAssistantMessages;
  if (n == null) return null;
  return `${n.toLocaleString('en-US')} AI Consultant messages per month`;
}

/** The tier's features with the consultant line after the Morph ID line. */
export function featuresWithConsultant(tierKey, features, consultantLive) {
  const line = consultantLive ? consultantAllowanceLine(tierKey) : null;
  if (!line) return features;
  const list = [...features];
  const morphIdx = list.findIndex((f) => /AI Morph ID/i.test(f));
  list.splice(morphIdx === -1 ? list.length : morphIdx + 1, 0, line);
  return list;
}

/** True unless every page_config row for the page is switched off. */
export function pageIsLive(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((r) => r?.is_enabled !== false);
}

function formatStorage(bytes) {
  if (bytes == null) return 'Unlimited';
  return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
}

const countLabel = (n) => (n == null || n === Infinity ? 'Unlimited' : String(n));

// Active breeding pairs by plan. The app enforces these in
// PlanLimitChecker (PLAN_LIMITS.breeding_pairs); a test keeps the two equal.
export const ACTIVE_PAIR_LIMITS = { free: 1, keeper: 5, breeder: null, enterprise: null };

/**
 * The four numbers that decide between plans on the Membership page,
 * read from the limits the app enforces (TIER_LIMITS, and the breeding
 * pair limits mirrored from PlanLimitChecker), so a card can never promise more
 * than a member actually gets.
 */
export function planNumbers(tierKey) {
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.free;
  const pairs = tierKey in ACTIVE_PAIR_LIMITS ? ACTIVE_PAIR_LIMITS[tierKey] : ACTIVE_PAIR_LIMITS.free;
  return [
    { label: 'Geckos', value: countLabel(limits.maxGeckos) },
    { label: 'Active pairs', value: countLabel(pairs) },
    { label: 'Morph IDs a month', value: countLabel(limits.monthlyMorphIDCredits) },
    { label: 'Photo storage', value: formatStorage(limits.maxStorageBytes) },
  ];
}
