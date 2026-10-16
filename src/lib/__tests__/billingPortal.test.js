// openBillingPortal asks the stripe-billing-portal function for the
// member's Stripe portal address and sends the browser there. It now loads
// the Supabase client when it is called (src/lib/supabaseLazy.js) instead
// of with the pages that import it; these tests pin that it still sends
// the same request and reports the same errors.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ invoke: vi.fn(), native: false, customerInfo: null }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args) => fx.invoke(...args) } },
}));
vi.mock('@/lib/revenuecat', () => ({
  isNativePlatform: () => fx.native,
  fetchCustomerInfo: async () => fx.customerInfo,
}));

const { openBillingPortal } = await import('@/lib/billingPortal');
const { __resetSupabaseLazy, peekSupabase } = await import('@/lib/supabaseLazy');

let location;
beforeEach(() => {
  fx.invoke.mockReset();
  fx.native = false;
  fx.customerInfo = null;
  __resetSupabaseLazy();
  location = { origin: 'https://geckinspect.com', href: 'https://geckinspect.com/Membership' };
  vi.stubGlobal('window', { location });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openBillingPortal', () => {
  it('loads the client on the click and sends the member to the portal', async () => {
    expect(peekSupabase()).toBeNull();
    fx.invoke.mockResolvedValue({ data: { url: 'https://billing.stripe.com/p/session/abc' }, error: null });
    await expect(openBillingPortal({ returnPath: '/Settings' })).resolves.toBe('https://billing.stripe.com/p/session/abc');
    expect(fx.invoke).toHaveBeenCalledWith('stripe-billing-portal', {
      body: { returnUrl: 'https://geckinspect.com/Settings' },
    });
    expect(location.href).toBe('https://billing.stripe.com/p/session/abc');
    expect(peekSupabase()).not.toBeNull();
  });

  it('returns to Membership by default', async () => {
    fx.invoke.mockResolvedValue({ data: { url: 'https://billing.stripe.com/p/x' }, error: null });
    await openBillingPortal();
    expect(fx.invoke.mock.calls[0][1].body.returnUrl).toBe('https://geckinspect.com/Membership');
  });

  it('reports the code the function sent back', async () => {
    fx.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { status: 400, text: async () => JSON.stringify({ error: 'lifetime', message: 'Lifetime has no billing to manage.' }) },
      },
    });
    await expect(openBillingPortal()).rejects.toMatchObject({ code: 'lifetime', status: 400, message: 'Lifetime has no billing to manage.' });
    expect(location.href).toBe('https://geckinspect.com/Membership');
  });

  it('calls an expired session unauthenticated', async () => {
    fx.invoke.mockResolvedValue({ data: null, error: { message: 'Unauthorized', context: { status: 401, text: async () => '' } } });
    await expect(openBillingPortal()).rejects.toMatchObject({ code: 'unauthenticated', status: 401 });
  });

  it('says the portal is unavailable when no address comes back', async () => {
    fx.invoke.mockResolvedValue({ data: {}, error: null });
    await expect(openBillingPortal()).rejects.toMatchObject({ code: 'portal_unavailable' });
  });

  it('in the phone app, opens the store subscription page without the client', async () => {
    fx.native = true;
    fx.customerInfo = { managementURL: 'https://apps.apple.com/account/subscriptions' };
    await expect(openBillingPortal()).resolves.toBe('https://apps.apple.com/account/subscriptions');
    expect(fx.invoke).not.toHaveBeenCalled();
    expect(peekSupabase()).toBeNull();
  });
});
