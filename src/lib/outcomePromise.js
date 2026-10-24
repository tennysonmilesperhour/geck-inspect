// The promised-outcome test on the membership page (web) and the store
// paywall (iOS). One PostHog multivariate flag picks which outcome the
// headline promises; everything below the headline (plans, prices, trial,
// legal lines) is the same in every arm. docs/planning/launch-offer-tests-2026-10.md
// has the rules, the metrics and how to read it.
//
// Every promise has to be true of the plan being sold. Each lead names the
// paid-plan line that delivers it, so a member who buys on the promise gets
// what it said.
import { ensurePostHog, captureEvent } from '@/lib/posthog';

export const OUTCOME_FLAG = 'paywall-outcome-v1';
export const OUTCOME_TIMEOUT_MS = 1500;

export const OUTCOME_PROMISES = {
  sell: {
    heading: 'Sell every clutch with records buyers trust',
    lead: 'Waitlists with written deposit terms, lineage on every gecko, and a MorphMarket-ready CSV of your listings. Waitlists and the MorphMarket export come with Breeder.',
  },
  price: {
    heading: 'Price every hatchling from real market listings',
    lead: 'Value estimates come from the Geck Inspect Price Index, built from thousands of crested gecko asking prices. Keeper can add an estimated value to Morph ID results.',
  },
  pairings: {
    heading: 'Plan pairings that produce the morphs you want',
    lead: 'Clutch odds for Lilly White, Axanthic, Cappuccino and the rest before the season starts. Keeper holds 5 active pairs; Breeder has no limit.',
  },
  care: {
    heading: 'Keep every gecko on track, from hatchling to breeder',
    lead: 'Weights against a healthy growth band, feeding and shed logs, and reminders. Keeper holds up to 50 geckos.',
  },
};

export const OUTCOME_VARIANTS = ['control', ...Object.keys(OUTCOME_PROMISES)];
export const isOutcomeVariant = (value) => OUTCOME_VARIANTS.includes(value);

/** The headline copy for a variant, or null for control and unknown values. */
export const outcomePromise = (variant) => OUTCOME_PROMISES[variant] || null;

/**
 * Resolve the visitor's arm. null means "not in the test": PostHog is not
 * allowed or not configured, the flag is off, or no answer came within the
 * timeout. Callers render control for null and record no exposure, so a
 * slow network never counts as a control conversion.
 */
export function readOutcomeVariant({ timeoutMs = OUTCOME_TIMEOUT_MS, load = ensurePostHog } = {}) {
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe = () => {};
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { unsubscribe(); } catch { /* analytics must not break the page */ }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    Promise.resolve().then(load)
      .then((client) => {
        if (!client || done) return finish(null);
        if (client.has_opted_out_capturing?.()) return finish(null);
        // A cached answer from an earlier visit is fine here: the paywall
        // has no kill-switch urgency, and the same browser keeps its arm.
        unsubscribe = client.onFeatureFlags(() => {
          const value = client.getFeatureFlag(OUTCOME_FLAG, { send_event: false });
          finish(isOutcomeVariant(value) ? value : null);
        });
      })
      .catch(() => finish(null));
  });
}

/**
 * Record the exposure once the chosen headline is on screen. getFeatureFlag
 * with its default send_event is what PostHog experiments count as the
 * exposure; the custom event feeds the first-party admin analytics too.
 */
let shownVariant = null;

/** The arm whose headline this tab showed, for the checkout events. */
export const currentOutcomeVariant = () => shownVariant;

export function recordOutcomeExposure(variant, surface) {
  if (!isOutcomeVariant(variant)) return;
  shownVariant = variant;
  ensurePostHog().then((client) => {
    if (!client) return;
    try {
      client.getFeatureFlag(OUTCOME_FLAG);
      client.register({ paywall_outcome: variant });
    } catch { /* never block the paywall */ }
  });
  captureEvent('paywall_outcome_viewed', { variant, surface });
}
