// Runs real Stripe events through supabase/functions/stripe-webhook against
// a fake database, to check the handler as a whole: a failed profile write
// makes Stripe retry, each event is applied once, the signature check, and
// that only membership checkouts change a plan.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  actionOf, fakeFetch, fakeSupabase, filterValue, functionSource, loadFunction, payloadOf,
} from './edgeHarness';

const SECRET = 'whsec_test_secret';
const keeperLifetime = 'price_1UQV93LBdc4xGjxq4AvXpui4';

function signedRequest(event, { secret = SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const payload = JSON.stringify(event);
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return new Request('https://example.test/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${sig}` },
    body: payload,
  });
}

// Default database: nothing logged yet, no profile on the customer, and
// every write succeeds. A test overrides one answer at a time.
function database(override = () => undefined) {
  return fakeSupabase((call) => {
    const custom = override(call);
    if (custom !== undefined) return custom;
    if (call.table === 'stripe_webhook_logs' && actionOf(call) === 'select') return { data: [], error: null };
    if (call.table === 'profiles' && actionOf(call) === 'upsert') return { data: [{ id: 'profile-1' }], error: null };
    return { data: null, error: null };
  });
}

function webhook({ fetch } = {}) {
  const { context } = loadFunction('stripe-webhook', {
    env: { STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test' },
    globals: { fetch: fetch || fakeFetch(() => ({ body: { data: [] } })).fetch },
  });
  return (req, db) => context.handleStripeWebhook(req, () => db.client);
}

const subscriptionCheckout = (overrides = {}) => ({
  id: 'evt_checkout_1',
  type: 'checkout.session.completed',
  created: 1_790_000_000,
  data: {
    object: {
      id: 'cs_1',
      mode: 'subscription',
      customer: 'cus_1',
      subscription: 'sub_1',
      payment_status: 'paid',
      customer_details: { email: 'typed-at-checkout@example.com' },
      metadata: { supabase_email: 'member@example.com', tier: 'keeper', billing_cycle: 'monthly' },
      ...overrides,
    },
  },
});

const logStatuses = (db) => db.table('stripe_webhook_logs')
  .filter((c) => actionOf(c) === 'update')
  .map((c) => payloadOf(c).processing_status);

describe('a failed profile write fails the event so Stripe retries', () => {
  it('answers 500 and marks the log failed when the membership write errors', async () => {
    const db = database((call) => (call.table === 'profiles' && actionOf(call) === 'upsert'
      ? { data: null, error: { message: 'connection reset' } }
      : undefined));
    const res = await webhook()(signedRequest(subscriptionCheckout()), db);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('profile write failed');
    expect(logStatuses(db)).toEqual(['failed']);
  });

  it('answers 500 when the write reports success but saved no row', async () => {
    const db = database((call) => (call.table === 'profiles' && actionOf(call) === 'upsert'
      ? { data: [], error: null }
      : undefined));
    const res = await webhook()(signedRequest(subscriptionCheckout()), db);
    expect(res.status).toBe(500);
    expect(logStatuses(db)).toEqual(['failed']);
  });

  it('answers 500 when a refund cannot remove access', async () => {
    const charge = {
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', customer: 'cus_1', invoice: 'in_1', refunded: true, amount: 500, amount_refunded: 500 } },
    };
    const db = database((call) => {
      if (call.table === 'profiles' && actionOf(call) === 'select') {
        return {
          data: { id: 'p', email: 'member@example.com', membership_tier: 'keeper', membership_billing_cycle: 'monthly', stripe_subscription_id: 'sub_1', subscription_status: 'active' },
          error: null,
        };
      }
      if (call.table === 'payment_events' && actionOf(call) === 'select' && filterValue(call, 'eq', 'stripe_invoice_id') === 'in_1') {
        return { data: { stripe_subscription_id: 'sub_1' }, error: null };
      }
      if (call.table === 'payment_events' && actionOf(call) === 'update') return { data: [{ id: 'x' }], error: null };
      if (call.table === 'profiles' && actionOf(call) === 'upsert') return { data: null, error: { message: 'timeout' } };
      return undefined;
    });
    const { fetch } = fakeFetch((req) => (req.url.includes('/subscriptions/sub_1')
      ? { body: { id: 'sub_1', latest_invoice: 'in_1' } }
      : { body: { data: [] } }));
    const res = await webhook({ fetch })(signedRequest(charge), db);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('profile write failed');
    expect(logStatuses(db)).toEqual(['failed']);
  });

  it('answers 500 when the member lookup itself fails', async () => {
    const event = {
      id: 'evt_sub_1',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [] } } },
    };
    const db = database((call) => (call.table === 'profiles' && actionOf(call) === 'select'
      ? { data: null, error: { message: 'db down', code: '08006' } }
      : undefined));
    const res = await webhook()(signedRequest(event), db);
    expect(res.status).toBe(500);
  });
});

describe('each event is applied once', () => {
  it('skips an event that already finished, without touching profiles', async () => {
    const db = database((call) => (call.table === 'stripe_webhook_logs' && actionOf(call) === 'select'
      ? { data: [{ id: 'log-1' }], error: null }
      : undefined));
    const res = await webhook()(signedRequest(subscriptionCheckout()), db);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(db.table('profiles')).toHaveLength(0);
    expect(db.table('stripe_webhook_logs').filter((c) => actionOf(c) === 'insert')).toHaveLength(0);
  });

  it('looks only for a finished delivery of this event id from this function', async () => {
    const db = database();
    await webhook()(signedRequest(subscriptionCheckout()), db);
    const lookup = db.table('stripe_webhook_logs').find((c) => actionOf(c) === 'select');
    expect(filterValue(lookup, 'eq', 'stripe_event_id')).toBe('evt_checkout_1');
    expect(filterValue(lookup, 'eq', 'processing_status')).toBe('processed');
    expect(lookup.ops.find(([op]) => op === 'or')[1]).toBe('created_by.is.null,created_by.eq.stripe-webhook');
    const insert = db.table('stripe_webhook_logs').find((c) => actionOf(c) === 'insert');
    expect(payloadOf(insert).created_by).toBe('stripe-webhook');
  });

  it('runs again an event whose earlier delivery failed', async () => {
    const db = database();
    const res = await webhook()(signedRequest(subscriptionCheckout()), db);
    expect(res.status).toBe(200);
    expect(db.table('profiles').filter((c) => actionOf(c) === 'upsert')).toHaveLength(1);
    expect(logStatuses(db)).toEqual(['processed']);
  });

  it('still processes when the duplicate check cannot be read', async () => {
    const db = database((call) => (call.table === 'stripe_webhook_logs' && actionOf(call) === 'select'
      ? { data: null, error: { message: 'timeout' } }
      : undefined));
    const res = await webhook()(signedRequest(subscriptionCheckout()), db);
    expect(res.status).toBe(200);
    expect(db.table('profiles').filter((c) => actionOf(c) === 'upsert')).toHaveLength(1);
  });

  it('the store webhook only counts its own log rows', () => {
    const src = functionSource('store-stripe-webhook');
    expect(src).toContain('.eq("created_by", LOG_SOURCE)');
    expect(src).toContain('const LOG_SOURCE = "store-stripe-webhook"');
    expect(src).toContain('stripe_event_type: event.type');
    expect(src).not.toMatch(/\bevent_type: event\.type/);
  });
});

describe('signature check', () => {
  it('accepts a correct signature and refuses a wrong one', async () => {
    const ok = await webhook()(signedRequest(subscriptionCheckout()), database());
    expect(ok.status).toBe(200);
    const bad = await webhook()(signedRequest(subscriptionCheckout(), { secret: 'whsec_other' }), database());
    expect(bad.status).toBe(400);
    const stale = await webhook()(
      signedRequest(subscriptionCheckout(), { timestamp: Math.floor(Date.now() / 1000) - 3600 }),
      database(),
    );
    expect(stale.status).toBe(400);
  });

  it('refuses a timestamp that is not a number', async () => {
    const { context } = loadFunction('stripe-webhook', { env: {} });
    const payload = '{}';
    const sig = createHmac('sha256', SECRET).update(`NaN.${payload}`).digest('hex');
    expect(await context.verifyStripeSignature(payload, `t=abc,v1=${sig}`, SECRET)).toBe(false);
  });

  it('compares in constant time', () => {
    const { context } = loadFunction('stripe-webhook', { env: {} });
    expect(context.timingSafeEqual('abc', 'abc')).toBe(true);
    expect(context.timingSafeEqual('abc', 'abd')).toBe(false);
    expect(context.timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(functionSource('stripe-webhook')).not.toContain('=== expected');
  });
});

describe('only membership checkouts change a plan', () => {
  it('ignores a subscription checkout that stripe-checkout did not create', async () => {
    const db = database();
    const event = subscriptionCheckout({ metadata: {} });
    const res = await webhook()(signedRequest(event), db);
    expect(res.status).toBe(200);
    expect(db.table('profiles').filter((c) => actionOf(c) !== 'select')).toHaveLength(0);
  });

  it('ignores a store order checkout', async () => {
    const db = database();
    const event = subscriptionCheckout({
      mode: 'payment',
      subscription: null,
      metadata: { order_id: 'order-1', cart_id: 'cart-1' },
    });
    const res = await webhook()(signedRequest(event), db);
    expect(res.status).toBe(200);
    expect(db.table('profiles')).toHaveLength(0);
    expect(db.table('payment_events')).toHaveLength(0);
  });

  it('writes a membership to the account email, not the email typed at Checkout', async () => {
    const db = database();
    await webhook()(signedRequest(subscriptionCheckout()), db);
    const upsert = db.table('profiles').find((c) => actionOf(c) === 'upsert');
    expect(payloadOf(upsert)).toMatchObject({
      email: 'member@example.com',
      membership_tier: 'keeper',
      stripe_subscription_id: 'sub_1',
    });
  });

  it('still grants a paid lifetime purchase', async () => {
    const db = database((call) => (call.table === 'payment_events' && actionOf(call) === 'insert'
      ? { data: null, error: null }
      : undefined));
    const event = subscriptionCheckout({
      mode: 'payment',
      subscription: null,
      payment_intent: 'pi_1',
      amount_total: 9900,
      metadata: { supabase_email: 'member@example.com', tier: 'keeper', billing_cycle: 'lifetime' },
    });
    const res = await webhook()(signedRequest(event), db);
    expect(res.status).toBe(200);
    const upsert = db.table('profiles').find((c) => actionOf(c) === 'upsert');
    expect(payloadOf(upsert)).toMatchObject({
      email: 'member@example.com',
      membership_tier: 'keeper',
      membership_billing_cycle: 'lifetime',
    });
  });

  it('classifies sessions the way stripe-checkout builds them', () => {
    const { context } = loadFunction('stripe-webhook', { env: {} });
    const kind = context.membershipCheckoutKind;
    expect(kind({ mode: 'subscription', metadata: { supabase_email: 'a@b.c', tier: 'breeder' } })).toBe('subscription');
    expect(kind({ mode: 'subscription', metadata: { tier: 'breeder' } })).toBeNull();
    expect(kind({ mode: 'subscription', metadata: { supabase_email: 'a@b.c' } })).toBeNull();
    expect(kind({ mode: 'payment', metadata: { billing_cycle: 'lifetime' } })).toBe('lifetime');
    expect(kind({ mode: 'payment', line_items: { data: [{ price: { id: keeperLifetime } }] } })).toBe('lifetime');
    expect(kind({ mode: 'payment', metadata: { order_id: 'o' } })).toBeNull();
    expect(kind({ mode: 'setup' })).toBeNull();
  });
});
