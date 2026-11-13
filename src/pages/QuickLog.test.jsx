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
  // Batch Undo toasts ("Mark all", "Save all"), as undoToast was called.
  undoToasts: [],
  // weight_records rows for "last: 15.1 g on 25 Oct".
  weights: [],
  // Today's list, for links that name no geckos and for "Show them here".
  today: { items: [] },
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
vi.mock('@/lib/undoToast', () => ({
  undoToast: (options) => { mocks.undoToasts.push(options); return { dismiss() {} }; },
}));
vi.mock('@/lib/recentWeights', () => ({ loadRecentWeights: async () => mocks.weights }));
vi.mock('@/lib/today', async (importOriginal) => ({
  ...(await importOriginal()),
  loadMemberToday: async (today) => ({ today, feedingReminders: true, weighInReminders: true, ...mocks.today }),
}));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));

import QuickLog from './QuickLog';
import { todayLocalISO } from '@/lib/dateUtils';
import { quickLogLink } from '@/lib/quickLog';
import { addDays, shortDate } from '@/lib/today';
import { FeedingRecord, Gecko, WeightRecord } from '@/entities/all';

let here = null;
function Where() {
  const loc = useLocation();
  here = loc.pathname + loc.search;
  return null;
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

// `url` is an address, or what a screen inside the app passes to the
// router: quickLogLink's { to, state }.
async function open(link) {
  const url = typeof link === 'string'
    ? link
    : { pathname: '/log', search: link.to.slice('/log'.length), state: link.state };
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
  mocks.undoToasts = [];
  mocks.weights = [];
  mocks.today = { items: [] };
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
  // The group was last fed on a fixed date (10 October 2026) and "fed
  // today" only moves it forward, so the clock is frozen after that date.
  // Without this the tests fail on a machine whose clock reads earlier.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

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

  it('runs one Undo at a time, so two quick taps in a group do not lose its schedule', async () => {
    const today = todayLocalISO();
    const tree = await open('/log?type=feeding&group=grp');
    await act(async () => { buttons(tree, 'Mark all 3 fed')[0].props.onClick(); });
    await settle();
    expect(mocks.group.last_fed_date).toBe(today);

    // Alder's Undo waits on the server; meanwhile the other Undo buttons
    // are disabled and a tap on Birch's does nothing.
    let release;
    FeedingRecord.delete.mockImplementationOnce((id) => new Promise((resolve) => {
      release = () => { mocks.rows.FeedingRecord = mocks.rows.FeedingRecord.filter((r) => r.id !== id); resolve(); };
    }));
    const [alder, birch] = undoButtons(tree);
    let first;
    await act(async () => { first = alder.props.onClick(); });
    expect(undoButtons(tree).every((b) => b.props.disabled)).toBe(true);
    await act(async () => { await birch.props.onClick(); });
    await act(async () => { release(); await first; });

    expect(mocks.rows.FeedingRecord.map((r) => r.animal_id)).toEqual(['g2', 'g3']);
    expect(mocks.group.last_fed_date).toBe(today);
    expect(undoButtons(tree).some((b) => b.props.disabled)).toBe(false);

    // The schedule passed to Birch, so undoing the other two moves it back.
    await act(async () => { await undoButtons(tree)[0].props.onClick(); });
    await act(async () => { await undoButtons(tree)[0].props.onClick(); });
    expect(mocks.rows.FeedingRecord).toEqual([]);
    expect(mocks.group.last_fed_date).toBe('2026-10-10');
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

  it('shows this app\'s own reason as is when the phone could not keep a log', async () => {
    // A private window: no signal, and the browser would not store the log.
    mocks.save.mockImplementation(async () => {
      throw new Error('This browser would not keep the log. It was not saved.');
    });
    const tree = await open('/log?type=shed&gecko=g1');
    await act(async () => { buttons(tree, 'Shed today')[0].props.onClick(); });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Not saved', description: 'This browser would not keep the log. It was not saved.',
    }));
    expect(buttons(tree, 'Shed today')).toHaveLength(1);
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
    // The rest load into this same screen, not Field Mode.
    expect(buttons(tree, 'Show them here')).toHaveLength(1);
    expect(textOf(tree.root)).not.toContain('Log the rest');
    await act(async () => tree.unmount());
  });
});

// Experience review WP-4 (13 Nov 2026): one log flow.
const rack = (count, extra = {}) => Array.from({ length: count }, (_, i) => ({
  id: `r${i + 1}`, name: `Gecko ${String(i + 1).padStart(2, '0')}`, feeding_group_id: null, weight_grams: null, ...extra,
}));
const weightBox = (tree, id) => tree.root.findByProps({ id: `ql-w-${id}` });
const type = (tree, id, value) => act(async () => { weightBox(tree, id).props.onChange({ target: { value } }); });
const saveAllButton = (tree) => tree.root.findAll((n) => n.type === 'button' && /^Save( all| 1 weight|$)/.test(textOf(n).trim()))[0];

describe('how many geckos the log holds', () => {
  it('from inside the app there is no cap: 20 ungrouped geckos, one "Mark all 20 fed", one Undo', async () => {
    mocks.geckos = rack(20);
    let n = 0;
    mocks.save.mockImplementation(async (data) => ({ result: { records: [{ id: `f${++n}` }], advanced: [] }, queued: null, data }));
    const link = quickLogLink({ type: 'feeding', geckoIds: mocks.geckos.map((g) => g.id), from: '/Today' });
    // More than 10 do not fit in the address, and it never says "more".
    expect(link.to).toBe('/log?type=feeding&from=%2FToday');
    const tree = await open(link);
    expect(buttons(tree, 'Fed')).toHaveLength(20);
    expect(textOf(tree.root)).not.toContain('more geckos are due');

    await act(async () => { await buttons(tree, 'Mark all 20 fed')[0].props.onClick(); });
    await settle();
    expect(savedIds()).toEqual(mocks.geckos.map((g) => g.id));
    expect(buttons(tree, 'Fed')).toHaveLength(0);
    expect(buttons(tree, 'Done')).toHaveLength(1);
    // One toast with Undo for the whole batch.
    expect(mocks.undoToasts).toHaveLength(1);
    expect(mocks.undoToasts[0].title).toBe('20 fed');
    await act(async () => tree.unmount());
  });

  it('a reminder link is still held to 10, and one tap lists the rest here', async () => {
    mocks.geckos = rack(14);
    mocks.today = { items: mocks.geckos.map((g) => ({ kind: 'weigh_in', key: `gecko:${g.id}`, geckoId: g.id, groupId: null, name: g.name, due: todayLocalISO(), extra: {} })) };
    const ids = mocks.geckos.map((g) => g.id).join(',');
    const tree = await open(`/log?type=weight&gecko=${ids}&more=4`);
    expect(tree.root.findAllByType('form')).toHaveLength(10);
    expect(textOf(tree.root)).toContain('4 more geckos are due');

    await act(async () => { buttons(tree, 'Show them here')[0].props.onClick(); });
    await settle();
    await settle();
    expect(tree.root.findAllByType('form')).toHaveLength(14);
    expect(textOf(tree.root)).toContain('Gecko 14');
    expect(textOf(tree.root)).not.toContain('more geckos are due');
    await act(async () => tree.unmount());
  });

  it('a link that names no geckos lists what is due, and "Show all my geckos" lists everyone', async () => {
    mocks.geckos = rack(3);
    mocks.today = { items: [{ kind: 'feeding', key: 'gecko:r2', geckoId: 'r2', groupId: null, name: 'Gecko 02', due: todayLocalISO(), extra: {} }] };
    const tree = await open('/log?type=feeding');
    await settle();
    expect(buttons(tree, 'Fed')).toHaveLength(1);
    expect(textOf(tree.root)).toContain('Gecko 02');
    await act(async () => { buttons(tree, 'Show all my geckos')[0].props.onClick(); });
    expect(buttons(tree, 'Fed')).toHaveLength(3);
    await act(async () => tree.unmount());
  });

  it('all=1 (My Geckos\' Weigh-in button, the old Batch Husbandry address) lists every active gecko, racks first', async () => {
    mocks.geckos = [
      { id: 'g1', name: 'Mango', feeding_group_id: 'grp' },
      { id: 'g2', name: 'Kiwi', feeding_group_id: null },
      { id: 'g3', name: 'Sold one', feeding_group_id: null, status: 'Sold' },
    ];
    let tree = await open('/log?type=weight&all=1&from=%2FMyGeckos');
    expect(tree.root.findAllByType('form')).toHaveLength(2);
    await act(async () => tree.unmount());

    tree = await open('/log?type=feeding&all=1');
    const text = textOf(tree.root);
    expect(text.indexOf('Rack A')).toBeGreaterThan(-1);
    expect(text.indexOf('Rack A')).toBeLessThan(text.indexOf('In no group'));
    expect(text).not.toContain('Sold one');
    await act(async () => tree.unmount());
  });

  it('with no feeding groups, the whole-collection feeding list points to where groups are made', async () => {
    mocks.geckos = rack(2);
    const tree = await open('/log?type=feeding&all=1');
    const link = tree.root.findAll((n) => n.props && n.props.to === '/ProjectManager?tab=feeding');
    expect(link.length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
  });
});

describe('Save all for weights', () => {
  it('20 weights are typed and saved with one Save, each on its own request', async () => {
    mocks.geckos = rack(20);
    let n = 0;
    mocks.save.mockImplementation(async (data) => ({ result: { id: `w${++n}` }, queued: null, data }));
    const tree = await open('/log?type=weight&all=1');
    for (const g of mocks.geckos) await type(tree, g.id, '41.5');
    expect(textOf(saveAllButton(tree))).toBe('Save all 20 weights');
    await act(async () => { await saveAllButton(tree).props.onClick(); });
    await settle();
    expect(mocks.save).toHaveBeenCalledTimes(20);
    expect(mocks.save.mock.calls.every(([data]) => data.kind === 'weight' && data.grams === 41.5)).toBe(true);
    expect(tree.root.findAllByType('form')).toHaveLength(0);
    expect(mocks.undoToasts[0].title).toBe('20 weights saved');
    await act(async () => tree.unmount());
  });

  it('one failure leaves the others saved, and a second Save sends only the one that failed', async () => {
    mocks.geckos = rack(3);
    let failR2 = true;
    mocks.save.mockImplementation(async (data) => {
      if (data.geckoId === 'r2' && failR2) throw new TypeError('Failed to fetch');
      return { result: { id: `w-${data.geckoId}` }, queued: null, data };
    });
    const tree = await open('/log?type=weight&all=1');
    await type(tree, 'r1', '40');
    await type(tree, 'r2', '41');
    await type(tree, 'r3', '42');
    await act(async () => { await saveAllButton(tree).props.onClick(); });
    await settle();
    // r1 and r3 are saved and marked; r2 keeps its box, still filled in.
    expect(savedIds()).toEqual(['r1', 'r2', 'r3']);
    expect(textOf(tree.root)).toContain('40 g, saved');
    expect(textOf(tree.root)).toContain('42 g, saved');
    expect(tree.root.findAllByType('form')).toHaveLength(1);
    expect(weightBox(tree, 'r2').props.value).toBe('41');
    expect(textOf(tree.root)).toContain('Not saved');
    expect(mocks.undoToasts[0].title).toBe('2 weights saved');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '1 not saved', variant: 'destructive' }));
    expect(textOf(saveAllButton(tree))).toBe('Save 1 weight');

    failR2 = false;
    mocks.save.mockClear();
    await act(async () => { await saveAllButton(tree).props.onClick(); });
    await settle();
    expect(savedIds()).toEqual(['r2']);
    expect(textOf(tree.root)).toContain('41 g, saved');
    await act(async () => tree.unmount());
  });

  it('with no signal every weight is kept on the phone once, and the batch Undo takes them all back out', async () => {
    mocks.geckos = rack(3);
    let n = 0;
    mocks.save.mockImplementation(async (data) => {
      n += 1;
      return { result: null, queued: { id: `q${n}` }, data: { ...data, requestId: `req-${n}` } };
    });
    const tree = await open('/log?type=weight&all=1');
    await type(tree, 'r1', '40');
    await type(tree, 'r3', '42');
    await act(async () => { await saveAllButton(tree).props.onClick(); });
    await settle();
    // An empty box is skipped, not saved as nothing.
    expect(savedIds()).toEqual(['r1', 'r3']);
    expect(textOf(tree.root)).toContain('40 g, kept on this phone');
    expect(textOf(tree.root)).toContain('42 g, kept on this phone');
    expect(mocks.undoToasts[0].description).toContain('Kept on this phone');

    await act(async () => { await mocks.undoToasts[0].undo(); });
    expect(mocks.takeBack.mock.calls.map(([id]) => id)).toEqual(['q1', 'q2']);
    expect(textOf(tree.root)).not.toContain('kept on this phone');
    expect(tree.root.findAllByType('form')).toHaveLength(3);
    // The typed weights are still in their boxes, for a correction.
    expect(weightBox(tree, 'r1').props.value).toBe('40');
    await act(async () => tree.unmount());
  });
});

describe('the weight check', () => {
  beforeEach(() => {
    mocks.geckos = [
      { id: 'g1', name: 'Mango', feeding_group_id: null, weight_grams: 15.1 },
      { id: 'g2', name: 'Kiwi', feeding_group_id: null, weight_grams: null },
    ];
    mocks.weights = [
      { gecko_id: 'g1', weight_grams: 14.2, record_date: '2026-09-25' },
      { gecko_id: 'g1', weight_grams: 15.1, record_date: '2026-10-25' },
    ];
  });

  it('shows the last weight and its date beside the box', async () => {
    const tree = await open('/log?type=weight&gecko=g1,g2');
    await settle();
    expect(textOf(tree.root)).toContain('last: 15.1 g on 25 Oct');
    expect(textOf(tree.root)).toContain('No weight yet');
    await act(async () => tree.unmount());
  });

  it('an entry more than 30 percent from the last weight is not saved on the first tap', async () => {
    const tree = await open('/log?type=weight&gecko=g1');
    await settle();
    await type(tree, 'g1', '151');
    await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(textOf(tree.root)).toContain('That is a big change from 15.1 g. Save 151 g?');

    // Fix: the question goes and nothing is saved.
    await act(async () => { buttons(tree, 'Fix')[0].props.onClick(); });
    expect(textOf(tree.root)).not.toContain('big change');
    expect(mocks.save).not.toHaveBeenCalled();

    // Asked again, and Save on the question saves it as typed.
    await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    await act(async () => { await buttons(tree, 'Save')[0].props.onClick(); });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'weight', geckoId: 'g1', grams: 151 }));
    expect(textOf(tree.root)).toContain('151 g, saved');
    await act(async () => tree.unmount());
  });

  it('Save all holds back a big change and saves the rest; no check without an earlier weight', async () => {
    const tree = await open('/log?type=weight&gecko=g1,g2');
    await settle();
    await type(tree, 'g1', '1.51');
    await type(tree, 'g2', '151');
    await act(async () => { await saveAllButton(tree).props.onClick(); });
    await settle();
    // Kiwi has no earlier weight, so 151 g goes straight in.
    expect(savedIds()).toEqual(['g2']);
    expect(textOf(tree.root)).toContain('That is a big change from 15.1 g. Save 1.5 g?');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'One weight needs a look' }));
    await act(async () => tree.unmount());
  });

  it('a change of 30 percent or less saves on the first tap', async () => {
    const tree = await open('/log?type=weight&gecko=g1');
    await settle();
    await type(tree, 'g1', '19.6');
    await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
});

describe('the date chips', () => {
  const chip = (tree, label) => tree.root.findAll((n) => n.type === 'button' && n.props['aria-pressed'] !== undefined && textOf(n) === label)[0];

  it('everything saved after "Yesterday" is for yesterday, and says so', async () => {
    const yesterday = addDays(todayLocalISO(), -1);
    const tree = await open('/log?type=feeding&gecko=g1,g2');
    expect(chip(tree, 'Today').props['aria-pressed']).toBe(true);
    await act(async () => { chip(tree, 'Yesterday').props.onClick(); });
    expect(chip(tree, 'Yesterday').props['aria-pressed']).toBe(true);
    expect(textOf(tree.root)).toContain(`Logging for ${shortDate(yesterday)}, not today.`);

    await act(async () => { buttons(tree, 'Fed')[0].props.onClick(); });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'fed', geckoId: 'g1', date: yesterday }));
    expect(textOf(tree.root)).toContain(`Fed for ${shortDate(yesterday)}, saved`);
    await act(async () => tree.unmount());
  });

  it('the date box takes an earlier day and never a future one', async () => {
    const today = todayLocalISO();
    const tree = await open('/log?type=shed&gecko=g1');
    const box = tree.root.findByProps({ 'aria-label': 'Pick another date' });
    expect(box.props.max).toBe(today);
    await act(async () => { box.props.onChange({ target: { value: addDays(today, 3) } }); });
    await act(async () => { buttons(tree, 'Shed today')[0].props.onClick(); });
    expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ date: today }));
    await act(async () => tree.unmount());
  });

  it('a weigh-in for an earlier day leaves the gecko\'s shown weight alone, also on Undo', async () => {
    const earlier = addDays(todayLocalISO(), -5);
    const tree = await open('/log?type=weight&gecko=g1');
    await act(async () => { tree.root.findByProps({ 'aria-label': 'Pick another date' }).props.onChange({ target: { value: earlier } }); });
    await type(tree, 'g1', '17');
    await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    expect(mocks.save).toHaveBeenCalledWith({ kind: 'weight', geckoId: 'g1', grams: 17, date: earlier, mirror: false });
    await act(async () => { await undoButtons(tree)[0].props.onClick(); });
    expect(Gecko.update).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
});

describe('Undo for a whole batch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    mocks.geckos = [
      { id: 'g1', name: 'Alder', feeding_group_id: 'grp' },
      { id: 'g2', name: 'Birch', feeding_group_id: 'grp' },
      { id: 'g3', name: 'Cedar', feeding_group_id: 'grp' },
    ];
    mocks.save.mockImplementation(async (data) => realisticSave(data));
  });
  afterEach(() => vi.useRealTimers());

  it('"Mark all fed" ends with an Undo that removes only what that tap saved, and puts the group back', async () => {
    const tree = await open('/log?type=feeding&group=grp');
    // Alder is logged on its own first, as refused: not part of the batch.
    await act(async () => { await buttons(tree, 'Refused')[0].props.onClick(); });
    await act(async () => { await buttons(tree, 'Mark all 2 fed')[0].props.onClick(); });
    await settle();
    expect(mocks.rows.FeedingRecord.map((r) => r.animal_id)).toEqual(['g1', 'g2', 'g3']);
    expect(mocks.group.last_fed_date).toBe(todayLocalISO());
    expect(mocks.undoToasts).toHaveLength(1);
    expect(mocks.undoToasts[0].title).toBe('2 fed');

    await act(async () => { await mocks.undoToasts[0].undo(); });
    // Birch and Cedar are gone and the group is back where it was; Alder's
    // own log stays.
    expect(mocks.rows.FeedingRecord.map((r) => r.animal_id)).toEqual(['g1']);
    expect(mocks.group.last_fed_date).toBe('2026-10-10');
    expect(textOf(tree.root)).toContain('Refused, saved');
    expect(buttons(tree, 'Fed')).toHaveLength(2);
    await act(async () => tree.unmount());
  });

  it('leaves alone a gecko already undone on its own card', async () => {
    const tree = await open('/log?type=feeding&group=grp');
    await act(async () => { await buttons(tree, 'Mark all 3 fed')[0].props.onClick(); });
    await settle();
    await act(async () => { await undoButtons(tree)[2].props.onClick(); });
    FeedingRecord.delete.mockClear();
    await act(async () => { await mocks.undoToasts[0].undo(); });
    expect(FeedingRecord.delete).toHaveBeenCalledTimes(2);
    expect(mocks.rows.FeedingRecord).toEqual([]);
    expect(mocks.group.last_fed_date).toBe('2026-10-10');
    await act(async () => tree.unmount());
  });

  it('says so when nothing could be taken back', async () => {
    const tree = await open('/log?type=feeding&group=grp');
    await act(async () => { await buttons(tree, 'Mark all 3 fed')[0].props.onClick(); });
    await settle();
    FeedingRecord.delete.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
    let failure = null;
    await act(async () => { await mocks.undoToasts[0].undo().catch((error) => { failure = error; }); });
    // undoToast tells the member the undo did not work when undo() throws.
    expect(failure).toBeTruthy();
    expect(textOf(tree.root)).toContain('Fed, saved');
    await act(async () => tree.unmount());
  });
});
