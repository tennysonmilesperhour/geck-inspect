import { describe, expect, it } from 'vitest';
import {
  SCOREBOARD_CHECKPOINTS,
  SCOREBOARD_TARGETS,
  denverToday,
  meetsTarget,
  monthlyValue,
  nextCheckpoint,
  summarizeEntries,
  summarizePaidPlans,
  targetText,
} from '../scoreboard';

describe('monthlyValue', () => {
  it('uses the list prices: monthly as is, annual a twelfth, lifetime nothing', () => {
    expect(monthlyValue('breeder', 'monthly')).toBeCloseTo(5.99);
    expect(monthlyValue('keeper', 'annual')).toBeCloseTo(30 / 12);
    expect(monthlyValue('enterprise', 'annual')).toBeCloseTo(1000 / 12);
    expect(monthlyValue('breeder', 'lifetime')).toBe(0);
    expect(monthlyValue('free', 'monthly')).toBe(0);
    expect(monthlyValue('unknown', 'monthly')).toBe(0);
  });
});

describe('summarizePaidPlans', () => {
  it('counts breeders and keepers apart and leaves comped payers out of paying and revenue', () => {
    const s = summarizePaidPlans([
      { tier: 'breeder', cycle: 'monthly', source: 'stripe', comped: false, n: 2 },
      { tier: 'enterprise', cycle: 'lifetime', source: 'stripe', comped: false, n: 1 },
      { tier: 'keeper', cycle: 'annual', source: 'stripe', comped: false, n: 1 },
      { tier: 'breeder', cycle: 'monthly', source: 'stripe', comped: true, n: 1 },
      { tier: 'free', cycle: 'monthly', source: 'stripe', comped: false, n: 4 },
    ]);
    expect(s.payingBreeders).toBe(3);
    expect(s.payingKeepers).toBe(1);
    expect(s.payingAll).toBe(4);
    expect(s.lifetime).toBe(1);
    expect(s.compedPayers).toBe(1);
    expect(s.mrr).toBeCloseTo(2 * 5.99 + 30 / 12, 2);
  });

  it('copes with nothing at all', () => {
    expect(summarizePaidPlans(null)).toMatchObject({ payingBreeders: 0, mrr: 0 });
  });

  it('matches production on 15 October 2026: one keeper pays, the one breeder also holds a comp', () => {
    const s = summarizePaidPlans([
      { tier: 'breeder', cycle: 'monthly', source: 'stripe', comped: true, n: 1 },
      { tier: 'keeper', cycle: 'monthly', source: 'stripe', comped: false, n: 1 },
    ]);
    expect(s.payingBreeders).toBe(0);
    expect(s.compedPayers).toBe(1);
    expect(s.mrr).toBeCloseTo(2.99);
  });
});

describe('summarizeEntries', () => {
  const entries = [
    { kind: 'conversation', entry_date: '2026-10-15' },
    { kind: 'conversation', entry_date: '2026-10-09' },
    { kind: 'conversation', entry_date: '2026-10-08' },
    { kind: 'import', entry_date: '2026-10-14' },
    { kind: 'import', entry_date: '2026-09-30' },
    { kind: 'monthly_cost', entry_date: '2026-10-01', amount_usd: 120, created_date: '2026-10-01T10:00:00Z' },
    { kind: 'monthly_cost', entry_date: '2026-10-12', amount_usd: '87.50', created_date: '2026-10-12T10:00:00Z' },
    { kind: 'monthly_cost', entry_date: '2026-10-12', amount_usd: 90, created_date: '2026-10-12T09:00:00Z' },
  ];

  it('counts totals and the last 7 days (today and the six days before)', () => {
    const s = summarizeEntries(entries, '2026-10-15');
    expect(s.conversations).toBe(3);
    expect(s.conversations7d).toBe(2); // 15 and 9 October; 8 October is the eighth day back
    expect(s.imports).toBe(2);
    expect(s.imports7d).toBe(1);
  });

  it('shows the newest cost entry, breaking a same-day tie by when it was saved', () => {
    expect(summarizeEntries(entries, '2026-10-15').latestCost).toMatchObject({ amount: 87.5, entry_date: '2026-10-12' });
  });

  it('does not count future-dated entries as recent', () => {
    const s = summarizeEntries([{ kind: 'conversation', entry_date: '2026-10-20' }], '2026-10-15');
    expect(s.conversations).toBe(1);
    expect(s.conversations7d).toBe(0);
  });
});

describe('checkpoints and targets', () => {
  it('carries the E5 dates', () => {
    expect(SCOREBOARD_CHECKPOINTS.map((c) => c.date)).toEqual(['2026-11-17', '2026-12-17', '2027-01-17']);
  });

  it('picks the next checkpoint that has not passed', () => {
    expect(nextCheckpoint('2026-10-15').key).toBe('day30');
    expect(nextCheckpoint('2026-11-17').key).toBe('day30');
    expect(nextCheckpoint('2026-11-18').key).toBe('day60');
    expect(nextCheckpoint('2027-03-01').key).toBe('day90');
  });

  it('reads "or more" and "under" targets', () => {
    expect(meetsTarget(15, SCOREBOARD_TARGETS.conversations.day30)).toBe(true);
    expect(meetsTarget(14, SCOREBOARD_TARGETS.conversations.day30)).toBe(false);
    expect(meetsTarget(99.99, SCOREBOARD_TARGETS.monthlyCost.day30)).toBe(true);
    expect(meetsTarget(100, SCOREBOARD_TARGETS.monthlyCost.day30)).toBe(false);
    expect(meetsTarget(null, SCOREBOARD_TARGETS.imports.day30)).toBe(null);
    expect(meetsTarget(5, SCOREBOARD_TARGETS.mrr.day60)).toBe(null);
    expect(targetText(SCOREBOARD_TARGETS.monthlyCost.day30, { money: true })).toBe('under $100');
    expect(targetText(SCOREBOARD_TARGETS.passportsIssued.day60)).toBe('50+');
  });

  it('holds the E5 numbers', () => {
    expect(SCOREBOARD_TARGETS.payingBreeders.day30.min).toBe(2);
    expect(SCOREBOARD_TARGETS.payingBreeders.day60.min).toBe(6);
    expect(SCOREBOARD_TARGETS.payingBreeders.day90.min).toBe(10);
    expect(SCOREBOARD_TARGETS.passportsClaimed.day60.min).toBe(15);
    expect(SCOREBOARD_TARGETS.passportsClaimed.day90.min).toBe(25);
    expect(SCOREBOARD_TARGETS.weeklyActiveBreeders.day60.min).toBe(4);
    expect(SCOREBOARD_TARGETS.weeklyActiveBreeders.day90.min).toBe(5);
  });

  it('dates the week in Denver, not UTC', () => {
    // 03:00 UTC on 16 October is still the evening of 15 October in Denver.
    expect(denverToday(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-15');
  });
});
