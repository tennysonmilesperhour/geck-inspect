import { describe, it, expect } from 'vitest';
import {
  FALLBACK_NAV_ITEMS,
  SECTION_FOR_PAGE,
  BREEDER_ONLY_PAGES,
  PALETTE_ITEMS,
  NAV_GROUPS,
  NAV_REGISTRY,
  NAV_ICON_MAP,
  PHONE_TABS,
  SIDEBAR_MAX,
  KEEPER_SIDEBAR_MAX,
  buildNavItems,
  keeperNavItems,
  sidebarDestinations,
} from './navItems';
import { RETIRED_PAGES, RETIRED_PAGE_NAMES, isFeatureRetired } from './retiredPages';
import { PAGES, LIVE_PAGES } from '@/pages.config';

// The structures navItems.js derives from NAV_REGISTRY. If you add or move
// a page in NAV_REGISTRY, update the matching fixture here in the same
// commit. The 16 Oct 2026 cut (review item E3 23) is described in
// docs/planning/retired-features-2026-10.md.

const EXPECTED_FALLBACK = {
  collection: [
    { page_name: 'Today', display_name: 'Today', icon: 'CalendarCheck', category: 'collection', requires_auth: false, is_enabled: true, order: 0.5 },
    { page_name: 'MyGeckos', display_name: 'My Geckos', icon: 'LayoutGrid', category: 'collection', requires_auth: true, is_enabled: true, order: 1 },
    { page_name: 'Breeding', display_name: 'Breeding', icon: 'Egg', category: 'collection', requires_auth: true, is_enabled: true, order: 3 },
    { page_name: 'Lineage', display_name: 'Lineage', icon: 'GitBranch', category: 'collection', requires_auth: true, is_enabled: true, order: 4 },
    { page_name: 'CareGuide', display_name: 'Care Guide', icon: 'Heart', category: 'collection', requires_auth: false, is_enabled: true, order: 7 },
    { page_name: 'Forum', display_name: 'Forum', icon: 'MessageSquare', category: 'collection', requires_auth: false, is_enabled: true, order: 8 },
  ],
  tools: [
    { page_name: 'Recognition', display_name: 'Morph ID', icon: 'Search', category: 'tools', requires_auth: false, is_enabled: true, order: 1 },
    { page_name: 'MorphGuide', display_name: 'Morph Guide', icon: 'BookOpen', category: 'tools', requires_auth: false, is_enabled: true, order: 3 },
    { page_name: 'GeneticsGuide', display_name: 'Genetics Guide', icon: 'Dna', category: 'tools', requires_auth: false, is_enabled: true, order: 4 },
  ],
  public: [
    { page_name: 'Dashboard', display_name: 'Dashboard', icon: 'BarChart3', category: 'public', requires_auth: false, is_enabled: true, order: 1 },
    { page_name: 'Market', display_name: 'Market Intelligence', icon: 'TrendingUp', category: 'public', requires_auth: true, is_enabled: true, order: 1.5 },
    { page_name: 'MarketplaceSalesStats', display_name: 'Business Tools', icon: 'BarChart3', category: 'public', requires_auth: true, is_enabled: true, order: 3 },
  ],
};

// Order-independent: page -> section.
const EXPECTED_SECTION = {
  Today: 'manage', MyGeckos: 'manage', Breeding: 'manage',
  BreedingSeason: 'manage', PairingPlanner: 'manage', FieldMode: 'manage', Portfolio: 'manage',
  Lineage: 'manage', Pedigree: 'manage', GeckoDetail: 'manage', AnimalPassport: 'manage',
  ClaimAnimal: 'manage', LikedGeckos: 'manage', ProjectManager: 'manage', MarketplaceSalesStats: 'manage',
  MyListings: 'manage',
  BatchHusbandry: 'manage', MarketplaceSell: 'manage',
  Recognition: 'discover', MorphGuide: 'discover', MorphGuideSubmission: 'discover',
  GeneticsGuide: 'discover', GeneticCalculatorTool: 'discover', Gallery: 'discover', CareGuide: 'discover',
  CareGuideTopic: 'discover', Forum: 'discover', ForumPost: 'discover',
  PrintableWorksheets: 'discover', ImageImport: 'discover',
  Training: 'discover', MarketplaceBuy: 'discover',
  MarketplaceVerification: 'discover', MarketPricing: 'discover', BreedingROI: 'discover',
  Market: 'discover',
  Breeder: 'discover',
};

const EXPECTED_BREEDER_ONLY = [
  'Breeding', 'BreedingSeason', 'PairingPlanner', 'Portfolio', 'Lineage',
  'Pedigree', 'MarketplaceSalesStats', 'MyListings', 'Market',
  'BatchHusbandry', 'ProjectManager', 'MorphMarketExport', 'BreedingROI',
];

// The palette rows in their display order (icons compared separately
// since they resolve to components). One name per page: the palette uses
// the sidebar's name, and the old names stay as search keywords.
const EXPECTED_PALETTE = [
  ['Dashboard', 'Dashboard', 'Your Collection'],
  ['Today', 'Today', 'Your Collection'],
  ['MyGeckos', 'My Geckos', 'Your Collection'],
  ['FieldMode', 'Field Mode', 'Your Collection'],
  ['MyProfile', 'My Profile', 'Your Collection'],
  ['BatchHusbandry', 'Batch Husbandry', 'Your Collection'],
  ['ImageImport', 'AI Image Import', 'Your Collection'],
  ['PrintableWorksheets', 'Printable Worksheets', 'Your Collection'],
  ['Breeding', 'Breeding', 'Breeding'],
  ['Lineage', 'Lineage', 'Breeding'],
  ['Pedigree', 'Pedigree', 'Breeding'],
  ['MarketplaceSalesStats', 'Business Tools', 'Breeding'],
  ['ProjectManager', 'Season Planner', 'Breeding'],
  ['BreedingSeason', 'Season Timeline', 'Breeding'],
  ['PairingPlanner', 'Pairing Planner', 'Breeding'],
  ['Portfolio', 'Portfolio', 'Breeding'],
  ['Gallery', 'Community Gallery', 'Community'],
  ['LikedGeckos', 'Liked Geckos', 'Community'],
  ['Forum', 'Forum', 'Community'],
  ['Messages', 'Messages', 'Community'],
  ['Notifications', 'Notifications', 'Community'],
  ['Market', 'Market Intelligence', 'Marketplace'],
  ['MarketplaceBuy', 'Buy Geckos', 'Marketplace'],
  ['MarketplaceSell', 'Sell Geckos', 'Marketplace'],
  ['MyListings', 'My Listings', 'Marketplace'],
  ['MorphGuide', 'Morph Guide', 'Reference'],
  ['GeneticsGuide', 'Genetics Guide', 'Reference'],
  ['CareGuide', 'Care Guide', 'Reference'],
  ['Recognition', 'Morph ID', 'Reference'],
  ['MorphGuideSubmission', 'Submit a Morph', 'Reference'],
  ['Settings', 'Settings', 'Account'],
  ['Membership', 'Membership', 'Account'],
];

// Production's page_config rows on 16 Oct 2026 (read only): the rows that
// decide the sidebar members see. Several pages that left the sidebar
// still have enabled rows (Other Reptiles, Season Planner, Sell Geckos,
// My Profile); the sidebar must stay inside its limits anyway.
const PRODUCTION_PAGE_CONFIG = [
  ['MyGeckos', 'collection', true, 0], ['Breeding', 'collection', true, 1],
  ['Lineage', 'collection', true, 2], ['OtherReptiles', 'collection', true, 3],
  ['MarketplaceSalesStats', 'collection', true, 4], ['MarketplaceSell', 'collection', true, 5],
  ['ProjectManager', 'collection', true, 6], ['MyProfile', 'collection', true, 7],
  ['Marketplace', 'public', true, 0], ['Dashboard', 'public', true, 2],
  ['Recognition', 'tools', true, 0], ['GeneticsGuide', 'tools', true, 2],
  ['MorphGuide', 'tools', true, 3], ['CareGuide', 'tools', true, 4],
  ['FieldMode', 'collection', false, 1.5], ['LikedGeckos', 'collection', false, 5],
  ['Promote', 'collection', false, 6.5], ['Gallery', 'public', false, 0],
  ['Membership', 'public', false, 0], ['CommunityConnect', 'public', false, 1],
  ['MorphVisualizer', 'tools', false, 1], ['BreederConsultant', 'tools', false, 2],
  ['Training', 'tools', false, 5],
].map(([page_name, category, is_enabled, order_position]) => ({
  page_name, display_name: page_name, category, is_enabled, order_position,
}));

describe('navItems derived structures', () => {
  it('FALLBACK_NAV_ITEMS is the sidebar list, sorted by order', () => {
    expect(FALLBACK_NAV_ITEMS).toEqual(EXPECTED_FALLBACK);
  });

  it('SECTION_FOR_PAGE matches the map', () => {
    expect(SECTION_FOR_PAGE).toEqual(EXPECTED_SECTION);
  });

  it('BREEDER_ONLY_PAGES matches the set', () => {
    expect([...BREEDER_ONLY_PAGES].sort()).toEqual([...EXPECTED_BREEDER_ONLY].sort());
  });

  it('command palette items match the list in order', () => {
    const got = PALETTE_ITEMS.map((i) => [i.page, i.label, i.section]);
    expect(got).toEqual(EXPECTED_PALETTE);
  });

  it('every palette item resolves to an icon component and has keywords', () => {
    for (const item of PALETTE_ITEMS) {
      expect(item.icon, `icon for ${item.page}`).toBeTruthy();
      expect(Array.isArray(item.keywords), `keywords for ${item.page}`).toBe(true);
    }
  });
});

describe('the sidebar stays small (review item E3 23)', () => {
  it('has at most 12 destinations, and at most 8 in Keeper mode', () => {
    const all = sidebarDestinations(FALLBACK_NAV_ITEMS);
    const keeper = sidebarDestinations(keeperNavItems(FALLBACK_NAV_ITEMS, true));
    expect(all.length).toBeLessThanOrEqual(SIDEBAR_MAX);
    expect(keeper.length).toBeLessThanOrEqual(KEEPER_SIDEBAR_MAX);
    expect(SIDEBAR_MAX).toBe(12);
    expect(KEEPER_SIDEBAR_MAX).toBe(8);
    expect(all).toEqual([
      'Dashboard', 'Today', 'MyGeckos', 'Breeding', 'Lineage', 'MarketplaceSalesStats',
      'Recognition', 'Market', 'MorphGuide', 'CareGuide', 'GeneticsGuide', 'Forum',
    ]);
    expect(keeper).toEqual([
      'Dashboard', 'Today', 'MyGeckos', 'Recognition', 'MorphGuide', 'CareGuide', 'GeneticsGuide', 'Forum',
    ]);
  });

  it('stays inside the limits with the rows production has', () => {
    const nav = buildNavItems(PRODUCTION_PAGE_CONFIG);
    const all = sidebarDestinations(nav);
    const keeper = sidebarDestinations(keeperNavItems(nav, true));
    expect(all.length).toBeLessThanOrEqual(SIDEBAR_MAX);
    expect(keeper.length).toBeLessThanOrEqual(KEEPER_SIDEBAR_MAX);
    // Today has no row yet, so it comes from the fallback list.
    expect(all).toContain('Today');
    // An enabled row does not put a retired page, or a page off the list,
    // back in the sidebar.
    for (const page of ['OtherReptiles', 'Marketplace', 'ProjectManager', 'MarketplaceSell', 'MyProfile']) {
      expect(all).not.toContain(page);
    }
    // A row that switches a listed page off still hides it.
    const offForum = buildNavItems([...PRODUCTION_PAGE_CONFIG, { page_name: 'Forum', category: 'collection', is_enabled: false }]);
    expect(sidebarDestinations(offForum)).not.toContain('Forum');
  });

  it('lists only pages that exist, are routed and are not retired', () => {
    for (const group of NAV_GROUPS) {
      for (const page of group.pages) {
        const entry = NAV_REGISTRY.find((e) => e.page === page);
        expect(entry?.sidebar, `${page} has a sidebar entry`).toBeTruthy();
        expect(NAV_ICON_MAP[entry.sidebar.icon], `${page} icon`).toBeTruthy();
        expect(LIVE_PAGES[page], `${page} is routed`).toBeTruthy();
      }
    }
  });

  it('keeps the pages that left the sidebar findable in the command palette', () => {
    const palette = new Set(PALETTE_ITEMS.map((i) => i.page));
    for (const page of ['ProjectManager', 'BreedingSeason', 'PairingPlanner', 'Portfolio', 'FieldMode', 'Gallery']) {
      expect(palette.has(page), page).toBe(true);
      expect(LIVE_PAGES[page], `${page} is routed`).toBeTruthy();
    }
  });
});

describe('the phone tabs (review item E3 25)', () => {
  it('are Today, Geckos, Log and More', () => {
    expect(PHONE_TABS.map((t) => t.label)).toEqual(['Today', 'Geckos', 'Log', 'More']);
    for (const tab of PHONE_TABS) {
      expect(NAV_ICON_MAP[tab.icon], `${tab.id} icon`).toBeTruthy();
      if (tab.page) expect(LIVE_PAGES[tab.page], `${tab.page} is routed`).toBeTruthy();
      else expect(['log', 'menu']).toContain(tab.action);
    }
  });
});

describe('retired pages stay out of navigation', () => {
  it('no sidebar, section, keeper-mode or palette entry names a retired page', () => {
    const named = [
      ...Object.values(FALLBACK_NAV_ITEMS).flat().map((i) => i.page_name),
      ...Object.keys(SECTION_FOR_PAGE),
      ...BREEDER_ONLY_PAGES,
      ...PALETTE_ITEMS.map((i) => i.page),
      ...NAV_GROUPS.flatMap((g) => g.pages),
    ];
    expect(named.filter((p) => RETIRED_PAGE_NAMES.has(p))).toEqual([]);
  });

  it('every retired page redirects to a live page, not to another retired one', () => {
    for (const { page, to } of RETIRED_PAGES) {
      expect(to.startsWith('/'), page).toBe(true);
      const target = to.slice(1).split(/[?#/]/)[0];
      expect(RETIRED_PAGE_NAMES.has(target), page).toBe(false);
    }
  });

  it('a retired page is not routed, and switching it back on is one line', () => {
    for (const { page } of RETIRED_PAGES) {
      expect(LIVE_PAGES[page], page).toBeUndefined();
    }
    // The pages retired on 16 Oct keep their registry line, so deleting
    // the retiredPages.js entry is all it takes to bring one back.
    for (const page of ['Promote', 'BreederConsultant', 'OtherReptiles']) {
      expect(PAGES[page], page).toBeTruthy();
    }
  });

  it('each page retired on 16 Oct carries a note for the member who followed an old link', () => {
    for (const entry of RETIRED_PAGES.filter((r) => r.retired === '2026-10-16')) {
      expect(entry.to, entry.page).toContain(`retired=${entry.page}`);
      expect(entry.title, entry.page).toBeTruthy();
      expect(entry.note, entry.page).toBeTruthy();
      expect(`${entry.title} ${entry.note}`).not.toMatch(/[\u2013\u2014]/);
    }
    expect(isFeatureRetired('websiteBuilder')).toBe(true);
    expect(isFeatureRetired('somethingElse')).toBe(false);
  });
});
