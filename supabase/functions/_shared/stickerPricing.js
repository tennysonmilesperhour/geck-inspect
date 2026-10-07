/** Shared by the designer, cart, and checkout. All amounts are USD cents. */
export const CUSTOM_STICKER_SLUG = 'custom-pet-sticker';
export const CUSTOM_STICKER_PRICE_CENTS = 1000;
export const STICKER_HOLOGRAPHIC_UPCHARGE_CENTS = 300;
export const STICKER_BULK_MINIMUM = 20;
export const STICKER_BULK_STANDARD_CENTS = 500;
export const STICKER_BULK_HOLOGRAPHIC_CENTS = 700;

export const STICKER_FINISHES = [
  { value: 'glossy', label: 'Standard glossy' },
  { value: 'holographic', label: 'Holographic' },
];

export function normalizeStickerFinish(finish) {
  // Designs saved before finish selection shipped are standard glossy.
  if (finish == null || finish === 'glossy') return 'glossy';
  if (finish === 'holographic') return finish;
  throw new Error('Choose a standard glossy or holographic finish.');
}

export function stickerFinishLabel(finish) {
  return normalizeStickerFinish(finish) === 'holographic' ? 'Holographic' : 'Standard glossy';
}

export function validateCartQuantity(quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999) {
    throw new Error('Choose a whole-number quantity from 1 to 999,999.');
  }
  return quantity;
}

/** Only the catalog product qualifies; a client-supplied design kind cannot. */
export function isPricedSticker(item) {
  return item?.product?.slug === CUSTOM_STICKER_SLUG;
}

export function stickerCartQuantity(items = []) {
  return items.filter(isPricedSticker).reduce((sum, item) => sum + validateCartQuantity(item.quantity), 0);
}

export function stickerUnitPriceCents(finish, totalStickerQuantity = 1) {
  const holographic = normalizeStickerFinish(finish) === 'holographic';
  if (totalStickerQuantity >= STICKER_BULK_MINIMUM) {
    return holographic ? STICKER_BULK_HOLOGRAPHIC_CENTS : STICKER_BULK_STANDARD_CENTS;
  }
  return CUSTOM_STICKER_PRICE_CENTS + (holographic ? STICKER_HOLOGRAPHIC_UPCHARGE_CENTS : 0);
}

/** Ignore stale add-to-cart prices. Checkout supplies products from the database. */
export function priceCartItems(items = []) {
  const stickerQuantity = stickerCartQuantity(items);
  return items.map((item) => {
    validateCartQuantity(item.quantity);
    const unitPrice = isPricedSticker(item)
      ? stickerUnitPriceCents(item.customization?.finish, stickerQuantity)
      : Number(item.product?.our_price_cents ?? item.unit_price_cents_snapshot);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || !Number.isSafeInteger(unitPrice * item.quantity)) {
      throw new Error('This item’s price is unavailable. Please refresh your cart.');
    }
    return { ...item, unit_price_cents_snapshot: unitPrice };
  });
}
