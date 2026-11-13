// @vitest-environment jsdom
// Costs on Business > Money (experience review, finding F4): deleting a
// cost used to happen at once with no way back. It still happens at once,
// and now offers Undo, which saves the same record again.
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ calls: [], toasts: [], failDelete: null, deleteAnswer: undefined }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/api/appClient', () => ({ api: {} }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn(), ensurePostHog: async () => null }));
// The real toasts, with a note of each one shown: toasts from the test
// before can still be on screen, so "no notice" is checked on the note.
vi.mock('@/components/ui/use-toast', async (original) => {
  const actual = await original();
  return { ...actual, toast: (options) => { fx.toasts.push(options.title); return actual.toast(options); } };
});
vi.mock('@/entities/all', () => ({
  Gecko: {},
  MarketplaceCost: {
    delete: async (id) => {
      fx.calls.push(['cost-delete', id]);
      if (fx.failDelete) throw fx.failDelete;
      return fx.deleteAnswer === undefined ? { ...COSTS.find((c) => c.id === id), notes: 'from the server' } : fx.deleteAnswer;
    },
    create: async (row) => { fx.calls.push(['cost-create', row]); return row; },
  },
  PendingSale: {},
  BreedingPlan: {},
  Egg: {},
}));

import { CostRow, deleteCostWithUndo } from '@/pages/MarketplaceSalesStats';
import { Toaster } from '@/components/ui/toaster';

installDomHarness();

const COSTS = [
  { id: 'c1', description: 'Pangea Fig and Insects, 2 kg', amount: 64.5, date: '2026-11-10', category: 'food', plan_id: null, gecko_id: null },
  { id: 'c2', description: 'Incubator', amount: 180, date: '2026-11-08', category: 'equipment', plan_id: 'plan-1', gecko_id: null },
  { id: 'c3', description: 'Vet check for Onyx', amount: 95, date: '2026-11-02', category: 'vet', plan_id: null, gecko_id: 'g1' },
];

function Harness() {
  const [costs, setCosts] = useState(COSTS);
  return (
    <>
      {costs.map((cost) => (
        <CostRow key={cost.id} cost={cost} linkOptions={{ pairings: [], animals: [] }}
          onDelete={(id) => deleteCostWithUndo(id, costs, setCosts)} onUpdate={() => {}} />
      ))}
      <Toaster />
    </>
  );
}

const rows = () => COSTS.map((c) => c.description).filter((text) => screen.queryByText(text));

beforeEach(() => {
  fx.calls = [];
  fx.toasts = [];
  fx.failDelete = null;
  fx.deleteAnswer = undefined;
  window.confirm = vi.fn(() => { throw new Error('the browser confirm box was used'); });
});

describe('deleting a cost', () => {
  it('names its delete button for a screen reader', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Delete cost: Incubator' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Delete cost: / })).toHaveLength(3);
  });

  it('takes the row away at once, and Undo saves the same record back in its place', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete cost: Incubator' }));

    // Gone before the database has answered.
    expect(rows()).toEqual([COSTS[0].description, COSTS[2].description]);
    await waitFor(() => expect(fx.calls).toEqual([['cost-delete', 'c2']]));
    expect(await screen.findByText('Cost deleted')).toBeTruthy();
    expect(screen.getByText('Incubator, $180')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    // The row the database handed back is what gets saved again: the same
    // id, amount, date, category and what it was tied to.
    await waitFor(() => expect(fx.calls.at(-1)).toEqual(['cost-create', { ...COSTS[1], notes: 'from the server' }]));
    await screen.findByText('Cost restored');
    await waitFor(() => expect(rows()).toEqual(COSTS.map((c) => c.description)));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('saves the row it was holding when the database hands nothing back', async () => {
    fx.deleteAnswer = null;
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete cost: Vet check for Onyx' }));
    await waitFor(() => expect(fx.calls).toEqual([['cost-delete', 'c3']]));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Undo' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1));
    await waitFor(() => expect(fx.calls.at(-1)).toEqual(['cost-create', COSTS[2]]));
    await waitFor(() => expect(rows()).toEqual(COSTS.map((c) => c.description)));
  });

  it('puts the row back and says so when the delete fails', async () => {
    fx.failDelete = new Error('network');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete cost: Incubator' }));
    await screen.findByText('Could not delete the cost. Please try again.');
    expect(rows()).toEqual(COSTS.map((c) => c.description));
    expect(fx.calls).toEqual([['cost-delete', 'c2']]);
    expect(fx.toasts).toEqual(['Error']);
  });

  it('puts the row back for a guest, without a second notice', async () => {
    fx.failDelete = Object.assign(new Error('Create an account to delete records.'), { isGuestBlock: true });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete cost: Incubator' }));
    await waitFor(() => expect(fx.calls).toEqual([['cost-delete', 'c2']]));
    await waitFor(() => expect(rows()).toEqual(COSTS.map((c) => c.description)));
    expect(fx.toasts).toEqual([]);
  });
});
