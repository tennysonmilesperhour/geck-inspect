import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  PENDING_GECKO_KEY,
  addDaysISO,
  careSchedule,
  cleanDraft,
  clearPendingGecko,
  readPendingGecko,
  savePendingGecko,
  weighInIntervalDays,
} = await import('../firstGeckoFlow');

describe('guest draft carried through sign-up', () => {
  beforeEach(() => store.clear());

  it('keeps only known fields and needs a name', () => {
    expect(cleanDraft({ name: '  ' })).toBeNull();
    const draft = cleanDraft({ name: ' Mango ', sex: 'Female', morphs_traits: 'Lilly White', weight_grams: '22', created_by: 'x', is_public: true });
    expect(draft).toEqual({ name: 'Mango', sex: 'Female', morphs_traits: 'Lilly White', weight_grams: 22 });
  });

  it('drops bad sex, weight and date values', () => {
    const draft = cleanDraft({ name: 'Pip', sex: 'Maybe', weight_grams: -3, hatch_date: 'last spring' });
    expect(draft.sex).toBe('Unsexed');
    expect(draft.weight_grams).toBeNull();
    expect(draft.hatch_date).toBeNull();
  });

  it('saves, reads back and clears', () => {
    expect(savePendingGecko({ name: 'Mango', morphs_traits: 'Harlequin' }, 1000)).toBe(true);
    expect(readPendingGecko(2000)).toMatchObject({ name: 'Mango', morphs_traits: 'Harlequin' });
    clearPendingGecko();
    expect(readPendingGecko(2000)).toBeNull();
  });

  it('forgets a draft after two weeks', () => {
    savePendingGecko({ name: 'Mango' }, 0);
    expect(readPendingGecko(15 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(store.has(PENDING_GECKO_KEY)).toBe(false);
  });
});

describe('care schedule on the payoff screen', () => {
  const now = new Date(2026, 9, 5);

  it('weighs growing geckos every 14 days and adults every 30', () => {
    expect(weighInIntervalDays({ hatch_date: null }, now)).toBe(14);
    expect(weighInIntervalDays({ hatch_date: '2026-05-01' }, now)).toBe(14);
    expect(weighInIntervalDays({ hatch_date: '2024-01-01' }, now)).toBe(30);
  });

  it('adds days across a month end', () => {
    expect(addDaysISO('2026-10-25', 14)).toBe('2026-11-08');
    expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('puts the first weigh-in today when there is no weight', () => {
    const s = careSchedule({ gecko: {}, lastWeighDate: null, group: null, today: '2026-10-05' });
    expect(s.weighIn).toEqual({ hasWeight: false, everyDays: 14, dueDate: '2026-10-05' });
    expect(s.feeding).toBeNull();
  });

  it('counts the next weigh-in and feeding from the last ones', () => {
    const s = careSchedule({
      gecko: { hatch_date: '2023-06-01' },
      lastWeighDate: '2026-10-05',
      group: { interval_days: 3, last_fed_date: '2026-10-05', diet_type: 'CGD' },
      today: '2026-10-05',
    });
    expect(s.weighIn.dueDate).toBe('2026-11-04');
    expect(s.feeding).toEqual({ everyDays: 3, nextDate: '2026-10-08', diet: 'CGD' });
  });
});
