import { useLayoutEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { THEMES, useTheme } from '@/lib/ThemeContext';

/**
 * Homepage experiment hold, for visitors who reach the homepage inside the
 * app (docs/planning/homepage-ab-test-2026-10.md).
 *
 * While the A/B test runs, a signed-out visitor on the homepage keeps the
 * look both designs launched with: the Blizzard theme and accent (unless
 * they saved their own) and data-landing-hold on <html>, which turns off
 * the October text-colour and link-underline rules in src/index.css.
 *
 * The theme script in index.html does this for a visit that opens on "/".
 * A visitor who opens a Morph Guide or Care Guide page first and then taps
 * the logo reaches "/" without a page load, so the script never runs for
 * them. This hook, called by the homepage (src/pages/Home.jsx), applies
 * the same hold as the page mounts, before the browser paints (a layout
 * effect), so the control page never shows in Emerald first. When they
 * leave the homepage, sign in or start the demo, it puts the theme the app
 * would otherwise show back. A hold set by index.html is left alone: it
 * lasts until the next page load, as before.
 *
 * Remove this hook and its line in Home.jsx with the rest of the hold when
 * the test ends.
 */
const HOLD = 'data-landing-hold';
const HELD = 'blizzard';
const VALID = new Set(THEMES.map((t) => t.id));

// A theme or accent the visitor saved on this device wins, as in index.html.
function saved(key) {
  try {
    const value = window.localStorage.getItem(key);
    return VALID.has(value) ? value : null;
  } catch {
    return null;
  }
}

function paint(root, theme, secondary) {
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-secondary', secondary);
  const color = THEMES.find((t) => t.id === theme)?.statusBar;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (color && meta) meta.setAttribute('content', color);
}

export default function useLandingThemeHold() {
  const { isAuthenticated, isGuest, isLoadingAuth } = useAuth();
  const { theme, secondary } = useTheme();
  // What the app shows without the hold, read when the hold ends.
  const current = useRef({ theme, secondary });
  current.current = { theme, secondary };
  const visitor = !isAuthenticated && !isGuest && !isLoadingAuth;

  useLayoutEffect(() => {
    if (!visitor || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    if (root.hasAttribute(HOLD)) return undefined;
    root.setAttribute(HOLD, '');
    paint(root, saved('geckinspect.theme') || HELD, saved('geckinspect.secondary') || HELD);
    return () => {
      root.removeAttribute(HOLD);
      paint(root, current.current.theme, current.current.secondary);
    };
  }, [visitor]);
}
