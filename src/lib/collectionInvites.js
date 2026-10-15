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
 * True for a pending invitation whose link has run out (invitations last
 * 30 days). The database refuses to accept it, so sending the same link
 * again is useless: it needs a new token.
 */
export function isInviteExpired(seat, now = new Date()) {
  if (!seat || seat.status !== 'pending' || !seat.expires_at) return false;
  const expires = new Date(seat.expires_at);
  return !Number.isNaN(expires.getTime()) && expires.getTime() < now.getTime();
}

/**
 * What to do for an invitation: 'create' a new row, 'reopen' a declined
 * or expired seat (with `seat`), or 'exists' when the person is already
 * invited (and the link still works) or a member.
 */
export function invitePlan(memberships, email, now = new Date()) {
  const seat = existingSeatFor(memberships, email);
  if (!seat) return { action: 'create', seat: null };
  if (seat.status === 'declined' || isInviteExpired(seat, now)) return { action: 'reopen', seat };
  return { action: 'exists', seat };
}

/**
 * The token to send when the owner presses Resend. A link that still
 * works is sent again as it is. An expired one is replaced first: the
 * seat gets a new token and 30 more days (`update(id, fields)` saves
 * them), and the new token is returned. Before the October 2026 release Resend sent
 * the expired link, which the invited person could not use.
 */
export async function tokenForResend(seat, { update, invitedBy, makeToken, now = new Date() }) {
  if (!isInviteExpired(seat, now)) return { token: seat.invite_token, renewed: false };
  const token = makeToken();
  await update(seat.id, reopenedInviteFields({ role: seat.role, token, invitedBy, now }));
  return { token, renewed: true };
}

/** The fields that turn a declined or expired seat back into a pending invitation. */
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
