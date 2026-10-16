import { describe, it, expect, vi } from 'vitest';

// useMemo just runs its function here, so the hook can be called directly.
vi.mock('react', async (orig) => ({ ...(await orig()), useMemo: (fn) => fn() }));
const { useWeightHealthScore } = await import('../useWeightHealthScore');

describe('useWeightHealthScore', () => {
  it('reads weight records as the database returns them (weight_grams, record_date)', () => {
    const rows = [
      { weight_grams: 30, record_date: '2026-08-01' },
      { weight_grams: 31, record_date: '2026-08-15' },
      { weight_grams: 32, record_date: '2026-09-01' },
      { weight_grams: 35, record_date: '2026-09-15' },
      { weight_grams: 38, record_date: '2026-10-01' },
    ];
    const h = useWeightHealthScore(rows);
    expect(h.score).toBe('growing');
    expect(h.smoothedRecords.length).toBeGreaterThan(0);
  });

  it('flags a real drop', () => {
    const rows = [40, 40, 40, 34, 33].map((w, i) => ({ weight_grams: w, record_date: `2026-09-0${i + 1}` }));
    expect(useWeightHealthScore(rows).score).toBe('critical');
  });

  it('still accepts the older weight and date fields', () => {
    const rows = [{ weight: 20, date: '2026-09-01' }, { weight: 20, date: '2026-09-10' }];
    expect(useWeightHealthScore(rows).score).toBe('stable');
  });
});
