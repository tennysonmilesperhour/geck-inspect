import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

import { buildTraitValueIndex } from '../traitValuation';
import { productionValue } from '../breedingValue';

const band = (trait, age, sex, n, p25, p50, p75) => ({ trait, aliases: [trait.toLowerCase()], age_class: age, sex_class: sex, n, p25, p50, p75 });
const index = buildTraitValueIndex([
  band('Lilly White', 'any', 'any', 600, 250, 375, 600),
  band('Lilly White', 'hatchling', 'unsexed', 80, 200, 300, 450),
  band('Dalmatian', 'any', 'any', 400, 100, 180, 300),
  band('Dalmatian', 'hatchling', 'unsexed', 60, 65, 100, 150),
  band('Dalmatian', 'adult', 'any', 90, 150, 220, 320),
]);

const sire = { id: 's', sex: 'Male', morph_tags: ['Dalmatian'] };
const dam = { id: 'd', sex: 'Female', morph_tags: ['Dalmatian'] };
const plans = [{ id: 'p1', sire_id: 's', dam_id: 'd' }];
const NOW = new Date('2026-10-06T12:00:00Z');

describe('productionValue', () => {
  it('is zero without the price table', () => {
    expect(productionValue({ plans, eggs: [{ status: 'Hatched' }], geckos: [sire, dam] }).lifetime).toBe(0);
  });

  it('values unlinked eggs at the pairing value and splits out this season', () => {
    const eggs = [
      { id: 'e1', breeding_plan_id: 'p1', status: 'Incubating', lay_date: '2026-08-01' },
      { id: 'e2', breeding_plan_id: 'p1', status: 'Hatched', lay_date: '2025-05-01', hatch_date_actual: '2025-07-01', archived: true },
      { id: 'e3', breeding_plan_id: 'p1', status: 'Slug', lay_date: '2026-08-01' },
      { id: 'e4', breeding_plan_id: 'p1', status: 'Incubating', lay_date: '2026-06-01', archived: true },
    ];
    const v = productionValue({ plans, eggs, geckos: [sire, dam], index, now: NOW });
    expect(v.lifetimeEggs).toBe(2);
    expect(v.seasonEggs).toBe(1);
    expect(v.lifetime).toBeGreaterThan(v.season);
    expect(v.season).toBeGreaterThan(0);
  });

  it('values a hatched egg by its gecko when linked', () => {
    const baby = { id: 'g1', morph_tags: ['Lilly White'], weight_grams: 5 };
    const eggs = [{ id: 'e1', breeding_plan_id: 'p1', status: 'Hatched', lay_date: '2026-05-01', hatch_date_actual: '2026-07-01', gecko_id: 'g1' }];
    const v = productionValue({ plans, eggs, geckos: [sire, dam, baby], index, now: NOW });
    expect(v.season).toBe(300);
    expect(v.lifetime).toBe(300);
  });

  it('counts eggs it cannot price separately', () => {
    const eggs = [{ id: 'e1', breeding_plan_id: 'missing', status: 'Incubating', lay_date: '2026-08-01' }];
    const v = productionValue({ plans, eggs, geckos: [sire, dam], index, now: NOW });
    expect(v.unpriced).toBe(1);
    expect(v.lifetime).toBe(0);
  });
});
