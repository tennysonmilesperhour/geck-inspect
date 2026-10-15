import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

const {
  CARE_DEFAULTS_FROM,
  effectiveGeckoFeeding,
  effectiveWeighIn,
  effectiveWeighInMap,
  geckoFeedingSetting,
  geckoWeighInSetting,
  memberWeighInEnabled,
  withGeckoFeeding,
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

describe('reminders that follow the animal (review item E2 15)', () => {
  const now = new Date(2026, 9, 20);
  const fresh = { id: 'new1', created_date: '2026-10-18T09:00:00+00:00', weight_grams: null, hatch_date: null };
  const adult = { id: 'new2', created_date: '2026-10-18T09:00:00+00:00', weight_grams: 44, hatch_date: '2023-06-01' };
  const old = { id: 'old1', created_date: '2026-09-01T09:00:00+00:00', weight_grams: 20, hatch_date: null };

  it('starts on the same day as the reminder jobs', () => {
    const sql = readFileSync(
      new URL('../../../supabase/migrations/20261016100000_reminders_and_offline_logging.sql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain(`select date '${CARE_DEFAULTS_FROM}';`);
  });

  it('a new gecko gets a weigh-in reminder by its life stage with no settings at all', () => {
    expect(effectiveWeighIn({}, fresh, { now })).toMatchObject({ on: true, everyDays: 14, source: 'default' });
    expect(effectiveWeighIn({}, adult, { now })).toMatchObject({ on: true, everyDays: 30, source: 'default' });
  });

  it('a gecko from before the defaults has none until switched on', () => {
    expect(effectiveWeighIn({}, old, { now })).toMatchObject({ on: false, source: 'none' });
    const on = withGeckoWeighIn({}, 'old1', { on: true, everyDays: 14 });
    // The stored 14 was only what the screen showed: a 20 g sub-adult is weighed every 21 days.
    expect(effectiveWeighIn(on, old, { now })).toMatchObject({ on: true, everyDays: 21, source: 'chosen', fixed: false });
  });

  it('the member can switch one off, pick a cadence, or turn all off', () => {
    expect(effectiveWeighIn(withGeckoWeighIn({}, 'new1', { on: false }), fresh, { now }).on).toBe(false);
    const picked = withGeckoWeighIn({}, 'new1', { on: true, everyDays: 28, fixed: true });
    expect(effectiveWeighIn(picked, fresh, { now })).toMatchObject({ on: true, everyDays: 28, fixed: true });
    const allOff = withMemberWeighIn({}, false);
    expect(effectiveWeighIn(allOff, fresh, { now })).toMatchObject({ on: false, memberEnabled: false, source: 'default' });
  });

  it('lists every gecko with a reminder for the phone schedule', () => {
    const map = effectiveWeighInMap({}, [fresh, adult, old, { ...fresh, id: 'gone', archived: true }]);
    expect(Object.keys(map).sort()).toEqual(['new1', 'new2']);
    expect(map.new1).toMatchObject({ on: true, since: '2026-10-18' });
  });

  it('feeds a new gecko on its own every 3 days, unless it is in a group or switched off', () => {
    expect(effectiveGeckoFeeding({}, fresh)).toEqual({ on: true, everyDays: 3, source: 'default' });
    expect(effectiveGeckoFeeding({}, { ...fresh, feeding_group_id: 'g1' }).source).toBe('group');
    expect(effectiveGeckoFeeding({}, old)).toMatchObject({ on: false, source: 'none' });
    const off = withGeckoFeeding({ first_touch: { a: 1 } }, 'new1', { on: false });
    expect(off.first_touch).toEqual({ a: 1 });
    expect(effectiveGeckoFeeding(off, fresh)).toMatchObject({ on: false, source: 'chosen' });
    const every4 = withGeckoFeeding({}, 'new1', { on: true, everyDays: 4 });
    expect(geckoFeedingSetting(every4, 'new1')).toEqual({ on: true, every_days: 4 });
    expect(effectiveGeckoFeeding(withGeckoFeeding({}, 'x', { everyDays: 99 }), { id: 'x' }).everyDays).toBe(30);
  });
});
