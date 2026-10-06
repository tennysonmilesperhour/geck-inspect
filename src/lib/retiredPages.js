// Pages that were retired (taken out of the app) and where their old
// links now go. One list, read in three places:
//   * App.jsx adds a client-side redirect for each path, signed in or not,
//     so a stale bookmark or an in-app link lands somewhere useful.
//   * Layout.jsx drops any page_config row for these pages, so an old
//     "enabled" row in the database cannot put them back in the sidebar.
//   * scripts/build-vercel-json.mjs turns each one into a permanent (301)
//     redirect at the edge, so search engines drop the old URL.
//
// Retiring means the route is gone; the database tables stay untouched.
// See docs/planning/feature-completeness-audit-2026-09-29.md, step 5.
//
// Plain data with no imports, so the Node build scripts can read it too.

export const RETIRED_PAGES = [
  // D4: no loan was ever recorded, and a new loan never became active.
  { page: 'BreedingLoans', to: '/Breeding' },
  // Unfinished and unreachable since September 2026 (simulated shipping).
  { page: 'Mentorship', to: '/' },
  { page: 'Giveaways', to: '/' },
  { page: 'Shipping', to: '/' },
  { page: 'BreederShipping', to: '/' },
  // The old AI Training Center duplicated the Evidence Lab on /Training.
  { page: 'TrainModel', to: '/Training' },
  // D15: breeder pages and the marketplace cover its directory; its
  // forum tab duplicated the Forum.
  { page: 'CommunityConnect', to: '/Forum' },
  // D7: hidden until it is finished (placeholder art, its own trait list
  // and prices). The code stays in src/components/morph-visualizer.
  { page: 'MorphVisualizer', to: '/MorphGuide' },
  // Step 8: an older copy of Breeding with its own hatch flow. Its dated
  // "add a clutch with a grade" form now lives on each Breeding plan card.
  { page: 'BreedingPairs', to: '/Breeding' },
  // 6 Oct 2026: Buy and Sell moved into Market Intelligence, as the
  // In-app listings and Your listings tabs. /MarketplaceBuy and
  // /MarketplaceSell still work on their own.
  { page: 'Marketplace', to: '/Market?tab=browse' },
];

export const RETIRED_PAGE_NAMES = new Set(RETIRED_PAGES.map((r) => r.page));
