import { describe, expect, it } from 'vitest';
import { claimStaleRouteReload } from '../staleRouteReload';

function fakeStorage({ dropWrites = false } = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { if (!dropWrites) map.set(k, String(v)); },
  };
}

describe('reloading once for a page an old tab does not know', () => {
  it('reloads once when a link inside the running app hits a page it does not know', () => {
    // A tab loaded on /Dashboard before the deploy that added /log.
    const storage = fakeStorage();
    expect(claimStaleRouteReload('/log', { bootPath: '/Dashboard', storage })).toBe(true);
    // After that reload the new app still says not found: no second reload.
    expect(claimStaleRouteReload('/log', { bootPath: '/Dashboard', storage })).toBe(false);
  });

  it('never reloads for the address the page load started on', () => {
    expect(claimStaleRouteReload('/log', { bootPath: '/log', storage: fakeStorage() })).toBe(false);
  });

  it('does not reload when the browser will not remember that it did', () => {
    expect(claimStaleRouteReload('/log', { bootPath: '/Dashboard', storage: null })).toBe(false);
    expect(claimStaleRouteReload('/log', { bootPath: '/Dashboard', storage: fakeStorage({ dropWrites: true }) })).toBe(false);
  });
});
