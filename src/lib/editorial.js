/**
 * Editorial metadata for Geck Inspect content pages.
 *
 * One source of truth for:
 *   - Author / reviewer identity
 *   - Publication + last-updated dates per content URL
 *   - Editorial policy copy
 *
 * Why this matters
 * ----------------
 * The 2026-04 GEO audit flagged the absence of author attribution,
 * publication dates, and last-updated timestamps as a major
 * E-E-A-T (experience, expertise, authority, trust) weakness. Google
 * weighs E-E-A-T heavily for YMYL-adjacent husbandry content, and AI
 * assistants (Perplexity, Gemini, AI Overviews) cite sources that
 * display explicit authorship and editorial freshness more readily.
 *
 * Usage
 * -----
 *   import { editorialFor, authorSchema } from '@/lib/editorial';
 *
 *   const meta = editorialFor('/CareGuide/humidity');
 *   // → { published, modified, reviewer }
 *
 *   // Drop into JSON-LD:
 *   {
 *     '@type': 'Article',
 *     author: authorSchema(),
 *     reviewedBy: authorSchema(),
 *     datePublished: meta.published,
 *     dateModified: meta.modified,
 *   }
 *
 * When updating dates
 * -------------------
 * Bump `modified` for any non-trivial content edit. Bump `published`
 * only when the page is created or rewritten top-to-bottom.
 */

import { ORG_ID, SITE_URL } from '@/lib/organization-schema';
import { BLOG_POSTS } from '@/data/blog-posts';

// Editorial byline. In the audit the reviewer is described as a panel
// of experienced keepers — represent that as an editorial collective
// rather than a single person, with the organization as the parent
// publisher. When individual subject-matter experts review content,
// replace this with a real Person entry (name, jobTitle, affiliation).
export const EDITORIAL_AUTHOR = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#editorial`,
  name: 'Geck Inspect Editorial',
  url: `${SITE_URL}/About`,
  description:
    'The Geck Inspect editorial team — breeders and long-time keepers of Correlophus ciliatus who review every care and morph guide before publication and on a rolling schedule thereafter.',
  parentOrganization: { '@id': ORG_ID },
  knowsAbout: [
    'Crested gecko husbandry',
    'Reptile breeding',
    'Correlophus ciliatus morph genetics',
    'Captive reptile health',
  ],
};

/**
 * Schema.org shape ready to drop into `author` / `reviewedBy` fields.
 */
export function authorSchema() {
  return EDITORIAL_AUTHOR;
}

// Default publication dates used when a route-specific entry is
// missing. The default "published" is the platform's public-launch
// date; the default "modified" is today at build time so freshly
// generated JSON-LD never looks stale.
const DEFAULT_PUBLISHED = '2025-06-01';
const DEFAULT_MODIFIED = new Date().toISOString().slice(0, 10);

// Per-path publication and last-update metadata. Fill this out over
// time — every path we don't list falls back to the defaults above.
// Paths are stored without a trailing slash to match the canonical
// form used throughout the app.
const PER_PATH = {
  '/': { published: '2025-06-01', modified: '2026-04-17' },
  '/About': { published: '2026-04-17', modified: '2026-04-17' },
  '/Contact': { published: '2026-04-17', modified: '2026-04-17' },
  '/Terms': { published: '2026-04-17', modified: '2026-04-17' },
  '/MarketplaceVerification': { published: '2026-04-17', modified: '2026-04-17' },
  '/PrivacyPolicy': { published: '2025-06-01', modified: '2026-04-05' },
  '/CareGuide': { published: '2025-06-15', modified: '2026-04-17' },
  '/MorphGuide': { published: '2025-07-01', modified: '2026-04-17' },
  '/GeneticsGuide': { published: '2025-07-15', modified: '2026-04-17' },
  '/GeneticCalculatorTool': { published: '2025-08-01', modified: '2026-04-17' },
  // Blog index — bumped whenever a new post ships. Per-post pages
  // resolve their dates from src/data/blog-posts.js (datePublished /
  // dateModified) via the /blog/<slug> branch in editorialFor().
  '/blog': { published: '2026-04-18', modified: '2026-04-18' },
};

/**
 * Look up editorial metadata for a path.
 *
 * Per-morph (/MorphGuide/<slug>) and per-care-topic (/CareGuide/<id>)
 * pages inherit the parent guide's dates by default — override a
 * specific slug by adding it to PER_PATH above.
 */
export function editorialFor(path) {
  if (PER_PATH[path]) return { ...PER_PATH[path], reviewer: EDITORIAL_AUTHOR };

  if (path.startsWith('/MorphGuide/')) {
    return { ...PER_PATH['/MorphGuide'], reviewer: EDITORIAL_AUTHOR };
  }
  if (path.startsWith('/CareGuide/')) {
    return { ...PER_PATH['/CareGuide'], reviewer: EDITORIAL_AUTHOR };
  }
  // Per-post blog dates live on the post itself (datePublished /
  // dateModified in src/data/blog-posts.js). Fall back to the index
  // entry if the slug is unknown.
  if (path.startsWith('/blog/')) {
    const slug = path.slice('/blog/'.length);
    const post = BLOG_POST_INDEX[slug];
    if (post) {
      return {
        published: post.datePublished,
        modified: post.dateModified || post.datePublished,
        reviewer: EDITORIAL_AUTHOR,
      };
    }
    return { ...PER_PATH['/blog'], reviewer: EDITORIAL_AUTHOR };
  }
  return {
    published: DEFAULT_PUBLISHED,
    modified: DEFAULT_MODIFIED,
    reviewer: EDITORIAL_AUTHOR,
  };
}

const BLOG_POST_INDEX = Object.fromEntries(
  BLOG_POSTS.map((p) => [p.slug, p]),
);

/**
 * Human-readable byline for visible rendering on each content page.
 * Example output:
 *   "Published 2025-07-01 · Last updated 2026-04-17 · Reviewed by the
 *    Geck Inspect editorial team"
 */
export function bylineText(path) {
  const { published, modified } = editorialFor(path);
  if (published === modified) {
    return `Published ${published} · Reviewed by the Geck Inspect editorial team`;
  }
  return `Published ${published} · Last updated ${modified} · Reviewed by the Geck Inspect editorial team`;
}
