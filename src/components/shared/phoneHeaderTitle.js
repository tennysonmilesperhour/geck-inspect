import { NAV_REGISTRY } from '@/lib/navItems';

/**
 * The words the phone header shows where the menu button used to be
 * (experience review B6): the name of the page that is open, so a member
 * who has scrolled past the page's own heading still knows where they
 * are. The More tab opens the menu.
 *
 * The name is the one the menu uses for the page (the registry in
 * src/lib/navItems.js, which the menu's labels come from), then the quick
 * search's name for a page that is not in the menu, so a page is never
 * given one more name here (the Dashboard is "Overview", /Market is
 * "Prices"). Today is the home and shows the "Geck Inspect" wordmark
 * instead, as does any page with no name (null from this function).
 */
const REGISTRY_LABELS = Object.fromEntries(
  NAV_REGISTRY
    .map((entry) => [entry.page.toLowerCase(), entry.sidebar?.label || entry.palette?.label])
    .filter(([, label]) => label),
);

// Pages in neither the menu nor the quick search, by their own headings.
// The last three are tabs of Prices for a member; only the demo still
// opens them as pages.
const OTHER_LABELS = {
  geckodetail: 'Gecko record',
  calculator: 'Genetics Calculator',
  adminpanel: 'Admin Panel',
  portfolio: 'Collection Portfolio',
  marketplacebuy: 'Gecko Marketplace',
  marketplacesell: 'Seller Console',
};

/**
 * @param {string} pathname  location.pathname
 * @returns {string|null} the page's name, or null for the wordmark
 */
export function phoneHeaderTitle(pathname) {
  const page = String(pathname || '').replace(/^\/+/, '').split('/')[0].toLowerCase();
  if (!page || page === 'today') return null;
  return REGISTRY_LABELS[page] || OTHER_LABELS[page] || null;
}
