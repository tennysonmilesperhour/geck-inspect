import { describe, expect, it, vi } from 'vitest';

vi.mock('@/entities/all', () => ({
  Egg: {}, BreedingPlan: {}, WeightRecord: {}, FutureBreedingPlan: {}, FeedingGroup: {}, OtherReptile: {},
  FeedingRecord: {}, ShedRecord: {}, Gecko: {},
}));
// The card component pulls in UI primitives that expect a browser; only
// the pure buildActions logic is under test here.
vi.mock('@/components/ui/card', () => ({ Card: () => null, CardContent: () => null, CardHeader: () => null, CardTitle: () => null }));
vi.mock('react-router-dom', () => ({ Link: () => null }));

const { buildActions } = await import('../NextActions');

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const base = { geckos: [], eggs: [], plans: [], weights: [], futurePlans: [], feedingGroups: [], reptiles: [] };

describe('Today card feeding items', () => {
  it('lists a feeding group on its due day and when overdue, like the server reminder', () => {
    const actions = buildActions({
      ...base,
      feedingGroups: [
        { id: 'due', name: 'Adults', interval_days: 3, last_fed_date: daysAgo(3) },
        { id: 'late', name: 'Juveniles', interval_days: 2, last_fed_date: daysAgo(4) },
        { id: 'early', name: 'Hatchlings', interval_days: 3, last_fed_date: daysAgo(1) },
      ],
    });
    const feed = actions.filter((a) => a.type === 'feed');
    expect(feed.map((a) => a.label).sort()).toEqual(['Feed Adults', 'Feed Juveniles']);
    expect(feed.find((a) => a.label === 'Feed Adults').detail).toBe('Due today');
    expect(feed.find((a) => a.label === 'Feed Juveniles').detail).toBe('2 days overdue');
  });

  it('skips muted groups, groups with no feeding logged, and reptiles without reminders', () => {
    const actions = buildActions({
      ...base,
      feedingGroups: [
        { id: 'muted', name: 'Muted', interval_days: 3, last_fed_date: daysAgo(5), feeding_reminder_enabled: false },
        { id: 'never', name: 'Never fed', interval_days: 3, last_fed_date: null },
      ],
      reptiles: [
        { id: 'r1', name: 'Aztec', feeding_reminder_enabled: false, feeding_interval_days: 7, last_fed_date: daysAgo(9) },
        { id: 'r2', name: 'Biscuit', feeding_reminder_enabled: true, feeding_interval_days: 7, last_fed_date: daysAgo(7) },
      ],
    });
    expect(actions.filter((a) => a.type === 'feed').map((a) => a.label)).toEqual(['Feed Biscuit']);
  });
});
