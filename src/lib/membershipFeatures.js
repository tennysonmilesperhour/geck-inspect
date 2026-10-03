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
