/**
 * Gamification level thresholds used by Layout.jsx. Extracted from
 * src/Layout.jsx as part of the hairball cleanup.
 *
 * The old hand-kept navigation lists that lived here (publicNavItems,
 * userSpecificNavItems, adminOnlyNavItems) were not read anywhere and still
 * named retired pages, so they were removed on 16 Oct 2026. Navigation is
 * described once, in src/lib/navItems.js.
 */

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
