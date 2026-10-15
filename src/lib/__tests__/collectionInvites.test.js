import { describe, expect, it } from 'vitest';
import { existingSeatFor, invitePlan, reopenedInviteFields } from '../collectionInvites';

const seats = [
  { id: 'o', member_email: 'owner@example.com', role: 'owner', status: 'accepted' },
  { id: 'a', member_email: 'Accepted@Example.com', role: 'editor', status: 'accepted' },
  { id: 'p', member_email: 'pending@example.com', role: 'viewer', status: 'pending' },
  { id: 'd', member_email: 'left@example.com', role: 'viewer', status: 'declined' },
];

describe('inviting someone to a collection', () => {
  it('creates a new invitation for someone with no seat', () => {
    expect(invitePlan(seats, 'new@example.com')).toEqual({ action: 'create', seat: null });
  });

  it('reopens the seat of someone who left instead of adding a second row', () => {
    const plan = invitePlan(seats, ' LEFT@example.com ');
    expect(plan.action).toBe('reopen');
    expect(plan.seat.id).toBe('d');
  });

  it('does not invite someone already invited or in the collection', () => {
    expect(invitePlan(seats, 'accepted@example.com')).toMatchObject({ action: 'exists', seat: { id: 'a' } });
    expect(invitePlan(seats, 'pending@example.com')).toMatchObject({ action: 'exists', seat: { id: 'p' } });
  });

  it('never treats the owner seat as an invitation', () => {
    expect(existingSeatFor(seats, 'owner@example.com')).toBeNull();
  });

  it('reopens as a fresh pending invitation with a new token', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(reopenedInviteFields({ role: 'editor', token: 'tok-2', invitedBy: 'owner@example.com', now })).toEqual({
      role: 'editor',
      status: 'pending',
      invite_token: 'tok-2',
      invited_by_email: 'owner@example.com',
      invited_at: '2026-10-15T12:00:00.000Z',
      expires_at: '2026-11-14T12:00:00.000Z',
      accepted_at: null,
      declined_at: null,
    });
  });
});
