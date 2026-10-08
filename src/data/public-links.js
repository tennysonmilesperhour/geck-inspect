/**
 * Public links shared by the site footers and the prerendered shell.
 * Dependency-free so scripts/prerender.mjs can import this from Node.
 */

// The market app. The in-app launcher uses the custom domain
// (MARKET_INTELLIGENCE_URL in constants.js). This is the public URL
// crawlers and the marketing footer should point at.
export const GECK_INTELLECT_URL = 'https://geck-data.vercel.app';
export const GECK_INTELLECT_LABEL = 'Geck Intellect';

export const FOUNDER_NAME = 'Tennyson Taggart';
export const FOUNDER_URL = 'https://tennysontaggart.com';
