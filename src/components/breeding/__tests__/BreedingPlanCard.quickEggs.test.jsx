// @vitest-environment jsdom
// The "1 Egg" and "2 Eggs" buttons on a plan card save in one tap, so they
// answer with an Undo (experience review, findings F1 and F4). Undo removes
// exactly the eggs that tap made and puts the plan's clutch count back.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ calls: [], nextId: 1, failCreateAt: null, planCount: 0 }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/entities/all', () => ({
  User: { me: async () => ({ email: 'breeder@example.com' }) },
  Egg: {
    create: async (row) => {
      if (fx.failCreateAt === fx.nextId) throw new Error('offline');
      const egg = { id: `egg-${fx.nextId++}`, ...row };
      fx.calls.push(['create-egg', egg.id]);
      return egg;
    },
    delete: async (id) => { fx.calls.push(['delete-egg', id]); return {}; },
  },
  BreedingPlan: {
    get: async () => ({ id: 'plan-1', egg_check_count: fx.planCount }),
    update: async (id, patch) => {
      fx.calls.push(['update-plan', id, patch]);
      if ('egg_check_count' in patch) fx.planCount = patch.egg_check_count;
      return { id, ...patch };
    },
  },
}));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));
vi.mock('@/functions/generateCalendarEvent', () => ({ generateCalendarEvent: async () => ({ data: '' }) }));
// The windows a card can open are not part of this test.
vi.mock('../GeneticsModal', () => ({ default: () => null }));
vi.mock('../PlanDetails', () => ({ default: () => null }));
vi.mock('../AddEggsDialog', () => ({ default: () => null }));

import BreedingPlanCard from '../BreedingPlanCard';
import { Toaster } from '@/components/ui/toaster';

installDomHarness();

const PLAN = { id: 'plan-1', sire_id: 'g-sire', dam_id: 'g-dam', egg_check_count: 3 };

// Toasts outlive a test (the toast list is shared by the whole app), so
// each test uses its own pair and reads only that pair's toast.
function renderCard(sireName, damName) {
  const onPlanUpdate = vi.fn();
  render(
    <>
      <BreedingPlanCard
        plan={PLAN}
        geckos={[
          { id: 'g-sire', name: sireName, sex: 'Male' },
          { id: 'g-dam', name: damName, sex: 'Female' },
        ]}
        planEggs={[{ id: 'egg-old', breeding_plan_id: 'plan-1', lay_date: '2026-10-01', status: 'Incubating' }]}
        onPlanUpdate={onPlanUpdate}
        onPlanDelete={() => {}}
        onPlanArchive={() => {}}
        isExpanded={false}
        onToggleExpanded={() => {}}
      />
      <Toaster />
    </>,
  );
  return onPlanUpdate;
}

const toastWith = async (text) => within((await screen.findByText(text)).closest('li'));

beforeEach(() => {
  fx.calls = [];
  fx.nextId = 1;
  fx.failCreateAt = null;
  fx.planCount = 3;
});

describe('quick egg buttons on a breeding plan card', () => {
  it('says what was added and to which pair, with an Undo', async () => {
    const onPlanUpdate = renderCard('Onyx', 'Aria');
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 eggs' }));

    const toast = await toastWith('2 eggs added to Onyx x Aria');
    expect(toast.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(fx.calls).toEqual([
      ['create-egg', 'egg-1'],
      ['create-egg', 'egg-2'],
      ['update-plan', 'plan-1', { egg_check_count: 4 }],
    ]);
    expect(onPlanUpdate).toHaveBeenCalledTimes(1);
  });

  it('Undo deletes exactly the eggs that tap made and puts the clutch count back', async () => {
    const onPlanUpdate = renderCard('Spud', 'Harley');
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 eggs' }));
    const toast = await toastWith('2 eggs added to Spud x Harley');
    fireEvent.click(toast.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('2 eggs removed')).toBeTruthy();
    expect(fx.calls.slice(3)).toEqual([
      ['delete-egg', 'egg-1'],
      ['delete-egg', 'egg-2'],
      ['update-plan', 'plan-1', { egg_check_count: 3 }],
    ]);
    // The egg that was already on the plan is never touched.
    expect(fx.calls.some((call) => call[1] === 'egg-old')).toBe(false);
    await waitFor(() => expect(onPlanUpdate).toHaveBeenCalledTimes(2));
  });

  it('a save that fails part way removes the half clutch and offers to try again', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    fx.failCreateAt = 2; // the second egg of the clutch fails
    renderCard('Moss', 'Cappy');
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 eggs' }));

    const failed = await toastWith('Eggs not added');
    expect(failed.getByText('Nothing was saved. Check your connection, then try again.')).toBeTruthy();
    expect(fx.calls).toEqual([['create-egg', 'egg-1'], ['delete-egg', 'egg-1']]);
    expect(failed.queryByRole('button', { name: 'Undo' })).toBeNull();

    // "Try again" saves the whole clutch once the connection is back.
    fx.failCreateAt = null;
    fireEvent.click(failed.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2 eggs added to Moss x Cappy')).toBeTruthy();
    quiet.mockRestore();
  });
});
