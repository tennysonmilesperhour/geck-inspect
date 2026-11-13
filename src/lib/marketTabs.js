// Which tabs the Prices page (src/pages/Market.jsx) shows a member, and
// which one it opens on. Plain functions with no imports, so they can be
// tested without drawing the page.

// The three tabs that are Enterprise only: the brief, the live feed and
// the watchlist.
const LIVE_TABS = ['today', 'live', 'watchlist'];
// Old links: Guess the Price left the tab strip on 6 Oct 2026.
const TAB_ALIASES = { game: 'today', buy: 'browse', sell: 'listings', portfolio: 'collection', value: 'collection' };

/**
 * The tabs a member is shown and the one the page opens on (decision 3 of
 * the experience review, 13 Nov 2026). Everyone has My collection,
 * In-app listings and Your listings. The live tabs show for a member who
 * has Market Intelligence (Enterprise), who still opens on Today as
 * before, and for everyone while Enterprise is on sale (they see the
 * preview with the upgrade card). While it is off sale the live tabs
 * would only say "not open to new members", so they are left out and the
 * page opens on the member's own collection value.
 */
export function marketTabsFor({ hasMarketIntelligence = false, enterpriseOnSale = false } = {}) {
  const showLive = hasMarketIntelligence || enterpriseOnSale;
  return {
    showLive,
    tabs: ['collection', ...(showLive ? LIVE_TABS : []), 'browse', 'listings'],
    defaultTab: hasMarketIntelligence ? 'today' : 'collection',
  };
}

/** The tab an address asks for, or the default when it is unknown or hidden. */
export function resolveMarketTab(requested, { tabs, defaultTab }) {
  const aliased = TAB_ALIASES[requested] || requested;
  return tabs.includes(aliased) ? aliased : defaultTab;
}
