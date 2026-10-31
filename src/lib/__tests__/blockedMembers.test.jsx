// useBlockedMembers turns the caller's blocks into profile ids, because the
// rows other members read carry owner_profile_id, not an email (Part E item
// E1 4). It asks my_blocked_profile_ids, which finds every blocked member,
// public profile or not; read_profiles is the fallback while that function
// is not live yet. On 28 Oct 2026 83 of 161 profiles were not public, so
// read_profiles alone missed more than half of blocked members.
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [], blockedEmails: [], helper: null, fallback: null }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { email: 'reader@example.com' }, isGuest: false }) }));
vi.mock('@/lib/supabaseLazy', () => ({
  getSupabase: async () => ({
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: state.blockedEmails.map((e) => ({ blocked_email: e })) }) }) }),
    rpc: (name, args) => {
      state.calls.push(name);
      if (name === 'my_blocked_profile_ids') return Promise.resolve(state.helper);
      return { select: () => Promise.resolve(state.fallback(args)) };
    },
  }),
}));
import { useBlockedMembers } from '../../hooks/useBlockedAuthors';

let members, tree;
function Consumer() { members = useBlockedMembers(); return null; }
const settle = () => act(async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); });

beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  state.calls = [];
  state.blockedEmails = ['hidden.profile@example.com'];
  state.helper = { data: [{ id: 'p-hidden' }], error: null };
  state.fallback = () => ({ data: [], error: null });
});
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });

it('hides a blocked member whose profile is not public, by profile id', async () => {
  await act(async () => { tree = create(<Consumer />); });
  await settle();
  expect(state.calls).toEqual(['my_blocked_profile_ids']);
  expect(members.isBlocked({ owner_profile_id: 'p-hidden' })).toBe(true);
  expect(members.isBlocked({ owner_profile_id: 'p-other' })).toBe(false);
});

it('falls back to read_profiles while the helper is not live yet', async () => {
  state.helper = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
  state.fallback = (args) => ({ data: args.p_emails.map(() => ({ id: 'p-public', email: 'x' })), error: null });
  await act(async () => { tree = create(<Consumer />); });
  await settle();
  expect(state.calls).toEqual(['my_blocked_profile_ids', 'read_profiles']);
  expect(members.isBlocked({ owner_profile_id: 'p-public' })).toBe(true);
});

it('does not fall back on other errors, and blocks nothing it cannot confirm', async () => {
  state.helper = { data: null, error: { code: '500', message: 'server error' } };
  await act(async () => { tree = create(<Consumer />); });
  await settle();
  expect(state.calls).toEqual(['my_blocked_profile_ids']);
  expect(members.isBlocked({ owner_profile_id: 'p-hidden' })).toBe(false);
});
