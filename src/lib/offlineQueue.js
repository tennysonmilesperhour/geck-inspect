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

let storage = typeof localStorage !== 'undefined' ? localStorage : null;
let owner = null;
const listeners = new Set();
let flushing = null;

/** Tests swap in a fake storage. */
export function __setQueueStorage(next) {
  storage = next;
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
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    // nothing to clear
  }
  notify();
}

/**
 * True when the request never got an answer: the phone is offline, or the
 * fetch itself failed. Those writes are safe to keep and retry. A refusal
 * from the database (bad value, no permission) is not a network error and
 * would fail again, so it is not kept.
 */
export function isNetworkError(error, nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (nav && nav.onLine === false) return true;
  if (!error) return false;
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

/**
 * Replay waiting writes in the order they were made. `execute(item)` does
 * the real write. Stops at the first network or sign-in error (everything
 * after it stays queued, still in order). A write the database refuses is
 * dropped and returned in `failed` so the app can say so.
 *
 * Only one flush runs at a time; a second call while one is running gets
 * the same result.
 */
export function flushQueue(execute) {
  if (flushing) return flushing;
  flushing = (async () => {
    const result = { saved: 0, failed: [], remaining: 0 };
    try {
      const startOwner = owner;
      for (const item of readQueue()) {
        if (owner !== startOwner) break;
        try {
          await execute(item);
          removeQueued(item.id);
          result.saved += 1;
        } catch (error) {
          if (isNetworkError(error) || isAuthError(error)) break;
          removeQueued(item.id);
          result.failed.push({ item, error });
        }
      }
      result.remaining = pendingCount();
      return result;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
