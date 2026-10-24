import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/posthog', () => ({ ensurePostHog: async () => null, captureEvent: () => {} }));
import { OUTCOME_FLAG, OUTCOME_PROMISES, OUTCOME_VARIANTS, outcomePromise, readOutcomeVariant } from '../outcomePromise';

const client = (value, { optedOut = false } = {}) => ({
  has_opted_out_capturing: () => optedOut,
  onFeatureFlags: (cb) => { setTimeout(cb, 0); return () => {}; },
  getFeatureFlag: vi.fn((key, options) => {
    expect(key).toBe(OUTCOME_FLAG);
    expect(options).toEqual({ send_event: false });
    return value;
  }),
});

describe('promised-outcome test', () => {
  it('returns the arm PostHog assigns', async () => {
    for (const variant of OUTCOME_VARIANTS) {
      expect(await readOutcomeVariant({ load: async () => client(variant) })).toBe(variant);
    }
  });

  it('leaves the visitor out of the test when the answer is unknown, missing or late', async () => {
    expect(await readOutcomeVariant({ load: async () => client('business') })).toBe(null);
    expect(await readOutcomeVariant({ load: async () => client(false) })).toBe(null);
    expect(await readOutcomeVariant({ load: async () => null })).toBe(null);
    expect(await readOutcomeVariant({ load: async () => client('sell', { optedOut: true }) })).toBe(null);
    const never = { has_opted_out_capturing: () => false, onFeatureFlags: () => () => {}, getFeatureFlag: () => 'sell' };
    expect(await readOutcomeVariant({ load: async () => never, timeoutMs: 20 })).toBe(null);
  });

  it('has no copy for control, so the page keeps its own heading', () => {
    expect(outcomePromise('control')).toBe(null);
    expect(outcomePromise(null)).toBe(null);
  });

  it('ties every promise to the plan that delivers it, without dash punctuation', () => {
    for (const { heading, lead } of Object.values(OUTCOME_PROMISES)) {
      expect(lead).toMatch(/Keeper|Breeder/);
      expect(`${heading} ${lead}`).not.toMatch(/[\u2013\u2014]| -- /);
      expect(heading.length).toBeLessThanOrEqual(60);
    }
  });
});
