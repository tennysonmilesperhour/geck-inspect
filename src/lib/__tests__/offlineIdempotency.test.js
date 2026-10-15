// Offline logging saves once (comprehensive review, E2 item 19).
//
// The case this guards: the phone sends a weigh-in or a feeding, the
// database saves it, but the answer arrives after the app's 30-second
// limit, so the app sees an aborted request, keeps the log in the offline
// queue and sends it again later. A fake database below has the same
// unique rule as the real one (client_request_id), so the test shows the
// second send is refused and counted as already saved: one row, not two.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const tables = { weight: [], feeding: [], shed: [], groups: [] };
  const state = { abortAfterCommit: 0, failNext: null };
  const abortError = () => Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' });
  const duplicate = (table) => ({
    code: '23505',
    message: `duplicate key value violates unique constraint "${table}_client_request_id_key"`,
    details: 'Key (client_request_id)=(...) already exists.',
  });
  function table(name, pg) {
    return {
      async create(row) {
        if (state.failNext) {
          const e = state.failNext;
          state.failNext = null;
          throw e;
        }
        if (row.client_request_id && tables[name].some((r) => r.client_request_id === row.client_request_id)) {
          throw duplicate(pg);
        }
        const saved = { id: `${name}-${tables[name].length + 1}`, ...row };
        tables[name].push(saved);
        // The row is committed, but the phone gave up waiting.
        if (state.abortAfterCommit > 0) {
          state.abortAfterCommit -= 1;
          throw abortError();
        }
        return saved;
      },
      async filter(q) {
        return tables[name].filter((r) => Object.entries(q).every(([k, v]) => r[k] === v));
      },
      async delete(id) {
        tables[name] = tables[name].filter((r) => r.id !== id);
      },
      async update(id, patch) {
        const row = tables[name].find((r) => r.id === id);
        Object.assign(row || {}, patch);
        return row;
      },
    };
  }
  return { tables, state, table };
});

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/query-client', () => ({ queryClientInstance: { invalidateQueries: vi.fn() } }));
vi.mock('@/entities/all', () => ({
  WeightRecord: db.table('weight', 'weight_records'),
  FeedingRecord: db.table('feeding', 'feeding_records'),
  ShedRecord: db.table('shed', 'shed_records'),
  FeedingGroup: db.table('groups', 'feeding_groups'),
  Gecko: { update: vi.fn(async () => ({})), filter: vi.fn(async () => []) },
  GeckoEvent: { create: vi.fn(async (d) => ({ id: 'e1', ...d })) },
}));

import {
  createCareRecordOnce,
  isClientRequestId,
  isDuplicateRequestError,
  isMissingRequestIdColumnError,
  newClientRequestId,
} from '../careLogOnce';
import {
  __setQueueLocks,
  __setQueueStorage,
  flushQueue,
  isRetryableError,
  readQueue,
  setQueueOwner,
} from '../offlineQueue';
import { executeQueuedWrite, prepareFieldLog, saveFieldLog, writeOrQueue } from '../offlineSync';

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
  };
}

beforeEach(() => {
  db.tables.weight = [];
  db.tables.feeding = [];
  db.tables.shed = [];
  db.tables.groups = [];
  db.state.abortAfterCommit = 0;
  db.state.failNext = null;
  __setQueueStorage(fakeStorage());
  __setQueueLocks(null);
  setQueueOwner(null);
  setQueueOwner('member-a');
});

describe('request ids', () => {
  it('are version 4 UUIDs, which the database column needs', () => {
    const a = newClientRequestId();
    const b = newClientRequestId();
    expect(isClientRequestId(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isClientRequestId('q_123_abc')).toBe(false);
  });

  it('every weight, feeding and shed log gets one, kept if it already has one', () => {
    expect(isClientRequestId(prepareFieldLog({ kind: 'fed', geckoId: 'g1' }).requestId)).toBe(true);
    expect(isClientRequestId(prepareFieldLog({ kind: 'shed', geckoId: 'g1' }).requestId)).toBe(true);
    const kept = newClientRequestId();
    expect(prepareFieldLog({ kind: 'weight', geckoId: 'g1', requestId: kept }).requestId).toBe(kept);
    // A note writes a gecko event, which has no such column.
    expect(prepareFieldLog({ kind: 'note', geckoId: 'g1' }).requestId).toBeUndefined();
  });

  it('only a refusal on client_request_id counts as already saved', () => {
    expect(isDuplicateRequestError({ code: '23505', message: 'duplicate key value violates unique constraint "weight_records_client_request_id_key"' })).toBe(true);
    expect(isDuplicateRequestError({ code: '23505', message: 'duplicate key value violates unique constraint "geckos_pkey"' })).toBe(false);
    expect(isDuplicateRequestError({ code: '42501', message: 'client_request_id' })).toBe(false);
    expect(isDuplicateRequestError(null)).toBe(false);
  });
});

describe('createCareRecordOnce', () => {
  it('returns the row already saved instead of failing', async () => {
    const client = db.table('weight', 'weight_records');
    const id = newClientRequestId();
    const first = await createCareRecordOnce(client, { gecko_id: 'g1', weight_grams: 18, record_date: '2026-10-16', client_request_id: id });
    const second = await createCareRecordOnce(client, { gecko_id: 'g1', weight_grams: 18, record_date: '2026-10-16', client_request_id: id });
    expect(second).toEqual(first);
    expect(db.tables.weight).toHaveLength(1);
  });

  it('returns what was sent, marked duplicate, when the row cannot be read back', async () => {
    const client = {
      create: vi.fn(async () => { throw { code: '23505', message: 'feeding_records_client_request_id_key' }; }),
      filter: vi.fn(async () => []),
    };
    const id = newClientRequestId();
    const out = await createCareRecordOnce(client, { animal_id: 'g1', client_request_id: id });
    expect(out).toEqual({ animal_id: 'g1', client_request_id: id, duplicate: true });
  });

  it('still throws every other error, and drops a malformed id', async () => {
    const client = db.table('shed', 'shed_records');
    db.state.failNext = { code: '42501', message: 'new row violates row-level security policy' };
    await expect(createCareRecordOnce(client, { animal_id: 'g1', client_request_id: newClientRequestId() })).rejects.toMatchObject({ code: '42501' });
    const saved = await createCareRecordOnce(client, { animal_id: 'g1', client_request_id: 'not-a-uuid' });
    expect(saved).not.toHaveProperty('client_request_id');
  });

  // If the app ships before the migration that adds the column, PostgREST
  // answers PGRST204. The log must still be saved, not refused or dropped.
  it('saves without the id when the database does not know the column yet', async () => {
    const client = db.table('feeding', 'feeding_records');
    const missing = {
      code: 'PGRST204',
      message: "Could not find the 'client_request_id' column of 'feeding_records' in the schema cache",
    };
    expect(isMissingRequestIdColumnError(missing)).toBe(true);
    expect(isMissingRequestIdColumnError({ code: 'PGRST204', message: "Could not find the 'notes' column" })).toBe(false);
    expect(isMissingRequestIdColumnError({ code: '23505', message: 'client_request_id' })).toBe(false);

    db.state.failNext = missing;
    const saved = await createCareRecordOnce(client, { animal_id: 'g1', accepted: true, client_request_id: newClientRequestId() });
    expect(saved).toMatchObject({ animal_id: 'g1', accepted: true });
    expect(db.tables.feeding).toHaveLength(1);
    expect(db.tables.feeding[0]).not.toHaveProperty('client_request_id');
  });

  it('a queued log replayed before the column exists is saved, not dropped', async () => {
    db.state.failNext = {
      code: 'PGRST204',
      message: "Could not find the 'client_request_id' column of 'weight_records' in the schema cache",
    };
    await executeQueuedWrite({
      entity: 'WeightRecord',
      op: 'create',
      data: { gecko_id: 'g1', weight_grams: 21, record_date: '2026-10-16', client_request_id: newClientRequestId() },
    });
    expect(db.tables.weight).toHaveLength(1);
    expect(db.tables.weight[0]).toMatchObject({ gecko_id: 'g1', weight_grams: 21 });
  });
});

describe('a log the server saved after the phone gave up is saved once', () => {
  it('treats the 30-second abort as "try again later"', () => {
    const aborted = Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' });
    expect(isRetryableError(aborted, { onLine: true })).toBe(true);
  });

  it('a weigh-in: saved, aborted, queued with the same id, replayed without a second row', async () => {
    db.state.abortAfterCommit = 1;
    const out = await saveFieldLog({ kind: 'weight', geckoId: 'g1', grams: 21.5, date: '2026-10-16', mirror: false }, { offline: false });
    expect(out.queued).not.toBeNull();
    expect(db.tables.weight).toHaveLength(1);
    expect(readQueue()[0].data.requestId).toBe(db.tables.weight[0].client_request_id);

    const flushed = await flushQueue(executeQueuedWrite);
    expect(flushed).toMatchObject({ saved: 1, failed: [], remaining: 0 });
    expect(db.tables.weight).toHaveLength(1);
  });

  it('a feeding and a shed: the same, through the shared husbandry log', async () => {
    db.state.abortAfterCommit = 2;
    await saveFieldLog({ kind: 'fed', geckoId: 'g1', accepted: true, date: '2026-10-16' }, { offline: false });
    await saveFieldLog({ kind: 'shed', geckoId: 'g1', quality: 'complete', date: '2026-10-16' }, { offline: false });
    expect(readQueue()).toHaveLength(2);
    expect(db.tables.feeding).toHaveLength(1);
    expect(db.tables.shed).toHaveLength(1);

    const flushed = await flushQueue(executeQueuedWrite);
    expect(flushed).toMatchObject({ saved: 2, remaining: 0 });
    expect(db.tables.feeding).toHaveLength(1);
    expect(db.tables.shed).toHaveLength(1);
  });

  it('a log made in airplane mode is kept and saved once when the signal returns', async () => {
    const out = await saveFieldLog({ kind: 'fed', geckoId: 'g2', accepted: true, date: '2026-10-16' }, { offline: true });
    expect(out.result).toBeNull();
    expect(db.tables.feeding).toHaveLength(0);
    // The connection drops again halfway through the first replay.
    db.state.abortAfterCommit = 1;
    const first = await flushQueue(executeQueuedWrite);
    expect(first).toMatchObject({ saved: 0, remaining: 1 });
    const second = await flushQueue(executeQueuedWrite);
    expect(second).toMatchObject({ saved: 1, remaining: 0 });
    expect(db.tables.feeding).toHaveLength(1);
  });

  it('a care record queued through writeOrQueue gets an id too', async () => {
    db.state.abortAfterCommit = 1;
    const out = await writeOrQueue({ entity: 'ShedRecord', op: 'create', data: { animal_id: 'g3', date: '2026-10-16', quality: 'unknown' } });
    expect(isClientRequestId(out.queued.data.client_request_id)).toBe(true);
    await flushQueue(executeQueuedWrite);
    expect(db.tables.shed).toHaveLength(1);
  });

  it('an expired sign-in is not queued', async () => {
    db.state.failNext = { status: 401, message: 'JWT expired' };
    await expect(saveFieldLog({ kind: 'fed', geckoId: 'g1', date: '2026-10-16' }, { offline: false })).rejects.toMatchObject({ status: 401 });
    expect(readQueue()).toHaveLength(0);
  });
});
