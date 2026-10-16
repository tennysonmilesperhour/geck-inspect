import { beforeEach, describe, expect, it, vi } from 'vitest';

// A recording stand-in for the Supabase client: every builder call is
// logged, and each query resolves to the next queued response.
const calls = vi.hoisted(() => ({ log: [], responses: [] }));
vi.mock('@/lib/supabaseClient', () => {
  const builder = (start) => {
    const entry = [start];
    calls.log.push(entry);
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const response = calls.responses.length ? calls.responses.shift() : { data: [], error: null };
          return (resolve, reject) => Promise.resolve(response).then(resolve, reject);
        }
        return (...args) => { entry.push([prop, ...args]); return b; };
      },
    });
    return b;
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), refreshSession: async () => ({}) },
      from: (table) => builder(['from', table]),
      rpc: (name, args) => builder(['rpc', name, args]),
    },
  };
});
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false, blockIfGuest: () => {}, GUEST_USER: {} }));

const { Gecko, ForumPost, UserEntity } = await import('@/api/supabaseEntities');
const { loadRecentWeights, isMissingFunction } = await import('../recentWeights');

const step = (entry, name) => entry.find((s) => Array.isArray(s) && s[0] === name);

beforeEach(() => { calls.log.length = 0; calls.responses.length = 0; });

describe('list() honours its limit (Dashboard, Community Pulse)', () => {
  it('asks the database for only the rows requested', async () => {
    await ForumPost.list('-created_date', 10);
    await Gecko.list('-created_date', 20);
    await UserEntity.list('-created_date', 30);
    expect(step(calls.log[0], 'limit')).toEqual(['limit', 10]);
    expect(step(calls.log[1], 'limit')).toEqual(['limit', 20]);
    expect(step(calls.log[2], 'limit')).toEqual(['limit', 30]);
    expect(step(calls.log[0], 'order')).toEqual(['order', 'created_date', { ascending: false, nullsFirst: false }]);
  });

  it('still reads everything when no limit is given, as before', async () => {
    await Gecko.list('-created_date');
    expect(step(calls.log[0], 'limit')).toBeUndefined();
  });

  it('pages with a range when a skip is given', async () => {
    await Gecko.list('-created_date', 20, 40);
    expect(step(calls.log[0], 'range')).toEqual(['range', 40, 59]);
  });
});

describe('My Geckos latest weights', () => {
  const rows = (n, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: `w${offset + i}`, gecko_id: `g${(offset + i) % 7}`, record_date: `2026-0${1 + ((offset + i) % 9)}-01` }));

  it('reads the newest records per gecko through the database function, page by page', async () => {
    calls.responses.push({ data: rows(1000), error: null }, { data: rows(10, 1000), error: null });
    const out = await loadRecentWeights('a@example.com');
    expect(out).toHaveLength(1010);
    expect(calls.log[0][0]).toEqual(['rpc', 'recent_weight_records', { p_per_gecko: 8 }]);
    expect(step(calls.log[0], 'range')).toEqual(['range', 0, 999]);
    expect(step(calls.log[1], 'range')).toEqual(['range', 1000, 1999]);
    // Newest first, like the old read.
    for (let i = 1; i < out.length; i++) expect(out[i - 1].record_date >= out[i].record_date).toBe(true);
  });

  it('falls back to the old read while the database function is not live yet', async () => {
    calls.responses.push(
      { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.recent_weight_records' } },
      { data: [{ id: 'old', gecko_id: 'g1', record_date: '2026-01-01' }], error: null },
    );
    const out = await loadRecentWeights('a@example.com');
    expect(out).toEqual([{ id: 'old', gecko_id: 'g1', record_date: '2026-01-01' }]);
    expect(calls.log[1][0]).toEqual(['from', 'weight_records']);
    expect(step(calls.log[1], 'eq')).toEqual(['eq', 'created_by', 'a@example.com']);
  });

  it('surfaces other errors instead of hiding them', async () => {
    calls.responses.push({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(loadRecentWeights('a@example.com')).rejects.toMatchObject({ code: '42501' });
    expect(isMissingFunction({ code: '42883' })).toBe(true);
    expect(isMissingFunction({ code: '42501' })).toBe(false);
  });
});
