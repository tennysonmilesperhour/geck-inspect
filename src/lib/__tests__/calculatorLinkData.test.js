// The Morph Guide's detail pages read a calculator page and a badge for
// each morph from src/lib/genetics/calculatorLinkData.js, which
// scripts/write-calculator-links.mjs writes from the calculator catalog,
// so those public pages do not load the whole catalog. These tests fail
// when the written file is out of date (run the script), and when a page
// would show another badge or link than the catalog gives.
import { describe, expect, it, vi } from 'vitest';

// The page's imports touch window at load time (as in morphPageHonesty.test.jsx).
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null, addEventListener() {}, removeEventListener() {} }));
import * as catalog from '@/lib/genetics/calculatorCatalog';
import * as linkData from '@/lib/genetics/calculatorLinkData';
import { calculatorLinkData, renderCalculatorLinkData } from '../../../scripts/write-calculator-links.mjs';
import { calculatorHref } from '@/components/morphguide/morphCta';
import { calculatorBadge } from '@/pages/MorphDetail';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WRITTEN = readFileSync(fileURLToPath(new URL('../genetics/calculatorLinkData.js', import.meta.url)), 'utf8');

// The answers from the catalog itself, as the pages computed them before.
function badgeFromCatalog(slug) {
  const page = catalog.CALCULATOR_PAGES_BY_SLUG[slug];
  if (page) return page.confidence;
  const option = catalog.COMPLEX_OPTIONS_BY_VALUE[String(slug).replace(/-/g, '_')];
  if (option?.confidence) return option.confidence;
  const gene = catalog.SIMPLE_TRAITS.find((t) => t.super_label?.toLowerCase().replace(/\s+/g, '-') === slug);
  return gene?.confidence || null;
}
function hrefFromCatalog(slug) {
  if (catalog.CALCULATOR_PAGES_BY_SLUG[slug]) return `/calculator/${slug}`;
  const alias = catalog.GUIDE_CALCULATOR_ALIASES[slug];
  if (alias && catalog.CALCULATOR_PAGES_BY_SLUG[alias]) return `/calculator/${alias}`;
  for (const [engineId, guideSlug] of Object.entries(catalog.MORPH_GUIDE_SLUGS)) {
    if (guideSlug !== slug) continue;
    const calcSlug = engineId.replace(/_/g, '-');
    if (catalog.CALCULATOR_PAGES_BY_SLUG[calcSlug]) return `/calculator/${calcSlug}`;
  }
  return '/calculator';
}

// Every slug the catalog knows a page, an option, a super or a guide link
// for, plus some it does not.
const SLUGS = [...new Set([
  ...catalog.CALCULATOR_PAGES.map((p) => p.slug),
  ...Object.keys(catalog.COMPLEX_OPTIONS_BY_VALUE).map((v) => v.replace(/_/g, '-')),
  ...catalog.SIMPLE_TRAITS.filter((t) => t.super_label).map((t) => t.super_label.toLowerCase().replace(/\s+/g, '-')),
  ...Object.values(catalog.MORPH_GUIDE_SLUGS),
  ...Object.keys(catalog.GUIDE_CALCULATOR_ALIASES),
  'harlequin', 'albino', 'phantom-pinstripe', 'dalmatian', 'not-a-morph',
])];

describe('the calculator link data', () => {
  it('is what the script writes from the catalog today', () => {
    expect(WRITTEN).toBe(renderCalculatorLinkData(calculatorLinkData(catalog)));
    const data = calculatorLinkData(catalog);
    expect(linkData.CALCULATOR_PAGE_BADGES).toEqual(data.pageBadges);
    expect(linkData.COMPLEX_OPTION_BADGES).toEqual(data.complexBadges);
    expect(linkData.SUPER_LABEL_BADGES).toEqual(data.superBadges);
  });

  it.each(SLUGS)('%s: the same badge and calculator link as the catalog gives', (slug) => {
    expect(calculatorBadge(slug)).toBe(badgeFromCatalog(slug));
    expect(calculatorHref(slug)).toBe(hrefFromCatalog(slug));
  });

  it('does not match a name every object has', () => {
    expect(calculatorBadge('constructor')).toBeNull();
    expect(calculatorHref('constructor')).toBe('/calculator');
  });

  it('keeps the hand-written guide links in one place, re-exported by the catalog', async () => {
    const guide = await import('@/lib/genetics/guideSlugs');
    expect(catalog.MORPH_GUIDE_SLUGS).toBe(guide.MORPH_GUIDE_SLUGS);
    expect(catalog.GUIDE_CALCULATOR_ALIASES).toBe(guide.GUIDE_CALCULATOR_ALIASES);
  });
});
