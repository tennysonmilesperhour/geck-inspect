/**
 * The guided demo (VIP audit P6): three stops through the sample data,
 * then a "make it yours" moment with the sign-up button.
 *
 *   1. My Geckos: a breeder's collection
 *   2. One gecko's record (Nimbus: weights with the growth band, his
 *      parents and family tree, shed forecast)
 *   3. The calculator with Nimbus's parents, Spud and Harley, loaded
 *
 * The tour lives in sessionStorage, so it follows the guest from page to
 * page and ends with the tab. The ids below are the demo geckos in
 * src/lib/guestMockData.js.
 */

const KEY = 'geck_inspect_guest_tour';

export const TOUR_STEPS = [
  {
    id: 'collection',
    path: '/MyGeckos',
    title: "A breeder's collection",
    body: 'These are sample crested geckos, shown the way yours would be: photo, sex, weight, age and traits on every card.',
    next: "Open one gecko's record",
  },
  {
    id: 'record',
    path: '/GeckoDetail?id=mock-gecko-4',
    title: "Nimbus's record",
    body: 'His weigh-ins with the healthy range for his age shaded behind them, his parents with a link to the full family tree, and when his next shed is due.',
    next: "Plan his parents' next clutch",
  },
  {
    id: 'calculator',
    path: '/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1',
    title: 'Odds before you pair',
    body: "Nimbus's parents, Spud and Harley, are loaded. Scroll down for the odds of every baby in their next clutch, down to the possible hets.",
    next: 'Make it yours',
  },
];

// After the last step: sign up and go straight to adding a first gecko.
export const TOUR_SIGNUP_URL = `/AuthPortal?mode=signup&redirect=${encodeURIComponent('/MyGeckos?add=1')}`;

const read = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (state) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the tour just does not persist between pages.
  }
  return state;
};

/**
 * Tour state: { status: 'offer' | 'active' | 'finished' | 'closed', step }.
 * A new guest session starts on 'offer' (a card asking whether to take
 * the tour); step counts from 0; 'finished' is the sign-up card.
 */
export function getTourState() {
  return read() || { status: 'offer', step: 0 };
}

export const startTour = () => write({ status: 'active', step: 0 });
export const closeTour = () => write({ ...getTourState(), status: 'closed' });

export function advanceTour() {
  const state = getTourState();
  const step = state.step + 1;
  return write(step >= TOUR_STEPS.length ? { status: 'finished', step: TOUR_STEPS.length - 1 } : { status: 'active', step });
}

/** True when the browser is on this step's page (path and query). */
export function isOnStep(step, pathname, search = '') {
  if (!step) return false;
  const [path, query = ''] = step.path.split('?');
  if (pathname.toLowerCase() !== path.toLowerCase()) return false;
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(search);
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false;
  }
  return true;
}
