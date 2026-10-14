import { describe, expect, it } from 'vitest';
import {
  DEMO_BREEDER_CLUTCHES,
  DEMO_BREEDER_COSTS,
  DEMO_BREEDER_EGGS,
  DEMO_BREEDER_FINANCIAL_ASSUMPTIONS,
  DEMO_BREEDER_GECKOS,
  DEMO_BREEDER_PLANS,
  validateDemoBreederLedger,
} from '../guestBreederDemo';
import { profitBySeason, revenueEntries } from '../businessLedger';
import { guestMockList } from '../guestMockData';

describe('synthetic guest breeder demo', () => {
  it('reconciles parent, pairing, egg, hatchling, clutch and sale records', () => {
    expect(validateDemoBreederLedger()).toEqual([]);
    const originalParentIds = new Set(['mock-gecko-gp1-diamond', 'mock-gecko-gp2-ruby', 'mock-gecko-gp4-sunny', 'mock-gecko-1', 'mock-gecko-2', 'mock-gecko-3', 'mock-gecko-5', 'mock-gecko-12', 'mock-gecko-8']);
    for (const plan of DEMO_BREEDER_PLANS) {
      expect(originalParentIds.has(plan.sire_id)).toBe(true);
      expect(originalParentIds.has(plan.dam_id)).toBe(true);
    }
    expect(DEMO_BREEDER_EGGS).toHaveLength(24);
    expect(DEMO_BREEDER_CLUTCHES.reduce((sum, c) => sum + c.egg_count, 0)).toBe(DEMO_BREEDER_EGGS.length);
    expect(DEMO_BREEDER_GECKOS.filter((g) => g.archived && g.archive_reason === 'sold')).toHaveLength(20);
    expect(DEMO_BREEDER_GECKOS.filter((g) => !g.archived)).toHaveLength(4);
    for (const gecko of DEMO_BREEDER_GECKOS) {
      expect(DEMO_BREEDER_EGGS.some((egg) => egg.gecko_id === gecko.id)).toBe(true);
      expect(gecko.hatch_date <= (gecko.archived_date?.slice(0, 10) ?? '2026-10-13')).toBe(true);
    }
  });

  it('shows two positive fictional seasons and a downside season after listed costs', async () => {
    // The business ledger includes all guest geckos, including an older
    // synthetic retired-breeder sale outside the three featured pairings.
    const entries = revenueEntries({ geckos: await guestMockList('Gecko'), eggs: DEMO_BREEDER_EGGS });
    const seasons = profitBySeason(entries, DEMO_BREEDER_COSTS);
    expect(seasons.map(({ year, sales, revenue, costs, profit }) => ({ year, sales, revenue, costs, profit }))).toEqual([
      { year: 2026, sales: 6, revenue: 12100, costs: 7260, profit: 4840 },
      { year: 2025, sales: 9, revenue: 16245, costs: 8730, profit: 7515 },
      { year: 2024, sales: 6, revenue: 6630, costs: 10090, profit: -3460 },
    ]);
    expect(DEMO_BREEDER_FINANCIAL_ASSUMPTIONS.label).toBe('Demo data • Fictional results, not expected earnings');
    expect(DEMO_BREEDER_FINANCIAL_ASSUMPTIONS.excluded).toContain('Income taxes');
  });

  it('serves every demo ledger table through isolated guest reads', async () => {
    const [geckos, plans, eggs, clutches, costs] = await Promise.all([
      guestMockList('Gecko'),
      guestMockList('BreedingPlan'),
      guestMockList('Egg'),
      guestMockList('Clutch'),
      guestMockList('MarketplaceCost'),
    ]);
    const geckoIds = new Set(geckos.map((g) => g.id));
    expect(DEMO_BREEDER_PLANS.every((p) => geckoIds.has(p.sire_id) && geckoIds.has(p.dam_id))).toBe(true);
    expect(plans.some((p) => p.id === DEMO_BREEDER_PLANS[0].id)).toBe(true);
    expect(eggs.filter((e) => e.id.startsWith('mock-demo-egg-'))).toHaveLength(DEMO_BREEDER_EGGS.length);
    expect(clutches.filter((c) => c.id.startsWith('mock-demo-clutch-'))).toHaveLength(12);
    expect(costs).toHaveLength(DEMO_BREEDER_COSTS.length);
    expect(costs.every((c) => c.user_email === 'guest@local')).toBe(true);
  });
});
