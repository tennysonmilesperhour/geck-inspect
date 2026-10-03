/**
 * Support tickets as a member sees them: their own messages to the team,
 * the status, and the team's replies (support_replies).
 */
import { SupportMessage } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';

/** Words a member sees for each ticket status. */
export const MEMBER_STATUS_LABELS = {
    new: 'Received',
    in_progress: 'Being looked at',
    resolved: 'Resolved',
    archived: 'Closed',
};

export const SUPPORT_REPLY_NOTIFICATION_TYPE = 'support_reply';

/**
 * The part of a ticket's text that is safe and useful to show back to the
 * member who sent it. Content reports carry moderation details (the
 * reported author's email, record ids), so only the reason is shown.
 */
export function memberFacingBody(ticket) {
    const body = String(ticket?.body || '');
    if (String(ticket?.subject || '').startsWith('Content report')) {
        const reason = body.match(/^Reason:\s*(.*)$/m);
        return reason ? reason[1].trim() : '';
    }
    return body;
}

/** Ticket subject in member words ("Content report: forum_post" reads as a report). */
export function memberFacingSubject(ticket) {
    const subject = String(ticket?.subject || 'Support message');
    if (subject.startsWith('Content report')) {
        const kind = subject.split(':')[1]?.trim().replace(/_/g, ' ');
        return kind ? `Your report about a ${kind}` : 'Your report';
    }
    return subject;
}

/**
 * The member's most recent tickets with their replies, newest first.
 * @returns {Promise<Array<object & { replies: object[] }>>}
 */
export async function loadMySupportTickets(email, limit = 20) {
    if (!email) return [];
    const tickets = await SupportMessage.filter({ user_email: email }, '-created_date', limit);
    if (tickets.length === 0) return [];
    const ids = tickets.map((t) => t.id);
    const { data: replies, error } = await supabase
        .from('support_replies')
        .select('id, message_id, body, created_at')
        .in('message_id', ids)
        .order('created_at', { ascending: true });
    if (error) throw error;
    const byTicket = {};
    for (const r of replies || []) (byTicket[r.message_id] ||= []).push(r);
    return tickets.map((t) => ({ ...t, replies: byTicket[t.id] || [] }));
}

/** Replies on one ticket, oldest first (admin inbox). */
export async function loadTicketReplies(messageId) {
    const { data, error } = await supabase
        .from('support_replies')
        .select('id, message_id, body, created_at')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

/** Save an admin reply on a ticket. Admin only (enforced by the database). */
export async function addTicketReply(messageId, body) {
    const { data, error } = await supabase
        .from('support_replies')
        .insert({ message_id: messageId, body })
        .select('id, message_id, body, created_at')
        .single();
    if (error) throw error;
    return data;
}

/** Notification text for the member when the team replies. */
export function supportReplyNotificationContent(ticket, replyBody) {
    const subject = memberFacingSubject(ticket);
    const excerpt = String(replyBody || '').replace(/\s+/g, ' ').trim();
    const short = excerpt.length > 140 ? `${excerpt.slice(0, 137)}...` : excerpt;
    return `Geck Inspect support replied to "${subject}": ${short}`;
}
