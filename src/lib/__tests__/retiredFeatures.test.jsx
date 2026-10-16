import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, matchRoutes } from 'react-router-dom';
import StickerGeckoActions from '@/components/store/StickerGeckoActions';
import { retiredNoticeFor } from '@/components/shared/RetiredPageNotice';
import { RETIRED_PAGES } from '@/lib/retiredPages';
import { LIVE_PAGES } from '@/pages.config';

// Review item E3 23 (retire breadth), 16 Oct 2026.

describe('retired page redirects', () => {
  // The signed-in route set the way App.jsx declares it: under the layout,
  // the page registry first (LIVE_PAGES), then the retired redirects
  // (with /<page>/* for a prefix entry), then the supplies store's
  // /Store/*; the breeder storefront /store/:slug sits outside the layout.
  const routes = [
    { path: '/store/:slug', caseSensitive: true, id: 'storefront' },
    {
      id: 'layout',
      children: [
        ...Object.keys(LIVE_PAGES).map((name) => ({ path: `/${name}`, id: `page:${name}` })),
        ...RETIRED_PAGES.flatMap(({ page, prefix }) => [
          { path: `/${page}`, id: `retired:${page}` },
          ...(prefix ? [{ path: `/${page}/*`, id: `retired:${page}` }] : []),
        ]),
        { path: '/Store/*', id: 'store' },
      ],
    },
  ];
  const leaf = (path) => matchRoutes(routes, path)?.at(-1)?.route.id || null;

  it('sends every retired page, and the whole store, to its redirect', () => {
    for (const { page } of RETIRED_PAGES) expect(leaf(`/${page}`), page).toBe(`retired:${page}`);
    expect(leaf('/Store/stickers')).toBe('retired:Store');
    expect(leaf('/Store/p/aff-inkbird-itc308')).toBe('retired:Store');
    // Retired on 6 Oct, but its page route used to win over the redirect.
    expect(leaf('/Marketplace')).toBe('retired:Marketplace');
  });

  it('keeps breeder storefronts and live pages working', () => {
    expect(leaf('/store/thegeckogarden')).toBe('storefront');
    expect(leaf('/Today')).toBe('page:Today');
    expect(leaf('/MyStore')).toBe('page:MyStore');
    expect(leaf('/MarketplaceSell')).toBe('page:MarketplaceSell');
  });
});

describe('the note after a redirect', () => {
  it('shows the retired page\'s note once and takes the marker out of the address', () => {
    expect(retiredNoticeFor('?retired=Promote')).toEqual({
      search: '',
      toast: { title: 'Promote is switched off', description: expect.stringContaining('Posts you made before are kept') },
    });
    // Other parameters stay.
    expect(retiredNoticeFor('?tab=browse&retired=OtherReptiles').search).toBe('?tab=browse');
    // An unknown name is stripped without a toast; no marker, nothing to do.
    expect(retiredNoticeFor('?retired=Nope')).toEqual({ search: '', toast: null });
    expect(retiredNoticeFor('?tab=browse')).toBeNull();
  });
});

describe('the sticker card on a gecko record', () => {
  it('shows nothing while the store and its sticker builders are switched off', async () => {
    let tree;
    await act(async () => {
      tree = create(
        <MemoryRouter>
          <StickerGeckoActions gecko={{ id: 'g1', name: 'Mango', species: 'Crested Gecko' }} />
        </MemoryRouter>,
      );
    });
    expect(tree.toJSON()).toBeNull();
  });
});

describe('live copy that used to point at a retired feature', () => {
  // These pages stay live, so they must not send members to a feature
  // that now redirects with a "switched off" note. (The landing page FAQ
  // in src/pages/Home.jsx is the ux workstream's to change. My Store's
  // waitlist hint is checked on the rendered page in
  // MyStoreWebsite.test.jsx.)
  const source = (file) => readFileSync(resolve(process.cwd(), 'src/pages', file), 'utf8');

  it('no longer promises records for other reptiles', () => {
    expect(source('Contact.jsx')).not.toMatch(/other reptiles/i);
    expect(source('Contact.jsx')).toMatch(/built for crested geckos \(<em>Correlophus ciliatus<\/em>\) only/);
    expect(source('Settings.jsx')).not.toMatch(/Other Reptiles/);
  });
});
