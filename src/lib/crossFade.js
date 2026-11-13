// A short cross-fade when the screen changes (experience review L1).
//
// document.startViewTransition takes a picture of the screen, runs the
// change, then fades the picture out over the new screen. The fade is
// 120 ms, set in src/styles/layout-theme.css. Whatever looks the same
// before and after (the phone bars, the sidebar, a floating notice) holds
// still: the browser adds the two pictures together, so a pixel that did
// not change does not fade.
//
// Browsers without the feature, and people who ask their device for
// reduced motion, get the change at once, exactly as before.
//
// Only the signed-in shell uses this (src/Layout.jsx and pages inside it).
// Keep it out of anything src/App.jsx loads up front: every public page
// would download it, and those pages are size-budgeted and do not fade.
import { flushSync } from 'react-dom';

// The browser runs the change after its next frame, once it has the
// picture. If no frame comes (a busy phone, a covered window), the change
// runs anyway after this long, without the fade. A tap never waits more.
const START_WAIT_MS = 150;

function wantsReducedMotion(win) {
  try {
    return typeof win?.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True when this browser can cross-fade and the person has not asked for less motion. */
export function canCrossFade({ doc = globalThis.document, win = globalThis.window } = {}) {
  return typeof doc?.startViewTransition === 'function' && !wantsReducedMotion(win);
}

// The fade that is still waiting for its picture, if any: { changes, run }.
let waiting = null;

/**
 * Runs the changes that are still waiting for their picture, now. Call it
 * before anything that has to happen after them (a redirect that follows
 * a move to another screen), so the two cannot swap places.
 */
export function flushCrossFade() {
  if (waiting) waiting.run();
}

/**
 * Makes a change to the screen with a cross-fade where the browser can,
 * and at once where it cannot. `update` changes the screen; it may return
 * a promise that settles when the new screen is drawn, and the fade waits
 * for it. `update` runs exactly once either way.
 *
 * A second change made while the first still waits for its picture joins
 * the same fade, after the first. (One tap can ask twice: a tab fires on
 * press and again on focus.)
 */
export function crossFade(update, { doc = globalThis.document, win = globalThis.window } = {}) {
  if (!canCrossFade({ doc, win })) {
    flushCrossFade();
    update();
    return;
  }
  if (waiting) {
    waiting.changes.push(update);
    return;
  }
  const changes = [update];
  let ran = false;
  let result;
  let timer = null;
  const run = () => {
    if (ran) return result;
    ran = true;
    if (waiting?.run === run) waiting = null;
    clearTimeout(timer);
    // Every change gets its turn, even if an earlier one throws.
    const results = [];
    let failed = null;
    for (const change of changes) {
      try {
        results.push(change());
      } catch (error) {
        failed ||= { error };
      }
    }
    if (failed) throw failed.error;
    result = results.length === 1 ? results[0] : Promise.all(results);
    return result;
  };
  waiting = { changes, run };
  timer = setTimeout(run, START_WAIT_MS);
  let transition;
  try {
    transition = doc.startViewTransition(run);
  } catch {
    run();
    return;
  }
  // A fade that is skipped (the tab is hidden, or the next change starts)
  // rejects these two. The change itself still ran, so there is nothing
  // to report.
  transition?.ready?.catch?.(() => {});
  transition?.finished?.catch?.(() => {});
}

/**
 * The same for a change made with React state, such as a tab inside a
 * page: the state is applied in one go inside the fade, so the browser's
 * second picture is of the finished screen.
 */
export function crossFadeState(update, env) {
  if (!canCrossFade(env)) {
    update();
    return;
  }
  crossFade(() => { flushSync(update); }, env);
}
