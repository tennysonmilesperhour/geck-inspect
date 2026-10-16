// @vitest-environment jsdom
// The public genetics calculator loads its engine (the gene pickers,
// results and simulator, and the genetics library under them) after the
// page has drawn, from src/components/breeding/calculatorEngine.js. These
// tests check that it still computes once the engine is here: from typed
// shorthand, and from a shared link. Only the network edges are stubbed.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

vi.mock('@/api/appClient', () => ({
  // A signed-out visitor: the calculator stays in manual mode.
  api: { auth: { me: async () => { throw new Error('not signed in'); } } },
}));
vi.mock('@/entities/all', () => {
  const entity = { list: async () => [], filter: async () => [] };
  return { Gecko: entity, GeneticsTraitOverride: entity, PairingOutcomeLog: entity, MarketplaceCost: entity };
});
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

import GeneticCalculatorTool from '@/pages/GeneticCalculatorTool';
import { loadedCalculatorEngine } from '@/components/breeding/calculatorEngine';

installDomHarness();

function renderAt(path) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <GeneticCalculatorTool />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

// The engine download plus a first render of the results can take a
// moment on a slow test machine.
const SLOW = { timeout: 15000 };
const TEST_TIMEOUT = 30000;

describe('genetics calculator with its engine loaded on demand', () => {
  it('draws the page first, then computes a typed pairing once the engine is here', async () => {
    const user = userEvent.setup();
    expect(loadedCalculatorEngine()).toBeNull();
    renderAt('/calculator');
    // The heading is there before the engine; the pickers are not.
    expect(screen.getByRole('heading', { name: 'Crested Gecko Genetics Calculator' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Type a pairing in breeder shorthand' })).toBeNull();

    const box = await screen.findByRole('textbox', { name: 'Type a pairing in breeder shorthand' }, SLOW);
    expect(loadedCalculatorEngine()).not.toBeNull();
    await user.click(box);
    await user.paste('lilly white x lilly white');
    await user.click(screen.getByRole('button', { name: 'Fill parents' }));

    const summary = await screen.findByRole('region', { name: 'Result summary' }, SLOW);
    expect(within(summary).getByText(/Super Lilly White/).textContent).toMatch(/dies in the egg/);
    expect(summary.textContent).toContain('50%');
  }, TEST_TIMEOUT);

  it('computes a shared link, with the engine already here from the last visit', async () => {
    // A second visit in the same tab reuses the engine instead of fetching it again.
    expect(loadedCalculatorEngine()).not.toBeNull();
    renderAt('/calculator?sire=lilly_white:het,axanthic:visual&dam=axanthic:het');
    const summary = await screen.findByRole('region', { name: 'Result summary' }, SLOW);
    expect(summary.textContent).toMatch(/Lilly White/);
    expect(summary.textContent).toMatch(/Axanthic/);
  }, TEST_TIMEOUT);
});
