import { describe, expect, it } from 'vitest';
import { handledIds, nextInWalk, sessionSummary, walkOrder } from '@/lib/fieldWalk';

// The rack walk in Field Mode (experience review E4).
const TODAY = '2026-11-13';
const geckos = [
  { id: 'nimbus', name: 'Nimbus', feeding_group_id: null },
  { id: 'aria', name: 'Aria', feeding_group_id: 'rack-a' },
  { id: 'mango', name: 'Mango', feeding_group_id: null },
  { id: 'ember', name: 'Ember', feeding_group_id: 'rack-a' },
  { id: 'cappy', name: 'Cappy', feeding_group_id: null },
];
const todayData = {
  today: TODAY,
  items: [
    { kind: 'weigh_in', geckoId: 'mango', groupId: null, due: '2026-11-11' },
    { kind: 'feeding', geckoId: null, groupId: 'rack-a', due: '2026-11-12' },
    { kind: 'feeding', geckoId: 'nimbus', groupId: null, due: TODAY },
    // Not due yet: does not count.
    { kind: 'feeding', geckoId: 'cappy', groupId: null, due: '2026-11-15' },
    // Not care for one gecko: does not count.
    { kind: 'hatch', geckoId: null, groupId: null, due: '2026-11-01' },
  ],
};
const names = (list) => list.map((g) => g.name);

describe('the order of the walk', () => {
  it('puts what is due first, oldest first, a due group counting for each of its geckos, then the rest by name', () => {
    const { order, due } = walkOrder(geckos, todayData, TODAY);
    expect(names(order)).toEqual(['Mango', 'Aria', 'Ember', 'Nimbus', 'Cappy']);
    expect([...due.keys()].sort()).toEqual(['aria', 'ember', 'mango', 'nimbus']);
  });

  it('is by name when the phone has no Today list', () => {
    expect(names(walkOrder(geckos, null, TODAY).order)).toEqual(['Aria', 'Cappy', 'Ember', 'Mango', 'Nimbus']);
    expect(walkOrder([], null, TODAY)).toEqual({ order: [], due: new Map() });
  });
});

describe('Next', () => {
  const { order } = walkOrder(geckos, todayData, TODAY);

  it('goes to the gecko after this one in the walk', () => {
    expect(nextInWalk(order, 'mango', new Set(['mango'])).name).toBe('Aria');
  });

  it('skips geckos already logged this session, and wraps round to the start', () => {
    expect(nextInWalk(order, 'aria', new Set(['aria', 'ember'])).name).toBe('Nimbus');
    expect(nextInWalk(order, 'cappy', new Set(['cappy', 'mango'])).name).toBe('Aria');
  });

  it('is nothing when every other gecko is logged', () => {
    expect(nextInWalk(order, 'cappy', new Set(order.map((g) => g.id)))).toBeNull();
    expect(nextInWalk([], 'x', new Set())).toBeNull();
  });
});

describe('the session summary', () => {
  const fed = (geckoId, accepted = true) => ({ kind: 'fed', accepted, geckoId });

  it('reads like "12 fed, 3 weighed, 1 refused"', () => {
    const logs = [
      ...Array.from({ length: 12 }, (_, i) => fed(`g${i}`)),
      ...Array.from({ length: 3 }, (_, i) => ({ kind: 'weight', geckoId: `g${i}` })),
      fed('g20', false),
    ];
    expect(sessionSummary(logs)).toBe('12 fed, 3 weighed, 1 refused');
    expect(handledIds(logs).size).toBe(13);
  });

  it('names sheds and notes, in the singular for one', () => {
    expect(sessionSummary([{ kind: 'shed' }, { kind: 'note' }])).toBe('1 shed, 1 note');
    expect(sessionSummary([{ kind: 'shed' }, { kind: 'shed' }, { kind: 'note' }, { kind: 'note' }])).toBe('2 sheds, 2 notes');
  });

  it('is empty when nothing was logged', () => {
    expect(sessionSummary([])).toBe('');
  });
});
