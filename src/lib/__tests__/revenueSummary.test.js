import { describe, expect, it } from 'vitest';
import {
  cancellationWhy, formatCents, lifecycleLabel, planLabel, summarizeRevenue,
} from '../revenueSummary';

describe('admin revenue card helpers', () => {
  it('formats cents as dollars', () => {
    expect(formatCents(898)).toBe('$8.98');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(100000)).toBe('$1,000.00');
    expect(formatCents(null)).toBe('$0.00');
  });

  it('names plans in plain words', () => {
    expect(planLabel('breeder', 'monthly')).toBe('Breeder monthly');
    expect(planLabel('keeper', 'annual')).toBe('Keeper yearly');
    expect(planLabel('keeper')).toBe('Keeper');
    expect(planLabel(null)).toBe('Unknown plan');
  });

  it('prefers the member\'s own answer over Stripe\'s reason', () => {
    expect(cancellationWhy({ reason: 'cancellation_requested', feedback: 'unused' })).toBe('Not using it enough');
    expect(cancellationWhy({ reason: 'payment_failed' })).toBe('Card kept failing');
    expect(cancellationWhy({ feedback: 'too_expensive', comment: 'Need fewer geckos first' }))
      .toBe('Too expensive: "Need fewer geckos first"');
    expect(cancellationWhy({})).toBe('No reason given');
  });

  it('describes each churn event', () => {
    expect(lifecycleLabel({ kind: 'cancel_withdrawn' })).toBe('Changed their mind and stayed');
    expect(lifecycleLabel({ kind: 'subscription_cancelled', status: 'replaced_by_lifetime' })).toBe('Moved to a lifetime plan');
    expect(lifecycleLabel({ kind: 'subscription_cancelled', status: 'subscription_cancelled' })).toBe('Subscription ended');
    expect(lifecycleLabel({ kind: 'subscription_cancelled', status: 'second_subscription_ended' }))
      .toBe('Extra subscription ended, still paying on another');
    expect(lifecycleLabel({ kind: 'cancel_scheduled', cancel_at: '2026-10-31T12:00:00Z' })).toMatch(/^Cancelled, ends Oct 31, 2026$/);
  });

  it('reads the summary with safe defaults', () => {
    const s = summarizeRevenue({
      mrr_cents: 898,
      paying_subscriptions: 2,
      mrr_by_tier: { keeper: { subscriptions: 1, mrr_cents: 299 }, breeder: { subscriptions: 1, mrr_cents: 599 } },
      revenue_cents: 1197,
      cancellations_scheduled: 1,
      scheduled: [{ email: 'a@b.c' }],
    });
    expect(s.mrrCents).toBe(898);
    expect(s.mrrByTier).toEqual([
      { tier: 'keeper', subscriptions: 1, mrrCents: 299 },
      { tier: 'breeder', subscriptions: 1, mrrCents: 599 },
    ]);
    expect(s.revenueCents).toBe(1197);
    expect(s.cancellationsScheduled).toBe(1);
    expect(s.recent).toEqual([]);
    expect(summarizeRevenue(null).mrrCents).toBe(0);
  });
});
