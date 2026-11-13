// src/lib/geckoSalePrices.js: what a gecko sold for is read from
// gecko_sale_prices (which only the people who keep the gecko can read)
// and put back on the gecko objects the app uses.
import { describe, expect, it, vi } from 'vitest';
import {
  createSalePriceStore, isMissingTable, toSalePrice, SALE_PRICES_FRESH_MS,
} from '../geckoSalePrices';

function store({ who = 'member-1', rows = [], fail = null, now } = {}) {
  const calls = { fetch: 0, removed: [] };
  let clock = 0;
  const state = { who, rows, fail };
  const s = createSalePriceStore({
    whoami: async () => state.who,
    fetchAll: async () => {
      calls.fetch += 1;
      if (state.fail) throw state.fail;
      return state.rows;
    },
    remove: async (id) => {
      calls.removed.push(id);
      if (state.removeFails) throw state.removeFails;
    },
    now: now || (() => clock),
  });
  return { s, calls, state, tick: (ms) => { clock += ms; } };
}

describe('toSalePrice', () => {
  it('reads numbers and numeric text, and treats blanks as no price', () => {
    expect(toSalePrice(300)).toBe(300);
    expect(toSalePrice('250.5')).toBe(250.5);
    expect(toSalePrice(0)).toBe(0);
    expect(toSalePrice('')).toBeNull();
    expect(toSalePrice(null)).toBeNull();
    expect(toSalePrice(undefined)).toBeNull();
    expect(toSalePrice('lots')).toBeNull();
  });
});

describe('isMissingTable', () => {
  it('knows the errors for a table the database does not have yet', () => {
    expect(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.gecko_sale_prices' in the schema cache" })).toBe(true);
    expect(isMissingTable({ code: '42P01', message: 'relation "public.gecko_sale_prices" does not exist' })).toBe(true);
    expect(isMissingTable({ code: '42501', message: 'permission denied for table gecko_sale_prices' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});

describe('merge', () => {
  it('puts each price on its gecko and leaves the others alone', async () => {
    const { s } = store({ rows: [{ gecko_id: 'g-mango', sold_price: '300' }] });
    const rows = [{ id: 'g-mango', sold_price: null }, { id: 'g-other', sold_price: null }];
    await s.merge(rows);
    expect(rows).toEqual([{ id: 'g-mango', sold_price: 300 }, { id: 'g-other', sold_price: null }]);
  });

  it('takes a single row too, and an empty answer', async () => {
    const { s, calls } = store({ rows: [{ gecko_id: 'g-mango', sold_price: 300 }] });
    const row = { id: 'g-mango', sold_price: null };
    expect(await s.merge(row)).toBe(row);
    expect(row.sold_price).toBe(300);
    expect(await s.merge([])).toEqual([]);
    expect(await s.merge(null)).toBeNull();
    expect(calls.fetch).toBe(1);
  });

  it('asks the database once for reads that come together, and again once the copy is old', async () => {
    const { s, calls, tick } = store({ rows: [{ gecko_id: 'g-mango', sold_price: 300 }] });
    await Promise.all([s.merge([{ id: 'g-mango' }]), s.merge([{ id: 'g-mango' }]), s.merge({ id: 'g-mango' })]);
    expect(calls.fetch).toBe(1);
    tick(SALE_PRICES_FRESH_MS - 1);
    await s.merge([{ id: 'g-mango' }]);
    expect(calls.fetch).toBe(1);
    tick(2);
    await s.merge([{ id: 'g-mango' }]);
    expect(calls.fetch).toBe(2);
  });

  it('never asks when nobody is signed in, or in the demo', async () => {
    const { s, calls } = store({ who: null });
    const rows = [{ id: 'g-mango', sold_price: 420 }];
    await s.merge(rows);
    expect(calls.fetch).toBe(0);
    // The demo's sample geckos keep the prices they carry.
    expect(rows[0].sold_price).toBe(420);
  });

  it('asks again for a different member, so one member never sees another member\'s copy', async () => {
    const { s, calls, state } = store({ rows: [{ gecko_id: 'g-mango', sold_price: 300 }] });
    await s.merge([{ id: 'g-mango' }]);
    state.who = 'member-2';
    state.rows = [];
    const rows = [{ id: 'g-mango', sold_price: null }];
    await s.merge(rows);
    expect(calls.fetch).toBe(2);
    expect(rows[0].sold_price).toBeNull();
  });

  it('shows the geckos without prices when the read fails, and tries again next time', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { s, calls, state } = store({ fail: { code: '08006', message: 'network down' } });
    const rows = [{ id: 'g-mango', sold_price: null }];
    await expect(s.merge(rows)).resolves.toBe(rows);
    expect(rows[0].sold_price).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    state.fail = null;
    state.rows = [{ gecko_id: 'g-mango', sold_price: 300 }];
    await s.merge(rows);
    expect(calls.fetch).toBe(2);
    expect(rows[0].sold_price).toBe(300);
    warn.mockRestore();
  });

  it('says nothing while the table does not exist yet, and keeps what the old column says', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { s } = store({ fail: { code: 'PGRST205', message: 'Could not find the table' } });
    const rows = [{ id: 'g-mango', sold_price: 300 }];
    await s.merge(rows);
    expect(rows[0].sold_price).toBe(300);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('afterSave', () => {
  it('puts a price just saved back on the returned row, which the database left null', async () => {
    const { s, calls } = store();
    await s.read();
    const row = await s.afterSave('g-mango', { archived: true, sold_price: 300 }, { id: 'g-mango', sold_price: null });
    expect(row.sold_price).toBe(300);
    expect(calls.removed).toEqual([]);
    // Later reads in the same page see it without asking again.
    const later = [{ id: 'g-mango', sold_price: null }];
    await s.merge(later);
    expect(later[0].sold_price).toBe(300);
    expect(calls.fetch).toBe(1);
  });

  it('takes a price away when the save says there is none', async () => {
    const { s, calls } = store({ rows: [{ gecko_id: 'g-mango', sold_price: 300 }] });
    await s.read();
    const row = await s.afterSave('g-mango', { sold_price: null }, { id: 'g-mango', sold_price: null });
    expect(calls.removed).toEqual(['g-mango']);
    expect(row.sold_price).toBeNull();
    const later = [{ id: 'g-mango', sold_price: null }];
    await s.merge(later);
    expect(later[0].sold_price).toBeNull();
  });

  it('a blank price box counts as no price', async () => {
    const { s, calls } = store({ rows: [{ gecko_id: 'g-mango', sold_price: 300 }] });
    await s.read();
    await s.afterSave('g-mango', { sold_price: '' }, { id: 'g-mango' });
    expect(calls.removed).toEqual(['g-mango']);
  });

  it('skips the delete when it already knows the gecko has no price', async () => {
    const { s, calls } = store({ rows: [] });
    await s.read();
    await s.afterSave('g-new', { sold_price: null }, { id: 'g-new' });
    expect(calls.removed).toEqual([]);
  });

  it('deletes when it does not know yet', async () => {
    const { s, calls } = store();
    await s.afterSave('g-mango', { sold_price: null }, { id: 'g-mango' });
    expect(calls.removed).toEqual(['g-mango']);
  });

  it('a save that does not name the price keeps it on the returned row', async () => {
    const { s, calls } = store({ rows: [{ gecko_id: 'g-mango', sold_price: 300 }] });
    const row = await s.afterSave('g-mango', { name: 'Mango' }, { id: 'g-mango', name: 'Mango', sold_price: null });
    expect(row.sold_price).toBe(300);
    expect(calls.removed).toEqual([]);
  });

  it('a failed delete fails the save, so the member can try again', async () => {
    const { s, state } = store({ rows: [{ gecko_id: 'g-mango', sold_price: 300 }] });
    await s.read();
    state.removeFails = { code: '08006', message: 'network down' };
    await expect(s.afterSave('g-mango', { sold_price: null }, { id: 'g-mango' })).rejects.toMatchObject({ code: '08006' });
  });
});
