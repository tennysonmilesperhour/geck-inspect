import { describe, it, expect } from 'vitest';
import { resolveTier } from '../tierLimits';
import {
  countActiveOwnGeckos,
  geckoLimitFor,
  geckoSlotsLeft,
  geckoLimitStatus,
  isGeckoLimitError,
} from '../geckoLimit';

const me = 'keeper@example.com';
const gecko = (over = {}) => ({ created_by: me, archived: false, ...over });
const many = (n, over) => Array.from({ length: n }, () => gecko(over));

describe('one plan resolver for every billing source', () => {
  it('reads an app store Keeper subscription even when the profile says free', () => {
    expect(resolveTier({ membership_tier: 'free', revenuecat_tier: 'keeper' })).toBe('keeper');
  });

  it('reads an app store Breeder subscription', () => {
    expect(resolveTier({ membership_tier: 'free', revenuecat_tier: 'breeder' })).toBe('breeder');
  });

  it('keeps the higher plan when Stripe and the app store disagree', () => {
    expect(resolveTier({ membership_tier: 'breeder', revenuecat_tier: 'keeper' })).toBe('breeder');
  });

  it('gives grandfathered members Breeder whatever the tier column says', () => {
    expect(resolveTier({ membership_tier: 'free', subscription_status: 'grandfathered' })).toBe('breeder');
  });
});

describe('countActiveOwnGeckos', () => {
  it('counts only the member\'s own geckos that are not archived', () => {
    const geckos = [
      ...many(3),
      gecko({ archived: true, archive_reason: 'sold' }),
      gecko({ created_by: 'friend@example.com' }),
      gecko({ created_by: 'KEEPER@example.com' }),
    ];
    expect(countActiveOwnGeckos(geckos, me)).toBe(4);
  });

  it('counts a gecko with status Sold that is still active, like the database', () => {
    expect(countActiveOwnGeckos([gecko({ status: 'Sold' })], me)).toBe(1);
  });

  it('is zero without geckos or an email', () => {
    expect(countActiveOwnGeckos(null, me)).toBe(0);
    expect(countActiveOwnGeckos(many(2), null)).toBe(0);
  });
});

describe('gecko limit by plan', () => {
  const free = { email: me, membership_tier: 'free' };

  it('gives Free 10, Keeper 50, and Breeder no limit', () => {
    expect(geckoLimitFor(free)).toBe(10);
    expect(geckoLimitFor({ email: me, membership_tier: 'keeper' })).toBe(50);
    expect(geckoLimitFor({ email: me, membership_tier: 'breeder' })).toBe(Infinity);
    expect(geckoLimitFor({ email: me, revenuecat_tier: 'keeper' })).toBe(50);
  });

  it('lets a free member add their 10th gecko but not an 11th', () => {
    expect(geckoLimitStatus(free, many(9)).atLimit).toBe(false);
    expect(geckoLimitStatus(free, many(10)).atLimit).toBe(true);
  });

  it('frees a slot when a gecko is archived', () => {
    const geckos = [...many(9), gecko({ archived: true })];
    expect(geckoLimitStatus(free, geckos)).toMatchObject({ active: 9, slotsLeft: 1, atLimit: false });
  });

  it('never goes below zero for a member already over the limit', () => {
    expect(geckoSlotsLeft(free, 14)).toBe(0);
  });

  it('does not count geckos shared into the member\'s collection by someone else', () => {
    const geckos = [...many(5), ...many(20, { created_by: 'friend@example.com' })];
    expect(geckoLimitStatus(free, geckos).slotsLeft).toBe(5);
  });

  it('is never at the limit on an unlimited plan', () => {
    const status = geckoLimitStatus({ email: me, subscription_status: 'grandfathered' }, many(400));
    expect(status).toMatchObject({ tier: 'breeder', limit: Infinity, atLimit: false });
  });
});

describe('isGeckoLimitError', () => {
  it('recognises the database trigger error', () => {
    expect(isGeckoLimitError({
      message: 'The Free plan holds up to 10 active geckos. Archive one you no longer keep, or upgrade your plan to add more.',
      hint: 'gecko_limit_reached',
    })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isGeckoLimitError(new Error('network'))).toBe(false);
    expect(isGeckoLimitError(null)).toBe(false);
  });
});
