import { describe, expect, it } from 'vitest';
import { existingSeatFor, invitePlan, isInviteExpired, reopenedInviteFields, tokenForResend } from '../collectionInvites';

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

describe('an invitation whose link has expired', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const expired = { id: 'x', member_email: 'late@example.com', role: 'editor', status: 'pending',
    invite_token: 'old-token', expires_at: '2026-10-01T00:00:00Z' };
  const fresh = { ...expired, id: 'f', member_email: 'fresh@example.com', expires_at: '2026-11-01T00:00:00Z' };

  it('is expired only while pending and past its date', () => {
    expect(isInviteExpired(expired, now)).toBe(true);
    expect(isInviteExpired(fresh, now)).toBe(false);
    expect(isInviteExpired({ ...expired, status: 'accepted' }, now)).toBe(false);
    expect(isInviteExpired({ ...expired, expires_at: null }, now)).toBe(false);
  });

  it('Invite reopens it with a new token instead of saying "use Resend"', () => {
    expect(invitePlan([expired], 'late@example.com', now)).toMatchObject({ action: 'reopen', seat: { id: 'x' } });
    expect(invitePlan([fresh], 'fresh@example.com', now)).toMatchObject({ action: 'exists' });
  });

  it('Resend issues and saves a new token, never the expired one', async () => {
    const saved = [];
    const result = await tokenForResend(expired, {
      update: async (id, fields) => { saved.push([id, fields]); },
      invitedBy: 'owner@example.com',
      makeToken: () => 'new-token',
      now,
    });
    expect(result).toEqual({ token: 'new-token', renewed: true });
    expect(saved).toEqual([['x', expect.objectContaining({
      status: 'pending', invite_token: 'new-token', role: 'editor', expires_at: '2026-11-15T12:00:00.000Z',
    })]]);
  });

  it('Resend sends a working link as it is, without saving anything', async () => {
    const update = async () => { throw new Error('should not save'); };
    const result = await tokenForResend(fresh, { update, invitedBy: 'owner@example.com', makeToken: () => 'unused', now });
    expect(result).toEqual({ token: 'old-token', renewed: false });
  });
});
