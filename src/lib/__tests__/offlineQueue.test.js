import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setQueueStorage,
  clearAllQueues,
  enqueue,
  flushQueue,
  isAuthError,
  isNetworkError,
  pendingCount,
  readQueue,
  removeQueued,
  setQueueOwner,
  subscribeQueue,
  updateQueued,
} from '../offlineQueue';
import { __setSessionStorage, readStoredSession } from '../offlineSession';

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

const feeding = (id) => ({
  entity: 'FeedingRecord',
  op: 'create',
  data: { animal_id: id, date: '2026-10-03', food_type: 'CGD', accepted: true },
});
const offlineError = () => new TypeError('Failed to fetch');

let storage;
beforeEach(() => {
  storage = fakeStorage();
  __setQueueStorage(storage);
  setQueueOwner(null);
  setQueueOwner('user-a');
});

describe('offline queue', () => {
  it('keeps a feeding logged in airplane mode and saves it once online', async () => {
    enqueue(feeding('gecko-1'));
    expect(pendingCount()).toBe(1);

    const saved = [];
    // Still offline: the write fails with a network error and stays queued.
    let result = await flushQueue(async () => { throw offlineError(); });
    expect(result).toMatchObject({ saved: 0, remaining: 1 });
    expect(pendingCount()).toBe(1);

    // Back online: it is written and leaves the queue.
    result = await flushQueue(async (item) => { saved.push(item); return { id: 'row-1' }; });
    expect(result).toMatchObject({ saved: 1, remaining: 0 });
    expect(saved[0]).toMatchObject({ entity: 'FeedingRecord', op: 'create', data: { animal_id: 'gecko-1', accepted: true } });
    expect(pendingCount()).toBe(0);
  });

  it('replays in the order the logs were made and stops at the first network error', async () => {
    enqueue({ entity: 'WeightRecord', op: 'create', data: { gecko_id: 'g', weight_grams: 41 } });
    enqueue({ entity: 'Gecko', op: 'update', recordId: 'g', data: { weight_grams: 41 } });
    enqueue(feeding('g'));
    const seen = [];
    const result = await flushQueue(async (item) => {
      seen.push(item.entity);
      if (item.entity === 'Gecko') throw offlineError();
    });
    expect(seen).toEqual(['WeightRecord', 'Gecko']);
    expect(result.saved).toBe(1);
    expect(readQueue().map((i) => i.entity)).toEqual(['Gecko', 'FeedingRecord']);
  });

  it('drops a write the database refuses and reports it, then carries on', async () => {
    enqueue(feeding('deleted-gecko'));
    enqueue(feeding('gecko-2'));
    const result = await flushQueue(async (item) => {
      if (item.data.animal_id === 'deleted-gecko') throw Object.assign(new Error('violates foreign key'), { code: '23503' });
    });
    expect(result.saved).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(pendingCount()).toBe(0);
  });

  it('keeps writes when the sign-in has expired', async () => {
    enqueue(feeding('g'));
    const result = await flushQueue(async () => { throw Object.assign(new Error('JWT expired'), { code: 'PGRST301' }); });
    expect(result.saved).toBe(0);
    expect(pendingCount()).toBe(1);
  });

  it('undo removes a waiting log and the refine chips change it', () => {
    const fed = enqueue(feeding('g'));
    const shed = enqueue({ entity: 'ShedRecord', op: 'create', data: { animal_id: 'g', quality: 'unknown' } });
    expect(updateQueued(shed.id, { quality: 'complete' })).toBe(true);
    expect(readQueue()[1].data).toMatchObject({ animal_id: 'g', quality: 'complete' });
    expect(removeQueued(fed.id)).toBe(true);
    expect(readQueue().map((i) => i.id)).toEqual([shed.id]);
    expect(removeQueued('missing')).toBe(false);
  });

  it('keeps each account separate on a shared phone', () => {
    enqueue(feeding('a-gecko'));
    setQueueOwner('user-b');
    expect(pendingCount()).toBe(0);
    enqueue(feeding('b-gecko'));
    setQueueOwner('user-a');
    expect(readQueue().map((i) => i.data.animal_id)).toEqual(['a-gecko']);
  });

  it('refuses to queue with nobody signed in, or when storage fails', () => {
    setQueueOwner(null);
    expect(() => enqueue(feeding('g'))).toThrow(/Sign in/);
    setQueueOwner('user-a');
    storage.setItem = () => { throw new Error('QuotaExceeded'); };
    expect(() => enqueue(feeding('g'))).toThrow(/not saved/);
  });

  it('tells listeners the waiting count', () => {
    const counts = [];
    const unsub = subscribeQueue((n) => counts.push(n));
    const item = enqueue(feeding('g'));
    removeQueued(item.id);
    unsub();
    enqueue(feeding('g'));
    expect(counts).toEqual([1, 0]);
  });

  it('runs only one flush at a time', async () => {
    enqueue(feeding('g'));
    const execute = vi.fn(async () => {});
    const [a, b] = await Promise.all([flushQueue(execute), flushQueue(execute)]);
    expect(a).toBe(b);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('clears every account on request', () => {
    enqueue(feeding('g'));
    storage.setItem('unrelated', 'x');
    clearAllQueues();
    expect(pendingCount()).toBe(0);
    expect(storage.getItem('unrelated')).toBe('x');
  });
});

describe('network and sign-in errors', () => {
  it('treats offline and failed fetches as network errors', () => {
    expect(isNetworkError(null, { onLine: false })).toBe(true);
    expect(isNetworkError(offlineError(), { onLine: true })).toBe(true);
    expect(isNetworkError({ message: 'TypeError: Load failed' }, { onLine: true })).toBe(true);
    expect(isNetworkError({ message: 'new row violates row-level security policy' }, { onLine: true })).toBe(false);
  });
  it('recognises an expired sign-in', () => {
    expect(isAuthError({ status: 401 })).toBe(true);
    expect(isAuthError({ code: 'PGRST301' })).toBe(true);
    expect(isAuthError({ message: 'duplicate key' })).toBe(false);
  });
});

describe('stored session', () => {
  it('reads the session Supabase kept, and nothing else', () => {
    const s = fakeStorage();
    __setSessionStorage(s);
    expect(readStoredSession()).toBeNull();
    s.setItem('sb-abc-auth-token', JSON.stringify({ access_token: 'x', user: { id: 'u1', email: 'a@example.com' } }));
    expect(readStoredSession()?.user.id).toBe('u1');
    expect(readStoredSession('sb-abc-auth-token')?.user.id).toBe('u1');
    s.setItem('sb-abc-auth-token', 'not json');
    expect(readStoredSession()).toBeNull();
  });
});
