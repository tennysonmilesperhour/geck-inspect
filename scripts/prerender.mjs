#!/usr/bin/env node
/**
 * Per-route static HTML prerender for the Geck Inspect SPA.
 *
 * Why this exists
 * ---------------
 * The 2026-04 GEO audit's single highest-leverage finding: every route
 * served the same 7,101-byte SPA shell, so GPTBot / ClaudeBot / CCBot
 * (none of which execute JavaScript) saw zero body content on every URL
 * and every page canonicalized to the homepage. This script fixes both
 * issues without forcing a Next.js migration:
 *
 *   1. It writes a dedicated index.html into dist/<route>/index.html for
 *      every indexable route, so Vercel's filesystem routing serves a
 *      route-specific HTML document.
 *   2. Each document carries route-specific <title>, <meta description>,
 *      <link rel="canonical">, Open Graph tags, Twitter tags, a page-level
 *      JSON-LD block, and a <noscript> body with real text pulled from the
 *      canonical data sources (morph-guide.js, care-guide.js,
 *      blog-posts.js).
 *
 * JS-executing crawlers (Googlebot) still hydrate the React SPA over the
 * top of this static shell; react-helmet-async replaces the <title> and
 * meta tags client-side, and Seo.jsx removes the static JSON-LD block
 * (id="ld-route") on mount so nothing is emitted twice in the final DOM.
 *
 * Strategy for the <noscript> body
 * --------------------------------
 * The launch review (F34) found the shells too thin: one sentence per
 * morph, two care paragraphs, no FAQ, no page schema. Each shell now
 * carries the first three real paragraphs, the page's key-point list, the
 * FAQ block the React page renders, and every child link for hub pages.
 * That is what GPTBot, ClaudeBot and CCBot ingest, since none of them run
 * JavaScript. The full article is still only rendered once for browsers,
 * because <noscript> content is ignored when JS is on.
 *
 * Data access
 * -----------
 * src/data/morph-guide.js, care-guide.js and blog-posts.js are plain ES
 * modules with no imports, so this script imports them directly. That is
 * why they must stay dependency-free: the moment one of them imports a
 * '@/...' alias, this script (which runs in Node without Vite) breaks.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SITE_URL, getAllRoutes } from './seo-routes.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DIST = resolve(REPO_ROOT, 'dist');

if (!existsSync(DIST)) {
  console.error('[prerender] dist/ does not exist, run `vite build` first.');
  process.exit(1);
}

const SHELL_PATH = resolve(DIST, 'index.html');
const SHELL_HTML = readFileSync(SHELL_PATH, 'utf8');

// dist/index.html is both the input (the clean Vite shell) and the output
// for "/". Running this script twice without a fresh `vite build` would
// inject every block a second time, so refuse a shell that already
// carries prerendered markup.
if (SHELL_HTML.includes('geck-noscript-shell') || SHELL_HTML.includes('id="ld-route"')) {
  console.error('[prerender] dist/index.html was already prerendered. Run `vite build` again first.');
  process.exit(1);
}

const LOGO_URL = 'https://geckinspect.com/logo.png';
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

// Mirrors EDITORIAL_AUTHOR in src/lib/editorial.js. Duplicated here rather
// than imported because editorial.js uses the '@/' alias.
const EDITORIAL_AUTHOR = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#editorial`,
  name: 'Geck Inspect Editorial',
  url: `${SITE_URL}/About`,
  description:
    'The Geck Inspect editorial team, breeders and long-time keepers of Correlophus ciliatus who review every care and morph guide before publication and on a rolling schedule thereafter.',
  parentOrganization: { '@id': ORG_ID },
  knowsAbout: [
    'Crested gecko husbandry',
    'Reptile breeding',
    'Correlophus ciliatus morph genetics',
    'Captive reptile health',
  ],
};

// Mirrors PER_PATH in src/lib/editorial.js for the guide families. Blog
// posts carry their own dates.
const EDITORIAL_DATES = {
  '/MorphGuide': { published: '2025-07-01', modified: '2026-04-17' },
  '/CareGuide': { published: '2025-06-15', modified: '2026-04-17' },
  '/': { published: '2025-06-01', modified: '2026-04-17' },
};

const ABOUT_CRESTED_GECKO = {
  '@type': 'Thing',
  name: 'Crested gecko',
  alternateName: 'Correlophus ciliatus',
  sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
};

/**
 * Light-touch slug humanizer mirrored from morphUtils so the script has
 * no runtime dependency on the Vite-resolved app bundle.
 */
function humanize(slug) {
  return slug
    .split('-')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\bAND\b/gi, 'and')
    .replace(/\bThe\b/g, 'the');
}

// ------- data ------------------------------------------------------------

async function importData(relPath) {
  return import(pathToFileURL(resolve(REPO_ROOT, relPath)).href);
}

const morphModule = await importData('src/data/morph-guide.js');
const careModule = await importData('src/data/care-guide.js');
const blogModule = await importData('src/data/blog-posts.js');

const MORPHS = Object.fromEntries(morphModule.MORPHS.map((m) => [m.slug, m]));
const INHERITANCE = morphModule.INHERITANCE || {};
const PRICE_TIERS = morphModule.PRICE_TIERS || {};
const MORPH_CATEGORIES = morphModule.MORPH_CATEGORIES || [];
if (Object.keys(MORPHS).length === 0) throw new Error('prerender: MORPHS is empty');

// Flatten CARE_CATEGORIES into id -> section (with its category label).
const CARE_SECTIONS = {};
for (const category of careModule.CARE_CATEGORIES || []) {
  for (const section of category.sections || []) {
    CARE_SECTIONS[section.id] = { ...section, categoryLabel: category.label || category.title || null };
  }
}
if (Object.keys(CARE_SECTIONS).length === 0) throw new Error('prerender: no care sections found');

const BLOG_POSTS = Object.fromEntries((blogModule.BLOG_POSTS || []).map((p) => [p.slug, p]));
if (Object.keys(BLOG_POSTS).length === 0) throw new Error('prerender: no blog posts found');

// ------- content extraction ----------------------------------------------

/** First N `type: 'p'` paragraphs from a body block list. */
function paragraphsFrom(body, limit = 3) {
  return (body || [])
    .filter((b) => b && b.type === 'p' && typeof b.text === 'string' && b.text.trim())
    .slice(0, limit)
    .map((b) => b.text.trim());
}

/** First list-like block (ul, ol, callout with items) as { title, items }. */
function firstListFrom(body) {
  for (const b of body || []) {
    if (!b) continue;
    if ((b.type === 'ul' || b.type === 'ol' || b.type === 'callout') && Array.isArray(b.items) && b.items.length) {
      return {
        title: b.title || null,
        items: b.items.filter((x) => typeof x === 'string').slice(0, 6),
      };
    }
  }
  return null;
}

/**
 * Per-morph FAQ. Mirrors src/lib/morphFaq.js question for question, so the
 * static FAQ and the React FAQ say the same thing. Questions that depend on
 * a missing field are skipped, never invented.
 */
function morphFaq(morph) {
  const out = [];
  const summary = morph.summary || (morph.description ? morph.description.slice(0, 280) : null);
  if (summary) out.push({ question: `What is a ${morph.name} crested gecko?`, answer: summary });

  if (morph.visualIdentifiers?.length) {
    out.push({
      question: `How do I identify a ${morph.name} crested gecko?`,
      answer: `Look for: ${morph.visualIdentifiers.slice(0, 3).join('; ')}.`,
    });
  } else if (morph.keyFeatures?.length) {
    out.push({
      question: `How do I identify a ${morph.name} crested gecko?`,
      answer: `Key visual features: ${morph.keyFeatures.slice(0, 3).join('; ')}.`,
    });
  }

  const inh = INHERITANCE[morph.inheritance];
  if (inh) {
    const special = morph.slug === 'lilly-white'
      ? ' Lilly White specifically has a lethal super form, pairing two Lilly Whites together produces 25% non-viable homozygous embryos, so the morph cannot be bred "true".'
      : '';
    out.push({
      question: `How is ${morph.name} inherited?`,
      answer: `${morph.name} is classified as ${inh.label.toLowerCase()}. ${inh.description}${special}`,
    });
  }

  if (morph.priceTier) {
    const tier = PRICE_TIERS[morph.priceTier];
    const range = morph.priceRange ? ` Typical adult price: ${morph.priceRange}.` : '';
    out.push({
      question: `How much does a ${morph.name} crested gecko cost?`,
      answer: `${morph.name} crested geckos fall into the ${tier?.label || morph.priceTier} price tier.${range} ${tier?.description || ''}`.trim(),
    });
  }

  if (morph.combinesWith?.length) {
    const names = morph.combinesWith.map((s) => s.replace(/-/g, ' ')).slice(0, 6);
    out.push({
      question: `What other morphs combine with ${morph.name}?`,
      answer: `${morph.name} commonly combines with ${names.join(', ')}. These combinations are highly sought after in the hobby and often produce some of the most visually striking animals.`,
    });
  }

  if (morph.history) {
    out.push({ question: `Who discovered or first produced ${morph.name} crested geckos?`, answer: morph.history });
  }
  return out;
}

function faqSchema(id, faq) {
  if (!faq?.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': id,
    mainEntity: faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

function breadcrumbSchema(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

// ------- per-route metadata ------------------------------------------------

const RARITY_LABEL = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  very_rare: 'very rare',
};

function morphMeta(slug) {
  const m = MORPHS[slug] || { slug, name: humanize(slug) };
  const name = m.name;
  const rarity = RARITY_LABEL[m.rarity] || 'documented';
  const url = `${SITE_URL}/MorphGuide/${slug}`;
  const category = MORPH_CATEGORIES.find((c) => c.id === m.category);
  const inheritance = INHERITANCE[m.inheritance];
  const desc =
    m.summary ||
    (m.description ? m.description.slice(0, 220).trim() + (m.description.length > 220 ? '...' : '') : null) ||
    `${name} is a ${rarity} crested gecko morph. Every documented crested gecko (Correlophus ciliatus) morph has its own entry in the Geck Inspect morph guide with inheritance, visual identifiers, and breeding notes.`;

  const paragraphs = [m.description, m.foundationGenetics, m.history, m.notes]
    .filter((p) => typeof p === 'string' && p.trim())
    .slice(0, 3);
  const facts = [
    inheritance ? `Inheritance: ${inheritance.label}.` : null,
    category ? `Category: ${category.label || category.id}.` : null,
    m.rarity ? `Rarity: ${rarity}.` : null,
    m.priceRange ? `Typical adult price: ${m.priceRange}.` : null,
    m.aliases?.length ? `Also called: ${m.aliases.join(', ')}.` : null,
  ].filter(Boolean);
  const list = m.keyFeatures?.length
    ? { title: 'Key features', items: m.keyFeatures.slice(0, 6) }
    : m.visualIdentifiers?.length
      ? { title: 'How to identify it', items: m.visualIdentifiers.slice(0, 6) }
      : null;
  const faq = morphFaq(m);
  const dates = EDITORIAL_DATES['/MorphGuide'];

  const jsonLd = [
    {
      '@type': 'DefinedTerm',
      '@id': `${url}#term`,
      name,
      description: m.description || desc,
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: 'Crested Gecko Morphs',
        url: `${SITE_URL}/MorphGuide`,
      },
    },
    faqSchema(`${url}#faq`, faq),
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: `${name}: Crested Gecko Morph Guide`,
      description: (m.description || desc).slice(0, 280),
      url,
      image: LOGO_URL,
      about: ABOUT_CRESTED_GECKO,
      mentions: [{ '@id': `${url}#term` }],
      author: EDITORIAL_AUTHOR,
      reviewedBy: EDITORIAL_AUTHOR,
      datePublished: dates.published,
      dateModified: dates.modified,
      publisher: { '@id': ORG_ID },
    },
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Morph Guide', path: '/MorphGuide' },
      { name, path: `/MorphGuide/${slug}` },
    ]),
  ].filter(Boolean);

  return {
    title: `${name} Morph, Crested Gecko Guide`,
    description: `${name} is a ${rarity} crested gecko morph. ${desc}`.slice(0, 320),
    bodyHeading: `${name} crested gecko morph`,
    bodyLead: desc,
    bodyParagraphs: paragraphs,
    bodyFacts: facts,
    bodyList: list,
    faq,
    jsonLd,
  };
}

function careTopicMeta(id) {
  const section = CARE_SECTIONS[id];
  const title = section?.title || id;
  const paragraphs = paragraphsFrom(section?.body, 3);
  const summary = paragraphs.slice(0, 2).join(' ') || `${title}, part of the Geck Inspect crested gecko care guide.`;
  const url = `${SITE_URL}/CareGuide/${id}`;
  const dates = EDITORIAL_DATES['/CareGuide'];
  const list = firstListFrom(section?.body);

  const jsonLd = [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: `${title}, Crested Gecko Care Guide`,
      description: summary.slice(0, 300),
      url,
      articleSection: section?.categoryLabel || 'Crested Gecko Care',
      about: ABOUT_CRESTED_GECKO,
      isPartOf: { '@type': 'Article', '@id': `${SITE_URL}/CareGuide#article` },
      author: EDITORIAL_AUTHOR,
      reviewedBy: EDITORIAL_AUTHOR,
      datePublished: dates.published,
      dateModified: dates.modified,
      publisher: { '@id': ORG_ID },
    },
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Care Guide', path: '/CareGuide' },
      { name: title, path: `/CareGuide/${id}` },
    ]),
  ];

  return {
    title: `${title}, Crested Gecko Care`,
    description: `${title}, crested gecko care guide. ${summary}`.slice(0, 320),
    bodyHeading: `${title}, crested gecko care`,
    bodyLead: paragraphs[0] || summary,
    bodyParagraphs: paragraphs.slice(1),
    bodyFacts: [
      section?.level ? `Level: ${section.level}.` : null,
      section?.categoryLabel ? `Part of: ${section.categoryLabel}.` : null,
    ].filter(Boolean),
    bodyList: list,
    faq: [],
    jsonLd,
  };
}

function blogPostMeta(slug, route) {
  const post = BLOG_POSTS[slug];
  const fallbackTitle = route?.meta?.title || humanize(slug);
  const fallbackDesc = route?.meta?.description || `${fallbackTitle}, long-form crested gecko article on Geck Inspect.`;
  const url = `${SITE_URL}/blog/${slug}`;
  if (!post) {
    return {
      title: fallbackTitle,
      description: fallbackDesc.slice(0, 320),
      bodyHeading: fallbackTitle,
      bodyLead: fallbackDesc,
      bodyParagraphs: [],
      bodyFacts: [],
      bodyList: null,
      faq: [],
      jsonLd: null,
    };
  }
  const paragraphs = paragraphsFrom(post.body, 3);
  const faq = Array.isArray(post.faq)
    ? post.faq.filter((f) => f?.question && f?.answer).slice(0, 6)
    : [];
  const list = post.tldr?.length ? { title: 'TL;DR', items: post.tldr.slice(0, 6) } : firstListFrom(post.body);
  const published = post.datePublished || EDITORIAL_DATES['/'].published;
  const modified = post.dateModified || published;

  const jsonLd = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      mainEntityOfPage: url,
      url,
      headline: post.title,
      description: post.description || fallbackDesc,
      datePublished: published,
      dateModified: modified,
      inLanguage: 'en-US',
      isPartOf: { '@type': 'Blog', '@id': `${SITE_URL}/blog#blog`, name: 'Geck Inspect Blog', url: `${SITE_URL}/blog` },
      author: EDITORIAL_AUTHOR,
      publisher: { '@id': ORG_ID },
      image: LOGO_URL,
      about: ABOUT_CRESTED_GECKO,
      ...(post.keyphrase ? { keywords: [post.keyphrase] } : {}),
    },
    faqSchema(`${url}#faq`, faq),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: post.title, path: `/blog/${slug}` },
    ]),
  ].filter(Boolean);

  return {
    title: post.title || fallbackTitle,
    description: (post.description || fallbackDesc).slice(0, 320),
    bodyHeading: post.title || fallbackTitle,
    bodyLead: post.description || fallbackDesc,
    bodyParagraphs: paragraphs,
    bodyFacts: [
      post.datePublished ? `Published ${post.datePublished}.` : null,
      post.dateModified && post.dateModified !== post.datePublished ? `Updated ${post.dateModified}.` : null,
    ].filter(Boolean),
    bodyList: list,
    faq,
    jsonLd,
  };
}

function genericMeta(route) {
  const m = route.meta || {};
  const title = m.title || 'Geck Inspect';
  const description =
    m.description || 'Geck Inspect is the professional platform for crested gecko breeders and keepers.';
  const url = `${SITE_URL}${route.path}`;
  const jsonLd = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { '@id': WEBSITE_ID },
      about: ABOUT_CRESTED_GECKO,
      publisher: { '@id': ORG_ID },
    },
    ...(route.path === '/'
      ? []
      : [breadcrumbSchema([{ name: 'Home', path: '/' }, { name: title.replace(/\s*\|\s*Geck Inspect$/, ''), path: route.path }])]),
  ];
  return {
    title,
    description,
    bodyHeading: m.title || null,
    bodyLead: m.description || null,
    bodyParagraphs: [],
    bodyFacts: [],
    bodyList: null,
    faq: [],
    jsonLd,
  };
}

function routeMeta(route) {
  const morphMatch = route.path.match(/^\/MorphGuide\/([a-z0-9-]+)$/);
  if (morphMatch) return morphMeta(morphMatch[1]);
  // /CareGuide/series is the Keeper's Guide index, not a care-guide.js
  // section, so it keeps the meta from seo-routes.
  const careMatch = route.path.match(/^\/CareGuide\/([a-z0-9-]+)$/);
  if (careMatch && CARE_SECTIONS[careMatch[1]]) return careTopicMeta(careMatch[1]);
  const blogMatch = route.path.match(/^\/blog\/([a-z0-9-]+)$/);
  if (blogMatch) return blogPostMeta(blogMatch[1], route);
  return genericMeta(route);
}

// ------- HTML mutation -----------------------------------------------------

// Hero image preloads. Mirrors the static URLs the pages render so the
// browser can start fetching the LCP candidate before the JS bundle
// evaluates. Keep this list tight, every preload is a mandatory high
// priority fetch, and preloading something the page doesn't use hurts
// LCP instead of helping it.
//
// Source URLs:
//   /           -> src/pages/Home.jsx BACKGROUND_IMAGE
//   /MorphGuide -> src/pages/MorphGuide.jsx MORPH_GUIDE_HERO (mirrored below)
const HERO_BASE = 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80';
const HERO_WIDTHS = [640, 1024, 1600, 2400];
const HERO_PRELOADS = {
  '/': `${HERO_BASE}&w=2400`,
  '/MorphGuide': `${HERO_BASE}&w=2400`,
};
// The homepage <img> carries a srcset (Home.jsx BACKGROUND_IMAGE_SRCSET),
// so its preload must carry the same candidates or a phone would preload
// the 2400 px file and then fetch the 640 px one anyway.
const HERO_PRELOAD_SRCSET = {
  '/': HERO_WIDTHS.map((w) => `${HERO_BASE}&w=${w} ${w}w`).join(', '),
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** JSON for a <script type="application/ld+json">. A "</" inside a string would end the script early. */
function jsonForScript(value) {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}

function injectMeta(html, route) {
  const meta = routeMeta(route);
  const canonical = `${SITE_URL}${route.path}`;
  const titleFull = meta.title.includes('Geck Inspect') ? meta.title : `${meta.title} | Geck Inspect`;
  const desc = meta.description.replace(/"/g, '&quot;');

  // Rewrite the <title> (exact match on the shell's default title).
  let out = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(titleFull)}</title>`,
  );

  // Replace the site-level <meta name="description"> with the route-specific one.
  out = out.replace(
    /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${desc}" />`,
  );

  // Open Graph + Twitter swaps.
  out = out.replace(
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${escapeHtml(titleFull)}" />`,
  );
  out = out.replace(
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${desc}" />`,
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`,
  );
  out = out.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${escapeHtml(titleFull)}" />`,
  );
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${desc}" />`,
  );

  // Insert the route's <link rel="canonical"> right after the googlebot
  // meta (the hreflang pair it used to follow is gone; single-language site).
  const beforeCanonical = out;
  out = out.replace(
    /(<meta name="googlebot" content="[^"]*"\s*\/>)/,
    `$1\n    <link rel="canonical" href="${canonical}" />`,
  );
  if (out === beforeCanonical) throw new Error(`prerender: could not place canonical for ${route.path}`);

  // Route-specific hero image preload. Only emits for routes listed in
  // HERO_PRELOADS so we don't waste a mandatory fetch on pages that
  // don't render that image. `fetchpriority="high"` nudges the browser
  // to start the request before the React bundle evaluates, which is
  // where the Lighthouse mobile LCP win comes from.
  const heroUrl = HERO_PRELOADS[route.path];
  const heroSrcset = HERO_PRELOAD_SRCSET[route.path] || null;
  if (heroUrl) {
    out = out.replace(
      /(<link rel="canonical" href="[^"]*"\s*\/>)/,
      `$1\n    <link rel="preload" as="image" href="${heroUrl}"${heroSrcset ? ` imagesrcset="${heroSrcset}" imagesizes="100vw"` : ''} fetchpriority="high" />`,
    );
  }

  // Page-level JSON-LD. Sits next to the site-level Organization and
  // WebSite blocks the shell already carries. Seo.jsx removes #ld-route
  // once React mounts, so JS-capable crawlers see only the Helmet copy.
  if (meta.jsonLd) {
    const graph = { '@context': 'https://schema.org', '@graph': meta.jsonLd };
    // Replacer function, not a string: JSON that contains "$1" (a price
    // range, for instance) would otherwise be read as a capture reference.
    out = out.replace(
      /(<link rel="canonical" href="[^"]*"\s*\/>)/,
      (match) => `${match}\n    <script type="application/ld+json" id="ld-route">${jsonForScript(graph)}</script>`,
    );
  }

  return out;
}

/**
 * Inject a <noscript> body block so non-JS crawlers see visible text on
 * the page. Placed adjacent to the React root so SPA hydration doesn't
 * clobber the noscript content, browsers ignore <noscript> when JS is
 * enabled, and bots without JS see it as real content.
 */
// Child links for hub pages. Non-JS crawlers (GPTBot, ClaudeBot, CCBot)
// only follow what is in the static HTML, and until this list existed
// the hub shells linked to ten hubs and nothing below them, leaving 134
// topic pages unreachable without JavaScript.
let ALL_ROUTES_CACHE = null;
function allRoutes() {
  ALL_ROUTES_CACHE ||= getAllRoutes();
  return ALL_ROUTES_CACHE;
}
function childLinksFor(route) {
  const prefixes = {
    '/MorphGuide': [/^\/MorphGuide\/[^/]+$/, /^\/MorphGuide\/lines\//, /^\/MorphGuide\/traits\//, /^\/MorphGuide\/category\//, /^\/MorphGuide\/inheritance\//],
    '/CareGuide': [/^\/CareGuide\//],
    '/blog': [/^\/blog\//],
    '/calculator': [/^\/calculator\//],
    '/GeneticsGuide': [/^\/calculator\//],
  }[route.path];
  if (!prefixes) return [];
  return allRoutes()
    .filter((r) => r.path !== route.path && prefixes.some((re) => re.test(r.path)))
    .map((r) => ({ path: r.path, title: routeMeta(r).title.replace(/\s*\|\s*Geck Inspect$/, '') }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function injectNoscriptBody(html, route) {
  const meta = routeMeta(route);
  const canonical = `${SITE_URL}${route.path}`;
  const heading = meta.bodyHeading || 'Geck Inspect';
  const lead = meta.bodyLead || '';
  const paragraphs = (meta.bodyParagraphs || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const facts = meta.bodyFacts?.length ? `<p>${escapeHtml(meta.bodyFacts.join(' '))}</p>` : '';
  const list = meta.bodyList
    ? `<section>${meta.bodyList.title ? `<h2>${escapeHtml(meta.bodyList.title)}</h2>` : ''}<ul class="geck-plain-list">${meta.bodyList.items
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join('')}</ul></section>`
    : '';
  const faq = meta.faq?.length
    ? `<section><h2>Frequently asked questions</h2>${meta.faq
        .map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`)
        .join('')}</section>`
    : '';
  const children = childLinksFor(route);
  const childList = children.length
    ? `<section><h2>In this section</h2><ul>${children
        .map((c) => `<li><a href="${c.path}">${escapeHtml(c.title)}</a></li>`)
        .join('')}</ul></section>`
    : '';

  const body = `
    <noscript>
      <style>
        .geck-noscript-shell{font-family:Inter,system-ui,sans-serif;background:#020617;color:#e2e8f0;min-height:100vh;padding:32px 16px;}
        .geck-noscript-shell a{color:#6ee7b7;}
        .geck-noscript-shell main{max-width:720px;margin:0 auto;}
        .geck-noscript-shell h1{color:#fff;font-size:2rem;line-height:1.2;margin:0 0 12px;}
        .geck-noscript-shell p{line-height:1.6;margin:0 0 16px;}
        .geck-noscript-shell nav{font-size:0.875rem;margin-bottom:24px;color:#94a3b8;}
        .geck-noscript-shell nav a{margin-right:12px;}
        .geck-noscript-shell h2{color:#fff;font-size:1.25rem;margin:24px 0 8px;}
        .geck-noscript-shell h3{color:#fff;font-size:1rem;margin:16px 0 4px;}
        .geck-noscript-shell ul{columns:2;column-gap:24px;padding-left:18px;line-height:1.7;}
        .geck-noscript-shell ul.geck-plain-list{columns:1;}
        .geck-noscript-shell footer{margin-top:40px;padding-top:20px;border-top:1px solid #1e293b;font-size:0.8125rem;color:#64748b;}
      </style>
      <div class="geck-noscript-shell">
        <main>
          <nav>
            <a href="/">Home</a>
            <a href="/MorphGuide">Morph Guide</a>
            <a href="/CareGuide">Care Guide</a>
            <a href="/GeneticsGuide">Genetics</a>
            <a href="/calculator">Calculator</a>
            <a href="/pedigree-tracker">Pedigree Tracker</a>
            <a href="/breeding-records">Breeding Records</a>
            <a href="/crested-gecko-price">Price Guide</a>
            <a href="/blog">Blog</a>
            <a href="/QualityScale">Quality Scale</a>
            <a href="/MorphVisualizer">Morph Visualizer</a>
            <a href="/Gallery">Gallery</a>
            <a href="/Forum">Forum</a>
            <a href="/CommunityConnect">Community</a>
            <a href="/Marketplace">Marketplace</a>
            <a href="/MarketplaceBuy">Buy</a>
            <a href="/MarketplaceVerification">Verification</a>
            <a href="/Membership">Pricing</a>
            <a href="/About">About</a>
          </nav>
          <h1>${escapeHtml(heading)}</h1>
          ${lead ? `<p>${escapeHtml(lead)}</p>` : ''}
          ${paragraphs}
          ${facts}
          ${list}
          ${faq}
          ${childList}
          <p>Canonical URL: <a href="${canonical}">${canonical}</a></p>
          <p>
            Geck Inspect is the professional platform for crested gecko
            (<em>Correlophus ciliatus</em>) breeders and keepers, collection
            management, breeding planning, AI-powered morph identification,
            multi-generation lineage tracking, and a verified community.
            Enable JavaScript to use the full interactive app, or
            <a href="/AuthPortal">create a free account</a>.
          </p>
          <footer>
            &copy; ${new Date().getFullYear()} Geck Inspect. geckOS.
            <a href="/Terms">Terms</a>, <a href="/PrivacyPolicy">Privacy</a>,
            <a href="/Contact">Contact</a>
          </footer>
        </main>
      </div>
    </noscript>`;

  // Insert the noscript block just before the React root element.
  return html.replace(
    /<div id="root"><\/div>/,
    `${body}\n    <div id="root"></div>`,
  );
}

// ------- write ------------------------------------------------------------

function writeRoute(route) {
  const html = injectNoscriptBody(injectMeta(SHELL_HTML, route), route);

  let outPath;
  if (route.path === '/') {
    outPath = resolve(DIST, 'index.html');
  } else {
    const dir = resolve(DIST, route.path.replace(/^\//, ''));
    mkdirSync(dir, { recursive: true });
    outPath = join(dir, 'index.html');
  }
  writeFileSync(outPath, html, 'utf8');
}

function run() {
  // Every route in the sitemap is eligible; noindex pages live in
  // vercel.json X-Robots-Tag rules instead of a skip list here. The
  // AI-visibility audit caught that skip lists left GPTBot and CCBot with
  // the bare shell on money pages, so there is no skip list any more.
  const routes = getAllRoutes();

  for (const route of routes) writeRoute(route);
  console.log(`[prerender] wrote ${routes.length} route HTML files into dist/`);
}

run();
