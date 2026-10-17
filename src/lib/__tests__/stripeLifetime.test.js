import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
// TypeScript 5's compiler API: TypeScript 7 (the typecheck) has none yet.
import ts from 'typescript5';

const source = (name) => readFileSync(new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');

function loadHelpers(name) {
  const src = source(name).split('Deno.serve(')[0].replace(/^import .*;\n/gm, '');
  const context = vm.createContext({
    Deno: { env: { get: () => undefined } },
    URLSearchParams,
    crypto,
  });
  vm.runInContext(ts.transpile(src), context);
  return context;
}

const checkout = loadHelpers('stripe-checkout');
const webhook = loadHelpers('stripe-webhook');
const keeperLifetime = 'price_1UQV93LBdc4xGjxq4AvXpui4';
const breederLifetime = 'price_1UQV94LBdc4xGjxqwzNWvXyI';

describe('lifetime checkout', () => {
  const form = checkout.buildLifetimeCheckoutForm({
    customerId: 'cus_123',
    priceId: keeperLifetime,
    tier: 'keeper',
    userId: 'user-1',
    email: 'keeper@example.com',
    returnUrl: 'https://geckinspect.com/Membership',
    intent: 'trial',
    integrationId: checkout.lifetimeIntegrationId('abcdefgh'),
  });

  it('uses a one-time payment with invoice creation and no trial', () => {
    expect(form.get('mode')).toBe('payment');
    expect(form.get('line_items[0][price]')).toBe(keeperLifetime);
    expect(form.get('invoice_creation[enabled]')).toBe('true');
    expect(form.get('invoice_creation[invoice_data][metadata][billing_cycle]')).toBe('lifetime');
    expect(form.get('payment_intent_data[metadata][user_id]')).toBe('user-1');
    expect(form.get('payment_intent_data[metadata][tier]')).toBe('keeper');
    expect(form.get('payment_intent_data[metadata][billing_cycle]')).toBe('lifetime');
    expect(form.get('metadata[billing_cycle]')).toBe('lifetime');
    expect(form.has('subscription_data[trial_period_days]')).toBe(false);
    expect(form.has('subscription_data[metadata][tier]')).toBe(false);
    expect(form.get('line_items[1][price]')).toBeNull();
    expect(form.get('integration_identifier')).toBe('geck_lifetime_abcdefgh');
    expect(checkout.randomLetters(8)).toMatch(/^[a-z]{8}$/);
    expect(source('stripe-checkout')).not.toContain('Lifetime plans are not available yet');
  });

  it('lets a paying subscriber buy lifetime and refuses someone who already has it', () => {
    expect(checkout.checkoutRefusal({
      billingCycle: 'annual',
      cycle: 'lifetime',
      hasLiveSubscription: true,
    })).toBeNull();
    expect(checkout.checkoutRefusal({
      billingCycle: 'monthly',
      cycle: 'monthly',
      hasLiveSubscription: true,
    })).toMatchObject({ code: 'already_subscribed', status: 409 });
    expect(checkout.checkoutRefusal({
      billingCycle: 'lifetime',
      cycle: 'lifetime',
      hasLiveSubscription: false,
    })).toMatchObject({ code: 'already_lifetime', status: 409 });
    expect(checkout.checkoutRefusal({
      billingCycle: 'lifetime',
      cycle: 'monthly',
    }).code).toBe('already_lifetime');
  });
});

describe('lifetime webhook grant', () => {
  it('maps the live lifetime prices and ignores an unpaid session', () => {
    expect(webhook.priceIdToPlan(keeperLifetime)).toEqual({ tier: 'keeper', cycle: 'lifetime' });
    expect(webhook.priceIdToPlan(breederLifetime)).toEqual({ tier: 'breeder', cycle: 'lifetime' });
    const paid = {
      mode: 'payment',
      payment_status: 'paid',
      metadata: { billing_cycle: 'lifetime', tier: 'keeper' },
    };
    expect(webhook.lifetimeCheckoutFulfillable(paid)).toBe(true);
    expect(webhook.lifetimeTierFromSession(paid)).toBe('keeper');
    expect(webhook.lifetimeCheckoutFulfillable({ ...paid, payment_status: 'unpaid' })).toBe(false);
    expect(webhook.lifetimeCheckoutFulfillable({
      mode: 'subscription',
      payment_status: 'paid',
      metadata: { billing_cycle: 'monthly', tier: 'keeper' },
    })).toBe(false);
    expect(webhook.lifetimeTierFromSession({
      metadata: { tier: 'keeper', billing_cycle: 'lifetime' },
      line_items: { data: [{ price: { id: breederLifetime } }] },
    })).toBe('breeder');
  });

  it('grants lifetime once and leaves the start date alone on a repeat delivery', () => {
    const first = webhook.lifetimeGrantPatch({ membership_billing_cycle: 'monthly' }, 'keeper');
    expect(first).toMatchObject({
      membership_tier: 'keeper',
      membership_billing_cycle: 'lifetime',
      stripe_subscription_id: null,
      subscription_status: 'active',
      membership_expires_at: null,
    });
    expect(first.paid_membership_started_at).toEqual(expect.any(String));
    const repeat = webhook.lifetimeGrantPatch({ membership_billing_cycle: 'lifetime' }, 'keeper');
    expect(repeat.paid_membership_started_at).toBeUndefined();
    expect(repeat).toMatchObject({
      membership_tier: 'keeper',
      membership_billing_cycle: 'lifetime',
      stripe_subscription_id: null,
    });
    expect(webhook.lifetimePaymentKey('pi_123')).toBe('stripe-lifetime:pi_123');
    expect(webhook.lifetimePaymentKey('pi_123')).toBe(webhook.lifetimePaymentKey('pi_123'));
    expect(webhook.lifetimeGrantBlockedByPaymentStatus('paid')).toBe(false);
    expect(webhook.lifetimeGrantBlockedByPaymentStatus('refunded')).toBe(true);
    expect(webhook.lifetimeGrantBlockedByPaymentStatus('disputed')).toBe(true);
  });
});

describe('lifetime upgrade cancels the old subscription', () => {
  it('cancels the live subscription with no proration and ignores its later events', () => {
    expect(webhook.subscriptionIdsToCancel('sub_old', [
      { id: 'sub_old', status: 'active' },
      { id: 'sub_done', status: 'canceled' },
    ])).toEqual(['sub_old']);
    expect(webhook.subscriptionIdsToCancel(null, [
      { id: 'sub_done', status: 'canceled' },
    ])).toEqual([]);
    const body = webhook.immediateCancelBody();
    expect(body.get('prorate')).toBe('false');
    expect(body.get('invoice_now')).toBe('false');
    expect(body.toString()).not.toContain('create_prorations');
    expect(webhook.shouldApplySubscriptionEvent({ membership_billing_cycle: 'lifetime' })).toBe(false);
    expect(webhook.shouldApplySubscriptionEvent({ membership_billing_cycle: 'monthly' })).toBe(true);
    expect(webhook.subscriptionAccessWrite(
      { membership_billing_cycle: 'lifetime' },
      { id: 'sub_old', status: 'canceled', items: { data: [{ price: { id: keeperLifetime } }] } },
    )).toBeNull();
    expect(webhook.subscriptionAccessWrite(
      { membership_billing_cycle: 'monthly' },
      { id: 'sub_old', status: 'canceled', items: { data: [{ price: { id: 'price_1TUxEsLBdc4xGjxqyPV4DOYb' } }] } },
    )).toMatchObject({ membership_tier: 'free', membership_billing_cycle: null });
    expect(source('stripe-webhook')).toContain('membership_billing_cycle.neq.lifetime');
  });
});

describe('lifetime refund and dispute', () => {
  it('revokes on a full refund or dispute matched by payment, intent, or invoice', () => {
    expect(webhook.lifetimeChargeMatched({ paymentEventCycle: 'lifetime' })).toBe(true);
    expect(webhook.lifetimeChargeMatched({ paymentIntentMetadataCycle: 'lifetime' })).toBe(true);
    expect(webhook.lifetimeChargeMatched({ invoiceCycle: 'lifetime' })).toBe(true);
    expect(webhook.lifetimeChargeMatched({ paymentEventCycle: 'monthly', invoiceCycle: 'annual' })).toBe(false);
    expect(webhook.lifetimeChargeDecision(true, true)).toBe('revoke');
    expect(webhook.lifetimeChargeDecision(true, false)).toBe('partial');
    expect(webhook.lifetimeChargeDecision(false, true)).toBe('ignore');
    expect(webhook.revokeAccessPatch()).toMatchObject({
      membership_tier: 'free',
      membership_billing_cycle: null,
      stripe_subscription_id: null,
    });
    expect(webhook.lifetimeRestorePatch('breeder')).toMatchObject({
      membership_tier: 'breeder',
      membership_billing_cycle: 'lifetime',
      stripe_subscription_id: null,
      subscription_status: 'active',
    });
  });
});

describe('referral lapse skips lifetime members', () => {
  it('keeps lifetime rows out of the daily downgrade', () => {
    const dir = resolve(new URL('.', import.meta.url).pathname, '../../../supabase/migrations');
    const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
    const hits = files.filter((name) => /expire_referral_grants/i.test(readFileSync(resolve(dir, name), 'utf8')));
    const latest = hits[hits.length - 1];
    expect(latest).toBe('20261014180000_skip_lifetime_in_referral_lapse.sql');
    const sql = readFileSync(resolve(dir, latest), 'utf8');
    expect(sql).toContain("coalesce(p.membership_billing_cycle, '') <> 'lifetime'");
    expect(sql).toContain("coalesce(membership_billing_cycle, '') <> 'lifetime'");
    expect(sql).toContain("membership_billing_cycle = 'lifetime'");
    expect(sql).not.toMatch(/\u2014|\u2013/);
  });
});
