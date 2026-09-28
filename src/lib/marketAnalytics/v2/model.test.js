import { describe, it, expect } from 'vitest';
import {
  askingPriceIndex, topMovers, marketTemperature, ageHeatmap, growOut, supplyShift, valuePipeline, MIN_MOVER_N,
} from './model';
import { DEMO_AGGREGATES, DEMO_PIPELINE } from './demoAggregates';

describe('market analytics v2 model', () => {
  it('anchors the index at 1,000 and leaves the outage weeks empty', () => {
    const idx = askingPriceIndex(DEMO_AGGREGATES);
    expect(idx.series[0].index).toBe(1000);
    expect(idx.series.find((s) => s.week === '07-06').index).toBeNull();
    // Aug 24 median $255 against the May 11 median $300.
    expect(idx.value).toBe(850);
    expect(idx.change_pct).toBeCloseTo(-15, 5);
  });

  it('only ranks movers with enough listings on both sides', () => {
    const { up, down } = topMovers(DEMO_AGGREGATES);
    for (const r of [...up, ...down]) {
      expect(r.spring[0]).toBeGreaterThanOrEqual(MIN_MOVER_N);
      expect(r.late[0]).toBeGreaterThanOrEqual(MIN_MOVER_N);
    }
    expect(up.every((r) => r.change_pct > 0)).toBe(true);
    expect(down.every((r) => r.change_pct < 0)).toBe(true);
    // Fringing has 6 late listings, so it never shows despite a big jump.
    expect([...up, ...down].some((r) => r.name === 'Fringing')).toBe(false);
  });

  it('keeps temperature scores on the 0 to 100 scale', () => {
    const temps = marketTemperature(DEMO_AGGREGATES);
    expect(temps.length).toBeGreaterThan(6);
    for (const t of temps) {
      expect(t.score).toBeGreaterThanOrEqual(0);
      expect(t.score).toBeLessThanOrEqual(100);
    }
  });

  it('clips the heatmap color scale below the single most expensive cell', () => {
    const map = ageHeatmap(DEMO_AGGREGATES);
    expect(map.top).toBe(1500);
    expect(map.max).toBeLessThan(map.top);
  });

  it('subtracts upkeep from the grow-out edge', () => {
    const rows = growOut(DEMO_AGGREGATES, { from: 'baby', monthlyCost: 10 });
    const lilly = rows.find((r) => r.name === 'Lilly White');
    // $278 baby, $500 adult, 14 months at $10.
    expect(lilly.upkeep).toBe(140);
    expect(lilly.net).toBe(500 - 278 - 140);
  });

  it('computes supply shares that compare periods, not raw counts', () => {
    const rows = supplyShift(DEMO_AGGREGATES);
    const lilly = rows.find((r) => r.name === 'Lilly White');
    expect(lilly.late_share).toBeGreaterThan(lilly.spring_share);
  });

  it('values a clutch from its best trait at baby age', () => {
    const [first] = valuePipeline(DEMO_AGGREGATES, DEMO_PIPELINE);
    // Lilly White babies ($278) beat Harlequin babies ($125).
    expect(first.each.mid).toBe(278);
    expect(first.total.mid).toBe(278 * first.eggs);
  });
});
