import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

const {
  geckoWeighInSetting,
  memberWeighInEnabled,
  withGeckoWeighIn,
  withMemberWeighIn,
} = await import('../careReminders');

describe('weigh-in reminder settings in profiles.extra_data', () => {
  it('is on for the member unless turned off', () => {
    expect(memberWeighInEnabled(null)).toBe(true);
    expect(memberWeighInEnabled({})).toBe(true);
    expect(memberWeighInEnabled(withMemberWeighIn({}, false))).toBe(false);
  });

  it('sets one gecko without touching other keys or geckos', () => {
    const start = { first_touch: { source: 'search' }, care_reminders: { weigh_in: { geckos: { a: { on: true, every_days: 14 } } } } };
    const next = withGeckoWeighIn(start, 'b', { on: true, everyDays: 30, since: '2026-10-05' });
    expect(next.first_touch).toEqual({ source: 'search' });
    expect(geckoWeighInSetting(next, 'a')).toEqual({ on: true, every_days: 14 });
    expect(geckoWeighInSetting(next, 'b')).toEqual({ on: true, every_days: 30, since: '2026-10-05' });
    // The input is not changed in place.
    expect(geckoWeighInSetting(start, 'b')).toBeNull();
  });

  it('keeps the interval within 7 to 90 days', () => {
    expect(geckoWeighInSetting(withGeckoWeighIn({}, 'a', { everyDays: 1 }), 'a').every_days).toBe(7);
    expect(geckoWeighInSetting(withGeckoWeighIn({}, 'a', { everyDays: 400 }), 'a').every_days).toBe(90);
  });

  it('turns a gecko off and keeps the member switch', () => {
    const off = withGeckoWeighIn(withMemberWeighIn({}, true), 'a', { on: false });
    expect(geckoWeighInSetting(off, 'a').on).toBe(false);
    expect(memberWeighInEnabled(off)).toBe(true);
  });
});
