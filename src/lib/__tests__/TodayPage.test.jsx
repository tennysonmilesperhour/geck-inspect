import { act, create } from 'react-test-renderer';
import { MemoryRouter, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The Today screen (review item E3 25), rendered. Tests run in Node; the
// UI kit reads window.self at import time and the screen listens for
// "geckos_changed" on window.
const state = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null, addEventListener: () => {}, removeEventListener: () => {} });
  return { user: null, memberList: null };
});
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: state.user, isGuest: false, enterGuestMode: () => {} }),
}));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/offlineSync', () => ({ useOfflineQueue: () => ({ pending: 0, online: true }) }));
vi.mock('@/lib/offlineQueue', () => ({ readQueue: () => [] }));
vi.mock('@/lib/fieldModeData', () => ({ fieldModeQueryKey: (e) => ['fieldMode', e], loadWritableGeckos: async () => [] }));
vi.mock('@/lib/posthog', () => ({ captureEvent: () => {} }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));
vi.mock('@/lib/today', async (importOriginal) => ({
  ...(await importOriginal()),
  loadMemberToday: async () => state.memberList,
}));

import Today from '@/pages/Today';
import { addDays } from '@/lib/today';
import { todayLocalISO } from '@/lib/dateUtils';

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <MemoryRouter><Today /></MemoryRouter>
      </QueryClientProvider>,
    );
  });
  // Let the list query settle.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

let errors;
beforeEach(() => {
  state.user = null;
  state.memberList = null;
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errors.mockRestore());

describe('the Today screen', () => {
  it('signed out, shows the demo day with a way to sign in as well as to join', async () => {
    const tree = await mount();
    const links = tree.root.findAllByType(Link).map((l) => l.props.to);
    expect(links).toContain('/AuthPortal?mode=signup');
    expect(links).toContain('/AuthPortal');
    expect(JSON.stringify(tree.toJSON())).toContain('Already a member?');
    await act(async () => tree.unmount());
  });

  it('lists a gecko due a weigh-in and a feeding this week as two rows, with no key clash', async () => {
    const today = todayLocalISO();
    state.user = { email: 'keeper@example.com' };
    state.memberList = {
      today,
      feedingReminders: true,
      weighInReminders: true,
      items: [
        { kind: 'weigh_in', key: 'gecko:g1', geckoId: 'g1', groupId: null, name: 'Nimbus', due: addDays(today, 2), extra: {} },
        { kind: 'feeding', key: 'gecko:g1', geckoId: 'g1', groupId: null, name: 'Nimbus', due: addDays(today, 3), extra: {} },
      ],
    };
    const tree = await mount();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Weigh Nimbus');
    expect(text).toContain('Feed Nimbus');
    const keyWarnings = errors.mock.calls.filter((args) => String(args[0]).includes('same key'));
    expect(keyWarnings).toEqual([]);
    await act(async () => tree.unmount());
  });
});
