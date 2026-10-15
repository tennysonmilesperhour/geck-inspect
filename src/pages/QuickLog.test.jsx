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
  setPending: null,
  endLocalSession: vi.fn(async () => ({ error: null })),
  group: { id: 'grp', name: 'Rack A', last_fed_date: '2026-10-10' },
  rows: { FeedingRecord: [], ShedRecord: [], WeightRecord: [] },
  geckos: [],
  me: null,
}));

vi.mock('@/api/appClient', () => ({
  api: { auth: { me: () => mocks.me(), redirectToLogin: vi.fn(), endLocalSession: (...a) => mocks.endLocalSession(...a) } },
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
    UNDO_SENT_MESSAGE: 'It has already synced, so it was not undone.',
    UNDO_SYNCING_MESSAGE: 'It is being sent right now, so it was not undone.',
    useOfflineQueue: () => {
      const [pending, setPending] = useState(0);
      mocks.setPending = setPending;
      return { pending, online: true };
    },
  };
});
// The real feeding undo runs, against the stand-in entities below, so the
// group schedule can be checked.
vi.mock('@/lib/husbandryLog', async () => {
  const actual = await vi.importActual('@/lib/husbandryLog');
  return {
    ...actual,
    isAuthFailure: (error) => error?.status === 401,
    markGroupFed: vi.fn(),
  };
});
vi.mock('@/entities/all', () => {
  const table = (name) => ({
    delete: vi.fn(async (id) => { mocks.rows[name] = mocks.rows[name].filter((r) => r.id !== id); }),
    filter: vi.fn(async (q) => mocks.rows[name].filter((r) => Object.entries(q).every(([k, v]) => r[k] === v))),
  });
  return {
    FeedingGroup: {
      get: vi.fn(async (id) => (id === mocks.group.id ? { ...mocks.group } : { id, name: 'Rack B' })),
      update: vi.fn(async (id, patch) => { if (id === mocks.group.id) Object.assign(mocks.group, patch); }),
      filter: vi.fn(async () => [{ ...mocks.group }]),
    },
    FeedingRecord: table('FeedingRecord'),
    Gecko: { update: vi.fn() },
    ShedRecord: table('ShedRecord'),
    WeightRecord: table('WeightRecord'),
  };
});
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));

import QuickLog from './QuickLog';
import { todayLocalISO } from '@/lib/dateUtils';
import { FeedingRecord, Gecko, WeightRecord } from '@/entities/all';

let here = null;
function Where() {
  const loc = useLocation();
  here = loc.pathname + loc.search;
  return null;
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

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
  await settle();
  await settle();
  return tree;
}

const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));
const buttons = (tree, label) => tree.root.findAll((n) => n.type === 'button' && textOf(n).trim() === label);
const undoButtons = (tree) => tree.root.findAll((n) => n.type === 'button' && textOf(n).includes('Undo'));
const savedIds = () => mocks.save.mock.calls.map((c) => c[0].geckoId);

// A stand-in for saveFieldLog + logFeedings: writes a feeding row and, as
// D21 says, moves the group only when it is older than the feeding date.
function realisticSave(data) {
  const id = `r-${data.geckoId}-${mocks.save.mock.calls.length}`;
  const advanced = [];
  if (data.kind === 'fed') {
    mocks.rows.FeedingRecord.push({ id, animal_id: data.geckoId, accepted: data.accepted });
    if (data.accepted && data.feedingGroupId === mocks.group.id && (!mocks.group.last_fed_date || mocks.group.last_fed_date < data.date)) {
      advanced.push({ id: mocks.group.id, previous: mocks.group.last_fed_date, next: data.date });
      mocks.group.last_fed_date = data.date;
    }
  }
  return { result: { records: [{ id }], advanced, groupErrors: [] }, queued: null, data: { ...data, requestId: `req-${id}` } };
}

beforeEach(() => {
  here = null;
  mocks.geckos = [
    { id: 'g1', name: 'Mango', feeding_group_id: 'grp', weight_grams: 16 },
    { id: 'g2', name: 'Kiwi', feeding_group_id: null, weight_grams: null },
  ];
  mocks.group = { id: 'grp', name: 'Rack A', last_fed_date: '2026-10-10' };
  mocks.rows = { FeedingRecord: [], ShedRecord: [], WeightRecord: [] };
  mocks.me = async () => ({ email: 'keeper@example.test' });
  mocks.takeBack.mockImplementation(() => 'removed');
  mocks.leftQueue.mockImplementation(() => false);
  mocks.save.mockImplementation(async (data) => ({ result: { records: [{ id: 'r1' }], advanced: [] }, queued: null, data }));
  window.history.state = { idx: 0 };
  window.location.assign = vi.fn();
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
    await act(async () => { undoButtons(tree)[0].props.onClick(); });
    expect(mocks.takeBack).toHaveBeenCalledWith('q1');
    expect(textOf(tree.root)).not.toContain('kept on this phone');
    expect(mocks.toast).not.toHaveBeenCalled();
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

  it('says so when the gecko is gone, and that it may be another account\'s', async () => {
    const tree = await open('/log?type=feeding&gecko=gone');
    expect(textOf(tree.root)).toContain('not in this collection');
    expect(textOf(tree.root)).toContain('signed in to a different account');
    expect(textOf(tree.root)).toContain('Nothing to log here');
    await act(async () => tree.unmount());
  });

  it('an expired sign-in ends this browser\'s session, then signs in and comes back to this same log', async () => {
    mocks.me = async () => { throw Object.assign(new Error('JWT expired'), { status: 401 }); };
    const url = '/log?type=weight&gecko=g2&from=/MyGeckos';
    const tree = await open(url);
    expect(textOf(tree.root)).toContain('Your sign-in expired');
    const link = tree.root.findAll((n) => n.props && typeof n.props.to === 'string' && n.props.to.startsWith('/AuthPortal'));
    expect(link.length).toBeGreaterThan(0);
    expect(link[0].props.to).toBe(`/AuthPortal?redirect=${encodeURIComponent(url)}`);
    // Without ending the stale session first, the sign-in page would see a
    // "signed-in" tab and send it straight back here, round and round.
    const preventDefault = vi.fn();
    await act(async () => { await link[0].props.onClick({ preventDefault }); });
    expect(preventDefault).toHaveBeenCalled();
    expect(mocks.endLocalSession).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(`/AuthPortal?redirect=${encodeURIComponent(url)}`);
    await act(async () => tree.unmount());
  });
});

describe('no double saves', () => {
  const holdSaves = () => {
    const holds = [];
    mocks.save.mockImplementation((data) => new Promise((resolve) => {
      holds.push(() => resolve({ result: { records: [{ id: `r-${data.geckoId}` }], advanced: [] }, queued: null, data }));
    }));
    return async () => {
      while (holds.length) {
        await act(async () => { holds.shift()(); });
        await settle();
      }
    };
  };

  it('a second tap on Mark all saves each gecko once, and the button shows it is working', async () => {
    const release = holdSaves();
    const tree = await open('/log?type=feeding&gecko=g1,g2');
    const markAll = buttons(tree, 'Mark all 2 fed')[0];
    await act(async () => { markAll.props.onClick(); });
    await act(async () => { markAll.props.onClick(); });
    // While it runs: a spinner, and the button no longer takes taps.
    const working = tree.root.findAll((n) => n.type === 'button' && n.props.className?.includes('bg-emerald-700'));
    expect(working[0].props.disabled).toBe(true);
    expect(textOf(working[0])).not.toContain('Mark all');
    await release();
    expect(savedIds()).toEqual(['g1', 'g2']);
    await act(async () => tree.unmount());
  });

  it('a gecko\'s own Fed tapped while Mark all runs is not saved a second time', async () => {
    const release = holdSaves();
    const tree = await open('/log?type=feeding&gecko=g1,g2');
    await act(async () => { buttons(tree, 'Mark all 2 fed')[0].props.onClick(); });
    // g1 is saving; tap g2's own Fed now.
    const fed = buttons(tree, 'Fed');
    await act(async () => { fed[fed.length - 1].props.onClick(); });
    await release();
    expect(savedIds().sort()).toEqual(['g1', 'g2']);
    await act(async () => tree.unmount());
  });
});

describe('undo after Mark all fed keeps the group schedule right', () => {
  beforeEach(() => {
    mocks.geckos = [
      { id: 'g1', name: 'Alder', feeding_group_id: 'grp' },
      { id: 'g2', name: 'Birch', feeding_group_id: 'grp' },
      { id: 'g3', name: 'Cedar', feeding_group_id: 'grp' },
    ];
    mocks.save.mockImplementation(async (data) => realisticSave(data));
  });

  it('undoing the first gecko leaves the group fed while others are still fed; the last undo moves it back', async () => {
    const today = todayLocalISO();
    const tree = await open('/log?type=feeding&group=grp');
    await act(async () => { buttons(tree, 'Mark all 3 fed')[0].props.onClick(); });
    await settle();
    expect(mocks.group.last_fed_date).toBe(today);
    expect(mocks.rows.FeedingRecord.map((r) => r.animal_id)).toEqual(['g1', 'g2', 'g3']);

    // Alder refused after all: Undo on Alder (the first one saved).
    await act(async () => { await undoButtons(tree)[0].props.onClick(); });
    expect(mocks.rows.FeedingRecord.map((r) => r.animal_id)).toEqual(['g2', 'g3']);
    expect(mocks.group.last_fed_date).toBe(today);

    // Then Refused for Alder: the group is still fed today.
    await act(async () => { await buttons(tree, 'Refused')[0].props.onClick(); });
    expect(mocks.group.last_fed_date).toBe(today);

    // Undo Birch, then Cedar: only the last accepted feeding moves it back.
    const undos = () => undoButtons(tree);
    await act(async () => { await undos()[1].props.onClick(); });
    expect(mocks.group.last_fed_date).toBe(today);
    await act(async () => { await undos()[1].props.onClick(); });
    expect(mocks.group.last_fed_date).toBe('2026-10-10');
    expect(mocks.rows.FeedingRecord.map((r) => r.animal_id)).toEqual(['g1']);
    expect(mocks.rows.FeedingRecord[0].accepted).toBe(false);
    await act(async () => tree.unmount());
  });
});

describe('undo on a log kept on the phone', () => {
  const queuedSave = async (data) => ({ result: null, queued: { id: 'q1' }, data: { ...data, requestId: 'req-1' } });

  it('says plainly that a log being sent right now was not undone, and keeps the card', async () => {
    mocks.save.mockImplementation(queuedSave);
    mocks.takeBack.mockImplementation(() => 'syncing');
    const tree = await open('/log?type=shed&gecko=g1');
    await act(async () => { buttons(tree, 'Shed today')[0].props.onClick(); });
    await act(async () => { await undoButtons(tree)[0].props.onClick(); });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Undo failed', description: 'It is being sent right now, so it was not undone.',
    }));
    expect(textOf(tree.root)).toContain('Shed logged, kept on this phone');
    expect(buttons(tree, 'Shed today')).toHaveLength(0);
    await act(async () => tree.unmount());
  });

  it('a weigh-in that already synced is undone by finding its saved row', async () => {
    mocks.save.mockImplementation(queuedSave);
    mocks.takeBack.mockImplementation(() => 'sent');
    mocks.rows.WeightRecord = [{ id: 'w1', client_request_id: 'req-1' }];
    const tree = await open('/log?type=weight&gecko=g1');
    const input = tree.root.findByProps({ id: 'ql-w-g1' });
    await act(async () => { input.props.onChange({ target: { value: '18' } }); });
    await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    await act(async () => { await undoButtons(tree)[0].props.onClick(); });
    expect(WeightRecord.delete).toHaveBeenCalledWith('w1');
    expect(Gecko.update).toHaveBeenCalledWith('g1', { weight_grams: 16 });
    expect(mocks.toast).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('a synced feeding that moved its group is not "undone"; the card says it is saved', async () => {
    mocks.save.mockImplementation(queuedSave);
    const tree = await open('/log?type=feeding&gecko=g1');
    await act(async () => { buttons(tree, 'Fed')[0].props.onClick(); });
    expect(textOf(tree.root)).toContain('Fed, kept on this phone');

    // The queue sends it: the card stops saying "kept on this phone".
    mocks.leftQueue.mockImplementation(() => true);
    await act(async () => { mocks.setPending(1); });
    await act(async () => { mocks.setPending(0); });
    expect(textOf(tree.root)).toContain('Fed, saved');
    expect(textOf(tree.root)).not.toContain('kept on this phone');
    // Its group may have moved, so no Undo is offered here.
    expect(undoButtons(tree)).toHaveLength(0);
    expect(FeedingRecord.delete).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('a feeding that synced while the card still said "kept" is not reported as undone', async () => {
    mocks.save.mockImplementation(queuedSave);
    mocks.takeBack.mockImplementation(() => 'sent');
    const tree = await open('/log?type=feeding&gecko=g1');
    await act(async () => { buttons(tree, 'Fed')[0].props.onClick(); });
    mocks.leftQueue.mockImplementation(() => true);
    await act(async () => { await undoButtons(tree)[0].props.onClick(); });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Undo failed', description: 'It has already synced, so it was not undone.',
    }));
    expect(textOf(tree.root)).toContain('Fed, saved');
    expect(buttons(tree, 'Refused')).toHaveLength(0);
    await act(async () => tree.unmount());
  });
});

describe('plain words on the page', () => {
  it('shows a refusal from the database in plain words, not the database text', async () => {
    mocks.save.mockImplementation(async () => {
      throw Object.assign(new Error('new row violates row-level security policy for table "weight_records"'), { code: '42501' });
    });
    const tree = await open('/log?type=shed&gecko=g1');
    await act(async () => { buttons(tree, 'Shed today')[0].props.onClick(); });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Not saved', description: 'You can no longer log for this gecko.',
    }));
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain('row-level security');
    await act(async () => tree.unmount());
  });

  it('a weigh-in link that names a group shows the group\'s geckos', async () => {
    const tree = await open('/log?type=weight&group=grp');
    expect(textOf(tree.root)).toContain('Rack A');
    expect(textOf(tree.root)).toContain('Mango');
    expect(tree.root.findAllByType('form')).toHaveLength(1);
    await act(async () => tree.unmount());
  });

  it('a shed link for a group with no geckos says there is nothing to log', async () => {
    const tree = await open('/log?type=shed&group=empty');
    expect(textOf(tree.root)).toContain('Nothing to log here');
    await act(async () => tree.unmount());
  });

  it('says how many more geckos are due when the reminder covered more than fit', async () => {
    const tree = await open('/log?type=weight&gecko=g1,g2&more=12');
    expect(textOf(tree.root)).toContain('12 more geckos are due');
    const link = tree.root.findAll((n) => n.props && n.props.to === '/FieldMode' && textOf(n).includes('Log the rest'));
    expect(link).toHaveLength(1);
    await act(async () => tree.unmount());
  });
});
