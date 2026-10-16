import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// The page's imports touch window at load time (button.jsx, query-client).
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null, addEventListener() {}, removeEventListener() {} }));
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// The sign-up prompts need the auth provider; their headline is what this
// test reads, so render just that.
vi.mock('@/components/public/ContentSignupPrompt', async (importOriginal) => {
  const actual = await importOriginal();
  const { createElement } = await import('react');
  return { ...actual, default: ({ headline }) => createElement('p', null, headline) };
});
vi.mock('@/hooks/useBlockedAuthors', () => ({ useBlockedMembers: () => ({ isBlocked: () => false }) }));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import MorphDetail, { calculatorBadge } from '@/pages/MorphDetail';
import MorphIndexCompareTable from '@/components/morphguide/MorphIndexCompareTable';
import { MORPHS, getMorph, noGuidePriceLabel } from '@/data/morph-guide';
import { morphSeo } from '@/lib/morphMeta';
import { morphFaq } from '@/lib/morphFaq';
import { isLivingMorph, notBredStatus } from '@/lib/morphNotBred';
import { KNOWN_SOURCE_HOSTS, morphSourceLinks, sourceHost } from '@/lib/morphSourceLabel';
import { galleryMorphTerm } from '@/lib/morphGallery';
import { geneticsDemoFor } from '@/components/morphguide/MorphGeneticsDemo';
import { PAIRING_PAGES_BY_SLUG } from '@/lib/genetics/calculatorCatalog';

let errorSpy;
beforeAll(() => {
  // React warns once per useLayoutEffect when rendering on the server.
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  errorSpy.mockRestore();
  vi.unstubAllGlobals();
});

/** The page's visible text, as a visitor reads it. */
function pageText(slug) {
  const html = renderToStaticMarkup(
    h(HelmetProvider, { context: {} },
      h(MemoryRouter, { initialEntries: [`/MorphGuide/${slug}`] },
        h(Routes, null, h(Route, { path: '/MorphGuide/:slug', element: h(MorphDetail) })))),
  );
  return {
    html,
    text: html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' '),
  };
}

const NOT_BRED = MORPHS.filter((m) => m.doNotBreed);

// Prompts every other morph page shows that invite a visitor to breed,
// price, value or photo-identify the animal.
const BREED_OR_PRICE_PROMPTS = [
  /\bBreed an? /,
  /\bworth\?/,
  /Typical price/,
  /\bcosts\b/,
  /lineage and value/,
  /Identify it from a photo with Morph ID/,
  /Upload a photo to Morph ID/,
  /No market yet/,
  /No guide price yet/,
];

describe('super forms breeders avoid making', () => {
  it('are exactly the lethal and health-risk supers', () => {
    expect(Object.fromEntries(NOT_BRED.map((m) => [m.slug, m.doNotBreed]))).toEqual({
      'super-lilly-white': 'lethal',
      'super-cappuccino': 'health',
      'super-highway': 'health',
    });
  });

  it('each name a safe pairing that exists', () => {
    for (const m of NOT_BRED) {
      const status = notBredStatus(m);
      expect(status.safeText, m.slug).toBeTruthy();
      expect(status.safeLabel, m.slug).toBeTruthy();
      expect(status.parent?.slug, m.slug).toBe(m.slug.replace(/^super-/, ''));
      if (m.safePairing.pairing) expect(PAIRING_PAGES_BY_SLUG[m.safePairing.pairing], m.slug).toBeTruthy();
      expect(m.priceRange, m.slug).toBeFalsy();
    }
    expect(notBredStatus(getMorph('lilly-white'))).toBeNull();
    expect(notBredStatus(getMorph('super-sable'))).toBeNull();
  });

  it.each(NOT_BRED.map((m) => m.slug))('%s page has no breed, price, value or Morph ID prompt', (slug) => {
    const { html, text } = pageText(slug);
    for (const prompt of BREED_OR_PRICE_PROMPTS) expect(text, `${slug}: ${prompt}`).not.toMatch(prompt);
    const status = notBredStatus(getMorph(slug));
    expect(text).toContain(status.title);
    expect(text).toContain(status.safeText);
    expect(html).toContain(`href="/MorphGuide/${status.parent.slug}"`);
    expect(html).not.toContain('id="price"');
    if (status.pairingHref) expect(html).toContain(`href="${status.pairingHref}"`);
  });

  it('control: a breedable morph page still shows those prompts', () => {
    const { text } = pageText('harlequin');
    expect(text).toContain('Breed a Harlequin');
    expect(text).toContain('Typical price');
    expect(text).toContain('worth?');
    expect(text).toContain('Upload a photo to Morph ID');
  });

  it('a lethal super is never a photo label, a health-risk super can be', () => {
    expect(isLivingMorph(getMorph('super-lilly-white'))).toBe(false);
    expect(isLivingMorph(getMorph('super-cappuccino'))).toBe(true);
    const lethal = pageText('super-lilly-white').text;
    expect(lethal).toContain('no living animal to photograph');
    expect(lethal).not.toContain('Add the first photo');
    // A Super Cappuccino does hatch, so a keeper can still add a photo.
    expect(pageText('super-cappuccino').text).toContain('Add the first photo');
  });
});

describe('morph pages with no guide price', () => {
  // Phantom, Empty Back and the other October 2026 entries have no
  // priceRange. Their pages said "No market yet" and "until the trait is
  // proven" while the Price Index had hundreds of listings of them and the
  // calculator badges Phantom proven.
  const NO_PRICE = MORPHS.filter((m) => !m.priceRange && !m.doNotBreed).map((m) => m.slug);

  it('are the entries this test expects', () => {
    expect(NO_PRICE).toEqual(['highway', 'albino', 'phantom', 'empty-back', 'super-empty-back', 'whiteout', 'super-whiteout', 'luwak', 'super-sable']);
  });

  it.each(NO_PRICE)('%s says Geck Inspect gives no price yet and points to the Price Index', (slug) => {
    const { html, text } = pageText(slug);
    const name = getMorph(slug).name;
    expect(text).not.toContain('No market yet');
    expect(text).toContain('No guide price yet');
    expect(text).toContain(`Geck Inspect does not give a typical price for ${name} yet.`);
    expect(text).toContain('Price Index');
    expect(html).toContain('href="/crested-gecko-price"');
  });

  it('says "until the trait is proven" unless the calculator badges the trait Proven', () => {
    const unproven = /until the trait is proven/;
    for (const slug of ['empty-back', 'super-empty-back', 'whiteout', 'super-whiteout', 'luwak', 'super-sable', 'highway']) {
      expect(calculatorBadge(slug), slug).toBe('emerging');
      expect(pageText(slug).text, slug).toMatch(unproven);
    }
    expect(calculatorBadge('phantom')).toBe('proven');
    expect(pageText('phantom').text).not.toMatch(unproven);
    // Albino is not in the calculator (its inheritance is not shown yet),
    // so it has no badge, and its price section keeps the caution.
    expect(calculatorBadge('albino')).toBeNull();
    expect(pageText('albino').text).toMatch(unproven);
  });

  it('reads the badge the calculator shows', () => {
    expect(calculatorBadge('lilly-white')).toBe('proven');
    expect(calculatorBadge('super-lilly-white')).toBe('proven');
    expect(calculatorBadge('cappuccino')).toBe('proven');
    expect(calculatorBadge('super-cappuccino')).toBe('proven');
    expect(calculatorBadge('sable')).toBe('emerging');
    expect(calculatorBadge('soft-scale')).toBe('emerging');
    expect(calculatorBadge('super-soft-scale')).toBe('emerging');
    expect(calculatorBadge('harlequin')).toBeNull();
  });
});

describe('Morph Guide hub tables', () => {
  // The compare table on /MorphGuide and the server HTML of the hubs said
  // "No market price yet" for Phantom, Empty Back and the other entries
  // with no priceRange, beside a Price Index with hundreds of their
  // listings.
  function tableRows() {
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(MorphIndexCompareTable)));
    const rows = html.match(/<tr[^>]*>.*?<\/tr>/g).slice(1);
    return rows.map((row) => row.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '').split('|'));
  }

  it('never say "no market", and name the gap in this guide instead', () => {
    const rows = tableRows();
    expect(rows).toHaveLength(MORPHS.length);
    for (const cells of rows) expect(cells.join(' '), cells[0]).not.toMatch(/no market/i);
    const priceOf = (name) => rows.find((cells) => cells[0] === name).at(-1);
    for (const slug of ['phantom', 'empty-back', 'whiteout', 'luwak', 'highway', 'super-sable', 'albino']) {
      expect(priceOf(getMorph(slug).name), slug).toBe('No guide price yet');
    }
    expect(priceOf('Harlequin')).toMatch(/^\$[\d,]+ to \$[\d,]+/);
  });

  it('do not price a super that breeders avoid making', () => {
    expect(noGuidePriceLabel(getMorph('super-lilly-white'))).toBe('Not bred on purpose');
    const rows = tableRows();
    for (const m of MORPHS.filter((x) => x.doNotBreed)) {
      expect(rows.find((cells) => cells[0] === m.name).at(-1), m.slug).toBe('Not bred on purpose');
    }
  });

  it('read the same in the server HTML of the hubs', () => {
    const prerender = readFileSync(resolve(__dirname, '../../../scripts/prerender.mjs'), 'utf8');
    expect(prerender).not.toMatch(/no market/i);
    expect(prerender).toContain("m.priceRange || noGuidePriceLabel(m)");
  });
});

describe('morph page titles', () => {
  it('promise a price only when the entry has one', () => {
    for (const m of MORPHS) {
      const { title } = morphSeo(m);
      expect(title.includes('Price'), m.slug).toBe(Boolean(m.priceRange));
      expect(title.length, m.slug).toBeLessThanOrEqual(60);
    }
    expect(morphSeo(getMorph('super-lilly-white')).title).toBe('Super Lilly White Crested Gecko: Identification and Genetics');
    expect(morphSeo(getMorph('harlequin')).title).toBe('Harlequin Crested Gecko: Identification, Genetics and Price');
  });
});

describe('genetics demo lethal warning', () => {
  // The demo reads the first description sentence that mentions a super.
  // Whiteout's said "healthy ... without Lilly White's lethal super", so its
  // healthy super showed in red.
  it('is red only for Lilly White, whose super is lethal', () => {
    const lethal = MORPHS.filter((m) => geneticsDemoFor(m)?.superLethal).map((m) => m.slug);
    expect(lethal).toEqual(['lilly-white']);
  });

  it('links every one-copy morph with a super page to it, with a note', () => {
    for (const m of MORPHS) {
      const demo = geneticsDemoFor(m);
      if (demo?.kind !== 'incomplete-dominant' || !demo.superSlug) continue;
      expect(demo.superNote, m.slug).toBeTruthy();
    }
  });
});

describe('source links', () => {
  it('name every cited site by its own name', () => {
    const unknown = [...new Set(MORPHS.flatMap((m) => (m.sources || []).map(sourceHost)))]
      .filter((host) => !KNOWN_SOURCE_HOSTS.includes(host));
    expect(unknown).toEqual([]);
  });

  it('never credit LM Reptiles for another site', () => {
    for (const m of MORPHS) {
      for (const { url, label } of morphSourceLinks(m.sources || [])) {
        expect(label.startsWith('LIL MONSTERS'), `${m.slug} ${url}`).toBe(sourceHost(url) === 'lmreptiles.com');
      }
    }
    expect(morphSourceLinks(getMorph('super-highway').sources).map((s) => s.label)).toEqual(['ReptiDex']);
  });

  it('read differently when one site is cited twice', () => {
    for (const m of MORPHS) {
      const labels = morphSourceLinks(m.sources || []).map((s) => s.label);
      expect(new Set(labels).size, m.slug).toBe(labels.length);
    }
  });
});

describe('combinesWith', () => {
  it('does not list a pairing the same page warns against (Luwak)', () => {
    const luwak = getMorph('luwak');
    expect(luwak.combinesWith).not.toContain('cappuccino');
    expect(luwak.combinesWith).not.toContain('sable');
    const combine = morphFaq(luwak).find((f) => /combine/.test(f.question));
    expect(combine.answer).not.toMatch(/Cappuccino|Sable/);
  });

  it('never lists a super as combined with its own one-copy form', () => {
    for (const m of MORPHS.filter((x) => x.slug.startsWith('super-'))) {
      expect(m.combinesWith || [], m.slug).not.toContain(m.slug.replace(/^super-/, ''));
    }
    expect(getMorph('whiteout').combinesWith).not.toContain('white-wall');
  });
});

describe('gallery photo match', () => {
  // ilike as Postgres reads it: % is any run, _ is any one character.
  const ilike = (value, term) =>
    new RegExp(`^.*${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.')}.*$`, 'i').test(value);

  it('keeps Super Dalmatian photos off the other super pages', () => {
    expect(ilike('super_dalmatian', galleryMorphTerm('Super Lilly White'))).toBe(false);
    expect(ilike('super_dalmatian', galleryMorphTerm('Super Dalmatian'))).toBe(true);
    expect(ilike('Super Dalmatian', galleryMorphTerm('Super Dalmatian'))).toBe(true);
    expect(ilike('extreme_harlequin', galleryMorphTerm('Extreme Brindle'))).toBe(false);
  });

  it('matches the whole name, whether the tag uses a space or an underscore', () => {
    expect(galleryMorphTerm('Lilly White')).toBe('lilly_white');
    expect(galleryMorphTerm(' Harlequin ')).toBe('harlequin');
    expect(ilike('lilly_white', galleryMorphTerm('Lilly White'))).toBe(true);
    expect(ilike('Lilly White Harlequin', galleryMorphTerm('Lilly White'))).toBe(true);
    expect(ilike('red_harlequin', galleryMorphTerm('Red Base'))).toBe(false);
  });
});
