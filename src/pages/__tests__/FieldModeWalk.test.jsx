// @vitest-environment jsdom
// The rack walk in Field Mode (experience review E4, 13 Nov 2026): the
// list is in due order, "Next: <name>" moves on after a save with no trip
// back to the list, and leaving shows what the session came to.
import { configure, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  geckos: [],
  items: [],
  fed: [],
  weights: [],
  feedingUpdates: [],
}));

vi.mock('@/api/appClient', () => ({
  api: { auth: { me: async () => ({ id: 'u-1', email: 'sam@example.com' }), redirectToLogin: () => {} } },
}));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/fieldModeData', () => ({
  fieldModeQueryKey: (email) => ['field-mode', email || null],
  loadWritableGeckos: async () => fx.geckos.map((g) => ({ ...g })),
}));
vi.mock('@/lib/today', async (importOriginal) => ({
  ...(await importOriginal()),
  loadMemberToday: async (today) => ({ today, feedingReminders: true, weighInReminders: true, items: fx.items.map((i) => ({ ...i, due: i.due || today })) }),
}));
vi.mock('@/lib/husbandryLog', () => ({
  logFeedings: vi.fn(async ({ entries }) => {
    fx.fed.push(entries[0].gecko.id);
    return { records: [{ id: `f-${fx.fed.length}` }], advanced: [], groupErrors: [] };
  }),
  undoFeedings: vi.fn(async () => {}),
  advanceGroupsForFeedings: vi.fn(async () => ({ advanced: [] })),
  revertGroupAdvances: vi.fn(async () => {}),
  logShed: vi.fn(async () => ({ id: 's-1' })),
  isAuthFailure: () => false,
  careLogErrorText: () => 'Please try again in a minute.',
}));
vi.mock('@/entities/all', () => ({
  Gecko: { update: vi.fn(async () => ({})) },
  WeightRecord: {
    create: vi.fn(async (row) => { fx.weights.push(row); return { id: `w-${fx.weights.length}`, ...row }; }),
    delete: vi.fn(async () => {}),
    filter: vi.fn(async () => []),
  },
  ShedRecord: { delete: vi.fn(), update: vi.fn() },
  FeedingRecord: { update: vi.fn(async (id, patch) => { fx.feedingUpdates.push([id, patch]); }) },
  GeckoEvent: { create: vi.fn(async () => ({ id: 'e-1' })), delete: vi.fn() },
}));
vi.mock('@/lib/offlineSync', () => ({
  useOfflineQueue: () => ({ pending: 0, online: true, refused: [] }),
  dismissRefusedLogs: vi.fn(),
  queueFieldLog: vi.fn(),
  isDeviceOffline: () => false,
  isSyncing: () => false,
  undoQueuedLog: vi.fn(),
  UNDO_SYNCING_MESSAGE: 'It is being sent right now.',
}));
vi.mock('@/lib/offlineQueue', () => ({
  enqueue: vi.fn(),
  removeQueued: vi.fn(),
  updateQueued: vi.fn(),
  isNetworkError: () => false,
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));
vi.mock('@/components/shared/RefusedLogsNotice', () => ({ default: () => null }));

import FieldMode from '@/pages/FieldMode';

installDomHarness();
configure({ asyncUtilTimeout: 5000 });

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/FieldMode']}>
        <Routes>
          <Route path="/FieldMode" element={<FieldMode />} />
          <Route path="*" element={<p>Left Field Mode</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The list of geckos, by the name on each row.
const listed = () => screen.getAllByRole('button')
  .map((b) => b.querySelector('p.text-xl')?.textContent)
  .filter(Boolean);
const tap = (name) => userEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  fx.geckos = [
    { id: 'nimbus', name: 'Nimbus', feeding_group_id: null, weight_grams: 6 },
    { id: 'aria', name: 'Aria', feeding_group_id: 'rack-a', weight_grams: 42 },
    { id: 'mango', name: 'Mango', feeding_group_id: null, weight_grams: 38 },
    { id: 'ember', name: 'Ember', feeding_group_id: 'rack-a', weight_grams: 40 },
  ];
  // Rack A (Aria, Ember) is due for feeding; Nimbus and Mango are not.
  fx.items = [{ kind: 'feeding', key: 'group:rack-a', geckoId: null, groupId: 'rack-a', name: 'Rack A' }];
  fx.fed = [];
  fx.weights = [];
  fx.feedingUpdates = [];
});

describe('the rack walk', () => {
  it('lists what is due first, then everyone else by name', async () => {
    show();
    await screen.findByText('Aria');
    await screen.findAllByText('Due');
    expect(listed()).toEqual(['Aria', 'Ember', 'Mango', 'Nimbus']);
    expect(screen.getAllByText('Due')).toHaveLength(2);
  });

  it('offers "Next" after a save, follows the due order, and sums up the session on leaving', async () => {
    show();
    await screen.findAllByText('Due');
    await tap(/Aria/);
    // Nothing logged for Aria yet: no Next.
    expect(screen.queryByRole('button', { name: /^Next:/ })).toBeNull();

    await tap(/^Fed/);
    await tap('Next: Ember');
    expect(fx.fed).toEqual(['aria']);
    expect(screen.getByText('Ember')).toBeTruthy();

    // Ember refused: logged as fed, then switched in the Undo bar.
    await tap(/^Fed/);
    await tap('Accepted. Tap if refused');
    expect(fx.feedingUpdates).toEqual([['f-2', { accepted: false }]]);

    // The due ones are done, so Next goes on by name. A weigh-in for Mango.
    await tap('Next: Mango');
    await tap(/^Weight/);
    await tap('3');
    await tap('9');
    await tap('Save weight');
    expect(fx.weights).toEqual([expect.objectContaining({ gecko_id: 'mango', weight_grams: 39 })]);
    expect(await screen.findByRole('button', { name: 'Next: Nimbus' })).toBeTruthy();
    // The whole list stays one tap away.
    expect(screen.getByRole('button', { name: 'Pick another gecko' })).toBeTruthy();
    expect(screen.getByText('3 logs this session')).toBeTruthy();

    await tap('Exit field mode');
    expect(screen.getByText('1 fed, 1 weighed, 1 refused')).toBeTruthy();
    expect(screen.getByText(/3 geckos/)).toBeTruthy();

    // "Keep logging" goes back to the gecko in hand; the list marks the
    // ones already logged.
    await tap('Keep logging');
    await tap('Pick another gecko');
    expect(within(screen.getByRole('button', { name: /Aria/ })).getByText('Logged')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /Nimbus/ })).queryByText('Logged')).toBeNull();

    await tap('Exit field mode');
    await userEvent.click(screen.getByRole('link', { name: 'Done' }));
    expect(screen.getByText('Left Field Mode')).toBeTruthy();
  });

  it('leaves at once, with no summary, when nothing was logged', async () => {
    show();
    await screen.findByText('Aria');
    await userEvent.click(screen.getByRole('link', { name: 'Exit field mode' }));
    expect(screen.getByText('Left Field Mode')).toBeTruthy();
  });

  it('asks for a second tap when a weight is far from the last one', async () => {
    show();
    await screen.findByText('Aria');
    await tap(/Aria/);
    await tap(/^Weight/);
    // 420 for 42: a slipped decimal point.
    await tap('4');
    await tap('2');
    await tap('0');
    await tap('Save weight');
    expect(fx.weights).toEqual([]);
    expect(screen.getByRole('alert').textContent).toContain('That is a big change from 42 g');
    await tap('Save 420 g');
    expect(fx.weights).toEqual([expect.objectContaining({ gecko_id: 'aria', weight_grams: 420 })]);
  });
});
