import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// The page's imports touch window at load time (button.jsx, query-client).
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null, addEventListener() {}, removeEventListener() {} }));
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('@/components/public/ContentSignupPrompt', async (importOriginal) => {
  const actual = await importOriginal();
  const { createElement } = await import('react');
  return { ...actual, default: ({ headline }) => createElement('p', null, headline) };
});
vi.mock('@/hooks/useBlockedAuthors', () => ({ useBlockedMembers: () => ({ isBlocked: () => false }) }));

import MorphDetail from '@/pages/MorphDetail';
import MorphLookalikes from '@/components/morphguide/MorphLookalikes';
import { MORPHS, getMorph } from '@/data/morph-guide';
import { morphBreedingFact, morphGeneralLinks } from '../../../../scripts/lib/morph-page-links.mjs';

// Super Lilly White is lethal and Super Cappuccino and Super Highway are
// health risks. Their pages must not invite a visitor to identify one from
// a photo or look up its price (16 Oct 2026).

let errorSpy;
beforeAll(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  errorSpy.mockRestore();
  vi.unstubAllGlobals();
});

const ID_LINK = 'Still not sure? Identify your gecko from a photo';
const NOT_BRED = MORPHS.filter((m) => m.doNotBreed);

function pageHtml(slug) {
  return renderToStaticMarkup(
    h(HelmetProvider, { context: {} },
      h(MemoryRouter, { initialEntries: [`/MorphGuide/${slug}`] },
        h(Routes, null, h(Route, { path: '/MorphGuide/:slug', element: h(MorphDetail) })))),
  );
}

function lookalikesHtml(props) {
  return renderToStaticMarkup(h(MemoryRouter, null, h(MorphLookalikes, props)));
}

describe('"Often confused with" photo ID link', () => {
  const harlequin = getMorph('harlequin');

  it('shows by default and hides when showIdLink is false', () => {
    const props = { slug: 'harlequin', name: 'Harlequin', lookalikes: harlequin.lookalikes };
    expect(lookalikesHtml(props)).toContain(ID_LINK);
    expect(lookalikesHtml({ ...props, showIdLink: false })).not.toContain(ID_LINK);
    // Only the link goes: the comparisons themselves stay.
    expect(lookalikesHtml({ ...props, showIdLink: false })).toContain('Often confused with');
  });

  it.each(NOT_BRED.map((m) => m.slug))('is not on the %s page, which still compares lookalikes', (slug) => {
    expect(getMorph(slug).lookalikes.length).toBeGreaterThan(0);
    const html = pageHtml(slug);
    expect(html).toContain('id="lookalikes"');
    expect(html).not.toContain(ID_LINK);
  });

  it('control: a breedable morph page keeps it', () => {
    expect(pageHtml('harlequin')).toContain(ID_LINK);
  });
});

describe('server HTML "Keep exploring" links', () => {
  const hrefs = (slug) => morphGeneralLinks(getMorph(slug)).map((l) => l.href);

  it('offer the price guide and Morph ID on a breedable morph', () => {
    expect(hrefs('harlequin')).toEqual(['/GeneticsGuide', '/crested-gecko-price', '/QualityScale', '/Recognition']);
    expect(morphBreedingFact(getMorph('harlequin'))).toBeNull();
  });

  it.each(NOT_BRED.map((m) => m.slug))('skip the price guide and Morph ID on %s and give the safer pairing', (slug) => {
    const links = hrefs(slug);
    expect(links).not.toContain('/crested-gecko-price');
    expect(links).not.toContain('/Recognition');
    expect(links.some((href) => href.startsWith('/calculator'))).toBe(true);
  });

  it('say "Breeding: lethal, avoid" or "Breeding: health risk, avoid" as fits', () => {
    expect(morphBreedingFact(getMorph('super-lilly-white'))).toBe('Breeding: lethal, avoid.');
    expect(morphBreedingFact(getMorph('super-cappuccino'))).toBe('Breeding: health risk, avoid.');
    expect(morphBreedingFact(getMorph('super-highway'))).toBe('Breeding: health risk, avoid.');
    // No living Super Lilly White to grade; a Super Cappuccino does hatch.
    expect(hrefs('super-lilly-white')).not.toContain('/QualityScale');
    expect(hrefs('super-cappuccino')).toContain('/QualityScale');
    expect(hrefs('super-lilly-white')).toContain('/calculator/pairing/lilly-white-x-normal');
    expect(hrefs('super-highway')).toContain('/calculator/highway');
  });
});
