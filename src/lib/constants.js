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
