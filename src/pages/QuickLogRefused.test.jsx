// The one-tap log page must not say "saved" for a log the server refused
// (engineering cleanup, 16 Oct 2026). The queue keeps a list of refused
// logs; this page reads it through useOfflineQueue().refused.
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = {
    self: null,
    top: null,
    history: { state: { idx: 0 } },
    location: { assign: () => {} },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  toast: vi.fn(),
  takeBack: vi.fn(() => 'removed'),
  leftQueue: vi.fn(() => false),
  dismiss: vi.fn(),
  setQueue: null,
  geckos: [],
}));

vi.mock('@/api/appClient', () => ({
  api: { auth: { me: async () => ({ email: 'keeper@example.test' }), endLocalSession: vi.fn() } },
}));
vi.mock('@/lib/fieldModeData', () => ({
  fieldModeQueryKey: (email) => ['field-mode', email || null],
  loadWritableGeckos: async () => mocks.geckos,
}));
vi.mock('@/lib/offlineSync', async () => {
  const { useState } = await vi.importActual('react');
  return {
    saveFieldLog: (...args) => mocks.save(...args),
    takeBackQueued: (...args) => mocks.takeBack(...args),
    hasLeftQueue: (...args) => mocks.leftQueue(...args),
    dismissRefusedLogs: (...args) => mocks.dismiss(...args),
    UNDO_SENT_MESSAGE: 'It has already synced, so it was not undone.',
    UNDO_SYNCING_MESSAGE: 'It is being sent right now, so it was not undone.',
    useOfflineQueue: () => {
      const [state, setState] = useState({ pending: 1, online: true, refused: [] });
      mocks.setQueue = setState;
      return state;
    },
  };
});
vi.mock('@/lib/husbandryLog', async () => {
  const actual = await vi.importActual('@/lib/husbandryLog');
  return { ...actual, isAuthFailure: (error) => error?.status === 401, markGroupFed: vi.fn() };
});
vi.mock('@/entities/all', () => ({
  FeedingGroup: { get: vi.fn(async () => null) },
  FeedingRecord: { delete: vi.fn(), filter: vi.fn(async () => []) },
  Gecko: { update: vi.fn() },
  ShedRecord: { delete: vi.fn(), filter: vi.fn(async () => []) },
  WeightRecord: { delete: vi.fn(), filter: vi.fn(async () => []) },
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));

import QuickLog from './QuickLog';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));
const buttons = (tree, label) => tree.root.findAll((n) => n.type === 'button' && textOf(n).trim() === label);

async function open(url) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/log" element={<QuickLog />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await settle();
  await settle();
  return tree;
}

beforeEach(() => {
  mocks.geckos = [{ id: 'g2', name: 'Kiwi', feeding_group_id: null, weight_grams: 16 }];
  mocks.leftQueue.mockImplementation(() => false);
  mocks.takeBack.mockImplementation(() => 'removed');
  // No signal: the weigh-in is kept on the phone as queue item q1.
  mocks.save.mockImplementation(async (data) => ({ result: null, queued: { id: 'q1' }, data: { ...data, requestId: 'req-1' } }));
});
afterEach(() => { vi.clearAllMocks(); });

async function keepWeighIn(tree) {
  const input = tree.root.findByProps({ id: 'ql-w-g2' });
  await act(async () => { input.props.onChange({ target: { value: '18' } }); });
  const form = tree.root.findByType('form');
  await act(async () => { form.props.onSubmit({ preventDefault() {} }); });
  expect(textOf(tree.root)).toContain('18 g, kept on this phone');
}

describe('a kept log the server refused', () => {
  it('shows "not saved", not "saved", once the queue reports the refusal', async () => {
    const tree = await open('/log?type=weight&gecko=g2');
    await keepWeighIn(tree);

    // The queue sent it and the server refused it: the log has left the
    // queue (hasLeftQueue says true), and the refusal is listed.
    mocks.leftQueue.mockImplementation(() => true);
    await act(async () => {
      mocks.setQueue({ pending: 0, online: true, refused: [{ id: 'q1', kind: 'weight', geckoId: 'g2', grams: 18, error: { code: '42501' } }] });
    });
    await settle();

    const text = textOf(tree.root);
    expect(text).toContain('18 g, not saved');
    expect(text).not.toContain('18 g, saved');
    expect(text).toContain('You can no longer log for this gecko.');
    // No Undo for something that was never saved.
    expect(tree.root.findAll((n) => n.type === 'button' && textOf(n).includes('Undo'))).toHaveLength(0);
    await act(async () => tree.unmount());
  });

  it('a refusal without a known code gets the plain reason', async () => {
    const tree = await open('/log?type=weight&gecko=g2');
    await keepWeighIn(tree);
    mocks.leftQueue.mockImplementation(() => true);
    await act(async () => {
      mocks.setQueue({ pending: 0, online: true, refused: [{ id: 'q1', kind: 'weight', error: { code: '23503', message: 'violates foreign key' } }] });
    });
    await settle();
    const text = textOf(tree.root);
    expect(text).toContain('not saved');
    expect(text).toContain('for example because the gecko was deleted');
    expect(text).not.toContain('violates foreign key');
    await act(async () => tree.unmount());
  });

  it('"Log again" clears the refusal and brings the weight box back', async () => {
    const tree = await open('/log?type=weight&gecko=g2');
    await keepWeighIn(tree);
    mocks.leftQueue.mockImplementation(() => true);
    await act(async () => {
      mocks.setQueue({ pending: 0, online: true, refused: [{ id: 'q1', kind: 'weight', error: {} }] });
    });
    await settle();
    await act(async () => { buttons(tree, 'Log again')[0].props.onClick(); });
    expect(mocks.dismiss).toHaveBeenCalledWith(['q1']);
    expect(tree.root.findAllByProps({ id: 'ql-w-g2' }).length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
  });

  // Mark all used to count a refused gecko as still to do, log it again and
  // stop there when the server refused it again, leaving the rest unlogged.
  it('"Mark all" leaves out a gecko whose kept log was refused', async () => {
    mocks.geckos = [
      { id: 'g1', name: 'Alder', feeding_group_id: null },
      { id: 'g2', name: 'Kiwi', feeding_group_id: null },
      { id: 'g3', name: 'Mango', feeding_group_id: null },
    ];
    const tree = await open('/log?type=shed&gecko=g1,g2,g3');
    expect(buttons(tree, 'Log a shed for all 3')).toHaveLength(1);
    await act(async () => { buttons(tree, 'Shed today')[0].props.onClick(); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ kind: 'shed', geckoId: 'g1' });

    mocks.leftQueue.mockImplementation(() => true);
    await act(async () => {
      mocks.setQueue({ pending: 0, online: true, refused: [{ id: 'q1', kind: 'shed', geckoId: 'g1', error: { code: '42501' } }] });
    });
    await settle();
    expect(textOf(tree.root)).toContain('Shed logged, not saved');
    expect(buttons(tree, 'Log a shed for all 3')).toHaveLength(0);
    const markAll = buttons(tree, 'Log a shed for all 2');
    expect(markAll).toHaveLength(1);

    mocks.save.mockClear();
    let n = 1;
    mocks.save.mockImplementation(async (data) => ({ result: {}, queued: null, data: { ...data, requestId: `req-${++n}` } }));
    await act(async () => { await markAll[0].props.onClick(); });
    await settle();
    expect(mocks.save.mock.calls.map(([data]) => data.geckoId)).toEqual(['g2', 'g3']);
    // The refused one still waits for "Log again".
    expect(textOf(tree.root)).toContain('Shed logged, not saved');
    expect(buttons(tree, 'Log again')).toHaveLength(1);
    await act(async () => tree.unmount());
  });

  it('a kept log that was saved still says "saved"', async () => {
    const tree = await open('/log?type=weight&gecko=g2');
    await keepWeighIn(tree);
    mocks.leftQueue.mockImplementation(() => true);
    await act(async () => { mocks.setQueue({ pending: 0, online: true, refused: [] }); });
    await settle();
    expect(textOf(tree.root)).toContain('18 g, saved');
    expect(textOf(tree.root)).not.toContain('not saved');
    await act(async () => tree.unmount());
  });
});
