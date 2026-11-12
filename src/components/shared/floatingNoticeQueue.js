import { useEffect, useSyncExternalStore } from 'react';

/**
 * One queue for the app's floating notices (experience review B3).
 *
 * Five notices can float over the page: the app update notice, the
 * analytics consent banner, the offline or sync status, the phone
 * notification ask beside a due feeding, and the guest tour card. They
 * are mounted in different places (App.jsx and Layout.jsx), so each used
 * to decide alone whether to show, and several could pile up on a phone.
 *
 * Now each one asks this queue. A notice calls
 * useFloatingNotice(id, wants) with `wants` true while it has something
 * to say, and renders only while the hook returns true. The queue lets
 * through the one that comes first in FLOATING_NOTICE_ORDER; when that
 * one is dismissed or goes away, the next shows. Each notice marks its
 * root with data-floating-notice="<id>", which the styles that hide
 * floating UI (src/index.css) and the tests both read.
 */
export const FLOATING_NOTICE_ORDER = ['update', 'consent', 'offline', 'feeding', 'tour'];

/** The one notice that may show: the first in the order that is waiting. */
export function pickFloatingNotice(waiting) {
  const ids = new Set(waiting);
  return FLOATING_NOTICE_ORDER.find((id) => ids.has(id)) ?? null;
}

// How many mounted notices want each slot (the tour card and the guest
// notice that follows it share "tour"), and the slot that is showing.
const waiting = new Map();
const listeners = new Set();
let showing = null;

function settle() {
  const next = pickFloatingNotice(waiting.keys());
  if (next === showing) return;
  showing = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getShowing = () => showing;
const getServerShowing = () => null;

/**
 * Joins the queue while `wants` is true. Returns true only while this
 * notice is the one allowed on screen, so the first render of a notice
 * that has just become eligible is always empty: two can never paint
 * together, even for a frame.
 */
export function useFloatingNotice(id, wants) {
  useEffect(() => {
    if (!wants) return undefined;
    waiting.set(id, (waiting.get(id) || 0) + 1);
    settle();
    return () => {
      const left = (waiting.get(id) || 1) - 1;
      if (left > 0) waiting.set(id, left);
      else waiting.delete(id);
      settle();
    };
  }, [id, wants]);
  const current = useSyncExternalStore(subscribe, getShowing, getServerShowing);
  return Boolean(wants) && current === id;
}
