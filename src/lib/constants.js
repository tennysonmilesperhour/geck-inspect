/**
 * App-wide constants.
 *
 * Single source of truth for URLs and values that are repeated across
 * many files. Change once here, reflected everywhere.
 */

// Logo hosted on the Base44 Supabase bucket. TODO: migrate to own
// bucket (mmuglfphhwlaluyfyxsp) or self-host in /public to eliminate
// the external dependency.
export const APP_LOGO_URL =
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';

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
