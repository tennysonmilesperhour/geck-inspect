import { describe, it, expect } from 'vitest';
import { fakeSupabase, fakeFetch, loadFunction, postJson } from './edgeHarness';

// stripe-checkout must never start a second charge for a member who
// already pays: not through the App Store or Google Play, and not from a
// second tab or a double tap on the Membership page.

const ENV = {
  STRIPE_SECRET_KEY: 'sk_test_x',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
};
const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'keeper@example.com' };
const KEEPER_MONTHLY = 'price_1TUxEsLBdc4xGjxqyPV4DOYb';
const BREEDER_LIFETIME = 'price_1UQV94LBdc4xGjxqwzNWvXyI';

function setup({ storeRows = [], storeError = null, openSessions = [], expireFails = false, listFails = false, profile = {} } = {}) {
  const db = fakeSupabase((call) => {
    if (call.table === 'profiles') {
      return { data: { stripe_customer_id: 'cus_test', subscription_status: null, membership_billing_cycle: null, ...profile }, error: null };
    }
    if (call.table === 'revenuecat_entitlements') return { data: storeError ? null : storeRows, error: storeError };
    return undefined;
  }, { user: USER });
  const net = fakeFetch(({ url, init }) => {
    const path = url.replace('https://api.stripe.com/v1', '');
    if (path.startsWith('/subscriptions?')) return { body: { data: [] } };
    if (path.startsWith('/checkout/sessions?')) {
      return listFails ? { status: 500, body: { error: { message: 'boom' } } } : { body: { data: openSessions } };
    }
    if (/^\/checkout\/sessions\/[^/]+\/expire$/.test(path)) {
      return expireFails
        ? { status: 400, body: { error: { message: 'Only Checkout Sessions with a status in ["open"] can be expired.' } } }
        : { body: { id: path.split('/')[3], status: 'expired' } };
    }
    if (path === '/checkout/sessions' && init.method === 'POST') {
      return { body: { id: 'cs_new', url: 'https://checkout.stripe.com/c/cs_new' } };
    }
    return { status: 404, body: { error: { message: `unexpected ${path}` } } };
  });
  const fn = loadFunction('stripe-checkout', {
    env: ENV,
    globals: { createClient: () => db.client, fetch: net.fetch },
  });
  const stripePaths = () => net.requests.map((r) => `${r.init.method || 'GET'} ${r.url.replace('https://api.stripe.com/v1', '').split('?')[0]}`);
  return { fn, net, db, stripePaths };
}

const buy = (fn, body) => fn.handle(postJson('https://x.test/', body, { authorization: 'Bearer member-jwt' }));

describe('stripe-checkout refuses a member who pays through a phone store', () => {
  it('refuses an active App Store subscription before touching Stripe', async () => {
    const { fn, stripePaths } = setup({
      storeRows: [{ is_active: true, expires_at: '2099-01-01T00:00:00Z', store: 'app_store' }],
    });
    const res = await buy(fn, { tier: 'keeper', billing_cycle: 'monthly', price_id: KEEPER_MONTHLY });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'already_subscribed_store' });
    expect(stripePaths()).toEqual([]);
  });

  it('refuses a lifetime purchase too, since Stripe cannot cancel a store plan', async () => {
    const { fn } = setup({ storeRows: [{ is_active: true, expires_at: null, store: 'play_store' }] });
    const res = await buy(fn, { tier: 'breeder', billing_cycle: 'lifetime', price_id: BREEDER_LIFETIME });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'already_subscribed_store' });
  });

  it('lets test store, promotional and expired entitlements through', async () => {
    const { fn } = setup({
      storeRows: [
        { is_active: true, expires_at: null, store: 'test_store' },
        { is_active: true, expires_at: null, store: 'promotional' },
        { is_active: true, expires_at: '2020-01-01T00:00:00Z', store: 'app_store' },
      ],
    });
    const res = await buy(fn, { tier: 'keeper', billing_cycle: 'monthly', price_id: KEEPER_MONTHLY });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'cs_new' });
  });

  it('fails closed when the store check cannot run', async () => {
    const { fn, stripePaths } = setup({ storeError: { message: 'db down' } });
    const res = await buy(fn, { tier: 'keeper', billing_cycle: 'monthly', price_id: KEEPER_MONTHLY });
    expect(res.status).toBe(502);
    expect(stripePaths()).toEqual([]);
  });
});

describe('stripe-checkout keeps only the newest Checkout page payable', () => {
  it('expires an open page from another tab before making a new one', async () => {
    const { fn, stripePaths } = setup({ openSessions: [{ id: 'cs_old_tab' }] });
    const res = await buy(fn, { tier: 'keeper', billing_cycle: 'monthly', price_id: KEEPER_MONTHLY });
    expect(res.status).toBe(200);
    const paths = stripePaths();
    expect(paths).toContain('POST /checkout/sessions/cs_old_tab/expire');
    expect(paths.indexOf('POST /checkout/sessions/cs_old_tab/expire')).toBeLessThan(paths.lastIndexOf('POST /checkout/sessions'));
  });

  it('does the same for a lifetime purchase', async () => {
    const { fn, stripePaths } = setup({ openSessions: [{ id: 'cs_old_life' }] });
    const res = await buy(fn, { tier: 'breeder', billing_cycle: 'lifetime', price_id: BREEDER_LIFETIME });
    expect(res.status).toBe(200);
    expect(stripePaths()).toContain('POST /checkout/sessions/cs_old_life/expire');
  });

  it('refuses when an open page is being paid at that moment, and makes no new page', async () => {
    const { fn, stripePaths } = setup({ openSessions: [{ id: 'cs_paying_now' }], expireFails: true });
    const res = await buy(fn, { tier: 'keeper', billing_cycle: 'monthly', price_id: KEEPER_MONTHLY });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'checkout_in_progress' });
    expect(stripePaths()).not.toContain('POST /checkout/sessions');
  });

  it('fails closed when Stripe cannot list open pages', async () => {
    const { fn, stripePaths } = setup({ listFails: true });
    const res = await buy(fn, { tier: 'keeper', billing_cycle: 'monthly', price_id: KEEPER_MONTHLY });
    expect(res.status).toBe(502);
    expect(stripePaths()).not.toContain('POST /checkout/sessions');
  });

  it('leaves an open page alone when it refuses a trial already used', async () => {
    for (const [intent, profile] of [['trial', { free_trial_used: true }], ['keeper_trial', { keeper_trial_used: true }]]) {
      const { fn, stripePaths } = setup({ openSessions: [{ id: 'cs_other_tab', status: 'open' }], profile });
      const res = await buy(fn, { tier: 'keeper', billing_cycle: 'monthly', price_id: KEEPER_MONTHLY, intent });
      expect(res.status).toBe(400);
      expect((await res.json()).trial_already_used).toBe(true);
      expect(stripePaths().some((p) => p.endsWith('/expire'))).toBe(false);
    }
  });
});

