// Single source of truth for app navigation.
//
// Historically the same page was described in up to four places:
//   * FALLBACK_NAV_ITEMS  (sidebar categories + labels + icons + order)
//   * SECTION_FOR_PAGE    (which Manage/Discover section it belongs to)
//   * BREEDER_ONLY_PAGES  (hidden in Keeper mode)
//   * CommandPalette's own NAV_ITEMS list (label + icon + group + keywords)
//
// Adding or moving a page meant editing several lists that drifted apart.
// Everything now derives from one NAV_REGISTRY below, so a page is
// described once. The derived exports keep the exact same shapes the rest
// of the app already consumes (Layout.jsx, Settings.jsx, PageManagement,
// TutorialModal, CommandPalette), so this is a pure de-duplication with no
// behavior change; navItems.derived.test.js asserts the derived structures
// equal the values that were previously hand-maintained.

import {
  BarChart3,
  Search,
  Layers,
  FlaskConical,
  BookOpen,
  Heart,
  MessageSquare,
  Database,
  ShoppingCart,
  Users,
  GitBranch,
  Upload,
  Shield,
  DollarSign,
  TrendingUp,
  Handshake,
  HelpCircle,
  Utensils,
  Printer,
  Store as StoreIcon,
  HeartHandshake,
  Dna,
  GraduationCap,
  Star,
  Settings as SettingsIcon,
  Egg,
  LayoutGrid,
  LayoutDashboard,
  CircleUser,
  UsersRound,
  Images,
  Tag,
  CalendarDays,
  CalendarRange,
  Sparkles,
  Truck,
  Wrench,
  FolderKanban,
  Bell,
  Trophy,
  Mail,
  CalendarCheck,
  PlusCircle,
  Menu,
  Calculator,
} from 'lucide-react';
import { RETIRED_PAGE_NAMES } from '@/lib/retiredPages';

// Icon string -> component. Both the sidebar (via string keys stored on
// page_config rows) and the palette resolve icons through this map, so it
// must contain every icon either surface references.
export const NAV_ICON_MAP = {
  BarChart3, Search, Layers, FlaskConical, BookOpen, Heart, MessageSquare,
  Database, ShoppingCart, Users, GitBranch, Upload, Shield, HeartHandshake,
  FolderKanban, Dna, GraduationCap, Star, Settings: SettingsIcon,
  Egg, LayoutGrid, LayoutDashboard, CircleUser, UsersRound, Images, Tag,
  CalendarDays, CalendarRange, Sparkles, Truck, Wrench, Store: StoreIcon,
  DollarSign, TrendingUp, Handshake, HelpCircle, Utensils, Printer,
  Bell, Trophy, Mail, CalendarCheck, PlusCircle, Menu, Calculator,
};

// Top-level section tabs. Rendered as a desktop header bar and a mobile
// bottom bar. Each page belongs to at most one section; the sidebar for
// the active section only shows pages in it, keeping the list short.
// Admins can override a page's section via the `section` column on
// page_config.
export const SECTIONS = [
  { id: 'manage',   label: 'Manage',   icon: 'LayoutGrid', defaultPage: 'MyGeckos' },
  { id: 'discover', label: 'Discover', icon: 'Search',     defaultPage: 'Recognition' },
];

// Sidebar groups. One sidebar replaced the Manage and Discover tabs on 6
// Oct 2026; on 16 Oct (review item E3 23) it was cut to the pages members
// use, under these headings. The list is the whole sidebar: a page that
// is not listed here does not show in it, even when its page_config row
// says enabled (the admin Pages tool can still hide a listed page). Pages
// that left the sidebar still open from the command palette and from the
// pages that link to them (Breeding links its planners, the Log tab and
// Today open Field Mode, Today's toggle opens the Overview).
//
// Since 13 Nov 2026 (experience review C1 and H1, section 7) the link
// above the groups is Today, the one home on every device. The Dashboard
// left the menu: it is Today's "Overview" and is in the quick search. Its
// slot went to the Genetics Calculator, and selling has its own group.
//
// Counted with the Today link above the groups: 12 destinations, and 7
// in Keeper mode (navItems.derived.test.js holds both limits).
export const HOME_PAGE = 'Today';
export const NAV_GROUPS = [
  { id: 'collection', label: 'Collection', pages: ['MyGeckos', 'Lineage'] },
  { id: 'breeding', label: 'Breeding', pages: ['Breeding', 'GeneticCalculatorTool'] },
  { id: 'selling', label: 'Selling', pages: ['MarketplaceSalesStats', 'Market'] },
  { id: 'tools', label: 'Tools', pages: ['Recognition'] },
  { id: 'learn', label: 'Learn', pages: ['MorphGuide', 'CareGuide', 'GeneticsGuide'] },
  { id: 'community', label: 'Community', pages: ['Forum'] },
];

// The most the sidebar may hold, the home link included (E3 23's target).
export const SIDEBAR_MAX = 12;
export const KEEPER_SIDEBAR_MAX = 8;

// Pages whose address is not "/" plus the page name. The calculator's
// public address is /calculator; /GeneticCalculatorTool still opens it.
const PAGE_PATHS = { GeneticCalculatorTool: '/calculator' };

/** The address a menu or quick search row for `page` opens. */
export function navPagePath(page) {
  return PAGE_PATHS[page] || `/${page}`;
}

// The phone's bottom bar (review item E3 25): Today, Geckos, Log, More.
// Log opens a short sheet (feeding, weigh-in, shed, Field Mode) and More
// opens the full menu.
export const PHONE_TABS = [
  { id: 'today', page: 'Today', label: 'Today', icon: 'CalendarCheck' },
  { id: 'geckos', page: 'MyGeckos', label: 'Geckos', icon: 'LayoutGrid' },
  { id: 'log', action: 'log', label: 'Log', icon: 'PlusCircle' },
  { id: 'more', action: 'menu', label: 'More', icon: 'Menu' },
];

/** Splits a flat sidebar list into NAV_GROUPS order, dropping empty groups. */
export function groupNavItems(items, skip = new Set([HOME_PAGE])) {
  const byPage = new Map();
  for (const item of items || []) {
    if (item?.page_name && !skip.has(item.page_name)) byPage.set(item.page_name, item);
  }
  const groups = NAV_GROUPS.map((g) => {
    const list = [];
    for (const page of g.pages) {
      if (byPage.has(page)) {
        list.push(byPage.get(page));
        byPage.delete(page);
      }
    }
    return { id: g.id, label: g.label, items: list };
  });
  // Anything left over is not in the sidebar's list, so it is not shown.
  return groups.filter((g) => g.items.length > 0);
}

/**
 * The registry. One row per page. Fields:
 *   page        route/page name (the id used everywhere else)
 *   section     'manage' | 'discover' | undefined (section tab membership)
 *   breederOnly true if hidden in Keeper mode (the menu and the quick search)
 *   sidebar     present if the page seeds the fallback sidebar. Shape:
 *                 { category:'collection'|'tools'|'public', order,
 *                   label, icon (string key), requiresAuth }
 *   palette     present if the page appears in the command palette. Shape:
 *                 { group, label, icon (string key), keywords[],
 *                   memberOnly (hidden from demo guests) }
 *
 * One name per page (experience review H3): the palette label is the menu
 * label, and a page's older names live on as search keywords.
 *
 * Order in this array only matters for the palette (items render in array
 * order, grouped by `group`); the sidebar sorts by the explicit `order`
 * field, and the section/breeder maps are order-independent. Palette rows
 * are therefore listed in their display order.
 */
export const NAV_REGISTRY = [
  // ----- Your Collection (palette) / Manage (section) -----
  {
    page: 'Today', section: 'manage',
    sidebar: { category: 'collection', order: 0.5, label: 'Today', icon: 'CalendarCheck', requiresAuth: false },
    palette: { group: 'Your Collection', label: 'Today', icon: 'CalendarCheck', keywords: ['home', 'due', 'to do', 'reminders', 'feeding', 'weigh-in', 'hatch'] },
  },
  // The Dashboard is Today's "Overview" (13 Nov 2026): no menu entry, the
  // toggle on Today and this row lead to it.
  {
    page: 'Dashboard', section: undefined,
    palette: { group: 'Your Collection', label: 'Overview', icon: 'LayoutDashboard', keywords: ['dashboard', 'stats', 'summary', 'numbers'] },
  },
  {
    page: 'MyGeckos', section: 'manage',
    sidebar: { category: 'collection', order: 1, label: 'My Geckos', icon: 'LayoutGrid', requiresAuth: true },
    palette: { group: 'Your Collection', label: 'My Geckos', icon: 'Users', keywords: ['collection', 'animals', 'list'] },
  },
  {
    page: 'FieldMode', section: 'manage',
    palette: { group: 'Your Collection', label: 'Field Mode', icon: 'Wrench', keywords: ['log', 'quick log', 'weigh', 'feed', 'shed', 'offline'] },
  },
  {
    page: 'MyProfile',
    palette: { group: 'Your Collection', label: 'My Profile', icon: 'Users', keywords: ['account', 'public profile'], memberOnly: true },
  },
  // Batch Husbandry became part of the log screen on 13 Nov 2026 (the
  // page forwards to /log?type=feeding&all=1), so it is not a tool of its
  // own in the quick search: the search's "Log feeding" action opens that
  // screen and answers to the old name.
  { page: 'BatchHusbandry', section: 'manage', breederOnly: true },
  {
    page: 'ImageImport', section: 'discover',
    palette: { group: 'Your Collection', label: 'AI Image Import', icon: 'Sparkles', keywords: ['import', 'scan', 'extract', 'notecard', 'spreadsheet'] },
  },
  {
    page: 'PrintableWorksheets', section: 'discover',
    palette: { group: 'Your Collection', label: 'Printable Worksheets', icon: 'BookOpen', keywords: ['print', 'pdf', 'sheet', 'record'] },
  },

  // ----- Breeding (palette) -----
  {
    page: 'Breeding', section: 'manage', breederOnly: true,
    sidebar: { category: 'collection', order: 3, label: 'Breeding', icon: 'Egg', requiresAuth: true },
    palette: { group: 'Breeding', label: 'Breeding', icon: 'GitBranch', keywords: ['breeding plans', 'pairings', 'projects', 'season', 'breeding pairs', 'sire dam', 'pair', 'eggs', 'hatch', 'hatchery'] },
  },
  // The calculator is a public page at /calculator (navPagePath). It took
  // the Dashboard's slot in the menu on 13 Nov 2026 (experience review H1).
  {
    page: 'GeneticCalculatorTool', section: 'discover', breederOnly: true,
    sidebar: { category: 'tools', order: 2, label: 'Genetics Calculator', icon: 'Calculator', requiresAuth: false },
    palette: { group: 'Breeding', label: 'Genetics Calculator', icon: 'Calculator', keywords: ['calculate a pairing', 'punnett', 'odds', 'cross', 'clutch', 'offspring', 'morph calculator'] },
  },
  {
    page: 'Lineage', section: 'manage', breederOnly: true,
    sidebar: { category: 'collection', order: 4, label: 'Lineage', icon: 'GitBranch', requiresAuth: true },
    palette: { group: 'Breeding', label: 'Lineage', icon: 'GitBranch', keywords: ['lineage tree', 'ancestry', 'bloodline'] },
  },
  {
    page: 'Pedigree', section: 'manage', breederOnly: true,
    palette: { group: 'Breeding', label: 'Family tree', icon: 'GitBranch', keywords: ['pedigree', 'pedigree chart', 'certificate', 'lineage record'] },
  },
  // Breeding ROI left the menus on 28 Sep 2026: each breeding plan now shows
  // its pairing value, and Business shows profit per pairing. The
  // page still routes for old links.
  { page: 'BreedingROI', section: 'discover', breederOnly: true },
  {
    page: 'ProjectManager', section: 'manage', breederOnly: true,
    palette: { group: 'Breeding', label: 'Season Planner', icon: 'CalendarDays', keywords: ['project manager', 'tasks', 'goals', 'feeding groups', 'future pairings'] },
  },
  {
    page: 'BreedingSeason', section: 'manage', breederOnly: true,
    palette: { group: 'Breeding', label: 'Season Timeline', icon: 'CalendarRange', keywords: ['timeline', 'clutches', 'incubation'] },
  },
  {
    page: 'PairingPlanner', section: 'manage', breederOnly: true,
    palette: { group: 'Breeding', label: 'Pairing Planner', icon: 'Dna', keywords: ['pairing', 'goal', 'compare pairs'] },
  },
  // The collection's value is the first tab of Prices (13 Nov 2026), so
  // it has no row of its own in the quick search. /Portfolio forwards to
  // the tab (TAB_FORWARDS in src/pages.config.js).
  { page: 'Portfolio', section: 'manage', breederOnly: true },

  // ----- Community (palette) -----
  {
    page: 'Gallery', section: 'discover',
    palette: { group: 'Community', label: 'Community Gallery', icon: 'Images', keywords: ['image gallery', 'photos', 'feed', 'browse'] },
  },
  {
    page: 'LikedGeckos', section: 'manage',
    palette: { group: 'Community', label: 'Liked Geckos', icon: 'Heart', keywords: ['hearts', 'favorites'], memberOnly: true },
  },
  {
    page: 'Forum', section: 'discover',
    sidebar: { category: 'collection', order: 8, label: 'Forum', icon: 'MessageSquare', requiresAuth: false },
    palette: { group: 'Community', label: 'Forum', icon: 'MessageSquare', keywords: ['discussion', 'posts'] },
  },
  {
    page: 'Messages',
    palette: { group: 'Community', label: 'Messages', icon: 'Mail', keywords: ['dm', 'inbox', 'chat'] },
  },
  {
    page: 'Notifications',
    palette: { group: 'Community', label: 'Notifications', icon: 'Bell', keywords: ['alerts'] },
  },

  // ----- Selling (palette) -----
  // Two homes for selling (experience review H6): Business for the money,
  // Prices for what geckos are worth and the listings.
  { page: 'MarketplaceSalesStats', section: 'manage', breederOnly: true,
    sidebar: { category: 'public', order: 3, label: 'Business', icon: 'BarChart3', requiresAuth: true },
    palette: { group: 'Selling', label: 'Business', icon: 'BarChart3', keywords: ['business tools', 'roi', 'profit', 'cost', 'revenue', 'money', 'sales', 'expenses', 'waitlists'] },
  },
  // Prices (Market Intelligence until 13 Nov 2026): the collection's
  // value, in-app listings (the old Marketplace page) and your listings;
  // for Enterprise also the daily brief, live listings and the watchlist.
  // Buy Geckos, Sell Geckos and Portfolio are tabs here, so they are
  // keywords of this row and not rows of their own.
  {
    page: 'Market', section: 'discover', breederOnly: true,
    sidebar: { category: 'public', order: 1.5, label: 'Prices', icon: 'TrendingUp', requiresAuth: true },
    palette: { group: 'Selling', label: 'Prices', icon: 'TrendingUp', keywords: ['market intelligence', 'market', 'collection value', 'portfolio', 'worth', 'estimate', 'in-app listings', 'marketplace', 'buy geckos', 'for sale', 'sell geckos', 'seller console', 'brief', 'watchlist', 'price cuts'] },
  },
  { page: 'MarketplaceBuy', section: 'discover' },
  { page: 'MarketplaceSell', section: 'manage' },
  {
    page: 'MyListings', section: 'manage', breederOnly: true,
    palette: { group: 'Selling', label: 'My Listings', icon: 'ShoppingCart', keywords: ['my sales', 'inquiries'] },
  },
  // Left the Overview's hero on 13 Nov 2026 (experience review C4).
  {
    page: 'MyStore', breederOnly: true,
    palette: { group: 'Selling', label: 'My Store', icon: 'Store', keywords: ['storefront', 'store page', 'breeder page'], memberOnly: true },
  },

  // ----- Reference (palette) / Discover (section) -----
  {
    page: 'MorphGuide', section: 'discover',
    sidebar: { category: 'tools', order: 3, label: 'Morph Guide', icon: 'BookOpen', requiresAuth: false },
    palette: { group: 'Reference', label: 'Morph Guide', icon: 'Dna', keywords: ['morphs', 'harlequin', 'dalmatian', 'lilly white'] },
  },
  {
    page: 'GeneticsGuide', section: 'discover',
    sidebar: { category: 'tools', order: 4, label: 'Genetics Guide', icon: 'Dna', requiresAuth: false },
    palette: { group: 'Reference', label: 'Genetics Guide', icon: 'Dna', keywords: ['inheritance', 'heredity'] },
  },
  {
    page: 'CareGuide', section: 'discover',
    sidebar: { category: 'collection', order: 7, label: 'Care Guide', icon: 'Heart', requiresAuth: false },
    palette: { group: 'Reference', label: 'Care Guide', icon: 'BookOpen', keywords: ['husbandry', 'care sheet', 'setup'] },
  },
  {
    page: 'Recognition', section: 'discover',
    sidebar: { category: 'tools', order: 1, label: 'Morph ID', icon: 'Search', requiresAuth: false },
    palette: { group: 'Reference', label: 'Morph ID', icon: 'Sparkles', keywords: ['ai morph recognition', 'identify', 'classify', 'scan', 'photo'] },
  },
  {
    page: 'Training', section: 'discover',
  },
  {
    page: 'MorphGuideSubmission', section: 'discover',
    palette: { group: 'Reference', label: 'Submit a Morph', icon: 'BookOpen', keywords: ['contribute', 'add morph', 'submit'] },
  },

  // ----- Account (palette) -----
  {
    page: 'Settings',
    palette: { group: 'Account', label: 'Settings', icon: 'Settings', keywords: ['preferences', 'config'] },
  },
  {
    page: 'Membership',
    palette: { group: 'Account', label: 'Membership', icon: 'Trophy', keywords: ['membership', 'billing', 'subscription', 'upgrade'] },
  },


  // ----- Section-only pages (routed, section-assigned, no sidebar/palette) -----
  { page: 'GeckoDetail', section: 'manage' },
  { page: 'AnimalPassport', section: 'manage' },
  { page: 'ClaimAnimal', section: 'manage' },
  { page: 'MorphMarketExport', breederOnly: true },
  { page: 'CareGuideTopic', section: 'discover' },
  { page: 'ForumPost', section: 'discover' },
  { page: 'MarketplaceVerification', section: 'discover' },
  { page: 'MarketPricing', section: 'discover' },
  { page: 'Breeder', section: 'discover' },
];

// Focus pass (27 Sep 2026, docs/planning/history/vip-audit-2026-09-27.md P7):
// Geck Answers no longer appears in the command palette.
//
// Retired 2 Oct 2026 (feature completeness audit, step 5): Breeding Loans,
// Community Connect, the AI Training Center (/TrainModel) and the Morph
// Visualizer. Retired 16 Oct 2026 (review item E3 23): Promote, Other
// Reptiles, the AI Consultant and the supplies store with its sticker
// builders. Their old URLs redirect; see src/lib/retiredPages.js.

// ---- Derived: SECTION_FOR_PAGE ----------------------------------------
// Fallback section assignment for every known page. Used when the DB has
// no explicit `section` value yet. Pages not in this map are
// section-agnostic (MyProfile, Settings, etc.) and don't light up a tab.
export const SECTION_FOR_PAGE = Object.fromEntries(
  NAV_REGISTRY.filter((e) => e.section).map((e) => [e.page, e.section]),
);

export function getSectionForPage(pageName) {
  return SECTION_FOR_PAGE[pageName] || null;
}

// ---- Derived: FALLBACK_NAV_ITEMS --------------------------------------
// Seeds the sidebar when a page isn't in page_config yet, and supplies the
// canonical display_name / icon Layout uses across renames. Grouped by
// category, sorted by explicit order.
function buildFallbackNav() {
  const cats = { collection: [], tools: [], public: [] };
  for (const e of NAV_REGISTRY) {
    const sb = e.sidebar;
    if (!sb) continue;
    cats[sb.category].push({
      page_name: e.page,
      display_name: sb.label,
      icon: sb.icon,
      category: sb.category,
      requires_auth: sb.requiresAuth,
      is_enabled: true,
      order: sb.order,
    });
  }
  for (const k of Object.keys(cats)) {
    cats[k].sort((a, b) => a.order - b.order);
  }
  return cats;
}

export const FALLBACK_NAV_ITEMS = buildFallbackNav();

// ---- Derived: command palette items -----------------------------------
// Consumed by CommandPalette.jsx. Icons are resolved to components here so
// the palette can keep using `item.icon` directly.
export const PALETTE_ITEMS = NAV_REGISTRY.filter((e) => e.palette).map((e) => ({
  label: e.palette.label,
  page: e.page,
  path: navPagePath(e.page),
  icon: NAV_ICON_MAP[e.palette.icon],
  section: e.palette.group,
  keywords: e.palette.keywords || [],
  breederOnly: e.breederOnly === true,
  memberOnly: e.palette.memberOnly === true,
}));

/**
 * The quick search rows this visitor should see (experience review H4):
 * Keeper mode hides the breeding and selling pages, as it does in the
 * menu, and a demo guest is not offered rows that only work with an
 * account. Works on any rows carrying breederOnly and memberOnly, so the
 * quick search runs its own actions through it too.
 */
export function paletteItemsFor({ keeperMode = false, guest = false } = {}, items = PALETTE_ITEMS) {
  return items.filter((item) => !(keeperMode && item.breederOnly) && !(guest && item.memberOnly));
}

export const FAVORITES_MAX = 4;

// Keeper mode: most crested gecko owners keep one or two pets and never
// breed. When the toggle in Settings is on, Layout filters these pages out
// of every sidebar category so a keeper isn't wading through breeding and
// selling tools to find the care guide. This is nav decluttering only:
// direct URLs to these pages still work, nothing is access-controlled.
//
// Stored per device in localStorage under KEEPER_MODE_STORAGE_KEY
// ('1' = on). Settings.jsx fires a 'keeper_mode_changed' window event
// after writing so Layout updates without a reload.
export const KEEPER_MODE_STORAGE_KEY = 'geck_keeper_mode';

// ---- Derived: BREEDER_ONLY_PAGES --------------------------------------
export const BREEDER_ONLY_PAGES = new Set(
  NAV_REGISTRY.filter((e) => e.breederOnly).map((e) => e.page),
);

export function flattenNavItems(navItems) {
  return [
    ...(navItems.collection || []),
    ...(navItems.tools || []),
    ...(navItems.public || []),
  ];
}

// ---- The sidebar from page_config rows ---------------------------------
// Moved here from Layout.jsx (16 Oct 2026) so the sidebar's size can be
// tested against the rows production really has.

/**
 * The sidebar's items by category ({ collection, tools, public }).
 *
 * The page_config table decides what is switched on and the order inside
 * a category; FALLBACK_NAV_ITEMS fills in a page that has no row yet (a
 * new page on its first deploy) and gives every page its current name
 * and icon. A row that switches a page off keeps it off. Retired pages
 * are left out whatever their row says. NAV_GROUPS then decides which of
 * these the sidebar shows (groupNavItems).
 */
export function buildNavItems(pageConfigs, retired = RETIRED_PAGE_NAMES) {
  if (!Array.isArray(pageConfigs) || pageConfigs.length === 0) {
    return FALLBACK_NAV_ITEMS;
  }

  // One row per page_name. Admins can end up with several rows for a
  // page (an old seeding bug). Preference: an enabled row, then the most
  // recently updated.
  const byName = new Map();
  for (const p of pageConfigs) {
    if (!p?.page_name) continue;
    const prev = byName.get(p.page_name);
    if (!prev) {
      byName.set(p.page_name, p);
      continue;
    }
    const prevEnabled = prev.is_enabled !== false;
    const pEnabled = p.is_enabled !== false;
    if (pEnabled && !prevEnabled) {
      byName.set(p.page_name, p);
    } else if (pEnabled === prevEnabled) {
      const prevDate = new Date(prev.updated_date || prev.created_date || 0).getTime();
      const pDate = new Date(p.updated_date || p.created_date || 0).getTime();
      if (pDate > prevDate) byName.set(p.page_name, p);
    }
  }
  const rows = Array.from(byName.values());

  const fallbackByName = {};
  for (const category of ['collection', 'tools', 'public']) {
    for (const f of (FALLBACK_NAV_ITEMS[category] || [])) fallbackByName[f.page_name] = f;
  }

  const enabled = rows
    .filter((p) => p.is_enabled !== false && !retired.has(p.page_name))
    .sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));

  const nav = {};
  for (const category of ['collection', 'tools', 'public']) {
    // Current names and icons win over the ones stored on old rows.
    nav[category] = enabled.filter((p) => p.category === category).map((p) => {
      const fb = fallbackByName[p.page_name];
      return fb && (fb.display_name !== p.display_name || fb.icon !== p.icon)
        ? { ...p, display_name: fb.display_name, icon: fb.icon }
        : p;
    });
  }

  // A page with no row at all yet shows from the fallback. A row that
  // switches a page off is never overridden by the fallback.
  for (const category of ['collection', 'tools', 'public']) {
    for (const fallback of (FALLBACK_NAV_ITEMS[category] || [])) {
      if (!byName.has(fallback.page_name)) nav[category].push(fallback);
    }
  }
  return nav;
}

/**
 * Keeper mode: the same items less the breeding and selling pages. Only
 * the menu is trimmed; the pages still open from a link.
 */
export function keeperNavItems(nav, keeperMode) {
  if (!keeperMode) return nav;
  return {
    collection: (nav.collection || []).filter((i) => !BREEDER_ONLY_PAGES.has(i.page_name)),
    tools: (nav.tools || []).filter((i) => !BREEDER_ONLY_PAGES.has(i.page_name)),
    public: (nav.public || []).filter((i) => !BREEDER_ONLY_PAGES.has(i.page_name)),
  };
}

/** Every page the sidebar links to: the home link (Today), then the groups. */
export function sidebarDestinations(nav) {
  const groups = groupNavItems(flattenNavItems(nav));
  return [HOME_PAGE, ...groups.flatMap((g) => g.items.map((i) => i.page_name))];
}
