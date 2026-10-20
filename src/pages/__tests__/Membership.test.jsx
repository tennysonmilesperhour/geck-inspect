// @vitest-environment jsdom
// Membership page smoke test (plan item E3 30): the real page renders in
// jsdom, a member's plan button starts Stripe checkout with the plan they
// picked, and a refused checkout tells them so instead of failing quietly.
// Only the network edges are stubbed (Supabase, analytics, error reports).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness, watchConsoleErrors } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  member: null,
  invoke: null,
  captureEvent: null,
  reportError: null,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args) => fx.invoke(...args) } },
}));
vi.mock('@/entities/all', () => ({
  User: { me: async () => fx.member },
  PageConfig: { filter: async () => [] },
  SupportMessage: { create: async () => ({}) },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: fx.member, isAuthenticated: Boolean(fx.member) }) }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (...args) => fx.captureEvent(...args), ensurePostHog: async () => null }));
vi.mock('@/lib/telemetry', () => ({ reportError: (...args) => fx.reportError(...args) }));
vi.mock('@/lib/billingPortal', () => ({ openBillingPortal: vi.fn() }));

import MembershipPage from '@/pages/Membership';
import { Toaster } from '@/components/ui/toaster';
import { getTierPricing } from '@/lib/stripe-config';

installDomHarness();

function renderPage() {
  return render(
    <HelmetProvider>
      <MembershipPage />
      <Toaster />
    </HelmetProvider>,
  );
}

// The plan cards are headed by the plan name; the buy button is the one
// whose label comes from stripe-config, so copy changes there carry over.
async function breederButton() {
  const label = getTierPricing('breeder', 'monthly').cta;
  return screen.findByRole('button', { name: label });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/Membership');
  fx.member = {
    id: 'u1',
    email: 'keeper@example.com',
    full_name: 'Sam Keeper',
    membership_tier: 'free',
    subscription_status: null,
    free_trial_used: true,
  };
  fx.invoke = vi.fn();
  fx.captureEvent = vi.fn();
  fx.reportError = vi.fn();
});

describe('Membership page', () => {
  it('renders the plans for a signed-in free member, with no React warnings', async () => {
    const errors = watchConsoleErrors();
    renderPage();
    expect(await breederButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: getTierPricing('keeper', 'monthly').cta })).toBeTruthy();
    // The free member's own plan is marked, not sold back to them.
    expect(await screen.findByRole('button', { name: 'Current plan' })).toBeTruthy();
    expect(fx.captureEvent).toHaveBeenCalledWith('membership_viewed');
    expect(errors).toEqual([]);
  });

  it('starts Stripe checkout for the plan and cycle the member picked, then follows the session link', async () => {
    const user = userEvent.setup();
    const session = `${window.location.origin}/Membership#stripe-session`;
    fx.invoke.mockResolvedValue({ data: { url: session }, error: null });
    renderPage();
    await user.click(await breederButton());

    expect(fx.invoke).toHaveBeenCalledTimes(1);
    const [fn, { body }] = fx.invoke.mock.calls[0];
    expect(fn).toBe('stripe-checkout');
    expect(body).toMatchObject({
      tier: 'breeder',
      billing_cycle: 'monthly',
      price_id: getTierPricing('breeder', 'monthly').price_id,
      intent: 'purchase',
    });
    expect(fx.captureEvent).toHaveBeenCalledWith('checkout_started', expect.objectContaining({ tier: 'breeder' }));
    // The page hands the browser to the session link Stripe returned.
    await vi.waitFor(() => expect(window.location.hash).toBe('#stripe-session'));
  });

  it('shows the reason when checkout is refused, and the button works again', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fx.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { text: async () => JSON.stringify({ error: 'Stripe is not answering right now.' }) },
      },
    });
    renderPage();
    const button = await breederButton();
    await user.click(button);

    const toast = await screen.findByText('Checkout unavailable');
    expect(within(toast.closest('li') || document.body).getByText('Stripe is not answering right now.')).toBeTruthy();
    expect(fx.reportError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ component: 'Membership' }));
    // The member is not left on a spinner: the plan button is usable again.
    expect((await breederButton()).hasAttribute('disabled')).toBe(false);
  });

  it('keeps a guest in the demo from reaching checkout', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('geck_inspect_guest_mode', '1');
    renderPage();
    await user.click(await breederButton());
    expect(await screen.findByText('Guest demo is view-only')).toBeTruthy();
    expect(fx.invoke).not.toHaveBeenCalled();
  });
});
