import { describe, it, expect, vi, beforeEach } from 'vitest';

const followFilter = vi.fn(async () => [{ follower_email: 'fan@example.com' }]);
const created = [];

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/entities/all', () => ({
  UserFollow: { filter: (...args) => followFilter(...args) },
  Notification: { create: async (row) => { created.push(row); return row; } },
  Gecko: {},
}));

const { notifyFollowersNewBreedingPlan } = await import('@/components/notifications/NotificationService');

describe('D18: new breeding plans notify followers only when public', () => {
  beforeEach(() => {
    followFilter.mockClear();
    created.length = 0;
  });

  it('stays quiet for a private plan', async () => {
    await notifyFollowersNewBreedingPlan({ id: 'p1', is_public: false }, { name: 'Zeus' }, { name: 'Tiger' }, 'breeder@example.com', 'Breeder');
    await notifyFollowersNewBreedingPlan({ id: 'p2' }, { name: 'Zeus' }, { name: 'Tiger' }, 'breeder@example.com', 'Breeder');
    expect(followFilter).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it('tells followers about a public plan', async () => {
    await notifyFollowersNewBreedingPlan({ id: 'p3', is_public: true }, { name: 'Zeus' }, { name: 'Tiger' }, 'breeder@example.com', 'Breeder');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ user_email: 'fan@example.com', type: 'new_breeding_plan' });
  });
});
