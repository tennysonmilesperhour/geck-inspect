#!/usr/bin/env node
/**
 * Generate public/sitemap.xml from the shared SEO route manifest.
 *
 * Run from `pnpm build` (pre-build step) so every deploy ships a sitemap
 * with a fresh `<lastmod>` and the full morph catalogue auto-expanded
 * from src/data/morph-guide.js. Adding a new morph to that file is the
 * only thing needed to add a new sitemap entry.
 *
 * Why this exists: the previous sitemap was hand-maintained XML with no
 * <lastmod>, which the audit flagged as the weakest crawl-priority
 * signal in 2026. Google explicitly ranks <lastmod> as its primary
 * re-crawl trigger and ignores <changefreq>/<priority>, so emitting
 * <lastmod> per route is the largest single sitemap win available.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, getAllRoutes } from './seo-routes.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_PATH = resolve(REPO_ROOT, 'public/sitemap.xml');

function urlEntry(route) {
  const loc = `${SITE_URL}${route.path}`;
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    route.lastmod ? `    <lastmod>${route.lastmod}</lastmod>` : '',
    route.changefreq ? `    <changefreq>${route.changefreq}</changefreq>` : '',
    typeof route.priority === 'number'
      ? `    <priority>${route.priority.toFixed(1)}</priority>`
      : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

function build() {
  const routes = getAllRoutes();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    routes.map(urlEntry).join('\n'),
    '</urlset>',
    '',
  ].join('\n');

  writeFileSync(OUT_PATH, xml, 'utf8');
  console.log(
    `[build-sitemap] wrote ${routes.length} URLs → ${OUT_PATH.replace(REPO_ROOT + '/', '')}`,
  );
}

build();
