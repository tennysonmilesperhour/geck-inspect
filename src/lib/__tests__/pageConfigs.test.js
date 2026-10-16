// page_config is loaded once on start (adversarial review, section 08: the
// router and the sidebar each fetched it, so every signed-in start sent the
// same request twice).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = vi.hoisted(() => {
  const map = new Map();
  globalThis.window = {
    addEventListener: (name, fn) => map.set(name, [...(map.get(name) || []), fn]),
    removeEventListener: () => {},
    dispatchEvent: (event) => {
      for (const fn of map.get(event.type) || []) fn(event);
      return true;
    },
  };
  return map;
});

const list = vi.hoisted(() => vi.fn());
vi.mock('@/api/appClient', () => ({ api: { entities: { PageConfig: { list: (...a) => list(...a) } } } }));

import {
  ALWAYS_ON_PAGES,
  disabledPagesFrom,
  invalidatePageConfigs,
  loadPageConfigs,
  PAGE_CONFIGS_CHANGED,
} from '../pageConfigs';

const rows = [
  { page_name: 'Forum', is_enabled: false },
  { page_name: 'Gallery', is_enabled: false },
  { page_name: 'MyGeckos', is_enabled: true },
];

beforeEach(() => {
  invalidatePageConfigs();
  list.mockReset();
  list.mockImplementation(async () => rows);
});

describe('loadPageConfigs', () => {
  it('the router and the sidebar starting together send one request', async () => {
    const [router, sidebar] = await Promise.all([loadPageConfigs(), loadPageConfigs()]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(router).toBe(sidebar);
    // A later call (the sidebar re-rendering for a new user) reuses it.
    await loadPageConfigs();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('asks again after an admin change, still once for both listeners', async () => {
    await loadPageConfigs();
    // The module's own listener was registered first, so by the time the
    // router's and the sidebar's listeners refetch, the copy is gone.
    window.dispatchEvent({ type: PAGE_CONFIGS_CHANGED });
    await Promise.all([loadPageConfigs(), loadPageConfigs()]);
    expect(list).toHaveBeenCalledTimes(2);
    expect(listeners.get(PAGE_CONFIGS_CHANGED)).toHaveLength(1);
  });

  it('does not keep a failed request, so the next call retries', async () => {
    list.mockImplementationOnce(async () => { throw new Error('offline'); });
    await expect(loadPageConfigs()).rejects.toThrow('offline');
    await expect(loadPageConfigs()).resolves.toEqual(rows);
    expect(list).toHaveBeenCalledTimes(2);
  });

  // The sidebar's own fetch used retryApiCall before it was shared; one
  // throttled request at start-up must still not leave switched-off pages
  // showing until the next reload.
  it('tries a rate-limited request again after a pause', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      list.mockImplementationOnce(async () => { throw Object.assign(new Error('rate limited'), { response: { status: 429 } }); });
      const pending = loadPageConfigs();
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toEqual(rows);
      expect(list).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it('treats a non-list answer as no rows', async () => {
    list.mockImplementation(async () => null);
    await expect(loadPageConfigs()).resolves.toEqual([]);
  });
});

describe('disabledPagesFrom', () => {
  it('turns off a page only when every row for it is off, and never an always-on page', () => {
    const disabled = disabledPagesFrom([
      ...rows,
      { page_name: 'Market', is_enabled: false },
      { page_name: 'Market', is_enabled: true },
      { page_name: 'Settings', is_enabled: false },
      { is_enabled: false },
    ]);
    expect([...disabled].sort()).toEqual(['Forum']);
    expect(ALWAYS_ON_PAGES).toContain('Gallery');
    expect(ALWAYS_ON_PAGES).toContain('Settings');
  });

  // Today is the phone's home: the app opens on it and the first tab links
  // to it. Switched off, every phone open would land on "This feature is
  // currently unavailable".
  it('never switches off Today, the phone home', () => {
    expect(ALWAYS_ON_PAGES).toContain('Today');
    expect(disabledPagesFrom([{ page_name: 'Today', is_enabled: false }]).has('Today')).toBe(false);
  });

  it('copes with nothing loaded', () => {
    expect(disabledPagesFrom(undefined).size).toBe(0);
  });
});
