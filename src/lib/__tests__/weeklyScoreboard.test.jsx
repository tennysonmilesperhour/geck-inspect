import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';

// Tests run in Node; the UI kit reads window.self at import time.
const state = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null });
  return { rpc: null, entries: null, inserted: [], deleted: [] };
});
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/supabaseClient', () => {
  const listQuery = () => {
    const q = {
      order: () => q,
      limit: () => state.entries,
    };
    return q;
  };
  return {
    supabase: {
      rpc: () => state.rpc,
      from: () => ({
        select: () => listQuery(),
        insert: (row) => { state.inserted.push(row); return Promise.resolve({ error: null }); },
        delete: () => ({ eq: (_col, id) => { state.deleted.push(id); return Promise.resolve({ error: null }); } }),
      }),
    },
  };
});

import WeeklyScoreboard, { EntryForm } from '../../components/admin/WeeklyScoreboard';
import GrowthFunnelCard from '../../components/admin/GrowthFunnelCard';

const BOARD = {
  generated_at: '2026-10-15T15:00:00Z',
  paid_plans: [
    { tier: 'breeder', cycle: 'monthly', source: 'stripe', comped: true, n: 1 },
    { tier: 'keeper', cycle: 'monthly', source: 'stripe', comped: false, n: 1 },
  ],
  unverified_lifetime: 1,
  passports: { issued: 0, issued_admin: 5, claimed: 0, claimed_7d: 0, claimed_admin: 2, claimers_eligible_14d: 2, claimers_active_after_14d: 1 },
  activity: { weekly_active_breeders: 2, weekly_active_signed_in: 10, members: 62 },
  breeder_weeks: [{ weeks_ago: 0, ends_on: '2026-10-15', active: 2 }, { weeks_ago: 1, ends_on: '2026-10-08', active: 2 }],
  signups: { signups_7d: 3, first_gecko_eligible: 4, first_gecko_1d: 1 },
  email_delivery: { available: false, reason: 'missing' },
};

let tree;
function text() {
  return JSON.stringify(tree.toJSON());
}

beforeEach(() => {
  state.rpc = Promise.resolve({ data: BOARD, error: null });
  state.entries = Promise.resolve({ data: [
    { id: 'a', kind: 'conversation', entry_date: '2026-10-15', breeder_name: 'Lilly White breeder' },
    { id: 'b', kind: 'monthly_cost', entry_date: '2026-10-10', amount_usd: 64, created_date: '2026-10-10T00:00:00Z' },
  ], error: null });
  state.inserted = [];
  state.deleted = [];
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });

it('shows both activity definitions side by side with their definitions', async () => {
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const t = text();
  expect(t).toContain('Weekly active breeders (logging records)');
  expect(t).toContain('Weekly active members (signed in)');
  expect(t).toContain('logged a weigh-in, feeding, shed, vet visit or event on a gecko they own');
  expect(t).toContain('signed in, or used the app while signed in');
  expect(t).toContain('Out of ');
});

it('leaves the comped breeder out of paying and revenue and says so', async () => {
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const t = text();
  expect(t).toContain('more pay but also hold a comp, so are left out');
  expect(t).toContain('$2.99');
  expect(t).toContain('lifetime plan');
});

it('does not call its revenue figure by the Revenue card name, and says where the comped money went', async () => {
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const t = text();
  expect(t).toContain('Recurring revenue, comps left out');
  expect(t).not.toContain('Monthly recurring revenue');
  expect(t).toContain('Plus $5.99 from 1 comped payer, which the Revenue card on Overview counts');
  expect(t).toContain("Lower than the Revenue card's Monthly recurring whenever a payer also holds a comp");
});

it('shows the E5 targets with their dates', async () => {
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const t = text();
  expect(t).toContain('17 Nov 2026');
  expect(t).toContain('17 Dec 2026');
  expect(t).toContain('17 Jan 2027');
  expect(t).toContain('under $');
});

it('works without the email delivery view', async () => {
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  expect(text()).toContain('email_delivery_stats');
});

it('lists email delivery rows when the view exists', async () => {
  state.rpc = Promise.resolve({ data: { ...BOARD, email_delivery: { available: true, rows: [{ category: 'reminder', sent: 12, bounced: 1 }] } }, error: null });
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const t = text();
  expect(t).toContain('reminder');
  expect(t).toContain('bounced');
});

it('explains a missing migration instead of failing', async () => {
  state.rpc = Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_scoreboard' } });
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  expect(text()).toContain('20261015151500_scoreboard.sql');
});

it('saves a conversation without an amount and a cost with one', async () => {
  const onSaved = vi.fn();
  await act(async () => { tree = create(<EntryForm onSaved={onSaved} />); });
  const inputs = () => tree.root.findAll((n) => n.type === 'input');
  await act(async () => { inputs()[1].props.onChange({ target: { value: 'Harlequin breeder' } }); });
  await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  expect(state.inserted[0]).toMatchObject({ kind: 'conversation', breeder_name: 'Harlequin breeder', amount_usd: null });

  await act(async () => { tree.root.findByType('select').props.onChange({ target: { value: 'monthly_cost' } }); });
  await act(async () => { inputs()[1].props.onChange({ target: { value: '87.555' } }); });
  await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  expect(state.inserted[1]).toMatchObject({ kind: 'monthly_cost', breeder_name: null, amount_usd: 87.56 });
  expect(onSaved).toHaveBeenCalledTimes(2);
});

// The cost shows as a formatted string ("$64.00"), so the chip has to
// compare the plain amount. This failed before targetValue existed: the
// chip stayed amber even when the cost was under $100.
function costChip() {
  const chips = tree.root.findAll((node) => node.type === 'span'
    && typeof node.props.title === 'string'
    && node.props.title.startsWith('Day 30')
    && [].concat(node.props.children).join('').includes('under $100'));
  expect(chips).toHaveLength(1);
  return chips[0];
}

it('marks the day 30 cost target met when the newest cost is under $100', async () => {
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const chip = costChip();
  expect(chip.props.title).toContain(': met');
  expect(chip.props.className).toContain('emerald');
});

it('does not mark the day 30 cost target met at $100 or with no cost recorded', async () => {
  state.entries = Promise.resolve({ data: [
    { id: 'c', kind: 'monthly_cost', entry_date: '2026-10-12', amount_usd: 100, created_date: '2026-10-12T00:00:00Z' },
  ], error: null });
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  expect(costChip().props.title).not.toContain(': met');
  act(() => tree.unmount());

  state.entries = Promise.resolve({ data: [], error: null });
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  expect(text()).toContain('Not recorded');
  expect(costChip().props.title).not.toContain(': met');
});

it('gives the scoreboard a card of its own, so the Growth funnel title is at the top of its card', async () => {
  await act(async () => { tree = create(<GrowthFunnelCard />); });
  const cards = tree.toJSON();
  expect(Array.isArray(cards)).toBe(true);
  expect(cards).toHaveLength(2);
  expect(JSON.stringify(cards[0])).toContain('Weekly scoreboard');
  expect(JSON.stringify(cards[0])).not.toContain('Growth funnel');
  expect(JSON.stringify(cards[1])).not.toContain('Weekly scoreboard');
  expect(JSON.stringify(cards[1].children[0])).toContain('Growth funnel');
});
