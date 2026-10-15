// The payment ledger the Stripe webhook keeps in payment_events (plan item
// E2 20). Real events, shaped like production's on 15 October 2026 (API
// 2026-04-22.dahlia), go through supabase/functions/stripe-webhook against
// a fake database. Checked: every paid invoice gets one row with its tier
// and amount from the invoice lines; a failed referral no longer deletes
// the row; cancellations are recorded the moment Stripe reports them, with
// Stripe's reason and the member's feedback; refunds record the amount.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  actionOf, fakeFetch, fakeSupabase, filterValue, loadFunction, payloadOf,
} from './edgeHarness';
import { TIER_PRICING } from '../stripe-config.js';

const SECRET = 'whsec_test_secret';
const KEEPER = 'price_1TUxEsLBdc4xGjxqyPV4DOYb';
const BREEDER = 'price_1TUxHGLBdc4xGjxqeieYNdE4';

function signedRequest(event) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', SECRET).update(`${timestamp}.${payload}`).digest('hex');
  return new Request('https://example.test/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${sig}` },
    body: payload,
  });
}

const member = (overrides = {}) => ({
  id: 'p1',
  email: 'member@example.com',
  membership_tier: 'free',
  membership_billing_cycle: null,
  stripe_subscription_id: 'sub_1',
  subscription_status: 'active',
  ...overrides,
});

// A database where the member exists, nothing is in the ledger yet, and
// every write succeeds. override answers one call at a time.
function database(profile = member(), override = () => undefined) {
  return fakeSupabase((call) => {
    const custom = override(call);
    if (custom !== undefined) return custom;
    const action = actionOf(call);
    if (call.table === 'stripe_webhook_logs' && action === 'select') return { data: [], error: null };
    if (call.table === 'profiles' && action === 'select') return { data: profile, error: null };
    if (call.table === 'profiles' && (action === 'update' || action === 'upsert')) return { data: [{ id: 'p1' }], error: null };
    if (call.table === 'payment_events' && action === 'select') return { data: null, error: null };
    return { data: null, error: null };
  });
}

function webhook(fetchAnswer = () => ({ body: { data: [] } })) {
  const { context } = loadFunction('stripe-webhook', {
    env: { STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test' },
    globals: { fetch: fakeFetch(fetchAnswer).fetch },
  });
  return { send: (event, db) => context.handleStripeWebhook(signedRequest(event), () => db.client), context };
}

const invoice = (overrides = {}) => ({
  id: 'in_1',
  object: 'invoice',
  customer: 'cus_1',
  status: 'paid',
  currency: 'usd',
  amount_paid: 599,
  billing_reason: 'subscription_create',
  customer_email: 'billing@example.com',
  parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1' } },
  lines: { data: [{ amount: 599, pricing: { type: 'price_details', price_details: { price: BREEDER } } }] },
  ...overrides,
});

const invoiceEvent = (inv, id = 'evt_inv_1', type = 'invoice.paid') => ({
  id, type, created: 1_790_831_481, data: { object: inv },
});

const subscription = (overrides = {}) => ({
  id: 'sub_1',
  object: 'subscription',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  cancel_at: null,
  canceled_at: null,
  cancellation_details: { reason: null, feedback: null, comment: null },
  items: { data: [{ price: { id: BREEDER }, current_period_end: 1_793_509_879 }] },
  ...overrides,
});

const subEvent = (sub, previous, id = 'evt_sub_1', type = 'customer.subscription.updated', created = 1_790_834_160) => ({
  id, type, created, data: { object: sub, ...(previous ? { previous_attributes: previous } : {}) },
});

const ledgerInserts = (db) => db.table('payment_events').filter((c) => actionOf(c) === 'insert').map(payloadOf);
const ledgerUpdates = (db) => db.table('payment_events').filter((c) => actionOf(c) === 'update');

describe('every paid invoice writes one correct ledger row', () => {
  it('takes the tier from the invoice lines, not from a profile that still says free', async () => {
    const db = database(member({ membership_tier: 'free' }));
    const res = await webhook().send(invoiceEvent(invoice()), db);
    expect(res.status).toBe(200);
    const [row] = ledgerInserts(db);
    expect(row).toMatchObject({
      id: 'stripe-invoice:in_1',
      user_email: 'member@example.com',
      stripe_subscription_id: 'sub_1',
      status: 'paid',
      amount_cents: 599,
      membership_tier: 'breeder',
      billing_cycle: 'monthly',
    });
  });

  it('records a $0 invoice (trial start, coupon, plan switch) without touching referrals', async () => {
    const db = database();
    const inv = invoice({ amount_paid: 0, lines: { data: [{ amount: 299, pricing: { price_details: { price: KEEPER } } }] } });
    await webhook().send(invoiceEvent(inv), db);
    expect(ledgerInserts(db)[0]).toMatchObject({ amount_cents: 0, membership_tier: 'keeper' });
    expect(db.rpcCalls('award_referral_reward')).toHaveLength(0);
  });

  it('records an invoice from a second subscription, but pays no referral on it', async () => {
    const db = database(member({ stripe_subscription_id: 'sub_current' }));
    await webhook().send(invoiceEvent(invoice()), db);
    expect(ledgerInserts(db)).toHaveLength(1);
    expect(db.rpcCalls('award_referral_reward')).toHaveLength(0);
  });

  it('records an invoice whose customer has no profile, under the invoice email', async () => {
    const db = database(null);
    await webhook().send(invoiceEvent(invoice()), db);
    expect(ledgerInserts(db)[0]).toMatchObject({ user_email: 'billing@example.com' });
    expect(db.rpcCalls('award_referral_reward')).toHaveLength(0);
  });

  it('writes nothing more on the paired delivery of the same invoice', async () => {
    const db = database(member(), (call) => (call.table === 'payment_events' && actionOf(call) === 'select'
      && filterValue(call, 'eq', 'id') === 'stripe-invoice:in_1'
      ? { data: { id: 'stripe-invoice:in_1' }, error: null }
      : undefined));
    await webhook().send(invoiceEvent(invoice(), 'evt_inv_2', 'invoice.payment_succeeded'), db);
    expect(ledgerInserts(db)).toHaveLength(0);
    expect(db.rpcCalls('award_referral_reward')).toHaveLength(0);
  });

  it('keeps the ledger row when the referral fails, and the paired delivery retries it', async () => {
    const failing = database(member(), (call) => (call.rpc === 'award_referral_reward'
      ? { data: null, error: { message: 'referral table locked' } }
      : undefined));
    await webhook().send(invoiceEvent(invoice()), failing);
    expect(failing.table('payment_events').some((c) => actionOf(c) === 'delete')).toBe(false);
    const marker = ledgerUpdates(failing).find((c) => payloadOf(c).failure_reason);
    expect(payloadOf(marker).failure_reason).toMatch(/^referral_pending: referral table locked/);

    const retry = database(member(), (call) => {
      if (call.table === 'payment_events' && actionOf(call) === 'select') {
        return { data: { id: 'stripe-invoice:in_1' }, error: null };
      }
      if (call.table === 'payment_events' && actionOf(call) === 'update' && filterValue(call, 'like', 'failure_reason')) {
        return { data: [{ id: 'stripe-invoice:in_1' }], error: null };
      }
      return undefined;
    });
    await webhook().send(invoiceEvent(invoice(), 'evt_inv_2', 'invoice.payment_succeeded'), retry);
    expect(retry.rpcCalls('award_referral_reward')).toHaveLength(1);
  });

  it('access checks read invoice rows only, so churn rows and $0 rows cannot unblock a refund', () => {
    const src = readFileSync(new URL('../../../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');
    const fn = src.split('const latestPaymentRow = async')[1].split('};')[0];
    expect(fn).toContain('.not("stripe_invoice_id", "is", null)');
    expect(fn).toContain('.or("amount_cents.gt.0,status.neq.paid")');
  });
});

describe('cancellations are recorded the hour they happen', () => {
  it('a portal cancellation (cancel_at set, cancel_at_period_end false) writes cancel_scheduled with the reason', async () => {
    const db = database(member({ membership_tier: 'breeder' }));
    const sub = subscription({
      cancel_at: 1_793_509_879,
      canceled_at: 1_790_834_160,
      cancellation_details: { reason: 'cancellation_requested', feedback: null, comment: null },
    });
    const res = await webhook().send(subEvent(sub, { cancel_at: null, canceled_at: null, cancellation_details: { reason: null } }), db);
    expect(res.status).toBe(200);
    const [row] = ledgerInserts(db);
    expect(row).toMatchObject({
      id: 'stripe-cancel-scheduled:sub_1:1790834160',
      event_type: 'cancel_scheduled',
      status: 'cancel_scheduled',
      user_email: 'member@example.com',
      stripe_subscription_id: 'sub_1',
      membership_tier: 'breeder',
      billing_cycle: 'monthly',
      cancellation_reason: 'cancellation_requested',
      cancel_at: new Date(1_793_509_879 * 1000).toISOString(),
      amount_cents: null,
    });
    // Access is untouched: the member keeps Breeder until cancel_at.
    const write = db.table('profiles').find((c) => actionOf(c) === 'update');
    expect(payloadOf(write)).toMatchObject({ membership_tier: 'breeder', subscription_status: 'active' });
  });

  it('the follow-up event with the member\'s feedback updates the same row', async () => {
    const db = database(member(), (call) => (call.table === 'payment_events' && actionOf(call) === 'select'
      && filterValue(call, 'eq', 'id') === 'stripe-cancel-scheduled:sub_1:1790834160'
      ? { data: { id: 'stripe-cancel-scheduled:sub_1:1790834160' }, error: null }
      : undefined));
    const sub = subscription({
      cancel_at: 1_793_509_879,
      canceled_at: 1_790_834_160,
      cancellation_details: { reason: 'cancellation_requested', feedback: 'unused', comment: null },
    });
    await webhook().send(subEvent(sub, { cancellation_details: { feedback: null } }, 'evt_sub_2'), db);
    expect(ledgerInserts(db)).toHaveLength(0);
    const update = ledgerUpdates(db).find((c) => filterValue(c, 'eq', 'id') === 'stripe-cancel-scheduled:sub_1:1790834160');
    expect(payloadOf(update)).toMatchObject({ cancellation_feedback: 'unused', cancellation_reason: 'cancellation_requested' });
  });

  it('cancel at period end (older API style) counts too', async () => {
    const db = database();
    const sub = subscription({ cancel_at_period_end: true, canceled_at: 1_790_000_000 });
    await webhook().send(subEvent(sub, { cancel_at_period_end: false }), db);
    expect(ledgerInserts(db)[0]).toMatchObject({ id: 'stripe-cancel-scheduled:sub_1:1790000000', event_type: 'cancel_scheduled' });
  });

  it('undoing a cancellation writes cancel_withdrawn', async () => {
    const db = database();
    await webhook().send(subEvent(subscription(), { cancel_at: 1_793_509_879, canceled_at: 1_790_834_160 }, 'evt_resume'), db);
    expect(ledgerInserts(db)[0]).toMatchObject({ id: 'stripe-cancel-withdrawn:evt_resume', event_type: 'cancel_withdrawn' });
  });

  it('an update that does not touch cancellation writes no ledger row', async () => {
    const db = database();
    await webhook().send(subEvent(subscription(), { items: {}, latest_invoice: 'in_0' }), db);
    expect(db.table('payment_events').filter((c) => actionOf(c) !== 'select')).toHaveLength(0);
  });

  it('the end of a subscription removes access, then writes subscription_cancelled', async () => {
    const db = database(member({ membership_tier: 'breeder' }));
    const sub = subscription({
      status: 'canceled', ended_at: 1_790_806_507, canceled_at: 1_790_795_384,
      cancellation_details: { reason: 'payment_failed', feedback: null, comment: null },
    });
    await webhook().send(subEvent(sub, null, 'evt_end', 'customer.subscription.deleted', 1_790_806_507), db);
    const profileWrite = db.table('profiles').find((c) => actionOf(c) === 'update');
    expect(payloadOf(profileWrite)).toMatchObject({ membership_tier: 'free', subscription_status: 'canceled' });
    expect(ledgerInserts(db)[0]).toMatchObject({
      id: 'stripe-cancel:sub_1',
      event_type: 'subscription_cancelled',
      status: 'subscription_cancelled',
      cancellation_reason: 'payment_failed',
      cancel_at: new Date(1_790_806_507 * 1000).toISOString(),
    });
    const order = db.calls.filter((c) => (c.table === 'profiles' && actionOf(c) === 'update')
      || (c.table === 'payment_events' && actionOf(c) === 'insert')).map((c) => c.table);
    expect(order).toEqual(['profiles', 'payment_events']);
  });

  it('a lifetime member\'s old plan ending is marked as replaced, and access is not touched', async () => {
    const db = database(member({ membership_tier: 'keeper', membership_billing_cycle: 'lifetime', stripe_subscription_id: null }));
    await webhook().send(subEvent(subscription({ status: 'canceled' }), null, 'evt_end', 'customer.subscription.deleted'), db);
    expect(db.table('profiles').filter((c) => actionOf(c) !== 'select')).toHaveLength(0);
    expect(ledgerInserts(db)[0]).toMatchObject({ event_type: 'subscription_cancelled', status: 'replaced_by_lifetime' });
  });

  it('a failed churn write fails the event so Stripe retries it', async () => {
    const db = database(member(), (call) => (call.table === 'payment_events' && actionOf(call) === 'insert'
      ? { data: null, error: { message: 'connection reset', code: '08006' } }
      : undefined));
    const sub = subscription({ cancel_at: 1_793_509_879, canceled_at: 1_790_834_160 });
    const res = await webhook().send(subEvent(sub, { cancel_at: null }), db);
    expect(res.status).toBe(500);
  });

  it('ids match the backfill in migration 20261015151400', () => {
    const { context } = webhook();
    const sql = readFileSync(new URL('../../../supabase/migrations/20261015151400_stripe_ledger.sql', import.meta.url), 'utf8');
    expect(context.cancellationRecord('customer.subscription.deleted', 'e', 1, { id: 's' }, null).id).toBe('stripe-cancel:s');
    expect(sql).toContain("'stripe-cancel:' || (s.obj ->> 'id')");
    expect(context.cancellationRecord('customer.subscription.updated', 'e', 1, { id: 's', status: 'active', cancel_at: 9, canceled_at: 5 }, {}).id)
      .toBe('stripe-cancel-scheduled:s:5');
    expect(sql).toContain("'stripe-cancel-scheduled:' || (s.obj ->> 'id') || ':' ||");
    expect(sql).toContain("coalesce(s.obj ->> 'canceled_at', s.obj ->> 'cancel_at', s.created::text)");
    expect(context.cancellationRecord('customer.subscription.updated', 'evt_x', 1, { id: 's', status: 'active' }, { cancel_at: 9 }).id)
      .toBe('stripe-cancel-withdrawn:evt_x');
    expect(sql).toContain("'stripe-cancel-withdrawn:' || s.stripe_event_id");
    expect(sql).toContain("'stripe-invoice:' || (i.obj ->> 'id')");
    expect(sql).toContain("'stripe-lifetime:' || l.pi");
  });

  it('trial_will_end and a cancelled-but-ended status are not "scheduled"', () => {
    const { context } = webhook();
    expect(context.cancellationRecord('customer.subscription.trial_will_end', 'e', 1, { id: 's', status: 'trialing', cancel_at: 9 }, null)).toBeNull();
    expect(context.subscriptionCancelPending({ status: 'canceled', cancel_at: 9 })).toBe(false);
    expect(context.subscriptionCancelPending({ status: 'active', cancel_at: null, cancel_at_period_end: false })).toBe(false);
  });
});

describe('refunds record how much went back', () => {
  it('a full refund of the current invoice marks it refunded with the amount', async () => {
    const charge = { id: 'ch_1', customer: 'cus_1', invoice: 'in_1', refunded: true, amount: 599, amount_refunded: 599 };
    const db = database(member({ membership_tier: 'breeder' }), (call) => {
      if (call.table === 'payment_events' && actionOf(call) === 'select' && filterValue(call, 'eq', 'stripe_invoice_id') === 'in_1') {
        return { data: { stripe_subscription_id: 'sub_1' }, error: null };
      }
      if (call.table === 'payment_events' && actionOf(call) === 'update') return { data: [{ id: 'stripe-invoice:in_1' }], error: null };
      return undefined;
    });
    const res = await webhook((req) => (req.url.includes('/subscriptions/sub_1')
      ? { body: { id: 'sub_1', latest_invoice: 'in_1' } }
      : { body: { data: [] } })).send({ id: 'evt_refund', type: 'charge.refunded', data: { object: charge } }, db);
    expect(res.status).toBe(200);
    const updates = ledgerUpdates(db).map(payloadOf);
    expect(updates).toContainEqual({ status: 'refunded' });
    expect(updates).toContainEqual({ amount_refunded_cents: 599 });
  });

  it('a won dispute does not wipe out an earlier partial refund', async () => {
    const dispute = {
      id: 'dp_1', status: 'won', amount: 599, currency: 'usd',
      charge: { id: 'ch_1', customer: 'cus_1', invoice: 'in_1' },
    };
    const db = database(member({ membership_tier: 'free', subscription_status: 'disputed' }), (call) => {
      if (call.table === 'payment_events' && actionOf(call) === 'select' && filterValue(call, 'eq', 'stripe_invoice_id') === 'in_1') {
        return { data: { stripe_subscription_id: 'sub_1' }, error: null };
      }
      if (call.table === 'payment_events' && actionOf(call) === 'update') return { data: [{ id: 'stripe-invoice:in_1' }], error: null };
      return undefined;
    });
    const res = await webhook((req) => (req.url.includes('/subscriptions/sub_1')
      ? { body: subscription({ latest_invoice: 'in_1' }) }
      : { body: { data: [] } })).send({ id: 'evt_won', type: 'charge.dispute.closed', data: { object: dispute } }, db);
    expect(res.status).toBe(200);
    const updates = ledgerUpdates(db).map(payloadOf);
    expect(updates).toContainEqual({ status: 'paid' });
    expect(updates.some((u) => 'amount_refunded_cents' in u)).toBe(false);
  });

  it('a refund marker no longer labels the payment as free', () => {
    const src = readFileSync(new URL('../../../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('membership_tier: "free",\n      event_timestamp');
  });
});

// Refunds and disputes that do not change access: an invoice older than
// the subscription's latest ("record"), or one from a subscription that is
// not the member's current one ("ignore"). The money still went back, so
// the ledger row changes; the member's plan does not.
describe('refunds and disputes that leave access alone still reach the ledger', () => {
  // in_old belongs to sub_1; Stripe says sub_1's latest invoice is in_new.
  const ledgerDb = (profile) => database(profile, (call) => {
    if (call.table === 'payment_events' && actionOf(call) === 'select' && filterValue(call, 'eq', 'stripe_invoice_id') === 'in_old') {
      return { data: { stripe_subscription_id: 'sub_1' }, error: null };
    }
    if (call.table === 'payment_events' && actionOf(call) === 'update') return { data: [{ id: 'stripe-invoice:in_old' }], error: null };
    return undefined;
  });
  const stripe = () => webhook((req) => (req.url.includes('/subscriptions/sub_1')
    ? { body: { id: 'sub_1', latest_invoice: 'in_new' } }
    : { body: { data: [] } }));
  const profileWrites = (db) => db.table('profiles').filter((c) => actionOf(c) !== 'select');
  const statusUpdate = (db) => ledgerUpdates(db).find((c) => 'status' in (payloadOf(c) || {}));

  it('a full refund of an older invoice marks that invoice refunded, with the amount', async () => {
    const db = ledgerDb(member({ membership_tier: 'keeper' }));
    const charge = { id: 'ch_old', customer: 'cus_1', invoice: 'in_old', amount: 299, amount_refunded: 299, refunded: true };
    const res = await stripe().send({ id: 'evt_r_old', type: 'charge.refunded', data: { object: charge } }, db);
    expect(res.status).toBe(200);
    expect(payloadOf(statusUpdate(db))).toEqual({ status: 'refunded' });
    expect(filterValue(statusUpdate(db), 'eq', 'stripe_invoice_id')).toBe('in_old');
    expect(ledgerUpdates(db).map(payloadOf)).toContainEqual({ amount_refunded_cents: 299 });
    // Only the existing row changes: no marker row that could look newest.
    expect(ledgerInserts(db)).toHaveLength(0);
    expect(profileWrites(db)).toHaveLength(0);
  });

  it('a partial refund of an older invoice is recorded as partial', async () => {
    const db = ledgerDb(member({ membership_tier: 'keeper' }));
    const charge = { id: 'ch_old', customer: 'cus_1', invoice: 'in_old', amount: 299, amount_refunded: 100, refunded: false };
    await stripe().send({ id: 'evt_pr_old', type: 'charge.refunded', data: { object: charge } }, db);
    expect(payloadOf(statusUpdate(db))).toEqual({ status: 'partial_refund' });
    expect(ledgerUpdates(db).map(payloadOf)).toContainEqual({ amount_refunded_cents: 100 });
    expect(profileWrites(db)).toHaveLength(0);
  });

  it('a refund on a subscription that is no longer current is recorded too', async () => {
    const db = ledgerDb(member({ membership_tier: 'breeder', stripe_subscription_id: 'sub_2' }));
    const charge = { id: 'ch_old', customer: 'cus_1', invoice: 'in_old', amount: 299, amount_refunded: 299, refunded: true };
    await stripe().send({ id: 'evt_r_other', type: 'charge.refunded', data: { object: charge } }, db);
    expect(payloadOf(statusUpdate(db))).toEqual({ status: 'refunded' });
    expect(ledgerInserts(db)).toHaveLength(0);
    expect(profileWrites(db)).toHaveLength(0);
  });

  it('a dispute on an older invoice marks it disputed and leaves the plan alone', async () => {
    const db = ledgerDb(member({ membership_tier: 'keeper' }));
    const dispute = {
      id: 'dp_old', status: 'needs_response', amount: 299, currency: 'usd',
      charge: { id: 'ch_old', customer: 'cus_1', invoice: 'in_old' },
    };
    const res = await stripe().send({ id: 'evt_d_old', type: 'charge.dispute.created', data: { object: dispute } }, db);
    expect(res.status).toBe(200);
    expect(payloadOf(statusUpdate(db))).toEqual({ status: 'disputed' });
    expect(ledgerInserts(db)).toHaveLength(0);
    expect(profileWrites(db)).toHaveLength(0);
  });

  it('winning that dispute puts the row back to paid, only if it is still disputed', async () => {
    const db = ledgerDb(member({ membership_tier: 'keeper' }));
    const dispute = {
      id: 'dp_old', status: 'won', amount: 299, currency: 'usd',
      charge: { id: 'ch_old', customer: 'cus_1', invoice: 'in_old' },
    };
    await stripe().send({ id: 'evt_w_old', type: 'charge.dispute.closed', data: { object: dispute } }, db);
    const update = statusUpdate(db);
    expect(payloadOf(update)).toEqual({ status: 'paid' });
    expect(filterValue(update, 'eq', 'status')).toBe('disputed');
    expect(profileWrites(db)).toHaveLength(0);
  });
});

describe('lifetime purchases', () => {
  const LIFETIME = 'price_1UQV93LBdc4xGjxq4AvXpui4';

  it('the receipt invoice of a lifetime purchase is recorded as a lifetime row with no subscription, and the referral still runs', async () => {
    const db = database(member({ membership_tier: 'keeper', membership_billing_cycle: 'lifetime', stripe_subscription_id: null }));
    const inv = invoice({
      id: 'in_life', amount_paid: 14900, billing_reason: 'manual', parent: null,
      lines: { data: [{ amount: 14900, pricing: { type: 'price_details', price_details: { price: LIFETIME } } }] },
    });
    const res = await webhook().send(invoiceEvent(inv, 'evt_life_inv'), db);
    expect(res.status).toBe(200);
    // admin_revenue_summary leaves this row out of revenue: the grant row
    // stripe-lifetime:<intent> carries the same $149 (regression SQL checks it).
    expect(ledgerInserts(db)[0]).toMatchObject({
      id: 'stripe-invoice:in_life',
      stripe_subscription_id: null,
      membership_tier: 'keeper',
      billing_cycle: 'lifetime',
      amount_cents: 14900,
    });
    expect(ledgerInserts(db)[0].failure_reason).toBeUndefined();
    expect(db.rpcCalls('award_referral_reward')).toHaveLength(1);
    // The invoice never changes the plan.
    expect(db.table('profiles').filter((c) => actionOf(c) !== 'select')).toHaveLength(0);
  });
});

describe('edges the review found', () => {
  it('a duplicate subscription ending while the member pays on another is not churn', async () => {
    const db = database(member({ membership_tier: 'breeder', stripe_subscription_id: 'sub_current', subscription_status: 'active' }));
    await webhook().send(subEvent(subscription({ status: 'canceled' }), null, 'evt_dup_end', 'customer.subscription.deleted'), db);
    expect(db.table('profiles').filter((c) => actionOf(c) !== 'select')).toHaveLength(0);
    expect(ledgerInserts(db)[0]).toMatchObject({
      id: 'stripe-cancel:sub_1', event_type: 'subscription_cancelled', status: 'second_subscription_ended',
    });
  });

  it('a first invoice that lands before the profile switches subscription leaves the referral pending, and the paired delivery awards it', async () => {
    // First delivery: the profile still points at a live older subscription.
    const first = database(member({ stripe_subscription_id: 'sub_old', subscription_status: 'active' }));
    await webhook().send(invoiceEvent(invoice()), first);
    expect(ledgerInserts(first)[0]).toMatchObject({
      id: 'stripe-invoice:in_1', failure_reason: 'referral_pending: subscription not current yet',
    });
    expect(first.rpcCalls('award_referral_reward')).toHaveLength(0);

    // Paired delivery: customer.subscription.created has switched the profile.
    const second = database(member({ stripe_subscription_id: 'sub_1' }), (call) => {
      if (call.table === 'payment_events' && actionOf(call) === 'select') return { data: { id: 'stripe-invoice:in_1' }, error: null };
      if (call.table === 'payment_events' && actionOf(call) === 'update' && filterValue(call, 'like', 'failure_reason')) {
        return { data: [{ id: 'stripe-invoice:in_1' }], error: null };
      }
      return undefined;
    });
    await webhook().send(invoiceEvent(invoice(), 'evt_inv_2', 'invoice.payment_succeeded'), second);
    expect(second.rpcCalls('award_referral_reward')).toHaveLength(1);
  });

  it('a cancellation still gets a row if the function goes out before the migration', async () => {
    let inserts = 0;
    const db = database(member(), (call) => {
      if (call.table === 'payment_events' && actionOf(call) === 'insert') {
        inserts += 1;
        if (inserts === 1) {
          return { data: null, error: { code: 'PGRST204', message: "Could not find the 'cancel_at' column of 'payment_events'" } };
        }
      }
      return undefined;
    });
    const sub = subscription({ cancel_at: 1_793_509_879, canceled_at: 1_790_834_160 });
    const res = await webhook().send(subEvent(sub, { cancel_at: null }), db);
    expect(res.status).toBe(200);
    const rows = ledgerInserts(db);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ id: 'stripe-cancel-scheduled:sub_1:1790834160', event_type: 'cancel_scheduled' });
    expect('cancel_at' in rows[1]).toBe(false);
    expect('cancellation_reason' in rows[1]).toBe(false);
  });
});

describe('the SQL price catalog matches src/lib/stripe-config.js', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20261015151400_stripe_ledger.sql', import.meta.url), 'utf8');
  const toCents = (price) => Math.round(Number(String(price).replace(/[^0-9.]/g, '')) * 100);

  for (const [tier, cycles] of Object.entries(TIER_PRICING)) {
    for (const [cycle, row] of Object.entries(cycles)) {
      if (!row?.price_id) continue;
      it(`${tier} ${cycle} maps its price id and list price`, () => {
        expect(sql).toContain(`('${row.price_id}', '${tier}', '${cycle}')`);
        if (cycle === 'lifetime') return;
        const cents = toCents(row.price);
        const line = cycle === 'monthly'
          ? `when p_tier = '${tier}' and p_cycle = 'monthly' then ${cents}::numeric`
          : `when p_tier = '${tier}' and p_cycle = 'annual' then round(${cents}::numeric / 12, 2)`;
        expect(sql).toContain(line);
      });
    }
  }
});
