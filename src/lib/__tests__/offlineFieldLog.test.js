import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: [] }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/query-client', () => ({ queryClientInstance: { invalidateQueries: vi.fn() } }));
vi.mock('@/entities/all', () => ({
  WeightRecord: { create: vi.fn(async (d) => { calls.list.push(['WeightRecord.create', d]); return { id: 'w1' }; }) },
  Gecko: { update: vi.fn(async (id, d) => { calls.list.push(['Gecko.update', id, d]); }) },
  GeckoEvent: { create: vi.fn(async (d) => { calls.list.push(['GeckoEvent.create', d]); return { id: 'e1' }; }) },
}));
vi.mock('@/lib/husbandryLog', () => ({
  logFeedings: vi.fn(async (args) => { calls.list.push(['logFeedings', args]); return { records: [{ id: 'f1' }], advanced: [] }; }),
  logShed: vi.fn(async (args) => { calls.list.push(['logShed', args]); return { id: 's1' }; }),
}));

import { executeQueuedWrite, FIELD_LOG } from '../offlineSync';

beforeEach(() => { calls.list = []; });

describe('offline Field Mode logs replay through the shared log', () => {
  it('a feeding replays through logFeedings with its backdated day and group', async () => {
    await executeQueuedWrite({
      entity: FIELD_LOG,
      op: 'create',
      data: { kind: 'fed', geckoId: 'g1', feedingGroupId: 'grp1', accepted: true, date: '2026-10-01' },
    });
    expect(calls.list).toEqual([
      ['logFeedings', { entries: [{ gecko: { id: 'g1', feeding_group_id: 'grp1' }, accepted: true }], date: '2026-10-01' }],
    ]);
  });
  it('a refused feeding stays refused', async () => {
    await executeQueuedWrite({ entity: FIELD_LOG, op: 'create', data: { kind: 'fed', geckoId: 'g1', accepted: false, date: '2026-10-02' } });
    expect(calls.list[0][1].entries[0].accepted).toBe(false);
  });
  it('a shed replays through logShed', async () => {
    await executeQueuedWrite({ entity: FIELD_LOG, op: 'create', data: { kind: 'shed', geckoId: 'g1', date: '2026-10-01', quality: 'complete' } });
    expect(calls.list).toEqual([['logShed', { gecko: { id: 'g1' }, date: '2026-10-01', quality: 'complete' }]]);
  });
  it('a weight writes the weigh-in and mirrors only when asked', async () => {
    await executeQueuedWrite({ entity: FIELD_LOG, op: 'create', data: { kind: 'weight', geckoId: 'g1', grams: 42, date: '2026-10-03', mirror: true } });
    await executeQueuedWrite({ entity: FIELD_LOG, op: 'create', data: { kind: 'weight', geckoId: 'g1', grams: 40, date: '2026-09-01', mirror: false } });
    expect(calls.list.map((c) => c[0])).toEqual(['WeightRecord.create', 'Gecko.update', 'WeightRecord.create']);
  });
  it('refuses unknown entities and kinds', async () => {
    await expect(executeQueuedWrite({ entity: 'Profile', op: 'update', data: {} })).rejects.toThrow(/Unsupported/);
    await expect(executeQueuedWrite({ entity: FIELD_LOG, op: 'create', data: { kind: 'x', geckoId: 'g' } })).rejects.toThrow(/Unsupported/);
  });
});
