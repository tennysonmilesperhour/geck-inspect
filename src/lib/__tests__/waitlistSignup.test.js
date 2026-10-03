import { describe, expect, it, vi } from 'vitest';
import { joinWaitlist, confirmWaitlist, confirmTokenFromSearch } from '../waitlistSignup';
import { orderedSignups, waitlistSummary } from '../pairingWaitlist';

describe('waitlist signup client', () => {
  it('reads only a well-formed confirm token', () => {
    const token = 'a'.repeat(64);
    expect(confirmTokenFromSearch(`?confirm=${token}`)).toBe(token);
    expect(confirmTokenFromSearch('?confirm=abc')).toBeNull();
    expect(confirmTokenFromSearch('')).toBeNull();
  });

  it('sends the join and confirm actions to the edge function', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { status: 'check_email' }, error: null });
    const supabase = { functions: { invoke } };
    await joinWaitlist(supabase, { slug: 'lw-2027', name: ' Jane ', email: ' j@example.com ', acceptTerms: true });
    expect(invoke).toHaveBeenCalledWith('waitlist-signup', {
      body: { action: 'join', slug: 'lw-2027', name: 'Jane', email: 'j@example.com', wanted: null, notes: null, accept_terms: true },
    });
    await confirmWaitlist(supabase, 'b'.repeat(64));
    expect(invoke).toHaveBeenLastCalledWith('waitlist-signup', { body: { action: 'confirm', token: 'b'.repeat(64) } });
  });

  it('surfaces the plain-language error from the function body', async () => {
    const context = { text: async () => JSON.stringify({ error: 'This waitlist is full.' }) };
    const supabase = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: 'non-2xx', context } }) } };
    await expect(joinWaitlist(supabase, { slug: 's', name: 'a', email: 'b@c.de' })).rejects.toThrow('This waitlist is full.');
  });
});

describe('email confirmation in the breeder view', () => {
  it('an unconfirmed public signup holds no place until confirmed', () => {
    const rows = [
      { id: 'a', created_date: '2026-10-01T00:00:00Z', status: 'waiting' },
      { id: 'b', created_date: '2026-10-02T00:00:00Z', status: 'waiting', confirm_token_hash: 'x' },
      { id: 'c', created_date: '2026-10-03T00:00:00Z', status: 'waiting', confirm_token_hash: 'y', confirmed_at: '2026-10-03T01:00:00Z' },
    ];
    expect(orderedSignups(rows).map((s) => s.place)).toEqual([1, null, 2]);
    expect(waitlistSummary(rows).active).toBe(2);
  });
});
