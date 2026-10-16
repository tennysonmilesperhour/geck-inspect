// The analytics screens read every row, not the first 1,000 (engineering
// cleanup, 16 Oct 2026). The fake API below answers like PostgREST with the
// project's row limit: never more than 1,000 rows per request, whatever
// range is asked for.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => {
  const state = { rows: {}, maxRows: 1000, requests: [] };
  function builder(source, args, opts) {
    const q = { source, args, opts, columns: null, filters: [], orders: [], range: null };
    const self = {
      select(columns, options) { q.columns = columns; if (options) q.opts = options; return self; },
      gte(col, val) { q.filters.push([col, val]); return self; },
      order(col, o) { q.orders.push([col, o?.ascending]); return self; },
      range(from, to) {
        q.range = [from, to];
        state.requests.push(q);
        let all = state.rows[source] || [];
        for (const [col, val] of q.filters) all = all.filter((r) => r[col] >= val);
        const page = all.slice(from, Math.min(to + 1, from + state.maxRows));
        const count = q.opts?.count === 'exact' ? all.length : null;
        return Promise.resolve({ data: page, error: null, count });
      },
    };
    return self;
  }
  return {
    state,
    supabase: {
      from: (table) => builder(table),
      rpc: (fn, args, opts) => builder(`rpc:${fn}`, args, opts),
    },
  };
});

vi.mock('@/lib/supabaseClient', () => ({ supabase: api.supabase }));

import {
  activityLabel,
  ADMIN_PAGE_SIZE,
  analyticsLoadNotice,
  fetchAdminTable,
  fetchAllProfiles,
  fetchAllRows,
  USER_EVENT_COLUMNS,
} from '../adminData';

const events = (n, start = '2026-04-18T00:00:00.000Z') => Array.from({ length: n }, (_, i) => ({
  id: `e${String(i).padStart(6, '0')}`,
  event_name: i % 3 ? 'page_view' : 'weight_logged',
  created_date: new Date(Date.parse(start) + i * 60_000).toISOString(),
}));

beforeEach(() => {
  api.state.rows = {};
  api.state.maxRows = 1000;
  api.state.requests = [];
});

describe('fetchAdminTable', () => {
  it('reads all 12,043 user_events rows, not the first 1,000', async () => {
    api.state.rows.user_events = events(12043);
    const rows = await fetchAdminTable('user_events', USER_EVENT_COLUMNS);
    expect(rows).toHaveLength(12043);
    expect(new Set(rows.map((r) => r.id)).size).toBe(12043);
    expect(rows.truncated).toBe(false);
    // 13 pages of 1,000; only the first asks for the total.
    expect(api.state.requests).toHaveLength(13);
    expect(api.state.requests[0].opts).toEqual({ count: 'exact' });
    expect(api.state.requests[1].opts).toBeUndefined();
    // Only the columns the charts use, in a stable order.
    expect(api.state.requests[0].columns).toBe(USER_EVENT_COLUMNS);
    expect(api.state.requests[0].orders).toEqual([['created_date', true], ['id', true]]);
  });

  it('applies the since date', async () => {
    api.state.rows.user_events = events(3000);
    const since = api.state.rows.user_events[2500].created_date;
    const rows = await fetchAdminTable('user_events', USER_EVENT_COLUMNS, { since });
    expect(rows).toHaveLength(500);
  });

  it('keeps going when the server pages are smaller than asked for', async () => {
    api.state.maxRows = 400;
    api.state.rows.gecko_images = events(3809);
    const rows = await fetchAdminTable('gecko_images', 'id,created_by,created_date');
    expect(rows).toHaveLength(3809);
  });

  it('a table smaller than one page takes one request', async () => {
    api.state.rows.forum_posts = events(13);
    const rows = await fetchAdminTable('forum_posts', 'id,created_by,created_date');
    expect(rows).toHaveLength(13);
    expect(api.state.requests).toHaveLength(1);
  });
});

describe('fetchAllProfiles', () => {
  it('pages through read_profiles with no email filter', async () => {
    api.state.rows['rpc:read_profiles'] = events(1500).map((r) => ({ id: r.id, email: `${r.id}@example.test`, created_date: r.created_date }));
    const rows = await fetchAllProfiles('id,email,role,created_date');
    expect(rows).toHaveLength(1500);
    expect(api.state.requests[0].args).toEqual({ p_emails: null });
    expect(api.state.requests[0].opts).toEqual({ count: 'exact' });
  });
});

describe('fetchAllRows', () => {
  it('stops at the ceiling and says so', async () => {
    api.state.rows.big = events(2500);
    const rows = await fetchAllRows((withCount) => api.supabase.from('big').select('*', withCount ? { count: 'exact' } : undefined), { maxRows: 2000 });
    expect(rows).toHaveLength(2000);
    expect(rows.truncated).toBe(true);
  });

  it('passes an API error on', async () => {
    const failing = () => ({ range: async () => ({ data: null, error: new Error('permission denied'), count: null }) });
    await expect(fetchAllRows(failing)).rejects.toThrow('permission denied');
  });

  it('uses pages of 1,000 by default', () => {
    expect(ADMIN_PAGE_SIZE).toBe(1000);
  });
});

describe('activityLabel', () => {
  it('names the common events in plain words', () => {
    expect(activityLabel('animal_created')).toBe('Added a gecko');
    expect(activityLabel('weight_logged')).toBe('Logged a weigh-in');
    expect(activityLabel('market_view')).toBe('Market view');
    expect(activityLabel('$experiment_exposure')).toBe('Experiment exposure');
    expect(activityLabel('')).toBe('Activity');
    expect(activityLabel(null)).toBe('Activity');
  });
});

// A table that fails to load is counted as empty. The screens now say so
// above the charts, instead of showing zeros that look real.
describe('analyticsLoadNotice', () => {
  it('says nothing when every table loaded', () => {
    expect(analyticsLoadNotice({ failed: [], truncated: false })).toBeNull();
    expect(analyticsLoadNotice()).toBeNull();
    expect(analyticsLoadNotice({ failed: undefined })).toBeNull();
  });

  it('names the tables that did not load, in plain words', () => {
    expect(analyticsLoadNotice({ failed: ['user_events'] })).toBe('Could not load events, so those numbers show as zero. Refresh to try again.');
    expect(analyticsLoadNotice({ failed: ['geckos', 'gecko_images', 'direct_messages'] }))
      .toBe('Could not load geckos, photos and messages, so their numbers show as zero. Refresh to try again.');
    expect(analyticsLoadNotice({ failed: ['profiles', 'profiles'] })).toMatch(/^Could not load accounts, so those/);
    expect(analyticsLoadNotice({ failed: ['some_new_table'] })).toMatch(/^Could not load some new table,/);
  });

  it('says when a table was cut short at the ceiling', () => {
    expect(analyticsLoadNotice({ truncated: true })).toMatch(/lower bound/);
    expect(analyticsLoadNotice({ failed: ['user_events'], truncated: true })).toMatch(/^Could not load events.*lower bound\.$/);
  });
});
