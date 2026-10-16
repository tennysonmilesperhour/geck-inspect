/**
 * The Supabase client, loaded when it is needed instead of with the app.
 *
 * Why: the Supabase library is the largest part of the code every visitor
 * downloads before anything appears (about 60 KB compressed of the 217 KB
 * main script in October 2026). A signed-out visitor reading the landing
 * page or a Morph Guide page does not need it to see the page; they need
 * it a moment later at most (the live counters, the page-view log).
 *
 * So the modules the first screen depends on (the sign-in state, the
 * entity layer, telemetry) no longer import '@/lib/supabaseClient'
 * directly. They ask this module:
 *
 *   getSupabase()          the client now (downloads it if needed)
 *   getSupabaseWhenIdle()  the client once the page has drawn and the
 *                          browser is idle; what signed-out pages use
 *   peekSupabase()         the client if it is already here, else null
 *   hasSessionHint()       whether this browser may hold a sign-in (a
 *                          stored session, a sign-in link in the address,
 *                          or the native app), in which case the client
 *                          is loaded straight away, as before
 *
 * Every caller gets the same client instance as modules that still import
 * '@/lib/supabaseClient' directly (sign-in form, members' pages), because
 * it is one module either way.
 */

let modulePromise = null;
let loadedClient = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The '@/lib/supabaseClient' module, downloaded once, with two retries for a dropped request. */
export function loadSupabaseModule() {
  if (!modulePromise) {
    modulePromise = (async () => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const mod = await import('./supabaseClient');
          loadedClient = mod.supabase;
          return mod;
        } catch (err) {
          lastError = err;
          if (attempt < 2) await wait(400 * (attempt + 1));
        }
      }
      throw lastError;
    })();
    // A failed download can be tried again by the next caller.
    modulePromise.catch(() => { modulePromise = null; });
  }
  return modulePromise;
}

export function getSupabase() {
  if (loadedClient) return Promise.resolve(loadedClient);
  return loadSupabaseModule().then((mod) => mod.supabase);
}

export function peekSupabase() {
  return loadedClient;
}

// Runs fn once the page has loaded and the browser has a quiet moment, or
// after maxWaitMs at the latest, whichever comes first.
export function afterFirstPaint(fn, { maxWaitMs = 4000 } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    fn();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  const idle = () => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 200);
  };
  setTimeout(run, maxWaitMs);
  if (document.readyState === 'complete') idle();
  else window.addEventListener?.('load', idle, { once: true });
}

let idlePromise = null;
export function getSupabaseWhenIdle() {
  if (loadedClient || modulePromise) return getSupabase();
  if (!idlePromise) {
    idlePromise = new Promise((resolve) => afterFirstPaint(resolve)).then(() => getSupabase());
    idlePromise.catch(() => { idlePromise = null; });
  }
  return idlePromise;
}

// Supabase reads a sign-in from the address after an email confirmation,
// a password reset link or Google sign-in: tokens in the #fragment
// (implicit flow) or ?code= (PKCE flow), or an error from the provider.
const AUTH_IN_HASH = /(^|[#&])(access_token|refresh_token|error_description|error)=/;
const AUTH_IN_QUERY = /[?&](code|error_description|token_hash)=/;

export function hasSessionHint() {
  if (typeof window === 'undefined') return true;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch { /* not the native app */ }
  const location = window.location || {};
  if (AUTH_IN_HASH.test(location.hash || '') || AUTH_IN_QUERY.test(location.search || '')) return true;
  try {
    const storage = window.localStorage ?? globalThis.localStorage;
    for (let i = 0; i < (storage?.length || 0); i++) {
      const key = storage.key(i) || '';
      if (key.startsWith('sb-') && key.includes('-auth-token')) return true;
    }
  } catch {
    // Storage blocked: Supabase cannot keep a session here either.
  }
  return false;
}

/** Tests only: forget the loaded client. */
export function __resetSupabaseLazy() {
  modulePromise = null;
  loadedClient = null;
  idlePromise = null;
}
