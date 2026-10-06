/**
 * The guided demo: a short general tour, plus topic tours a guest can
 * pick from a hub to see one part of the app in more depth.
 *
 *   quick       The one-minute tour (start here): collection, one
 *               gecko's record, the calculator, what they are worth
 *   collection  Collection and care
 *   breeding    Breeding and genetics
 *   morphs      Morphs and Morph ID
 *   market      Prices and value
 *   community   Forum and messages
 *
 * The hub suggests which tour to take next. The quick tour comes first;
 * after that the order follows what the guest says they do (keep or
 * breed), skipping tours they have already finished.
 *
 * The state lives in sessionStorage, so it follows the guest from page
 * to page and ends with the tab. The ids below are the demo geckos in
 * src/lib/guestMockData.js.
 */

const KEY = 'geck_inspect_guest_tour';

const NIMBUS = '/GeckoDetail?id=mock-gecko-4';
const NIMBUS_PARENTS_CALC = '/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1';

export const TOURS = [
  {
    id: 'quick',
    title: 'The one-minute tour',
    short: 'Quick tour',
    blurb: "A taste of everything: a breeder's collection, one gecko's full record, clutch odds and prices.",
    icon: 'compass',
    steps: [
      {
        id: 'collection',
        path: '/MyGeckos',
        title: "A breeder's collection",
        body: 'These are sample crested geckos, shown the way yours would be: photo, sex, weight, age and traits on every card.',
        next: "Open one gecko's record",
      },
      {
        id: 'record',
        path: NIMBUS,
        title: "Nimbus's record",
        body: 'His weigh-ins against the healthy range for his age, what he is worth from real listings, his parents with a link to the family tree, and when his next shed is due.',
        next: "Plan his parents' next clutch",
      },
      {
        id: 'calculator',
        path: NIMBUS_PARENTS_CALC,
        title: 'Odds before you pair',
        body: "Nimbus's parents, Spud and Harley, are loaded. Their clutch odds are listed below them on this page, down to the possible hets.",
        next: 'See what geckos sell for',
      },
      {
        id: 'market',
        path: '/Market',
        title: 'What they are worth',
        body: 'Every gecko in the demo collection priced from real listings, plus the typical asking price for Lilly White, Axanthic, Sable, Cappuccino and more.',
        next: 'Finish the tour',
      },
    ],
  },
  {
    id: 'collection',
    title: 'Collection and care',
    short: 'Collection',
    blurb: 'Records, weigh-ins, sheds and what each gecko needs next.',
    icon: 'geckos',
    steps: [
      {
        id: 'collection-list',
        path: '/MyGeckos',
        title: 'Every gecko on one screen',
        body: 'Search, filter by sex, morph or status, and sort by age or weight. Tap any card for its full record.',
        next: 'Open a record',
      },
      {
        id: 'collection-record',
        path: NIMBUS,
        title: 'Weights that mean something',
        body: "Nimbus's weigh-ins sit on the healthy growth band for his age, so a slow month stands out. His shed forecast and notes live here too.",
        next: 'See what needs doing today',
      },
      {
        id: 'collection-reminders',
        path: '/Notifications',
        title: 'Reminders that come to you',
        body: 'Feeding days, eggs close to hatching and buyer questions arrive here, so nothing slips between tubs.',
        next: 'Open the care guide',
      },
      {
        id: 'collection-care',
        path: '/CareGuide/weight-tracking',
        title: 'Care guide, built in',
        body: 'What a healthy weight looks like at each age, plus feeding, housing, handling and health, all written for crested geckos.',
        next: 'Finish this tour',
      },
    ],
  },
  {
    id: 'breeding',
    title: 'Breeding and genetics',
    short: 'Breeding',
    blurb: 'Pairings, eggs in the incubator, family trees and clutch odds.',
    icon: 'heart',
    steps: [
      {
        id: 'breeding-plans',
        path: '/Breeding',
        title: "This season's pairings",
        body: 'Harley and Spud, Aria and Onyx, Moss and Cappy: each pairing tracks its dates, clutches and eggs in one card.',
        next: 'Check the incubator',
      },
      {
        id: 'breeding-hatchery',
        path: '/Breeding?tab=hatchery',
        title: 'Eggs in the incubator',
        body: 'Every egg with its lay date and a hatch window, so you know which box to watch this week.',
        next: 'Trace a family tree',
      },
      {
        id: 'breeding-lineage',
        path: '/Lineage?geckoId=mock-gecko-4',
        title: 'Three generations of Nimbus',
        body: 'His parents Spud and Harley, and their parents Thor, Sunny, Diamond and Ruby. Tap any gecko to follow its line.',
        next: 'Run the clutch odds',
      },
      {
        id: 'breeding-calculator',
        path: NIMBUS_PARENTS_CALC,
        title: 'Odds before you pair',
        body: 'Spud and Harley are loaded. Scroll for the odds of each outcome in their next clutch, including the hets they could pass on.',
        next: 'Finish this tour',
      },
    ],
  },
  {
    id: 'morphs',
    title: 'Morphs and Morph ID',
    short: 'Morphs',
    blurb: 'The morph guide, a trait up close, and AI Morph ID from a photo.',
    icon: 'sparkles',
    steps: [
      {
        id: 'morphs-guide',
        path: '/MorphGuide',
        title: 'The crested gecko morph guide',
        body: 'Every trait from Harlequin to Phantom, grouped by pattern, color and structure, with how each one is inherited.',
        next: 'Look at one morph',
      },
      {
        id: 'morphs-detail',
        path: '/MorphGuide/lilly-white',
        title: 'Lilly White, up close',
        body: 'What it looks like, how it is passed on, the lookalikes and how to tell them apart.',
        next: 'Try Morph ID',
      },
      {
        id: 'morphs-id',
        path: '/Recognition',
        title: 'Morph ID from two photos',
        body: 'Add a top and a side view and get a ranked shortlist of likely traits, with the evidence behind each one. Your first check is free with an account.',
        next: 'Learn the genetics',
      },
      {
        id: 'morphs-genetics',
        path: '/GeneticsGuide',
        title: 'Genetics, in plain words',
        body: 'Dominant, recessive and incomplete dominant traits explained with crested gecko examples, so the calculator makes sense.',
        next: 'Finish this tour',
      },
    ],
  },
  {
    id: 'market',
    title: 'Prices and value',
    short: 'Prices',
    blurb: 'What crested geckos sell for, and what each of yours is worth.',
    icon: 'chart',
    steps: [
      {
        id: 'market-brief',
        path: '/Market',
        title: 'The market at a glance',
        body: 'Typical asking prices by morph from real listings, and the demo collection valued gecko by gecko.',
        next: 'See one gecko valued',
      },
      {
        id: 'market-value',
        path: NIMBUS,
        title: 'A value on every record',
        body: "Nimbus's card shows a price range from listings with his traits, so you can price a holdback or a sale with confidence.",
        next: 'Finish this tour',
      },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    short: 'Community',
    blurb: 'The forum and messages between keepers and breeders.',
    icon: 'users',
    steps: [
      {
        id: 'community-forum',
        path: '/Forum',
        title: 'Ask other crestie keepers',
        body: 'Questions on care, morphs and breeding, answered by keepers and breeders who focus on crested geckos.',
        next: 'Open messages',
      },
      {
        id: 'community-messages',
        path: '/Messages',
        title: 'Talk to breeders directly',
        body: 'Message a breeder about a gecko or a pairing without swapping phone numbers. Replies show up in your notifications.',
        next: 'Finish this tour',
      },
    ],
  },
];

export const TOUR_BY_ID = Object.fromEntries(TOURS.map((t) => [t.id, t]));

// What the guest says they do, which sets the suggested order after the
// quick tour.
export const ROLES = [
  { id: 'keeper', label: 'I keep geckos' },
  { id: 'breeder', label: 'I breed geckos' },
];
const ORDER = {
  keeper: ['quick', 'collection', 'morphs', 'community', 'breeding', 'market'],
  breeder: ['quick', 'breeding', 'market', 'collection', 'morphs', 'community'],
};

/** Back-compat: the quick tour's steps. */
export const TOUR_STEPS = TOUR_BY_ID.quick.steps;

// After a tour: sign up and go straight to adding a first gecko.
export const TOUR_SIGNUP_URL = `/AuthPortal?mode=signup&redirect=${encodeURIComponent('/MyGeckos?add=1')}`;

const DEFAULT_STATE = { status: 'offer', tour: 'quick', step: 0, done: [], role: 'breeder' };

const read = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    if (!TOUR_BY_ID[state.tour]) state.tour = 'quick';
    if (!Array.isArray(state.done)) state.done = [];
    return state;
  } catch {
    return null;
  }
};

// Fired whenever the tour moves, so other floating notices (the feeding
// reminders) can step aside while it runs.
export const TOUR_CHANGED_EVENT = 'geck_inspect_guest_tour_changed';

const write = (state) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the tour just does not persist between pages.
  }
  try {
    window.dispatchEvent(new CustomEvent(TOUR_CHANGED_EVENT, { detail: state }));
  } catch {
    // no window (tests)
  }
  return state;
};

/** True while any tour card or the hub is on screen. */
export function tourOnScreen() {
  return getTourState().status !== 'closed';
}

/**
 * Tour state: { status, tour, step, done, role }.
 *   status  'offer' (first card of a guest session), 'hub' (the tour
 *           picker), 'active', 'finished' (the card after a tour) or
 *           'closed'
 *   tour    id of the current or last tour
 *   done    ids of the tours the guest has finished
 *   role    'keeper' or 'breeder', which sets the suggested order
 *   back    the status the hub was opened from
 */
export function getTourState() {
  return read() || { ...DEFAULT_STATE };
}

export function getTour(state = getTourState()) {
  return TOUR_BY_ID[state.tour] || TOUR_BY_ID.quick;
}

export const startTour = (tourId = 'quick') =>
  write({ ...getTourState(), status: 'active', tour: TOUR_BY_ID[tourId] ? tourId : 'quick', step: 0 });
export function openHub() {
  const state = getTourState();
  if (state.status === 'hub') return state;
  return write({ ...state, status: 'hub', back: state.status });
}
/** Leave the hub: back to the tour card it was opened from, else closed. */
export function closeHub() {
  const state = getTourState();
  const back = ['active', 'finished'].includes(state.back) ? state.back : 'closed';
  return write({ ...state, status: back });
}
export const closeTour = () => write({ ...getTourState(), status: 'closed' });
export const setRole = (role) => write({ ...getTourState(), role: ORDER[role] ? role : 'breeder' });

export function advanceTour() {
  const state = getTourState();
  const tour = getTour(state);
  const step = state.step + 1;
  if (step < tour.steps.length) return write({ ...state, status: 'active', step });
  const done = state.done.includes(tour.id) ? state.done : [...state.done, tour.id];
  return write({ ...state, status: 'finished', step: tour.steps.length - 1, done });
}

export function backTour() {
  const state = getTourState();
  return write({ ...state, status: 'active', step: Math.max(0, state.step - 1) });
}

/** The tour to suggest next: the first in the guest's order not yet done. */
export function suggestedTour(state = getTourState()) {
  const order = ORDER[state.role] || ORDER.breeder;
  const id = order.find((t) => !state.done.includes(t));
  return id ? TOUR_BY_ID[id] : null;
}

/** All tours in the guest's suggested order. */
export function orderedTours(state = getTourState()) {
  const order = ORDER[state.role] || ORDER.breeder;
  return order.map((id) => TOUR_BY_ID[id]);
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
