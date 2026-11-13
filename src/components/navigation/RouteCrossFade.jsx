import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { UNSAFE_NavigationContext as NavigationContext, useLocation } from 'react-router-dom';
import { canCrossFade, crossFade, flushCrossFade } from '@/lib/crossFade';

// The fade waits for the new screen to be in the page. React normally has
// it there within a few milliseconds (a page whose code is still loading
// shows its skeleton straight away); if it takes longer than this, the
// fade ends and the new screen simply appears, as it did before fades.
const LAND_WAIT_MS = 300;

const trim = (path) => String(path || '/').replace(/\/+$/, '').toLowerCase() || '/';

/**
 * True when a move goes to a different screen. A change of only the part
 * after "?" or "#" (a filter, a tab kept in the address) stays on the same
 * screen and gets no fade. `to` is what the router hands its history: a
 * path object or a string.
 */
export function leavesScreen(to, here) {
  const path = typeof to === 'string' ? to.split(/[?#]/)[0] : to?.pathname;
  if (!path) return false;
  return trim(path) !== trim(here);
}

/**
 * Wraps the signed-in shell so every move to another screen made inside it
 * cross-fades (experience review L1): the tabs, the menu, a link or a
 * button on a page.
 *
 * How: links and navigate() all end in one call, the router's
 * history.push. The shell hands the pages a copy of the router's
 * navigator whose push runs inside crossFade, so no link or page has to
 * know. Nothing else changes:
 *   - Back and forward are not touched (the phone's back swipe has its own
 *     motion, and a fade on top of it would show the screen twice).
 *   - Redirects (replace) are not faded.
 *   - Public pages sit outside the shell and never see this.
 *
 * The context is the router's own (exported as UNSAFE_ because its shape
 * is not promised between major versions). If it is ever missing or
 * different, the pages get the router untouched and nothing fades.
 */
export default function RouteCrossFade({ children }) {
  const router = useContext(NavigationContext);
  const location = useLocation();

  // Set while a fade is waiting for its new screen; called when the new
  // address has been drawn, or when the shell goes away (a move to a
  // public page).
  const landed = useRef(null);
  useLayoutEffect(() => {
    const land = () => landed.current?.();
    land();
    return land;
  }, [location]);

  const value = useMemo(() => {
    const real = router?.navigator;
    if (typeof real?.push !== 'function') return router;
    const push = (to, state, opts) => {
      // The router's history knows where it is now, even a moment after a
      // move that React has not drawn yet.
      const here = real.location?.pathname ?? window.location.pathname;
      if (!canCrossFade() || !leavesScreen(to, here)) {
        flushCrossFade();
        real.push(to, state, opts);
        return;
      }
      crossFade(() => new Promise((resolve) => {
        landed.current?.();
        const finish = () => {
          clearTimeout(timer);
          if (landed.current === finish) landed.current = null;
          resolve();
        };
        const timer = setTimeout(finish, LAND_WAIT_MS);
        landed.current = finish;
        real.push(to, state, opts);
      }));
    };
    // Everything else (the address reader, back and forward, replace) is
    // the router's own. replace and go first let a waiting push through,
    // so a redirect that follows a move cannot land before it.
    const navigator = Object.create(real, {
      push: { value: push },
      replace: { value: (...args) => { flushCrossFade(); return real.replace(...args); } },
      go: { value: (...args) => { flushCrossFade(); return real.go(...args); } },
    });
    return { ...router, navigator };
  }, [router]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
