/**
 * App-wide constants.
 *
 * Single source of truth for URLs and values that are repeated across
 * many files. Change once here, reflected everywhere.
 */

// Logo lives in /public/logo.png so it ships with the build (no
// external dependency). Kept as an absolute URL because consumers
// include og:image / JSON-LD where absolute URLs are required.
export const APP_LOGO_URL = 'https://geckinspect.com/logo.png';

// The standalone geck-data (Market Intelligence) app lives on its own
// subdomain so it deploys independently. The topbar launcher opens this
// in a new tab; the in-app Business Tools Market Analytics module is the
// "quick look" counterpart.
//
// Override per environment with VITE_MARKET_INTEL_URL (e.g. point
// previews at a staging geck-data deployment). Falls back to the prod
// subdomain when unset.
export const MARKET_INTELLIGENCE_URL =
  import.meta.env.VITE_MARKET_INTEL_URL || 'https://geckintellect.geckinspect.com';

// URL of the JSON market snapshot that powers the in-app Business Tools
// Market Analytics module. Defaults to /data/market.json on the
// MARKET_INTELLIGENCE_URL domain. Override with VITE_MARKET_SNAPSHOT_URL
// if the snapshot lives at a different path (e.g. a CDN).
// If the fetch fails (network error, 404, CORS, bad JSON), the facade
// transparently falls back to deterministic mock fixtures.
export const MARKET_SNAPSHOT_URL =
  import.meta.env.VITE_MARKET_SNAPSHOT_URL || `${MARKET_INTELLIGENCE_URL}/data/market.json`;

export const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

export const GECKO_STATUS_OPTIONS = [
  'Pet',
  'Future Breeder',
  'Holdback',
  'Ready to Breed',
  'Proven',
  'For Sale',
  'Sold',
];

export const GECKO_SEX_OPTIONS = ['Male', 'Female', 'Unsexed'];
