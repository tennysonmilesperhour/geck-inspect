import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { isKnownAppPath, normalizePath } from './known-paths.js';
import { KNOWN_PATH_PATTERNS } from './known-path-patterns.js';
import { getEdgeAllowPatterns } from '../../scripts/seo-routes.mjs';
import { FounderCredit, GeckIntellectLink } from '../../src/components/public/SiteCredits.jsx';
import middleware from '../../middleware.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

describe('edge path allowlist', () => {
  it('matches the generated list', () => {
    expect(KNOWN_PATH_PATTERNS).toEqual(getEdgeAllowPatterns());
  });

  it('lets real routes and files through', () => {
    for (const path of [
      '/',
      '/MyGeckos',
      '/MorphGuide',
      '/MorphGuide/lilly-white',
      '/about',
      '/blog/category/care',
      '/blog/tag/care',
      '/Store/c/gifts/under-25',
      '/store/some-slug',
      '/passport/ABC',
      '/sitemap.xml',
      '/.well-known/api-catalog',
      '/data/price-index.json',
      '/llms/morphs.md',
      '/CareGuide/series/feeding',
    ]) {
      expect(isKnownAppPath(path), path).toBe(true);
    }
  });

  it('rejects unknown paths and path tricks', () => {
    for (const path of [
      '/this-page-does-not-exist',
      '/Store/not-a-real-page',
      '/mygeckos',
      '/foo/../MyGeckos',
      '/foo/%2e%2e/MyGeckos',
    ]) {
      expect(isKnownAppPath(path), path).toBe(false);
    }
    expect(normalizePath('/About/')).toBe('/About');
    expect(normalizePath('/%')).toBe(null);
  });
});

describe('middleware 404', () => {
  it('returns 404 for an unknown path and lets a real route continue', async () => {
    const unknown = await middleware(new Request('https://geckinspect.com/this-page-does-not-exist'), {});
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get('content-type')).toContain('text/html');
    expect(unknown.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(unknown.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    const body = await unknown.text();
    expect(body).toContain('Page not found');
    expect(body).toContain('https://geck-data.vercel.app');
    expect(body).toContain('by Tennyson Taggart');
    expect(body).not.toMatch(/\u2014/);

    const known = await middleware(new Request('https://geckinspect.com/MyGeckos'), {});
    expect(known).toBeUndefined();

    const about = await middleware(new Request('https://geckinspect.com/about'), {});
    expect(about).toBeUndefined();
  });
});

describe('public credits', () => {
  it('links Geck Intellect and the founder', () => {
    const html = renderToStaticMarkup(createElement(
      Fragment,
      null,
      createElement(GeckIntellectLink),
      createElement(FounderCredit),
    ));
    expect(html).toContain('href="https://geck-data.vercel.app"');
    expect(html).toContain('Geck Intellect');
    expect(html).toContain('href="https://tennysontaggart.com"');
    expect(html).toContain('by Tennyson Taggart');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('is wired into the marketing footers and the noscript shell', () => {
    for (const file of [
      'src/pages/Home.jsx',
      'src/components/public/PublicPageShell.jsx',
      'src/Layout.jsx',
    ]) {
      const src = readFileSync(resolve(ROOT, file), 'utf8');
      expect(src, file).toContain('GeckIntellectLink');
      expect(src, file).toContain('FounderCredit');
    }
    const prerender = readFileSync(resolve(ROOT, 'scripts/prerender.mjs'), 'utf8');
    expect(prerender).toContain('GECK_INTELLECT_URL');
    expect(prerender).toContain('by ${FOUNDER_NAME}');
  });
});
