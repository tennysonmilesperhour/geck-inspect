import { beforeEach, describe, expect, it, vi } from 'vitest';

// The live gecko count Morph ID reads to tell a member on step 1 of the
// guided first gecko from one with a leftover flag. It must count what My
// Geckos counts as the collection (own plus shared, not archived), or the
// two pages disagree about whether this is the first gecko.
const fx = vi.hoisted(() => ({ collectionIds: [], profileId: 'p-sam' }));
vi.mock('@/lib/geckoAccess', () => ({
  getAccessibleCollectionIds: async () => fx.collectionIds,
}));
// Members cannot filter on created_by (an email) since decision E16; the
// member's own rows are found by their profile id.
vi.mock('@/lib/ownerRows', () => ({
  myProfileId: async () => fx.profileId,
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
    fx.profileId = 'p-sam';
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
    expect(client.calls).toContainEqual(['eq', 'owner_profile_id', 'p-sam']);
    expect(client.calls.some(([, col]) => col === 'created_by')).toBe(false);
    expect(client.calls.some(([name]) => name === 'in')).toBe(false);
  });

  it('throws when the member\'s profile cannot be read, instead of counting nothing', async () => {
    fx.profileId = null;
    await expect(countLiveGeckos(fakeClient({ count: 0, error: null }), 'sam@example.com')).rejects.toThrow('profile could not be read');
  });

  it('throws a failed read instead of calling the collection empty', async () => {
    const client = fakeClient({ count: null, error: new Error('network') });
    await expect(countLiveGeckos(client, 'sam@example.com')).rejects.toThrow('network');
  });

  it('returns null without an email', async () => {
    expect(await countLiveGeckos(fakeClient({ count: 0, error: null }), null)).toBeNull();
  });
});
