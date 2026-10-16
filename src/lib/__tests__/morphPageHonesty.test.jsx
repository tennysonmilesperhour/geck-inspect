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

import MorphDetail from '@/pages/MorphDetail';
import { MORPHS, getMorph } from '@/data/morph-guide';
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

  it('still matches on the first word for every other morph', () => {
    expect(galleryMorphTerm('Lilly White')).toBe('lilly');
    expect(galleryMorphTerm('Harlequin')).toBe('harlequin');
  });
});
