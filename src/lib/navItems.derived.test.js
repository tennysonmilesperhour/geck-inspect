import { describe, it, expect } from 'vitest';
import {
  FALLBACK_NAV_ITEMS,
  SECTION_FOR_PAGE,
  BREEDER_ONLY_PAGES,
  PALETTE_ITEMS,
} from './navItems';
import { RETIRED_PAGES, RETIRED_PAGE_NAMES } from './retiredPages';

// These fixtures are the exact structures that used to be hand-maintained
// across navItems.js and CommandPalette.jsx before they were unified into
// NAV_REGISTRY. Asserting the derived exports still equal them proves the
// de-duplication changed no behavior. If you intentionally add/move a page
// in NAV_REGISTRY, update the matching fixture here in the same commit.

const EXPECTED_FALLBACK = {
  collection: [
    { page_name: 'MyGeckos', display_name: 'My Geckos', icon: 'LayoutGrid', category: 'collection', requires_auth: true, is_enabled: true, order: 1 },
    { page_name: 'FieldMode', display_name: 'Field Mode', icon: 'Wrench', category: 'collection', requires_auth: true, is_enabled: true, order: 1.5 },
    { page_name: 'OtherReptiles', display_name: 'Other Reptiles', icon: 'UsersRound', category: 'collection', requires_auth: true, is_enabled: true, order: 2 },
    { page_name: 'Breeding', display_name: 'Breeding', icon: 'Egg', category: 'collection', requires_auth: true, is_enabled: true, order: 3 },
    { page_name: 'BreedingSeason', display_name: 'Season Timeline', icon: 'CalendarRange', category: 'collection', requires_auth: true, is_enabled: true, order: 3.5 },
    { page_name: 'PairingPlanner', display_name: 'Pairing Planner', icon: 'Dna', category: 'collection', requires_auth: true, is_enabled: true, order: 3.7 },
    { page_name: 'Lineage', display_name: 'Lineage', icon: 'GitBranch', category: 'collection', requires_auth: true, is_enabled: true, order: 4 },
    { page_name: 'Portfolio', display_name: 'Portfolio', icon: 'BarChart3', category: 'collection', requires_auth: true, is_enabled: true, order: 4.5 },
    { page_name: 'Promote', display_name: 'Promote', icon: 'Sparkles', category: 'collection', requires_auth: true, is_enabled: true, order: 5 },
    { page_name: 'CareGuide', display_name: 'Care Guide', icon: 'Heart', category: 'collection', requires_auth: false, is_enabled: true, order: 7 },
    { page_name: 'Forum', display_name: 'Forum', icon: 'MessageSquare', category: 'collection', requires_auth: false, is_enabled: true, order: 8 },
  ],
  tools: [
    { page_name: 'Recognition', display_name: 'Morph ID', icon: 'Search', category: 'tools', requires_auth: false, is_enabled: true, order: 1 },
    { page_name: 'MorphGuide', display_name: 'Morph Guide', icon: 'BookOpen', category: 'tools', requires_auth: false, is_enabled: true, order: 3 },
    { page_name: 'GeneticsGuide', display_name: 'Genetics Guide', icon: 'Dna', category: 'tools', requires_auth: false, is_enabled: true, order: 4 },
    { page_name: 'Gallery', display_name: 'Image Gallery', icon: 'Images', category: 'tools', requires_auth: false, is_enabled: true, order: 5 },
    { page_name: 'BreederConsultant', display_name: 'AI Consultant', icon: 'FlaskConical', category: 'tools', requires_auth: false, is_enabled: true, order: 6 },
    { page_name: 'ProjectManager', display_name: 'Season Planner', icon: 'CalendarDays', category: 'tools', requires_auth: true, is_enabled: true, order: 7 },
  ],
  public: [
    { page_name: 'Dashboard', display_name: 'Dashboard', icon: 'BarChart3', category: 'public', requires_auth: false, is_enabled: true, order: 1 },
    { page_name: 'Market', display_name: 'Market', icon: 'TrendingUp', category: 'public', requires_auth: true, is_enabled: true, order: 1.5 },
    { page_name: 'Marketplace', display_name: 'Marketplace', icon: 'ShoppingCart', category: 'public', requires_auth: false, is_enabled: true, order: 2 },
    { page_name: 'MarketplaceSalesStats', display_name: 'Business Tools', icon: 'BarChart3', category: 'public', requires_auth: true, is_enabled: true, order: 3 },
  ],
};

// Order-independent: page -> section.
const EXPECTED_SECTION = {
  MyGeckos: 'manage', OtherReptiles: 'manage', Breeding: 'manage', BreedingPairs: 'manage',
  BreedingSeason: 'manage', PairingPlanner: 'manage', FieldMode: 'manage', Portfolio: 'manage',
  Lineage: 'manage', Pedigree: 'manage', GeckoDetail: 'manage', AnimalPassport: 'manage',
  ClaimAnimal: 'manage', LikedGeckos: 'manage', ProjectManager: 'manage', MarketplaceSalesStats: 'manage',
  MyListings: 'manage',
  BatchHusbandry: 'manage', Store: 'manage', MarketplaceSell: 'manage', Promote: 'manage',
  Recognition: 'discover', MorphGuide: 'discover', MorphGuideSubmission: 'discover',
  GeneticsGuide: 'discover', GeneticCalculatorTool: 'discover', Gallery: 'discover', CareGuide: 'discover',
  CareGuideTopic: 'discover', Forum: 'discover', ForumPost: 'discover', BreederConsultant: 'discover',
  PrintableWorksheets: 'discover', ImageImport: 'discover',
  Training: 'discover', Marketplace: 'discover', MarketplaceBuy: 'discover',
  MarketplaceVerification: 'discover', MarketPricing: 'discover', BreedingROI: 'discover',
  Market: 'discover',
  Breeder: 'discover',
};

const EXPECTED_BREEDER_ONLY = [
  'Breeding', 'BreedingSeason', 'PairingPlanner', 'Portfolio', 'BreedingPairs', 'Lineage',
  'Pedigree', 'Promote', 'MarketplaceSalesStats', 'MyListings',
  'BatchHusbandry', 'ProjectManager', 'MorphMarketExport', 'BreedingROI',
];

// The palette rows in their original display order (icons compared
// separately since they resolve to components).
const EXPECTED_PALETTE = [
  ['Dashboard', 'Dashboard', 'Your Collection'],
  ['MyGeckos', 'My Geckos', 'Your Collection'],
  ['MyProfile', 'My Profile', 'Your Collection'],
  ['OtherReptiles', 'Other Reptiles', 'Your Collection'],
  ['BatchHusbandry', 'Batch Husbandry', 'Your Collection'],
  ['ImageImport', 'AI Image Import', 'Your Collection'],
  ['PrintableWorksheets', 'Printable Worksheets', 'Your Collection'],
  ['Breeding', 'Breeding Plans', 'Breeding'],
  ['BreedingPairs', 'Breeding Pairs', 'Breeding'],
  ['Lineage', 'Lineage Tree', 'Breeding'],
  ['Pedigree', 'Pedigree', 'Breeding'],
  ['MarketplaceSalesStats', 'Business Tools', 'Breeding'],
  ['ProjectManager', 'Project Manager', 'Breeding'],
  ['Gallery', 'Community Gallery', 'Community'],
  ['LikedGeckos', 'Liked Geckos', 'Community'],
  ['Forum', 'Forum', 'Community'],
  ['Messages', 'Messages', 'Community'],
  ['Notifications', 'Notifications', 'Community'],
  ['Market', 'Market Today', 'Marketplace'],
  ['Marketplace', 'Marketplace', 'Marketplace'],
  ['MarketplaceBuy', 'Buy Geckos', 'Marketplace'],
  ['MarketplaceSell', 'Sell Geckos', 'Marketplace'],
  ['MyListings', 'My Listings', 'Marketplace'],
  ['MorphGuide', 'Morph Guide', 'Reference'],
  ['GeneticsGuide', 'Genetics Guide', 'Reference'],
  ['CareGuide', 'Care Guide', 'Reference'],
  ['Recognition', 'AI Morph Recognition', 'Reference'],
  ['MorphGuideSubmission', 'Submit a Morph', 'Reference'],
  ['Settings', 'Settings', 'Account'],
  ['Membership', 'Membership', 'Account'],
];

describe('navItems derived structures preserve prior behavior', () => {
  it('FALLBACK_NAV_ITEMS matches the prior hand-maintained list (sorted by order)', () => {
    expect(FALLBACK_NAV_ITEMS).toEqual(EXPECTED_FALLBACK);
  });

  it('SECTION_FOR_PAGE matches the prior map', () => {
    expect(SECTION_FOR_PAGE).toEqual(EXPECTED_SECTION);
  });

  it('BREEDER_ONLY_PAGES matches the prior set', () => {
    expect([...BREEDER_ONLY_PAGES].sort()).toEqual([...EXPECTED_BREEDER_ONLY].sort());
  });

  it('command palette items match the prior list in order', () => {
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

describe('retired pages stay out of navigation', () => {
  it('no sidebar, section, keeper-mode or palette entry names a retired page', () => {
    const named = [
      ...Object.values(FALLBACK_NAV_ITEMS).flat().map((i) => i.page_name),
      ...Object.keys(SECTION_FOR_PAGE),
      ...BREEDER_ONLY_PAGES,
      ...PALETTE_ITEMS.map((i) => i.page),
    ];
    expect(named.filter((p) => RETIRED_PAGE_NAMES.has(p))).toEqual([]);
  });

  it('every retired page redirects to a live page, not to another retired one', () => {
    for (const { page, to } of RETIRED_PAGES) {
      expect(to.startsWith('/'), page).toBe(true);
      expect(RETIRED_PAGE_NAMES.has(to.slice(1)), page).toBe(false);
    }
  });
});
