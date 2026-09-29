import { describe, it, expect } from 'vitest';
import {
  askingPriceIndex, topMovers, marketTemperature, ageHeatmap, growOut, supplyShift,
  valuePipeline, weekAxis, periodLabels, soldWindowWeeks, MIN_MOVER_N,
} from './model';
import { DEMO_AGGREGATES, DEMO_PIPELINE } from './demoAggregates';

describe('market analytics v2 model', () => {
  it('builds the week axis from the data and finds the outage', () => {
    const { full, axis, gaps } = weekAxis(DEMO_AGGREGATES);
    // Tracking started Saturday May 9, so the first full week is May 11.
    expect(full[0]).toBe('2026-05-04');
    expect(axis[0]).toBe('2026-05-11');
    expect(axis[axis.length - 1]).toBe('2026-08-24');
    expect(gaps).toEqual([{ from: '2026-06-15', to: '2026-08-10' }]);
  });

  it('labels periods by the weeks that hold listings', () => {
    const p = periodLabels(DEMO_AGGREGATES);
    expect(p.earlier).toBe('May 9 to Jun 14');
    expect(p.recent).toBe('Aug 17 to Aug 29');
    expect(p.earlierShort).toBe('May to Jun');
    expect(p.recentShort).toBe('Aug');
    expect(soldWindowWeeks(DEMO_AGGREGATES)).toBe(3);
  });

  it('anchors the index at 1,000 and leaves the outage weeks empty', () => {
    const idx = askingPriceIndex(DEMO_AGGREGATES);
    expect(idx.series[0].index).toBe(1000);
    expect(idx.anchor_median).toBe(300);
    expect(idx.series.find((s) => s.week === '2026-07-06').index).toBeNull();
    // Aug 24 median $250 against the May 11 median $300.
    expect(idx.value).toBe(833);
    expect(idx.gaps).toEqual([{ from: 'Jun 15', to: 'Aug 10' }]);
  });

  it('only ranks movers with enough listings on both sides', () => {
    const { up, down } = topMovers(DEMO_AGGREGATES);
    expect(up.length + down.length).toBeGreaterThan(4);
    for (const r of [...up, ...down]) {
      expect(r.earlier[0]).toBeGreaterThanOrEqual(MIN_MOVER_N);
      expect(r.recent[0]).toBeGreaterThanOrEqual(MIN_MOVER_N);
    }
    expect(up.every((r) => r.change_pct > 0)).toBe(true);
    expect(down.every((r) => r.change_pct < 0)).toBe(true);
    // Quad-stripe has 7 recent listings, so it never shows.
    expect([...up, ...down].some((r) => r.name === 'Quad-stripe')).toBe(false);
  });

  it('keeps temperature scores on the 0 to 100 scale, even without sales data', () => {
    const noSales = { ...DEMO_AGGREGATES, kpis: { ...DEMO_AGGREGATES.kpis, sell_through: null, avg_days_to_sell: null } };
    for (const agg of [DEMO_AGGREGATES, noSales]) {
      const temps = marketTemperature(agg);
      expect(temps.length).toBeGreaterThan(6);
      for (const t of temps) {
        expect(t.score).toBeGreaterThanOrEqual(0);
        expect(t.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('clips the heatmap color scale below the most expensive cell', () => {
    const map = ageHeatmap(DEMO_AGGREGATES);
    expect(map.max).toBeLessThan(map.top);
    // Axanthic has no age split, so it stays off the map.
    expect(map.rows.some((r) => r.name === 'Axanthic')).toBe(false);
  });

  it('subtracts upkeep from the grow-out edge', () => {
    const rows = growOut(DEMO_AGGREGATES, { from: 'baby', monthlyCost: 10 });
    const lilly = rows.find((r) => r.name === 'Lilly White');
    // $250 baby, $500 adult, 14 months at $10.
    expect(lilly.upkeep).toBe(140);
    expect(lilly.net).toBe(500 - 250 - 140);
  });

  it('computes supply shares that compare periods, not raw counts', () => {
    const rows = supplyShift(DEMO_AGGREGATES);
    const harlequin = rows.find((r) => r.name === 'Harlequin');
    expect(harlequin.recent_share).toBeGreaterThan(0);
    expect(harlequin.delta).toBeCloseTo(harlequin.recent_share - harlequin.earlier_share, 8);
  });

  it('values a clutch from its best trait at baby age, and flags unpriced ones', () => {
    const [first] = valuePipeline(DEMO_AGGREGATES, DEMO_PIPELINE);
    // Lilly White babies ($250) beat Harlequin babies ($120).
    expect(first.each.mid).toBe(250);
    expect(first.total.mid).toBe(250 * first.eggs);
    const [none] = valuePipeline(DEMO_AGGREGATES, [{ id: 'x', pair: 'A x B', traits: [], eggs: 2, due: null }]);
    expect(none.priced).toBe(false);
    expect(none.total.mid).toBe(0);
  });
});
