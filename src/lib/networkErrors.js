/**
 * Did a request fail for want of a connection, or was it refused?
 *
 * Kept apart from the offline queue (src/lib/offlineQueue.js) so the
 * sign-in code can tell "no signal" from "signed out" without loading the
 * queue, which only signed-in members need.
 */

/**
 * True when the request was cut off before it finished: it was aborted
 * (a timeout, the app going to the background, a navigation) rather than
 * answered. Browsers report this as an error named AbortError or
 * TimeoutError; supabase-js sometimes only keeps the text in `message`.
 */
export function isAbortError(error) {
  if (!error) return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  const msg = String(error.message || error.details || '');
  // Narrow on purpose: Postgres says "current transaction is aborted" for
  // a real database refusal, and that must not be retried forever.
  return /AbortError|TimeoutError|signal is aborted|user aborted|operation was aborted|operation timed out/i.test(msg);
}

/**
 * True when the request never got an answer: the phone is offline, the
 * fetch itself failed, or the request was aborted. Those writes are safe
 * to keep and retry. A refusal from the database (bad value, no
 * permission) is not a network error and would fail again, so it is not
 * kept.
 */
export function isNetworkError(error, nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (nav && nav.onLine === false) return true;
  if (!error) return false;
  if (isAbortError(error)) return true;
  const msg = String(error.message || error.details || error || '');
  if (/Failed to fetch|NetworkError|Load failed|Network request failed|ERR_INTERNET_DISCONNECTED|fetch failed/i.test(msg)) {
    return true;
  }
  return error.name === 'TypeError' && /fetch/i.test(msg);
}
