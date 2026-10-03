/**
 * Plain-language message for a collection invite that can no longer be
 * accepted or declined. `status` comes from get_collection_invite_preview()
 * ('accepted', 'declined', 'revoked', 'expired'), or 'missing' when the
 * link matches no invite.
 */
export function inviteStatusMessage(status) {
  switch (status) {
    case 'accepted':
      return 'This invitation has already been accepted. Open My Geckos to see the shared collection.';
    case 'declined':
      return 'This invitation was declined. Ask the owner to invite you again if you changed your mind.';
    case 'revoked':
      return 'The owner withdrew this invitation.';
    case 'expired':
      return 'This invitation has expired. Ask the owner to send a new one.';
    default:
      return 'This invitation link is not valid. Check that you opened the whole link from the email.';
  }
}
