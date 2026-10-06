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
import {
  SITE_URL,
  getAllRoutes,
  getCalculatorMorphRoutes,
  dateOf,
  MORPH_DATA,
  CARE_DATA,
  MORPH_COUNT,
  MORPH_SLUG_ALIASES,
  CATEGORY_NOUNS,
  morphCategoryHubs,
  morphInheritanceHubs,
} from './seo-routes.mjs';

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

// The SPA catch-all (vercel.json rewrites every unknown route to /app.html)
// serves this untouched shell. It used to serve dist/index.html, which
// after this script runs is the prerendered landing page, so every app
// route (AuthPortal, Dashboard, My Geckos) preloaded a 427 KB hero image
// it never renders. seo-audit.mjs skips this file on purpose.
writeFileSync(resolve(DIST, 'app.html'), SHELL_HTML, 'utf8');

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

// Mirrors PER_PATH in src/lib/editorial.js for the guide families. The
// modified date is the last commit to the guide's data file, read from
// scripts/content-dates.json through seo-routes.mjs, which is also where
// the sitemap's <lastmod> comes from. One date, three places that agree.
// Blog posts carry their own dates.
const EDITORIAL_DATES = {
  '/MorphGuide': { published: '2025-07-01', modified: dateOf(MORPH_DATA) },
  '/CareGuide': { published: '2025-06-15', modified: dateOf(CARE_DATA) },
  '/': { published: '2025-06-01' },
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

const MORPH_LIST = morphModule.MORPHS || [];
const MORPHS = Object.fromEntries(MORPH_LIST.map((m) => [m.slug, m]));
const INHERITANCE = morphModule.INHERITANCE || {};
const RARITY = morphModule.RARITY || {};
const MORPH_CATEGORIES = morphModule.MORPH_CATEGORIES || [];
if (Object.keys(MORPHS).length === 0) throw new Error('prerender: MORPHS is empty');

// The live morph page builds its title, description, H1, opening sentence
// and FAQ from these two modules, so the static HTML imports the very same
// functions instead of keeping a copy that drifts. Both use relative
// imports only, which is what lets Node load them here.
const { morphSeo } = await importData('src/lib/morphMeta.js');
const { morphFaq } = await importData('src/lib/morphFaq.js');

const linesModule = await importData('src/data/project-lines.js');
const PROJECT_LINES = Object.fromEntries((linesModule.PROJECT_LINES || []).map((l) => [l.slug, l]));

/** A morph slug as written in the data, resolved through the alias map. */
function morphFor(slug) {
  return MORPHS[slug] || MORPHS[MORPH_SLUG_ALIASES[slug]] || null;
}

// Per-morph calculator pages (/calculator/<slug>). Decision D13: White
// Wall is the engine's Whiteout and Phantom Pinstripe is how the
// recessive Phantom reads, so those two morph pages point at the
// calculator under the engine's name. Mirrored in CalculatorMorph.jsx.
const CALCULATOR_SLUGS = new Set(getCalculatorMorphRoutes().map((r) => r.path.split('/').pop()));
const CALCULATOR_FOR_MORPH = { 'white-wall': 'whiteout', 'phantom-pinstripe': 'phantom' };
function calculatorSlugFor(slug) {
  const calc = CALCULATOR_FOR_MORPH[slug] || slug;
  return CALCULATOR_SLUGS.has(calc) ? calc : null;
}

// The page's social image, so Article.image matches what og:image shows
// instead of pointing at the logo.
const OG_IMAGE = SHELL_HTML.match(/<meta property="og:image" content="([^"]*)"/)?.[1] || null;

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

/** "a, b and c" */
function listJoin(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function sentence(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

const INHERITANCE_HUB_IDS = new Set(morphInheritanceHubs().map((h) => h.id));
const CATEGORY_HUB_IDS = new Set(morphCategoryHubs().map((h) => h.id));

/** Table of morphs: name linked to its page, then the columns asked for. */
function morphTable(morphs, columns = ['category', 'inheritance', 'rarity', 'price']) {
  const COLS = {
    category: ['Category', (m) => MORPH_CATEGORIES.find((c) => c.id === m.category)?.label || ''],
    inheritance: ['Inheritance', (m) => INHERITANCE[m.inheritance]?.label || ''],
    rarity: ['Rarity', (m) => RARITY[m.rarity]?.label || ''],
    price: ['Typical adult price', (m) => m.priceRange || 'No market price yet'],
  };
  return {
    headers: ['Morph', ...columns.map((c) => COLS[c][0])],
    rows: morphs.map((m) => [
      { text: m.name, href: `/MorphGuide/${m.slug}` },
      ...columns.map((c) => COLS[c][1](m)),
    ]),
  };
}

/** Links to every non-empty category and inheritance hub. */
function hubLinkSections(currentPath) {
  return [
    {
      title: 'Browse by category',
      items: morphCategoryHubs()
        .filter((h) => `/MorphGuide/category/${h.id}` !== currentPath)
        .map((h) => ({ name: `${h.label} (${h.morphs.length})`, href: `/MorphGuide/category/${h.id}` })),
    },
    {
      title: 'Browse by inheritance',
      items: morphInheritanceHubs()
        .filter((h) => `/MorphGuide/inheritance/${h.id}` !== currentPath)
        .map((h) => ({ name: `${h.label} (${h.morphs.length})`, href: `/MorphGuide/inheritance/${h.id}` })),
    },
  ];
}

function morphMeta(slug) {
  const m = MORPHS[slug] || { slug, name: humanize(slug) };
  const seo = morphSeo(m);
  const name = m.name;
  const url = `${SITE_URL}/MorphGuide/${slug}`;
  const category = MORPH_CATEGORIES.find((c) => c.id === m.category);
  const inheritance = INHERITANCE[m.inheritance];
  const rarity = RARITY_LABEL[m.rarity];

  const paragraphs = [m.description, m.foundationGenetics, m.history, m.notes]
    .filter((p) => typeof p === 'string' && p.trim())
    .slice(0, 3);
  const facts = [
    inheritance ? `Inheritance: ${inheritance.label}.` : null,
    category ? `Category: ${category.label || category.id}.` : null,
    rarity ? `Rarity: ${rarity}.` : null,
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

  // Lookalikes come from the morph data when an entry has them; the
  // section is simply absent otherwise.
  const lookalikes = (Array.isArray(m.lookalikes) ? m.lookalikes : [])
    .map((l) => ({ target: morphFor(l?.slug), difference: l?.difference }))
    .filter(({ target, difference }) => target && difference && target.slug !== slug)
    .map(({ target, difference }) => ({ name: target.name, href: `/MorphGuide/${target.slug}`, note: sentence(difference) }));
  const related = [...new Set((m.combinesWith || []).map((s) => morphFor(s)?.slug).filter((s) => s && s !== slug))]
    .map((s) => ({ name: MORPHS[s].name, href: `/MorphGuide/${s}` }));
  const calc = calculatorSlugFor(slug);
  const tools = [
    calc ? { name: `${name} genetics calculator`, href: `/calculator/${calc}`, note: 'per-egg odds for any pairing' } : null,
    category && CATEGORY_HUB_IDS.has(category.id)
      ? { name: `All crested gecko ${CATEGORY_NOUNS[category.id] || 'morphs'}`, href: `/MorphGuide/category/${category.id}` }
      : null,
    inheritance && INHERITANCE_HUB_IDS.has(inheritance.id)
      ? { name: `All ${inheritance.label.toLowerCase()} crested gecko morphs`, href: `/MorphGuide/inheritance/${inheritance.id}` }
      : null,
    { name: 'Crested gecko price guide', href: '/crested-gecko-price', note: 'what each morph and quality grade sells for' },
    { name: 'Quality Scale', href: '/QualityScale', note: 'grade your gecko from 0 to 10' },
    { name: 'Morph ID', href: '/Recognition', note: 'identify your gecko from a top and a side photo' },
  ].filter(Boolean);
  const linkSections = [
    lookalikes.length ? { title: 'How to tell it apart', items: lookalikes } : null,
    related.length ? { title: 'Related morphs', items: related } : null,
    { title: 'Keep exploring', items: tools },
  ].filter(Boolean);

  const jsonLd = [
    {
      '@type': 'DefinedTerm',
      '@id': `${url}#term`,
      name,
      ...(m.aliases?.length ? { alternateName: m.aliases } : {}),
      termCode: slug,
      url,
      description: seo.definition,
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        '@id': `${SITE_URL}/MorphGuide#termset`,
        name: 'Crested Gecko Morphs',
        url: `${SITE_URL}/MorphGuide`,
      },
    },
    faqSchema(`${url}#faq`, faq),
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: seo.h1,
      description: seo.definition,
      url,
      mainEntityOfPage: url,
      ...(OG_IMAGE ? { image: OG_IMAGE } : {}),
      about: ABOUT_CRESTED_GECKO,
      mentions: [{ '@id': `${url}#term` }],
      author: EDITORIAL_AUTHOR,
      reviewedBy: { '@id': EDITORIAL_AUTHOR['@id'] },
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
    title: seo.title,
    description: seo.description,
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Morph Guide', path: '/MorphGuide' },
    ],
    bodyHeading: seo.h1,
    bodyLead: seo.definition,
    bodyParagraphs: paragraphs,
    bodyFacts: facts,
    bodyList: list,
    linkSections,
    faq,
    jsonLd,
  };
}

/** Questions the Morph Guide index answers, computed from the data. */
function morphGuideFaq() {
  const byCategory = morphCategoryHubs().map((h) => `${h.morphs.length} ${h.morphs.length === 1 ? h.noun.replace(/s$/, '') : h.noun}`);
  const SINGLE_GENE = ['incomplete-dominant', 'co-dominant', 'dominant', 'recessive'];
  const genetic = morphInheritanceHubs().filter((h) => SINGLE_GENE.includes(h.id));
  const geneticCount = genetic.reduce((n, h) => n + h.morphs.length, 0);
  const veryRare = MORPH_LIST.filter((m) => m.rarity === 'very_rare').map((m) => m.name);
  const albino = MORPHS.albino;
  const rarestGene = MORPH_LIST.find((m) => m.rarity === 'rare' && m.inheritance === 'recessive' && m.priceRange);

  return [
    {
      question: 'How many crested gecko morphs are there?',
      answer: `The Geck Inspect Morph Guide documents ${MORPH_COUNT} crested gecko morphs: ${listJoin(byCategory)}. Only ${geneticCount} of them follow a single gene you can predict with a Punnett square; the rest are polygenic or line-bred looks that breeders refine over generations.`,
    },
    {
      question: 'What is the rarest crested gecko morph?',
      answer: [
        veryRare.length ? `The rarest morphs in the guide are rated very rare: ${listJoin(veryRare)}.` : '',
        albino ? 'Albino is the rarest of all: the first healthy albino hatchlings were only announced in March 2026.' : '',
        rarestGene ? `Among established genes, ${rarestGene.name} is the rarest, at ${rarestGene.priceRange} for a typical adult.` : '',
      ].filter(Boolean).join(' '),
    },
    {
      question: 'Which crested gecko morphs are genetic?',
      answer: `${geneticCount} morphs in the guide follow single-gene inheritance. ${genetic
        .map((h) => `${h.label}: ${listJoin(h.morphs.map((m) => m.name))}.`)
        .join(' ')}${albino ? ' Albino is expected to be recessive, but breeding has not proven it yet.' : ''} Every other morph is polygenic or line-bred, so its look is improved by selective breeding rather than predicted.`,
    },
    {
      question: 'Are there albino crested geckos?',
      answer:
        'Yes. On 5 March 2026 Eureka Exotics announced the first healthy albino crested gecko hatchlings: no black pigment and red eyes. How it is inherited is not yet proven by breeding.',
    },
  ];
}

function morphGuideIndexMeta(route) {
  const url = `${SITE_URL}/MorphGuide`;
  const faq = morphGuideFaq();
  const title = route.meta?.title || `Crested Gecko Morphs: Guide to All ${MORPH_COUNT} Morphs`;
  const description = route.meta?.description || title;
  const lead = `A crested gecko morph is a named look set by base color, pattern, scale structure or a proven gene. This guide covers all ${MORPH_COUNT} morphs recognized in the hobby, from Harlequin and Pinstripe to Lilly White, Axanthic and the first albinos.`;
  const lines = Object.values(PROJECT_LINES).map((l) => ({ name: l.name, href: `/MorphGuide/lines/${l.slug}` }));

  // Mirrors MORPH_GUIDE_JSON_LD in src/pages/MorphGuide.jsx (same @ids).
  const terms = MORPH_LIST.map((m) => ({
    '@type': 'DefinedTerm',
    '@id': `${SITE_URL}/MorphGuide/${m.slug}#term`,
    name: m.name,
    ...(m.aliases?.length ? { alternateName: m.aliases } : {}),
    termCode: m.slug,
    url: `${SITE_URL}/MorphGuide/${m.slug}`,
    description: morphSeo(m).definition,
    inDefinedTermSet: { '@id': `${url}#termset` },
  }));
  const jsonLd = [
    {
      '@type': 'CollectionPage',
      '@id': `${url}#collection`,
      name: 'Crested Gecko Morphs: The Complete Guide',
      url,
      description,
      about: ABOUT_CRESTED_GECKO,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      dateModified: EDITORIAL_DATES['/MorphGuide'].modified,
      mainEntity: { '@id': `${url}#termset` },
    },
    {
      '@type': 'DefinedTermSet',
      '@id': `${url}#termset`,
      name: 'Crested Gecko Morph Vocabulary',
      description: `Controlled vocabulary of the ${MORPH_COUNT} named crested gecko morphs maintained by Geck Inspect: base colors, color modifiers, pattern types, structural traits and named combinations, each with inheritance model and rarity.`,
      url,
      inLanguage: 'en-US',
      publisher: { '@id': ORG_ID },
      hasDefinedTerm: terms,
    },
    {
      '@type': 'ItemList',
      '@id': `${url}#itemlist`,
      name: 'Crested Gecko Morphs',
      numberOfItems: MORPH_LIST.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: MORPH_LIST.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/MorphGuide/${m.slug}`,
        name: m.name,
      })),
    },
    faqSchema(`${url}#faq`, faq),
    {
      ...breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Morph Guide', path: '/MorphGuide' },
      ]),
      '@id': `${url}#breadcrumbs`,
    },
  ];

  return {
    title,
    description,
    bodyHeading: 'Crested Gecko Morphs: The Complete Guide',
    bodyLead: lead,
    bodyParagraphs: [],
    bodyFacts: [],
    bodyList: null,
    table: { title: `All ${MORPH_COUNT} crested gecko morphs`, ...morphTable(MORPH_LIST) },
    linkSections: [
      ...hubLinkSections('/MorphGuide'),
      lines.length ? { title: 'Project lines', items: lines } : null,
      {
        title: 'Tools for identifying and pricing a morph',
        items: [
          { name: 'Morph ID', href: '/Recognition', note: 'identify your gecko from a top and a side photo' },
          { name: 'Genetics calculator', href: '/calculator', note: 'per-egg odds for Lilly White, Cappuccino, Axanthic and more' },
          { name: 'Crested gecko price guide', href: '/crested-gecko-price', note: 'what each morph and quality grade sells for' },
          { name: 'Quality Scale', href: '/QualityScale', note: 'grade your gecko from 0 to 10' },
        ],
      },
    ].filter(Boolean),
    faq,
    jsonLd,
  };
}

/** Shared template for the category and inheritance hubs. */
function hubMeta(route, { crumb, h1, lead, paragraphs = [], morphs, columns }) {
  const url = `${SITE_URL}${route.path}`;
  const title = route.meta?.title || h1;
  const description = route.meta?.description || lead;
  const jsonLd = [
    {
      '@type': 'CollectionPage',
      '@id': `${url}#webpage`,
      name: h1,
      url,
      description,
      about: ABOUT_CRESTED_GECKO,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      dateModified: EDITORIAL_DATES['/MorphGuide'].modified,
      mainEntity: { '@id': `${url}#itemlist` },
    },
    {
      '@type': 'ItemList',
      '@id': `${url}#itemlist`,
      name: h1,
      numberOfItems: morphs.length,
      itemListElement: morphs.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/MorphGuide/${m.slug}`,
        name: m.name,
      })),
    },
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Morph Guide', path: '/MorphGuide' },
      { name: crumb, path: route.path },
    ]),
  ];
  return {
    title,
    description,
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Morph Guide', path: '/MorphGuide' },
    ],
    bodyHeading: h1,
    bodyLead: lead,
    bodyParagraphs: paragraphs,
    bodyFacts: [],
    bodyList: null,
    table: { title: `${morphs.length} ${morphs.length === 1 ? 'morph' : 'morphs'}`, ...morphTable(morphs, columns) },
    linkSections: hubLinkSections(route.path),
    faq: [],
    jsonLd,
  };
}

function categoryHubMeta(id, route) {
  const hub = morphCategoryHubs().find((h) => h.id === id);
  if (!hub) return genericMeta(route);
  const n = hub.morphs.length;
  return hubMeta(route, {
    crumb: `${hub.label} morphs`,
    h1: `Crested gecko ${hub.noun}`,
    lead: `${sentence(hub.blurb)} The Morph Guide lists ${n} ${n === 1 ? hub.noun.replace(/s$/, '') : hub.noun}, each with its own page on identification, genetics and price.`,
    morphs: hub.morphs,
    columns: ['inheritance', 'rarity', 'price'],
  });
}

function inheritanceHubMeta(id, route) {
  const hub = morphInheritanceHubs().find((h) => h.id === id);
  if (!hub) return genericMeta(route);
  const n = hub.morphs.length;
  const label = hub.label.toLowerCase();
  const unproven = hub.morphs.some((m) => m.slug === 'albino')
    ? ['Albino is listed as recessive because albinism is recessive in other reptiles, but breeding has not proven it in crested geckos yet. The first healthy albinos hatched in March 2026.']
    : [];
  return hubMeta(route, {
    crumb: `${hub.label} morphs`,
    h1: `${hub.label} crested gecko morphs`,
    lead: `${sentence(hub.description)} ${n === 1 ? 'One morph in the guide is' : `${n} morphs in the guide are`} ${label}.`,
    paragraphs: unproven,
    morphs: hub.morphs,
    columns: ['category', 'rarity', 'price'],
  });
}

function projectLineMeta(slug, route) {
  const line = PROJECT_LINES[slug];
  if (!line) return genericMeta(route);
  const url = `${SITE_URL}${route.path}`;
  const title = route.meta?.title || line.name;
  const description = route.meta?.description || line.summary || title;
  const morphs = [...new Set((line.relatedMorphs || []).map((s) => morphFor(s)?.slug).filter(Boolean))].map((s) => MORPHS[s]);
  const facts = [
    line.founder ? `Founder: ${line.founder}.` : null,
    line.origin ? `Origin: ${line.origin}.` : null,
    line.established ? `Established: ${line.established}.` : null,
    line.priceRange ? `Typical price: ${line.priceRange}.` : null,
  ].filter(Boolean);
  const jsonLd = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: line.name,
      description,
      isPartOf: { '@id': WEBSITE_ID },
      about: ABOUT_CRESTED_GECKO,
      publisher: { '@id': ORG_ID },
      ...(morphs.length ? { mentions: morphs.map((m) => ({ '@id': `${SITE_URL}/MorphGuide/${m.slug}#term` })) } : {}),
    },
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Morph Guide', path: '/MorphGuide' },
      { name: line.name, path: route.path },
    ]),
  ];
  const tips = Array.isArray(line.identificationTips) ? line.identificationTips.filter((t) => typeof t === 'string') : [];
  return {
    title,
    description,
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Morph Guide', path: '/MorphGuide' },
    ],
    bodyHeading: line.name,
    bodyLead: line.summary || description,
    bodyParagraphs: line.description ? [line.description] : [],
    bodyFacts: facts,
    bodyList: tips.length ? { title: 'How to identify the line', items: tips.slice(0, 6) } : null,
    linkSections: [
      morphs.length
        ? { title: 'Morphs in this line', items: morphs.map((m) => ({ name: m.name, href: `/MorphGuide/${m.slug}` })) }
        : null,
      {
        title: 'Other project lines',
        items: Object.values(PROJECT_LINES)
          .filter((l) => l.slug !== slug)
          .map((l) => ({ name: l.name, href: `/MorphGuide/lines/${l.slug}` })),
      },
    ].filter(Boolean),
    faq: [],
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
      reviewedBy: { '@id': EDITORIAL_AUTHOR['@id'] },
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

/** /calculator/<slug>: the generic page plus a link to the morph's own page. */
function calculatorMorphMeta(calc, route) {
  const meta = genericMeta(route);
  const morphSlug = Object.keys(CALCULATOR_FOR_MORPH).find((s) => CALCULATOR_FOR_MORPH[s] === calc) || calc;
  const morph = MORPHS[morphSlug];
  if (!morph) return meta;
  return {
    ...meta,
    linkSections: [
      {
        title: 'About this morph',
        items: [{ name: `${morph.name} morph guide`, href: `/MorphGuide/${morph.slug}`, note: 'how to identify it, genetics and price' }],
      },
    ],
  };
}

function routeMeta(route) {
  if (route.path === '/MorphGuide') return morphGuideIndexMeta(route);
  const categoryMatch = route.path.match(/^\/MorphGuide\/category\/([a-z0-9-]+)$/);
  if (categoryMatch) return categoryHubMeta(categoryMatch[1], route);
  const inheritanceMatch = route.path.match(/^\/MorphGuide\/inheritance\/([a-z0-9-]+)$/);
  if (inheritanceMatch) return inheritanceHubMeta(inheritanceMatch[1], route);
  const lineMatch = route.path.match(/^\/MorphGuide\/lines\/([a-z0-9-]+)$/);
  if (lineMatch) return projectLineMeta(lineMatch[1], route);
  const morphMatch = route.path.match(/^\/MorphGuide\/([a-z0-9-]+)$/);
  if (morphMatch) return morphMeta(morphMatch[1]);
  const calcMatch = route.path.match(/^\/calculator\/([a-z0-9-]+)$/);
  if (calcMatch && CALCULATOR_SLUGS.has(calcMatch[1])) return calculatorMorphMeta(calcMatch[1], route);
  // /CareGuide/series is the Keeper's Guide index, not a care-guide.js
  // section, so it keeps the meta from seo-routes.
  const careMatch = route.path.match(/^\/CareGuide\/([a-z0-9-]+)$/);
  if (careMatch && CARE_SECTIONS[careMatch[1]]) return careTopicMeta(careMatch[1]);
  const blogMatch = route.path.match(/^\/blog\/([a-z0-9-]+)$/);
  if (blogMatch) return blogPostMeta(blogMatch[1], route);
  return genericMeta(route);
}

// ------- HTML mutation -----------------------------------------------------

// Hero image preload for the landing page. Mirrors Home.jsx exactly (same
// files, same widths) so the browser starts fetching the LCP image before
// the JS bundle evaluates. Keep this list tight: every preload is a
// mandatory high-priority fetch, and preloading something a page does not
// render hurts LCP instead of helping it. The Morph Guide no longer uses
// this photo, so it is no longer preloaded there.
const HERO_WIDTHS = [800, 1200, 1600, 2400];
const heroImagePath = (w) => `/hero/crested-gecko-hero-${w}.webp`;
const HERO_PRELOADS = {
  '/': heroImagePath(2400),
};
// The homepage <img> carries a srcset (Home.jsx BACKGROUND_IMAGE_SRCSET),
// so its preload must carry the same candidates or a phone would preload
// the 2400 px file and then fetch the 800 px one anyway.
const HERO_PRELOAD_SRCSET = {
  '/': HERO_WIDTHS.map((w) => `${heroImagePath(w)} ${w}w`).join(', '),
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
    // /MorphGuide links its morphs, hubs and lines from its own table and
    // link sections (morphGuideIndexMeta), so it needs no generic list.
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
  const crumbs = meta.crumbs?.length
    ? `<p class="geck-crumbs">${meta.crumbs
        .map((c) => `<a href="${c.path}">${escapeHtml(c.name)}</a>`)
        .join(' / ')} / ${escapeHtml(meta.bodyHeading || '')}</p>`
    : '';
  const cell = (c) => (c && typeof c === 'object' && c.href
    ? `<a href="${c.href}">${escapeHtml(c.text)}</a>`
    : escapeHtml(c ?? ''));
  const table = meta.table?.rows?.length
    ? `<section>${meta.table.title ? `<h2>${escapeHtml(meta.table.title)}</h2>` : ''}<table><thead><tr>${meta.table.headers
        .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
        .join('')}</tr></thead><tbody>${meta.table.rows
        .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${cell(c)}</th>` : `<td>${cell(c)}</td>`)).join('')}</tr>`)
        .join('')}</tbody></table></section>`
    : '';
  const linkSections = (meta.linkSections || [])
    .filter((s) => s?.items?.length)
    .map((s) => {
      const withNotes = s.items.some((i) => i.note);
      return `<section><h2>${escapeHtml(s.title)}</h2><ul${withNotes ? ' class="geck-plain-list"' : ''}>${s.items
        .map((i) => `<li><a href="${i.href}">${escapeHtml(i.name)}</a>${i.note ? `: ${escapeHtml(i.note)}` : ''}</li>`)
        .join('')}</ul></section>`;
    })
    .join('');
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
        .geck-noscript-shell .geck-crumbs{font-size:0.875rem;color:#94a3b8;margin:0 0 8px;}
        .geck-noscript-shell table{border-collapse:collapse;width:100%;font-size:0.875rem;margin:0 0 16px;}
        .geck-noscript-shell th,.geck-noscript-shell td{border-bottom:1px solid #1e293b;padding:6px 8px;text-align:left;vertical-align:top;}
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
            <a href="/MarketplaceVerification">Verification</a>
            <a href="/Membership">Pricing</a>
            <a href="/About">About</a>
          </nav>
          ${crumbs}
          <h1>${escapeHtml(heading)}</h1>
          ${lead ? `<p>${escapeHtml(lead)}</p>` : ''}
          ${paragraphs}
          ${facts}
          ${list}
          ${table}
          ${linkSections}
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

// ------- page chunk preload -------------------------------------------------
//
// Every public page, the landing page included, is a lazy chunk (October
// 2026 code split, docs/planning/landing-speed-2026-10.md). Without a
// hint the browser only learns about the page chunk after the main
// script has downloaded and run, which adds a round trip to every first
// visit. Each prerendered document names its page chunk (and that
// chunk's own imports) as <link rel="modulepreload">, so they download in
// parallel with the main script. The map comes from Vite's build
// manifest (build.manifest in vite.config.js).

const MANIFEST_PATH = resolve(DIST, '.vite', 'manifest.json');
const MANIFEST = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : null;
if (!MANIFEST) console.warn('[prerender] no Vite manifest, page chunks will not be preloaded.');

/** Which src/pages module renders a public route (mirrors App.jsx). */
function pageModuleFor(path) {
  if (path === '/') return 'Home';
  const rules = [
    [/^\/MorphGuide\/(category|inheritance)\//, 'MorphTaxonomyHub'],
    [/^\/MorphGuide\/lines\//, 'ProjectLineDetail'],
    [/^\/MorphGuide\/[^/]+$/, 'MorphDetail'],
    [/^\/CareGuide\/series/, 'CareGuideSeries'],
    [/^\/CareGuide\/[^/]+$/, 'CareGuideTopic'],
    [/^\/calculator$/, 'GeneticCalculatorTool'],
    [/^\/calculator\/reverse$/, 'ReverseCalculator'],
    [/^\/calculator\/learn$/, 'ClutchLab'],
    [/^\/calculator\/pairing\//, 'CalculatorPairing'],
    [/^\/calculator\/[^/]+$/, 'CalculatorMorph'],
    [/^\/blog$/, 'BlogIndex'],
    [/^\/blog\/category\//, 'BlogCategoryPage'],
    [/^\/blog\/tag\//, 'BlogTagPage'],
    [/^\/blog\/[^/]+$/, 'BlogPost'],
    [/^\/pedigree-tracker$/, 'PedigreeTracker'],
    [/^\/breeding-records$/, 'BreedingRecords'],
    [/^\/crested-gecko-price$/, 'CrestedGeckoPrice'],
  ];
  for (const [re, mod] of rules) if (re.test(path)) return mod;
  const single = path.match(/^\/([A-Za-z]+)$/);
  return single ? single[1] : null;
}

/** The manifest's chunk files a route needs beyond the entry, in load order. */
function pageChunkFiles(path) {
  if (!MANIFEST) return { files: [], css: [] };
  const mod = pageModuleFor(path);
  if (!mod) return { files: [], css: [] };
  const key = [`src/pages/${mod}.jsx`, `src/pages/${mod}.js`].find((k) => MANIFEST[k]);
  if (!key) return { files: [], css: [] };
  const files = [];
  const css = [];
  const seen = new Set();
  const visit = (k) => {
    const chunk = MANIFEST[k];
    if (!chunk || seen.has(k) || chunk.isEntry) return;
    seen.add(k);
    for (const dep of chunk.imports || []) visit(dep);
    files.push(chunk.file);
    for (const c of chunk.css || []) if (!css.includes(c)) css.push(c);
  };
  visit(key);
  return { files, css };
}

function injectPagePreload(html, route) {
  const { files, css } = pageChunkFiles(route.path) || {};
  if (!files || files.length === 0) return html;
  // Page-level CSS (for example the landing theme) as a normal stylesheet:
  // Vite's loader sees the existing <link> and does not fetch it twice.
  const links = [
    ...css.map((f) => `<link rel="stylesheet" crossorigin href="/${f}">`),
    ...files.map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`),
  ].join('\n    ');
  return html.replace(/(<script type="module"[^>]*><\/script>)/, `$1\n    ${links}`);
}

// ------- write ------------------------------------------------------------

function writeRoute(route) {
  const html = injectPagePreload(injectNoscriptBody(injectMeta(SHELL_HTML, route), route), route);

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
