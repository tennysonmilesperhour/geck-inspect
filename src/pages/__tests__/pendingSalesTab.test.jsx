// @vitest-environment jsdom
// Reserves on Business Tools > Sales (experience review, finding F3):
// completing a sale asks through the app's own dialog, and cancelling or
// deleting a reserve happens at once with Undo. The browser's confirm box
// is never used.
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ calls: [] }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/api/appClient', () => ({ api: {} }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn(), ensurePostHog: async () => null }));
vi.mock('@/entities/all', () => ({
  Gecko: { update: async (id, patch) => { fx.calls.push(['gecko-update', id, patch]); return {}; } },
  MarketplaceCost: { create: async (row) => { fx.calls.push(['cost-create', row]); return { id: 'c1', ...row }; } },
  PendingSale: {
    update: async (id, patch) => { fx.calls.push(['sale-update', id, patch]); return { id, ...patch }; },
    delete: async (id) => { fx.calls.push(['sale-delete', id]); return { ...SALES.find((s) => s.id === id), notes: 'from the server' }; },
    create: async (row) => { fx.calls.push(['sale-create', row]); return row; },
  },
  BreedingPlan: {},
  Egg: {},
}));

import { PendingSalesTab } from '@/pages/MarketplaceSalesStats';
import { Toaster } from '@/components/ui/toaster';

installDomHarness();

const SALES = [
  { id: 'p1', gecko_id: 'g1', gecko_name: 'Mango', buyer_name: 'Dana', reserve_price: 450, status: 'pending', payment_schedule: [], created_date: '2026-11-10T10:00:00Z' },
  { id: 'p2', gecko_id: null, gecko_name: 'Cappuccino hatchling', reserve_price: 300, status: 'pending', payment_schedule: [], created_date: '2026-11-09T10:00:00Z' },
];

function Harness({ onCompleteSale }) {
  const [sales, setSales] = useState(SALES);
  return (
    <>
      <PendingSalesTab user={{ email: 'breeder@example.com' }} pendingSales={sales} setPendingSales={setSales} onCompleteSale={onCompleteSale} allGeckos={[]} />
      <Toaster />
    </>
  );
}

const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const cardFor = (name) => screen.getByText(name).closest('div.rounded-xl');

beforeEach(() => {
  fx.calls = [];
  window.confirm = vi.fn(() => { throw new Error('the browser confirm box was used'); });
});

describe('reserves on the Sales tab', () => {
  it('asks before completing a sale, and does nothing on Cancel', async () => {
    const onCompleteSale = vi.fn();
    render(<Harness onCompleteSale={onCompleteSale} />);
    fireEvent.click(within(cardFor('Mango')).getByRole('button', { name: /Complete Sale/ }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Complete the sale of Mango?')).toBeTruthy();
    expect(dialog.textContent).toContain('$450 moves to revenue, and the gecko is archived as sold.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(fx.calls).toEqual([]);

    fireEvent.click(within(cardFor('Mango')).getByRole('button', { name: /Complete Sale/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Complete sale' }));
    await waitFor(() => expect(onCompleteSale).toHaveBeenCalledTimes(1));
    expect(fx.calls[0]).toEqual(['sale-update', 'p1', expect.objectContaining({ status: 'completed' })]);
    expect(fx.calls[1]).toEqual(['gecko-update', 'g1', expect.objectContaining({ status: 'Sold', archived: true, sold_price: 450 })]);
    await waitFor(() => expect(screen.queryByText('Mango')).toBeNull());
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('cancels a reserve at once and Undo puts it back in its place', async () => {
    render(<Harness />);
    fireEvent.click(within(cardFor('Mango')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(fx.calls).toEqual([['sale-update', 'p1', { status: 'cancelled' }]]));
    expect(await screen.findByText('Reserve for Mango cancelled')).toBeTruthy();
    expect(screen.getByText('The gecko stays in your collection.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Mango' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(fx.calls.at(-1)).toEqual(['sale-update', 'p1', { status: 'pending' }]));
    await screen.findByText('Reserve restored');
    expect(names()).toEqual(['Mango', 'Cappuccino hatchling']);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('deletes a reserve at once and Undo saves the same record again', async () => {
    render(<Harness />);
    fireEvent.click(within(cardFor('Cappuccino hatchling')).getByRole('button', { name: 'Delete reserve' }));

    await waitFor(() => expect(fx.calls).toEqual([['sale-delete', 'p2']]));
    expect(await screen.findByText('Reserve for Cappuccino hatchling deleted')).toBeTruthy();
    expect(names()).toEqual(['Mango']);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    // The row the database handed back is what gets saved again, id and all.
    await waitFor(() => expect(fx.calls.at(-1)).toEqual(['sale-create', { ...SALES[1], notes: 'from the server' }]));
    // Toasts from the test before can still be on screen, so wait on the list.
    await waitFor(() => expect(names()).toEqual(['Mango', 'Cappuccino hatchling']));
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
