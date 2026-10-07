import { isPricedSticker, normalizeStickerFinish } from './stickerPricing.js';

/** Persist before creating Stripe Checkout; later cart edits cannot change production. */
export function buildOrderItemSnapshots(orderId, pricedItems) {
  return pricedItems.map((item) => ({
    order_id: orderId,
    product_id: item.product.id,
    vendor_id: item.product.vendor_id,
    fulfillment_mode: item.product.fulfillment_mode,
    product_name_snapshot: item.product.name,
    vendor_sku_snapshot: item.product.vendor_sku,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents_snapshot,
    line_total_cents: item.unit_price_cents_snapshot * item.quantity,
    vendor_extra_snapshot: structuredClone(item.product.vendor_extra ?? null),
    customization: item.customization ? {
      ...structuredClone(item.customization),
      ...(isPricedSticker(item) ? { finish: normalizeStickerFinish(item.customization.finish) } : {}),
    } : null,
  }));
}

/** Shipping is a Checkout line item, so Stripe includes it in amount_subtotal. */
export function paidOrderAmounts(session, order, items) {
  if (session.payment_status !== 'paid') throw new Error('payment_not_paid');
  if (session.id !== order.stripe_checkout_session_id) throw new Error('checkout_session_mismatch');
  if (session.currency !== 'usd') throw new Error('checkout_currency_mismatch');
  if (!items.length) throw new Error('order_snapshot_missing');
  const subtotal = items.reduce((sum, item) => {
    if (item.line_total_cents !== item.unit_price_cents * item.quantity) throw new Error('order_line_total_mismatch');
    return sum + item.line_total_cents;
  }, 0);
  const shipping = Number(order.shipping_cents);
  const tax = Number(session.total_details?.amount_tax ?? 0);
  const total = Number(session.amount_total);
  if (subtotal !== Number(order.subtotal_cents) || Number(session.amount_subtotal) !== subtotal + shipping || total !== subtotal + shipping + tax) {
    throw new Error('paid_order_total_mismatch');
  }
  return { subtotal_cents: subtotal, shipping_cents: shipping, tax_cents: tax, total_cents: total };
}
