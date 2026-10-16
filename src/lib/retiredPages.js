// Pages that were retired (taken out of the app) and where their old
// links now go. One list, read in four places:
//   * App.jsx adds a client-side redirect for each path, signed in or not,
//     so a stale bookmark or an in-app link lands somewhere useful. An
//     entry with `prefix: true` also redirects every address under it
//     (/Store/stickers, /Store/cart).
//   * pages.config.js leaves the page out of the routes (LIVE_PAGES), and
//     Layout.jsx drops any page_config row for it, so an old "enabled" row
//     in the database cannot put it back in the sidebar.
//   * scripts/build-vercel-json.mjs turns each one into a redirect at the
//     edge: permanent (308), so search engines drop the old URL, except
//     for an entry with `keep: true`, which gets a temporary one (307).
//     Browsers remember a permanent redirect for good, so a kept feature
//     switched back on would stay unreachable at its old address.
//   * src/components/shared/RetiredPageNotice.jsx shows the entry's
//     `title` and `note` once, when a redirect's address carries
//     ?retired=<page>, so a member who followed an old link knows why
//     they landed somewhere else.
//
// Retiring means the route is gone; the database tables stay untouched.
// `keep: true` marks a feature Tennyson keeps to release again later
// (16 Oct 2026): its code stays too, with no deletion date. Switching one
// back on: delete its entry here (the page keeps its line in
// pages.config.js). The full list, with what each one did and why it
// was retired, is docs/planning/retired-features-2026-10.md.
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
  { page: 'MorphVisualizer', to: '/MorphGuide', keep: true },
  // Step 8: an older copy of Breeding with its own hatch flow. Its dated
  // "add a clutch with a grade" form now lives on each Breeding plan card.
  { page: 'BreedingPairs', to: '/Breeding' },
  // 6 Oct 2026: Buy and Sell moved into Market Intelligence, as the
  // In-app listings and Your listings tabs. /MarketplaceBuy and
  // /MarketplaceSell still work on their own.
  { page: 'Marketplace', to: '/Market?tab=browse' },

  // 16 Oct 2026, review item E3 23 (retire breadth). No member other than
  // the admin used any of these in the 30 days before (production, read
  // only); the counts are in docs/planning/retired-features-2026-10.md.
  {
    page: 'Promote',
    to: '/MyGeckos?retired=Promote',
    retired: '2026-10-16',
    keep: true,
    title: 'Promote is switched off',
    note: 'Social post drafts are no longer made in Geck Inspect. Posts you made before are kept.',
  },
  {
    page: 'BreederConsultant',
    to: '/CareGuide?retired=BreederConsultant',
    retired: '2026-10-16',
    keep: true,
    title: 'The AI Consultant is switched off',
    note: 'The Care Guide, Genetics Guide and Morph Guide answer most crested gecko questions, and the Forum takes the rest.',
  },
  {
    page: 'OtherReptiles',
    to: '/MyGeckos?retired=OtherReptiles',
    retired: '2026-10-16',
    keep: true,
    title: 'Other Reptiles is switched off',
    note: 'Geck Inspect is for crested geckos. Records you added for other reptiles are kept; ask support for a copy.',
  },
  // The supplies store and both sticker builders live under /Store.
  {
    page: 'Store',
    prefix: true,
    to: '/CareGuide?retired=Store',
    retired: '2026-10-16',
    keep: true,
    title: 'The supplies store is switched off',
    note: "The store and the sticker designer are closed. The Care Guide covers what an enclosure needs, and each gecko's passport has a printable QR card.",
  },
];

export const RETIRED_PAGE_NAMES = new Set(RETIRED_PAGES.map((r) => r.page));

/** True when the page is retired (its route redirects). */
export function isPageRetired(page) {
  return RETIRED_PAGE_NAMES.has(page);
}

/**
 * Runs `load` only while `page` is live; while it is retired, resolves to
 * `empty` without asking the database. For screens elsewhere in the app that
 * show a retired feature's records (the Dashboard's next actions and the
 * feeding pop-ups read Other Reptiles), so they come back with the page.
 */
export function loadUnlessRetired(page, load, empty = []) {
  return isPageRetired(page) ? Promise.resolve(empty) : load();
}

/** The retired page's entry, or null. */
export function retiredPageEntry(page) {
  return RETIRED_PAGES.find((r) => r.page === page) || null;
}

// Parts of a live page that are switched off, with the same rule: delete
// the line to switch it back on. The code and the stored data stay.
export const RETIRED_FEATURES = {
  // The visual website editor on My Store (13 Oct 2026). The only store
  // page is the admin's, and it has no website design saved. The store
  // page itself, and any design saved before, still show as they did.
  websiteBuilder: { retired: '2026-10-16', where: 'My Store (src/pages/MyStore.jsx)' },
};

/** True when a feature inside a live page is switched off. */
export function isFeatureRetired(name) {
  return Object.prototype.hasOwnProperty.call(RETIRED_FEATURES, name);
}
