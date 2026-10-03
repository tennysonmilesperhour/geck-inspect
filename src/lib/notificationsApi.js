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

/**
 * One page of a member's notifications, newest first.
 * Returns { rows, hasMore }.
 */
export async function fetchNotificationsPage(email, { offset = 0, limit = NOTIFICATIONS_PAGE_SIZE, unreadOnly = false } = {}) {
    if (!email) return { rows: [], hasMore: false };
    const filter = { user_email: email };
    if (unreadOnly) filter.is_read = false;
    // Ask for one extra row to learn whether another page exists.
    const rows = await Notification.filter(filter, '-created_date', limit + 1, offset);
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** How many unread notifications a member has, without loading them. */
export async function countUnreadNotifications(email) {
    if (!email) return 0;
    if (isGuestMode()) {
        const rows = await Notification.filter({ user_email: email, is_read: false });
        return rows.length;
    }
    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email)
        .eq('is_read', false);
    if (error) throw error;
    return count || 0;
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
