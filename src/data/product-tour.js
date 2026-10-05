/**
 * Product tour manifest, drives the screenshot slideshow on the
 * public landing page (rendered by ProductTour.jsx, replacing the
 * gecko-photo HeroSlideshow).
 *
 * Each slide points at a static image under /public/screenshots/. A slide
 * is only requested once it is marked `shipped: true`: commit the image
 * and flip the flag in the same change. (Until October 2026 every slide
 * was probed on each landing visit, and production answered each missing
 * file with the app HTML, so nine wasted downloads per visit.)
 * ProductTour.jsx still hides a shipped slide whose image fails to load.
 *
 * Capture guidance:
 *   - 1600 x 1000 px (16:10) WebP, plus an optional 780 x 976 (4:5)
 *     phone capture as `mobileFile` (shown below 640 px wide).
 *   - Capture the page on a wide laptop viewport (≥1440 wide), zoom 100%.
 *   - Use a populated demo collection so the screenshot looks real,
 *     not like an empty state.
 *   - Crop to remove any browser chrome, the tour frames the image
 *     in a card, so include the in-app header/sidebar but no Chrome
 *     tabs or OS window decorations.
 */

export const PRODUCT_TOUR_SLIDES = [
  // Shipped October 2026, captured from the guest demo collection (sample
  // geckos) with value estimates from the real Geck Data listings table.
  // Each has a 1600 x 1000 laptop file and a 780 x 976 (4:5) phone file
  // (`mobileFile`), WebP. Demo geckos have no photos in the sandbox the
  // captures were made in, so photo slots show the app's own placeholder.
  {
    id: 'gecko-record',
    file: 'gecko-record.webp',
    mobileFile: 'gecko-record-phone.webp',
    title: 'One record per gecko',
    caption: 'Morph, weigh-ins against the typical range for its age, and a value estimate from real crested gecko listings.',
    captureUrl: '/GeckoDetail?id=mock-gecko-4 (demo)',
    shipped: true,
  },
  {
    id: 'calculator',
    file: 'genetics-calculator.webp',
    mobileFile: 'genetics-calculator-phone.webp',
    title: 'Genetics calculator',
    caption: 'Pick a sire and dam and see every possible baby with its odds and a guide price for each outcome.',
    captureUrl: '/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1 (demo)',
    shipped: true,
  },
  {
    id: 'lineage',
    file: 'lineage-tree.webp',
    mobileFile: 'lineage-tree-phone.webp',
    title: 'Multi-generation lineage',
    caption: 'Trace any gecko back through its parents and grandparents, with known ancestors and inbreeding (COI) at a glance.',
    captureUrl: '/Lineage?geckoId=mock-gecko-4 (demo)',
    shipped: true,
  },
  {
    id: 'breeding-planner',
    file: 'breeding-planner.webp',
    mobileFile: 'breeding-planner-phone.webp',
    title: 'Breeding plans',
    caption: 'Every pairing in one place: days since the last egg, clutches logged, and the hatchery one tab away.',
    captureUrl: '/Breeding (demo)',
    shipped: true,
  },
  {
    id: 'portfolio',
    file: 'portfolio.webp',
    mobileFile: 'portfolio-phone.webp',
    title: 'Collection value',
    caption: 'Automatic value estimates for every gecko from real crested gecko listings, with your collection total tracked over time.',
    captureUrl: '/Portfolio (demo)',
    shipped: true,
  },
  // Not captured yet: these need real photos, which the demo cannot show
  // without network access to its photo hosts. Capture on production.
  {
    id: 'dashboard',
    file: 'dashboard.webp',
    title: 'Dashboard',
    caption: 'Your collection at a glance: geckos, breeding pairs, recent activity and weights due.',
    captureUrl: 'https://geckinspect.com/Dashboard',
  },
  {
    id: 'morph-guide',
    file: 'morph-guide.webp',
    title: 'Morph guide',
    caption: 'Photo-led references for every major morph. Browse by pattern, base, or inheritance.',
    captureUrl: 'https://geckinspect.com/MorphGuide',
  },
  {
    id: 'morph-id',
    file: 'ai-morph-id.webp',
    title: 'AI morph identification',
    caption: 'Compare up to five photos, get a ranked visual shortlist, and see what evidence or next photo matters.',
    captureUrl: 'https://geckinspect.com/Recognition',
  },
  {
    id: 'storefront',
    file: 'breeder-storefront.webp',
    title: 'Public breeder storefront',
    caption: 'Your customer-facing page on geckinspect.com. For-sale geckos with verifiable pedigrees, reviews, and direct contact.',
    captureUrl: 'https://geckinspect.com/Breeder/<your-slug>',
  },
  {
    id: 'photo-timeline',
    file: 'photo-timeline.webp',
    title: 'Photo timeline per gecko',
    caption: 'Watch a hatchling grow into adulthood in one auto-advancing slideshow. Every photo stays with the animal.',
    captureUrl: 'https://geckinspect.com/GeckoDetail?id=<a-gecko-with-many-photos>',
  },
];

// File-system base path the React component pulls images from.
// The slideshow expects the screenshots to live in /public/screenshots/
// so the production URL is /screenshots/<file>.
export const SCREENSHOTS_BASE = '/screenshots/';
