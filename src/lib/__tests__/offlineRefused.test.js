// A log kept on the phone that the server then refuses must never be shown
// as saved (engineering cleanup, 16 Oct 2026). Before this, the queue
// dropped a refused log and the one-tap log page only saw "no longer
// waiting", which it read as "saved".
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const state = { refuse: null, offline: false, rows: [] };
  const table = {
    async create(row) {
      if (state.offline) throw new TypeError('Failed to fetch');
      if (state.refuse) throw state.refuse;
      const saved = { id: `w-${state.rows.length + 1}`, ...row };
      state.rows.push(saved);
      return saved;
    },
    async filter() {
      return [];
    },
  };
  return { state, table };
});

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/query-client', () => ({ queryClientInstance: { invalidateQueries: vi.fn() } }));
vi.mock('@/entities/all', () => ({
  WeightRecord: db.table,
  FeedingRecord: db.table,
  ShedRecord: db.table,
  FeedingGroup: db.table,
  Gecko: { update: vi.fn(async () => ({})) },
  GeckoEvent: { create: vi.fn(async (d) => ({ id: 'e1', ...d })) },
}));

import {
  __setQueueLocks,
  __setQueueStorage,
  clearAllQueues,
  dismissRefused,
  enqueue,
  flushQueue,
  pendingCount,
  readRefused,
  refusalFor,
  setQueueOwner,
  subscribeQueue,
  subscribeRefused,
} from '../offlineQueue';
import {
  dismissRefusedLogs,
  executeQueuedWrite,
  hasLeftQueue,
  refusedLog,
  saveFieldLog,
  syncNow,
  takeBackQueued,
  undoQueuedLog,
} from '../offlineSync';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    map,
  };
}

const rlsRefusal = () => Object.assign(new Error('new row violates row-level security policy for table "weight_records"'), { code: '42501' });

let storage;
beforeEach(() => {
  db.state.refuse = null;
  db.state.offline = false;
  db.state.rows = [];
  storage = fakeStorage();
  __setQueueStorage(storage);
  __setQueueLocks(null);
  setQueueOwner(null);
  setQueueOwner('member-a');
});

describe('the queue records what the server refused', () => {
  it('records the refusal before the log leaves the queue', async () => {
    const item = enqueue({ entity: 'WeightRecord', op: 'create', data: { gecko_id: 'g1', weight_grams: 41, record_date: '2026-10-14' } });
    // What a page watching the queue sees at the moment the log leaves it.
    const seenWhenGone = [];
    const stop = subscribeQueue((count) => {
      if (count === 0) seenWhenGone.push(refusalFor(item.id));
    });
    const result = await flushQueue(async () => { throw rlsRefusal(); });
    stop();

    expect(result.failed).toHaveLength(1);
    expect(pendingCount()).toBe(0);
    expect(seenWhenGone).toHaveLength(1);
    expect(seenWhenGone[0]).toMatchObject({ id: item.id, entity: 'WeightRecord', geckoId: 'g1', date: '2026-10-14', grams: 41 });
    expect(seenWhenGone[0].error).toMatchObject({ code: '42501' });
  });

  it('records nothing for a log that is only waiting for a signal', async () => {
    const item = enqueue({ entity: 'WeightRecord', op: 'create', data: { gecko_id: 'g1', weight_grams: 41 } });
    await flushQueue(async () => { throw new TypeError('Failed to fetch'); });
    expect(pendingCount()).toBe(1);
    expect(refusalFor(item.id)).toBeNull();
    expect(readRefused()).toEqual([]);
  });

  it('records nothing for a saved log', async () => {
    const item = enqueue({ entity: 'WeightRecord', op: 'create', data: { gecko_id: 'g1', weight_grams: 41 } });
    await flushQueue(async () => ({ id: 'row' }));
    expect(refusalFor(item.id)).toBeNull();
  });

  it('tells listeners when the refused list changes', async () => {
    enqueue({ entity: 'WeightRecord', op: 'create', data: { gecko_id: 'g1', weight_grams: 41 } });
    const calls = vi.fn();
    const stop = subscribeRefused(calls);
    await flushQueue(async () => { throw rlsRefusal(); });
    dismissRefused();
    stop();
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('keeps each account to its own refusals, and sign-out clears them', async () => {
    enqueue({ entity: 'WeightRecord', op: 'create', data: { gecko_id: 'g1', weight_grams: 41 } });
    await flushQueue(async () => { throw rlsRefusal(); });
    expect(readRefused()).toHaveLength(1);
    setQueueOwner('member-b');
    expect(readRefused()).toEqual([]);
    setQueueOwner('member-a');
    expect(readRefused()).toHaveLength(1);
    clearAllQueues();
    expect(readRefused()).toEqual([]);
    expect([...storage.map.keys()].some((k) => k.startsWith('geckinspect_offline_refused:'))).toBe(false);
  });

  it('forgets refusals after a week, keeps at most 50, and dismisses by id', async () => {
    const ids = [];
    for (let i = 0; i < 52; i += 1) ids.push(enqueue({ entity: 'WeightRecord', op: 'create', data: { gecko_id: `g${i}`, weight_grams: 40 } }).id);
    await flushQueue(async () => { throw rlsRefusal(); });
    const kept = readRefused();
    expect(kept).toHaveLength(50);
    expect(kept[0].id).toBe(ids[2]);

    dismissRefused([ids[2], ids[3]]);
    expect(readRefused()).toHaveLength(48);

    const eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(readRefused(eightDaysLater)).toEqual([]);
  });

  it('names the gecko of a queued weight change on the gecko itself', async () => {
    const item = enqueue({ entity: 'Gecko', op: 'update', recordId: 'g9', data: { weight_grams: 33 } });
    await flushQueue(async () => { throw rlsRefusal(); });
    expect(refusalFor(item.id)).toMatchObject({ entity: 'Gecko', geckoId: 'g9', grams: 33 });
  });
});

describe('offlineSync tells a refused log from a saved one', () => {
  it('a weigh-in kept offline and then refused is reported as refused, not saved', async () => {
    const { queued } = await saveFieldLog({ kind: 'weight', geckoId: 'g1', grams: 41, date: '2026-10-14' }, { offline: true });
    db.state.refuse = rlsRefusal();
    const result = await syncNow();

    expect(result.failed).toHaveLength(1);
    expect(db.state.rows).toHaveLength(0);
    expect(hasLeftQueue(queued.id)).toBe(true);
    expect(refusedLog(queued.id)).toMatchObject({ kind: 'weight', geckoId: 'g1', grams: 41, date: '2026-10-14' });
    expect(takeBackQueued(queued.id)).toBe('refused');
  });

  it('a saved log is still "sent", with no refusal', async () => {
    const { queued } = await saveFieldLog({ kind: 'weight', geckoId: 'g1', grams: 41, date: '2026-10-14' }, { offline: true });
    await syncNow();
    expect(db.state.rows).toHaveLength(1);
    expect(refusedLog(queued.id)).toBeNull();
    expect(takeBackQueued(queued.id)).toBe('sent');
  });

  it('Undo on a refused log succeeds quietly, since nothing was saved, and clears the refusal', async () => {
    const { queued } = await saveFieldLog({ kind: 'shed', geckoId: 'g1', date: '2026-10-14' }, { offline: true });
    db.state.refuse = rlsRefusal();
    await flushQueue(executeQueuedWrite);
    await expect(undoQueuedLog(queued.id)).resolves.toBeUndefined();
    expect(refusedLog(queued.id)).toBeNull();
  });

  it('dismissRefusedLogs clears what Field Mode lists', async () => {
    await saveFieldLog({ kind: 'weight', geckoId: 'g1', grams: 41, date: '2026-10-14' }, { offline: true });
    db.state.refuse = rlsRefusal();
    await syncNow();
    expect(readRefused()).toHaveLength(1);
    dismissRefusedLogs();
    expect(readRefused()).toEqual([]);
  });

  it('knows no refusal when nobody owns the queue', () => {
    setQueueOwner(null);
    expect(refusedLog('anything')).toBeNull();
  });
});
