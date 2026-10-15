/**
 * Notification reads and writes that must not scale with how many
 * notifications a member has ever had.
 *
 * The Notifications page used to load every row ever and mark them read
 * one request at a time. These helpers page the list and mark everything
 * read with a single update.
 */
import { Notification } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { isGuestMode } from '@/lib/guestMode';

export const NOTIFICATIONS_PAGE_SIZE = 30;

// Quiet rows. The nightly hatch job sends a member one hatch alert a day
// that counts all their eggs, and writes a quiet row (metadata.quiet =
// true, already read, never pushed or emailed) for each other egg, only so
// the app's hatch check (HatchAlertSystem.jsx) sees that egg as alerted.
// They are bookkeeping, not messages, so no list shows them.

/** True for a bookkeeping row that no notification list shows. */
export function isQuietNotification(row) {
    const quiet = row?.metadata?.quiet;
    return quiet === true || quiet === 'true';
}

/** Filter for Notification.filter: rows that are not quiet. */
export const NOT_QUIET_FILTER = Object.freeze({
    $or: [{ 'metadata->>quiet': null }, { 'metadata->>quiet': { $ne: 'true' } }],
});
// The same rule as a PostgREST "or" for direct queries.
const NOT_QUIET_OR = 'metadata->>quiet.is.null,metadata->>quiet.neq.true';

/**
 * One page of a member's notifications, newest first, without quiet rows.
 * Returns { rows, hasMore }.
 */
export async function fetchNotificationsPage(email, { offset = 0, limit = NOTIFICATIONS_PAGE_SIZE, unreadOnly = false } = {}) {
    if (!email) return { rows: [], hasMore: false };
    const filter = { user_email: email, ...NOT_QUIET_FILTER };
    if (unreadOnly) filter.is_read = false;
    // Ask for one extra row to learn whether another page exists.
    const rows = await Notification.filter(filter, '-created_date', limit + 1, offset);
    return { rows: rows.slice(0, limit).filter((row) => !isQuietNotification(row)), hasMore: rows.length > limit };
}

/** How many unread notifications a member has, without loading them. */
export async function countUnreadNotifications(email) {
    if (!email) return 0;
    if (isGuestMode()) {
        const rows = await Notification.filter({ user_email: email, is_read: false });
        return rows.filter((row) => !isQuietNotification(row)).length;
    }
    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email)
        .eq('is_read', false)
        .or(NOT_QUIET_OR);
    if (error) throw error;
    return count || 0;
}

// The hatch check looks back this far: an egg with a hatch alert row in
// that time (sent or quiet) is already alerted.
export const HATCH_ALERT_LOOKBACK_DAYS = 7;

/**
 * The egg ids a member's recent hatch alerts cover: each row's
 * metadata.egg_id, and every id in metadata.egg_ids (the day's grouped
 * alert lists all the eggs it counts). Rows older than `sinceMs` are
 * ignored.
 */
export function hatchAlertedEggIds(rows, sinceMs) {
    const ids = new Set();
    for (const row of rows || []) {
        const at = new Date(row?.created_date).getTime();
        if (!Number.isFinite(at) || at <= sinceMs) continue;
        const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        if (typeof meta.egg_id === 'string' && meta.egg_id) ids.add(meta.egg_id);
        if (Array.isArray(meta.egg_ids)) {
            for (const id of meta.egg_ids) {
                if (typeof id === 'string' && id) ids.add(id);
            }
        }
    }
    return ids;
}

/** Mark every unread notification for this member read, in one update. */
export async function markAllNotificationsRead(email) {
    if (!email || isGuestMode()) return;
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_date: new Date().toISOString() })
        .eq('user_email', email)
        .eq('is_read', false);
    if (error) throw error;
}

/**
 * True when a notification insert came back with no row because the
 * database dropped it as a repeat. guard_notification_insert returns
 * nothing (instead of raising) for a hatch alert on an egg that was
 * alerted in the last 20 hours, so `insert().select().single()` answers
 * PGRST116 ("0 rows"). The alert already went out, so the caller should
 * treat it as sent rather than retry on every poll.
 */
export function isDroppedRepeatNotification(error) {
    return error?.code === 'PGRST116';
}
