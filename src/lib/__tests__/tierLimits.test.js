import { describe, it, expect } from 'vitest';
import { resolveTier, tierOf, getTierLimits, TIER_LIMITS } from '../tierLimits';

describe('resolveTier', () => {
  it('returns free for a missing or empty user', () => {
    expect(resolveTier(null)).toBe('free');
    expect(resolveTier(undefined)).toBe('free');
    expect(resolveTier({})).toBe('free');
  });

  it('treats admins as enterprise regardless of stored tier', () => {
    expect(resolveTier({ role: 'admin' })).toBe('enterprise');
    expect(resolveTier({ role: 'admin', membership_tier: 'free' })).toBe('enterprise');
    expect(getTierLimits({ role: 'admin' })).toBe(TIER_LIMITS.enterprise);
  });

  it('treats grandfathered accounts as breeder', () => {
    expect(resolveTier({ subscription_status: 'grandfathered' })).toBe('breeder');
    expect(
      resolveTier({ subscription_status: 'grandfathered', membership_tier: 'free' })
    ).toBe('breeder');
  });

  it('treats an active RevenueCat Pro entitlement as breeder', () => {
    expect(resolveTier({ revenuecat_pro_active: true })).toBe('breeder');
    expect(
      resolveTier({ revenuecat_pro_active: true, membership_tier: 'free' })
    ).toBe('breeder');
    expect(getTierLimits({ revenuecat_pro_active: true })).toBe(TIER_LIMITS.breeder);
  });

  it('falls through to membership_tier for Stripe-direct subscribers', () => {
    expect(resolveTier({ membership_tier: 'keeper' })).toBe('keeper');
    expect(resolveTier({ membership_tier: 'breeder' })).toBe('breeder');
    expect(resolveTier({ membership_tier: 'enterprise' })).toBe('enterprise');
  });

  it('maps unknown tiers to free', () => {
    expect(resolveTier({ membership_tier: 'platinum' })).toBe('free');
    expect(resolveTier({ membership_tier: '' })).toBe('free');
  });

  it('respects priority order: admin beats grandfathered beats revenuecat beats tier', () => {
    expect(
      resolveTier({
        role: 'admin',
        subscription_status: 'grandfathered',
        revenuecat_pro_active: true,
        membership_tier: 'keeper',
      })
    ).toBe('enterprise');
    expect(
      resolveTier({
        subscription_status: 'grandfathered',
        revenuecat_pro_active: true,
        membership_tier: 'keeper',
      })
    ).toBe('breeder');
  });

  it('reads fields nested under .profile when not on the top level', () => {
    expect(resolveTier({ profile: { role: 'admin' } })).toBe('enterprise');
    expect(resolveTier({ profile: { membership_tier: 'keeper' } })).toBe('keeper');
    expect(resolveTier({ profile: { revenuecat_pro_active: true } })).toBe('breeder');
  });

  it('prefers top-level fields over .profile fields', () => {
    expect(
      resolveTier({ membership_tier: 'breeder', profile: { membership_tier: 'free' } })
    ).toBe('breeder');
  });

  it('tierOf is an alias of resolveTier', () => {
    const user = { revenuecat_pro_active: true };
    expect(tierOf(user)).toBe(resolveTier(user));
  });
});
