import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The database drops a repeat hatch alert (same egg within 20 hours) by
// returning no row, which the entity client reports as PGRST116. Before
// the October 2026 release the app logged a warning and tried again on every 15-minute
// poll; now it treats the egg as already alerted.
const state = vi.hoisted(() => ({ createError: null, created: [], recent: [], filterCalls: [] }));
vi.mock('@/entities/all', () => ({
  Egg: { filter: async () => state.eggs },
  Notification: {
    filter: async (...args) => {
      state.filterCalls.push(args);
      return state.recent;
    },
    create: async (row) => {
      state.created.push(row);
      if (state.createError) throw state.createError;
      return { id: 'n1', ...row };
    },
  },
}));
vi.mock('@/lib/pagePolling', () => ({ startVisiblePolling: () => () => {} }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));

const { default: HatchAlertSystem } = await import('../HatchAlertSystem');
const { isDroppedRepeatNotification } = await import('@/lib/notificationsApi');

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let store;
let tree;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  });
  state.created = [];
  state.createError = null;
  state.recent = [];
  state.filterCalls = [];
  // A Lilly White clutch egg, 65 days in, past the default 60-day alert.
  state.eggs = [{ id: 'egg-1', status: 'Incubating', archived: false, lay_date: isoDaysAgo(65) }];
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  vi.unstubAllGlobals();
});

async function runOnce() {
  await act(async () => {
    tree = create(<HatchAlertSystem user={{ email: 'keeper@example.com' }} />);
  });
  // Let the async egg check finish.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe('hatch alerts the database already sent', () => {
  it('recognises the empty result of a dropped repeat', () => {
    expect(isDroppedRepeatNotification({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })).toBe(true);
    expect(isDroppedRepeatNotification({ code: '42501' })).toBe(false);
    expect(isDroppedRepeatNotification(null)).toBe(false);
  });

  it('marks the egg as alerted when the database drops the repeat', async () => {
    state.createError = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' };
    await runOnce();
    expect(state.created).toHaveLength(1);
    expect(store.has('geck_hatch_notified_egg-1')).toBe(true);
  });

  it('marks the egg after a normal alert', async () => {
    await runOnce();
    expect(state.created).toHaveLength(1);
    expect(store.has('geck_hatch_notified_egg-1')).toBe(true);
  });

  it('leaves the egg unmarked after a real failure, so the next poll retries', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.createError = { code: '08006', message: 'network down' };
    await runOnce();
    expect(state.created).toHaveLength(1);
    expect(store.has('geck_hatch_notified_egg-1')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('eggs the server already counted', () => {
  const hoursAgo = (h) => new Date(Date.now() - h * 36e5).toISOString();

  beforeEach(() => {
    // A Lilly White x Harlequin clutch: three eggs past the alert day.
    state.eggs = ['egg-1', 'egg-2', 'egg-3'].map((id) => ({ id, status: 'Incubating', archived: false, lay_date: isoDaysAgo(65) }));
  });

  it('asks for every hatch alert of the last 7 days, not the newest 50', async () => {
    const before = Date.now();
    await runOnce();
    const [where, sort, limit] = state.filterCalls[0];
    expect(where).toMatchObject({ user_email: 'keeper@example.com', type: 'hatch_alert' });
    const since = Date.parse(where.created_date?.$gte);
    expect(Math.abs(since - (before - 7 * 24 * 36e5))).toBeLessThan(60 * 1000);
    expect(sort).toBe('-created_date');
    expect(limit).toBeGreaterThanOrEqual(1000);
  });

  it('treats every egg the grouped alert lists as alerted', async () => {
    // The nightly job's one alert for the day names egg-1 and counts the rest.
    state.recent = [
      { created_date: hoursAgo(3), metadata: { egg_id: 'egg-1', egg_ids: ['egg-1', 'egg-2', 'egg-3'], count: 3, source: 'cron' } },
    ];
    await runOnce();
    expect(state.created).toHaveLength(0);
  });

  it('treats an egg with a quiet row as alerted', async () => {
    state.recent = [
      { created_date: hoursAgo(30), metadata: { egg_id: 'egg-1', egg_ids: ['egg-1', 'egg-2'], count: 2, source: 'cron' } },
      { created_date: hoursAgo(30), metadata: { egg_id: 'egg-3', quiet: true, grouped_in: 'egg-1', source: 'cron' } },
    ];
    await runOnce();
    expect(state.created).toHaveLength(0);
  });

  it('still alerts an egg no recent row covers', async () => {
    state.recent = [
      { created_date: hoursAgo(3), metadata: { egg_id: 'egg-1', egg_ids: ['egg-1', 'egg-2'], count: 2 } },
      // Eight days old: outside the 7-day look back.
      { created_date: hoursAgo(8 * 24), metadata: { egg_id: 'egg-3' } },
    ];
    await runOnce();
    expect(state.created.map((row) => row.metadata.egg_id)).toEqual(['egg-3']);
  });
});
