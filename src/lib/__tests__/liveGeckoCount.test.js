import { beforeEach, describe, expect, it, vi } from 'vitest';

// The live gecko count Morph ID reads to tell a member on step 1 of the
// guided first gecko from one with a leftover flag. It must count what My
// Geckos counts as the collection (own plus shared, not archived), or the
// two pages disagree about whether this is the first gecko.
const fx = vi.hoisted(() => ({ collectionIds: [] }));
vi.mock('@/lib/geckoAccess', () => ({
  getAccessibleCollectionIds: async () => fx.collectionIds,
}));

const { countLiveGeckos } = await import('../liveGeckoCount');

function fakeClient(result) {
  const calls = [];
  const query = {
    select: (...args) => { calls.push(['select', ...args]); return query; },
    or: (...args) => { calls.push(['or', ...args]); return query; },
    in: (...args) => { calls.push(['in', ...args]); return query; },
    eq: (...args) => { calls.push(['eq', ...args]); return query; },
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return {
    calls,
    from: (table) => { calls.push(['from', table]); return query; },
  };
}

describe('countLiveGeckos', () => {
  beforeEach(() => {
    fx.collectionIds = [];
  });

  it('counts live geckos in every collection the member can open, without downloading rows', async () => {
    fx.collectionIds = ['c-own', 'c-shared'];
    const client = fakeClient({ count: 2, error: null });
    expect(await countLiveGeckos(client, 'sam@example.com')).toBe(2);
    expect(client.calls).toEqual([
      ['from', 'geckos'],
      ['select', 'id', { count: 'exact', head: true }],
      ['or', 'archived.is.null,archived.eq.false'],
      ['in', 'collection_id', ['c-own', 'c-shared']],
    ]);
  });

  it("falls back to the member's own rows before their first collection exists", async () => {
    const client = fakeClient({ count: 0, error: null });
    expect(await countLiveGeckos(client, 'sam@example.com')).toBe(0);
    expect(client.calls).toContainEqual(['eq', 'created_by', 'sam@example.com']);
    expect(client.calls.some(([name]) => name === 'in')).toBe(false);
  });

  it('throws a failed read instead of calling the collection empty', async () => {
    const client = fakeClient({ count: null, error: new Error('network') });
    await expect(countLiveGeckos(client, 'sam@example.com')).rejects.toThrow('network');
  });

  it('returns null without an email', async () => {
    expect(await countLiveGeckos(fakeClient({ count: 0, error: null }), null)).toBeNull();
  });
});
