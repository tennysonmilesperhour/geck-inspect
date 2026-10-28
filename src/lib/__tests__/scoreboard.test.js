import { describe, expect, it } from 'vitest';
import {
  SCOREBOARD_CHECKPOINTS,
  SCOREBOARD_TARGETS,
  denverToday,
  entryIsComplete,
  leftOutCounts,
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
    // The comped payer's money is kept apart, not lost.
    expect(s.compedMrr).toBeCloseTo(5.99, 2);
  });

  it('copes with nothing at all', () => {
    expect(summarizePaidPlans(null)).toMatchObject({ payingBreeders: 0, mrr: 0, compedMrr: 0 });
  });

  it('matches production on 15 October 2026: one keeper pays, the one breeder also holds a comp', () => {
    const s = summarizePaidPlans([
      { tier: 'breeder', cycle: 'monthly', source: 'stripe', comped: true, n: 1 },
      { tier: 'keeper', cycle: 'monthly', source: 'stripe', comped: false, n: 1 },
    ]);
    expect(s.payingBreeders).toBe(0);
    expect(s.compedPayers).toBe(1);
    expect(s.mrr).toBeCloseTo(2.99);
    // Together they are the $8.98 the Revenue card and Stripe show.
    expect(s.compedMrr).toBeCloseTo(5.99);
    expect(s.mrr + s.compedMrr).toBeCloseTo(8.98);
  });

  it('says the cost tripwire is judged on the Revenue card, not on this figure', () => {
    expect(SCOREBOARD_TARGETS.mrr.day60.note).toContain("Revenue card's Monthly recurring");
  });

  it('counts a prepaid year as a paying breeder at a twelfth of what was paid, not at the list price', () => {
    // Two Founding Breeders paid $120 for the year, outside the app: their
    // access comes from a comp, but the money makes them paying breeders.
    const s = summarizePaidPlans([
      { tier: 'breeder', cycle: 'monthly', source: 'stripe', comped: true, n: 1 },
      { tier: 'breeder', cycle: 'annual', source: 'prepaid', comped: false, n: 2, monthly_usd: 20 },
    ]);
    expect(s.payingBreeders).toBe(2);
    expect(s.prepaid).toBe(2);
    expect(s.payingAll).toBe(2);
    // $20 a month (2 x $120 / 12), not 2 x $60 / 12 from the Breeder annual list price.
    expect(s.mrr).toBeCloseTo(20, 2);
    expect(s.prepaidMrr).toBeCloseTo(20, 2);
    expect(s.compedPayers).toBe(1);
  });

  it('prices a row from the list when it carries no monthly amount of its own', () => {
    const s = summarizePaidPlans([{ tier: 'breeder', cycle: 'annual', source: 'stripe', comped: false, n: 2, monthly_usd: null }]);
    expect(s.mrr).toBeCloseTo(2 * (60 / 12), 2);
    expect(s.prepaid).toBe(0);
  });

  it('matches production on 28 October 2026: the TestFlight Breeder annual is not a paying breeder', () => {
    // The old function returned the sandbox purchase as an App Store
    // Breeder annual payer. The new one leaves it out and says so.
    const board = {
      paid_plans: [
        { tier: 'breeder', cycle: 'monthly', source: 'stripe', comped: true, n: 1 },
        { tier: 'keeper', cycle: 'monthly', source: 'stripe', comped: false, n: 1 },
      ],
      left_out: { sandbox_store: 1, internal_accounts: 5 },
    };
    const s = summarizePaidPlans(board.paid_plans);
    expect(s.payingBreeders).toBe(0);
    expect(s.mrr).toBeCloseTo(2.99, 2);
    expect(leftOutCounts(board)).toEqual({ known: true, sandbox: 1, internal: 5 });
  });
});

describe('leftOutCounts', () => {
  it('says when the database function is too old to report what it left out', () => {
    expect(leftOutCounts({ paid_plans: [] })).toEqual({ known: false, sandbox: 0, internal: 0 });
    expect(leftOutCounts(null)).toEqual({ known: false, sandbox: 0, internal: 0 });
    expect(leftOutCounts({ left_out: { sandbox_store: '2', internal_accounts: null } })).toEqual({ known: true, sandbox: 2, internal: 0 });
  });
});

describe('entryIsComplete', () => {
  const day = '2026-10-28';
  it('needs a breeder and an amount over zero for a prepaid year', () => {
    expect(entryIsComplete({ kind: 'prepaid', entryDate: day, breederName: 'Crested Co', amount: '120' })).toBe(true);
    expect(entryIsComplete({ kind: 'prepaid', entryDate: day, breederName: '   ', amount: '120' })).toBe(false);
    expect(entryIsComplete({ kind: 'prepaid', entryDate: day, breederName: 'Crested Co', amount: '' })).toBe(false);
    expect(entryIsComplete({ kind: 'prepaid', entryDate: day, breederName: 'Crested Co', amount: '0' })).toBe(false);
  });
  it('keeps the other kinds as they were', () => {
    expect(entryIsComplete({ kind: 'monthly_cost', entryDate: day, amount: '0' })).toBe(true);
    expect(entryIsComplete({ kind: 'monthly_cost', entryDate: day, amount: '' })).toBe(false);
    expect(entryIsComplete({ kind: 'conversation', entryDate: day, breederName: '' })).toBe(true);
    expect(entryIsComplete({ kind: 'import', entryDate: '' })).toBe(false);
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
