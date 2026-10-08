import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = (name) => readFileSync(new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
function webhookHelpers(env = {}) {
  const src = source('stripe-webhook').split('Deno.serve(')[0].replace(/^import .*;\n/gm, '');
  const context = vm.createContext({ Deno: { env: { get: (key) => env[key] } } });
  vm.runInContext(ts.transpile(src), context);
  return context;
}
const keeper = 'price_1TUxEsLBdc4xGjxqyPV4DOYb';
const breederAnnual = 'price_1TVMOCLBdc4xGjxqK2HTmGfm';
const overage = { price: { id: 'price_overage' }, current_period_end: 1 };

describe('membership price selection', () => {
  it.each([false, true])('finds annual Breeder regardless of add-on ordering (%s)', (reverse) => {
    const helpers = webhookHelpers();
    const membership = { price: { id: breederAnnual }, current_period_end: 100 };
    const items = reverse ? [membership, overage] : [overage, membership];
    const item = helpers.membershipLine(items);
    expect(item).toBe(membership);
    expect(helpers.priceIdToPlan(item.price.id)).toEqual({ tier: 'breeder', cycle: 'annual' });
    expect(item.current_period_end).toBe(100);
  });
  it('recognizes old and new invoice line formats after overage lines', () => {
    const helpers = webhookHelpers();
    for (const membership of [{ price: { id: keeper } }, { pricing: { price_details: { price: keeper } } }]) {
      expect(helpers.membershipLine([overage, membership])).toBe(membership);
    }
  });
  it('uses the positive proration line when an upgrade lists both prices', () => {
    const helpers = webhookHelpers();
    const credit = { price: { id: keeper }, amount: -299 };
    const charge = { price: { id: breederAnnual }, amount: 6000 };
    expect(helpers.membershipLine([credit, charge])).toBe(charge);
    expect(helpers.membershipLine([charge, credit])).toBe(charge);
  });
  it('does not invent a membership for empty or overage-only invoices', () => {
    const helpers = webhookHelpers();
    expect(helpers.membershipLine(undefined)).toBeUndefined();
    expect(helpers.membershipLine([])).toBeUndefined();
    expect(helpers.membershipLine([overage])).toBeUndefined();
  });
  it('honors configured price overrides', () => {
    const helpers = webhookHelpers({ STRIPE_KEEPER_PRICE_ID: 'price_custom' });
    const membership = { price: { id: 'price_custom' } };
    expect(helpers.membershipLine([overage, membership])).toBe(membership);
  });
});

const breederMonthly = 'price_1TUxHGLBdc4xGjxqeieYNdE4';

describe('plan changes ignore stale subscription metadata', () => {
  const helpers = webhookHelpers();
  const switched = {
    id: 'sub_switched',
    status: 'active',
    metadata: { tier: 'keeper', billing_cycle: 'monthly' },
    schedule: { phases: [{ items: [{ price: keeper }] }] },
    items: { data: [{ price: breederAnnual, current_period_end: 100 }] },
  };

  it('uses the current Breeder price when metadata still says Keeper', () => {
    expect(helpers.subscriptionAccessPatch(switched)).toMatchObject({
      stripe_subscription_id: 'sub_switched',
      subscription_status: 'active',
      membership_tier: 'breeder',
      membership_billing_cycle: 'annual',
      period_end_unix: 100,
    });
  });

  it('reads a price id that is a string or the newer pricing field', () => {
    for (const item of [
      { price: breederMonthly },
      { pricing: { price_details: { price: breederMonthly } } },
    ]) {
      expect(helpers.subscriptionAccessPatch({
        id: 'sub_shape', status: 'active', metadata: { tier: 'keeper' }, items: { data: [item] },
      })).toMatchObject({ membership_tier: 'breeder', membership_billing_cycle: 'monthly' });
    }
  });

  it('does not guess a tier when the price is not in the catalog', () => {
    const patch = helpers.subscriptionAccessPatch({
      id: 'sub_unknown', status: 'active', metadata: { tier: 'breeder', billing_cycle: 'annual' },
      items: { data: [{ price: { id: 'price_overage' } }] },
    });
    expect(patch.membership_tier).toBeUndefined();
    expect(patch.membership_billing_cycle).toBeUndefined();
  });

  it('keeps the current price during a trial and ends access when the trial is over', () => {
    expect(helpers.subscriptionAccessPatch({
      id: 'sub_trial', status: 'trialing', metadata: { tier: 'keeper' },
      items: { data: [{ price: { id: breederMonthly } }] },
    })).toMatchObject({ membership_tier: 'breeder', subscription_status: 'trialing' });
    for (const status of ['canceled', 'unpaid', 'incomplete_expired']) {
      expect(helpers.subscriptionAccessPatch({
        id: 'sub_end', status, items: { data: [{ price: { id: breederMonthly } }] },
      })).toMatchObject({ membership_tier: 'free', membership_billing_cycle: null, subscription_status: status });
    }
  });

  it('does not replay the original checkout tier over a switched subscription', () => {
    const session = {
      subscription: 'sub_switched',
      metadata: { tier: 'keeper', billing_cycle: 'monthly' },
    };
    expect(helpers.checkoutPlan(session, {
      stripe_subscription_id: 'sub_switched', membership_tier: 'breeder',
    })).toEqual({ tier: null, cycle: null });
    expect(helpers.checkoutPlan(session, {
      stripe_subscription_id: null, membership_tier: 'free',
    })).toEqual({ tier: 'keeper', cycle: 'monthly' });
    expect(helpers.checkoutPlan({
      ...session,
      line_items: { data: [{ price: { id: breederAnnual } }] },
    }, null)).toEqual({ tier: 'breeder', cycle: 'annual' });
  });
});

describe('refunds, disputes, and duplicate invoices', () => {
  const helpers = webhookHelpers();
  const current = {
    invoiceId: 'in_latest',
    linkedSubscriptionId: 'sub_current',
    currentSubscriptionId: 'sub_current',
    latestInvoiceId: 'in_latest',
  };

  it('revokes on a full refund of the latest membership invoice only', () => {
    expect(helpers.isFullRefund({ refunded: true, amount: 599, amount_refunded: 599 })).toBe(true);
    expect(helpers.isFullRefund({ refunded: false, amount: 599, amount_refunded: 100 })).toBe(false);
    expect(helpers.membershipChargeEffect({ ...current, fullRefund: true })).toBe('revoke');
    expect(helpers.membershipChargeEffect({ ...current, fullRefund: false })).toBe('partial');
    expect(helpers.membershipChargeEffect({
      ...current, invoiceId: 'in_old', fullRefund: true,
    })).toBe('record');
    expect(helpers.membershipChargeEffect({
      ...current, linkedSubscriptionId: 'sub_other', fullRefund: true,
    })).toBe('ignore');
    expect(helpers.membershipChargeEffect({
      ...current, invoiceId: null, fullRefund: true,
    })).toBe('ignore');
  });

  it('finds an invoice from a payment intent when the charge has no invoice field', () => {
    expect(helpers.chargeInvoiceId({ invoice: 'in_old' })).toBe('in_old');
    expect(helpers.chargeInvoiceId({ payment_intent: 'pi_new' })).toBeNull();
    expect(helpers.invoicePaymentsPath('pi_new')).toBe(
      'invoice_payments?limit=1&payment[type]=payment_intent&payment[payment_intent]=pi_new',
    );
  });

  it('revokes on a chargeback and restores only when the dispute is won', () => {
    expect(helpers.disputeAccessDecision('charge.dispute.created', 'needs_response')).toBe('revoke');
    expect(helpers.disputeAccessDecision('charge.dispute.funds_withdrawn', 'under_review')).toBe('revoke');
    expect(helpers.disputeAccessDecision('charge.dispute.closed', 'lost')).toBe('revoke');
    expect(helpers.disputeAccessDecision('charge.dispute.closed', 'won')).toBe('restore');
    expect(helpers.disputeAccessDecision('charge.dispute.funds_reinstated', 'won')).toBe('restore');
    expect(helpers.disputeAccessDecision('charge.dispute.created', 'warning_needs_response')).toBe('ignore');
    expect(helpers.disputeAccessDecision('charge.dispute.closed', 'warning_closed')).toBe('ignore');
    expect(helpers.accessBlockedByPaymentStatus('refunded')).toBe(true);
    expect(helpers.accessBlockedByPaymentStatus('disputed')).toBe(true);
    expect(helpers.accessBlockedByPaymentStatus('paid')).toBe(false);
    expect(helpers.accessBlockedByPaymentStatus('partial_refund')).toBe(false);
  });

  it('keys one payment to the invoice and does not invent a Keeper referral tier', () => {
    expect(helpers.invoicePaymentKey('in_123')).toBe('stripe-invoice:in_123');
    expect(helpers.referredTierForInvoice({
      lines: { data: [{ pricing: { price_details: { price: breederMonthly } } }] },
    }, 'keeper')).toBe('breeder');
    expect(helpers.referredTierForInvoice({ lines: { data: [overage] } }, 'free')).toBeNull();
    expect(helpers.referredTierForInvoice({ lines: { data: [overage] } }, 'breeder')).toBe('breeder');
    const src = source('stripe-webhook');
    expect(src).not.toContain('sub.metadata');
    expect(src).not.toContain('plan?.tier || "keeper"');
    for (const eventName of [
      'charge.refunded',
      'charge.dispute.created',
      'charge.dispute.updated',
      'charge.dispute.closed',
      'charge.dispute.funds_withdrawn',
      'charge.dispute.funds_reinstated',
      'customer.subscription.trial_will_end',
    ]) {
      expect(src).toContain(`case "${eventName}"`);
    }
  });
});

describe('overage checkout opt-in', () => {
  const code = source('stripe-checkout').split('  const overagePriceId =')[1].split('  sessionForm.set("success_url"')[0];
  it.each([
    [undefined, 'monthly', false], ['false', 'monthly', false],
    ['true', 'monthly', true], ['true', 'annual', false],
  ])('enabled=%s cycle=%s attaches=%s', (enabled, cycle, attached) => {
    const sessionForm = new URLSearchParams();
    vm.runInNewContext(`const overagePriceId =${code}`, {
      Deno: { env: { get: (key) => key === 'STRIPE_OVERAGE_PRICE_ID' ? 'price_overage' : enabled } },
      cycle, sessionForm,
    });
    expect(sessionForm.has('line_items[1][price]')).toBe(attached);
  });
});
