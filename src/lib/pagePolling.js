/**
 * Visibility-aware polling (launch review F47).
 *
 * Every open tab used to poll notifications, messages, the live feed and
 * a few alert systems on fixed timers, whether or not anyone was looking.
 * A member with the app open in a background tab all day generated the
 * same load as an active one. These helpers make a poll skip its tick
 * when the tab is hidden or the member has been idle for a while, and
 * catch up immediately when they come back.
 *
 * Rules:
 *   - hidden tab: no ticks
 *   - visible but idle for IDLE_MS (no pointer, key, touch or scroll):
 *     no ticks
 *   - returning to the tab, or interacting after being idle, runs the
 *     poll at once if a tick was missed
 */

const IDLE_MS = 10 * 60 * 1000;

let lastActivity = Date.now();
let listening = false;

function bumpActivity() {
  lastActivity = Date.now();
}

function ensureActivityListeners() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
    window.addEventListener(ev, bumpActivity, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bumpActivity();
  });
}

/** True when the tab is visible and the member has done something recently. */
export function isPageActive() {
  if (typeof document === 'undefined') return true;
  if (document.visibilityState !== 'visible') return false;
  ensureActivityListeners();
  return Date.now() - lastActivity < IDLE_MS;
}

/**
 * Like setInterval(fn, intervalMs) but only while the page is active.
 * Does not run fn on start (callers already do that). Returns a stop
 * function to call from the effect cleanup.
 */
export function startVisiblePolling(fn, intervalMs) {
  if (typeof window === 'undefined') return () => {};
  ensureActivityListeners();
  let lastRun = Date.now();
  let stopped = false;

  const run = () => {
    if (stopped) return;
    lastRun = Date.now();
    fn();
  };
  const overdue = () => Date.now() - lastRun >= intervalMs;

  const id = setInterval(() => {
    if (isPageActive()) run();
  }, intervalMs);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && overdue()) run();
  };
  const onActive = () => {
    if (overdue()) run();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pointerdown', onActive, { passive: true });
  window.addEventListener('keydown', onActive, { passive: true });

  return () => {
    stopped = true;
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pointerdown', onActive);
    window.removeEventListener('keydown', onActive);
  };
}
