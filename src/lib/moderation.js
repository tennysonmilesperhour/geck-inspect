/**
 * Content reports and moderation (feature audit step 11, 3 Oct 2026).
 *
 * Members report an item with the Report button (ReportContent). Each
 * report is a row in public.content_reports. Admins work the queue in the
 * Admin Panel's Reports view, which can hide an item (invisible to everyone
 * but its owner and admins, enforced by the database), remove it, or
 * dismiss the report. See
 * supabase/migrations/20261003024242_content_reports_and_moderation.sql.
 */
import { supabase as defaultClient } from '@/lib/supabaseClient';

/** Every kind of item a member can report, with how the admin view names it. */
export const REPORT_TARGETS = {
  forum_post: { label: 'Forum post', canHide: true, canRemove: true, removeLabel: 'Delete post' },
  forum_comment: { label: 'Forum comment', canHide: true, canRemove: true, removeLabel: 'Delete comment' },
  gecko_image: { label: 'Gallery photo', canHide: true, canRemove: true, removeLabel: 'Delete photo' },
  gecko: { label: 'Listing', canHide: true, canRemove: true, removeLabel: 'Take off marketplace' },
  profile: { label: 'Profile', canHide: true, canRemove: true, removeLabel: 'Clear and make private' },
  breeder_page: { label: 'Breeder page', canHide: true, canRemove: true, removeLabel: 'Clear and hide' },
  store_page: { label: 'Store page', canHide: true, canRemove: true, removeLabel: 'Unpublish' },
  waitlist: { label: 'Waitlist', canHide: true, canRemove: true, removeLabel: 'Close and hide' },
  morph_photo: { label: 'Morph Guide photo', canHide: true, canRemove: true, removeLabel: 'Reject photo' },
  conversation: { label: 'Direct messages', canHide: false, canRemove: false, removeLabel: null },
};

export const REPORT_CATEGORIES = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or hate' },
  { value: 'misleading', label: 'Misleading listing or stolen photo' },
  { value: 'animal_welfare', label: 'Animal welfare concern' },
  { value: 'inappropriate', label: 'Inappropriate or explicit' },
  { value: 'other', label: 'Something else' },
];

/** Rows the database erases when an admin removes them (the rest are updated). */
const ERASED_ON_REMOVE = {
  forum_post: 'forum_posts',
  forum_comment: 'forum_comments',
  gecko_image: 'gecko_images',
};

export function isReportTarget(type) {
  return Object.prototype.hasOwnProperty.call(REPORT_TARGETS, type);
}

/**
 * Builds the row a member inserts. Throws with a plain message when the
 * report cannot be filed, so the dialog can show it.
 */
export function buildReport({ targetType, targetId, category = 'other', reason, excerpt = '', page = '' }) {
  if (!isReportTarget(targetType)) throw new Error('This item cannot be reported.');
  const id = targetId == null ? '' : String(targetId).trim();
  if (!id) throw new Error('This item cannot be reported.');
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (!text) throw new Error('Please describe the problem.');
  const cat = REPORT_CATEGORIES.some((c) => c.value === category) ? category : 'other';
  return {
    target_type: targetType,
    target_id: id.slice(0, 200),
    category: cat,
    reason: text.slice(0, 3000),
    excerpt: excerpt ? String(excerpt).slice(0, 3000) : null,
    page: page ? String(page).slice(0, 500) : null,
  };
}

/**
 * Files a report as the signed-in member. A second report of the same item
 * while the first is still open counts as already reported, not an error.
 * Returns { alreadyReported }.
 */
export async function submitReport(input, { client = defaultClient } = {}) {
  const row = buildReport(input);
  const { error } = await client.from('content_reports').insert(row);
  if (!error) return { alreadyReported: false };
  if (error.code === '23505') return { alreadyReported: true };
  throw new Error(error.message || 'The report was not saved.');
}

/**
 * Runs an admin action on a reported item: 'hide', 'unhide', 'remove' or
 * 'dismiss'. For forum posts, comments and gallery photos, "remove" erases
 * the row here first (a forum post takes its comments with it), then the
 * database function closes the reports.
 */
export async function moderateContent(targetType, targetId, action, { client = defaultClient } = {}) {
  if (!isReportTarget(targetType)) throw new Error('Unknown content type.');
  if (!['hide', 'unhide', 'remove', 'dismiss'].includes(action)) throw new Error('Unknown action.');
  if (action === 'remove' && ERASED_ON_REMOVE[targetType]) {
    if (targetType === 'forum_post') {
      const { error: commentsError } = await client.from('forum_comments').delete().eq('post_id', targetId);
      if (commentsError) throw new Error(commentsError.message);
    }
    const { error } = await client.from(ERASED_ON_REMOVE[targetType]).delete().eq('id', targetId);
    if (error) throw new Error(error.message);
  }
  const { data, error } = await client.rpc('moderate_content', {
    p_target_type: targetType,
    p_target_id: String(targetId),
    p_action: action,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Where the admin view's "Open" link goes for a report. */
export function reportTargetLink(report) {
  const id = encodeURIComponent(report?.target_id || '');
  const t = report?.target || {};
  const slug = t.slug ? encodeURIComponent(t.slug) : '';
  switch (report?.target_type) {
    case 'forum_post': return `/ForumPost?id=${id}`;
    case 'forum_comment': return t.post_id ? `/ForumPost?id=${encodeURIComponent(t.post_id)}` : '/Forum';
    case 'gecko_image': return '/Gallery';
    case 'gecko': return t.passport_code ? `/passport/${encodeURIComponent(t.passport_code)}` : `/GeckoDetail?id=${id}`;
    case 'profile': return `/PublicProfile?userId=${id}`;
    case 'breeder_page': return slug ? `/Breeder/${slug}` : null;
    case 'store_page': return slug ? `/store/${slug}` : null;
    case 'waitlist': return slug ? `/waitlist/${slug}` : null;
    case 'morph_photo': return slug ? `/MorphGuide/${slug}` : '/MorphGuide';
    case 'conversation': return '/Messages';
    default: return null;
  }
}

const OWNER_FIELDS = ['created_by', 'owner_email', 'user_email', 'submitted_by_email', 'actor_email', 'author_email'];
const OWNER_ID_FIELDS = ['owner_profile_id', 'actor_id', 'contributor_id', 'profile_id'];

/**
 * True when a row was published by a member the viewer blocked. `blocked`
 * is { emails: Set, profileIds: Set } (useBlockedMembers). Rows are matched
 * on any owner email column they carry, or on the owner's profile id when a
 * signed-out-safe read left the email out.
 */
export function isBlockedContent(blocked, row) {
  if (!blocked || !row) return false;
  const emails = blocked.emails;
  const ids = blocked.profileIds;
  if (emails?.size) {
    for (const f of OWNER_FIELDS) {
      const v = row[f];
      if (typeof v === 'string' && (emails.has(v) || emails.has(v.toLowerCase()))) return true;
    }
  }
  if (ids?.size) {
    for (const f of OWNER_ID_FIELDS) {
      const v = row[f];
      if (v != null && ids.has(String(v))) return true;
    }
  }
  return false;
}
