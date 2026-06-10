/**
 * Client helper for the feature_usage monthly credit ledger.
 *
 * Each metered feature calls consumeFeatureCredit() BEFORE doing the
 * expensive work. The RPC (consume_feature_credit, security definer,
 * keyed on auth.uid()) atomically increments the month's row and raises
 * 'feature_credits_exhausted' past the tier allotment, which this
 * helper maps to { ok: false, exhausted: true } so callers can show an
 * upgrade CTA instead of a raw error.
 *
 * Tier allotments live in tierLimits.js. null allotment = unlimited
 * (usage still recorded, useful for cost dashboards). Guests are always
 * refused: metered features require an account.
 *
 * Server-enforced features (health screens, assistant) ALSO check the
 * ledger inside their edge functions; this client call is the fast
 * path and the UX surface, not the only line of defense.
 */
import { supabase } from '@/lib/supabaseClient';
import { isGuestMode } from '@/lib/guestMode';
import { getTierLimits, tierOf } from '@/lib/tierLimits';

// feature name -> tierLimits key
export const METERED_FEATURES = {
  assistant_message: 'monthlyAssistantMessages',
  health_screen: 'monthlyHealthScreens',
  iot_poll: 'monthlyIotPolls',
  visual_search: 'monthlyVisualSearches',
  growth_reel: 'monthlyGrowthReels',
};

export async function consumeFeatureCredit(feature, user, cost = 1) {
  const limitKey = METERED_FEATURES[feature];
  if (!limitKey) throw new Error(`Unknown metered feature: ${feature}`);
  if (isGuestMode() || !user) {
    return { ok: false, exhausted: false, guest: true };
  }
  const tier = tierOf(user);
  const included = getTierLimits(user)[limitKey];
  if (included === 0) {
    // Tier has no allotment at all (e.g. IoT on Free): straight to CTA.
    return { ok: false, exhausted: true, included: 0, remaining: 0, tier };
  }
  const { data, error } = await supabase.rpc('consume_feature_credit', {
    p_feature: feature,
    p_tier: tier,
    p_included: included,
    p_cost: cost,
  });
  if (error) {
    if (String(error.message || '').includes('feature_credits_exhausted')) {
      return { ok: false, exhausted: true, included, tier };
    }
    throw error;
  }
  const remaining = data?.credits_included == null
    ? null
    : Math.max(0, data.credits_included - data.credits_consumed);
  return { ok: true, exhausted: false, included, remaining, tier };
}

/** Read-only view of this month's usage for a feature (for "X of Y left" hints). */
export async function getFeatureUsage(feature) {
  if (isGuestMode()) return null;
  const monthKey = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase
    .from('feature_usage')
    .select('credits_included, credits_consumed')
    .eq('feature', feature)
    .eq('month_key', monthKey)
    .maybeSingle();
  if (error || !data) return null;
  return {
    included: data.credits_included,
    consumed: data.credits_consumed,
    remaining: data.credits_included == null
      ? null
      : Math.max(0, data.credits_included - data.credits_consumed),
  };
}
