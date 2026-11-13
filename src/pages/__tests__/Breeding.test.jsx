// @vitest-environment jsdom
// The Breeding page after the planners moved in (experience review, work
// package WP-6): one tab bar, the old planner addresses forward to their
// tab, a pairing picked in "Pairing ideas" is not picked again in the
// new-plan form, the pair limit is said before the form, and deleting a
// plan says exactly what goes.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ user: null, geckos: [], plans: [], eggs: [], calls: [] }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: fx.user }) }));
vi.mock('@/api/appClient', () => ({ api: { auth: { me: async () => fx.user } } }));
vi.mock('@/lib/geckoAccess', () => ({ getVisibleGeckos: async () => fx.geckos }));
vi.mock('@/entities/all', () => ({
  User: { me: async () => fx.user },
  WeightRecord: { filter: async () => [] },
  BreedingPlan: {
    filter: async () => fx.plans,
    create: async (row) => { fx.calls.push(['create-plan', row]); return { id: 'plan-new', ...row }; },
    update: async (id, patch) => { fx.calls.push(['update-plan', id, patch]); return { id, ...patch }; },
    delete: async (id) => { fx.calls.push(['delete-plan', id]); return {}; },
  },
  Egg: {
    filter: async (query) => (query?.breeding_plan_id
      ? fx.eggs.filter((egg) => egg.breeding_plan_id === query.breeding_plan_id)
      : fx.eggs),
    delete: async (id) => { fx.calls.push(['delete-egg', id]); return {}; },
  },
}));
vi.mock('@/components/notifications/NotificationService', () => ({ notifyFollowersNewBreedingPlan: async () => {} }));
vi.mock('@/lib/traitValueTable', () => ({ loadTraitValueIndex: async () => ({ traits: new Map() }) }));
vi.mock('@/lib/sellTime', () => ({ loadSellTimeModel: async () => ({ allowed: false }) }));
vi.mock('@/lib/upgradePrompt', () => ({ upgradePromptShown: () => {} }));
vi.mock('@/components/subscription/UpgradePlansButton', () => ({ default: ({ children }) => <button type="button">{children}</button> }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));
vi.mock('@/functions/generateCalendarEvent', () => ({ generateCalendarEvent: async () => ({ data: '' }) }));
// Parts of the page this test is not about.
vi.mock('@/components/breeding/Hatchery', () => ({ default: () => <p>hatchery stand-in</p> }));
vi.mock('@/components/breeding/GeneticCalculatorTab', () => ({ default: () => <p>calculator stand-in</p> }));
vi.mock('@/components/breeding/BreedingValueStats', () => ({ default: () => null }));
vi.mock('@/components/breeding/SeasonProjectionPanel', () => ({ default: () => null }));
vi.mock('@/components/breeding/GeneticsModal', () => ({ default: () => null }));
vi.mock('@/components/breeding/PlanDetails', () => ({ default: () => null }));
vi.mock('@/components/breeding/AddEggsDialog', () => ({ default: () => null }));

import Breeding from '@/pages/Breeding';
import PairingPlannerRedirect from '@/pages/PairingPlanner';
import BreedingSeasonRedirect from '@/pages/BreedingSeason';
import { Toaster } from '@/components/ui/toaster';

installDomHarness();

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}{location.search}</p>;
}

function open(path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/Breeding" element={<Breeding />} />
          <Route path="/PairingPlanner" element={<PairingPlannerRedirect />} />
          <Route path="/BreedingSeason" element={<BreedingSeasonRedirect />} />
          <Route path="*" element={<p>another page</p>} />
        </Routes>
        <Where />
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const openTab = async () => (await screen.findByRole('tab', { selected: true })).textContent;

// One male and two females: Onyx x Aria is already a plan, Onyx x Harley is not.
const ONYX = { id: 'g-onyx', name: 'Onyx', sex: 'Male', gecko_id_code: 'GI-001', morph_tags: ['Harlequin'] };
const ARIA = { id: 'g-aria', name: 'Aria', sex: 'Female', gecko_id_code: 'GI-002', morph_tags: ['Dalmatian'] };
const HARLEY = { id: 'g-harley', name: 'Harley', sex: 'Female', gecko_id_code: 'GI-003', morph_tags: ['Pinstripe'] };
const ONYX_ARIA = { id: 'plan-1', sire_id: 'g-onyx', dam_id: 'g-aria', archived: false, pairing_date: '2026-09-01', created_date: '2026-09-01T10:00:00Z', created_by: 'breeder@example.com' };

beforeEach(() => {
  fx.user = { email: 'breeder@example.com', full_name: 'Sam', membership_tier: 'breeder' };
  fx.geckos = [ONYX, ARIA, HARLEY];
  fx.plans = [ONYX_ARIA];
  fx.eggs = [
    { id: 'egg-1', breeding_plan_id: 'plan-1', lay_date: '2026-10-01', status: 'Incubating' },
    { id: 'egg-2', breeding_plan_id: 'plan-1', lay_date: '2026-10-01', status: 'Incubating' },
  ];
  fx.calls = [];
});

describe('the Breeding page', () => {
  it('is headed "Breeding" and has one tab bar with the six tabs, in place of the "Breeding Tools" row', async () => {
    open('/Breeding');
    // The counts used to follow the tab bar by one frame, and a busy CI
    // machine read "Plans (0)" (13 November; fixed in Breeding.jsx). Waiting
    // for the labels keeps the test from depending on timing either way.
    await waitFor(() => expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Plans (1)', 'Hatchery', 'Pairing ideas', 'Season', 'Genetics', 'Archive (0)',
    ]));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Breeding');
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(screen.queryByText('Breeding Tools')).toBeNull();
    expect(screen.queryByText(/Breeding Management|Project Manager/)).toBeNull();
  });

  it('lists a plan whose sire and dam are no longer in the collection', async () => {
    // Deleted or transferred parents: the plan stays, with an empty search.
    fx.plans = [ONYX_ARIA, { ...ONYX_ARIA, id: 'plan-2', sire_id: 'g-gone', dam_id: 'g-gone-too' }];
    open('/Breeding');
    expect(await screen.findByRole('tab', { name: 'Plans (2)' })).toBeTruthy();
  });

  it('still opens the tabs that Today and the guided demo link to', async () => {
    open('/Breeding?tab=hatchery');
    expect(await screen.findByText('hatchery stand-in')).toBeTruthy();
    expect(await openTab()).toBe('Hatchery');
  });

  it('keeps Clutch Lab and Family tree as two links on the Genetics tab', async () => {
    open('/Breeding?tab=genetics');
    const more = await screen.findByRole('navigation', { name: 'More genetics tools' });
    expect(within(more).getByRole('link', { name: /Clutch Lab/ }).getAttribute('href')).toBe('/calculator/learn');
    expect(within(more).getByRole('link', { name: /Family tree/ }).getAttribute('href')).toBe('/Pedigree');
  });
});

describe('the old planner addresses', () => {
  it('/PairingPlanner lands on the Pairing ideas tab and keeps its query', async () => {
    open('/PairingPlanner?utm_source=weekly-notes');
    expect(await openTab()).toBe('Pairing ideas');
    expect(screen.getByTestId('where').textContent).toBe('/Breeding?utm_source=weekly-notes&tab=pairing-ideas');
    // The planner itself, with no second page heading.
    expect(await screen.findByText('What is your goal?')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('/BreedingSeason lands on the Season tab, which has one button to the Season Planner', async () => {
    open('/BreedingSeason');
    expect(await openTab()).toBe('Season');
    expect(screen.getByTestId('where').textContent).toBe('/Breeding?tab=season');
    const link = await screen.findByRole('link', { name: 'Open the Season Planner: tasks, feeding groups and notes' });
    expect(link.getAttribute('href')).toBe('/ProjectManager');
    // The planner's five tabs are not nested inside this page.
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(screen.getByText('Onyx x Aria')).toBeTruthy();
  });
});

describe('planning a pairing picked in Pairing ideas', () => {
  it('opens the new-plan form with that sire and dam chosen, so neither is picked again', async () => {
    open('/Breeding?tab=pairing-ideas');
    fireEvent.click(await screen.findByRole('button', { name: 'Safest pairings' }));
    // Onyx x Aria already has a plan; Onyx x Harley is the one on offer.
    expect(await screen.findByRole('button', { name: 'View plan' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Plan this pairing/ }));

    const form = await screen.findByRole('dialog');
    expect(within(form).getByText('Create New Breeding Plan')).toBeTruthy();
    expect(within(form).getByLabelText('Sire (Male)').textContent).toContain('Onyx');
    expect(within(form).getByLabelText('Dam (Female)').textContent).toContain('Harley');

    // Straight to Create Plan, with no field touched.
    fireEvent.click(within(form).getByRole('button', { name: 'Create Plan' }));
    await waitFor(() => expect(fx.calls.some(([name]) => name === 'create-plan')).toBe(true));
    const [, created] = fx.calls.find(([name]) => name === 'create-plan');
    expect(created).toMatchObject({ sire_id: 'g-onyx', dam_id: 'g-harley', breeding_id: 'GI-001xGI-003' });
    expect(await screen.findByText('Breeding plan created')).toBeTruthy();
  });

  it('"View plan" on a pairing that has a plan shows that plan on the Plans tab', async () => {
    open('/Breeding?tab=pairing-ideas');
    fireEvent.click(await screen.findByRole('button', { name: 'Safest pairings' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View plan' }));
    expect(await openTab()).toBe('Plans (1)');
    expect(await screen.findByRole('button', { name: /Collapse/ })).toBeTruthy();
  });
});

describe('the pair limit (a Free member may have 1 active pair)', () => {
  beforeEach(() => { fx.user = { ...fx.user, membership_tier: 'free' }; });

  it('at the limit, "New Breeding Plan" shows the notice at once and never the form', async () => {
    open('/Breeding');
    // Wait for the plans, so the limit check has the one active pair.
    await screen.findByRole('tab', { name: 'Plans (1)' });
    fireEvent.click(screen.getByRole('button', { name: 'New Breeding Plan' }));
    expect(await screen.findByText('Breeding Pair Limit Reached')).toBeTruthy();
    expect(screen.queryByText('Create New Breeding Plan')).toBeNull();
    expect(screen.queryByLabelText('Sire (Male)')).toBeNull();
  });

  it('at the limit, a pairing handed over from Pairing ideas shows the notice too', async () => {
    open('/Breeding?tab=pairing-ideas');
    fireEvent.click(await screen.findByRole('button', { name: 'Safest pairings' }));
    fireEvent.click(await screen.findByRole('button', { name: /Plan this pairing/ }));
    expect(await screen.findByText('Breeding Pair Limit Reached')).toBeTruthy();
    expect(screen.queryByText('Create New Breeding Plan')).toBeNull();
  });

  it('under the limit, the form opens', async () => {
    fx.plans = [];
    fx.eggs = [];
    open('/Breeding');
    await screen.findAllByRole('tab');
    fireEvent.click(screen.getByRole('button', { name: 'New Breeding Plan' }));
    expect(await screen.findByText('Create New Breeding Plan')).toBeTruthy();
    expect(screen.queryByText('Breeding Pair Limit Reached')).toBeNull();
  });

  it('an archived plan does not count toward the limit', async () => {
    fx.plans = [{ ...ONYX_ARIA, archived: true }];
    open('/Breeding');
    // Wait for the plans, so the check really sees the archived one.
    await screen.findByRole('tab', { name: 'Archive (1)' });
    fireEvent.click(screen.getByRole('button', { name: 'New Breeding Plan' }));
    expect(await screen.findByText('Create New Breeding Plan')).toBeTruthy();
  });
});

describe('deleting a breeding plan', () => {
  it('asks first, says exactly what goes, then deletes the eggs and the plan', async () => {
    open('/Breeding');
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Delete Plan/ }));

    const ask = await screen.findByRole('alertdialog');
    expect(within(ask).getByText('Delete the Onyx x Aria plan?')).toBeTruthy();
    expect(within(ask).getByText('This deletes the plan and its 2 eggs. Hatched geckos stay in your collection. This cannot be undone.')).toBeTruthy();
    expect(fx.calls).toEqual([]);

    fireEvent.click(within(ask).getByRole('button', { name: 'Delete plan and eggs' }));
    await waitFor(() => expect(fx.calls).toEqual([
      ['delete-egg', 'egg-1'],
      ['delete-egg', 'egg-2'],
      ['delete-plan', 'plan-1'],
    ]));
    expect(await screen.findByText('Breeding plan deleted')).toBeTruthy();
  });
});
