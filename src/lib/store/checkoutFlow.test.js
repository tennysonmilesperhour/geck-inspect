import { readFileSync } from 'node:fs';
import { createHmac, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as pricing from '../../../supabase/functions/_shared/stickerPricing.js';
import * as snapshots from '../../../supabase/functions/_shared/storeOrderSnapshot.js';

// Run the actual Edge Function handlers with in-memory Postgres/Stripe adapters.
// No requests, credentials, orders, or charges leave the test process.
const compiled = Object.fromEntries(['store-checkout', 'store-stripe-webhook'].map((name) => [name,
  ts.transpileModule(readFileSync(new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
]));

function fixture() {
  const product = { id: 'sticker', slug: pricing.CUSTOM_STICKER_SLUG, name: 'Custom sticker', our_price_cents: 1000, vendor_id: 'gi', vendor_sku: null, status: 'active', fulfillment_mode: 'direct_self', images: [] };
  const db = {
    store_carts: [{ id: 'cart', owner_user_id: 'keeper', session_token: null, status: 'open' }],
    store_cart_items: ['glossy', 'holographic'].map((finish, i) => ({ id: `line-${i}`, cart_id: 'cart', product, quantity: 10, unit_price_cents_snapshot: 1, customization: { kind: 'custom_sticker', name: 'Luna', finish, size: '3in' } })),
    store_orders: [], store_order_items: [], stripe_webhook_logs: [], app_settings: [],
  };
  const state = { userId: 'keeper', snapshotError: false };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: state.userId } } }) },
    from(table) {
      let mode = 'select', payload, singular = false;
      const filters = [];
      const finish = () => {
        const selected = () => db[table].filter((row) => filters.every(([key, value]) => row[key] === value));
        let rows;
        if (mode === 'insert') {
          if (table === 'store_order_items' && state.snapshotError) return { data: null, error: { message: 'database unavailable' } };
          rows = (Array.isArray(payload) ? payload : [payload]).map((row, i) => ({ id: `${table}-${db[table].length + i + 1}`, ...structuredClone(row) }));
          db[table].push(...rows);
        } else {
          rows = selected();
          if (mode === 'update') rows.forEach((row) => Object.assign(row, structuredClone(payload)));
        }
        return { data: singular ? rows[0] ?? null : rows, error: null, count: rows.length };
      };
      const query = {
        select: () => query, gte: () => query,
        eq: (key, value) => { filters.push([key, value]); return query; },
        insert: (value) => { mode = 'insert'; payload = value; return query; },
        update: (value) => { mode = 'update'; payload = value; return query; },
        maybeSingle: () => { singular = true; return Promise.resolve(finish()); },
        single: () => { singular = true; return Promise.resolve(finish()); },
        then: (resolve, reject) => Promise.resolve(finish()).then(resolve, reject),
      };
      return query;
    },
  };
  const stripe = vi.fn(async () => new Response(JSON.stringify({ id: 'cs_test_order', url: 'https://checkout.stripe.com/test' }), { status: 200 }));
  const handlers = {};
  for (const name of Object.keys(compiled)) {
    runInNewContext(compiled[name], {
      exports: {}, Deno: { env: { get: (key) => key === 'STRIPE_WEBHOOK_SECRET' ? 'test-signing-secret' : 'test-value' } },
      require: (path) => {
        if (path.includes('http/server')) return { serve: (handler) => { handlers[name] = handler; } };
        if (path.includes('supabase-js')) return { createClient: () => client };
        if (path.endsWith('stickerPricing.js')) return pricing;
        if (path.endsWith('storeOrderSnapshot.js')) return snapshots;
        throw new Error(`Unexpected dependency ${path}`);
      },
      Request, Response, URLSearchParams, TextEncoder, crypto: webcrypto, btoa, console, fetch: stripe,
    });
  }
  const checkout = () => handlers['store-checkout'](new Request('https://example.test/checkout', {
    method: 'POST', headers: { Authorization: 'Bearer test-user' },
    body: JSON.stringify({ cart_id: 'cart', success_url: 'https://example.test/success', cancel_url: 'https://example.test/cart' }),
  }));
  const webhook = async (patch = {}, type = 'checkout.session.completed') => {
    const payload = JSON.stringify({ id: `evt_${type}`, type, data: { object: {
      id: 'cs_test_order', metadata: { order_id: db.store_orders[0].id, cart_id: 'cart' },
      payment_status: 'paid', currency: 'usd', amount_subtotal: 12500, amount_total: 12500,
      total_details: { amount_tax: 0, amount_shipping: 0 }, ...patch,
    } } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', 'test-signing-secret').update(`${timestamp}.${payload}`).digest('hex');
    return handlers['store-stripe-webhook'](new Request('https://example.test/webhook', {
      method: 'POST', body: payload, headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    }));
  };
  return { db, state, stripe, checkout, webhook };
}

describe('sticker checkout through payment confirmation', () => {
  it('sends $5/$7 bulk prices to Stripe and saves matching production lines before redirecting', async () => {
    const { checkout, stripe, db } = fixture();
    expect((await checkout()).status).toBe(200);
    const params = stripe.mock.calls[0][1].body;
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('500');
    expect(params.get('line_items[1][price_data][unit_amount]')).toBe('700');
    expect(params.get('line_items[1][price_data][product_data][name]')).toContain('Holographic');
    expect(db.store_orders[0]).toMatchObject({ subtotal_cents: 12000, shipping_cents: 500, total_cents: 12500, stripe_checkout_session_id: 'cs_test_order' });
    expect(db.store_order_items.map((row) => row.unit_price_cents)).toEqual([500, 700]);
  });

  it('fulfills the purchased mix despite later cart changes, without duplicate order lines', async () => {
    const { checkout, webhook, db } = fixture();
    await checkout();
    db.store_cart_items[1].quantity = 1;
    db.store_cart_items[1].customization.finish = 'glossy';
    expect((await webhook()).status).toBe(200);
    expect(db.store_orders[0]).toMatchObject({ status: 'paid', subtotal_cents: 12000, shipping_cents: 500, total_cents: 12500 });
    expect(db.store_order_items[1]).toMatchObject({ quantity: 10, unit_price_cents: 700, customization: { finish: 'holographic' } });
    await webhook();
    await webhook({}, 'checkout.session.async_payment_succeeded');
    expect(db.store_order_items).toHaveLength(2);
  });

  it('waits for delayed payment success and rejects a mismatched paid amount', async () => {
    const { checkout, webhook, db } = fixture();
    await checkout();
    expect((await webhook({ payment_status: 'unpaid' })).status).toBe(200);
    expect(db.store_orders[0].status).toBe('pending');
    expect((await webhook({ amount_total: 7000 }, 'checkout.session.async_payment_succeeded')).status).toBe(500);
    expect(db.store_orders[0].status).toBe('pending');
    expect((await webhook({}, 'checkout.session.async_payment_succeeded')).status).toBe(200);
    expect(db.store_orders[0].status).toBe('paid');
  });

  it('does not create a payment when the production snapshot cannot be saved', async () => {
    const { checkout, state, stripe, db } = fixture();
    state.snapshotError = true;
    expect((await checkout()).status).toBe(500);
    expect(stripe).not.toHaveBeenCalled();
    expect(db.store_orders[0].status).toBe('cancelled');
  });

  it('rejects another keeper’s cart before making any order or payment', async () => {
    const { checkout, state, stripe, db } = fixture();
    state.userId = 'someone-else';
    expect((await checkout()).status).toBe(403);
    expect(stripe).not.toHaveBeenCalled();
    expect(db.store_orders).toHaveLength(0);
  });
});
