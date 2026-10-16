import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { canonicalPathFor, isKnownAppPath, normalizePath } from './known-paths.js';
import { CANONICAL_PATH_PATTERNS, KNOWN_PATH_PATTERNS } from './known-path-patterns.js';
import { getCanonicalPathPatterns, getEdgeAllowPatterns } from '../../scripts/seo-routes.mjs';
import { FounderCredit, GeckIntellectLink } from '../../src/components/public/SiteCredits.jsx';
import middleware from '../../middleware.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

describe('edge path allowlist', () => {
  it('matches the generated list', () => {
    expect(KNOWN_PATH_PATTERNS).toEqual(getEdgeAllowPatterns());
    expect(CANONICAL_PATH_PATTERNS).toEqual(getCanonicalPathPatterns());
  });

  it('lists every closed family one path at a time, so unknown slugs 404', () => {
    for (const open of ['/MorphGuide/:slug', '/MorphGuide/category/:categoryId', '/MorphGuide/inheritance/:inheritanceId', '/calculator/:morph', '/calculator/pairing/:pairing', '/CareGuide/:topic']) {
      expect(KNOWN_PATH_PATTERNS, open).not.toContain(open);
    }
    for (const path of [
      '/MorphGuide/harlequin',
      '/MorphGuide/lines/rialto',
      '/MorphGuide/category/combo',
      // Empty inheritance hubs still render (sent noindex by vercel.json).
      '/MorphGuide/inheritance/dominant',
      '/calculator/lilly-white',
      '/calculator/pairing/lilly-white-x-normal',
      '/CareGuide/humidity',
      '/CareGuide/series/feeding',
      // Aliases still reach their vercel.json redirect.
      '/MorphGuide/lily-white',
      '/morphguide/whatever',
      // Database-backed families stay open.
      '/Breeder/any-breeder',
      '/blog/a-post-from-the-admin',
    ]) {
      expect(isKnownAppPath(path), path).toBe(true);
    }
    for (const path of ['/MorphGuide/not-a-morph', '/MorphGuide/category/nope', '/calculator/not-a-gene', '/calculator/pairing/x-x', '/CareGuide/not-a-topic']) {
      expect(isKnownAppPath(path), path).toBe(false);
    }
  });

  it('never makes a redirect source a canonical target', () => {
    for (const source of ['/morphguide/:slug', '/about', '/breeder/:slug', '/Subscription', '/MorphGuide/lily-white']) {
      expect(CANONICAL_PATH_PATTERNS, source).not.toContain(source);
    }
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
      // The one-tap log reminder emails and notifications link to.
      '/log',
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

describe('wrong-case addresses', () => {
  it('maps a wrong-case address onto the one real page it means', () => {
    const cases = {
      '/recognition': '/Recognition',
      '/qualityscale': '/QualityScale',
      '/market': '/Market',
      '/mygeckos': '/MyGeckos',
      '/MorphGuide/Harlequin': '/MorphGuide/harlequin',
      '/MORPHGUIDE/LILLY-WHITE': '/MorphGuide/lilly-white',
      '/Blog/how-to-sex-crested-gecko': '/blog/how-to-sex-crested-gecko',
      '/Blog/a-post-from-the-admin': '/blog/a-post-from-the-admin',
      '/Calculator/Pairing/Lilly-White-x-Normal': '/calculator/pairing/lilly-white-x-normal',
      '/Passport/GI-ABC123': '/passport/GI-ABC123',
      '/BREEDER/some-breeder': '/Breeder/some-breeder',
      '/recognition/': '/Recognition',
      // /Home is an alias of the homepage; the canonical page is "/".
      '/home': '/',
      '/HOME': '/',
    };
    for (const [from, to] of Object.entries(cases)) expect(canonicalPathFor(from), from).toBe(to);
  });

  it('leaves known paths, unknown pages and other families alone', () => {
    for (const path of [
      '/Recognition',
      '/about',
      '/MorphGuide/not-a-morph',
      '/MorphGuide/Not-A-Morph',
      '/this-page-does-not-exist',
      // "Store" is the supplies store; it is never folded onto a breeder
      // storefront at /store/<slug>.
      '/Store/not-a-real-page',
      '/STORE/sunny-geckos',
      '/sToRe/sunny-geckos',
      '/%',
    ]) {
      expect(canonicalPathFor(path), path).toBe(null);
    }
  });
});

describe('middleware 404', () => {
  it('redirects a wrong-case address with a 301 and keeps the query', async () => {
    const res = await middleware(new Request('https://geckinspect.com/recognition?utm_source=x'), {});
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://geckinspect.com/Recognition?utm_source=x');
    const blog = await middleware(new Request('https://geckinspect.com/Blog/how-to-sex-crested-gecko'), {});
    expect(blog.status).toBe(301);
    expect(blog.headers.get('location')).toBe('https://geckinspect.com/blog/how-to-sex-crested-gecko');
  });

  it('returns a real 404 for an unknown morph slug', async () => {
    const res = await middleware(new Request('https://geckinspect.com/MorphGuide/not-a-morph'), {});
    expect(res.status).toBe(404);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await middleware(new Request('https://geckinspect.com/MorphGuide/axanthic'), {})).toBeUndefined();
  });

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
