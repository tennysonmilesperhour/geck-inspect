/**
 * lazyWithRetry, resilient React.lazy for code-split route chunks.
 *
 * Why this exists: every route in the app is `lazy(() => import(...))`,
 * which downloads a separate JS chunk the moment a user navigates to that
 * page. React's built-in `lazy` does NOT retry. If a single chunk fetch
 * fails, a flaky mobile connection dropping one request, or a hash that
 * went stale after a new deploy shipped while the tab was open, the
 * import rejects with "Importing a module script failed" (Safari) or
 * "Failed to fetch dynamically imported module" (Chrome) and the whole
 * page falls through to the global ErrorBoundary.
 *
 * The heaviest page for this is Business Tools (MarketplaceSalesStats),
 * which fans out into the market-analytics views plus the recharts vendor
 * chunk, so it has the most chunk fetches and the highest odds that one of
 * them blips. That is the page users hit this error on.
 *
 * This wrapper does two things:
 *   1. Retries the import a couple of times with a short backoff. Covers
 *      transient network failures, which is the common mobile case.
 *   2. If retries are exhausted AND the failure looks like a chunk-load
 *      error (not a real bug inside the module), forces a ONE-TIME hard
 *      reload. A stale deploy is fixed by reloading, because the fresh
 *      index.html (served must-revalidate) references the new chunk
 *      hashes. A sessionStorage guard allows at most one such reload per
 *      tab every few minutes, so a chunk that keeps failing can never
 *      reload-loop.
 *
 * On the rare case where even a fresh load can't fetch the chunk, the
 * error still reaches the ErrorBoundary so the user isn't stuck on a
 * spinner forever.
 */

import { lazy as reactLazy } from 'react';

// Per-tab guard: when this tab last reloaded to recover a chunk. Another
// reload is allowed only after RELOAD_COOLDOWN_MS, so a later stale deploy
// can still heal itself while a chunk that keeps failing cannot loop. (Until
// October 2026 the guard was a flag cleared by any successful chunk load,
// and the page's own chunk loads after every reload, so one chunk that kept
// failing reloaded the calculator about once a second for good.)
export const RELOAD_KEY = 'gi:chunk-reload-at';
export const RELOAD_COOLDOWN_MS = 5 * 60 * 1000;

// Match the various ways browsers phrase a failed dynamic import. We only
// auto-recover from these. A genuine error thrown while the module
// evaluates (a real bug) must surface, not trigger a reload loop.
function isChunkLoadError(err) {
  if (err?.name === 'ChunkLoadError') return true;
  const msg = String(err?.message || err || '');
  return (
    /importing a module script failed/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /unable to preload css/i.test(msg) ||
    // Safari/Chrome when the server returns the SPA index.html (text/html)
    // in place of a missing .js chunk.
    /is not a valid javascript mime type/i.test(msg) ||
    /expected a javascript[- ]?(or wasm )?module script/i.test(msg)
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// True when this tab may reload now. With no session storage there is no
// way to remember a reload, so none is made (no loop is possible).
function mayReload(now = Date.now()) {
  try {
    const store = window.sessionStorage;
    if (!store) return false;
    const last = Number(store.getItem(RELOAD_KEY));
    return !(last > 0 && now - last < RELOAD_COOLDOWN_MS);
  } catch {
    return false;
  }
}

function rememberReload(now = Date.now()) {
  try {
    window.sessionStorage?.setItem(RELOAD_KEY, String(now));
  } catch {
    /* mayReload already returned false if storage is unusable */
  }
}

/**
 * The same retries and one-time reload as lazyWithRetry, for a module a
 * page loads itself (for example the genetics engine, fetched while the
 * calculator shows its spinner) instead of through React.lazy.
 *
 * @template T
 * @param {() => Promise<T>} factory
 * @param {{ retries?: number, baseDelayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function importWithRetry(factory, { retries = 2, baseDelayMs = 350 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await factory();
    } catch (err) {
      lastErr = err;
      // Real error inside the module, not a fetch failure, surface it.
      if (!isChunkLoadError(err)) throw err;
      if (attempt < retries) await wait(baseDelayMs * (attempt + 1));
    }
  }

  // Retries exhausted. Almost always a stale deploy: this bundle is
  // asking for a chunk hash the CDN no longer has. Hard reload once to
  // pull the new index.html and its fresh hashes.
  if (typeof window !== 'undefined' && mayReload()) {
    rememberReload();
    window.location.reload();
    // Keep Suspense showing its fallback (a spinner) during the blink
    // before the reload takes effect, instead of flashing the error
    // card. This promise never resolves; the reload replaces the page.
    await new Promise(() => {});
  }

  // Reloaded within the last few minutes and still failing, or no window.
  // Let the ErrorBoundary show the message rather than loop.
  throw lastErr;
}

/**
 * @param {() => Promise<{ default: React.ComponentType<any> }>} factory
 * @param {{ retries?: number, baseDelayMs?: number }} [opts]
 */
export function lazyWithRetry(factory, opts) {
  return reactLazy(() => importWithRetry(factory, opts));
}

// Drop-in replacement for React's `lazy` so call sites only swap their
// import source, not every `lazy(...)` call.
export const lazy = lazyWithRetry;
