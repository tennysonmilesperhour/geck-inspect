/**
 * Collection invitations: what an owner's "Invite" does for an address.
 *
 * The database keeps one membership row per person per collection
 * (collection_members_unique_invite), so a second invitation for someone
 * who left (status 'declined') cannot be a new row. Instead the declined
 * row is reopened as a fresh pending invitation with a new token. The
 * person still has to accept it; the database refuses an owner who tries
 * to mark it accepted.
 */

/** The existing seat for this address in the collection, if any (never the owner's own seat). */
export function existingSeatFor(memberships, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  return (memberships || []).find(
    (m) => m.role !== 'owner' && String(m.member_email || '').trim().toLowerCase() === target,
  ) || null;
}

/**
 * What to do for an invitation: 'create' a new row, 'reopen' a declined
 * seat (with `seat`), or 'exists' when the person is already invited or
 * a member.
 */
export function invitePlan(memberships, email) {
  const seat = existingSeatFor(memberships, email);
  if (!seat) return { action: 'create', seat: null };
  if (seat.status === 'declined') return { action: 'reopen', seat };
  return { action: 'exists', seat };
}

/** The fields that turn a declined seat back into a pending invitation. */
export function reopenedInviteFields({ role, token, invitedBy, now = new Date() }) {
  return {
    role,
    status: 'pending',
    invite_token: token,
    invited_by_email: invitedBy,
    invited_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * 86400 * 1000).toISOString(),
    accepted_at: null,
    declined_at: null,
  };
}
