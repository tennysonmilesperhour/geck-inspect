import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_PRICING, TRIAL_DAYS, KEEPER_PROMO_TRIAL_DAYS } from '../stripe-config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FUNCTIONS = ['stripe-checkout', 'stripe-webhook'];

/**
 * The edge functions carry their own copy of the price catalog because
 * they cannot import from src/. This test fails the moment a price id
 * in src/lib/stripe-config.js is added or changed without the same
 * change landing in both functions, so a customer can never be shown
 * one price and charged another.
 */
describe('Stripe price catalog stays in sync with the edge functions', () => {
  const sources = Object.fromEntries(
    FUNCTIONS.map((name) => [
      name,
      readFileSync(resolve(__dirname, `../../../supabase/functions/${name}/index.ts`), 'utf8'),
    ]),
  );

  const configured = [];
  for (const [tier, cycles] of Object.entries(TIER_PRICING)) {
    for (const [cycle, row] of Object.entries(cycles)) {
      if (row?.price_id) configured.push({ tier, cycle, priceId: row.price_id });
    }
  }

  it('has at least one purchasable price configured', () => {
    expect(configured.length).toBeGreaterThan(0);
  });

  for (const name of FUNCTIONS) {
    it(`${name} lists every configured price id under the right tier and cycle`, () => {
      const src = sources[name];
      for (const { tier, cycle, priceId } of configured) {
        // Match the tier block, then the cycle line inside it.
        const tierBlock = src.match(new RegExp(`\\n\\s*${tier}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`));
        expect(tierBlock, `${name}: missing ${tier} block`).toBeTruthy();
        const line = tierBlock[1].match(new RegExp(`${cycle}:\\s*"(price_[A-Za-z0-9]+)"`));
        expect(line?.[1], `${name}: ${tier}.${cycle}`).toBe(priceId);
      }
    });

    it(`${name} has no price ids that the client config does not know about`, () => {
      const ids = [...sources[name].matchAll(/"(price_[A-Za-z0-9]+)"/g)].map((m) => m[1]);
      const known = new Set(configured.map((c) => c.priceId));
      for (const id of ids) expect(known.has(id), `${name}: unknown ${id}`).toBe(true);
    });
  }
});

/**
 * The trial lengths are declared twice as well: once in stripe-config.js
 * (which the Membership page renders as copy) and once in the checkout
 * function (which is what Stripe actually applies). If they drift, the page
 * promises a trial length the customer does not get.
 */
describe('Trial lengths stay in sync with stripe-checkout', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../supabase/functions/stripe-checkout/index.ts'),
    'utf8',
  );

  const constant = (name) => {
    const match = src.match(new RegExp(`const ${name} = (\\d+);`));
    return match ? Number(match[1]) : null;
  };

  it('matches the standard trial length', () => {
    expect(constant('STANDARD_TRIAL_DAYS')).toBe(TRIAL_DAYS);
  });

  it('matches the one-time Keeper promo length', () => {
    expect(constant('KEEPER_PROMO_TRIAL_DAYS')).toBe(KEEPER_PROMO_TRIAL_DAYS);
  });

  it('only attaches a trial when one was asked for', () => {
    // A plain purchase must be billed today. The guard below is what makes
    // that true, so its absence is a regression worth failing on.
    expect(src).toMatch(/if \(trialDays > 0\) \{/);
    expect(src).toMatch(/let trialDays = 0;/);
  });
});
