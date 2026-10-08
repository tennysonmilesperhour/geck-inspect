import { describe, expect, it } from 'vitest';
import { buildCareNotifications } from '../nativeCareSchedule';

const afternoon = new Date(2026, 9, 8, 15, 0, 0);
const morning = new Date(2026, 9, 8, 8, 0, 0);

describe('buildCareNotifications', () => {
  it('schedules a future morning for a weigh-in and a feeding group', () => {
    const items = buildCareNotifications({
      now: afternoon,
      geckos: [{ id: 'g1', name: 'Mango', archived: false }],
      weighInGeckos: { g1: { on: true, every_days: 14, since: '2026-10-01' } },
      feedingGroups: [{ id: 'f1', name: 'Nursery', last_fed_date: '2026-10-08', interval_days: 2, feeding_reminder_enabled: true }],
    });
    expect(items.map((item) => item.title).sort()).toEqual(['Feeding due', 'Weigh-in due']);
    const feeding = items.find((item) => item.title === 'Feeding due');
    const weigh = items.find((item) => item.title === 'Weigh-in due');
    expect(feeding.body).toBe('Nursery is due to be fed.');
    expect(weigh.body).toBe('Mango is due for a weigh-in.');
    for (const item of items) {
      expect(new Date(item.at).getTime()).toBeGreaterThan(afternoon.getTime());
      expect(new Date(item.at).getHours()).toBe(9);
    }
  });

  it('uses this morning when the due time is still ahead', () => {
    const items = buildCareNotifications({
      now: morning,
      feedingAlertsEnabled: true,
      weighInEnabled: false,
      feedingGroups: [{ id: 'f1', name: 'Rack A', last_fed_date: '2026-10-01', interval_days: 7 }],
    });
    expect(items).toHaveLength(1);
    const at = new Date(items[0].at);
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(9);
    expect(at.getDate()).toBe(8);
    expect(at.getHours()).toBe(9);
  });

  it('skips muted groups, archived geckos, and reminders the member turned off', () => {
    const items = buildCareNotifications({
      now: afternoon,
      feedingAlertsEnabled: false,
      weighInEnabled: true,
      geckos: [{ id: 'gone', name: 'Ghost', archived: true }, { id: 'off', name: 'Quiet' }],
      weighInGeckos: {
        gone: { on: true, every_days: 14, since: '2026-10-01' },
        off: { on: false, every_days: 14, since: '2026-10-01' },
        missing: { on: true, every_days: 14, since: '2026-10-01' },
      },
      feedingGroups: [{ id: 'muted', name: 'Muted', feeding_reminder_enabled: false, last_fed_date: '2026-10-01', interval_days: 1 }],
    });
    expect(items).toEqual([]);
  });

  it('keeps ids stable and unique', () => {
    const input = {
      now: afternoon,
      geckos: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      weighInGeckos: {
        a: { on: true, every_days: 14, since: '2026-10-01' },
        b: { on: true, every_days: 14, since: '2026-10-01' },
      },
      feedingGroups: [],
    };
    const first = buildCareNotifications(input).map((item) => item.id);
    const second = buildCareNotifications(input).map((item) => item.id);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});
