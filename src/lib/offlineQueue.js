/**
 * Offline write queue for Field Mode (and the passport quick log, which
 * opens Field Mode).
 *
 * When a log is made with no signal, the write is kept in this browser
 * (localStorage, one list per signed-in account) instead of failing. The
 * list is replayed in order when the connection comes back
 * (src/lib/offlineSync.js runs it), and the app shows how many logs are
 * still waiting to sync.
 *
 * This module is plain JavaScript with no Supabase or React imports, so the
 * queue rules can be unit tested on their own. The thing that actually
 * writes an item is passed in to flushQueue().
 *
 * Item shape:
 *   { id, entity, op: 'create' | 'update' | 'delete', data, recordId, queuedAt }
 *   entity is an entity name from '@/entities/all' (FeedingRecord, ...).
 */

const KEY_PREFIX = 'geckinspect_offline_queue:';

// Logs the server refused when the queue sent them, kept per account so
// every open tab (and the page that made the log) can say "not saved"
// instead of treating "no longer waiting" as "saved". Not under
// KEY_PREFIX, so a refusal list is never read as a queue.
const REFUSED_PREFIX = 'geckinspect_offline_refused:';
// A refusal is shown until the member dismisses it, or for a week at most,
// and only the newest few are kept, so the list cannot grow without end.
const REFUSED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFUSED_MAX = 50;

// Name of the cross-tab flush lock, and of the localStorage lease used
// when the browser has no Web Locks API. Deliberately not under
// KEY_PREFIX, so it is never mistaken for a queue.
const FLUSH_LOCK_PREFIX = 'geckinspect_offline_flush:';
// How long a localStorage lease lasts without being renewed. A tab that
// closes mid-flush stops renewing, and another tab can take over after this.
const LEASE_MS = 30_000;

let storage = typeof localStorage !== 'undefined' ? localStorage : null;
let owner = null;
const listeners = new Set();
const refusedListeners = new Set();
let flushing = null;
// undefined means "use navigator.locks if the browser has it".
let locksOverride;
// Identifies this tab in the localStorage lease.
const tabId = newId();

/** Tests swap in a fake storage. */
export function __setQueueStorage(next) {
  storage = next;
}

/** Tests swap in a fake Web Locks manager (null means "not supported"). */
export function __setQueueLocks(next) {
  locksOverride = next;
}

function lockManager() {
  if (locksOverride !== undefined) return locksOverride;
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks;
  }
  return null;
}

/**
 * The queue belongs to one account. AuthContext sets the owner (the auth
 * user id) on sign-in and clears it on sign-out, so a second account on
 * the same phone never replays the first account's logs.
 */
export function setQueueOwner(id) {
  const next = id || null;
  if (next === owner) return;
  owner = next;
  notify();
  notifyRefused();
}

export function getQueueOwner() {
  return owner;
}

function storageKey() {
  return owner ? KEY_PREFIX + owner : null;
}

export function readQueue() {
  const key = storageKey();
  if (!key || !storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  const key = storageKey();
  if (!key || !storage) return false;
  try {
    if (items.length) storage.setItem(key, JSON.stringify(items));
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  } finally {
    notify();
  }
}

function notify() {
  const count = pendingCount();
  for (const fn of listeners) {
    try {
      fn(count);
    } catch {
      // a broken listener must not stop the others
    }
  }
}

/** Call fn(count) whenever the number of waiting logs changes. */
export function subscribeQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pendingCount() {
  return readQueue().length;
}

// ----- logs the server refused -------------------------------------------
//
// A queued log leaves the queue in two ways: the server saved it, or the
// server refused it (the gecko was deleted, the member lost access). Both
// look the same from the queue alone, so before this list the one-tap log
// page turned "kept on this phone" into "saved" for a refused log. The
// flush now writes each refusal here, in the same browser storage the
// queue uses, before it takes the log out of the queue.

function refusedKey() {
  return owner ? REFUSED_PREFIX + owner : null;
}

function notifyRefused() {
  for (const fn of refusedListeners) {
    try {
      fn();
    } catch {
      // a broken listener must not stop the others
    }
  }
}

/** Call fn() whenever the list of refused logs changes. */
export function subscribeRefused(fn) {
  refusedListeners.add(fn);
  return () => refusedListeners.delete(fn);
}

/** Refused logs for the signed-in account, oldest first, none older than a week. */
export function readRefused(now = Date.now()) {
  const key = refusedKey();
  if (!key || !storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r?.id && now - (Date.parse(r.refusedAt) || 0) < REFUSED_MAX_AGE_MS);
  } catch {
    return [];
  }
}

/** The refusal for one queued log, or null when it was not refused. */
export function refusalFor(id) {
  if (!id) return null;
  return readRefused().find((r) => r.id === id) || null;
}

function writeRefused(list) {
  const key = refusedKey();
  if (!key || !storage) return false;
  try {
    if (list.length) storage.setItem(key, JSON.stringify(list));
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  } finally {
    notifyRefused();
  }
}

// Only what a page needs to name the log ("Feeding for Alder on 14 Oct"),
// not the whole payload.
function describeQueued(item) {
  const d = item?.data || {};
  const grams = Number(d.grams ?? d.weight_grams);
  return {
    entity: item?.entity || null,
    kind: d.kind || null,
    geckoId: d.geckoId || d.gecko_id || d.animal_id || (item?.entity === 'Gecko' ? item.recordId : null) || null,
    date: d.date || d.eventDate || d.record_date || d.feeding_date || d.shed_date || null,
    grams: Number.isFinite(grams) && grams > 0 ? grams : null,
    accepted: typeof d.accepted === 'boolean' ? d.accepted : null,
  };
}

function refusalReason(error) {
  return {
    code: error?.code ? String(error.code).slice(0, 40) : null,
    status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
    message: String(error?.message || error || '').slice(0, 300),
  };
}

function recordRefused(item, error) {
  const entry = {
    id: item.id,
    ...describeQueued(item),
    refusedAt: new Date().toISOString(),
    error: refusalReason(error),
  };
  const next = [...readRefused().filter((r) => r.id !== item.id), entry];
  return writeRefused(next.slice(-REFUSED_MAX));
}

/**
 * The member has seen these refusals (or logged again): stop showing
 * them. With no ids, every refusal for this account is cleared.
 */
export function dismissRefused(ids = null) {
  const list = readRefused();
  if (list.length === 0) return;
  const drop = ids == null ? null : new Set([].concat(ids));
  writeRefused(drop ? list.filter((r) => !drop.has(r.id)) : []);
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Keep one write for later. Throws when nobody is signed in or the
 * browser refuses to store it (private mode, storage full), so the caller
 * can show a real "not saved" error instead of a false success.
 */
export function enqueue({ entity, op, data = null, recordId = null }) {
  if (!owner) throw new Error('Sign in to save logs on this device.');
  if (!entity || !['create', 'update', 'delete'].includes(op)) {
    throw new Error('Unsupported offline write.');
  }
  const item = { id: newId(), entity, op, data, recordId, queuedAt: new Date().toISOString() };
  if (!writeQueue([...readQueue(), item])) {
    throw new Error('This browser would not keep the log. It was not saved.');
  }
  return item;
}

/** Drop a waiting write (Field Mode's Undo on a log made offline). */
export function removeQueued(id) {
  const items = readQueue();
  const next = items.filter((i) => i.id !== id);
  if (next.length === items.length) return false;
  writeQueue(next);
  return true;
}

/** Merge fields into a waiting write (shed quality, fed or refused). */
export function updateQueued(id, patch) {
  const items = readQueue();
  let found = false;
  const next = items.map((i) => {
    if (i.id !== id) return i;
    found = true;
    return { ...i, data: { ...(i.data || {}), ...patch } };
  });
  if (found) writeQueue(next);
  return found;
}

/** Forget every waiting write for every account (sign-out). */
export function clearAllQueues() {
  if (!storage) return;
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      // Refusals name geckos and days, so they go with the queue.
      if (k && (k.startsWith(KEY_PREFIX) || k.startsWith(REFUSED_PREFIX))) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    // nothing to clear
  }
  notify();
  notifyRefused();
}

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

/** An expired sign-in. Retry later rather than throwing the log away. */
export function isAuthError(error) {
  if (!error) return false;
  if (error.status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') return true;
  return /JWT expired|not authenticated|invalid jwt/i.test(String(error.message || ''));
}

// Answers that mean "the server was busy or unreachable, try again", as
// opposed to "the database refused this write".
const RETRY_STATUSES = new Set([408, 429, 502, 503, 504]);

/**
 * Should a queued write that failed with this error stay in the queue for
 * the next attempt? Yes for network failures, aborts, an expired sign-in
 * and a busy or unreachable server. A write the database itself refuses
 * would fail the same way again, so it is not retried.
 */
export function isRetryableError(error, nav) {
  if (isNetworkError(error, nav) || isAuthError(error)) return true;
  return Boolean(error && RETRY_STATUSES.has(Number(error.status)));
}

// localStorage lease, the fallback when the browser has no Web Locks API.
// Returns true when this tab holds (or has just renewed) the lease.
function takeLease(key, now = Date.now()) {
  if (!storage) return true;
  try {
    const current = JSON.parse(storage.getItem(key) || 'null');
    if (current && current.holder !== tabId && current.expires > now) return false;
    storage.setItem(key, JSON.stringify({ holder: tabId, expires: now + LEASE_MS }));
    // Read it back: if another tab wrote at the same moment, only the
    // one whose write stuck goes ahead.
    return JSON.parse(storage.getItem(key) || 'null')?.holder === tabId;
  } catch {
    // Storage unreadable: fall back to the per-tab guard alone.
    return true;
  }
}

function releaseLease(key) {
  if (!storage) return;
  try {
    const current = JSON.parse(storage.getItem(key) || 'null');
    if (current?.holder === tabId) storage.removeItem(key);
  } catch {
    // nothing to release
  }
}

/**
 * Run fn() only if no other tab is flushing this account's queue. The
 * queue lives in localStorage, which every tab of the site shares, so
 * without this two open tabs could send the same log twice. Uses the
 * browser's Web Locks API when it exists (released automatically if the
 * tab closes) and a short localStorage lease otherwise. fn receives a
 * stillHoldsLock() check. Resolves to fn()'s result, or null when another
 * tab holds the lock.
 */
async function withFlushLock(fn) {
  const name = FLUSH_LOCK_PREFIX + (owner || 'anonymous');
  const locks = lockManager();
  if (locks) {
    return locks.request(name, { ifAvailable: true }, (lock) => (lock ? fn(() => true) : null));
  }
  if (!takeLease(name)) return null;
  try {
    // The flush renews the lease before each write; if another tab has
    // taken it over (this tab stalled for longer than LEASE_MS), it stops.
    return await fn(() => takeLease(name));
  } finally {
    releaseLease(name);
  }
}

/**
 * Replay waiting writes in the order they were made. `execute(item)` does
 * the real write. Stops at the first retryable error (no connection, an
 * aborted request, an expired sign-in, a busy server): everything from
 * that write on stays queued, still in order. A write the database
 * refuses is dropped and returned in `failed` so the app can say so, and
 * is recorded in the refused list (readRefused) before it leaves the
 * queue, so a page that only sees "no longer waiting" can tell it apart
 * from a saved log.
 *
 * Only one flush runs at a time across every open tab. A second call in
 * the same tab while one is running gets the same result. A call in
 * another tab while this one is flushing sends nothing and reports
 * `busy: true`.
 */
export function flushQueue(execute) {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const ran = await withFlushLock(async (stillHoldsLock) => {
        const result = { saved: 0, failed: [], remaining: 0, busy: false };
        const startOwner = owner;
        for (const item of readQueue()) {
          if (owner !== startOwner || !stillHoldsLock()) break;
          // An Undo, or another tab before it lost the lock, may already
          // have taken this item out of the queue. Never send it twice.
          if (!readQueue().some((i) => i.id === item.id)) continue;
          try {
            await execute(item);
            removeQueued(item.id);
            result.saved += 1;
          } catch (error) {
            if (isRetryableError(error)) break;
            // Refusal first, removal second: removing notifies the pages
            // watching the queue, and they must already find the refusal.
            // Never under another account that signed in meanwhile.
            if (owner === startOwner) recordRefused(item, error);
            removeQueued(item.id);
            result.failed.push({ item, error });
          }
        }
        result.remaining = pendingCount();
        return result;
      });
      return ran || { saved: 0, failed: [], remaining: pendingCount(), busy: true };
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
