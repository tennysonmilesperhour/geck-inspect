// User.setWeeklyNotes (src/entities/all.js): the Settings switch for Weekly
// Gecko Notes saves one column, on the member's own profile row, and
// nothing else. The whole-form save (updateMyUserData) never carries it.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ calls: [], answer: { data: [{ email: 'sam@example.com' }], error: null }, user: { id: 'u1', email: 'sam@example.com' } }));

vi.mock('@/lib/supabaseLazy', () => {
  const chain = {
    update(values) { fx.calls.push(['update', values]); return chain; },
    eq(col, val) { fx.calls.push(['eq', col, val]); return chain; },
    select(cols) { fx.calls.push(['select', cols]); return Promise.resolve(fx.answer); },
  };
  return { getSupabase: async () => ({ from: (table) => { fx.calls.push(['from', table]); return chain; } }) };
});
vi.mock('@/lib/userProfile', () => ({
  currentAuthUser: async () => fx.user,
  loadUserProfile: async () => null,
}));
vi.mock('@/lib/telemetry', () => ({ reportError: () => {} }));

import { User } from '@/entities/all';

beforeEach(() => {
  fx.calls = [];
  fx.answer = { data: [{ email: 'sam@example.com' }], error: null };
  fx.user = { id: 'u1', email: 'sam@example.com' };
});

describe('User.setWeeklyNotes', () => {
  it('updates only email_weekly_notes_enabled (and updated_date) on the member\'s own row', async () => {
    expect(await User.setWeeklyNotes(false)).toBe(false);
    expect(fx.calls[0]).toEqual(['from', 'profiles']);
    expect(fx.calls[1][0]).toBe('update');
    expect(Object.keys(fx.calls[1][1]).sort()).toEqual(['email_weekly_notes_enabled', 'updated_date']);
    expect(fx.calls[1][1].email_weekly_notes_enabled).toBe(false);
    expect(fx.calls[2]).toEqual(['eq', 'email', 'sam@example.com']);
    expect(await User.setWeeklyNotes(true)).toBe(true);
    expect(fx.calls[5][1].email_weekly_notes_enabled).toBe(true);
  });

  it('passes a PostgREST error on as is, so the switch can say "Not available yet"', async () => {
    fx.answer = { data: null, error: { code: 'PGRST204', message: "Could not find the 'email_weekly_notes_enabled' column" } };
    await expect(User.setWeeklyNotes(false)).rejects.toMatchObject({ code: 'PGRST204' });
  });

  it('refuses when no row was changed, or nobody is signed in', async () => {
    fx.answer = { data: [], error: null };
    await expect(User.setWeeklyNotes(false)).rejects.toThrow(/not found/);
    fx.user = null;
    await expect(User.setWeeklyNotes(false)).rejects.toThrow(/Sign in/);
  });
});
