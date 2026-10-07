import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, from } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getUser }, from } }));
import { addStickerToCart, cartLineKey, cartSubtotalCents, fetchCart, removeFromCart, updateCartItemQuantity, updateStickerFinish } from './cart';

const product = { id: 'sticker', slug: 'custom-pet-sticker', our_price_cents: 1000 };
const design = { kind: 'custom_sticker', name: 'Luna', finish: 'glossy' };

beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } });
  getUser.mockResolvedValue({ data: { user: null } });
});
afterEach(() => vi.unstubAllGlobals());

describe('mixed-finish cart persistence', () => {
  it('adds a mix as separate production lines and retains it after reload', async () => {
    await addStickerToCart(product, design, { glossy: 10, holographic: 10 });
    const { items } = await fetchCart();
    expect(items).toHaveLength(2);
    expect(items.map((item) => [item.customization.finish, item.quantity, item.unit_price_cents_snapshot])).toEqual([
      ['glossy', 10, 500], ['holographic', 10, 700],
    ]);
    expect(cartLineKey(items[0])).not.toBe(cartLineKey(items[1]));
    expect(cartSubtotalCents(items)).toBe(12000);
  });

  it('combines designs and recalculates all saved prices after quantity, finish and removal changes', async () => {
    await addStickerToCart(product, design, { glossy: 10, holographic: 0 });
    await addStickerToCart(product, { ...design, name: 'Moonlight' }, { glossy: 0, holographic: 10 });
    let { items } = await fetchCart();
    expect(cartSubtotalCents(items)).toBe(12000);
    await updateCartItemQuantity(null, cartLineKey(items[0]), 9);
    items = (await fetchCart()).items;
    expect(cartSubtotalCents(items)).toBe(22000);
    await updateStickerFinish(items[1], 'glossy');
    items = (await fetchCart()).items;
    expect(cartSubtotalCents(items)).toBe(19000);
    expect(items[1].customization.name).toBe('Moonlight');
    await removeFromCart(null, cartLineKey(items[0]));
    expect(cartSubtotalCents((await fetchCart()).items)).toBe(10000);
  });

  it('inserts both finishes in one database request for signed-in customers', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'keeper' } } });
    const cartQuery = { select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'cart' } }) };
    for (const method of ['select', 'eq', 'limit']) cartQuery[method].mockReturnValue(cartQuery);
    const itemsQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockResolvedValue({ data: [] }), insert: vi.fn().mockResolvedValue({ error: null }) };
    for (const method of ['select', 'eq']) itemsQuery[method].mockReturnValue(itemsQuery);
    from.mockImplementation((table) => table === 'store_carts' ? cartQuery : itemsQuery);
    await addStickerToCart(product, design, { glossy: 10, holographic: 10 });
    expect(itemsQuery.insert).toHaveBeenCalledTimes(1);
    const rows = itemsQuery.insert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ cart_id: 'cart', quantity: 10, unit_price_cents_snapshot: 500, customization: { finish: 'glossy' } });
    expect(rows[1]).toMatchObject({ cart_id: 'cart', quantity: 10, unit_price_cents_snapshot: 700, customization: { finish: 'holographic' } });
    expect(rows[0]).not.toHaveProperty('product');
  });

  it('does not save an empty or malformed mix', async () => {
    await expect(addStickerToCart(product, design, { glossy: 0, holographic: 0 })).rejects.toThrow('at least one');
    await expect(addStickerToCart(product, design, { glossy: 10, holographic: -1 })).rejects.toThrow('quantity');
    expect((await fetchCart()).items).toEqual([]);
  });
});
