import { supabase } from '@/lib/supabaseClient';

/**
 * Telemetry — lightweight event + error logging into Supabase.
 *
 * PostHog already captures click/pageview noise. This module is for the
 * events we want to slice in the in-app admin analytics dashboard
 * without leaving the database (so charts live where the data lives).
 *
 * Both functions are best-effort — they swallow all errors. A telemetry
 * failure must never break a user flow.
 */

let sessionId = null;
function getSessionId() {
  if (sessionId) return sessionId;
  try {
    const stored = sessionStorage.getItem('geck_session_id');
    if (stored) {
      sessionId = stored;
      return sessionId;
    }
    const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('geck_session_id', id);
    sessionId = id;
    return sessionId;
  } catch {
    return 'no_session';
  }
}

async function getCurrentEmail() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email || null;
  } catch {
    return null;
  }
}

function getPagePath() {
  try {
    return window.location.pathname.replace(/^\//, '') || 'Home';
  } catch {
    return null;
  }
}

// Throttle: don't record the same event more than once every 2 seconds.
const lastSent = new Map();

export async function trackEvent(name, properties = {}) {
  if (!name) return;
  try {
    const key = `${name}:${JSON.stringify(properties).slice(0, 80)}`;
    const now = Date.now();
    const last = lastSent.get(key) || 0;
    if (now - last < 2000) return;
    lastSent.set(key, now);

    const email = await getCurrentEmail();
    await supabase.from('user_events').insert({
      event_name: name,
      user_email: email,
      page: getPagePath(),
      session_id: getSessionId(),
      properties,
      created_by: email,
    });
  } catch {
    // intentionally silent
  }
}

export async function trackPageView(pageName) {
  return trackEvent('page_view', { page: pageName || getPagePath() });
}

export async function reportError(error, info = {}) {
  if (!error) return;
  try {
    const email = await getCurrentEmail();
    const message = error?.message || String(error);
    const stack = error?.stack || null;
    await supabase.from('error_logs').insert({
      level: info.level || 'error',
      message: message.slice(0, 1000),
      stack: stack ? stack.slice(0, 4000) : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_email: email,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      context: {
        component: info.component || null,
        page: getPagePath(),
        ...info.extra,
      },
      created_by: email,
    });
  } catch {
    // intentionally silent
  }
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    if (event?.error) {
      reportError(event.error, { extra: { source: 'window.error' } });
    } else if (event?.message) {
      reportError(new Error(event.message), { extra: { source: 'window.error' } });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    if (reason instanceof Error) {
      reportError(reason, { extra: { source: 'unhandledrejection' } });
    } else if (reason) {
      reportError(new Error(String(reason)), { extra: { source: 'unhandledrejection' } });
    }
  });
}
