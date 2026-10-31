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

const lifetimeDispute = (type = 'charge.dispute.closed', status = 'won', id = 'evt_lifetime_restore') => ({
  id,
  type,
  data: { object: {
    id: 'dp_synthetic',
    status,
    amount: 5000,
    currency: 'usd',
    charge: { id: 'ch_synthetic', customer: 'cus_synthetic', payment_intent: 'pi_synthetic' },
  } },
});

function lifetimeDisputeDatabase({ subscriptionId = 'sub_replacement', paymentStatus = 'disputed', onProfileWrite } = {}) {
  return database((call) => {
    if (call.table === 'profiles' && actionOf(call) === 'select') {
      return { data: {
        id: 'profile-1', email: 'member@example.com', membership_tier: 'free',
        membership_billing_cycle: null, stripe_subscription_id: subscriptionId,
        subscription_status: 'disputed',
      }, error: null };
    }
    if (call.table === 'payment_events' && actionOf(call) === 'select'
      && filterValue(call, 'eq', 'id') === 'stripe-lifetime:pi_synthetic') {
      return { data: {
        id: 'stripe-lifetime:pi_synthetic', billing_cycle: 'lifetime', membership_tier: 'keeper',
        status: paymentStatus, stripe_invoice_id: null,
      }, error: null };
    }
    if (call.table === 'profiles' && actionOf(call) === 'upsert' && onProfileWrite) return onProfileWrite(call);
    return undefined;
  });
}

function subscriptionsForLifetimeRestore({ status = 200, deleteStatus = 200 } = {}) {
  return fakeFetch((req) => {
    if (req.url.includes('/invoice_payments?')) return { body: { data: [] } };
    if (req.url.includes('/subscriptions?')) {
      return { status, body: status === 200 ? { data: [{ id: 'sub_replacement', status: 'active' }] } : { error: { message: 'temporary list failure' } } };
    }
    if (req.url.includes('/subscriptions/sub_replacement')) {
      return { status: deleteStatus, body: deleteStatus === 200 ? { id: 'sub_replacement', status: 'canceled' } : { error: { message: 'temporary cancel failure' } } };
    }
    return { body: {} };
  });
}

describe('lifetime dispute restoration reconciles replacement subscriptions first', () => {
  it.each([
    ['won dispute', 'charge.dispute.closed', 'won'],
    ['reinstated funds', 'charge.dispute.funds_reinstated', 'warning_closed'],
  ])('cancels before restoring access for %s', async (_label, type, status) => {
    const db = lifetimeDisputeDatabase();
    const stripe = subscriptionsForLifetimeRestore();
    const res = await webhook({ fetch: stripe.fetch })(signedRequest(lifetimeDispute(type, status)), db);
    expect(res.status).toBe(200);
    expect(stripe.requests.map((r) => r.init.method || 'GET')).toEqual(['GET', 'GET', 'DELETE']);
    expect(stripe.requests[2].body.toString()).toBe('prorate=false&invoice_now=false');
    const restore = db.table('profiles').find((call) => actionOf(call) === 'upsert');
    expect(payloadOf(restore)).toMatchObject({ membership_tier: 'keeper', membership_billing_cycle: 'lifetime', stripe_subscription_id: null });
    expect(logStatuses(db)).toEqual(['processed']);
  });

  it('returns a retryable failure and preserves profile tracking when listing fails', async () => {
    const db = lifetimeDisputeDatabase();
    const stripeFail = subscriptionsForLifetimeRestore({ status: 503 });
    const first = await webhook({ fetch: stripeFail.fetch })(signedRequest(lifetimeDispute()), db);
    expect(first.status).toBe(500);
    expect(stripeFail.requests.some((r) => r.init.method === 'DELETE')).toBe(false);
    expect(db.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(0);
    expect(logStatuses(db)).toEqual(['failed']);

    const stripeRetry = subscriptionsForLifetimeRestore();
    const retry = await webhook({ fetch: stripeRetry.fetch })(signedRequest(lifetimeDispute()), db);
    expect(retry.status).toBe(200);
    expect(stripeRetry.requests.filter((r) => r.init.method === 'DELETE')).toHaveLength(1);
    expect(db.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(1);
  });

  it('returns a retryable failure and preserves profile tracking when cancellation fails', async () => {
    const db = lifetimeDisputeDatabase();
    const stripe = subscriptionsForLifetimeRestore({ deleteStatus: 503 });
    const res = await webhook({ fetch: stripe.fetch })(signedRequest(lifetimeDispute()), db);
    expect(res.status).toBe(500);
    expect(db.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(0);
    expect(logStatuses(db)).toEqual(['failed']);
  });

  it('retries a profile failure after cancellation, accepting an already-canceled subscription', async () => {
    let profileWrites = 0;
    const db = lifetimeDisputeDatabase({ onProfileWrite: () => {
      profileWrites += 1;
      return profileWrites === 1
        ? { data: null, error: { message: 'temporary profile failure' } }
        : { data: [{ id: 'profile-1' }], error: null };
    } });
    let deleteCalls = 0;
    const stripe = fakeFetch((req) => {
      if (req.url.includes('/invoice_payments?')) return { body: { data: [] } };
      if (req.url.includes('/subscriptions?')) return { body: { data: [{ id: 'sub_replacement', status: 'active' }] } };
      if (req.url.includes('/subscriptions/sub_replacement')) {
        deleteCalls += 1;
        return deleteCalls === 1
          ? { body: { id: 'sub_replacement', status: 'canceled' } }
          : { status: 400, body: { error: { message: 'Subscription is already canceled' } } };
      }
      return { body: {} };
    });
    const handler = webhook({ fetch: stripe.fetch });
    const first = await handler(signedRequest(lifetimeDispute()), db);
    expect(first.status).toBe(500);
    expect(db.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(1);
    const retry = await handler(signedRequest(lifetimeDispute()), db);
    expect(retry.status).toBe(200);
    expect(deleteCalls).toBe(2);
    expect(db.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(2);
    expect(logStatuses(db)).toEqual(['failed', 'processed']);
  });

  it('checks customer subscriptions when there is no tracked subscription ID', async () => {
    const db = lifetimeDisputeDatabase({ subscriptionId: null });
    const stripe = subscriptionsForLifetimeRestore();
    const res = await webhook({ fetch: stripe.fetch })(signedRequest(lifetimeDispute()), db);
    expect(res.status).toBe(200);
    expect(stripe.requests.some((r) => r.init.method === 'DELETE')).toBe(true);
  });

  it('does not cancel again after a successfully processed restore is delivered again', async () => {
    let processed = false;
    const db = fakeSupabase((call) => {
      if (call.table === 'stripe_webhook_logs' && actionOf(call) === 'select'
        && filterValue(call, 'eq', 'processing_status') === 'processed') {
        return { data: processed ? [{ id: 'log-1' }] : [], error: null };
      }
      if (call.table === 'stripe_webhook_logs' && actionOf(call) === 'update'
        && payloadOf(call).processing_status === 'processed') processed = true;
      if (call.table === 'profiles' && actionOf(call) === 'select') return { data: {
        id: 'profile-1', email: 'member@example.com', membership_tier: 'free',
        membership_billing_cycle: null, stripe_subscription_id: 'sub_replacement', subscription_status: 'disputed',
      }, error: null };
      if (call.table === 'payment_events' && actionOf(call) === 'select'
        && filterValue(call, 'eq', 'id') === 'stripe-lifetime:pi_synthetic') return { data: {
        id: 'stripe-lifetime:pi_synthetic', billing_cycle: 'lifetime', membership_tier: 'keeper', status: 'disputed',
      }, error: null };
      if (call.table === 'profiles' && actionOf(call) === 'upsert') return { data: [{ id: 'profile-1' }], error: null };
      return undefined;
    });
    const stripe = subscriptionsForLifetimeRestore();
    const handler = webhook({ fetch: stripe.fetch });
    expect((await handler(signedRequest(lifetimeDispute()), db)).status).toBe(200);
    expect((await handler(signedRequest(lifetimeDispute()), db)).status).toBe(200);
    expect(stripe.requests.filter((r) => r.init.method === 'DELETE')).toHaveLength(1);
    expect(db.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(1);
  });

  it('does not reconcile subscriptions for an already-refunded lifetime purchase', async () => {
    const db = lifetimeDisputeDatabase({ paymentStatus: 'refunded' });
    const stripe = subscriptionsForLifetimeRestore();
    const res = await webhook({ fetch: stripe.fetch })(signedRequest(lifetimeDispute()), db);
    expect(res.status).toBe(200);
    expect(stripe.requests).toHaveLength(1); // invoice payment lookup only
    expect(db.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(0);
  });

  it('keeps lost-dispute and warning-inquiry behavior unchanged', async () => {
    const lostDb = lifetimeDisputeDatabase();
    const lostStripe = subscriptionsForLifetimeRestore();
    const lost = await webhook({ fetch: lostStripe.fetch })(signedRequest(lifetimeDispute('charge.dispute.closed', 'lost', 'evt_lost')), lostDb);
    expect(lost.status).toBe(200);
    expect(lostStripe.requests).toHaveLength(1); // lifetime charge match lookup only
    expect(payloadOf(lostDb.table('profiles').find((call) => actionOf(call) === 'upsert'))).toMatchObject({
      membership_tier: 'free', subscription_status: 'canceled',
    });

    const inquiryDb = lifetimeDisputeDatabase();
    const inquiryStripe = subscriptionsForLifetimeRestore();
    const inquiry = await webhook({ fetch: inquiryStripe.fetch })(
      signedRequest(lifetimeDispute('charge.dispute.created', 'warning_needs_response', 'evt_warning')),
      inquiryDb,
    );
    expect(inquiry.status).toBe(200);
    expect(inquiryStripe.requests).toHaveLength(0);
    expect(inquiryDb.table('profiles').filter((call) => actionOf(call) === 'upsert')).toHaveLength(0);
  });
});

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
