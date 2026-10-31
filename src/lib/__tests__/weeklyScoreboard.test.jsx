import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';

// Tests run in Node; the UI kit reads window.self at import time.
const state = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null });
  return { rpc: null, entries: null, inserted: [], deleted: [], insertError: null };
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
        insert: (row) => { state.inserted.push(row); return Promise.resolve({ error: state.insertError }); },
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
  state.insertError = null;
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
  // admin_scoreboard() returns jsonb rows, whose keys come back shortest
  // first, not in the view's column order.
  const rows = [
    { sent: 9, week: '2026-09-28', opened: 3, bounced: 0, clicked: 1, delivered: 9, complained: 0, email_type: 'weighin_reminder' },
    { sent: 12, week: '2026-10-12', opened: 5, bounced: 1, clicked: 2, delivered: 10, complained: 0, email_type: 'weighin_reminder' },
    { sent: 4, week: '2026-10-12', opened: 0, bounced: 0, clicked: 0, delivered: 0, complained: 1, email_type: 'lifecycle_day0' },
  ];
  state.rpc = Promise.resolve({ data: { ...BOARD, email_delivery: { available: true, rows } }, error: null });
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const table = tree.root.findByType('table');
  const cellsOf = (tr) => tr.findAll((n) => n.type === 'th' || n.type === 'td').map((c) => c.children.join(''));
  const [head, ...body] = table.findAll((n) => n.type === 'tr').map(cellsOf);
  expect(head).toEqual(['Week of', 'Email', 'Sent', 'Delivered', 'Opened', 'Opened of delivered', 'Clicked', 'Bounced', 'Marked spam']);
  // Newest week first, then by email type.
  expect(body).toEqual([
    ['12 Oct 2026', 'lifecycle day0', '4', '0', '0', '', '0', '0', '1'],
    ['12 Oct 2026', 'weighin reminder', '12', '10', '5', '50%', '2', '1', '0'],
    ['28 Sep 2026', 'weighin reminder', '9', '9', '3', '33%', '1', '0', '0'],
  ]);
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

it('says what it leaves out: App Store sandbox purchases and internal accounts', async () => {
  state.rpc = Promise.resolve({ data: { ...BOARD, left_out: { sandbox_store: 1, internal_accounts: 5 } }, error: null });
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const t = text();
  expect(t).toContain('1 App Store sandbox purchase (TestFlight or App Review) left out');
  expect(t).toContain('5 internal accounts');
  expect(t).toContain('App Store sandbox purchases (TestFlight, App Review) still unlock the plan but are not money');
  expect(t).toContain('The admin and internal accounts left out');
  expect(t).not.toContain('still on the older scoreboard');
});

it('warns when the database function is too old to leave sandbox and internal accounts out', async () => {
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  expect(text()).toContain('still on the older scoreboard');
});

it('counts a prepaid Founding Breeder year as a paying breeder at its own monthly amount', async () => {
  state.rpc = Promise.resolve({ data: {
    ...BOARD,
    paid_plans: [...BOARD.paid_plans, { tier: 'breeder', cycle: 'annual', source: 'prepaid', comped: false, n: 1, monthly_usd: 10 }],
    left_out: { sandbox_store: 0, internal_accounts: 0 },
  }, error: null });
  await act(async () => { tree = create(<WeeklyScoreboard />); });
  const t = text();
  expect(t).toContain('Includes 1 prepaid Founding Breeder year recorded below');
  // $2.99 keeper plus $10.00 prepaid.
  expect(t).toContain('$12.99');
  expect(t).toContain('$10.00 of it from prepaid years');
  expect(t).toContain('even when the breeder');
});

it('saves a prepaid year only with a breeder and an amount', async () => {
  const onSaved = vi.fn();
  await act(async () => { tree = create(<EntryForm onSaved={onSaved} />); });
  const inputs = () => tree.root.findAll((n) => n.type === 'input');
  await act(async () => { tree.root.findByType('select').props.onChange({ target: { value: 'prepaid' } }); });
  // Date, breeder, amount, note.
  expect(inputs()).toHaveLength(4);
  await act(async () => { inputs()[2].props.onChange({ target: { value: '120' } }); });
  await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  expect(state.inserted).toHaveLength(0);

  await act(async () => { inputs()[1].props.onChange({ target: { value: '  Crested Co  ' } }); });
  await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  expect(state.inserted[0]).toMatchObject({ kind: 'prepaid', breeder_name: 'Crested Co', amount_usd: 120 });
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Prepaid year (Founding Breeder) saved.');
});

it('explains a prepaid year refused by a database that predates them', async () => {
  state.insertError = { code: '23514', message: 'new row for relation "scoreboard_entries" violates check constraint "scoreboard_entries_kind_check"' };
  await act(async () => { tree = create(<EntryForm />); });
  const inputs = () => tree.root.findAll((n) => n.type === 'input');
  await act(async () => { tree.root.findByType('select').props.onChange({ target: { value: 'prepaid' } }); });
  await act(async () => { inputs()[1].props.onChange({ target: { value: 'Crested Co' } }); });
  await act(async () => { inputs()[2].props.onChange({ target: { value: '120' } }); });
  await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  expect(text()).toContain('the database does not take prepaid years yet');
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
