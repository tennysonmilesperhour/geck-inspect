import { lazy } from 'react';

/**
 * Loading the record's optional parts as separate files, safely.
 *
 * Members keep the app open for hours, and every release replaces the
 * file names of these parts. A tab opened before a release then asks for
 * a file that no longer exists. The page loader (src/lib/lazyWithRetry.js)
 * answers that by reloading the page once, which is right when opening a
 * page but wrong in the middle of a record: a reload would throw away a
 * weigh-in or vet visit the member is still typing. So here a failed
 * download is retried, and if it still fails the part is left out (or the
 * tap says to reload), and the rest of the record keeps working.
 */

const STALE_FILE = /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|not a valid javascript mime type|expected a javascript[- ]?(or wasm )?module script/i;

/** True when an import failed because the file could not be downloaded. */
export function isStaleChunkError(err) {
  return err?.name === 'ChunkLoadError' || STALE_FILE.test(String(err?.message || err || ''));
}

/** What to tell a member when a part could not be downloaded. */
export const RELOAD_HINT = 'Geck Inspect was updated while this page was open. Reload the page to use this.';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `factory` (a dynamic import), trying again twice after a failed
 * download. An error from inside the module is a bug, not a download
 * problem, so it is not retried.
 */
export async function importWithRetry(factory, { retries = 2, baseDelayMs = 350 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await factory();
    } catch (err) {
      lastError = err;
      if (!isStaleChunkError(err)) throw err;
      if (attempt < retries) await wait(baseDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

/**
 * React.lazy for a part of the record that the record can live without.
 * If the part cannot be loaded, `Fallback` shows in its place (nothing by
 * default) and the error goes to the console, instead of the whole record
 * falling through to the page's error screen.
 */
export function lazyOptional(factory, Fallback = () => null, options) {
  return lazy(() =>
    importWithRetry(factory, options).catch((err) => {
      console.error('A part of the gecko record could not be loaded:', err);
      return { default: Fallback };
    }),
  );
}
