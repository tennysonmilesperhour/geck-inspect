import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A small stand-in for the browser window (the tests run in Node): the
// UI kit reads window.self at import, and the page reads history.state.
vi.hoisted(() => {
  globalThis.window = {
    self: null,
    top: null,
    history: { state: { idx: 0 } },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  toast: vi.fn(),
  removeQueued: vi.fn(),
  undoFeedings: vi.fn(async () => {}),
  geckos: [],
  me: null,
}));

vi.mock('@/api/appClient', () => ({
  api: { auth: { me: () => mocks.me(), redirectToLogin: vi.fn() } },
}));
vi.mock('@/lib/fieldModeData', () => ({
  fieldModeQueryKey: (email) => ['field-mode', email || null],
  loadWritableGeckos: async () => mocks.geckos,
}));
vi.mock('@/lib/offlineSync', () => ({
  saveFieldLog: (...args) => mocks.save(...args),
  useOfflineQueue: () => ({ pending: 0, online: true }),
}));
vi.mock('@/lib/offlineQueue', () => ({ removeQueued: (...args) => mocks.removeQueued(...args) }));
vi.mock('@/lib/husbandryLog', () => ({
  isAuthFailure: (error) => error?.status === 401,
  markGroupFed: vi.fn(),
  undoFeedings: (...args) => mocks.undoFeedings(...args),
}));
vi.mock('@/entities/all', () => ({
  FeedingGroup: { get: vi.fn(async (id) => ({ id, name: 'Rack A' })) },
  Gecko: { update: vi.fn() },
  ShedRecord: { delete: vi.fn() },
  WeightRecord: { delete: vi.fn() },
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));

import QuickLog from './QuickLog';
import { todayLocalISO } from '@/lib/dateUtils';

let here = null;
function Where() {
  const loc = useLocation();
  here = loc.pathname + loc.search;
  return null;
}

async function open(url) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/log" element={<QuickLog />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  // Let the auth check and the collection load settle.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));
const buttons = (tree, label) => tree.root.findAll((n) => n.type === 'button' && textOf(n).trim() === label);

beforeEach(() => {
  here = null;
  mocks.geckos = [
    { id: 'g1', name: 'Mango', feeding_group_id: 'grp', weight_grams: 16 },
    { id: 'g2', name: 'Kiwi', feeding_group_id: null, weight_grams: null },
  ];
  mocks.me = async () => ({ email: 'keeper@example.test' });
  mocks.save.mockImplementation(async (data) => ({ result: { records: [{ id: 'r1' }], advanced: [] }, queued: null, data }));
  window.history.state = { idx: 0 };
});
afterEach(() => { vi.clearAllMocks(); });

describe('the one-tap log a reminder opens', () => {
  it('logs a feeding for the named gecko in one tap, with its group', async () => {
    const tree = await open('/log?type=feeding&gecko=g1,g2');
    expect(buttons(tree, 'Mark all 2 fed')).toHaveLength(1);
    const fed = buttons(tree, 'Fed');
    expect(fed).toHaveLength(2);
    await act(async () => { fed[0].props.onClick(); });
    expect(mocks.save).toHaveBeenCalledWith({
      kind: 'fed', geckoId: 'g1', feedingGroupId: 'grp', accepted: true, date: todayLocalISO(),
    });
    expect(textOf(tree.root)).toContain('Fed, saved');
    await act(async () => tree.unmount());
  });

  it('a weigh-in needs the number, then saves and mirrors the shown weight', async () => {
    mocks.save.mockImplementation(async (data) => ({ result: null, queued: { id: 'q1' }, data }));
    const tree = await open('/log?type=weight&gecko=g2');
    const input = tree.root.findByProps({ id: 'ql-w-g2' });
    await act(async () => { input.props.onChange({ target: { value: '18,5' } }); });
    const form = tree.root.findByType('form');
    await act(async () => { form.props.onSubmit({ preventDefault() {} }); });
    expect(mocks.save).toHaveBeenCalledWith({ kind: 'weight', geckoId: 'g2', grams: 18.5, date: todayLocalISO(), mirror: true });
    // No signal: kept on the phone, and Undo takes it out of the queue.
    expect(textOf(tree.root)).toContain('18.5 g, kept on this phone');
    const undo = tree.root.findAll((n) => n.type === 'button' && textOf(n).includes('Undo'));
    await act(async () => { undo[0].props.onClick(); });
    expect(mocks.removeQueued).toHaveBeenCalledWith('q1');
    await act(async () => tree.unmount());
  });

  it('refuses an empty or silly weight without saving', async () => {
    const tree = await open('/log?type=weight&gecko=g2');
    const form = tree.root.findByType('form');
    await act(async () => { form.props.onSubmit({ preventDefault() {} }); });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Check the weight' }));
    await act(async () => tree.unmount());
  });

  it('lists a feeding group\'s geckos by name', async () => {
    const tree = await open('/log?type=feeding&group=grp');
    expect(textOf(tree.root)).toContain('Rack A');
    expect(textOf(tree.root)).toContain('Mango');
    expect(textOf(tree.root)).not.toContain('Kiwi');
    await act(async () => tree.unmount());
  });

  it('Done goes back to the page in "from", or to the Dashboard from an email', async () => {
    let tree = await open('/log?type=shed&gecko=g1&from=/MyGeckos');
    await act(async () => { buttons(tree, 'Back')[0].props.onClick(); });
    expect(here).toBe('/MyGeckos');
    await act(async () => tree.unmount());

    tree = await open('/log?type=shed&gecko=g1');
    await act(async () => { buttons(tree, 'Shed today')[0].props.onClick(); });
    expect(mocks.save).toHaveBeenCalledWith({ kind: 'shed', geckoId: 'g1', date: todayLocalISO(), quality: 'unknown' });
    await act(async () => { buttons(tree, 'Done')[0].props.onClick(); });
    expect(here).toBe('/Dashboard');
    await act(async () => tree.unmount());
  });

  it('says so when the gecko is gone', async () => {
    const tree = await open('/log?type=feeding&gecko=gone');
    expect(textOf(tree.root)).toContain('no longer in your collection');
    await act(async () => tree.unmount());
  });

  it('an expired sign-in sends the member back to this same log afterwards', async () => {
    mocks.me = async () => { throw Object.assign(new Error('JWT expired'), { status: 401 }); };
    const url = '/log?type=weight&gecko=g2&from=/MyGeckos';
    const tree = await open(url);
    expect(textOf(tree.root)).toContain('Your sign-in expired');
    const link = tree.root.findAll((n) => n.props && typeof n.props.to === 'string' && n.props.to.startsWith('/AuthPortal'));
    expect(link.length).toBeGreaterThan(0);
    expect(link[0].props.to).toBe(`/AuthPortal?redirect=${encodeURIComponent(url)}`);
    await act(async () => tree.unmount());
  });
});
