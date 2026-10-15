import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Retries and cross-tab safety for the Field Mode offline queue
// (src/lib/offlineQueue.js). Each "tab" is a fresh copy of the module that
// shares one localStorage, which is exactly the situation of two open
// browser tabs on the same phone.

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

// The part of the Web Locks API the queue uses: request(name,
// { ifAvailable: true }, cb) calls cb(null) when another holder has it.
function fakeLocks() {
  const held = new Set();
  return {
    held,
    async request(name, opts, cb) {
      if (held.has(name)) {
        if (opts?.ifAvailable) return cb(null);
        throw new Error('fake lock manager only supports ifAvailable');
      }
      held.add(name);
      try {
        return await cb({ name });
      } finally {
        held.delete(name);
      }
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const feeding = (id) => ({
  entity: 'FeedingRecord',
  op: 'create',
  data: { animal_id: id, date: '2026-10-03', food_type: 'CGD', accepted: true },
});

async function openTab(storage, locks) {
  vi.resetModules();
  const tab = await import('../offlineQueue');
  tab.__setQueueStorage(storage);
  tab.__setQueueLocks(locks);
  tab.setQueueOwner('user-a');
  return tab;
}

let storage;
beforeEach(() => {
  storage = fakeStorage();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aborted and busy requests stay queued', () => {
  it('keeps a log whose request was aborted instead of deleting it', async () => {
    const q = await openTab(storage, null);
    q.enqueue(feeding('g'));
    const aborts = [
      new DOMException('The user aborted a request.', 'AbortError'),
      new DOMException('The operation timed out.', 'TimeoutError'),
      // supabase-js can hand back a plain object that only keeps the text.
      { message: 'AbortError: The user aborted a request.', details: '', code: '' },
    ];
    for (const error of aborts) {
      const result = await q.flushQueue(async () => { throw error; });
      expect(result).toMatchObject({ saved: 0, failed: [], remaining: 1 });
    }
    const result = await q.flushQueue(async () => ({ id: 'row-1' }));
    expect(result).toMatchObject({ saved: 1, remaining: 0 });
  });

  it('retries a busy or unreachable server, but drops a real refusal', async () => {
    const q = await openTab(storage, null);
    q.enqueue(feeding('g'));
    let result = await q.flushQueue(async () => { throw Object.assign(new Error('Service Unavailable'), { status: 503 }); });
    expect(result).toMatchObject({ saved: 0, remaining: 1 });
    // Postgres uses the word "aborted" for a refusal too; that is not a retry.
    result = await q.flushQueue(async () => {
      throw Object.assign(new Error('current transaction is aborted, commands ignored until end of transaction block'), { code: '25P02' });
    });
    expect(result.failed).toHaveLength(1);
    expect(result.remaining).toBe(0);
  });

  it('classifies errors', async () => {
    const q = await openTab(storage, null);
    expect(q.isAbortError({ name: 'AbortError' })).toBe(true);
    expect(q.isAbortError({ message: 'signal is aborted without reason' })).toBe(true);
    expect(q.isAbortError({ message: 'current transaction is aborted' })).toBe(false);
    expect(q.isNetworkError({ name: 'AbortError' }, { onLine: true })).toBe(true);
    expect(q.isRetryableError({ status: 429 }, { onLine: true })).toBe(true);
    expect(q.isRetryableError({ status: 400, message: 'invalid input' }, { onLine: true })).toBe(false);
  });
});

describe('only one tab sends the queue', () => {
  for (const mode of ['Web Locks', 'localStorage lease']) {
    it(`two tabs flushing at once send each log once (${mode})`, async () => {
      const locks = mode === 'Web Locks' ? fakeLocks() : null;
      const tabA = await openTab(storage, locks);
      const tabB = await openTab(storage, locks);
      tabA.enqueue(feeding('g1'));
      tabA.enqueue(feeding('g2'));
      expect(tabB.pendingCount()).toBe(2);

      const sent = [];
      const gate = deferred();
      const execute = async (item) => {
        sent.push(item.id);
        await gate.promise;
      };
      const flushA = tabA.flushQueue(execute);
      // Let tab A take the lock and start its first write.
      await new Promise((r) => setTimeout(r, 0));
      const resultB = await tabB.flushQueue(execute);
      expect(resultB).toMatchObject({ saved: 0, busy: true, remaining: 2 });

      gate.resolve();
      const resultA = await flushA;
      expect(resultA).toMatchObject({ saved: 2, remaining: 0, busy: false });
      expect(sent).toHaveLength(2);
      expect(new Set(sent).size).toBe(2);

      // The lock is released afterwards, so tab B can flush next time.
      tabB.enqueue(feeding('g3'));
      expect(await tabB.flushQueue(async () => {})).toMatchObject({ saved: 1, busy: false });
    });
  }

  it('takes over a lease left by a tab that closed mid-flush', async () => {
    const q = await openTab(storage, null);
    storage.setItem('geckinspect_offline_flush:user-a', JSON.stringify({ holder: 'closed-tab', expires: Date.now() - 1 }));
    q.enqueue(feeding('g'));
    expect(await q.flushQueue(async () => {})).toMatchObject({ saved: 1, busy: false });
    expect(storage.getItem('geckinspect_offline_flush:user-a')).toBeNull();
  });

  it('waits for a lease another open tab still holds', async () => {
    const q = await openTab(storage, null);
    storage.setItem('geckinspect_offline_flush:user-a', JSON.stringify({ holder: 'other-tab', expires: Date.now() + 10_000 }));
    q.enqueue(feeding('g'));
    const execute = vi.fn(async () => {});
    expect(await q.flushQueue(execute)).toMatchObject({ saved: 0, busy: true, remaining: 1 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses the browser Web Locks API when it exists', async () => {
    const locks = fakeLocks();
    const request = vi.spyOn(locks, 'request');
    vi.stubGlobal('navigator', { onLine: true, locks });
    const q = await openTab(storage, undefined);
    q.enqueue(feeding('g'));
    expect(await q.flushQueue(async () => {})).toMatchObject({ saved: 1 });
    expect(request).toHaveBeenCalledWith('geckinspect_offline_flush:user-a', { ifAvailable: true }, expect.any(Function));
  });

  it('skips a log that was removed after the flush started', async () => {
    const q = await openTab(storage, null);
    q.enqueue(feeding('g1'));
    const second = q.enqueue(feeding('g2'));
    const sent = [];
    await q.flushQueue(async (item) => {
      sent.push(item.data.animal_id);
      // Undo of the second log while the first is still sending.
      q.removeQueued(second.id);
    });
    expect(sent).toEqual(['g1']);
  });
});
