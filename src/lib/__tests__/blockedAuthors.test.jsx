import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ email: 'reader@example.com', response: null }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { email: state.email }, isGuest: false }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => state.response }) }) } }));
import { useBlockedAuthors } from '../../hooks/useBlockedAuthors';
let blocked, tree, events;
function Consumer() { blocked = useBlockedAuthors(); return null; }
beforeEach(() => {
  events = new EventTarget();
  vi.stubGlobal('window', events);
  state.email = 'reader@example.com'; state.response = Promise.resolve({ data: [] });
});
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });

it('refreshes visible-author filtering after a block or unblock event', async () => {
  await act(async () => { tree = create(<Consumer />); });
  expect(blocked.size).toBe(0);
  state.response = Promise.resolve({ data: [{ blocked_email: 'blocked@example.com' }] });
  await act(async () => events.dispatchEvent(new Event('user_blocks_changed')));
  expect(blocked.has('blocked@example.com')).toBe(true);
  state.response = Promise.resolve({ data: [] });
  await act(async () => events.dispatchEvent(new Event('user_blocks_changed')));
  expect(blocked.size).toBe(0);
});

it('ignores an old account’s delayed block list after switching accounts', async () => {
  let resolveOld;
  state.response = new Promise(resolve => { resolveOld = resolve; });
  await act(async () => { tree = create(<Consumer />); });
  state.email = 'next@example.com'; state.response = Promise.resolve({ data: [] });
  await act(async () => tree.update(<Consumer />));
  await act(async () => resolveOld({ data: [{ blocked_email: 'old-preference@example.com' }] }));
  expect(blocked.size).toBe(0);
});
