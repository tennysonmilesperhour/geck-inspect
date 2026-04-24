// Canonical sidebar navigation list.
//
// Shared between Layout.jsx (which renders the sidebar and merges this
// with the PageConfig table) and Settings.jsx (which needs the full list
// of pages so the user can pick favorites). Kept as a plain data export
// so there's one source of truth for page_name / display_name / icon.

import {
  Database, BookOpen, BarChart3, Upload, Users, HeartHandshake, Layers,
  Search, Settings as SettingsIcon, Shield, MessageSquare, Heart,
  ShoppingCart, GitBranch, FlaskConical, Star, FolderKanban,
  GraduationCap, Dna, Egg, LayoutGrid, CircleUser, UsersRound, Images,
  Tag, CalendarDays, Sparkles, Truck, Wrench,
} from 'lucide-react';

// Top-level section tabs. Rendered as a desktop header bar and a mobile
// bottom bar. Each page belongs to exactly one section (see
// SECTION_FOR_PAGE below); the sidebar for the active section only
// shows pages that belong to it, which keeps the list short.
export const SECTIONS = [
  { id: 'care',   label: 'Animal Care', icon: 'Heart',        defaultPage: 'MyGeckos' },
  { id: 'morphs', label: 'Morph Zone',  icon: 'Dna',          defaultPage: 'Recognition' },
  { id: 'tools',  label: 'Tools',       icon: 'Wrench',       defaultPage: 'BreederConsultant' },
  { id: 'market', label: 'Marketplace', icon: 'ShoppingCart', defaultPage: 'Marketplace' },
];

// Map page_name -> section id. Pages not in this map are section-agnostic
// (Dashboard, MyProfile, Settings, etc.) and don't light up a section tab.
// Detail pages (e.g. ForumPost) inherit their parent section so the tab
// stays highlighted when the user drills in.
export const SECTION_FOR_PAGE = {
  MyGeckos: 'care',
  Breeding: 'care',
  BreedingPairs: 'care',
  Lineage: 'care',
  Pedigree: 'care',
  CareGuide: 'care',
  CareGuideTopic: 'care',
  Forum: 'care',
  ForumPost: 'care',
  BatchHusbandry: 'care',
  GeckoDetail: 'care',
  AnimalPassport: 'care',
  ClaimAnimal: 'care',
  LikedGeckos: 'care',

  Recognition: 'morphs',
  MorphVisualizer: 'morphs',
  MorphGuide: 'morphs',
  MorphGuideSubmission: 'morphs',
  GeneticsGuide: 'morphs',
  GeneticCalculatorTool: 'morphs',
  Gallery: 'morphs',

  BreederConsultant: 'tools',
  ProjectManager: 'tools',
  GeckAnswers: 'tools',
  PrintableWorksheets: 'tools',
  ImageImport: 'tools',
  Training: 'tools',
  TrainModel: 'tools',

  Marketplace: 'market',
  MarketplaceBuy: 'market',
  MarketplaceSell: 'market',
  MarketplaceSalesStats: 'market',
  MarketplaceVerification: 'market',
  MyListings: 'market',
  BreederShipping: 'market',
  BreederStorefront: 'market',
  Shipping: 'market',
  MarketPricing: 'market',
  BreedingROI: 'market',
  BreedingLoans: 'market',
  Giveaways: 'market',
  Breeder: 'market',
};

export function getSectionForPage(pageName) {
  return SECTION_FOR_PAGE[pageName] || null;
}

export const FALLBACK_NAV_ITEMS = {
  collection: [
    { page_name: "MyGeckos", display_name: "My Geckos", icon: "LayoutGrid", category: "collection", requires_auth: true, is_enabled: true, order: 1 },
    { page_name: "Breeding", display_name: "Breeding", icon: "Egg", category: "collection", requires_auth: true, is_enabled: true, order: 2 },
    { page_name: "Lineage", display_name: "Lineage", icon: "GitBranch", category: "collection", requires_auth: true, is_enabled: true, order: 3 },
    { page_name: "CareGuide", display_name: "Care Guide", icon: "Heart", category: "collection", requires_auth: false, is_enabled: true, order: 4 },
    { page_name: "Forum", display_name: "Forum", icon: "MessageSquare", category: "collection", requires_auth: false, is_enabled: true, order: 5 },
  ],
  tools: [
    { page_name: "Recognition", display_name: "Morph ID", icon: "Search", category: "tools", requires_auth: false, is_enabled: true, order: 1 },
    { page_name: "MorphVisualizer", display_name: "Morph Visualizer", icon: "Layers", category: "tools", requires_auth: false, is_enabled: true, order: 2 },
    { page_name: "MorphGuide", display_name: "Morph Guide", icon: "BookOpen", category: "tools", requires_auth: false, is_enabled: true, order: 3 },
    { page_name: "GeneticsGuide", display_name: "Genetics Guide", icon: "Dna", category: "tools", requires_auth: false, is_enabled: true, order: 4 },
    { page_name: "Gallery", display_name: "Image Gallery", icon: "Images", category: "tools", requires_auth: false, is_enabled: true, order: 5 },
    { page_name: "BreederConsultant", display_name: "AI Consultant", icon: "FlaskConical", category: "tools", requires_auth: false, is_enabled: true, order: 6 },
    { page_name: "ProjectManager", display_name: "Season Planner", icon: "CalendarDays", category: "tools", requires_auth: true, is_enabled: true, order: 7 },
  ],
  public: [
    { page_name: "Dashboard", display_name: "Dashboard", icon: "BarChart3", category: "public", requires_auth: false, is_enabled: true, order: 1 },
    { page_name: "Marketplace", display_name: "Marketplace", icon: "ShoppingCart", category: "public", requires_auth: false, is_enabled: true, order: 2 },
    { page_name: "MarketplaceSalesStats", display_name: "Business Tools", icon: "BarChart3", category: "public", requires_auth: true, is_enabled: true, order: 3 },
    { page_name: "BreederShipping", display_name: "Shipping", icon: "Truck", category: "public", requires_auth: true, is_enabled: true, order: 4 },
  ],
};

export const NAV_ICON_MAP = {
  BarChart3, Search, Layers, FlaskConical, BookOpen, Heart, MessageSquare,
  Database, ShoppingCart, Users, GitBranch, Upload, Shield, HeartHandshake,
  FolderKanban, Dna, GraduationCap, Star, Settings: SettingsIcon,
  Egg, LayoutGrid, CircleUser, UsersRound, Images, Tag, CalendarDays,
  Sparkles, Truck, Wrench,
};

export const FAVORITES_MAX = 4;

export function flattenNavItems(navItems) {
  return [
    ...(navItems.collection || []),
    ...(navItems.tools || []),
    ...(navItems.public || []),
  ];
}
