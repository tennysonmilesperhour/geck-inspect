/**
 * lazyWithRetry ,  resilient React.lazy for code-split route chunks.
 *
 * Why this exists: every route in the app is `lazy(() => import(...))`,
 * which downloads a separate JS chunk the moment a user navigates to that
 * page. React's built-in `lazy` does NOT retry. If a single chunk fetch
 * fails ,  a flaky mobile connection dropping one request, or a hash that
 * went stale after a new deploy shipped while the tab was open ,  the
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
 *      hashes. A sessionStorage guard makes sure we never reload-loop.
 *
 * On the rare case where even a fresh load can't fetch the chunk, the
 * error still reaches the ErrorBoundary so the user isn't stuck on a
 * spinner forever.
 */

import { lazy as reactLazy } from 'react';

// Per-tab guard so a stale-deploy reload happens at most once. Cleared on
// any successful chunk load so a LATER stale deploy can self-heal again.
const RELOAD_FLAG = 'gi:chunk-reload';

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

function readFlag() {
  try {
    return window.sessionStorage?.getItem(RELOAD_FLAG) === '1';
  } catch {
    return false;
  }
}

function writeFlag(value) {
  try {
    if (value) window.sessionStorage?.setItem(RELOAD_FLAG, '1');
    else window.sessionStorage?.removeItem(RELOAD_FLAG);
  } catch {
    /* sessionStorage can throw in private mode; the reload still works */
  }
}

/**
 * @param {() => Promise<{ default: React.ComponentType<any> }>} factory
 * @param {{ retries?: number, baseDelayMs?: number }} [opts]
 */
export function lazyWithRetry(factory, { retries = 2, baseDelayMs = 350 } = {}) {
  return reactLazy(async () => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const mod = await factory();
        // A clean load means whatever blipped is gone; let a future stale
        // deploy trigger its own one-time reload.
        writeFlag(false);
        return mod;
      } catch (err) {
        lastErr = err;
        // Real error inside the module, not a fetch failure ,  surface it.
        if (!isChunkLoadError(err)) throw err;
        if (attempt < retries) await wait(baseDelayMs * (attempt + 1));
      }
    }

    // Retries exhausted. Almost always a stale deploy: this bundle is
    // asking for a chunk hash the CDN no longer has. Hard reload once to
    // pull the new index.html and its fresh hashes.
    if (typeof window !== 'undefined' && !readFlag()) {
      writeFlag(true);
      window.location.reload();
      // Keep Suspense showing its fallback (a spinner) during the blink
      // before the reload takes effect, instead of flashing the error
      // card. This promise never resolves; the reload replaces the page.
      await new Promise(() => {});
    }

    // Already reloaded once and still failing, or no window. Let the
    // ErrorBoundary show the message rather than loop.
    throw lastErr;
  });
}

// Drop-in replacement for React's `lazy` so call sites only swap their
// import source, not every `lazy(...)` call.
export const lazy = lazyWithRetry;
