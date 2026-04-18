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
 *      <link rel="canonical">, Open Graph tags, Twitter tags, and a
 *      <noscript> body block with visible text content pulled from the
 *      canonical data sources (morph-guide.js, care-guide.js, etc.).
 *
 * JS-executing crawlers (Googlebot) still hydrate the React SPA over the
 * top of this static shell; react-helmet-async replaces the `<title>` and
 * tags client-side, so nothing duplicates in the final DOM.
 *
 * Strategy for the <noscript> body
 * --------------------------------
 * We deliberately keep the <noscript> block short. The full content is
 * also rendered via React once hydration completes, so shipping the
 * entire article twice would bloat HTML and risk duplicate-keyword
 * signals. The <noscript> block is optimized for the AI-crawler slice
 * that never runs JS: the first 400–600 characters of substantive
 * content, a canonical URL, key facts, and a link to sign up.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_URL,
  STATIC_ROUTES,
  getMorphRoutes,
  getCareTopicRoutes,
  getMorphTaxonomyRoutes,
  getBlogRoutes,
} from './seo-routes.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DIST = resolve(REPO_ROOT, 'dist');

if (!existsSync(DIST)) {
  console.error('[prerender] dist/ does not exist — run `vite build` first.');
  process.exit(1);
}

const SHELL_PATH = resolve(DIST, 'index.html');
const SHELL_HTML = readFileSync(SHELL_PATH, 'utf8');

const LOGO_URL =
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';

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

/**
 * Pull a MORPHS entry out of src/data/morph-guide.js without executing
 * the file as JS. We parse the JS text with a tolerant regex that finds
 * each `{ slug: 'x', ... }` block and extracts the fields we need for
 * prerendering (name, summary, rarity, inheritance, category).
 *
 * Parsing the source file rather than importing it keeps this script
 * dependency-free (no esbuild / tsx), but it means the regex has to
 * match the current shape. If morph-guide.js's structure changes,
 * update this parser.
 */
function loadMorphs() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/morph-guide.js'), 'utf8');
  // Find `export const MORPHS = [` and take its array body.
  const m = src.match(/export const MORPHS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('prerender: could not find MORPHS array');
  const body = m[1];

  // Split into per-morph objects. Each opens `  {` (two-space indent)
  // and closes with a matching `  },`. Tolerant split — it's a data
  // file we control.
  const entries = body.split(/\n\s{2}\},\s*\n\s{2}\{/).map((chunk, i, arr) => {
    let c = chunk;
    if (i === 0) c = c.replace(/^\s*\{\s*/, '');
    if (i === arr.length - 1) c = c.replace(/\s*\}\s*$/, '');
    return c;
  });

  const result = {};
  for (const chunk of entries) {
    const getField = (field) => {
      // Capture single-quoted strings (including multiline) and plain tokens.
      const reStr = new RegExp(`${field}:\\s*'((?:\\\\.|[^'\\\\])*)'`, 's');
      const hit = chunk.match(reStr);
      return hit ? hit[1].replace(/\\'/g, "'") : null;
    };
    const slug = getField('slug');
    if (!slug) continue;
    result[slug] = {
      slug,
      name: getField('name') || humanize(slug),
      summary: getField('summary'),
      description: getField('description'),
      rarity: getField('rarity'),
      inheritance: getField('inheritance'),
      category: getField('category'),
    };
  }
  return result;
}

const MORPHS = loadMorphs();

/**
 * Parse the care-guide.js sections so per-topic prerendered HTML ships
 * with substantive noscript content. We extract each section's title
 * and the first two `type: 'p'` paragraph texts under it. Good enough
 * for AI-crawler ingestion even without running the React renderer.
 */
function loadCareSections() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/care-guide.js'), 'utf8');
  // Grab blocks of `id: '...', title: '...'` plus the nearest following
  // paragraph text. The care-guide file uses a consistent shape so a
  // tolerant regex handles it without a full JS parser.
  const out = {};
  const re =
    /id:\s*'([a-z0-9-]+)',\s*\n\s*title:\s*'([^']+)'[\s\S]*?body:\s*\[([\s\S]*?)\n\s*\],\s*\n\s*\},/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const id = m[1];
    const title = m[2];
    const body = m[3];
    // First paragraph texts in the body.
    const paras = [...body.matchAll(/type:\s*'p',\s*\n\s*text:\s*'((?:\\.|[^'\\])*)'/g)]
      .map((p) => p[1].replace(/\\'/g, "'"))
      .slice(0, 2);
    out[id] = { id, title, summary: paras.join(' ') };
  }
  return out;
}

const CARE_SECTIONS = loadCareSections();

/**
 * Parse src/data/blog-posts.js into a slug → { title, description,
 * tldrFirst, faqFirst } map for prerender body content. Pulls the
 * first TL;DR bullet and the first FAQ question/answer pair so the
 * <noscript> body has substantive, factual text rather than a generic
 * stub.
 */
function loadBlogPosts() {
  const src = readFileSync(resolve(REPO_ROOT, 'src/data/blog-posts.js'), 'utf8');
  const m = src.match(/export const BLOG_POSTS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) return {};
  const body = m[1];
  const entries = body.split(/\n\s{2}\},\s*\n\s{2}\{/).map((c, i, arr) => {
    let x = c;
    if (i === 0) x = x.replace(/^\s*\{\s*/, '');
    if (i === arr.length - 1) x = x.replace(/\s*\}\s*,?\s*$/, '');
    return x;
  });
  const out = {};
  for (const chunk of entries) {
    const gs = (f) => {
      const re = new RegExp(`${f}:\\s*'((?:\\\\.|[^'\\\\])*)'`, 's');
      const hit = chunk.match(re);
      return hit ? hit[1].replace(/\\'/g, "'") : null;
    };
    const slug = gs('slug');
    if (!slug) continue;

    // First tldr bullet — pull the first quoted string out of the
    // tldr: [ ... ] array literal.
    const tldrMatch = chunk.match(/tldr:\s*\[([\s\S]*?)\n\s*\],/);
    let tldrFirst = null;
    if (tldrMatch) {
      const first = tldrMatch[1].match(/'((?:\\.|[^'\\])*)'/);
      if (first) tldrFirst = first[1].replace(/\\'/g, "'");
    }

    // First FAQ entry. We look for `{ question: '...', answer: '...' }`
    // inside the faq array.
    const faqMatch = chunk.match(/faq:\s*\[([\s\S]*?)\n\s*\],/);
    let faqFirst = null;
    if (faqMatch) {
      const fq = faqMatch[1].match(/question:\s*'((?:\\.|[^'\\])*)'/);
      const fa = faqMatch[1].match(/answer:\s*'((?:\\.|[^'\\])*)'/);
      if (fq && fa) {
        faqFirst = {
          question: fq[1].replace(/\\'/g, "'"),
          answer: fa[1].replace(/\\'/g, "'"),
        };
      }
    }

    out[slug] = {
      slug,
      title: gs('title'),
      description: gs('description'),
      tldrFirst,
      faqFirst,
    };
  }
  return out;
}

const BLOG_POSTS = loadBlogPosts();

// ------- per-route metadata ------------------------------------------------

const RARITY_LABEL = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  very_rare: 'very rare',
};

function morphMeta(slug) {
  const m = MORPHS[slug] || { name: humanize(slug) };
  const name = m.name;
  const rarity = RARITY_LABEL[m.rarity] || 'documented';
  const desc =
    m.summary ||
    (m.description ? m.description.slice(0, 220).trim() + (m.description.length > 220 ? '…' : '') : null) ||
    `${name} is a ${rarity} crested gecko morph. Every documented crested gecko (Correlophus ciliatus) morph has its own entry in the Geck Inspect morph guide with inheritance, visual identifiers, and breeding notes.`;
  return {
    title: `${name} Morph — Crested Gecko Guide`,
    description: `${name} is a ${rarity} crested gecko morph. ${desc}`.slice(0, 320),
    bodyHeading: `${name} crested gecko morph`,
    bodyLead: desc,
    bodyExtra: [
      m.inheritance ? `Inheritance: ${m.inheritance}.` : null,
      m.category ? `Category: ${m.category}.` : null,
      'Covered in the Geck Inspect Morph Guide alongside every other documented crested gecko morph.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function careTopicMeta(id) {
  const section = CARE_SECTIONS[id];
  const title = section?.title || id;
  const summary =
    section?.summary ||
    `${title} — part of the Geck Inspect crested gecko care guide.`;
  // Clamp to the soft description limit Google actually renders.
  const description =
    `${title} — crested gecko care guide. ${summary}`.slice(0, 320);
  return {
    title: `${title} — Crested Gecko Care`,
    description,
    bodyHeading: `${title} — crested gecko care`,
    bodyLead: summary,
    bodyExtra:
      'Full care reference: housing, diet, humidity, handling, health, breeding, and life-stage guidance for Correlophus ciliatus. Every topic in the Geck Inspect care guide has its own URL so you can share or bookmark it.',
  };
}

function blogPostMeta(slug, route) {
  const post = BLOG_POSTS[slug];
  const fallbackTitle = route?.meta?.title || humanize(slug);
  const fallbackDesc = route?.meta?.description || `${fallbackTitle} — long-form crested gecko article on Geck Inspect.`;
  if (!post) {
    return {
      title: fallbackTitle,
      description: fallbackDesc.slice(0, 320),
      bodyHeading: fallbackTitle,
      bodyLead: fallbackDesc,
      bodyExtra: null,
    };
  }
  // Compose the body extra from the first TL;DR bullet + first FAQ
  // pair so the noscript shell ships substantive text for non-JS
  // crawlers without duplicating the entire post.
  const extraParts = [];
  if (post.tldrFirst) extraParts.push(`TL;DR: ${post.tldrFirst}`);
  if (post.faqFirst) extraParts.push(`Q: ${post.faqFirst.question} A: ${post.faqFirst.answer}`);
  return {
    title: post.title || fallbackTitle,
    description: (post.description || fallbackDesc).slice(0, 320),
    bodyHeading: post.title || fallbackTitle,
    bodyLead: post.description || fallbackDesc,
    bodyExtra: extraParts.join(' '),
  };
}

function routeMeta(route) {
  // Morph detail override
  const morphMatch = route.path.match(/^\/MorphGuide\/([a-z0-9-]+)$/);
  if (morphMatch) return morphMeta(morphMatch[1]);
  // Care topic override
  const careMatch = route.path.match(/^\/CareGuide\/([a-z0-9-]+)$/);
  if (careMatch) return careTopicMeta(careMatch[1]);
  // Blog post override
  const blogMatch = route.path.match(/^\/blog\/([a-z0-9-]+)$/);
  if (blogMatch) return blogPostMeta(blogMatch[1], route);
  const m = route.meta || {};
  return {
    title: m.title || 'Geck Inspect',
    description:
      m.description ||
      'Geck Inspect is the professional platform for crested gecko breeders and keepers.',
    bodyHeading: m.title || null,
    bodyLead: m.description || null,
    bodyExtra: null,
  };
}

// ------- HTML mutation -----------------------------------------------------

// Hero image preloads. Mirrors the static URLs the pages render so the
// browser can start fetching the LCP candidate before the JS bundle
// evaluates. Keep this list tight — every preload is a mandatory high
// priority fetch, and preloading something the page doesn't use hurts
// LCP instead of helping it.
//
// Source URLs:
//   /           → src/pages/Home.jsx BACKGROUND_IMAGE
//   /MorphGuide → src/pages/MorphGuide.jsx MORPH_GUIDE_HERO (mirrored below)
const HERO_PRELOADS = {
  '/': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2400&q=80',
  '/MorphGuide':
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2400&q=80',
};

function injectMeta(html, route) {
  const meta = routeMeta(route);
  const canonical = `${SITE_URL}${route.path}`;
  const titleFull = meta.title.includes('Geck Inspect') ? meta.title : `${meta.title} — Geck Inspect`;
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

  // Insert the route's <link rel="canonical"> right after the hreflang block.
  out = out.replace(
    /(<link rel="alternate" hreflang="en"[^>]*\/>)/,
    `$1\n    <link rel="canonical" href="${canonical}" />`,
  );

  // Route-specific hero image preload. Only emits for routes listed in
  // HERO_PRELOADS so we don't waste a mandatory fetch on pages that
  // don't render that image. `fetchpriority="high"` nudges the browser
  // to start the request before the React bundle evaluates, which is
  // where the Lighthouse mobile LCP win comes from.
  const heroUrl = HERO_PRELOADS[route.path];
  if (heroUrl) {
    out = out.replace(
      /(<link rel="canonical" href="[^"]*"\s*\/>)/,
      `$1\n    <link rel="preload" as="image" href="${heroUrl}" fetchpriority="high" />`,
    );
  }

  return out;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Inject a <noscript> body block so non-JS crawlers see visible text on
 * the page. Placed adjacent to the React root so SPA hydration doesn't
 * clobber the noscript content — browsers ignore <noscript> when JS is
 * enabled, and bots without JS see it as real content.
 */
function injectNoscriptBody(html, route) {
  const meta = routeMeta(route);
  const canonical = `${SITE_URL}${route.path}`;
  const heading = meta.bodyHeading || 'Geck Inspect';
  const lead = meta.bodyLead || '';
  const extra = meta.bodyExtra || '';

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
        .geck-noscript-shell footer{margin-top:40px;padding-top:20px;border-top:1px solid #1e293b;font-size:0.8125rem;color:#64748b;}
      </style>
      <div class="geck-noscript-shell">
        <main>
          <nav>
            <a href="/">Home</a>
            <a href="/MorphGuide">Morph Guide</a>
            <a href="/CareGuide">Care Guide</a>
            <a href="/GeneticsGuide">Genetics</a>
            <a href="/GeneticCalculatorTool">Calculator</a>
            <a href="/blog">Blog</a>
            <a href="/About">About</a>
          </nav>
          <h1>${escapeHtml(heading)}</h1>
          ${lead ? `<p>${escapeHtml(lead)}</p>` : ''}
          ${extra ? `<p>${escapeHtml(extra)}</p>` : ''}
          <p>Canonical URL: <a href="${canonical}">${canonical}</a></p>
          <p>
            Geck Inspect is the professional platform for crested gecko
            (<em>Correlophus ciliatus</em>) breeders and keepers — collection
            management, breeding planning, AI-powered morph identification,
            multi-generation lineage tracking, and a verified community.
            Enable JavaScript to use the full interactive app, or
            <a href="/AuthPortal">create a free account</a>.
          </p>
          <footer>
            © ${new Date().getFullYear()} Geck Inspect · geckOS ·
            <a href="/Terms">Terms</a> · <a href="/PrivacyPolicy">Privacy</a> ·
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
  // Skip routes that are either not indexable or clearly auth-gated —
  // we still want the SPA to handle them, but we don't need a prerendered
  // HTML file pretending they have static content. Everything in the
  // sitemap is eligible; noindex pages live in vercel.json X-Robots-Tag
  // rules instead of this list.
  const SKIP = new Set([
    '/CommunityConnect',
    '/Forum',
    '/Gallery',
    '/Marketplace',
    '/MarketplaceBuy',
    '/Shipping',
    '/Giveaways',
    '/Membership',
    '/AuthPortal',
    '/MorphVisualizer',
  ]);

  const routes = [
    ...STATIC_ROUTES,
    ...getMorphRoutes(),
    ...getMorphTaxonomyRoutes(),
    ...getCareTopicRoutes(),
    ...getBlogRoutes(),
  ].filter((r) => !SKIP.has(r.path));

  for (const route of routes) writeRoute(route);
  console.log(`[prerender] wrote ${routes.length} route HTML files into dist/`);
}

run();
