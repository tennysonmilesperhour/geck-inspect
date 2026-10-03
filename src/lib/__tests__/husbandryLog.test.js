import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = { feeding: [], shed: [], groupUpdates: [], deleted: [] };

vi.mock('@/entities/all', () => ({
  FeedingRecord: {
    create: vi.fn(async (row) => { calls.feeding.push(row); return { id: `f${calls.feeding.length}`, ...row }; }),
    delete: vi.fn(async (id) => { calls.deleted.push(id); }),
  },
  ShedRecord: {
    create: vi.fn(async (row) => { calls.shed.push(row); return { id: 's1', ...row }; }),
  },
  FeedingGroup: {
    update: vi.fn(async (id, patch) => { calls.groupUpdates.push({ id, ...patch }); }),
    filter: vi.fn(async ({ id }) => (id === 'remote' ? [{ id: 'remote', last_fed_date: '2026-09-01' }] : [])),
  },
  Gecko: { filter: vi.fn(async () => []) },
}));

const {
  planGroupAdvances, logFeedings, undoFeedings, markGroupFed, logShed, isAuthFailure, normalizeLogDate, mergeLegacyEvents,
} = await import('../husbandryLog');

describe('mergeLegacyEvents', () => {
  it('folds old shed and feeding events in, newest first, and leaves other events out', () => {
    const { feedings, sheds } = mergeLegacyEvents({
      feedings: [{ id: 'f1', date: '2026-09-30', accepted: true }],
      sheds: [{ id: 's1', date: '2026-09-01', quality: 'complete' }],
      events: [
        { id: 'e1', event_type: 'shed', event_date: '2026-09-20T15:00:00' },
        { id: 'e2', event_type: 'bug_feeding', event_date: '2026-10-01T19:00:00' },
        { id: 'e3', event_type: 'cage_cleaning', event_date: '2026-10-01T19:00:00' },
      ],
    });
    expect(sheds.map((r) => r.id)).toEqual(['event-e1', 's1']);
    expect(sheds[0]).toMatchObject({ date: '2026-09-20', quality: 'unknown', legacy: true });
    expect(feedings.map((r) => r.id)).toEqual(['event-e2', 'f1']);
    expect(feedings[0]).toMatchObject({ food_type: 'Insects', accepted: true, legacy: true });
  });
});

beforeEach(() => {
  calls.feeding = []; calls.shed = []; calls.groupUpdates = []; calls.deleted = [];
});

const adults = { id: 'adults', last_fed_date: '2026-09-28', diet_type: 'Pangea' };
const lilly = { id: 'g1', name: 'Lilly', feeding_group_id: 'adults' };
const harley = { id: 'g2', name: 'Harley', feeding_group_id: 'adults' };

describe('planGroupAdvances (D21)', () => {
  it('moves a group when at least one of its geckos ate', () => {
    const plans = planGroupAdvances(
      [{ gecko: lilly, accepted: false }, { gecko: harley, accepted: true }],
      [adults],
      '2026-10-01',
    );
    expect(plans).toEqual([{ id: 'adults', previous: '2026-09-28', next: '2026-10-01' }]);
  });

  it('does not move a group when every gecko refused', () => {
    expect(planGroupAdvances([{ gecko: lilly, accepted: false }], [adults], '2026-10-01')).toEqual([]);
  });

  it('never pulls a group back in time for a backdated log', () => {
    expect(planGroupAdvances([{ gecko: lilly, accepted: true }], [adults], '2026-09-20')).toEqual([]);
    expect(planGroupAdvances([{ gecko: lilly, accepted: true }], [adults], '2026-09-28')).toEqual([]);
  });

  it('starts a group schedule that had no last fed date', () => {
    const plans = planGroupAdvances([{ gecko: lilly }], [{ id: 'adults' }], '2026-10-01');
    expect(plans).toEqual([{ id: 'adults', previous: null, next: '2026-10-01' }]);
  });
});

describe('logFeedings', () => {
  it('writes one row per gecko and moves the group, and undo takes both back', async () => {
    const result = await logFeedings({
      entries: [{ gecko: lilly, accepted: true }, { gecko: harley, accepted: false, notes: 'Refused' }],
      date: '2026-10-01',
      groups: [adults],
    });
    expect(calls.feeding).toEqual([
      { animal_id: 'g1', date: '2026-10-01', food_type: 'CGD', accepted: true, notes: null },
      { animal_id: 'g2', date: '2026-10-01', food_type: 'CGD', accepted: false, notes: 'Refused' },
    ]);
    expect(calls.groupUpdates).toEqual([{ id: 'adults', last_fed_date: '2026-10-01' }]);

    await undoFeedings(result);
    expect(calls.deleted).toEqual(['f1', 'f2']);
    expect(calls.groupUpdates.at(-1)).toEqual({ id: 'adults', last_fed_date: '2026-09-28' });
  });

  it('looks up a group that is not in memory', async () => {
    await logFeedings({ entries: [{ gecko: { id: 'g3', feeding_group_id: 'remote' } }], date: '2026-10-02' });
    expect(calls.groupUpdates).toEqual([{ id: 'remote', last_fed_date: '2026-10-02' }]);
  });
});

describe('markGroupFed', () => {
  it('logs every gecko in the group with the group food', async () => {
    const result = await markGroupFed({
      group: adults,
      geckos: [lilly, harley, { id: 'g9', feeding_group_id: 'other' }, { id: 'g8', feeding_group_id: 'adults', archived: true }],
      date: '2026-10-03',
    });
    expect(calls.feeding.map((r) => r.animal_id)).toEqual(['g1', 'g2']);
    expect(calls.feeding[0].food_type).toBe('Pangea');
    expect(calls.groupUpdates).toEqual([{ id: 'adults', last_fed_date: '2026-10-03' }]);
    expect(result.fedCount).toBe(2);
    expect(result.lastFed).toBe('2026-10-03');
  });

  it('still moves an empty group', async () => {
    await markGroupFed({ group: { id: 'empty', last_fed_date: null }, geckos: [], date: '2026-10-03' });
    expect(calls.feeding).toEqual([]);
    expect(calls.groupUpdates).toEqual([{ id: 'empty', last_fed_date: '2026-10-03' }]);
  });
});

describe('logShed', () => {
  it('writes a shed row and keeps quality inside the database check', async () => {
    await logShed({ gecko: lilly, date: '2026-10-01', quality: 'retained_toes' });
    await logShed({ gecko: lilly, date: 'bad', quality: 'weird' });
    expect(calls.shed[0]).toEqual({ animal_id: 'g1', date: '2026-10-01', quality: 'retained_toes', notes: null });
    expect(calls.shed[1].quality).toBe('unknown');
    expect(calls.shed[1].date).toBe(normalizeLogDate(undefined));
  });
});

describe('isAuthFailure', () => {
  it('tells an expired sign-in apart from a network error', () => {
    expect(isAuthFailure(new Error('Not authenticated'))).toBe(true);
    expect(isAuthFailure({ code: 'PGRST301', message: 'JWT expired' })).toBe(true);
    expect(isAuthFailure({ status: 401 })).toBe(true);
    expect(isAuthFailure(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAuthFailure(null)).toBe(false);
  });
});
