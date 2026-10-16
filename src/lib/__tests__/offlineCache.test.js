import { describe, it, expect, afterEach } from 'vitest';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import { __setCacheStorage, startQueryPersistence, stopQueryPersistence } from '@/lib/offlineCache';

function fakeStorage(entries = {}) {
  const store = new Map(Object.entries(entries));
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
}

afterEach(() => stopQueryPersistence());

describe('the stored copy of My Geckos', () => {
  it('shows right away but is refetched, even when it was saved seconds ago', () => {
    // Saved a moment ago with an empty collection, before the first gecko.
    const saver = new QueryClient();
    saver.setQueryData(['my-geckos', 'sam@example.com'], { geckos: [] });
    const state = dehydrate(saver);
    __setCacheStorage(fakeStorage({ 'geckinspect_query_cache:u1': JSON.stringify({ savedAt: Date.now(), state }) }));

    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 2 * 60 * 1000 } } });
    startQueryPersistence(client, 'u1');
    const query = client.getQueryCache().find({ queryKey: ['my-geckos', 'sam@example.com'] });
    expect(query.state.data).toEqual({ geckos: [] });
    expect(query.isStale()).toBe(true);
  });
});
