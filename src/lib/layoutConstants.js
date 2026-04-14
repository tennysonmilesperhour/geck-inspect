/**
 * Navigation items and gamification level thresholds used by Layout.jsx.
 * Extracted from src/Layout.jsx as part of the hairball cleanup.
 *
 * Exports factories instead of prebuilt arrays so createPageUrl() can be
 * called at call-site time (keeps this module free of circular imports).
 */

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
  Store,
} from 'lucide-react';
import { createPageUrl } from '@/utils';

// Always-visible primary navigation (shown to authed + anon).
export const publicNavItems = [
  { title: 'Dashboard',         url: createPageUrl('Dashboard'),         icon: BarChart3 },
  { title: 'Morph ID',          url: createPageUrl('Recognition'),       icon: Search },
  { title: 'Morph Visualizer',  url: createPageUrl('MorphVisualizer'),   icon: Layers },
  { title: 'AI Consultant',     url: createPageUrl('BreederConsultant'), icon: FlaskConical },
  { title: 'Morph Guide',       url: createPageUrl('MorphGuide'),        icon: BookOpen },
  { title: 'Care Guide',        url: createPageUrl('CareGuide'),         icon: Heart },
  { title: 'Forum',             url: createPageUrl('Forum'),             icon: MessageSquare },
  { title: 'Image Gallery',     url: createPageUrl('Gallery'),           icon: Database },
  { title: 'Marketplace',       url: createPageUrl('Marketplace'),       icon: ShoppingCart },
  { title: 'Geck Answers',      url: createPageUrl('GeckAnswers'),       icon: HelpCircle },
];

// User-only navigation, shown to signed-in users.
export const userSpecificNavItems = [
  { title: 'My Geckos',       url: createPageUrl('MyGeckos'),              icon: Users,       requiresAuth: true },
  { title: 'Breeding',        url: createPageUrl('Breeding'),              icon: GitBranch,   requiresAuth: true },
  { title: 'Breeding ROI',    url: createPageUrl('BreedingROI'),           icon: TrendingUp,  requiresAuth: true },
  { title: 'Breeding Loans',  url: createPageUrl('BreedingLoans'),         icon: Handshake,   requiresAuth: true },
  { title: 'Lineage',         url: createPageUrl('Lineage'),               icon: GitBranch,   requiresAuth: true },
  { title: 'Market Pricing',  url: createPageUrl('MarketPricing'),         icon: DollarSign,  requiresAuth: true },
  { title: 'Sales Stats',     url: createPageUrl('MarketplaceSalesStats'), icon: BarChart3,   requiresAuth: true },
  { title: 'Batch Husbandry', url: createPageUrl('BatchHusbandry'),        icon: Utensils,    requiresAuth: true },
  { title: 'Worksheets',      url: createPageUrl('PrintableWorksheets'),   icon: Printer,     requiresAuth: true },
  { title: 'My Storefront',   url: createPageUrl('BreederStorefront'),     icon: Store,       requiresAuth: true },
  { title: 'My Profile',      url: createPageUrl('MyProfile'),             icon: Users,       requiresAuth: true },
  { title: 'Train Model',     url: createPageUrl('Training'),              icon: Upload,      requiresAuth: true },
];

// Admin-only navigation.
export const adminOnlyNavItems = [
  { title: 'Admin Panel', url: createPageUrl('AdminPanel'), icon: Shield },
];

// Training milestone thresholds used by the sidebar progress widget.
export const MILESTONES = [
  { count: 1000,   title: 'Community Contributor', description: 'First major milestone reached!' },
  { count: 5000,   title: 'Expert Trainer',        description: 'Advanced AI training achieved!' },
  { count: 10000,  title: 'Master Classifier',     description: 'Professional-grade dataset!' },
  { count: 100000, title: 'AI Pioneer',            description: 'Revolutionary training dataset!' },
];

// Gamified "keeper" levels based on how many geckos the user tracks.
export const USER_LEVELS = [
  { geckos: 1,   title: 'New Collector',   badge: '🥚' },
  { geckos: 2,   title: 'Gecko Keeper',    badge: '🦎' },
  { geckos: 5,   title: 'Hobbyist',        badge: '🌿' },
  { geckos: 10,  title: 'Enthusiast',      badge: '⭐' },
  { geckos: 15,  title: 'Dedicated Keeper', badge: '🌱' },
  { geckos: 20,  title: 'Breeder',         badge: '❤️‍🔥' },
  { geckos: 30,  title: 'Pro Breeder',     badge: '🏆' },
  { geckos: 40,  title: 'Expert Breeder',  badge: '🧬' },
  { geckos: 50,  title: 'Master Breeder',  badge: '👑' },
  { geckos: 75,  title: 'Grandmaster',     badge: '🌌' },
  { geckos: 100, title: 'Living Legend',   badge: '💫' },
  { geckos: 150, title: 'Gecko Tycoon',    badge: '💼' },
  { geckos: 200, title: 'Scale Sovereign', badge: '🏰' },
  { geckos: 300, title: 'Reptile Royalty', badge: '⚜️' },
  { geckos: 500, title: 'Crested King',    badge: '🦁' },
];

// Image-tagging expert progression.
export const EXPERT_LEVELS = [
  { level: 1, title: 'Apprentice Trainer',   points: 10,  badge: '🌱' },
  { level: 2, title: 'Skilled Recognizer',   points: 50,  badge: '🧠' },
  { level: 3, title: 'Master Annotator',     points: 100, badge: '✍️' },
  { level: 4, title: 'AI Virtuoso',          points: 250, badge: '🤖' },
  { level: 5, title: 'Gecko AI Grandmaster', points: 500, badge: '🌟' },
];

// Forum / community participation progression.
export const COMMUNITY_LEVELS = [
  { level: 1, title: 'New Contributor',   points: 1,  badge: '📝' },
  { level: 2, title: 'Active Talker',     points: 5,  badge: '🗣️' },
  { level: 3, title: 'Forum Regular',     points: 10, badge: '💬' },
  { level: 4, title: 'Community Pillar',  points: 25, badge: '🏛️' },
  { level: 5, title: 'Gecko Guru',        points: 50, badge: '🎓' },
];
