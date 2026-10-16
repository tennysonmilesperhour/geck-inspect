import { describe, it, expect, vi } from 'vitest';
import {
  TODAY_DEFAULTS_FROM,
  addDays,
  buildTodayFromRecords,
  collectionLogLinks,
  daysFrom,
  isTodayUnavailable,
  loadDemoToday,
  normalizeToday,
  pendingLogs,
  todayView,
  whenLabel,
} from '@/lib/today';
import { CARE_DEFAULTS_FROM } from '@/lib/careReminders';
import { parseQuickLogParams } from '@/lib/quickLog';

const TODAY = '2026-11-20';
// The defaults start 60 days before "today", as in
// supabase/tests/nav_regressions.sql, so geckos added 10 days ago are new.
const DEFAULTS = addDays(TODAY, -60);
const at = (days) => `${addDays(TODAY, days)}T12:00:00.000Z`;

// The same collection as supabase/tests/nav_regressions.sql, so the demo
// rules here and the database function are checked against one story.
function collection() {
  return {
    today: TODAY,
    defaultsFrom: DEFAULTS,
    feedingGroups: [{ id: 'grp', label: 'A', name: 'Rack A', interval_days: 3, last_fed_date: addDays(TODAY, -3) }],
    geckos: [
      { id: 'ingroup', name: 'Pebble', created_date: at(-200), feeding_group_id: 'grp', weight_grams: 40 },
      { id: 'mango', name: 'Mango', created_date: at(-10) },
      { id: 'nimbus', name: 'Nimbus', created_date: at(-10), weight_grams: 8 },
      { id: 'harley', name: 'Harley', created_date: at(-400), weight_grams: 45 },
      { id: 'off', name: 'Quiet', created_date: at(-10) },
      { id: 'sold', name: 'Gone', created_date: at(-10), status: 'Sold' },
      { id: 'arch', name: 'Archived', created_date: at(-10), archived: true },
    ],
    feedingRecords: [
      { animal_id: 'mango', date: addDays(TODAY, -4), accepted: true },
      { animal_id: 'mango', date: addDays(TODAY, -1), accepted: false },
      { animal_id: 'nimbus', date: TODAY, accepted: true },
    ],
    weightRecords: [
      { gecko_id: 'nimbus', weight_grams: 8, record_date: addDays(TODAY, -5) },
      { gecko_id: 'harley', weight_grams: 45, record_date: addDays(TODAY, -40) },
    ],
    breedingPlans: [{ id: 'plan', breeding_id: 'Harley 2026', sire_id: 'spud', dam_id: 'harley' }],
    eggs: [
      { breeding_plan_id: 'plan', lay_date: addDays(TODAY, -60), hatch_date_expected: addDays(TODAY, 5), status: 'Incubating' },
      { breeding_plan_id: 'plan', lay_date: addDays(TODAY, -60), hatch_date_expected: addDays(TODAY, 6), status: 'Incubating' },
      { breeding_plan_id: 'plan', lay_date: addDays(TODAY, -60), hatch_date_expected: addDays(TODAY, -1), status: 'Hatched' },
    ],
    extra: {
      care_reminders: {
        weigh_in: { geckos: { off: { on: false } } },
        feeding: { geckos: { off: { on: false } } },
      },
    },
  };
}

const find = (items, kind, id) => items.find((i) => i.kind === kind && (i.geckoId === id || i.groupId === id));

describe('the Today list rules (the same story as the SQL regression file)', () => {
  const { items } = buildTodayFromRecords(collection());

  it('lists the group and the gecko in no group, by their own schedules', () => {
    expect(find(items, 'feeding', 'grp').due).toBe(TODAY);
    expect(find(items, 'feeding', 'grp').extra.geckos).toBe(1);
    // A refusal is not a feeding: Mango last ate 4 days ago, every 3 days.
    expect(find(items, 'feeding', 'mango').due).toBe(addDays(TODAY, -1));
    expect(find(items, 'feeding', 'nimbus').due).toBe(addDays(TODAY, 3));
    expect(find(items, 'feeding', 'ingroup')).toBeUndefined();
    expect(find(items, 'feeding', 'harley')).toBeUndefined();
  });

  it('lists weigh-ins by life stage, and the 30-day line for older geckos', () => {
    // Never weighed: the day after it was added.
    expect(find(items, 'weigh_in', 'mango').due).toBe(addDays(TODAY, -9));
    // 8 g is still growing (every 14 days): 9 days away, past the 7-day horizon.
    expect(find(items, 'weigh_in', 'nimbus')).toBeUndefined();
    expect(find(items, 'weigh_in', 'harley').due).toBe(addDays(TODAY, -10));
  });

  it('leaves out switched-off, sold and archived geckos', () => {
    for (const id of ['off', 'sold', 'arch']) {
      expect(items.some((i) => i.geckoId === id)).toBe(false);
    }
  });

  it('lists a clutch once, from 7 days before it is due to hatch', () => {
    const clutches = items.filter((i) => i.kind === 'hatch');
    expect(clutches).toHaveLength(1);
    expect(clutches[0].due).toBe(addDays(TODAY, -2));
    expect(clutches[0].extra.eggs).toBe(2);
    expect(clutches[0].extra.dam).toBe('Harley');
  });

  it('is oldest first and never past the horizon', () => {
    const dues = items.map((i) => i.due);
    expect([...dues].sort()).toEqual(dues);
    expect(dues.every((d) => d <= addDays(TODAY, 7))).toBe(true);
  });

  it('follows the account switches', () => {
    const quiet = buildTodayFromRecords({
      ...collection(),
      feedingOn: false,
      extra: { care_reminders: { weigh_in: { enabled: false } } },
    });
    expect(quiet.items.some((i) => i.kind === 'feeding' || i.kind === 'weigh_in')).toBe(false);
    expect(quiet.items.some((i) => i.kind === 'hatch')).toBe(true);
    expect(quiet.feedingReminders).toBe(false);
    expect(quiet.weighInReminders).toBe(false);
  });

  it('uses a cadence the member fixed on the record', () => {
    const data = collection();
    data.extra.care_reminders.weigh_in.geckos.nimbus = { on: true, every_days: 7, fixed: true };
    const { items: fixed } = buildTodayFromRecords(data);
    expect(find(fixed, 'weigh_in', 'nimbus').due).toBe(addDays(TODAY, 2));
  });
});

describe('the database answer', () => {
  it('keeps good items and drops ones it cannot show', () => {
    const data = normalizeToday({
      today: TODAY,
      feeding_reminders: true,
      weigh_in_reminders: false,
      items: [
        { kind: 'feeding', key: 'gecko:a', gecko_id: 'a', group_id: null, name: 'Mango', due: TODAY, extra: { every_days: 3 } },
        { kind: 'mystery', key: 'x', name: 'x', due: TODAY },
        { kind: 'vet', key: 'vet:1', name: 'Mango', due: null },
      ],
    });
    expect(data.today).toBe(TODAY);
    expect(data.weighInReminders).toBe(false);
    expect(data.items).toEqual([
      { kind: 'feeding', key: 'gecko:a', geckoId: 'a', groupId: null, name: 'Mango', due: TODAY, extra: { every_days: 3 } },
    ]);
    expect(normalizeToday(null, TODAY)).toMatchObject({ today: TODAY, items: [] });
  });

  it('knows when the function is not in the database yet', () => {
    expect(isTodayUnavailable({ code: 'PGRST202' })).toBe(true);
    expect(isTodayUnavailable({ code: '42883' })).toBe(true);
    expect(isTodayUnavailable({ status: 404 })).toBe(true);
    expect(isTodayUnavailable({ code: '42501' })).toBe(false);
    expect(isTodayUnavailable(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('starts the defaults on the same day as the reminder settings', () => {
    expect(TODAY_DEFAULTS_FROM).toBe(CARE_DEFAULTS_FROM);
  });
});

describe('what the screen shows', () => {
  const data = buildTodayFromRecords(collection());

  it('puts the feeding card first, and its button opens the one-tap log for everything due', () => {
    const view = todayView(data, { today: TODAY });
    expect(view.cards[0].kind).toBe('feeding');
    expect(view.cards[0].action.label).toBe('Log feeding');
    // Two taps from the Today tab: this button, then "Fed" on /log.
    const [path, search] = view.cards[0].action.to.split('?');
    expect(path).toBe('/log');
    const params = parseQuickLogParams(`?${search}`);
    expect(params.type).toBe('feeding');
    expect(params.geckoIds).toEqual(['mango']);
    expect(params.groupIds).toEqual(['grp']);
    // "Done" comes back to Today.
    expect(params.from).toBe('/Today');
  });

  it('marks late ones and says by how much', () => {
    const view = todayView(data, { today: TODAY });
    const feeding = view.cards.find((c) => c.kind === 'feeding');
    expect(feeding.late).toBe(true);
    expect(feeding.lines.find((l) => l.name === 'Mango').note).toBe('due yesterday');
    expect(feeding.lines.find((l) => l.name === 'Rack A').note).toBe('1 gecko, due today');
    const weigh = view.cards.find((c) => c.kind === 'weigh_in');
    expect(weigh.title).toBe('Weigh-ins');
    expect(parseQuickLogParams(`?${weigh.action.to.split('?')[1]}`).geckoIds.sort()).toEqual(['harley', 'mango']);
  });

  it('opens the hatchery for a clutch', () => {
    const view = todayView(data, { today: TODAY });
    const hatch = view.cards.find((c) => c.kind === 'hatch');
    expect(hatch.title).toBe('2 eggs are close to hatching');
    expect(hatch.action.to).toBe('/Breeding?tab=hatchery');
    expect(hatch.detail).toContain('in 5 days');
  });

  it('lists the week ahead without buttons', () => {
    const view = todayView(data, { today: TODAY });
    expect(view.comingUp).toEqual([{ key: 'feeding:gecko:nimbus', text: 'Feed Nimbus', when: 'in 3 days' }]);
  });

  it('gives every row of the week ahead its own key, when one gecko has a feeding and a weigh-in', () => {
    // The reviewer's case: a hatchling added on 10 Oct, fed today and
    // weighed 12 days ago, is due both a weigh-in and a feeding this week.
    // Both items carry the key 'gecko:g1', so the rows must not reuse it
    // (React keeps stale rows on screen when two rows share a key).
    const data = buildTodayFromRecords({
      today: '2026-10-20',
      defaultsFrom: '2026-10-01',
      geckos: [{ id: 'g1', name: 'Nimbus', created_date: '2026-10-10T12:00:00.000Z', weight_grams: 5 }],
      feedingRecords: [{ animal_id: 'g1', date: '2026-10-20', accepted: true }],
      weightRecords: [{ gecko_id: 'g1', weight_grams: 5, record_date: '2026-10-08' }],
    });
    const view = todayView(data, { today: '2026-10-20' });
    expect(view.comingUp.map((r) => r.text)).toEqual(['Weigh Nimbus', 'Feed Nimbus']);
    const keys = view.comingUp.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not ask again for a log kept on this phone', () => {
    const pending = pendingLogs([
      { entity: 'FieldLog', op: 'create', data: { kind: 'fed', geckoId: 'mango', accepted: true, date: TODAY } },
      { entity: 'FieldLog', op: 'create', data: { kind: 'fed', geckoId: 'ingroup', feedingGroupId: 'grp', accepted: true, date: TODAY } },
      { entity: 'FieldLog', op: 'create', data: { kind: 'fed', geckoId: 'nimbus', accepted: false, date: TODAY } },
      { entity: 'GeckoEvent', op: 'create', data: { geckoId: 'harley' } },
    ]);
    expect([...pending.fed].sort()).toEqual(['ingroup', 'mango']);
    expect([...pending.fedGroups]).toEqual(['grp']);
    const view = todayView(data, { today: TODAY, pending });
    expect(view.cards.some((c) => c.kind === 'feeding')).toBe(false);
    expect(view.savedOnPhone.sort()).toEqual(['Mango', 'Rack A']);
  });

  it('works on a list with nothing in it', () => {
    expect(todayView({ items: [] }, { today: TODAY })).toEqual({ cards: [], comingUp: [], savedOnPhone: [], dueCount: 0 });
  });
});

describe('the Log tab', () => {
  it('logs feedings by group, with the geckos due soonest first', () => {
    const data = buildTodayFromRecords(collection());
    const links = collectionLogLinks({ geckos: collection().geckos, todayData: data, from: '/MyGeckos' });
    const feeding = parseQuickLogParams(`?${links.feeding.split('?')[1]}`);
    expect(feeding.type).toBe('feeding');
    expect(feeding.groupIds).toEqual(['grp']);
    // Mango (due yesterday) before Nimbus (in 3 days) and Harley (no
    // feeding reminder); the group's gecko is covered by the group.
    expect(feeding.geckoIds).toEqual(['mango', 'nimbus', 'harley', 'off']);
    expect(feeding.from).toBe('/MyGeckos');
    const weight = parseQuickLogParams(`?${links.weight.split('?')[1]}`);
    expect(weight.geckoIds.slice(0, 2)).toEqual(['harley', 'mango']);
    // Sold and archived geckos are not offered.
    expect(links.shed).not.toMatch(/sold|arch/);
  });

  it('still opens the log page with an empty collection', () => {
    expect(collectionLogLinks({}).feeding).toBe('/log?type=feeding');
  });
});

describe('dates', () => {
  it('counts whole days', () => {
    expect(daysFrom('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysFrom('2026-03-28', '2026-03-30')).toBe(2);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(whenLabel(0)).toBe('today');
    expect(whenLabel(1)).toBe('tomorrow');
    expect(whenLabel(-1)).toBe('yesterday');
    expect(whenLabel(4)).toBe('in 4 days');
    expect(whenLabel(-4)).toBe('4 days ago');
  });
});

describe('the demo collection', () => {
  // The guest demo dates its records from the clock when its module first
  // loads (loadDemoToday imports it on demand, so it loads inside this
  // test), while this test asks for a fixed day. Without a fixed clock the
  // two drift apart: from about 24 Nov 2026 the demo had nothing due on
  // 16 Oct, the test failed, and with it `pnpm build` and every deploy.
  it('has a sensible Today: due items, each with somewhere to go', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    try {
      const today = '2026-10-16';
      const demo = await loadDemoToday(today);
      expect(demo.geckos.length).toBeGreaterThan(5);
      expect(demo.geckos.every((g) => !g.archived)).toBe(true);
      const view = todayView(demo, { today });
      expect(view.cards.length + view.comingUp.length).toBeGreaterThan(0);
      for (const card of view.cards) {
        expect(card.title).toBeTruthy();
        expect(card.action?.to?.startsWith('/')).toBe(true);
      }
      // No em or en dashes in anything the screen says.
      expect(JSON.stringify(view)).not.toMatch(/[\u2013\u2014]/);
    } finally {
      vi.useRealTimers();
    }
  });

  // Until 16 Oct 2026 the sample day was one amber card: all 19 demo
  // geckos 15 days late for a weigh-in, and no feeding to log. And as the
  // weeks passed, more demo geckos counted as added after the defaults
  // started and fell further behind. The day must look the same whenever
  // it is opened, so it is checked on release day and months later.
  it.each(['2026-10-16', '2027-06-01'])('on %s opens on a feeding to log, with only a few weigh-ins due', async (today) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${today}T12:00:00.000Z`));
    vi.resetModules();
    try {
      const fresh = await import('@/lib/today');
      const view = fresh.todayView(await fresh.loadDemoToday(today), { today });
      const [first] = view.cards;
      expect(first.kind).toBe('feeding');
      expect(first.action.label).toBe('Log feeding');
      expect(first.action.to.startsWith('/log?type=feeding')).toBe(true);
      const weighIns = view.cards.find((card) => card.kind === 'weigh_in');
      const lines = weighIns?.lines || [];
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.length).toBeLessThanOrEqual(3);
      expect(lines.every((line) => !/\d+ days ago/.test(line.note))).toBe(true);
      expect(view.comingUp.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
      vi.resetModules();
    }
  });
});
