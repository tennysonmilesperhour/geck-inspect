/**
 * What a gecko sold for, kept where only the people who keep the gecko can
 * read it.
 *
 * Why: every signed-in member can read the whole row of a public gecko, and
 * most geckos are public. The sale price used to sit on that row, so any
 * member could read what another breeder sold a gecko for. Since 13 November
 * 2026 the database keeps it in gecko_sale_prices, which only the gecko's
 * owner, the members of a shared collection it sits in, and admins can read
 * (supabase/migrations/20261113172624_private_sale_prices.sql). The
 * geckos.sold_price column is still there and always reads null. A price
 * written to it is moved across by the database, so saving a price works
 * exactly as before.
 *
 * This module puts the price back on the gecko objects the app reads, so
 * every screen keeps using gecko.sold_price. The Gecko entity sends every
 * read and write through geckoCall below (src/api/supabaseEntities.js); a
 * page that reads geckos some other way and needs the price calls
 * mergeGeckoSalePrices from there. It loads with the first gecko read, not
 * with the app: every public page counts against a size budget, and
 * signed-out visitors never need it.
 *
 * The one thing the database cannot see is a price taken away: a save with
 * sold_price null looks the same as a save that left the price alone, since
 * the column is always null. So such a save clears the price here, with a
 * delete the row rules allow to the gecko's editors.
 */

/** A price as the app holds it: a finite number, or null for no price. */
export function toSalePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * True for the error PostgREST gives before the migration above is applied
 * (no such table). The site can deploy before the database changes; until
 * then the old column still holds the price, so nothing is lost.
 */
export function isMissingTable(error) {
  if (!error) return false;
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  return /could not find the table|relation .* does not exist/i.test(String(error.message || ''));
}

// Long enough that a page reading geckos five times on load asks once,
// short enough that a price saved on another device shows soon.
export const SALE_PRICES_FRESH_MS = 30 * 1000;

/**
 * The store behind the Gecko entity.
 *   whoami()      the signed-in member's id, or null (signed out, or the
 *                 demo, whose sample geckos carry their prices already)
 *   fetchAll()    every row of gecko_sale_prices the member may read; the
 *                 row rules do the filtering, and the table holds one row
 *                 per sold gecko, so this stays small
 *   remove(id)    deletes one gecko's price
 */
export function createSalePriceStore({ whoami, fetchAll, remove, now = () => Date.now() }) {
  let cache = null; // { who, at, prices: Map(gecko id -> price) }
  let pending = null; // { who, promise }

  async function read() {
    let who = null;
    try {
      who = await whoami();
    } catch {
      // No client (offline before it loaded): show the geckos as read.
    }
    if (!who) return null;
    if (cache && cache.who === who && now() - cache.at < SALE_PRICES_FRESH_MS) return cache.prices;
    if (pending && pending.who === who) return pending.promise;
    const promise = Promise.resolve()
      .then(fetchAll)
      .then((rows) => {
        const prices = new Map();
        for (const row of rows || []) {
          const price = toSalePrice(row?.sold_price);
          if (row?.gecko_id != null && price != null) prices.set(String(row.gecko_id), price);
        }
        cache = { who, at: now(), prices };
        return prices;
      })
      .catch((error) => {
        // A read never fails because of this: the page shows the geckos,
        // without prices, and the next read tries again.
        if (!isMissingTable(error)) console.warn('[geckoSalePrices] could not read sale prices:', error?.message || error);
        return null;
      })
      .finally(() => {
        if (pending && pending.promise === promise) pending = null;
      });
    pending = { who, promise };
    return promise;
  }

  /** Puts each gecko's price on the rows, in place. Takes a row or a list. */
  async function merge(rows) {
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    if (list.length === 0) return rows;
    const prices = await read();
    if (!prices) return rows;
    for (const row of list) {
      if (row && row.id != null && prices.has(String(row.id))) row.sold_price = prices.get(String(row.id));
    }
    return rows;
  }

  /** Records a price the app has just saved (null: just cleared). */
  function note(id, price) {
    if (!cache || id == null) return;
    if (price == null) cache.prices.delete(String(id));
    else cache.prices.set(String(id), price);
  }

  /**
   * After a gecko is saved: the database moved any price on the save into
   * gecko_sale_prices, and the row it returned reads null. Put the price
   * back on that row, and take a price away when the save said there is
   * none.
   */
  async function afterSave(id, record, row) {
    const named = record != null && Object.prototype.hasOwnProperty.call(record, 'sold_price');
    if (!named) return merge(row);
    const price = toSalePrice(record.sold_price);
    if (price != null) {
      note(id, price);
      if (row) row.sold_price = price;
      return row;
    }
    // Nothing to take away when the store knows this gecko has no price.
    const knownEmpty = cache && !cache.prices.has(String(id));
    if (!knownEmpty && id != null) {
      await remove(id);
      note(id, null);
    }
    if (row) row.sold_price = null;
    return row;
  }

  return {
    read,
    merge,
    note,
    afterSave,
    /** Forget everything (sign-out, tests). */
    forget() {
      cache = null;
      pending = null;
    },
  };
}

// The one store for the app, made on the first gecko read.
let appStore = null;

/**
 * One Gecko entity method with the sale price put back. `base` is the plain
 * entity client; `deps` are the client helpers src/api/supabaseEntities.js
 * passes in (getSupabase, isGuestMode, withAuthRetry), so this module adds
 * nothing to the code every page loads.
 */
export async function geckoCall(method, base, args, deps) {
  appStore ||= createSalePriceStore({
    async whoami() {
      if (deps.isGuestMode()) return null;
      const supabase = await deps.getSupabase();
      const { data } = await supabase.auth.getSession();
      return data?.session?.user?.id || null;
    },
    async fetchAll() {
      const supabase = await deps.getSupabase();
      const { data, error } = await deps.withAuthRetry(() =>
        supabase.from('gecko_sale_prices').select('gecko_id, sold_price'));
      if (error) throw error;
      return data || [];
    },
    async remove(id) {
      const supabase = await deps.getSupabase();
      const { error } = await deps.withAuthRetry(() =>
        supabase.from('gecko_sale_prices').delete().eq('gecko_id', id));
      // Before the database change the table does not exist, and the save
      // itself has already cleared the old column.
      if (error && !isMissingTable(error)) throw error;
    },
  });
  switch (method) {
    case 'merge':
      return appStore.merge(args[0]);
    case 'create': {
      const row = await base.create(...args);
      // A new gecko has no price unless the save gave it one.
      const named = args[0] != null && Object.prototype.hasOwnProperty.call(args[0], 'sold_price');
      return named ? appStore.afterSave(row?.id, args[0], row) : row;
    }
    case 'update': {
      const row = await base.update(...args);
      return appStore.afterSave(args[0], args[1], row);
    }
    case 'delete': {
      const row = await base.delete(...args);
      appStore.note(args[0], null);
      return row;
    }
    default:
      // filter, list and get. list() calls the plain filter, so a list is
      // merged once.
      return appStore.merge(await base[method](...args));
  }
}
