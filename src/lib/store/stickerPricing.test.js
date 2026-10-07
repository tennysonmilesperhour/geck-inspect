import { describe, expect, it } from 'vitest';
import { priceCartItems, stickerCartQuantity, stickerUnitPriceCents } from './stickerPricing';
import { buildOrderItemSnapshots, paidOrderAmounts } from '../../../supabase/functions/_shared/storeOrderSnapshot.js';

const product = { id: 'sticker', slug: 'custom-pet-sticker', name: 'Custom sticker', our_price_cents: 1000, vendor_id: 'gi', vendor_sku: null, fulfillment_mode: 'direct_self' };
const sticker = (quantity, finish = 'glossy', name = 'Luna') => ({ product, quantity, unit_price_cents_snapshot: 1, customization: { kind: 'custom_sticker', name, finish } });
const subtotal = (items) => priceCartItems(items).reduce((sum, item) => sum + item.quantity * item.unit_price_cents_snapshot, 0);

describe('sticker pricing shared by browser and checkout', () => {
  it.each([
    [1, 'glossy', 1000], [1, 'holographic', 1300],
    [19, 'glossy', 1000], [19, 'holographic', 1300],
    [20, 'glossy', 500], [20, 'holographic', 700],
    [100, 'glossy', 500], [100, 'holographic', 700],
  ])('%i cards in %s cost %i cents each', (quantity, finish, expected) => {
    expect(stickerUnitPriceCents(finish, quantity)).toBe(expected);
    expect(subtotal([sticker(quantity, finish)])).toBe(quantity * expected);
  });

  it('combines different designs, sizes and finishes toward the 20-sticker minimum', () => {
    const items = [sticker(8), sticker(10, 'holographic', 'Moonlight'), { ...sticker(2, 'glossy', 'Bat Geck'), customization: { ...sticker(2).customization, size: '4in', theme: 'enclosure_plaque' } }];
    expect(stickerCartQuantity(items)).toBe(20);
    expect(subtotal(items)).toBe(12000);
    expect(priceCartItems(items).map((item) => item.unit_price_cents_snapshot)).toEqual([500, 700, 500]);
  });

  it('reprices every remaining line when reducing or removing a design drops the cart below 20', () => {
    const bulk = priceCartItems([sticker(10), sticker(10, 'holographic')]);
    expect(subtotal([{ ...bulk[0], quantity: 9 }, bulk[1]])).toBe(22000);
    expect(subtotal([bulk[1]])).toBe(13000);
    expect(bulk[0].unit_price_cents_snapshot).toBe(500);
  });

  it('does not count supplies or trust a forged custom_sticker kind to discount them', () => {
    const supplies = { ...sticker(50, 'holographic'), product: { ...product, slug: 'premium-enclosure', our_price_cents: 35000 } };
    const items = [sticker(19), supplies];
    expect(stickerCartQuantity(items)).toBe(19);
    expect(priceCartItems(items).map((item) => item.unit_price_cents_snapshot)).toEqual([1000, 35000]);
  });

  it('treats legacy designs as glossy and ignores tampered price snapshots', () => {
    const legacy = sticker(1);
    delete legacy.customization.finish;
    expect(subtotal([legacy])).toBe(1000);
    expect(subtotal([sticker(1, 'holographic')])).toBe(1300);
  });

  it.each([0, -1, 1.5, NaN, Infinity, '20', 1000000])('rejects invalid quantity %s before it can affect the threshold', (quantity) => {
    expect(() => priceCartItems([sticker(quantity)])).toThrow(/quantity/);
  });

  it.each(['foil', '__proto__', '', false])('rejects unrecognized finish %s', (finish) => {
    expect(() => priceCartItems([sticker(20, finish)])).toThrow(/finish/);
  });
});

describe('paid sticker order snapshots', () => {
  const order = { stripe_checkout_session_id: 'cs_paid', subtotal_cents: 12000, shipping_cents: 500 };
  const session = { id: 'cs_paid', payment_status: 'paid', currency: 'usd', amount_subtotal: 12500, amount_total: 13500, total_details: { amount_tax: 1000, amount_shipping: 0 } };
  const orderItems = () => buildOrderItemSnapshots('order', priceCartItems([sticker(10), sticker(10, 'holographic')]));

  it('locks the paid finishes, designs, quantities and bulk prices before the cart can change', () => {
    const cart = priceCartItems([sticker(10), sticker(10, 'holographic')]);
    const snapshot = buildOrderItemSnapshots('order', cart);
    cart[1].customization.finish = 'glossy';
    cart[1].customization.name = 'Changed after checkout';
    cart[1].quantity = 1;
    expect(snapshot[1]).toMatchObject({ quantity: 10, unit_price_cents: 700, line_total_cents: 7000, customization: { finish: 'holographic', name: 'Luna' } });
    expect(snapshot[0].unit_price_cents).toBe(500);
  });

  it('keeps the $5 shipping separate from merchandise when Stripe includes it as a line', () => {
    expect(paidOrderAmounts(session, order, orderItems())).toEqual({ subtotal_cents: 12000, shipping_cents: 500, tax_cents: 1000, total_cents: 13500 });
  });

  it.each([
    [{ payment_status: 'unpaid' }, 'payment_not_paid'],
    [{ id: 'another_session' }, 'checkout_session_mismatch'],
    [{ currency: 'eur' }, 'checkout_currency_mismatch'],
    [{ amount_subtotal: 12000 }, 'paid_order_total_mismatch'],
    [{ amount_total: 7000 }, 'paid_order_total_mismatch'],
  ])('does not fulfill a payment that disagrees with the saved order', (patch, message) => {
    expect(() => paidOrderAmounts({ ...session, ...patch }, order, orderItems())).toThrow(message);
  });

  it('rejects missing or damaged line snapshots', () => {
    expect(() => paidOrderAmounts(session, order, [])).toThrow('order_snapshot_missing');
    const items = orderItems();
    items[0].quantity = 20;
    expect(() => paidOrderAmounts(session, order, items)).toThrow('order_line_total_mismatch');
  });
});
