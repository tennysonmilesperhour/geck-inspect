// The Gecko entity and private sale prices, end to end against a fake
// database that behaves like
// supabase/migrations/20261113172624_private_sale_prices.sql: a price
// written to geckos.sold_price is moved to gecko_sale_prices and the column
// reads null; unarchiving a gecko takes its price away.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  session: null,
  guest: false,
  noTrigger: false,
  pricesError: null,
  geckos: [],
  prices: [],
  calls: [],
}));

vi.mock('@/lib/supabaseLazy', () => ({ getSupabase: async () => fakeClient() }));
vi.mock('@/lib/activation', () => ({ noteEntityCreated: () => {} }));
vi.mock('@/lib/guestMode', () => ({
  isGuestMode: () => db.guest,
  blockIfGuest: (what) => { if (db.guest) throw new Error(`This is the demo: cannot ${what}`); },
}));

const ME = { id: 'member-1', email: 'keeper@example.com' };

function trigger(row, before) {
  if (db.noTrigger) return;
  if (before && ((before.archived && !row.archived) || before.created_by !== row.created_by)) {
    db.prices = db.prices.filter((p) => p.gecko_id !== row.id);
  }
  if (row.sold_price != null) {
    const existing = db.prices.find((p) => p.gecko_id === row.id);
    if (existing) existing.sold_price = row.sold_price;
    else db.prices.push({ gecko_id: row.id, sold_price: row.sold_price });
    row.sold_price = null;
  }
}

function query(table) {
  const q = { op: 'select', filters: [], patch: null };
  const rows = () => (table === 'geckos' ? db.geckos : table === 'gecko_sale_prices' ? db.prices : []);
  const hits = () => rows().filter((r) => q.filters.every(([col, val]) => (Array.isArray(val) ? val.includes(r[col]) : r[col] === val)));
  const run = () => {
    db.calls.push([table, q.op]);
    if (table === 'gecko_sale_prices' && db.pricesError) return { data: null, error: db.pricesError };
    if (q.op === 'update') {
      const matched = hits();
      for (const row of matched) {
        const before = { ...row };
        Object.assign(row, q.patch);
        trigger(row, before);
      }
      return { data: matched.map((r) => ({ ...r })), error: null };
    }
    if (q.op === 'delete') {
      const matched = hits();
      if (table === 'geckos') db.geckos = db.geckos.filter((r) => !matched.includes(r));
      if (table === 'gecko_sale_prices') db.prices = db.prices.filter((r) => !matched.includes(r));
      return { data: matched.map((r) => ({ ...r })), error: null };
    }
    return { data: hits().map((r) => ({ ...r })), error: null };
  };
  Object.assign(q, {
    select: () => q,
    eq: (col, val) => { q.filters.push([col, val]); return q; },
    in: (col, vals) => { q.filters.push([col, vals]); return q; },
    order: () => q,
    limit: () => q,
    range: () => q,
    update: (patch) => { q.op = 'update'; q.patch = patch; return q; },
    delete: () => { q.op = 'delete'; return q; },
    single: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error }; },
    maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error }; },
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  });
  return q;
}

function fakeClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: db.session } }),
      getUser: async () => ({ data: { user: db.session?.user || null } }),
      refreshSession: async () => ({ error: null }),
    },
    from: (table) => query(table),
  };
}

const priceReads = () => db.calls.filter(([table, op]) => table === 'gecko_sale_prices' && op === 'select').length;
const priceDeletes = () => db.calls.filter(([table, op]) => table === 'gecko_sale_prices' && op === 'delete').length;

let Gecko;
beforeEach(async () => {
  Object.assign(db, { session: { user: ME }, guest: false, noTrigger: false, pricesError: null, calls: [] });
  db.geckos = [
    { id: 'g-mango', name: 'Mango', created_by: ME.email, archived: true, archive_reason: 'sold', status: 'Sold', sold_price: null },
    { id: 'g-pip', name: 'Pip', created_by: ME.email, archived: false, sold_price: null },
    { id: 'g-other', name: 'Someone else\'s Lilly White', created_by: 'other@example.com', is_public: true, archived: true, sold_price: null },
  ];
  db.prices = [{ gecko_id: 'g-mango', sold_price: 300 }];
  vi.resetModules();
  ({ Gecko } = await import('../supabaseEntities'));
});

describe('reading geckos', () => {
  it('puts the member\'s own sale prices back on the geckos, once per page load', async () => {
    const mine = await Gecko.filter({ created_by: ME.email });
    expect(mine.find((g) => g.id === 'g-mango').sold_price).toBe(300);
    expect(mine.find((g) => g.id === 'g-pip').sold_price).toBeNull();
    const one = await Gecko.get('g-mango');
    expect(one.sold_price).toBe(300);
    await Gecko.list();
    expect(priceReads()).toBe(1);
  });

  it('never reads the price table for someone signed out', async () => {
    db.session = null;
    await Gecko.filter({});
    expect(priceReads()).toBe(0);
  });
});

describe('saving a price', () => {
  it('the database keeps it apart, and the app still sees it', async () => {
    const saved = await Gecko.update('g-pip', { archived: true, archive_reason: 'sold', status: 'Sold', sold_price: 250 });
    expect(saved.sold_price).toBe(250);
    // What is stored: the gecko's own row reads null; the price is in the private table.
    expect(db.geckos.find((g) => g.id === 'g-pip').sold_price).toBeNull();
    expect(db.prices).toContainEqual({ gecko_id: 'g-pip', sold_price: 250 });
    expect((await Gecko.get('g-pip')).sold_price).toBe(250);
  });

  it('a save that does not name the price keeps it on the returned gecko', async () => {
    const saved = await Gecko.update('g-mango', { name: 'Mango the Harlequin' });
    expect(saved.sold_price).toBe(300);
    expect(priceDeletes()).toBe(0);
  });

  it('clearing the price box takes the price away', async () => {
    await Gecko.filter({});
    const saved = await Gecko.update('g-mango', { sold_price: null });
    expect(saved.sold_price).toBeNull();
    expect(priceDeletes()).toBe(1);
    expect(db.prices).toEqual([]);
    expect((await Gecko.get('g-mango')).sold_price).toBeNull();
  });

  it('unarchiving takes the price away, as My Geckos always did', async () => {
    await Gecko.update('g-mango', { archived: false, archived_date: null, archive_reason: null, sold_price: null, sale_category: null });
    expect(db.prices).toEqual([]);
    expect((await Gecko.get('g-mango')).sold_price).toBeNull();
  });
});

describe('before the database change is applied', () => {
  it('reads the old column, and saves still work', async () => {
    db.noTrigger = true;
    db.pricesError = { code: 'PGRST205', message: "Could not find the table 'public.gecko_sale_prices' in the schema cache" };
    db.prices = [];
    db.geckos[0].sold_price = 300;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await Gecko.get('g-mango')).sold_price).toBe(300);
    const saved = await Gecko.update('g-mango', { sold_price: null });
    expect(saved.sold_price).toBeNull();
    expect(db.geckos[0].sold_price).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
