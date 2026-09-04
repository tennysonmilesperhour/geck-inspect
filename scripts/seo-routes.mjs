/**
 * Shared route manifest for SEO tooling.
 *
 * Consumed by:
 *   - scripts/build-sitemap.mjs      → emits public/sitemap.xml with <lastmod>
 *   - scripts/prerender.mjs          → emits route-specific static HTML into dist/
 *   - scripts/build-vercel-json.mjs  → emits vercel.json with enumerated SPA
 *                                      rewrites so unknown paths fall through
 *                                      to /404.html (real HTTP 404).
 *
 * Adding a new indexable URL:
 *   1. Append an object here with { path, priority, changefreq, lastmod, meta? }
 *   2. Optionally supply meta { title, description, ogImage } so the
 *      prerenderer can inject it without the route having to render React.
 *   3. Re-run `pnpm build`, sitemap, prerendered HTML, and vercel.json
 *      update together.
 *
 * Morph pages are NOT listed here individually, they're expanded from
 * the canonical MORPHS dataset in src/data/morph-guide.js so adding a
 * new morph automatically lights up a crawlable URL.
 *
 * Authenticated-only pages (Dashboard, Settings, AdminPanel, etc.) are
 * parsed out of src/pages.config.js so that adding a page there stays
 * a one-line change, the SPA rewrite list in vercel.json picks it up
 * automatically on the next build.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Live prices, so the prerendered /Membership snippet can never drift
// from what the page actually charges.
import { TIER_PRICING, TRIAL_DAYS } from '../src/lib/stripe-config.js';

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

// Quote-agnostic string field reader for the regex-based data parsers
// below. Matches `field: 'value'` or `field: "value"` (value may sit on the
// next line and may contain escaped quotes) and returns the raw value.
function readStringField(chunk, field) {
  const re = new RegExp(`\\b${field}:\\s*(["'])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`);
  const m = chunk.match(re);
  if (!m) return null;
  return m[2].replace(/\\(['"])/g, '$1').trim();
}

// Project lines: slug, display name, and one-paragraph summary, so the
// line routes ship real meta instead of the site-level fallback.
function loadProjectLines() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/project-lines.js'), 'utf8');
  const starts = [];
  const slugRe = /\bslug:\s*'([a-z0-9-]+)'/g;
  let sm;
  while ((sm = slugRe.exec(src)) !== null) starts.push(sm.index);
  const seen = new Set();
  const out = [];
  starts.forEach((start, i) => {
    const chunk = src.slice(start, starts[i + 1] ?? src.length);
    const slug = readStringField(chunk, 'slug');
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push({
      slug,
      name: readStringField(chunk, 'name') || slug,
      summary: readStringField(chunk, 'summary') || null,
    });
  });
  if (out.length === 0) throw new Error('seo-routes: no project lines parsed from src/data/project-lines.js');
  return out;
}

function loadProjectLineSlugs() {
  return loadProjectLines().map((l) => l.slug);
}

// Keeper's Guide series: title + description from each guide module.
function loadKeepersGuide(id) {
  try {
    const src = readFileSync(resolve(REPO_ROOT, `src/data/keepers-guides/${id}.js`), 'utf8');
    // The guide-level fields sit at two-space indentation above `slides`;
    // slide titles are nested deeper, so anchoring on the indentation keeps
    // us on the guide header.
    const head = src.split(/\n\s*slides:/)[0];
    return {
      title: readStringField(head, 'title'),
      description: readStringField(head, 'description'),
    };
  } catch {
    return { title: null, description: null };
  }
}

// Resolve blog post entries (slug + title + description + dateModified)
// from src/data/blog-posts.js so every post automatically gets a sitemap
// entry, prerendered HTML, and a vercel.json rewrite. Mirrors the morph
// parser, regex-based to keep the script dependency-free.
function loadBlogPosts() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/blog-posts.js'), 'utf8');
  const m = src.match(/export const BLOG_POSTS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('seo-routes: could not find BLOG_POSTS in src/data/blog-posts.js');
  const body = m[1];
  // Slice into per-post chunks at each `slug:` field (the first field of
  // every post object). Robust to comment separators between posts and to
  // both indentation and quote-style differences, unlike a `},{` split.
  const starts = [];
  const slugRe = /slug:\s*['"][a-z0-9-]+['"]/g;
  let sm;
  while ((sm = slugRe.exec(body)) !== null) starts.push(sm.index);
  const entries = starts.map((s, i) => body.slice(s, starts[i + 1] ?? body.length));
  const out = [];
  for (const chunk of entries) {
    const gs = (f) => {
      // Quote-agnostic: posts in this file use a mix of single and double
      // quotes. Match whichever quote opens the value and use it as the
      // closing delimiter via a backreference.
      const re = new RegExp(`${f}:\\s*(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 's');
      const hit = chunk.match(re);
      return hit ? hit[2].replace(/\\(['"])/g, '$1') : null;
    };
    const slug = gs('slug');
    if (!slug) continue;
    out.push({
      slug,
      title: gs('title'),
      description: gs('description'),
      datePublished: gs('datePublished'),
      dateModified: gs('dateModified') || gs('datePublished'),
    });
  }
  if (out.length === 0 && /slug:/.test(body)) {
    throw new Error('seo-routes: BLOG_POSTS has entries but none parsed; the parser drifted from the data file');
  }
  return out;
}

// Resolve CareGuide section ids + titles from the canonical data file.
// Each section becomes its own URL at /CareGuide/<id>, generated by
// src/pages/CareGuideTopic.jsx. We parse the JS source rather than
// importing it to keep this script dependency-free.
function loadCareSections() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/care-guide.js'), 'utf8');
  // Grab every `id: '…'` + adjacent `title: '…'` pair inside CARE_CATEGORIES.
  // The category-level entries also have an `id` but no `title`, so we key
  // on "id + title" pairs only (sections always carry a title).
  const out = [];
  const re = /id:\s*'([a-z0-9-]+)',\s*\n\s*title:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ id: m[1], title: m[2] });
  }
  if (out.length === 0) throw new Error('seo-routes: no care sections parsed from src/data/care-guide.js');
  return out;
}

// ISO-8601 date for sitemap lastmod. Static-content lastmod values live
// with the route; anything that doesn't specify one falls back to today
// at build time.
const TODAY = new Date().toISOString().slice(0, 10);

// Real content dates (last commit touching each source file), written by
// scripts/build-content-dates.mjs. <lastmod> used to be the build date on
// every route, which told crawlers the whole site changed every deploy.
let CONTENT_DATES = {};
try {
  CONTENT_DATES = JSON.parse(readFileSync(resolve(__dirname, 'content-dates.json'), 'utf8')).files || {};
} catch {
  console.warn('[seo-routes] scripts/content-dates.json missing, falling back to the build date. Run pnpm build:content-dates.');
}

// Newest commit date across the files a route depends on. Falls back to
// the build date only when none of them has a recorded date.
function dateOf(...files) {
  const dates = files.map((f) => CONTENT_DATES[f]).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : TODAY;
}

const MORPH_DATA = 'src/data/morph-guide.js';
const CARE_DATA = 'src/data/care-guide.js';
const LINES_DATA = 'src/data/project-lines.js';
const CALC_DATA = 'src/lib/genetics/calculatorCatalog.js';

// Primary landing routes. Priorities follow the "home > guides > tools >
// everything else" hierarchy the audit recommended.
export const STATIC_ROUTES = [
  {
    path: '/',
    priority: 1.0,
    changefreq: 'weekly',
    lastmod: dateOf('src/pages/Home.jsx'),
    meta: {
      title: 'Geck Inspect: Crested Gecko Collection, Breeding & Community',
      description:
        'The professional platform for crested gecko breeders and keepers. Track collections, plan breedings, identify morphs with AI, and connect with the community.',
    },
  },
  {
    path: '/About',
    priority: 0.5,
    changefreq: 'yearly',
    lastmod: dateOf('src/pages/About.jsx'),
    meta: {
      title: 'About Geck Inspect',
      description:
        'Geck Inspect is the professional platform for crested gecko (Correlophus ciliatus) breeders and keepers, collection management, breeding planning, AI morph identification, lineage tracking, and community.',
    },
  },
  {
    path: '/Contact',
    priority: 0.4,
    changefreq: 'yearly',
    lastmod: dateOf('src/pages/Contact.jsx'),
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
    path: '/MarketplaceVerification',
    priority: 0.6,
    changefreq: 'yearly',
    lastmod: '2026-04-17',
    meta: {
      title: 'Marketplace Verification & Trust, Geck Inspect',
      description:
        "How Geck Inspect verifies sellers on the crested gecko marketplace, the Zero's Geckos shipping partnership, buyer protections, and what to check before buying.",
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
    lastmod: dateOf('src/pages/CareGuide.jsx', CARE_DATA, 'src/data/keepers-guides.js'),
    meta: {
      title: 'Crested Gecko Care Guide',
      description:
        'Comprehensive crested gecko (Correlophus ciliatus) care guide, housing, temperature and humidity, diet with CGD brand comparison, handling, common health issues, shedding, tail loss, breeding readiness, egg incubation, and hatchling care.',
    },
  },
  {
    path: '/MorphGuide',
    priority: 0.95,
    changefreq: 'weekly',
    lastmod: dateOf('src/pages/MorphGuide.jsx', MORPH_DATA, LINES_DATA),
    meta: {
      title: 'Crested Gecko Morph Guide, Every Known Morph',
      description:
        'Definitive visual and written reference for every known crested gecko (Correlophus ciliatus) morph. Harlequin, Pinstripe, Dalmatian, Lilly White, Cappuccino, Axanthic, and dozens more, with inheritance, rarity, and pricing.',
    },
  },
  {
    // P11 Quality Scale rubric, public + indexable.
    path: '/QualityScale',
    priority: 0.9,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/QualityScale.jsx'),
    meta: {
      title: 'Crested Gecko Quality Scale (Geck Inspect Standard)',
      description:
        'Free 10-point rubric for evaluating a crested gecko on structure, head, pattern, and color. Score your gecko, see which grade tier it falls into, and understand what it is worth.',
    },
  },
  {
    path: '/GeneticsGuide',
    priority: 0.9,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/GeneticsGuide.jsx', 'src/data/genetics-sections.jsx', 'src/data/genetics-glossary.js'),
    meta: {
      title: 'Crested Gecko Genetics Guide',
      description:
        'From Punnett squares to proving recessives, the crested gecko genetics guide. Understand Lilly White co-dominance, Cappuccino and Axanthic recessives, Soft Scale dominance, and why most morphs are polygenic.',
    },
  },
  {
    // Canonical clean URL for the genetics calculator. The legacy
    // /GeneticCalculatorTool path still routes (App.jsx) but is 301'd
    // to /calculator in vercel.json so search engines consolidate.
    path: '/calculator',
    priority: 0.85,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/GeneticCalculator.jsx', CALC_DATA),
    meta: {
      title: 'Crested Gecko Morph & Breeding Calculator (Genetics)',
      description:
        'Free crested gecko morph calculator and breeding calculator. Predict offspring morphs with Punnett-square genetics for Lilly White, Cappuccino, Axanthic, and Soft Scale pairings. No signup required.',
    },
  },
  {
    // Clutch Lab: the learn-mode genetics puzzle ladder.
    path: '/calculator/learn',
    priority: 0.75,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/GeneticCalculatorTool.jsx', CALC_DATA),
    meta: {
      title: 'Clutch Lab: Crested Gecko Genetics Puzzles',
      description:
        'Learn crested gecko genetics by playing: six breeding puzzles from your first Lilly White to a two-generation Phantom Frappuccino project, scored by how few crosses you need. Free, no signup.',
    },
  },
  {
    // Reverse (goal-seek) calculator: target morph in, ranked pairings
    // out. Static route, listed before the /calculator/:morph expansion
    // so the prerenderer treats it as its own page.
    path: '/calculator/reverse',
    priority: 0.8,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/ReverseCalculator.jsx', CALC_DATA),
    meta: {
      title: 'Reverse Genetics Calculator: Crested Gecko',
      description:
        'Pick the crested gecko you want (Lilly White, visual Axanthic, Luwak, Frappuccino and more) and see every pairing that produces it, ranked by per-egg odds with lethal and health warnings. Free, no signup.',
    },
  },
  {
    // Public feature landing targeting "crested gecko pedigree tracker"
    // and lineage/family-tree intent. The actual tool lives behind auth
    // (/Pedigree, /Lineage); this page is the crawlable front door.
    path: '/pedigree-tracker',
    priority: 0.85,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/PedigreeTracker.jsx'),
    meta: {
      title: 'Crested Gecko Pedigree Tracker & Lineage Family Tree',
      description:
        'Track crested gecko pedigrees and multi-generation lineage in one place. Build a visual family tree, follow het carriers and inbreeding coefficients across generations, and share a verified lineage with buyers. Free to start.',
    },
  },
  {
    // Public feature landing targeting "gecko breeding records" and
    // breeding-log/clutch-tracking intent. The interactive app lives
    // behind auth (/Breeding); this is the indexable landing page.
    path: '/breeding-records',
    priority: 0.85,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/BreedingRecords.jsx'),
    meta: {
      title: 'Crested Gecko Breeding Records & Clutch Tracker',
      description:
        'Keep complete crested gecko breeding records: pairings, clutches, egg-lay and hatch dates, incubation, and per-offspring outcomes. A digital breeding log that replaces the spreadsheet and links every hatchling back to its parents. Free to start.',
    },
  },
  {
    // Public price/value guide targeting "how much is my crested gecko
    // worth" and "crested gecko price by morph". High buyer intent, weak
    // specialized competition. Feeds off the Quality Scale tiers.
    path: '/crested-gecko-price',
    priority: 0.85,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/CrestedGeckoPrice.jsx'),
    meta: {
      title: 'How Much Is My Crested Gecko Worth? Price Guide by Morph',
      description:
        'Crested gecko price guide by morph and quality. See what common, high-end, and genetic morphs like Lilly White, Cappuccino, and Axanthic are worth in 2026, and the factors (quality, sex, age, lineage) that set the price.',
    },
  },
  {
    path: '/Mentorship',
    priority: 0.7,
    changefreq: 'weekly',
    lastmod: dateOf('src/pages/Mentorship.jsx'),
    meta: {
      title: 'Crested Gecko Mentorship, Consults & Courses',
      description:
        'Learn from crested gecko breeders who have been there: one-on-one mentorship, genetics consults, and courses on Lilly White lines, Axanthic projects, structure judging, and breeding season planning.',
    },
  },
  {
    path: '/MorphVisualizer',
    priority: 0.7,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/MorphVisualizer.jsx'),
    meta: {
      title: 'Crested Gecko Morph Visualizer: Interactive Trait Simulator',
      description:
        'Free interactive crested gecko trait simulator. Pick a base color, set morph genotype zygosity, dial pattern intensity, toggle accents, and watch the resulting phenotype render in real time with rarity and value estimates.',
    },
  },
  {
    path: '/Gallery',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: dateOf('src/pages/Gallery.jsx'),
    meta: {
      title: 'Crested Gecko Photo Gallery',
      description:
        'Browse crested gecko photos from breeders worldwide. Filter by morph, color, and trait to compare Lilly Whites, Harlequins, Phantoms, Cappuccinos, and more.',
    },
  },
  {
    path: '/CommunityConnect',
    priority: 0.7,
    changefreq: 'daily',
    lastmod: dateOf('src/pages/CommunityConnect.jsx'),
    meta: {
      title: 'Community, Find Crested Gecko Breeders & Forum',
      description:
        'Find crested gecko breeders and keepers, follow their collections, and join discussions on the Geck Inspect community forum.',
    },
  },
  {
    path: '/Forum',
    priority: 0.7,
    changefreq: 'daily',
    lastmod: dateOf('src/pages/Forum.jsx'),
    meta: {
      title: 'Crested Gecko Community Forum',
      description:
        'Ask questions and swap notes with crested gecko keepers and breeders. Breeding, morphs, care, feeding, and health discussions on the Geck Inspect forum.',
    },
  },
  {
    path: '/Marketplace',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: dateOf('src/pages/Marketplace.jsx'),
    meta: {
      title: 'Crested Gecko Marketplace, Buy and Sell Geckos',
      description:
        'Buy and sell crested geckos on Geck Inspect. Browse listings from breeders worldwide, filter by morph, sex, age, and price, and message sellers directly.',
    },
  },
  {
    path: '/MarketplaceBuy',
    priority: 0.7,
    changefreq: 'daily',
    lastmod: dateOf('src/pages/MarketplaceBuy.jsx'),
    meta: {
      title: 'Buy Crested Geckos, Marketplace',
      description:
        'Browse crested geckos for sale from trusted breeders. Filter by morph, sex, age, and price to find your next gecko.',
    },
  },
  {
    path: '/Shipping',
    priority: 0.8,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/Shipping.jsx'),
    meta: {
      title: 'Crested Gecko Shipping, Live Arrival Guaranteed',
      description:
        "Book reptile-safe, live-arrival-guaranteed shipping for crested geckos from inside your Geck Inspect collection through the Zero's Geckos Shipping Project.",
    },
  },
  {
    path: '/Giveaways',
    priority: 0.8,
    changefreq: 'daily',
    lastmod: dateOf('src/pages/Giveaways.jsx'),
    meta: {
      title: 'Crested Gecko Giveaways',
      description:
        'Active and upcoming crested gecko giveaways hosted by breeders on Geck Inspect. Browse, enter, and track winners.',
    },
  },
  {
    path: '/Membership',
    priority: 0.6,
    changefreq: 'monthly',
    lastmod: dateOf('src/pages/Membership.jsx', 'src/lib/stripe-config.js'),
    meta: {
      title: 'Pricing & Plans, Geck Inspect',
      description:
        `Geck Inspect plans for crested gecko keepers and breeders. Free (10 geckos), Keeper (${TIER_PRICING.keeper.monthly.price}/mo or ${TIER_PRICING.keeper.annual.price}/yr), Breeder (${TIER_PRICING.breeder.monthly.price}/mo or ${TIER_PRICING.breeder.annual.price}/yr), and Enterprise. ${TRIAL_DAYS}-day free trial on paid plans. Cancel anytime.`,
    },
  },
  // /AuthPortal is intentionally absent: a sign-in form has no place in the
  // sitemap. Its SPA rewrite still comes from pages.config.js.
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
    lastmod: dateOf(MORPH_DATA, 'src/pages/MorphDetail.jsx'),
  }));
}

// Morph taxonomy hub pages: one per category and per inheritance
// mode. Small, high-quality hubs that keep the internal link graph
// dense and capture "all recessive crested gecko morphs" style
// queries.
const MORPH_CATEGORIES_META = [
  { id: 'pattern', label: 'Pattern morphs' },
  { id: 'base', label: 'Base color morphs' },
  { id: 'color', label: 'Color modifier morphs' },
  { id: 'structure', label: 'Structural morphs' },
  { id: 'combo', label: 'Combination morphs' },
];

const MORPH_INHERITANCES_META = [
  { id: 'recessive', label: 'Recessive crested gecko morphs' },
  { id: 'co-dominant', label: 'Co-dominant crested gecko morphs' },
  { id: 'incomplete-dominant', label: 'Incomplete-dominant crested gecko morphs' },
  { id: 'dominant', label: 'Dominant crested gecko morphs' },
  { id: 'polygenic', label: 'Polygenic crested gecko morphs' },
  { id: 'line-bred', label: 'Line-bred crested gecko morphs' },
];

export function getMorphTaxonomyRoutes() {
  const cats = MORPH_CATEGORIES_META.map(({ id, label }) => ({
    path: `/MorphGuide/category/${id}`,
    priority: 0.8,
    changefreq: 'weekly',
    lastmod: dateOf(MORPH_DATA, 'src/pages/MorphTaxonomyHub.jsx'),
    meta: {
      title: `${label}: Crested Gecko Morph Guide`,
      description: `Every crested gecko ${label.toLowerCase()} in one place, with inheritance, rarity, and deep links to per-morph detail pages.`,
    },
  }));
  const inhs = MORPH_INHERITANCES_META.map(({ id, label }) => ({
    path: `/MorphGuide/inheritance/${id}`,
    priority: 0.8,
    changefreq: 'weekly',
    lastmod: dateOf(MORPH_DATA, 'src/pages/MorphTaxonomyHub.jsx'),
    meta: {
      title: label,
      description: `${label} grouped by inheritance mode. Complete list with rarity, visual cues, and links to per-morph detail pages.`,
    },
  }));
  return [...cats, ...inhs];
}

// CareGuide topic pages are programmatically generated from the
// care-guide.js sections. Priority is uniform 0.7, high enough to keep
// them crawled regularly, not so high that the long tail dominates the
// primary navigation pages (/CareGuide, /MorphGuide, /GeneticsGuide).
export function getKeepersGuideRoutes() {
  // Five slide-based deep dives. Static set, no need to parse data files.
  const guides = ['feeding', 'setup', 'handbook', 'morph', 'breeding'];
  return [
    {
      path: '/CareGuide/series',
      priority: 0.8,
      changefreq: 'monthly',
      lastmod: dateOf('src/pages/CareGuideSeries.jsx', 'src/data/keepers-guides.js', 'src/data/keepers-guides/feeding.js', 'src/data/keepers-guides/setup.js', 'src/data/keepers-guides/handbook.js', 'src/data/keepers-guides/morph.js', 'src/data/keepers-guides/breeding.js'),
      meta: {
        title: "The Keeper's Guide Series",
        description: "Five in-depth slide-based guides for crested gecko keepers: feeding troubleshooting, setup and the first 30 days, the handbook of things they do not tell you, morph and genetics, and the complete breeding arc.",
      },
    },
    ...guides.map((id) => {
      const g = loadKeepersGuide(id);
      const title = g.title || `${id.charAt(0).toUpperCase()}${id.slice(1)} Guide`;
      return {
        path: `/CareGuide/series/${id}`,
        priority: 0.7,
        changefreq: 'monthly',
        lastmod: dateOf('src/pages/CareGuideSeries.jsx', 'src/data/keepers-guides.js', 'src/data/keepers-guides/feeding.js', 'src/data/keepers-guides/setup.js', 'src/data/keepers-guides/handbook.js', 'src/data/keepers-guides/morph.js', 'src/data/keepers-guides/breeding.js'),
        meta: {
          title: `${title}, Keeper's Guide`,
          description: (
            g.description ||
            `${title}, part of the Keeper's Guide Series on Geck Inspect. Slide-based crested gecko guidance you can read in one sitting.`
          ).slice(0, 320),
        },
      };
    }),
  ];
}

export function getCareTopicRoutes() {
  const sections = loadCareSections();
  return sections.map(({ id, title }) => ({
    path: `/CareGuide/${id}`,
    priority: 0.7,
    changefreq: 'monthly',
    lastmod: dateOf(CARE_DATA, 'src/pages/CareGuideTopic.jsx'),
    meta: {
      title: `${title}: Crested Gecko Care`,
      description: `${title}, part of the Geck Inspect crested gecko (Correlophus ciliatus) care guide.`,
    },
  }));
}

// Blog index + per-post detail routes. The index keeps a high priority
// because it's the topic-cluster hub; individual posts default to 0.75
// so they outrank the long-tail morph pages but stay below the primary
// reference guides.
export function getBlogRoutes() {
  const posts = loadBlogPosts();
  const index = [{
    path: '/blog',
    priority: 0.85,
    changefreq: 'weekly',
    lastmod: posts.reduce(
      (acc, p) => (p.dateModified && p.dateModified > acc ? p.dateModified : acc),
      TODAY,
    ),
    meta: {
      title: 'Crested Gecko Blog',
      description:
        'Long-form crested gecko genetics, breeding, and care articles from the Geck Inspect editorial team, built on the Foundation Genetics consensus.',
    },
  }];
  const posts_ = posts.map((p) => ({
    path: `/blog/${p.slug}`,
    priority: 0.75,
    changefreq: 'monthly',
    lastmod: p.dateModified || TODAY,
    meta: {
      title: p.title,
      description: p.description,
    },
  }));
  return [...index, ...posts_];
}

// Per-morph genetics calculator landing pages at /calculator/<slug>.
// Source of truth for the slug list is CALCULATOR_PAGES in
// src/lib/genetics/calculatorCatalog.js. Keep this list in sync when
// adding/removing pickable traits; the sync is asserted by
// src/lib/genetics/__tests__/calculator.test.js. Each entry yields one
// indexable HTML route prerendered with the trait pre-filled into
// Parent A.
const CALCULATOR_MORPH_SLUGS = [
  { slug: 'lilly-white',  label: 'Lilly White' },
  { slug: 'cappuccino',   label: 'Cappuccino' },
  { slug: 'sable',        label: 'Sable' },
  { slug: 'highway',      label: 'Highway' },
  { slug: 'whiteout',     label: 'Whiteout' },
  { slug: 'empty-back',   label: 'Empty Back' },
  { slug: 'soft-scale',   label: 'Soft Scale' },
  { slug: 'axanthic',     label: 'Axanthic' },
  { slug: 'phantom',      label: 'Phantom' },
  { slug: 'hypo',         label: 'Hypo' },
  { slug: 'chocho',       label: 'ChoCho' },
];

// Per-pairing calculator landing pages at /calculator/pairing/<slug>.
// Source of truth is PAIRING_PAGES in
// src/lib/genetics/calculatorCatalog.js (sync asserted by unit test).
const CALCULATOR_PAIRING_SLUGS = [
  { slug: 'lilly-white-x-lilly-white',   label: 'Lilly White x Lilly White' },
  { slug: 'lilly-white-x-normal',        label: 'Lilly White x Normal' },
  { slug: 'cappuccino-x-sable',          label: 'Cappuccino x Sable' },
  { slug: 'cappuccino-x-cappuccino',     label: 'Cappuccino x Cappuccino' },
  { slug: 'axanthic-x-axanthic',         label: 'Axanthic x Axanthic' },
  { slug: 'axanthic-x-het-axanthic',     label: 'Axanthic x Het Axanthic' },
  { slug: 'het-axanthic-x-het-axanthic', label: 'Het Axanthic x Het Axanthic' },
  { slug: 'lilly-white-x-axanthic',      label: 'Lilly White x Axanthic' },
  { slug: 'phantom-x-phantom',           label: 'Phantom x Phantom' },
  { slug: 'frappuccino-x-normal',        label: 'Frappuccino x Normal' },
];

export function getCalculatorPairingRoutes() {
  return CALCULATOR_PAIRING_SLUGS.map(({ slug, label }) => ({
    path: `/calculator/pairing/${slug}`,
    priority: 0.7,
    changefreq: 'monthly',
    lastmod: dateOf(CALC_DATA, 'src/pages/CalculatorPairing.jsx'),
    meta: {
      title: `${label}: Crested Gecko Odds`,
      description: `What does ${label} produce? Free Punnett-square calculator with both parents pre-filled, per-egg odds, and clutch math. No signup required.`,
    },
  }));
}

export function getCalculatorMorphRoutes() {
  return CALCULATOR_MORPH_SLUGS.map(({ slug, label }) => ({
    path: `/calculator/${slug}`,
    priority: 0.75,
    changefreq: 'monthly',
    lastmod: dateOf(CALC_DATA, 'src/pages/CalculatorMorph.jsx'),
    meta: {
      title: `${label} Genetics Calculator: Crested Gecko`,
      description: `Free Punnett-square calculator for crested gecko ${label} pairings. Predict offspring outcomes when one parent carries ${label}. No signup required.`,
    },
  }));
}

export function getProjectLineRoutes() {
  return loadProjectLines().map(({ slug, name, summary }) => ({
    path: `/MorphGuide/lines/${slug}`,
    priority: 0.7,
    changefreq: 'monthly',
    lastmod: dateOf(LINES_DATA, 'src/pages/ProjectLineDetail.jsx'),
    meta: {
      title: `${name}, Crested Gecko Project Line`,
      description: (
        summary ||
        `${name}: founder, history, visual identifiers, and what to ask a seller. Part of the Geck Inspect crested gecko project line guide.`
      ).slice(0, 320),
    },
  }));
}

export function getAllRoutes() {
  return [
    ...STATIC_ROUTES,
    ...getMorphRoutes(),
    ...getMorphTaxonomyRoutes(),
    ...getProjectLineRoutes(),
    ...getCareTopicRoutes(),
    ...getKeepersGuideRoutes(),
    ...getBlogRoutes(),
    ...getCalculatorMorphRoutes(),
    ...getCalculatorPairingRoutes(),
  ];
}

// -----------------------------------------------------------------------
// SPA route enumeration for vercel.json
// -----------------------------------------------------------------------
// These helpers exist so `scripts/build-vercel-json.mjs` can list every
// known SPA path as an explicit rewrite to /index.html. Paths NOT in
// this list fall through to Vercel's default 404 handler, which serves
// /public/404.html with a real HTTP 404 status. Previously the
// catch-all `(.*)` rewrite returned 200 for every unknown path, which
// Bing and some AI crawlers penalize as soft-404.
//
// Source of truth for authenticated pages is src/pages.config.js, and we
// parse its PAGES object so adding a route there auto-propagates here.

// Pages that are always rendered inside <AuthenticatedApp> but live at
// /<Key>. The React router mounts `/Home` in the unauthenticated branch
// too, so list it here for completeness.
const AUTH_EXTRA_STATIC_PATHS = ['/Home'];

// Vercel `source` patterns for parametric routes. Specific patterns
// (prefix-disambiguated) are listed before looser ones so that Vercel's
// first-match order doesn't accidentally send `/MorphGuide/category/x`
// into the `/MorphGuide/:slug` rewrite. Vercel matches rewrites in
// order, so keep the ordering hierarchical.
const DYNAMIC_ROUTE_PATTERNS = [
  '/MorphGuide/category/:categoryId',
  '/MorphGuide/inheritance/:inheritanceId',
  '/MorphGuide/:slug',
  '/calculator/pairing/:pairing',
  '/calculator/:morph',
  '/CareGuide/:topic',
  '/Breeder/:slug',
  '/passport/:passportCode/qr',
  '/passport/:passportCode',
  '/claim/:token',
  '/collection-invite/:token',
  '/blog/:slug',
];

function loadAuthenticatedPagePaths() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/pages.config.js'), 'utf8');
  // Extract the `PAGES = { "Key": ... }` block and pull every quoted key.
  // The leading `\n` anchors the match to a line-starting `export` so the
  // JSDoc example at the top of pages.config.js (where `export const PAGES`
  // is prefixed with ` * `) doesn't win the non-greedy match and starve
  // vercel.json of every auth-gated route. That regression 404'd reloads
  // on /MyGeckos, /Breeding, /ForumPost, etc.
  const m = src.match(/\nexport const PAGES\s*=\s*\{([\s\S]*?)\n\}/);
  if (!m) {
    throw new Error('seo-routes: could not find PAGES object in src/pages.config.js');
  }
  const body = m[1];
  const keys = [...body.matchAll(/"([A-Za-z0-9_]+)"\s*:/g)].map((hit) => hit[1]);
  if (keys.length === 0) {
    throw new Error('seo-routes: PAGES object has no entries');
  }
  return [...new Set(keys)].map((k) => `/${k}`);
}

// Ordered list of Vercel `source` patterns covering every SPA path.
// Order: root + root alias → static landing routes → auth-only pages
// (AdminPanel, Dashboard, Settings, …) → programmatic static pages
// (care topics, morph taxonomy, morph details) → parametric patterns
// last so their greedier `:param` matchers don't swallow a specific
// prefix before it's had a chance to match.
export function getAllSpaPathPatterns() {
  const seen = new Set();
  const out = [];
  const push = (path) => {
    if (!seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  };

  push('/');
  for (const r of STATIC_ROUTES) push(r.path);
  for (const p of AUTH_EXTRA_STATIC_PATHS) push(p);
  for (const p of loadAuthenticatedPagePaths()) push(p);
  for (const r of getMorphTaxonomyRoutes()) push(r.path);
  for (const r of getCareTopicRoutes()) push(r.path);
  for (const r of getKeepersGuideRoutes()) push(r.path);
  for (const r of getMorphRoutes()) push(r.path);
  for (const r of getProjectLineRoutes()) push(r.path);
  for (const r of getCalculatorMorphRoutes()) push(r.path);
  for (const r of getBlogRoutes()) push(r.path);
  for (const p of DYNAMIC_ROUTE_PATTERNS) push(p);

  return out;
}
