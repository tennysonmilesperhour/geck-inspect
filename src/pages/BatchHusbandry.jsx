import { Navigate } from 'react-router-dom';

/**
 * Batch Husbandry became part of the log screen on 13 November 2026
 * (experience review WP-4: findings E1 and A7).
 *
 * It was one of six places to log care. It fed and weighed by feeding
 * group, but with no undo, no saving without a signal and no other day,
 * and in the demo it said "No feeding groups yet". The log screen
 * (src/pages/QuickLog.jsx) now does the same job with all of those: each
 * feeding group with "Mark all fed", then the geckos in no group.
 *
 * This page only forwards there, so the address, the menu entry and old
 * bookmarks keep working. `replace` keeps Back from bouncing on the
 * forward. Feeding groups are made and edited in the Season Planner
 * (/ProjectManager?tab=feeding), which the log screen links to when a
 * member has none.
 */
export default function BatchHusbandry() {
  return <Navigate to="/log?type=feeding&all=1" replace />;
}
