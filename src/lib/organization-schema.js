/**
 * Canonical Organization + WebSite schema for Geck Inspect.
 *
 * Single source of truth for:
 *   - Organization identity (name, logo, knowsAbout, sameAs)
 *   - WebSite identity (name, potentialAction/SearchAction)
 *   - Logo URL
 *   - Site URL
 *
 * Imported by:
 *   - src/components/seo/Seo.jsx (per-page site-identity augmentation)
 *   - scripts/prerender.mjs (build-time static HTML generation)
 *   - scripts/build-sitemap.mjs (consistent site URL)
 *   - any page-level JSON-LD in src/data/*-jsonld.js that references the
 *     publisher as { "@id": "https://geckinspect.com/#organization" }
 *
 * When adding social profiles, add them to SAME_AS. Every external profile
 * in this array strengthens entity recognition across ChatGPT, Gemini,
 * Perplexity, and Google Knowledge Graph — the audit flagged this as the
 * single most impactful fix after SSR.
 */

export const SITE_URL = 'https://geckinspect.com';
export const SITE_NAME = 'Geck Inspect';
export const SITE_DESCRIPTION =
  'The professional platform for crested gecko breeders and keepers. Track collections, plan breedings, identify morphs with AI, and connect with the community.';

export const LOGO_URL =
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';

// External profiles for Organization.sameAs. Every URL here is a signed
// Geck Inspect presence that AI entity-recognition systems weigh heavily.
// Commented entries are planned but not yet created — leaving them as
// comments prevents 404s in the live structured data while tracking the
// audit follow-ups the team needs to complete.
export const SAME_AS = [
  // 'https://www.instagram.com/geckinspect/',
  // 'https://www.tiktok.com/@geckinspect',
  // 'https://www.youtube.com/@geckinspect',
  // 'https://www.linkedin.com/company/geck-inspect/',
  // 'https://www.reddit.com/user/geckinspect/',
  // 'https://www.morphmarket.com/stores/geckinspect/',
  // 'https://x.com/geckinspect',
  // 'https://www.wikidata.org/wiki/<Qxxxxxx>',
];

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE_NAME,
  alternateName: ['Geck Inspect — Crested Gecko Platform', 'geckOS'],
  url: `${SITE_URL}/`,
  logo: {
    '@type': 'ImageObject',
    url: LOGO_URL,
    width: 512,
    height: 512,
  },
  description:
    'Professional platform for crested gecko breeders and keepers, providing collection management, breeding planning, AI-powered morph identification, lineage tracking, and community tools.',
  knowsAbout: [
    'Crested gecko',
    'Correlophus ciliatus',
    'Reptile husbandry',
    'Gecko breeding',
    'Morph genetics',
    'Lineage tracking',
  ],
  sameAs: SAME_AS,
};

export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
  inLanguage: 'en-US',
  publisher: { '@id': ORG_ID },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/MorphGuide?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

/**
 * Build a BreadcrumbList schema object from an ordered list of crumbs.
 *
 * Example:
 *   breadcrumbSchema([
 *     { name: 'Home', path: '/' },
 *     { name: 'Morph Guide', path: '/MorphGuide' },
 *     { name: 'Harlequin', path: '/MorphGuide/harlequin' },
 *   ])
 */
export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path.startsWith('/') ? c.path : `/${c.path}`}`,
    })),
  };
}
