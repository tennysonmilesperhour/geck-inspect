// @vitest-environment jsdom
// Following an upgrade link remembers the page it was on, so the plans
// page can send the member back after they pay (finding J5).
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import UpgradePlansButton, { UpgradePlansLink } from '../UpgradePlansButton';
import { readUpgradeReturn } from '../upgradeReturn';

installDomHarness();

describe('upgrade links remember where the member was', () => {
  it('stores the current page when the plans button is used', () => {
    window.history.replaceState(null, '', '/Breeding?tab=eggs');
    render(
      <MemoryRouter>
        <UpgradePlansButton limitType="breeding_pairs" surface="plan_limit_pairs" trackShown={false}>See plans</UpgradePlansButton>
      </MemoryRouter>,
    );
    expect(readUpgradeReturn()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'See plans' }));
    expect(readUpgradeReturn()).toBe('/Breeding?tab=eggs');
  });

  it('stores the current page when the inline plans link is used', () => {
    window.history.replaceState(null, '', '/MyGeckos');
    render(
      <MemoryRouter>
        <UpgradePlansLink limitType="geckos" surface="plan_limit_geckos">See plans</UpgradePlansLink>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'See plans' }));
    expect(readUpgradeReturn()).toBe('/MyGeckos');
  });

  it('does not store the plans page itself', () => {
    window.history.replaceState(null, '', '/Membership?from_prompt=geckos');
    render(
      <MemoryRouter>
        <UpgradePlansLink limitType="geckos">See plans</UpgradePlansLink>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'See plans' }));
    expect(readUpgradeReturn()).toBeNull();
  });
});
