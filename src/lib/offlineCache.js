/**
 * Persisted query cache: the last loaded collection, kept in this browser.
 *
 * The app loads My Geckos and Field Mode through react-query. This module
 * copies those few queries into localStorage after each successful load
 * and puts them back when the app opens, so the collection is readable
 * (and Field Mode can log) with no signal. Online, react-query still
 * refetches as usual; the stored copy only fills the gap until it does.
 *
 * Scope is deliberately small: only the query keys in PERSISTED_KEYS, one
 * copy per signed-in account, dropped after MAX_AGE_MS and on sign-out.
 */
import { dehydrate, hydrate } from '@tanstack/react-query';

const KEY_PREFIX = 'geckinspect_query_cache:';
export const PERSISTED_KEYS = new Set(['my-geckos', 'field-mode']);
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 1000;

let storage = typeof localStorage !== 'undefined' ? localStorage : null;
let owner = null;
let unsubscribe = null;
let saveTimer = null;

/** Tests swap in a fake storage. */
export function __setCacheStorage(next) {
  storage = next;
}

export function shouldPersistQuery(query) {
  const first = Array.isArray(query?.queryKey) ? query.queryKey[0] : null;
  return PERSISTED_KEYS.has(first) && query.state?.status === 'success';
}

function save(queryClient) {
  if (!owner || !storage) return;
  try {
    const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersistQuery });
    if (!state.queries.length) return;
    storage.setItem(KEY_PREFIX + owner, JSON.stringify({ savedAt: Date.now(), state }));
  } catch {
    // Storage full or blocked. Offline reading just will not be available.
  }
}

/**
 * Start copying the persisted queries to storage for `ownerId` (the auth
 * user id), and restore what was stored for that account. Call after the
 * query cache has been cleared for an account change.
 */
export function startQueryPersistence(queryClient, ownerId) {
  stopQueryPersistence();
  owner = ownerId || null;
  if (!owner || !storage) return;
  // Keep restored copies around for a day even with no page showing them,
  // so opening My Geckos late in an offline session still finds them.
  for (const key of PERSISTED_KEYS) {
    queryClient.setQueryDefaults([key], { gcTime: 24 * 60 * 60 * 1000 });
  }
  try {
    const raw = storage.getItem(KEY_PREFIX + owner);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.state && Date.now() - (parsed.savedAt || 0) < MAX_AGE_MS) {
      hydrate(queryClient, parsed.state);
    } else if (raw) {
      storage.removeItem(KEY_PREFIX + owner);
    }
  } catch {
    // A damaged copy is ignored; the next load replaces it.
  }
  unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event?.type !== 'updated' || !shouldPersistQuery(event.query)) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(queryClient), SAVE_DELAY_MS);
  });
}

export function stopQueryPersistence() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  owner = null;
}

/** Remove every stored copy (sign-out), so the next account starts clean. */
export function clearPersistedQueries() {
  stopQueryPersistence();
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
}
