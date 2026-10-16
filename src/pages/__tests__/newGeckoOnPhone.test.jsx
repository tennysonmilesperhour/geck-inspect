// @vitest-environment jsdom
// A gecko added after the phone screens loaded the collection must show on
// them straight away: Today, the Log tab and the one-tap log (/log) share
// one copy of the collection (src/lib/fieldModeData.js), kept in this
// browser so it opens with no signal.
//
// Until 16 Oct 2026 adding a gecko did not mark that copy out of date, and
// the copy counted as fresh for two minutes (also when it had just been
// restored from storage on a reload). A new member who added a first gecko
// on a phone saw "Add your first gecko" on Today, and the Log tab's
// Feeding opened a log that said the gecko may have been sold. The app's
// own query client is used here, with its real two-minute default and its
// real 'geckos_changed' listener.
import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const EMAIL = 'sam@example.com';

const fx = vi.hoisted(() => ({
  user: null,
  geckos: [],
  // When set, the next collection load waits for this promise.
  gate: null,
  loads: 0,
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: fx.user, isGuest: false, enterGuestMode: () => {} }),
}));
vi.mock('@/api/appClient', () => ({
  api: { auth: { me: async () => fx.user, redirectToLogin: () => {}, endLocalSession: async () => ({}) } },
}));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/fieldModeData', () => ({
  fieldModeQueryKey: (email) => ['field-mode', email || null],
  loadWritableGeckos: async () => {
    fx.loads += 1;
    if (fx.gate) await fx.gate;
    return fx.geckos.map((g) => ({ ...g }));
  },
}));
vi.mock('@/lib/today', async (importOriginal) => ({
  ...(await importOriginal()),
  loadMemberToday: async (today) => ({ today, feedingReminders: true, weighInReminders: true, items: [] }),
}));
vi.mock('@/lib/offlineSync', () => ({
  useOfflineQueue: () => ({ pending: 0, online: true, refused: [] }),
  saveFieldLog: vi.fn(),
  takeBackQueued: vi.fn(),
  hasLeftQueue: () => false,
  dismissRefusedLogs: vi.fn(),
  UNDO_SENT_MESSAGE: '',
  UNDO_SYNCING_MESSAGE: '',
}));
vi.mock('@/lib/offlineQueue', () => ({ readQueue: () => [] }));
vi.mock('@/entities/all', () => ({
  FeedingGroup: { get: async () => null },
  FeedingRecord: {},
  Gecko: {},
  ShedRecord: {},
  WeightRecord: {},
}));
vi.mock('@/lib/husbandryLog', () => ({
  careLogErrorText: () => 'Not saved.',
  isAuthFailure: () => false,
  markGroupFed: vi.fn(),
  undoFeedings: vi.fn(),
}));
vi.mock('@/lib/postAuthRedirect', () => ({ rememberPostAuthRedirect: () => {} }));
vi.mock('@/lib/posthog', () => ({ captureEvent: () => {} }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));

import { queryClientInstance } from '@/lib/query-client';
import LogSheet from '@/components/navigation/LogSheet';
import QuickLog from '@/pages/QuickLog';
import Today from '@/pages/Today';

installDomHarness();

const MANGO = { id: 'g-mango', name: 'Mango', created_by: EMAIL, archived: false, status: 'Pet' };
const NIMBUS = { id: 'g-nimbus', name: 'Nimbus', created_by: EMAIL, archived: false, status: 'Holdback' };

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{`${loc.pathname}${loc.search}`}</output>;
}

function show(path, element) {
  return render(
    <QueryClientProvider client={queryClientInstance}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<>{element}<Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const where = () => screen.getByTestId('where').textContent;
const logIds = () => new URLSearchParams(where().split('?')[1] || '').get('gecko')?.split(',') || [];

// What every add path does once the gecko is saved (quickGeckoSave.js,
// FirstGeckoFlow.jsx, the full form and the CSV import in MyGeckos).
function addGecko(gecko) {
  fx.geckos = [...fx.geckos, gecko];
  act(() => {
    window.dispatchEvent(new CustomEvent('geckos_changed', { detail: { action: 'created' } }));
  });
}

// The copy loaded once, by the screen that opened first.
async function loadCopy(element = <Today />) {
  const view = show('/Today', element);
  await waitFor(() => expect(queryClientInstance.getQueryData(['field-mode', EMAIL])).toBeDefined());
  view.unmount();
}

beforeEach(() => {
  queryClientInstance.clear();
  fx.user = { id: 'u-1', email: EMAIL };
  fx.geckos = [];
  fx.gate = null;
  fx.loads = 0;
});
afterEach(() => {
  queryClientInstance.clear();
  onlineManager.setOnline(true);
});

describe('a gecko added on the phone', () => {
  it('shows on Today right away, with no "Add your first gecko"', async () => {
    await loadCopy();
    addGecko(MANGO);
    show('/Today', <Today />);
    expect(await screen.findByText('Mango')).toBeTruthy();
    expect(screen.queryByText('Add your first gecko')).toBeNull();
  });

  it('is in the Log tab\'s Feeding link right away', async () => {
    fx.geckos = [MANGO];
    await loadCopy();
    addGecko(NIMBUS);
    show('/Today', <LogSheet open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Feeding/ }));
    await waitFor(() => expect(where().startsWith('/log?type=feeding')).toBe(true));
    expect(logIds().sort()).toEqual(['g-mango', 'g-nimbus']);
  });

  it('opens on /log right away, not as "not in this collection"', async () => {
    fx.geckos = [MANGO];
    await loadCopy();
    addGecko(NIMBUS);
    show('/log?type=feeding&gecko=g-nimbus', <QuickLog />);
    expect(await screen.findByText('Nimbus')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fed' })).toBeTruthy();
    expect(screen.queryByText(/not in this collection/)).toBeNull();
  });

  it('shows after a reload too, when the copy restored from storage still looks fresh', async () => {
    // startQueryPersistence (src/lib/offlineCache.js) puts the stored copy
    // back with the time it was saved: a minute ago, so no event marks it.
    fx.geckos = [MANGO, NIMBUS];
    queryClientInstance.setQueryData(['field-mode', EMAIL], [{ ...MANGO }], { updatedAt: Date.now() - 60_000 });
    const view = show('/log?type=feeding&gecko=g-nimbus', <QuickLog />);
    expect(await screen.findByText('Nimbus')).toBeTruthy();
    view.unmount();
    queryClientInstance.setQueryData(['field-mode', EMAIL], [{ ...MANGO }], { updatedAt: Date.now() - 60_000 });
    show('/Today', <Today />);
    expect(await screen.findByText('Nimbus')).toBeTruthy();
  });
});

describe('the Log tab before the collection has loaded', () => {
  it('waits for the geckos instead of opening an empty log', async () => {
    fx.geckos = [MANGO];
    let release;
    fx.gate = new Promise((resolve) => { release = resolve; });
    show('/Settings', <LogSheet open onOpenChange={() => {}} />);
    expect((await screen.findAllByText('Loading your geckos')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Feeding/ }));
    expect(where()).toBe('/Settings');
    await act(async () => { release(); });
    await waitFor(() => expect(where().startsWith('/log?type=feeding')).toBe(true));
    expect(logIds()).toEqual(['g-mango']);
  });

  it('does not open the log when the sheet was closed during the wait', async () => {
    fx.geckos = [MANGO];
    let release;
    fx.gate = new Promise((resolve) => { release = resolve; });
    let closeSheet;
    function Tab() {
      const [open, setOpen] = useState(true);
      closeSheet = () => setOpen(false);
      return <LogSheet open={open} onOpenChange={setOpen} />;
    }
    show('/Settings', <Tab />);
    await userEvent.click(await screen.findByRole('button', { name: /Feeding/ }));
    act(() => closeSheet());
    await act(async () => { release(); });
    await waitFor(() => expect(queryClientInstance.getQueryData(['field-mode', EMAIL])).toBeDefined());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(where()).toBe('/Settings');
  });

  it('with no signal, opens at once with the copy the phone has', async () => {
    fx.geckos = [MANGO];
    await loadCopy();
    addGecko(NIMBUS);
    onlineManager.setOnline(false);
    show('/Today', <LogSheet open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Feeding/ }));
    await waitFor(() => expect(where().startsWith('/log?type=feeding')).toBe(true));
    expect(logIds()).toEqual(['g-mango']);
  });
});

describe('Today\'s "Your geckos"', () => {
  it('leaves out a gecko marked Sold, as the list and the Log tab do', async () => {
    fx.geckos = [MANGO, NIMBUS, { id: 'g-sold', name: 'Sold One', created_by: EMAIL, archived: false, status: 'Sold' }];
    show('/Today', <Today />);
    expect(await screen.findByText('Nimbus')).toBeTruthy();
    expect(screen.queryByText('Sold One')).toBeNull();
    expect(screen.getByText(/See all 2/)).toBeTruthy();
  });
});
