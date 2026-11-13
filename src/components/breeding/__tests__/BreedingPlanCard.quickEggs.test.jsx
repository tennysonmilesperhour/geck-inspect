// @vitest-environment jsdom
// The "1 Egg" and "2 Eggs" buttons on a plan card save in one tap, so they
// answer with an Undo (experience review, findings F1 and F4). Undo removes
// exactly the eggs that tap made and puts the plan's clutch count back.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ calls: [], nextId: 1, failCreateAt: null, planCount: 0, guest: false }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => fx.guest }));
vi.mock('@/entities/all', () => ({
  User: { me: async () => ({ email: 'breeder@example.com' }) },
  Egg: {
    create: async (row) => {
      if (fx.guest) throw Object.assign(new Error('Guests have view-only access.'), { isGuestBlock: true });
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
function renderCard(sireName, damName, plan = PLAN) {
  const onPlanUpdate = vi.fn();
  render(
    <>
      <BreedingPlanCard
        plan={plan}
        geckos={[
          { id: 'g-sire', name: sireName, sex: 'Male' },
          { id: 'g-dam', name: damName, sex: 'Female' },
        ]}
        // An old egg, dated well before any day these tests can run on, so
        // the egg added "today" is always the latest one (CI also runs the
        // tests with the clock 400 days back and 400 days ahead).
        planEggs={[{ id: 'egg-old', breeding_plan_id: 'plan-1', lay_date: '2020-01-01', status: 'Incubating' }]}
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
  fx.guest = false;
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

// Experience review L2: the card answers the tap before the server does.
describe('the plan card changes first', () => {
  // A plan with a monthly egg check shows its clutch count on the card.
  const CHECKED = { ...PLAN, egg_check_day: 15 };

  it('shows the new clutch the moment the button is tapped', async () => {
    renderCard('Rook', 'Wren', CHECKED);
    expect(screen.getByText('3 clutches laid')).toBeTruthy();
    expect(screen.queryByText('0 days since last egg')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add 2 eggs' }));
    // Nothing has been saved yet, and the card already counts the clutch.
    expect(fx.calls).toEqual([]);
    expect(screen.getByText('4 clutches laid')).toBeTruthy();
    expect(screen.getByText('0 days since last egg')).toBeTruthy();

    // The save follows, and the card keeps the clutch.
    await toastWith('2 eggs added to Rook x Wren');
    expect(screen.getByText('4 clutches laid')).toBeTruthy();
    expect(screen.getByText('0 days since last egg')).toBeTruthy();
  });

  it('a save that fails takes the clutch off the card again', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    fx.failCreateAt = 1;
    renderCard('Juno', 'Pip', CHECKED);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 egg' }));
    expect(screen.getByText('4 clutches laid')).toBeTruthy();

    await toastWith('Eggs not added');
    expect(screen.getByText('3 clutches laid')).toBeTruthy();
    expect(screen.queryByText('0 days since last egg')).toBeNull();
    quiet.mockRestore();
  });

  it('Undo tapped before the page has reloaded takes the clutch straight off the card', async () => {
    renderCard('Basil', 'Olive', CHECKED);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 egg' }));
    const toast = await toastWith('1 egg added to Basil x Olive');
    fireEvent.click(toast.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('3 clutches laid')).toBeTruthy();
    expect(screen.queryByText('0 days since last egg')).toBeNull();
    expect(await screen.findByText('Egg removed')).toBeTruthy();
  });

  it('in the demo the card never shows eggs that were not kept', async () => {
    fx.guest = true;
    renderCard('Fern', 'Ivy', CHECKED);
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 eggs' }));
    expect(screen.getByText('3 clutches laid')).toBeTruthy();
    expect(screen.queryByText('0 days since last egg')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add 2 eggs' }).disabled).toBe(false));
    expect(screen.getByText('3 clutches laid')).toBeTruthy();
  });
});
