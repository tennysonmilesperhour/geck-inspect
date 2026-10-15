import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// The app_settings read: `setting` is what the row query answers.
const state = vi.hoisted(() => ({ setting: { data: null, error: null }, reads: [] }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      const call = { table, filters: [] };
      state.reads.push(call);
      const query = {
        select: (cols) => { call.select = cols; return query; },
        eq: (col, val) => { call.filters.push([col, val]); return query; },
        maybeSingle: async () => {
          if (state.setting instanceof Error) throw state.setting;
          return state.setting;
        },
      };
      return query;
    },
  },
}));

const {
  CARE_DEFAULTS_FROM,
  coveredByDefaults,
  effectiveGeckoFeeding,
  effectiveWeighIn,
  effectiveWeighInMap,
  geckoFeedingSetting,
  geckoWeighInSetting,
  isCareDefaultsDay,
  loadCareDefaultsFrom,
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

  it('falls back to the same day as the reminder jobs', () => {
    const sql = readFileSync(
      new URL('../../../supabase/migrations/20261015151100_reminders_and_offline_logging.sql', import.meta.url),
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

describe('the day the defaults start comes from the server setting', () => {
  // A release that lands on 18 Oct stores 2026-10-18 in app_settings, so a
  // gecko added on 17 Oct gets no default reminders from the server. The
  // gecko record has to agree.
  const addedOn17 = { id: 'g17', created_date: '2026-10-17T15:00:00+00:00', weight_grams: 6, hatch_date: null };
  const addedOn18 = { id: 'g18', created_date: '2026-10-18T09:00:00+00:00', weight_grams: 6, hatch_date: null };
  const now = new Date(2026, 9, 20);

  beforeEach(() => {
    state.reads = [];
    state.setting = { data: null, error: null };
  });

  it('reads the public app_settings row', async () => {
    state.setting = { data: { value: '2026-10-18' }, error: null };
    expect(await loadCareDefaultsFrom({ refresh: true })).toBe('2026-10-18');
    expect(state.reads[0]).toEqual({
      table: 'app_settings',
      select: 'value',
      filters: [['key', 'care_reminder_defaults_from']],
    });
  });

  it('keeps a good read for the page load, and refresh reads again', async () => {
    state.setting = { data: { value: '2026-10-19' }, error: null };
    expect(await loadCareDefaultsFrom({ refresh: true })).toBe('2026-10-19');
    state.setting = { data: { value: '2026-10-25' }, error: null };
    expect(await loadCareDefaultsFrom()).toBe('2026-10-19');
    expect(state.reads).toHaveLength(1);
    expect(await loadCareDefaultsFrom({ refresh: true })).toBe('2026-10-25');
  });

  it('falls back to CARE_DEFAULTS_FROM when the row is missing, and asks again next time', async () => {
    state.setting = { data: null, error: null };
    expect(await loadCareDefaultsFrom({ refresh: true })).toBe(CARE_DEFAULTS_FROM);
    // The migration ran in the meantime.
    state.setting = { data: { value: '2026-10-18' }, error: null };
    expect(await loadCareDefaultsFrom()).toBe('2026-10-18');
  });

  it('falls back when the read fails', async () => {
    state.setting = { data: null, error: { code: '42501', message: 'permission denied' } };
    expect(await loadCareDefaultsFrom({ refresh: true })).toBe(CARE_DEFAULTS_FROM);
    state.setting = new Error('Failed to fetch');
    expect(await loadCareDefaultsFrom({ refresh: true })).toBe(CARE_DEFAULTS_FROM);
  });

  it.each([
    ['not a real day', '2026-02-30'],
    ['a month 13', '2026-13-01'],
    ['words', 'soon'],
    ['a timestamp', '2026-10-18T00:00:00Z'],
    ['a number', 20261018],
    ['an object', { day: '2026-10-18' }],
    ['an empty string', ''],
  ])('falls back on a malformed value (%s)', async (_label, value) => {
    state.setting = { data: { value }, error: null };
    expect(await loadCareDefaultsFrom({ refresh: true })).toBe(CARE_DEFAULTS_FROM);
  });

  it('checks a day the way the SQL does', () => {
    expect(isCareDefaultsDay('2026-10-16')).toBe(true);
    expect(isCareDefaultsDay('2028-02-29')).toBe(true);
    expect(isCareDefaultsDay('2026-02-29')).toBe(false);
    expect(isCareDefaultsDay('26-10-16')).toBe(false);
    expect(isCareDefaultsDay(null)).toBe(false);
  });

  it('decides which geckos get default reminders from that day', () => {
    // Fallback day (16 Oct): both are new.
    expect(coveredByDefaults(addedOn17)).toBe(true);
    expect(coveredByDefaults(addedOn18)).toBe(true);
    // The stored day (18 Oct): only the gecko added on release day or later.
    expect(coveredByDefaults(addedOn17, '2026-10-18')).toBe(false);
    expect(coveredByDefaults(addedOn18, '2026-10-18')).toBe(true);
    // A bad day passed in is ignored, like a bad row.
    expect(coveredByDefaults(addedOn17, '2026-02-30')).toBe(true);

    const opts = { now, defaultsFrom: '2026-10-18' };
    expect(effectiveWeighIn({}, addedOn17, opts)).toMatchObject({ on: false, source: 'none' });
    expect(effectiveWeighIn({}, addedOn18, opts)).toMatchObject({ on: true, everyDays: 14, source: 'default' });
    expect(effectiveGeckoFeeding({}, addedOn17, { defaultsFrom: '2026-10-18' })).toMatchObject({ on: false, source: 'none' });
    expect(effectiveGeckoFeeding({}, addedOn18, { defaultsFrom: '2026-10-18' })).toMatchObject({ on: true, source: 'default' });
    expect(Object.keys(effectiveWeighInMap({}, [addedOn17, addedOn18], { defaultsFrom: '2026-10-18' }))).toEqual(['g18']);
    // Without the option the fallback day still applies.
    expect(Object.keys(effectiveWeighInMap({}, [addedOn17, addedOn18])).sort()).toEqual(['g17', 'g18']);
  });

  it('a choice the member made still wins over the day', () => {
    const on = withGeckoWeighIn({}, 'g17', { on: true, everyDays: 14 });
    expect(effectiveWeighIn(on, addedOn17, { now, defaultsFrom: '2026-10-18' })).toMatchObject({ on: true, source: 'chosen' });
    const fed = withGeckoFeeding({}, 'g17', { on: true });
    expect(effectiveGeckoFeeding(fed, addedOn17, { defaultsFrom: '2026-10-18' })).toMatchObject({ on: true, source: 'chosen' });
  });
});
