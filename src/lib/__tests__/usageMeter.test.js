import { describe, it, expect } from 'vitest';
import { consumeFeatureCredit, METERED_FEATURES } from '../usageMeter';
import { TIER_LIMITS } from '../tierLimits';

describe('METERED_FEATURES mapping', () => {
  it('maps every metered feature to a real tierLimits key', () => {
    for (const limitKey of Object.values(METERED_FEATURES)) {
      // Every tier must define the allotment for each metered feature,
      // otherwise getTierLimits(user)[limitKey] would be undefined and the
      // meter would misbehave.
      for (const tier of Object.keys(TIER_LIMITS)) {
        expect(TIER_LIMITS[tier]).toHaveProperty(limitKey);
      }
    }
  });
});

describe('consumeFeatureCredit guard branches', () => {
  it('rejects an unknown feature before touching the network', async () => {
    await expect(consumeFeatureCredit('not_a_feature', { membership_tier: 'breeder' }))
      .rejects.toThrow(/Unknown metered feature/);
  });

  it('refuses when there is no user (metered features require an account)', async () => {
    const result = await consumeFeatureCredit('assistant_message', null);
    expect(result).toEqual({ ok: false, exhausted: false, guest: true });
  });
});
