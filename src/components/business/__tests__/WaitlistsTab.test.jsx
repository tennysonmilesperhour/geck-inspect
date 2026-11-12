// @vitest-environment jsdom
// The Waitlists tab asks through the app's own dialog and form, never the
// browser's pop-up boxes (experience review, finding F3): a buyer is added
// through a two-field form, deleting a waitlist asks first and says what
// goes with it, and marking a buyer withdrawn happens at once with Undo.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ lists: [], signups: [], calls: [] }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/components/subscription/PlanLimitChecker', () => ({ canUseFeature: () => true }));
vi.mock('@/entities/all', () => ({
  GeckoWaitlist: {
    filter: async () => fx.lists,
    update: async () => ({}),
    delete: async (id) => { fx.calls.push(['delete-list', id]); return {}; },
  },
  GeckoWaitlistSignup: {
    filter: async () => fx.signups,
    create: async (row) => { fx.calls.push(['create-signup', row]); return { id: 's-new', created_date: '2026-11-12T10:00:00Z', ...row }; },
    update: async (id, patch) => { fx.calls.push(['update-signup', id, patch]); return { id, ...patch }; },
  },
  PendingSale: { create: async () => ({}) },
}));

import WaitlistsTab from '../WaitlistsTab';
import { Toaster } from '@/components/ui/toaster';

installDomHarness();

const BREEDER = { email: 'breeder@example.com', auth_user_id: 'auth-1' };

function renderTab() {
  return render(
    <MemoryRouter>
      <WaitlistsTab user={BREEDER} plans={[]} geckos={[]} />
      <Toaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fx.calls = [];
  fx.lists = [{
    id: 'w1', slug: 'abc12345', title: 'Lilly White x Axanthic 2026 babies', is_open: true,
    deposit_amount: 100, deposit_terms: 'Refundable until matched.', currency: 'USD',
  }];
  fx.signups = [
    { id: 's1', waitlist_id: 'w1', name: 'Dana', email: 'dana@example.com', status: 'deposit_paid', deposit_paid: 100, deposit_paid_on: '2026-11-01', created_date: '2026-11-01T10:00:00Z' },
    { id: 's2', waitlist_id: 'w1', name: 'Rui', email: 'rui@example.com', status: 'waiting', created_date: '2026-11-02T10:00:00Z' },
  ];
  // Any call to the browser's own boxes fails the test.
  window.confirm = vi.fn(() => { throw new Error('the browser confirm box was used'); });
  window.prompt = vi.fn(() => { throw new Error('the browser prompt box was used'); });
});

describe('Waitlists tab', () => {
  it('adds a buyer through a form that checks both fields before saving', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Add a buyer by hand/ }));

    const name = screen.getByLabelText('Buyer name');
    const email = screen.getByLabelText('Buyer email');
    fireEvent.click(screen.getByRole('button', { name: 'Add buyer' }));
    expect(screen.getByText("Enter the buyer's name.")).toBeTruthy();
    expect(screen.getByText("Enter the buyer's email.")).toBeTruthy();
    expect(name.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(name, { target: { value: '  Kai  ' } });
    fireEvent.change(email, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add buyer' }));
    expect(screen.getByText('That does not look like an email address.')).toBeTruthy();
    expect(fx.calls).toEqual([]);

    fireEvent.change(email, { target: { value: ' kai@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add buyer' }));
    await waitFor(() => expect(fx.calls).toEqual([
      ['create-signup', { waitlist_id: 'w1', name: 'Kai', email: 'kai@example.com', status: 'waiting' }],
    ]));
    // The new buyer is in the list and the form has closed.
    expect(await screen.findByText('Kai')).toBeTruthy();
    expect(screen.queryByLabelText('Buyer name')).toBeNull();
    expect(window.prompt).not.toHaveBeenCalled();
  });

  it('closes the add form on Cancel without saving', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Add a buyer by hand/ }));
    fireEvent.change(screen.getByLabelText('Buyer name'), { target: { value: 'Kai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Buyer name')).toBeNull();
    expect(fx.calls).toEqual([]);
  });

  it('asks before deleting a waitlist and says what goes with it', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete waitlist' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete "Lilly White x Axanthic 2026 babies"?')).toBeTruthy();
    const text = dialog.textContent;
    expect(text).toContain('Its 2 signups are deleted with it, and the link stops working.');
    expect(text).toContain('You are holding $100 in deposits from 1 buyer');
    expect(text).toContain('This cannot be undone.');
    expect(fx.calls).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(fx.calls).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Delete waitlist' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete waitlist' }));
    await waitFor(() => expect(fx.calls).toEqual([['delete-list', 'w1']]));
    await waitFor(() => expect(screen.queryByText('Lilly White x Axanthic 2026 babies')).toBeNull());
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('marks a buyer withdrawn at once, keeps the deposit note, and Undo puts them back', async () => {
    renderTab();
    const row = (await screen.findByText('Dana')).closest('[data-signup-row]');
    fireEvent.click(within(row).getByRole('button', { name: 'Withdrawn' }));

    await waitFor(() => expect(fx.calls).toEqual([['update-signup', 's1', { status: 'withdrawn' }]]));
    expect(await screen.findByText('Dana marked as withdrawn')).toBeTruthy();
    expect(screen.getByText('Their $100 deposit stays recorded; use Refunded once you send it back.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(fx.calls.at(-1)).toEqual(['update-signup', 's1', { status: 'deposit_paid' }]));
    expect(await screen.findByText('Dana is back in line')).toBeTruthy();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
