/**
 * Shared route manifest for SEO tooling.
 *
 * Consumed by:
 *   - scripts/build-sitemap.mjs  → emits public/sitemap.xml with <lastmod>
 *   - scripts/prerender.mjs      → emits route-specific static HTML into dist/
 *
 * Adding a new indexable URL:
 *   1. Append an object here with { path, priority, changefreq, lastmod, meta? }
 *   2. Optionally supply meta { title, description, ogImage } so the
 *      prerenderer can inject it without the route having to render React.
 *   3. Re-run `pnpm build` — sitemap and prerendered HTML update together.
 *
 * Morph pages are NOT listed here individually — they're expanded from
 * the canonical MORPHS dataset in src/data/morph-guide.js so adding a
 * new morph automatically lights up a crawlable URL.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const SITE_URL = 'https://geckinspect.com';

// Resolve morph slugs from the canonical data file without triggering
// Vite-style imports. We extract slugs with a regex so Node can execute
// this without a bundler in the loop.
function loadMorphSlugs() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/morph-guide.js'), 'utf8');
  const matches = [...src.matchAll(/slug:\s*'([a-z0-9-]+)'/g)];
  const slugs = [...new Set(matches.map((m) => m[1]))];
  if (slugs.length === 0) {
    throw new Error('seo-routes: no morph slugs found in src/data/morph-guide.js');
  }
  return slugs;
}

// ISO-8601 date for sitemap lastmod. Static-content lastmod values live
// with the route; anything that doesn't specify one falls back to today
// at build time.
const TODAY = new Date().toISOString().slice(0, 10);

// Primary landing routes. Priorities follow the "home > guides > tools >
// everything else" hierarchy the audit recommended.
export const STATIC_ROUTES = [
  {
    path: '/',
    priority: 1.0,
    changefreq: 'weekly',
    lastmod: TODAY,
    meta: {
      title: 'Geck Inspect — Crested Gecko Collection, Breeding & Community Platform',
      description:
        'The professional platform for crested gecko breeders and keepers. Track collections, plan breedings, identify morphs with AI, and connect with the community.',
    },
  },
  {
    path: '/About',
    priority: 0.5,
    changefreq: 'yearly',
    lastmod: TODAY,
    meta: {
      title: 'About Geck Inspect',
      description:
        'Geck Inspect is the professional platform for crested gecko (Correlophus ciliatus) breeders and keepers — collection management, breeding planning, AI morph identification, lineage tracking, and community.',
    },
  },
  {
    path: '/Contact',
    priority: 0.4,
    changefreq: 'yearly',
    lastmod: TODAY,
    meta: {
      title: 'Contact Geck Inspect',
      description:
        'Reach the Geck Inspect team for support, content corrections, partnerships, or press about the crested gecko collection and breeding platform.',
    },
  },
  {
    path: '/Terms',
    priority: 0.2,
    changefreq: 'yearly',
    lastmod: '2026-04-17',
    meta: {
      title: 'Terms of Service',
      description:
        'Terms of service governing use of Geck Inspect, the crested gecko tracking, breeding, and community platform.',
    },
  },
  {
    path: '/PrivacyPolicy',
    priority: 0.2,
    changefreq: 'yearly',
    lastmod: '2026-04-05',
    meta: {
      title: 'Privacy Policy',
      description:
        'How Geck Inspect collects, uses, and protects your personal information when you use the crested gecko tracking and breeding platform.',
    },
  },
  {
    path: '/CareGuide',
    priority: 0.95,
    changefreq: 'monthly',
    lastmod: TODAY,
    meta: {
      title: 'Crested Gecko Care Guide',
      description:
        'Comprehensive crested gecko (Correlophus ciliatus) care guide — housing, temperature and humidity, diet with CGD brand comparison, handling, common health issues, shedding, tail loss, breeding readiness, egg incubation, and hatchling care.',
    },
  },
  {
    path: '/MorphGuide',
    priority: 0.95,
    changefreq: 'weekly',
    lastmod: TODAY,
    meta: {
      title: 'Crested Gecko Morph Guide — Every Known Morph',
      description:
        'Definitive visual and written reference for every known crested gecko (Correlophus ciliatus) morph. Harlequin, Pinstripe, Dalmatian, Lilly White, Cappuccino, Axanthic, and dozens more — with inheritance, rarity, and pricing.',
    },
  },
  {
    path: '/GeneticsGuide',
    priority: 0.9,
    changefreq: 'monthly',
    lastmod: TODAY,
    meta: {
      title: 'Crested Gecko Genetics Guide',
      description:
        'From Punnett squares to proving recessives — the crested gecko genetics guide. Understand Lilly White co-dominance, Cappuccino and Axanthic recessives, Soft Scale dominance, and why most morphs are polygenic.',
    },
  },
  {
    path: '/GeneticCalculatorTool',
    priority: 0.85,
    changefreq: 'monthly',
    lastmod: TODAY,
    meta: {
      title: 'Crested Gecko Genetics Calculator',
      description:
        'Free Punnett-square genetics calculator for crested gecko breeders. Predict offspring outcomes for Lilly White, Cappuccino, Axanthic, and Soft Scale pairings.',
    },
  },
  {
    path: '/MorphVisualizer',
    priority: 0.7,
    changefreq: 'monthly',
    lastmod: TODAY,
  },
  {
    path: '/Gallery',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: TODAY,
  },
  {
    path: '/CommunityConnect',
    priority: 0.7,
    changefreq: 'daily',
    lastmod: TODAY,
  },
  {
    path: '/Forum',
    priority: 0.7,
    changefreq: 'daily',
    lastmod: TODAY,
  },
  {
    path: '/Marketplace',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: TODAY,
  },
  {
    path: '/MarketplaceBuy',
    priority: 0.7,
    changefreq: 'daily',
    lastmod: TODAY,
  },
  {
    path: '/Shipping',
    priority: 0.8,
    changefreq: 'monthly',
    lastmod: TODAY,
  },
  {
    path: '/Giveaways',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: TODAY,
  },
  {
    path: '/Membership',
    priority: 0.6,
    changefreq: 'monthly',
    lastmod: TODAY,
  },
  {
    path: '/AuthPortal',
    priority: 0.3,
    changefreq: 'yearly',
    lastmod: TODAY,
  },
];

// Morph detail pages. Priority weighted by how central the morph is to
// the hobby (Harlequin, Lilly White, Cappuccino rank highest; obscure
// polygenic variants rank lower). Defaulting to 0.7 keeps the long tail
// present without overstating its importance.
const HIGH_VALUE_MORPHS = new Set([
  'harlequin',
  'extreme-harlequin',
  'pinstripe',
  'dalmatian',
  'flame',
  'cappuccino',
  'lilly-white',
  'axanthic',
]);

export function getMorphRoutes() {
  const slugs = loadMorphSlugs();
  return slugs.map((slug) => ({
    path: `/MorphGuide/${slug}`,
    priority: HIGH_VALUE_MORPHS.has(slug) ? 0.9 : 0.7,
    changefreq: 'monthly',
    lastmod: TODAY,
  }));
}

export function getAllRoutes() {
  return [...STATIC_ROUTES, ...getMorphRoutes()];
}
