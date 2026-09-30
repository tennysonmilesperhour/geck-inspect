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
