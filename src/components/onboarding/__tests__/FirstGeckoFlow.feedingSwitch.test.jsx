// @vitest-environment jsdom
// The feeding reminder switch on the first gecko's last step moves the
// moment it is tapped and goes back if the save fails (experience review
// L2), the same as the weigh-in switch beside it.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ geckoUpdate: null }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/posthog', () => ({ captureEvent: () => {} }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/entities/all', () => ({
  FeedingGroup: {
    get: async () => ({ id: 'grp-1', name: 'My geckos', label: 'A', diet_type: 'CGD', interval_days: 3, last_fed_date: '2026-11-12', feeding_reminder_enabled: true }),
  },
  Gecko: { update: (...args) => fx.geckoUpdate(...args) },
  WeightRecord: { create: async () => ({}) },
}));
vi.mock('@/lib/careReminders', () => ({
  ensureDefaultWeighInReminder: async () => ({ on: true, memberEnabled: true }),
  setGeckoFeedingReminder: async () => ({}),
  setGeckoWeighInReminder: async () => ({}),
}));
// The cards around the switches are not part of this test.
vi.mock('@/components/gecko/MarketValueCard', () => ({ default: () => null }));
vi.mock('@/components/onboarding/ValueEstimateLine', () => ({ default: () => null }));
vi.mock('@/components/notifications/PushAskCard', () => ({ default: () => null }));

import FirstGeckoFlow from '../FirstGeckoFlow';

installDomHarness();

const MANGO = { id: 'g1', name: 'Mango', sex: 'Unsexed', morphs_traits: 'Harlequin', feeding_group_id: 'grp-1' };

// A save that waits for the test to let it through or fail it.
function holdSave() {
  let settle;
  fx.geckoUpdate = vi.fn(() => new Promise((resolve, reject) => { settle = { resolve, reject }; }));
  return {
    ok: () => act(async () => { settle.resolve({}); }),
    fail: () => act(async () => { settle.reject(new Error('The connection dropped.')); }),
  };
}

async function openPayoff() {
  render(
    <MemoryRouter>
      <FirstGeckoFlow open gecko={MANGO} user={{ email: 'keeper@example.com' }} startStep="payoff" onClose={() => {}} />
    </MemoryRouter>,
  );
  // The gecko's feeding group loads, which switches the reminder on.
  const feeding = await screen.findByRole('switch', { name: 'Feeding reminder' });
  await act(async () => {});
  expect(feeding.getAttribute('aria-checked')).toBe('true');
  return feeding;
}

beforeEach(() => { toast.mockClear(); });

describe('the feeding reminder switch on the first gecko payoff', () => {
  it('is off the moment it is tapped, and stays off once saved', async () => {
    const feeding = await openPayoff();
    const server = holdSave();
    await act(async () => { fireEvent.click(feeding); });
    // The gecko has not been saved out of its group yet.
    expect(fx.geckoUpdate).toHaveBeenCalledWith('g1', { feeding_group_id: null });
    expect(feeding.getAttribute('aria-checked')).toBe('false');
    await server.ok();
    expect(feeding.getAttribute('aria-checked')).toBe('false');
    expect(toast).not.toHaveBeenCalled();
  });

  it('goes back on, with a notice, when the save fails', async () => {
    const feeding = await openPayoff();
    const server = holdSave();
    await act(async () => { fireEvent.click(feeding); });
    expect(feeding.getAttribute('aria-checked')).toBe('false');
    await server.fail();
    expect(feeding.getAttribute('aria-checked')).toBe('true');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not change the reminder', variant: 'destructive' }));
  });
});
