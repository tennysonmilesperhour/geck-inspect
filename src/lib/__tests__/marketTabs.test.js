// The Prices page (experience review, decision 3 and finding H6): it
// opens on the member's own collection value, and the Enterprise live
// tabs are hidden while they would only say "not open to new members".
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { marketTabsFor, resolveMarketTab } from '@/lib/marketTabs';
import { TAB_FORWARDS } from '@/pages.config';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

describe('the tabs of Prices', () => {
  it('opens a member without Enterprise on their collection, with no closed tabs', () => {
    const view = marketTabsFor({ hasMarketIntelligence: false, enterpriseOnSale: false });
    expect(view.tabs).toEqual(['collection', 'browse', 'listings']);
    expect(view.defaultTab).toBe('collection');
    expect(view.showLive).toBe(false);
    expect(marketTabsFor()).toEqual(view);
  });

  it('gives an Enterprise member the tabs and the first screen they had', () => {
    const view = marketTabsFor({ hasMarketIntelligence: true, enterpriseOnSale: false });
    expect(view.tabs).toEqual(['collection', 'today', 'live', 'watchlist', 'browse', 'listings']);
    expect(view.defaultTab).toBe('today');
    expect(resolveMarketTab(null, view)).toBe('today');
    expect(resolveMarketTab('watchlist', view)).toBe('watchlist');
  });

  it('brings the live tabs back for everyone when Enterprise is on sale again', () => {
    const view = marketTabsFor({ hasMarketIntelligence: false, enterpriseOnSale: true });
    expect(view.tabs).toContain('live');
    expect(view.defaultTab).toBe('collection');
  });

  it('sends a link to a hidden or unknown tab to the collection, and keeps the old names working', () => {
    const view = marketTabsFor({});
    for (const tab of ['today', 'live', 'watchlist', 'game', 'nonsense', null, undefined, '']) {
      expect(resolveMarketTab(tab, view), String(tab)).toBe('collection');
    }
    expect(resolveMarketTab('buy', view)).toBe('browse');
    expect(resolveMarketTab('sell', view)).toBe('listings');
    expect(resolveMarketTab('portfolio', view)).toBe('collection');
    expect(resolveMarketTab('browse', view)).toBe('browse');
  });

  it('every forwarded page lands on a tab every member has', () => {
    const view = marketTabsFor({});
    for (const [page, to] of Object.entries(TAB_FORWARDS)) {
      const tab = new URLSearchParams(to.split('?')[1]).get('tab');
      expect(view.tabs, page).toContain(tab);
      expect(resolveMarketTab(tab, view), page).toBe(tab);
    }
  });
});

describe('the Prices page source', () => {
  const market = read('pages/Market.jsx');
  const app = read('App.jsx');

  it('is named Prices in its title and header, for members and for the demo', () => {
    expect(market).not.toMatch(/title="[^"]*Market Intelligence[^"]*"/);
    expect(market.match(/title="Prices"/g)).toHaveLength(4);
  });

  it('draws the live tabs only when they are shown, and loads the collection tab on demand', () => {
    expect(market).toMatch(/\{view\.showLive && \(\s*<>\s*<TabsTrigger value="today">/);
    expect(market).toMatch(/\{view\.showLive && \(\s*<>\s*<TabsContent value="today">/);
    expect(market).toContain("lazy(() => import('@/pages/Portfolio'))");
    expect(market).toContain('<PortfolioPage embedded />');
    expect(market).toContain("canUseFeature(user, 'market_intelligence')");
  });

  it('App.jsx forwards the standalone pages for members and leaves them to the demo', () => {
    expect(app).toContain('const forward = !isGuest && forwards[path];');
    expect(app).toContain('forward ? <Navigate to={forward} replace />');
  });
});
