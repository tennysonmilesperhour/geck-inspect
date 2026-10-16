import { importWithRetry } from '@/lib/lazyWithRetry';

/**
 * Loads the calculator's engine parts (./calculatorEngineParts.js) once
 * per visit. The first call starts the download; later calls, and a
 * second visit to the calculator in the same tab, reuse it, so the
 * calculator draws at once when the engine is already here.
 *
 * A failed download is retried (and, for a stale deploy, the page reloads
 * once) by importWithRetry, the same as a page that fails to load. A call
 * after a final failure starts again.
 */
let parts = null;
let pending = null;

export function loadCalculatorEngine() {
  if (parts) return Promise.resolve(parts);
  if (!pending) {
    pending = importWithRetry(() => import('./calculatorEngineParts.js')).then(
      (mod) => {
        parts = mod;
        return mod;
      },
      (err) => {
        pending = null;
        throw err;
      },
    );
  }
  return pending;
}

/** The engine parts if they have loaded already, otherwise null. */
export function loadedCalculatorEngine() {
  return parts;
}
