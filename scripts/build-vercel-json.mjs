#!/usr/bin/env node
/**
 * Emit vercel.json with an enumerated SPA rewrite list.
 *
 * Why this exists
 * ---------------
 * Before: vercel.json ended with `{ "source": "/(.*)", "destination":
 * "/index.html" }`. Every unknown path returned HTTP 200 with the SPA
 * shell, which Bing and several AI crawlers classify as a soft-404 and
 * penalize. Only the client-side <meta name="robots" content="noindex">
 * in PageNotFound saved us from actual indexing of garbage URLs.
 *
 * After: we enumerate every known SPA path as an explicit rewrite to
 * /index.html, and we drop the catch-all. Vercel now serves
 * /public/404.html with a genuine 404 status for anything not on the
 * list. The enumeration is sourced from scripts/seo-routes.mjs so
 * adding a new page stays a one-line change.
 *
 * Static config (headers, redirects, cleanUrls, …) lives inline below
 * and is reproduced verbatim each build. Keep non-generated tweaks in
 * this file, not in vercel.json, or the next build will wipe them.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllSpaPathPatterns } from './seo-routes.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_PATH = resolve(REPO_ROOT, 'vercel.json');

// Pages kept out of search indexes via X-Robots-Tag. Sourced here (not
// inferred from auth-gating) because the rule is "should Google index
// this?" not "does this need auth?" — some auth-gated pages like
// /Membership are still indexable as marketing surface.
const NOINDEX_PAGES = [
  '/AdminPanel',
  '/AdminMigration',
  '/Settings',
  '/Notifications',
  '/Messages',
];

// Lowercase → canonical PascalCase redirects. External inbound links
// often arrive lowercased; canonicalizing them avoids duplicate
// content and consolidates PageRank into one URL.
//
// We only list pages where PascalCase IS the canonical (most of our
// marketing surface). Passport/claim routes stay lowercase and aren't
// in this list. Route pattern redirects are a single entry with
// `:slug` so the whole prefix family collapses to one rule.
const CASE_REDIRECTS = [
  { from: '/morphguide', to: '/MorphGuide' },
  { from: '/morphguide/:slug', to: '/MorphGuide/:slug' },
  { from: '/morphguide/category/:categoryId', to: '/MorphGuide/category/:categoryId' },
  { from: '/morphguide/inheritance/:inheritanceId', to: '/MorphGuide/inheritance/:inheritanceId' },
  { from: '/careguide', to: '/CareGuide' },
  { from: '/careguide/:topic', to: '/CareGuide/:topic' },
  { from: '/geneticsguide', to: '/GeneticsGuide' },
  { from: '/geneticcalculatortool', to: '/GeneticCalculatorTool' },
  { from: '/morphvisualizer', to: '/MorphVisualizer' },
  { from: '/marketplace', to: '/Marketplace' },
  { from: '/marketplacebuy', to: '/MarketplaceBuy' },
  { from: '/marketplaceverification', to: '/MarketplaceVerification' },
  { from: '/gallery', to: '/Gallery' },
  { from: '/forum', to: '/Forum' },
  { from: '/communityconnect', to: '/CommunityConnect' },
  { from: '/shipping', to: '/Shipping' },
  { from: '/giveaways', to: '/Giveaways' },
  { from: '/geckanswers', to: '/GeckAnswers' },
  { from: '/membership', to: '/Membership' },
  { from: '/about', to: '/About' },
  { from: '/contact', to: '/Contact' },
  { from: '/terms', to: '/Terms' },
  { from: '/privacypolicy', to: '/PrivacyPolicy' },
  { from: '/authportal', to: '/AuthPortal' },
  { from: '/breeder', to: '/Breeder' },
  { from: '/breeder/:slug', to: '/Breeder/:slug' },
];

function buildConfig() {
  const spaPatterns = getAllSpaPathPatterns();
  const rewrites = spaPatterns.map((source) => ({
    source,
    destination: '/index.html',
  }));

  // NOTE: Do NOT add `_comment` (or any unknown top-level key) to the
  // returned object. Vercel's schema validator now rejects unknown
  // properties with "should NOT have additional property X", which
  // fails the deploy before it even starts. The previous hand-rolled
  // vercel.json used `_comment` for inline docs and broke prod deploys
  // for ~2 hours before the pattern was removed. Keep all design notes
  // in this file and in scripts/seo-routes.mjs instead.
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    cleanUrls: true,
    trailingSlash: false,
    rewrites,
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'accelerometer=(), autoplay=(self), camera=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(self), usb=(), interest-cohort=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'X-Robots-Tag',
            value: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
          },
        ],
      },
      {
        source: '/(.*\\.html)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' },
        ],
      },
      {
        source: '/llms.txt',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
      {
        source: '/llms-full.txt',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
      {
        source: '/morphs.csv',
        headers: [
          { key: 'Content-Type', value: 'text/csv; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/404.html',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      ...NOINDEX_PAGES.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ],
    redirects: [
      {
        source: '/Breeder',
        has: [{ type: 'query', key: 'slug', value: '(?<slug>.+)' }],
        destination: '/Breeder/:slug',
        permanent: true,
      },
      ...CASE_REDIRECTS.map(({ from, to }) => ({
        source: from,
        destination: to,
        permanent: true,
      })),
    ],
  };
}

function main() {
  const config = buildConfig();
  const body = JSON.stringify(config, null, 2) + '\n';
  writeFileSync(OUT_PATH, body, 'utf8');
  const count = config.rewrites.length;
  console.log(`[vercel.json] wrote ${count} SPA rewrites + ${config.redirects.length} redirects`);
}

main();
