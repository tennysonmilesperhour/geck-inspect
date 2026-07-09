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
} from 'lucide-react';

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
  Bell, Trophy, Mail,
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

/**
 * The registry. One row per page. Fields:
 *   page        route/page name (the id used everywhere else)
 *   section     'manage' | 'discover' | undefined (section tab membership)
 *   breederOnly true if hidden in Keeper mode
 *   sidebar     present if the page seeds the fallback sidebar. Shape:
 *                 { category:'collection'|'tools'|'public', order,
 *                   label, icon (string key), requiresAuth }
 *   palette     present if the page appears in the command palette. Shape:
 *                 { group, label, icon (string key), keywords[] }
 *
 * Order in this array only matters for the palette (items render in array
 * order, grouped by `group`); the sidebar sorts by the explicit `order`
 * field, and the section/breeder maps are order-independent. Palette rows
 * are therefore listed in their display order.
 */
export const NAV_REGISTRY = [
  // ----- Your Collection (palette) / Manage (section) -----
  {
    page: 'Dashboard', section: undefined,
    sidebar: { category: 'public', order: 1, label: 'Dashboard', icon: 'BarChart3', requiresAuth: false },
    palette: { group: 'Your Collection', label: 'Dashboard', icon: 'LayoutDashboard', keywords: ['home', 'overview', 'stats'] },
  },
  {
    page: 'MyGeckos', section: 'manage',
    sidebar: { category: 'collection', order: 1, label: 'My Geckos', icon: 'LayoutGrid', requiresAuth: true },
    palette: { group: 'Your Collection', label: 'My Geckos', icon: 'Users', keywords: ['collection', 'animals', 'list'] },
  },
  {
    page: 'MyProfile',
    palette: { group: 'Your Collection', label: 'My Profile', icon: 'Users', keywords: ['account', 'public profile'] },
  },
  {
    page: 'OtherReptiles', section: 'manage',
    sidebar: { category: 'collection', order: 2, label: 'Other Reptiles', icon: 'UsersRound', requiresAuth: true },
    palette: { group: 'Your Collection', label: 'Other Reptiles', icon: 'Users', keywords: ['leopard gecko', 'other animals'] },
  },
  {
    page: 'BatchHusbandry', section: 'manage', breederOnly: true,
    palette: { group: 'Your Collection', label: 'Batch Husbandry', icon: 'Users', keywords: ['bulk', 'feeding', 'weigh', 'group log'] },
  },
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
    palette: { group: 'Breeding', label: 'Breeding Plans', icon: 'GitBranch', keywords: ['pairings', 'projects', 'season'] },
  },
  {
    page: 'BreedingPairs', section: 'manage', breederOnly: true,
    palette: { group: 'Breeding', label: 'Breeding Pairs', icon: 'GitBranch', keywords: ['sire dam', 'match', 'pair'] },
  },
  {
    page: 'Lineage', section: 'manage', breederOnly: true,
    sidebar: { category: 'collection', order: 4, label: 'Lineage', icon: 'GitBranch', requiresAuth: true },
    palette: { group: 'Breeding', label: 'Lineage Tree', icon: 'GitBranch', keywords: ['family tree', 'ancestry'] },
  },
  {
    page: 'Pedigree', section: 'manage', breederOnly: true,
    palette: { group: 'Breeding', label: 'Pedigree', icon: 'GitBranch', keywords: ['pedigree', 'certificate', 'lineage record'] },
  },
  {
    page: 'BreedingROI', section: 'discover', breederOnly: true,
    palette: { group: 'Breeding', label: 'Breeding ROI', icon: 'FolderKanban', keywords: ['roi', 'profit', 'cost', 'revenue', 'money'] },
  },
  {
    page: 'BreedingLoans', section: 'discover', breederOnly: true,
    palette: { group: 'Breeding', label: 'Breeding Loans', icon: 'GitBranch', keywords: ['loan', 'co-own', 'lease', 'collab'] },
  },
  {
    page: 'ProjectManager', section: 'manage', breederOnly: true,
    sidebar: { category: 'tools', order: 7, label: 'Season Planner', icon: 'CalendarDays', requiresAuth: true },
    palette: { group: 'Breeding', label: 'Project Manager', icon: 'FolderKanban', keywords: ['tasks', 'goals'] },
  },
  {
    page: 'GeneticCalculatorTool', section: 'discover',
    palette: { group: 'Breeding', label: 'Genetic Calculator', icon: 'FlaskConical', keywords: ['punnett', 'offspring', 'traits'] },
  },

  // ----- Community (palette) -----
  {
    page: 'Gallery', section: 'discover',
    sidebar: { category: 'tools', order: 5, label: 'Image Gallery', icon: 'Images', requiresAuth: false },
    palette: { group: 'Community', label: 'Community Gallery', icon: 'Images', keywords: ['photos', 'feed', 'browse'] },
  },
  {
    page: 'LikedGeckos', section: 'manage',
    palette: { group: 'Community', label: 'Liked Geckos', icon: 'Heart', keywords: ['hearts', 'favorites'] },
  },
  {
    page: 'Forum', section: 'discover',
    sidebar: { category: 'collection', order: 8, label: 'Forum', icon: 'MessageSquare', requiresAuth: false },
    palette: { group: 'Community', label: 'Forum', icon: 'MessageSquare', keywords: ['discussion', 'posts'] },
  },
  {
    page: 'CommunityConnect',
    palette: { group: 'Community', label: 'Community Connect', icon: 'Users', keywords: ['social', 'directory'] },
  },
  {
    page: 'Messages',
    palette: { group: 'Community', label: 'Messages', icon: 'Mail', keywords: ['dm', 'inbox', 'chat'] },
  },
  {
    page: 'Notifications',
    palette: { group: 'Community', label: 'Notifications', icon: 'Bell', keywords: ['alerts'] },
  },

  // ----- Marketplace (palette) -----
  {
    page: 'Marketplace', section: 'discover',
    sidebar: { category: 'public', order: 2, label: 'Marketplace', icon: 'ShoppingCart', requiresAuth: false },
    palette: { group: 'Marketplace', label: 'Marketplace', icon: 'ShoppingCart', keywords: ['buy', 'shop', 'store'] },
  },
  {
    page: 'MarketplaceBuy', section: 'discover',
    palette: { group: 'Marketplace', label: 'Buy Geckos', icon: 'ShoppingCart', keywords: ['purchase', 'for sale'] },
  },
  {
    page: 'MarketplaceSell', section: 'manage',
    palette: { group: 'Marketplace', label: 'Sell Geckos', icon: 'ShoppingCart', keywords: ['list', 'post'] },
  },
  {
    page: 'MyListings', section: 'manage', breederOnly: true,
    palette: { group: 'Marketplace', label: 'My Listings', icon: 'ShoppingCart', keywords: ['my sales'] },
  },

  // ----- Reference (palette) / Discover (section) -----
  {
    page: 'MorphGuide', section: 'discover',
    sidebar: { category: 'tools', order: 3, label: 'Morph Guide', icon: 'BookOpen', requiresAuth: false },
    palette: { group: 'Reference', label: 'Morph Guide', icon: 'Dna', keywords: ['morphs', 'harlequin', 'dalmatian', 'lilly white'] },
  },
  {
    page: 'MorphVisualizer', section: 'discover',
    sidebar: { category: 'tools', order: 2, label: 'Morph Visualizer', icon: 'Layers', requiresAuth: false },
    palette: { group: 'Reference', label: 'Morph Visualizer', icon: 'Sparkles', keywords: ['simulator', 'preview'] },
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
    palette: { group: 'Reference', label: 'AI Morph Recognition', icon: 'Sparkles', keywords: ['identify', 'classify', 'scan'] },
  },
  {
    page: 'Training', section: 'discover',
    palette: { group: 'Reference', label: 'Train the AI Model', icon: 'GraduationCap', keywords: ['label', 'tag', 'annotate'] },
  },
  {
    page: 'GeckAnswers', section: 'discover',
    palette: { group: 'Reference', label: 'Geck Answers', icon: 'MessageSquare', keywords: ['q&a', 'questions', 'answers', 'ask'] },
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

  // ----- Sidebar-only fallback pages (not in the palette) -----
  { page: 'BreedingSeason', section: 'manage', breederOnly: true,
    sidebar: { category: 'collection', order: 3.5, label: 'Season Timeline', icon: 'CalendarRange', requiresAuth: true } },
  { page: 'PairingPlanner', section: 'manage', breederOnly: true,
    sidebar: { category: 'collection', order: 3.7, label: 'Pairing Planner', icon: 'Dna', requiresAuth: true } },
  { page: 'FieldMode', section: 'manage',
    sidebar: { category: 'collection', order: 1.5, label: 'Field Mode', icon: 'Wrench', requiresAuth: true } },
  { page: 'Portfolio', section: 'manage', breederOnly: true,
    sidebar: { category: 'collection', order: 4.5, label: 'Portfolio', icon: 'BarChart3', requiresAuth: true } },
  { page: 'Promote', section: 'manage', breederOnly: true,
    sidebar: { category: 'collection', order: 5, label: 'Promote', icon: 'Sparkles', requiresAuth: true } },
  { page: 'Store', section: 'manage',
    sidebar: { category: 'collection', order: 6, label: 'Supplies', icon: 'Store', requiresAuth: false } },
  { page: 'BreederConsultant', section: 'discover',
    sidebar: { category: 'tools', order: 6, label: 'AI Consultant', icon: 'FlaskConical', requiresAuth: false } },
  { page: 'Mentorship', section: 'discover',
    sidebar: { category: 'tools', order: 6.5, label: 'Mentorship', icon: 'GraduationCap', requiresAuth: false } },
  { page: 'MarketplaceSalesStats', section: 'manage', breederOnly: true,
    sidebar: { category: 'public', order: 3, label: 'Business Tools', icon: 'BarChart3', requiresAuth: true } },
  { page: 'BreederShipping', section: 'manage', breederOnly: true,
    sidebar: { category: 'public', order: 4, label: 'Shipping', icon: 'Truck', requiresAuth: true } },

  // ----- Section-only pages (routed, section-assigned, no sidebar/palette) -----
  { page: 'GeckoDetail', section: 'manage' },
  { page: 'AnimalPassport', section: 'manage' },
  { page: 'ClaimAnimal', section: 'manage' },
  { page: 'Shipping', section: 'manage' },
  { page: 'MorphMarketExport', breederOnly: true },
  { page: 'CareGuideTopic', section: 'discover' },
  { page: 'ForumPost', section: 'discover' },
  { page: 'TrainModel', section: 'discover' },
  { page: 'MarketplaceVerification', section: 'discover' },
  { page: 'MarketPricing', section: 'discover' },
  { page: 'Giveaways', section: 'discover' },
  { page: 'Breeder', section: 'discover' },
];

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
  icon: NAV_ICON_MAP[e.palette.icon],
  section: e.palette.group,
  keywords: e.palette.keywords || [],
}));

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
