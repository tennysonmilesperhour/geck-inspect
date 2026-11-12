// @vitest-environment jsdom
// After paying, a member who was sent to the plans page by a limit gets
// one button back to where they were (experience review, finding J5).
// With nothing remembered, or with a path that is not inside the app, the
// confirmation reads as it always has.
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ paid: null, captureEvent: null }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('@/entities/all', () => ({
  User: { me: async () => null },
  PageConfig: { filter: async () => [] },
  SupportMessage: { create: async () => ({}) },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: fx.paid, isAuthenticated: true }) }));
vi.mock('@/lib/userProfile', () => ({
  currentAuthUser: async () => ({ id: 'u1', email: 'keeper@example.com' }),
  loadUserProfile: async () => fx.paid,
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: (...args) => fx.captureEvent(...args), ensurePostHog: async () => null }));
vi.mock('@/lib/telemetry', () => ({ reportError: vi.fn() }));
vi.mock('@/lib/billingPortal', () => ({ openBillingPortal: vi.fn() }));

import MembershipPage from '@/pages/Membership';
import { rememberUpgradeReturn } from '@/components/subscription/upgradeReturn';

installDomHarness();

const RETURN_KEY = 'geck_upgrade_return_path';

function renderAfterCheckout() {
  window.history.replaceState(null, '', '/Membership?checkout=success');
  return render(
    <HelmetProvider>
      <MembershipPage />
    </HelmetProvider>,
  );
}

beforeEach(() => {
  fx.captureEvent = vi.fn();
  fx.paid = {
    id: 'u1',
    email: 'keeper@example.com',
    membership_tier: 'keeper',
    membership_billing_cycle: 'monthly',
    stripe_subscription_id: 'sub_test',
  };
});

describe('Membership page after checkout', () => {
  it('offers the way back to the page the member was stopped on, once', async () => {
    rememberUpgradeReturn('/MyGeckos?view=grid');
    renderAfterCheckout();

    expect(await screen.findByText("You're on Keeper. Carry on.")).toBeTruthy();
    const back = screen.getByRole('link', { name: 'Back to where you were' });
    expect(back.getAttribute('href')).toBe('/MyGeckos?view=grid');
    // Offered once: the remembered page is gone after it is shown.
    expect(window.sessionStorage.getItem(RETURN_KEY)).toBeNull();
    expect(fx.captureEvent).toHaveBeenCalledWith('checkout_completed', expect.objectContaining({ tier: 'keeper' }));
  });

  it('ignores a remembered path that leads off the site', async () => {
    window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path: 'https://evil.example/steal', at: Date.now() }));
    renderAfterCheckout();

    expect(await screen.findByText('Thank you. Your Keeper plan is active.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Back to where you were' })).toBeNull();
    expect(screen.queryByText("You're on Keeper. Carry on.")).toBeNull();

    window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path: '//evil.example/steal', at: Date.now() }));
    expect(document.querySelector('a[href*="evil.example"]')).toBeNull();
  });

  it('reads as before when nothing was remembered', async () => {
    renderAfterCheckout();
    expect(await screen.findByText('Thank you. Your Keeper plan is active.')).toBeTruthy();
    expect(screen.getByText('Everything in your plan is unlocked now.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Back to where you were' })).toBeNull();
  });

  it('does not offer the way back while the plan is still unconfirmed', async () => {
    rememberUpgradeReturn('/MyGeckos');
    fx.paid = { ...fx.paid, membership_tier: 'free', stripe_subscription_id: null };
    renderAfterCheckout();
    expect(await screen.findByText('Thank you. Your payment went through.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Back to where you were' })).toBeNull();
    // Still remembered for when the plan does show.
    expect(window.sessionStorage.getItem(RETURN_KEY)).not.toBeNull();
  });
});
