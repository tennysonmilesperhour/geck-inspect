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
import { isPageRetired } from '@/lib/retiredPages';

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

// Plan lines that belong to a retired page (src/lib/retiredPages.js). While
// the page is retired its line is left off the plan cards, so a member never
// pays for something that redirects; it comes back with the page.
const RETIRED_PAGE_LINES = [
  { page: 'OtherReptiles', line: /additional reptiles/i },
];

/** The plan's lines without those of retired pages. */
export function withoutRetiredLines(features) {
  return features.filter((f) => !RETIRED_PAGE_LINES.some(({ page, line }) => isPageRetired(page) && line.test(f)));
}

/**
 * True unless every page_config row for the page is switched off, or the
 * page is retired (src/lib/retiredPages.js), whatever its rows say: the AI
 * Consultant was retired on 16 Oct 2026, and Membership must not list
 * messages for a page that redirects.
 */
export function pageIsLive(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((r) => r?.is_enabled !== false && !isPageRetired(r?.page_name));
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
