/**
 * Product tour manifest ,  drives the screenshot slideshow on the
 * public landing page (rendered by ProductTour.jsx, replacing the
 * gecko-photo HeroSlideshow).
 *
 * Each slide points at a static image under /public/screenshots/. The
 * file does not need to exist yet: ProductTour.jsx hides any slide
 * whose image fails to load, so adding a screenshot to /public/screenshots/
 * with the matching filename automatically activates that slide.
 *
 * Capture guidance:
 *   - 1600 × 1000 px (16:10), PNG or WebP. WebP preferred for size.
 *   - Capture the page on a wide laptop viewport (≥1440 wide), zoom 100%.
 *   - Use a populated demo collection so the screenshot looks real,
 *     not like an empty state.
 *   - Crop to remove any browser chrome ,  the tour frames the image
 *     in a card, so include the in-app header/sidebar but no Chrome
 *     tabs or OS window decorations.
 */

export const PRODUCT_TOUR_SLIDES = [
  {
    id: 'dashboard',
    file: 'dashboard.png',
    title: 'Dashboard',
    caption: 'Your collection at a glance ,  geckos, breeding pairs, recent activity, weights due.',
    captureUrl: 'https://geckinspect.com/Dashboard',
  },
  {
    id: 'lineage',
    file: 'lineage-tree.png',
    title: 'Multi-generation lineage tree',
    caption: 'Trace any gecko back through every parent. Drag, expand, follow a recessive across generations.',
    captureUrl: 'https://geckinspect.com/MyGeckos (open a gecko → Lineage tab)',
  },
  {
    id: 'calculator',
    file: 'genetics-calculator.png',
    title: 'Multi-trait genetics calculator',
    caption: 'Project full clutch outcomes across every proven crested gecko trait. Co-dominant, recessive, polygenic.',
    captureUrl: 'https://geckinspect.com/calculator',
  },
  {
    id: 'morph-guide',
    file: 'morph-guide.png',
    title: 'Morph guide',
    caption: 'Photo-led references for every major morph. Browse by pattern, base, or inheritance.',
    captureUrl: 'https://geckinspect.com/MorphGuide',
  },
  {
    id: 'morph-id',
    file: 'ai-morph-id.png',
    title: 'AI morph identification',
    caption: 'Upload a photo, get primary morph, secondary traits, base color, and a confidence score.',
    captureUrl: 'https://geckinspect.com/MorphIdentifier',
  },
  {
    id: 'storefront',
    file: 'breeder-storefront.png',
    title: 'Public breeder storefront',
    caption: 'Your customer-facing page on geckinspect.com. For-sale geckos with verifiable pedigrees, reviews, and direct contact.',
    captureUrl: 'https://geckinspect.com/Breeder/<your-slug>',
  },
  {
    id: 'photo-timeline',
    file: 'photo-timeline.png',
    title: 'Photo timeline per gecko',
    caption: 'Watch a hatchling grow into adulthood in one auto-advancing slideshow. Every photo stays with the animal.',
    captureUrl: 'https://geckinspect.com/GeckoDetail?id=<a-gecko-with-many-photos>',
  },
  {
    id: 'breeding-planner',
    file: 'breeding-planner.png',
    title: 'Breeding & season planner',
    caption: 'Plan pairings, track copulation events, log eggs through incubation, and watch hatchlings appear automatically.',
    captureUrl: 'https://geckinspect.com/Breeding',
  },
];

// File-system base path the React component pulls images from.
// The slideshow expects the screenshots to live in /public/screenshots/
// so the production URL is /screenshots/<file>.
export const SCREENSHOTS_BASE = '/screenshots/';
