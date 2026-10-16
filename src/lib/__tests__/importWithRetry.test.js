import { afterEach, describe, expect, it, vi } from 'vitest';
import { importWithRetry, RELOAD_COOLDOWN_MS } from '@/lib/lazyWithRetry';

// importWithRetry is lazyWithRetry's retry loop on its own, for code a page
// loads itself (the calculator's engine, src/components/breeding/
// calculatorEngine.js). A dropped download is tried again; a real error
// inside the module is not hidden behind retries.

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/x.js');

describe('importWithRetry', () => {
  it('tries a failed download again and resolves with the module', async () => {
    const mod = { ready: true };
    const factory = vi.fn().mockRejectedValueOnce(chunkError()).mockResolvedValueOnce(mod);
    await expect(importWithRetry(factory, { baseDelayMs: 0 })).resolves.toBe(mod);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('surfaces an error thrown inside the module at once', async () => {
    const bug = new Error('x is not a function');
    const factory = vi.fn().mockRejectedValue(bug);
    await expect(importWithRetry(factory, { baseDelayMs: 0 })).rejects.toBe(bug);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('gives up after its retries when there is no page to reload', async () => {
    const factory = vi.fn().mockRejectedValue(chunkError());
    await expect(importWithRetry(factory, { retries: 2, baseDelayMs: 0 })).rejects.toThrow(/dynamically imported/);
    expect(factory).toHaveBeenCalledTimes(3);
  });
});

// A chunk that keeps failing must not reload the page over and over: after
// one reload the page's own chunk loads fine, which used to clear the guard.
describe('the stale-deploy reload', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  function stubWindow() {
    const store = new Map();
    const reload = vi.fn();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
      location: { reload },
    });
    return { reload };
  }
  const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

  it('reloads once, then lets the error through even after other chunks load fine', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    const { reload } = stubWindow();
    const failing = () => Promise.reject(chunkError());
    // First failure: one reload (the promise stays pending while the page reloads).
    importWithRetry(failing, { retries: 0, baseDelayMs: 0 });
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    // After the reload the page's own chunk loads...
    await importWithRetry(() => Promise.resolve({ page: true }), { retries: 0 });
    // ...and the same chunk fails again: no second reload, the error shows.
    await expect(importWithRetry(failing, { retries: 0, baseDelayMs: 0 })).rejects.toThrow(/dynamically imported/);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows another reload for a later stale deploy, after the cool-down', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    const { reload } = stubWindow();
    const failing = () => Promise.reject(chunkError());
    importWithRetry(failing, { retries: 0, baseDelayMs: 0 });
    await settle();
    vi.setSystemTime(new Date(Date.now() + RELOAD_COOLDOWN_MS + 1000));
    importWithRetry(failing, { retries: 0, baseDelayMs: 0 });
    await settle();
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

