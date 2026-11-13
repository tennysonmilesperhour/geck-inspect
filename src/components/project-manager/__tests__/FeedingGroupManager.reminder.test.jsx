// @vitest-environment jsdom
// The bell on a feeding group card switches that group's feeding alerts.
// It changes the moment it is tapped and goes back if the save fails
// (experience review L2).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ update: null, toast: null, guest: false }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/entities/all', () => ({
  FeedingGroup: { update: (...args) => fx.update(...args) },
  Gecko: { update: async () => ({}) },
}));
vi.mock('@/lib/husbandryLog', () => ({ markGroupFed: async () => ({}) }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => fx.guest }));
vi.mock('@/components/ui/use-toast', () => ({ toast: (...args) => fx.toast(...args) }));

import FeedingGroupManager from '../FeedingGroupManager';

installDomHarness();

const RACK = { id: 'grp-1', label: 'A', name: 'Rack A', diet_type: 'CGD', interval_days: 3, last_fed_date: '2026-11-10', feeding_reminder_enabled: true };
const OFF = 'Turn off feeding alerts for this group';
const ON = 'Turn on feeding alerts for this group';

// A save that waits for the test to let it through or fail it.
function holdSave() {
  let settle;
  fx.update = vi.fn(() => new Promise((resolve, reject) => { settle = { resolve, reject }; }));
  return {
    ok: () => act(async () => { settle.resolve({}); }),
    fail: (error = new Error('The connection dropped.')) => act(async () => { settle.reject(error); }),
  };
}

function renderManager(groups = [RACK]) {
  const onUpdate = vi.fn();
  const view = render(<FeedingGroupManager feedingGroups={groups} geckos={[]} onUpdate={onUpdate} />);
  return { onUpdate, ...view };
}

beforeEach(() => {
  fx.toast = vi.fn();
  fx.guest = false;
  fx.update = vi.fn(async () => ({}));
});

describe('the reminder bell on a feeding group', () => {
  it('changes the moment it is tapped, before the save has answered', async () => {
    const server = holdSave();
    const { onUpdate } = renderManager();
    fireEvent.click(screen.getByRole('button', { name: OFF }));

    expect(fx.update).toHaveBeenCalledWith('grp-1', { feeding_reminder_enabled: false });
    expect(screen.getByRole('button', { name: ON }).getAttribute('aria-pressed')).toBe('false');
    expect(onUpdate).not.toHaveBeenCalled();

    await server.ok();
    expect(screen.getByRole('button', { name: ON })).toBeTruthy();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(fx.toast).not.toHaveBeenCalled();
  });

  it('goes back, with a notice, when the save fails', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const server = holdSave();
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: OFF }));
    expect(screen.getByRole('button', { name: ON })).toBeTruthy();

    await server.fail();
    expect(screen.getByRole('button', { name: OFF }).getAttribute('aria-pressed')).toBe('true');
    expect(fx.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not change the reminder', variant: 'destructive' }));
    quiet.mockRestore();
  });

  it('follows the page again once its list agrees, so a later change in the edit form shows', async () => {
    const { rerender } = renderManager();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: OFF })); });
    // The page reloads with the saved value, then the group is switched
    // back on somewhere else (the edit form).
    rerender(<FeedingGroupManager feedingGroups={[{ ...RACK, feeding_reminder_enabled: false }]} geckos={[]} onUpdate={() => {}} />);
    rerender(<FeedingGroupManager feedingGroups={[{ ...RACK, feeding_reminder_enabled: true }]} geckos={[]} onUpdate={() => {}} />);
    expect(screen.getByRole('button', { name: OFF })).toBeTruthy();
  });

  it('in the demo the bell stays put: a guest is never shown a change that was not kept', async () => {
    fx.guest = true;
    const server = holdSave();
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: OFF }));
    expect(screen.getByRole('button', { name: OFF })).toBeTruthy();
    await server.fail(Object.assign(new Error('Guests have view-only access.'), { isGuestBlock: true }));
    expect(screen.getByRole('button', { name: OFF })).toBeTruthy();
    expect(fx.toast).not.toHaveBeenCalled();
  });
});
