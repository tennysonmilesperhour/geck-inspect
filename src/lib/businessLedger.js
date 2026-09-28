/**
 * Business Tools ledger: turns sold geckos, sales typed in by hand,
 * claimed transfers and logged costs into revenue, profit per season and
 * profit per pairing.
 *
 * Where each sale comes from:
 *   - A sold gecko still in your records (archived as sold, or status
 *     Sold). Its amount is `sold_price`; until that is entered, the asking
 *     price stands in and the entry is flagged `confirmed: false`.
 *   - A sale typed in by hand (a marketplace_costs row whose category
 *     starts with "sale:").
 *   - A claimed ownership transfer you sent with a sale price. The gecko
 *     row moves to the buyer when they claim it, so the transfer's
 *     sale_price is the only record of that sale on your side.
 *
 * Pure functions only, so the numbers can be tested without the page.
 */

export const REVENUE_CATEGORIES = [
  { value: 'produced_in_house', label: 'Produced in house' },
  { value: 'resale', label: 'Resale' },
  { value: 'holdback_release', label: 'Holdback release' },
  { value: 'retired_breeder', label: 'Retired breeder' },
  { value: 'other', label: 'Other' },
];

const REVENUE_VALUES = new Set(REVENUE_CATEGORIES.map((c) => c.value));

export function revenueCategoryLabel(value) {
  return REVENUE_CATEGORIES.find((c) => c.value === value)?.label || 'Not set';
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function isSoldGecko(gecko) {
  if (!gecko) return false;
  if (String(gecko.notes || '').startsWith('[Manual sale]')) return false;
  return (gecko.archived && gecko.archive_reason === 'sold') || gecko.status === 'Sold';
}

/** What a sold gecko brought in, and whether that is the real sold price. */
export function saleAmount(gecko) {
  const sold = num(gecko?.sold_price);
  if (sold !== null) return { amount: sold, confirmed: true };
  const asking = num(gecko?.asking_price);
  return { amount: asking && asking > 0 ? asking : 0, confirmed: false };
}

export function saleDate(gecko) {
  return gecko?.archived_date || gecko?.updated_date || gecko?.created_date || null;
}

/**
 * Ids of geckos hatched from your own pairings: linked from an egg on one
 * of your breeding plans, or both parents in your records.
 */
export function bredInHouseIds({ geckos = [], eggs = [] }) {
  const ids = new Set(eggs.map((e) => e.gecko_id).filter(Boolean));
  const own = new Set(geckos.map((g) => g.id));
  for (const g of geckos) {
    if (g.sire_id && g.dam_id && own.has(g.sire_id) && own.has(g.dam_id)) ids.add(g.id);
  }
  return ids;
}

/** Saved category, else "produced in house" for geckos you bred, else none. */
export function saleCategoryFor(gecko, bredIds) {
  if (REVENUE_VALUES.has(gecko?.sale_category)) return gecko.sale_category;
  return gecko?.id && bredIds?.has(gecko.id) ? 'produced_in_house' : null;
}

/**
 * Every sale as one list, newest first.
 * transferNames maps animal_id to a display name (the row now belongs to
 * the buyer, so it may not be readable).
 */
export function revenueEntries({ geckos = [], manualSales = [], transfers = [], transferNames = {}, bredIds = new Set() }) {
  const out = [];
  for (const g of geckos) {
    if (!isSoldGecko(g)) continue;
    const { amount, confirmed } = saleAmount(g);
    out.push({
      id: g.id,
      kind: 'gecko',
      geckoId: g.id,
      name: g.name || 'Unnamed gecko',
      date: saleDate(g),
      amount,
      confirmed,
      category: saleCategoryFor(g, bredIds),
      image: g.image_urls?.[0] || null,
      gecko: g,
    });
  }
  for (const s of manualSales) {
    out.push({
      id: s.id,
      kind: 'manual',
      geckoId: s.gecko_id || null,
      name: s.description || 'Sale',
      date: s.date || s.created_date || null,
      amount: num(s.amount) || 0,
      confirmed: true,
      category: String(s.category || '').replace(/^sale:/, '') || null,
      image: null,
    });
  }
  const seen = new Set(out.filter((e) => e.kind === 'gecko').map((e) => e.geckoId));
  for (const t of transfers) {
    // A transfer with no price may be a gift or a move between your own
    // accounts, so only priced transfers count as sales.
    const price = num(t.sale_price);
    if (t.status !== 'claimed' || price === null || seen.has(t.animal_id)) continue;
    out.push({
      id: `transfer:${t.id}`,
      kind: 'transfer',
      geckoId: t.animal_id,
      name: transferNames[t.animal_id] || 'Transferred animal',
      date: t.claimed_at || t.updated_date || t.created_date || null,
      amount: price,
      confirmed: true,
      category: bredIds.has(t.animal_id) ? 'produced_in_house' : null,
      image: null,
    });
  }
  return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

const yearOf = (d) => {
  if (!d) return null;
  const y = Number(String(d).slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
};

export function ledgerTotals(entries = [], costs = [], now = new Date()) {
  const year = now.getFullYear();
  const revenue = entries.reduce((s, e) => s + e.amount, 0);
  const costTotal = costs.reduce((s, c) => s + (num(c.amount) || 0), 0);
  return {
    revenue,
    costs: costTotal,
    profit: revenue - costTotal,
    ytdRevenue: entries.filter((e) => yearOf(e.date) === year).reduce((s, e) => s + e.amount, 0),
    unconfirmed: entries.filter((e) => !e.confirmed).length,
    sales: entries.length,
  };
}

/** Revenue, costs and profit per calendar year (a crested gecko season), newest first. */
export function profitBySeason(entries = [], costs = []) {
  const rows = new Map();
  const row = (y) => {
    if (!rows.has(y)) rows.set(y, { year: y, revenue: 0, costs: 0, sales: 0, unconfirmed: 0 });
    return rows.get(y);
  };
  for (const e of entries) {
    const r = row(yearOf(e.date));
    r.revenue += e.amount;
    r.sales += 1;
    if (!e.confirmed) r.unconfirmed += 1;
  }
  for (const c of costs) row(yearOf(c.date)).costs += num(c.amount) || 0;
  return [...rows.values()]
    .map((r) => ({ ...r, profit: r.revenue - r.costs }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export function pairingLabel(plan, namesById = {}) {
  const sire = namesById[plan?.sire_id] || 'Unknown sire';
  const dam = namesById[plan?.dam_id] || 'Unknown dam';
  return `${sire} × ${dam}`;
}

export function pairingSeason(plan) {
  const season = String(plan?.breeding_season || '').trim();
  if (season) return season;
  const y = yearOf(plan?.pairing_date || plan?.created_date);
  return y ? String(y) : '';
}

/**
 * Profit per pairing: sales of its offspring minus costs logged against
 * the pairing or against any of its offspring. Offspring are geckos linked
 * from the pairing's eggs, plus geckos with the same sire and dam.
 * Pairings with nothing hatched, sold or spent are left out.
 */
export function profitByPairing({ plans = [], eggs = [], geckos = [], entries = [], costs = [], namesById = {} }) {
  const out = [];
  for (const plan of plans) {
    const planEggs = eggs.filter((e) => e.breeding_plan_id === plan.id);
    const offspring = new Set(planEggs.map((e) => e.gecko_id).filter(Boolean));
    for (const g of geckos) {
      if (g.sire_id && g.sire_id === plan.sire_id && g.dam_id && g.dam_id === plan.dam_id) offspring.add(g.id);
    }
    const sold = entries.filter((e) => e.geckoId && offspring.has(e.geckoId));
    const planCosts = costs.filter((c) => c.breeding_plan_id === plan.id || (c.gecko_id && offspring.has(c.gecko_id)));
    const revenue = sold.reduce((s, e) => s + e.amount, 0);
    const costTotal = planCosts.reduce((s, c) => s + (num(c.amount) || 0), 0);
    if (!offspring.size && !sold.length && !planCosts.length) continue;
    out.push({
      plan,
      label: pairingLabel(plan, namesById),
      season: pairingSeason(plan),
      eggs: planEggs.length,
      hatched: offspring.size,
      sold: sold.length,
      unconfirmed: sold.filter((e) => !e.confirmed).length,
      revenue,
      costs: costTotal,
      profit: revenue - costTotal,
    });
  }
  return out.sort((a, b) => b.profit - a.profit);
}

/** Select options for tying a cost to a pairing or a gecko. */
export function costLinkOptions({ plans = [], geckos = [], namesById = {} }) {
  const pairings = plans.map((p) => ({
    value: `plan:${p.id}`,
    label: [pairingLabel(p, namesById), pairingSeason(p)].filter(Boolean).join(', '),
  }));
  const animals = geckos
    .filter((g) => g.name)
    .map((g) => ({ value: `gecko:${g.id}`, label: g.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { pairings, animals };
}

export function costLinkValue(cost) {
  if (cost?.breeding_plan_id) return `plan:${cost.breeding_plan_id}`;
  if (cost?.gecko_id) return `gecko:${cost.gecko_id}`;
  return '';
}

export function parseCostLink(value) {
  const [kind, id] = String(value || '').split(/:(.+)/);
  return {
    breeding_plan_id: kind === 'plan' && id ? id : null,
    gecko_id: kind === 'gecko' && id ? id : null,
  };
}
