import { describe, expect, it } from 'vitest';
import {
  bredInHouseIds,
  costLinkOptions,
  costLinkValue,
  isSoldGecko,
  ledgerTotals,
  parseCostLink,
  profitByPairing,
  profitBySeason,
  revenueEntries,
  saleAmount,
  saleCategoryFor,
} from '../businessLedger';

const sire = { id: 's1', name: 'Zeus', sex: 'male' };
const dam = { id: 'd1', name: 'Mango', sex: 'female' };

describe('saleAmount', () => {
  it('uses the sold price when entered, even zero for a gecko given away', () => {
    expect(saleAmount({ sold_price: 180, asking_price: 250 })).toEqual({ amount: 180, confirmed: true });
    expect(saleAmount({ sold_price: 0, asking_price: 250 })).toEqual({ amount: 0, confirmed: true });
  });

  it('falls back to the asking price, flagged as not confirmed', () => {
    expect(saleAmount({ sold_price: null, asking_price: '250' })).toEqual({ amount: 250, confirmed: false });
    expect(saleAmount({})).toEqual({ amount: 0, confirmed: false });
  });
});

describe('isSoldGecko', () => {
  it('counts archived-as-sold and status Sold, not old manual-sale placeholders', () => {
    expect(isSoldGecko({ archived: true, archive_reason: 'sold' })).toBe(true);
    expect(isSoldGecko({ status: 'Sold' })).toBe(true);
    expect(isSoldGecko({ archived: true, archive_reason: 'death' })).toBe(false);
    expect(isSoldGecko({ status: 'Sold', notes: '[Manual sale] Lilly White' })).toBe(false);
  });
});

describe('sale category', () => {
  const baby = { id: 'b1', name: 'Pip', sire_id: 's1', dam_id: 'd1' };
  const bought = { id: 'x1', name: 'Rex', sire_id: 'zz', dam_id: 'yy' };

  it('treats geckos with both parents in your records, or hatched from your eggs, as produced in house', () => {
    const ids = bredInHouseIds({ geckos: [sire, dam, baby, bought], eggs: [{ gecko_id: 'e9' }] });
    expect([...ids].sort()).toEqual(['b1', 'e9']);
    expect(saleCategoryFor(baby, ids)).toBe('produced_in_house');
    expect(saleCategoryFor(bought, ids)).toBeNull();
  });

  it('keeps a saved category over the guess', () => {
    expect(saleCategoryFor({ ...baby, sale_category: 'holdback_release' }, new Set(['b1']))).toBe('holdback_release');
    expect(saleCategoryFor({ ...baby, sale_category: 'food' }, new Set())).toBeNull();
  });
});

describe('revenueEntries and totals', () => {
  const geckos = [
    sire,
    dam,
    { id: 'g1', name: 'Pip', archived: true, archive_reason: 'sold', archived_date: '2026-03-10', sold_price: 200, asking_price: 250 },
    { id: 'g2', name: 'Kiwi', status: 'Sold', archived_date: '2025-11-02', asking_price: 150 },
    { id: 'g3', name: 'Keeper', status: 'Holdback', asking_price: 500 },
  ];
  const manualSales = [{ id: 'm1', description: 'Expo sale', amount: '90', date: '2026-05-01', category: 'sale:resale' }];
  const transfers = [
    { id: 't1', status: 'claimed', animal_id: 'g9', sale_price: 400, claimed_at: '2026-08-18T10:00:00Z' },
    { id: 't2', status: 'pending', animal_id: 'g8', sale_price: 300 },
    { id: 't3', status: 'claimed', animal_id: 'g7', sale_price: null, claimed_at: '2026-08-18T11:00:00Z' },
  ];
  const entries = revenueEntries({ geckos, manualSales, transfers, transferNames: { g9: 'Lilly White female' } });

  it('lists sold geckos, typed-in sales and priced claimed transfers, newest first', () => {
    expect(entries.map((e) => e.id)).toEqual(['transfer:t1', 'm1', 'g1', 'g2']);
    expect(entries.find((e) => e.id === 'transfer:t1')).toMatchObject({ name: 'Lilly White female', amount: 400, confirmed: true, geckoId: 'g9' });
    expect(entries.find((e) => e.id === 'm1')).toMatchObject({ amount: 90, category: 'resale' });
  });

  it('leaves out transfers with no price, which may be gifts', () => {
    expect(entries.some((e) => e.id === 'transfer:t3')).toBe(false);
  });

  it('adds up revenue, year to date and the sales still on asking price', () => {
    const totals = ledgerTotals(entries, [{ amount: 120, date: '2026-01-05' }, { amount: '30.5', date: '2025-06-01' }], new Date('2026-09-28'));
    expect(totals.revenue).toBe(200 + 150 + 90 + 400);
    expect(totals.ytdRevenue).toBe(200 + 90 + 400);
    expect(totals.costs).toBe(150.5);
    expect(totals.profit).toBe(840 - 150.5);
    expect(totals.unconfirmed).toBe(1);
  });

  it('splits profit by season', () => {
    const rows = profitBySeason(entries, [{ amount: 120, date: '2026-01-05' }, { amount: 30, date: '2025-06-01' }]);
    expect(rows.map((r) => [r.year, r.revenue, r.costs, r.profit, r.sales])).toEqual([
      [2026, 690, 120, 570, 3],
      [2025, 150, 30, 120, 1],
    ]);
  });
});

describe('profitByPairing', () => {
  const plan = { id: 'p1', sire_id: 's1', dam_id: 'd1', breeding_season: '2026 Spring' };
  const other = { id: 'p2', sire_id: 's1', dam_id: 'd2' };
  const geckos = [
    sire,
    dam,
    { id: 'b1', name: 'Pip', sire_id: 's1', dam_id: 'd1', archived: true, archive_reason: 'sold', archived_date: '2026-08-01', sold_price: 150 },
    { id: 'b2', name: 'Kiwi', sire_id: 's1', dam_id: 'd1', status: 'Holdback' },
  ];
  const eggs = [
    { id: 'e1', breeding_plan_id: 'p1', gecko_id: 'b3' },
    { id: 'e2', breeding_plan_id: 'p1', gecko_id: null },
  ];
  const transfers = [{ id: 't1', status: 'claimed', animal_id: 'b3', sale_price: 220, claimed_at: '2026-09-01' }];
  const entries = revenueEntries({ geckos, transfers, bredIds: bredInHouseIds({ geckos, eggs }) });
  const costs = [
    { amount: 40, breeding_plan_id: 'p1', date: '2026-04-01' },
    { amount: 25, gecko_id: 'b2', date: '2026-07-01' },
    { amount: 999, gecko_id: 'd1', date: '2026-01-01' },
  ];

  it('credits offspring sales, including transferred ones, and charges pairing and offspring costs', () => {
    const rows = profitByPairing({ plans: [plan, other], eggs, geckos, entries, costs, namesById: { s1: 'Zeus', d1: 'Mango' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      label: 'Zeus × Mango',
      season: '2026 Spring',
      eggs: 2,
      hatched: 3,
      sold: 2,
      revenue: 370,
      costs: 65,
      profit: 305,
    });
  });

  it('marks transferred offspring as produced in house', () => {
    expect(entries.find((e) => e.geckoId === 'b3').category).toBe('produced_in_house');
  });
});

describe('cost links', () => {
  it('round-trips a pairing or gecko link through the select value', () => {
    expect(parseCostLink('plan:abc')).toEqual({ breeding_plan_id: 'abc', gecko_id: null });
    expect(parseCostLink('gecko:g:1')).toEqual({ breeding_plan_id: null, gecko_id: 'g:1' });
    expect(parseCostLink('')).toEqual({ breeding_plan_id: null, gecko_id: null });
    expect(costLinkValue({ breeding_plan_id: 'abc' })).toBe('plan:abc');
    expect(costLinkValue({ gecko_id: 'g1' })).toBe('gecko:g1');
    expect(costLinkValue({})).toBe('');
  });

  it('builds pairing and gecko options', () => {
    const { pairings, animals } = costLinkOptions({
      plans: [{ id: 'p1', sire_id: 's1', dam_id: 'd1', pairing_date: '2026-02-01' }],
      geckos: [dam, sire, { id: 'n', name: '' }],
      namesById: { s1: 'Zeus', d1: 'Mango' },
    });
    expect(pairings).toEqual([{ value: 'plan:p1', label: 'Zeus × Mango, 2026' }]);
    expect(animals.map((a) => a.label)).toEqual(['Mango', 'Zeus']);
  });
});
