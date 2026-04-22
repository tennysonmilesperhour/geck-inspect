/**
 * Market Analytics — Query Facade
 *
 * The ONLY interface visualization components use to fetch analytics
 * data. Every function is async so swapping the mock-fixtures backing
 * for a Supabase / Edge Function backend is a one-file change.
 *
 * Every returned aggregate includes:
 *   - the underlying `sample_size` (how many observations)
 *   - a `confidence` score (0..1) via confidence.js
 *   - a `sources` array with the source_ids that contributed
 *   - a `__mock: true` marker when any fixtures were used
 *
 * This is deliberately mirror-shaped to what a real analytics DB would
 * return — views never need to know whether they're in mock or live mode.
 *
 * === LIVE DATA INTEGRATION (geck-data / geckintellect) =================
 * This facade is still on mock fixtures. To wire it up to the standalone
 * geck-data app (deployed at https://geckintellect.geckinspect.com), the
 * recommended pattern is a cached fetch of a published JSON snapshot:
 *
 *   async function loadSnapshot() {
 *     if (_cachedSnapshot && Date.now() - _cachedAt < 15 * 60_000) {
 *       return _cachedSnapshot;
 *     }
 *     const res = await fetch(
 *       'https://geckintellect.geckinspect.com/data/market.json',
 *       { cache: 'default' }
 *     );
 *     _cachedSnapshot = await res.json();
 *     _cachedAt = Date.now();
 *     return _cachedSnapshot;
 *   }
 *
 * Then each `query*` function awaits `loadSnapshot()` and filters/reduces
 * from there instead of calling `getTransactions()` / `getBreeders()` /
 * etc. from mockFixtures.js. Keep the return shape identical so none of
 * the visualization components need to change.
 *
 * Before making the swap, confirm with geck-data's owner:
 *   1. The snapshot URL and refresh cadence (daily? hourly?)
 *   2. The JSON schema matches what mockFixtures.js exposes — fields:
 *      transactions[], breeders[], supplyPipeline{}, demandSignals{},
 *      marketEvents[]
 *   3. CORS allows fetching from geckinspect.com
 *   4. Whether any observations need authenticated access (if yes, move
 *      the fetch behind a Supabase edge function that forwards the API
 *      key server-side instead of calling geck-data directly from the
 *      browser)
 * ========================================================================
 */

import {
  CANONICAL_MORPHS, HIGH_VALUE_COMBOS, REGIONS, AGE_CLASSES, LINEAGE_TIERS,
  TIMEFRAMES,
} from './taxonomy.js';
import { scoreConfidence, priceBand, peakScore, peakLabel, blendObservations } from './confidence.js';
import {
  getTransactions, getBreeders, getSupplyPipeline, getDemandSignals, getMarketEvents,
} from './mockFixtures.js';

// ---------- Internal helpers ------------------------------------------
const tx = () => getTransactions();
const breeders = () => getBreeders();
const brById = () => Object.fromEntries(breeders().map((b) => [b.id, b]));

function timeframeMs(code) {
  const tf = TIMEFRAMES.find((t) => t.code === code) || TIMEFRAMES[3];
  return tf.months * 30 * 86_400_000;
}
function withinTimeframe(record, code) {
  const t = Date.now() - new Date(record.date).getTime();
  return t <= timeframeMs(code);
}
function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(a, b) { return b === 0 ? 0 : ((a - b) / b) * 100; }
function uniq(arr) { return [...new Set(arr)]; }

// Normalize a scalar-or-array filter value into an array of values.
// Accepts: undefined/null (= no filter), 'foo', ['foo', 'bar']. This
// lets query callers be lazy and the UI pass arrays for multi-select.
function asList(v) {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v : [v];
}

function filterTx({ combo_id, region, regions, source_id, sources, timeframe, status, lineage_tier, age_class } = {}) {
  let out = tx();
  if (combo_id) out = out.filter((r) => r.combo_id === combo_id);
  if (region) out = out.filter((r) => r.region === region);
  if (regions && regions.length) out = out.filter((r) => regions.includes(r.region));
  if (source_id) out = out.filter((r) => r.source_id === source_id);
  if (sources && sources.length) out = out.filter((r) => sources.includes(r.source_id));
  if (status) out = out.filter((r) => r.status === status);
  const lineages = asList(lineage_tier);
  if (lineages.length) out = out.filter((r) => lineages.includes(r.lineage_tier));
  const ages = asList(age_class);
  if (ages.length) out = out.filter((r) => ages.includes(r.age_class));
  if (timeframe) out = out.filter((r) => withinTimeframe(r, timeframe));
  return out;
}

// Wrap a sync mock computation in a resolved Promise so callers can
// simply `await` regardless of backend.
const ok = (v) => Promise.resolve(v);

// ---------- Market Index ----------------------------------------------
// A weighted basket of the high-value combos: a single number that
// represents overall market health. Similar to Liv-ex 100 or StockX
// Current Culture Index. Normalized so "1000" is the value at the
// start of the timeframe.
export function queryMarketIndex({ regions = [], timeframe = '12m' } = {}) {
  const txAll = filterTx({ regions, timeframe, status: 'sold' });
  const months = monthKeysForTimeframe(timeframe);
  const byMonth = months.map((key) => {
    const inMonth = txAll.filter((r) => r.date.slice(0, 7) === key);
    const avg = mean(inMonth.map((r) => r.sold_price).filter(Boolean));
    return { month: key, avg, n: inMonth.length };
  });
  const anchor = byMonth.find((m) => m.avg > 0)?.avg || 1;
  const series = byMonth.map((m) => ({
    month: m.month,
    index: m.avg ? Math.round((m.avg / anchor) * 1000) : null,
    volume: m.n,
    __mock: true,
  }));
  const headline = series.filter((s) => s.index != null).slice(-1)[0]?.index ?? 1000;
  const first = series.find((s) => s.index != null)?.index ?? 1000;
  return ok({
    value: headline,
    change_pct: pct(headline, first),
    series,
    sample_size: txAll.length,
    confidence: scoreConfidence({ sourceId: 'estimated.blend', sampleSize: txAll.length }),
    sources: uniq(txAll.map((r) => r.source_id)),
    __mock: true,
  });
}

function monthKeysForTimeframe(code) {
  const tf = TIMEFRAMES.find((t) => t.code === code) || TIMEFRAMES[3];
  const out = [];
  const now = new Date();
  for (let i = tf.months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

// ---------- Top Movers -------------------------------------------------
// For the overview: top N combos moving up and down, with 12-week
// sparklines for each.
export function queryTopMovers({ regions = [], timeframe = '90d', limit = 5 } = {}) {
  const combos = HIGH_VALUE_COMBOS.map((c) => {
    const soldRecent = filterTx({ combo_id: c.id, regions, timeframe, status: 'sold' });
    const soldPrior = filterTx({ combo_id: c.id, regions, status: 'sold' })
      .filter((r) => !withinTimeframe(r, timeframe));
    const curAvg = mean(soldRecent.map((r) => r.sold_price));
    const priorAvg = mean(soldPrior.map((r) => r.sold_price));
    const series = buildSparkline(soldRecent.concat(soldPrior), 12);
    return {
      combo_id: c.id,
      combo_name: c.name,
      traits: c.traits,
      current_avg: Math.round(curAvg),
      prior_avg: Math.round(priorAvg),
      change_pct: pct(curAvg, priorAvg),
      sample_size: soldRecent.length,
      sparkline: series,
      confidence: scoreConfidence({ sourceId: 'estimated.blend', sampleSize: soldRecent.length }),
      sources: uniq(soldRecent.map((r) => r.source_id)),
      __mock: true,
    };
  }).filter((c) => c.sample_size >= 3);
  const up   = [...combos].sort((a, b) => b.change_pct - a.change_pct).slice(0, limit);
  const down = [...combos].sort((a, b) => a.change_pct - b.change_pct).slice(0, limit);
  return ok({ up, down, __mock: true });
}

function buildSparkline(records, buckets) {
  if (!records.length) return Array(buckets).fill(0);
  const dates = records.map((r) => new Date(r.date).getTime());
  const max = Math.max(...dates);
  const min = Math.min(...dates);
  const span = Math.max(1, max - min);
  const sums = Array(buckets).fill(0);
  const counts = Array(buckets).fill(0);
  records.forEach((r) => {
    const idx = Math.min(buckets - 1, Math.floor(((new Date(r.date).getTime() - min) / span) * buckets));
    if (r.sold_price) { sums[idx] += r.sold_price; counts[idx] += 1; }
  });
  return sums.map((s, i) => (counts[i] ? Math.round(s / counts[i]) : null));
}

// ---------- Peak indicator per combo ---------------------------------
export function queryPeakIndicators({ regions = [] } = {}) {
  const out = HIGH_VALUE_COMBOS.map((c) => {
    const recent = filterTx({ combo_id: c.id, regions, timeframe: '90d', status: 'sold' });
    const older  = filterTx({ combo_id: c.id, regions, timeframe: '12m', status: 'sold' })
      .filter((r) => !withinTimeframe(r, '90d'));
    const recentAvg = mean(recent.map((r) => r.sold_price));
    const olderAvg  = mean(older.map((r) => r.sold_price)) || recentAvg;
    const priceMomentum = clamp(pct(recentAvg, olderAvg) / 30);          // +30% → +1
    const volumeMomentum = clamp(pct(recent.length, Math.max(1, older.length / 3)) / 50);
    // Supply pressure: use pipeline signal — normalized against a 50 baseline.
    const pipe = getSupplyPipeline().find((p) => p.combo_id === c.id);
    const upcoming = pipe ? pipe.series.slice(0, 3).reduce((s, m) => s + m.projected_hatchlings, 0) : 0;
    const supplyPressure = clamp((upcoming - 25) / 50);
    // Adoption breadth: how many distinct breeders produced this combo.
    const adoption = uniq(recent.concat(older).map((r) => r.breeder_id)).length;
    const adoptionBreadth = clamp((adoption - 6) / 8);
    const score = peakScore({ priceMomentum, volumeMomentum, supplyPressure, adoptionBreadth });
    return {
      combo_id: c.id,
      combo_name: c.name,
      score,
      label: peakLabel(score),
      components: { priceMomentum, volumeMomentum, supplyPressure, adoptionBreadth },
      sample_size: recent.length + older.length,
      confidence: scoreConfidence({ sourceId: 'estimated.forecast', sampleSize: recent.length + older.length }),
      sources: uniq(recent.concat(older).map((r) => r.source_id)),
      __mock: true,
    };
  });
  return ok(out);
}
function clamp(v) { return Math.max(-1, Math.min(1, v)); }

// ---------- Trait combos detail table --------------------------------
export function queryTraitCombos({ regions = [], timeframe = '12m', age_class, lineage_tier, sources } = {}) {
  const out = HIGH_VALUE_COMBOS.map((c) => {
    const sold   = filterTx({ combo_id: c.id, regions, timeframe, status: 'sold',   age_class, lineage_tier, sources });
    const listed = filterTx({ combo_id: c.id, regions, timeframe, status: 'listed', age_class, lineage_tier, sources });
    const avgSold   = median(sold.map((r) => r.sold_price));
    const avgAsk    = median(listed.map((r) => r.ask_price).concat(sold.map((r) => r.ask_price)));
    const spreadPct = avgAsk ? ((avgAsk - avgSold) / avgAsk) * 100 : 0;
    const daysListed = mean(sold.map((r) => r.time_on_market_days));
    const confidence = scoreConfidence({ sourceId: 'estimated.blend', sampleSize: sold.length });
    const band = priceBand(avgSold, confidence);
    return {
      combo_id: c.id,
      combo_name: c.name,
      traits: c.traits,
      median_sold: Math.round(avgSold),
      median_ask: Math.round(avgAsk),
      band,
      spread_pct: +spreadPct.toFixed(1),
      avg_days_listed: Math.round(daysListed),
      volume_sold: sold.length,
      active_listings: listed.length,
      confidence,
      sources: uniq(sold.concat(listed).map((r) => r.source_id)),
      __mock: true,
    };
  }).sort((a, b) => b.volume_sold - a.volume_sold);
  return ok(out);
}

// ---------- Price history for one combo / region ---------------------
export function queryPriceHistory({ combo_id, region, sources, timeframe = '12m' } = {}) {
  const records = filterTx({ combo_id, region, sources, timeframe });
  const months = monthKeysForTimeframe(timeframe);
  const series = months.map((key) => {
    const inMonth = records.filter((r) => r.date.slice(0, 7) === key);
    const soldPrices  = inMonth.filter((r) => r.status === 'sold').map((r) => r.sold_price);
    const askPrices   = inMonth.map((r) => r.ask_price);
    const internal    = inMonth.filter((r) => r.source_id.startsWith('internal.'));
    const external    = inMonth.filter((r) => r.source_id.startsWith('external.'));
    const avgSold     = mean(soldPrices);
    const conf = scoreConfidence({ sourceId: 'estimated.blend', sampleSize: soldPrices.length });
    const band = priceBand(avgSold || mean(askPrices), conf);
    return {
      month: key,
      label: new Date(key + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }),
      median_sold: Math.round(median(soldPrices)),
      median_ask:  Math.round(median(askPrices)),
      avg_sold: Math.round(avgSold),
      internal_avg: Math.round(mean(internal.map((r) => r.sold_price || r.ask_price))),
      external_avg: Math.round(mean(external.map((r) => r.sold_price || r.ask_price))),
      low: band.low, high: band.high,
      volume: inMonth.length,
      confidence: conf,
      __mock: true,
    };
  });
  return ok({
    combo_id, region,
    series,
    sample_size: records.length,
    confidence: scoreConfidence({ sourceId: 'estimated.blend', sampleSize: records.length }),
    sources: uniq(records.map((r) => r.source_id)),
    __mock: true,
  });
}

// ---------- Regional heatmap ------------------------------------------
export function queryRegionalHeatmap({ timeframe = '12m', metric = 'median_sold' } = {}) {
  const cells = [];
  HIGH_VALUE_COMBOS.forEach((c) => {
    REGIONS.forEach((r) => {
      const inCell = filterTx({ combo_id: c.id, region: r.code, timeframe, status: 'sold' });
      const val = metric === 'median_sold'
        ? median(inCell.map((x) => x.sold_price))
        : metric === 'days_listed'
        ? mean(inCell.map((x) => x.time_on_market_days))
        : inCell.length;
      const conf = scoreConfidence({ sourceId: 'estimated.blend', sampleSize: inCell.length });
      cells.push({
        combo_id: c.id,
        combo_name: c.name,
        region: r.code,
        region_name: r.name,
        value: Math.round(val),
        sample_size: inCell.length,
        confidence: conf,
        sources: uniq(inCell.map((x) => x.source_id)),
        __mock: true,
      });
    });
  });
  return ok(cells);
}

// ---------- Arbitrage opportunities ----------------------------------
// For each combo, compare the cheapest region vs the most expensive.
// Score edge = (sell_price - buy_price - shipping_cost) / buy_price,
// then discount by the product of import_friction for both regions
// (friction ~ risk). Only surface opportunities with meaningful sample
// sizes on both sides.
export function queryArbitrage({ timeframe = '6m', minSample = 4 } = {}) {
  const rows = [];
  HIGH_VALUE_COMBOS.forEach((c) => {
    const byRegion = REGIONS.map((r) => {
      const s = filterTx({ combo_id: c.id, region: r.code, timeframe, status: 'sold' });
      return {
        region: r, sample: s.length,
        median: median(s.map((x) => x.sold_price)),
      };
    }).filter((x) => x.sample >= minSample && x.median > 0);
    if (byRegion.length < 2) return;
    byRegion.sort((a, b) => a.median - b.median);
    const buy = byRegion[0];
    const sell = byRegion[byRegion.length - 1];
    if (buy.region.code === sell.region.code) return;
    const shipping = estimateShipping(buy.region, sell.region);
    const grossEdge = (sell.median - buy.median - shipping) / buy.median;
    const risk = 1 - ((1 - buy.region.import_friction) * (1 - sell.region.import_friction));
    const riskAdjEdge = grossEdge * (1 - risk * 0.5);
    const conf = scoreConfidence({ sourceId: 'estimated.blend', sampleSize: buy.sample + sell.sample });
    rows.push({
      combo_id: c.id,
      combo_name: c.name,
      buy_region: buy.region.code,
      buy_region_name: buy.region.name,
      buy_price: Math.round(buy.median),
      sell_region: sell.region.code,
      sell_region_name: sell.region.name,
      sell_price: Math.round(sell.median),
      shipping_estimate: Math.round(shipping),
      gross_edge_pct: +(grossEdge * 100).toFixed(1),
      risk_adjusted_edge_pct: +(riskAdjEdge * 100).toFixed(1),
      risk_score: +risk.toFixed(2),
      sample_size: buy.sample + sell.sample,
      confidence: conf,
      __mock: true,
    });
  });
  rows.sort((a, b) => b.risk_adjusted_edge_pct - a.risk_adjusted_edge_pct);
  return ok(rows);
}
function estimateShipping(a, b) {
  // Rough live-animal logistics estimate in USD. Real pipeline would
  // plug live freight quotes here.
  if (a.code === b.code) return 0;
  if (a.code === 'US' && b.code === 'US') return 65;
  const intlSame = ['EU', 'UK', 'SE'];
  if (intlSame.includes(a.code) && intlSame.includes(b.code)) return 180;
  // Cross-continent, restricted regions, expedited live freight.
  return 650 + (a.import_friction + b.import_friction) * 250;
}

// ---------- Supply pipeline ------------------------------------------
export function querySupplyPipeline({ combos } = {}) {
  let data = getSupplyPipeline();
  if (combos?.length) data = data.filter((d) => combos.includes(d.combo_id));
  // Attach a confidence based on active_pairs — more pairs logged = more
  // reliable forecast.
  return ok(data.map((d) => ({
    ...d,
    confidence: scoreConfidence({ sourceId: 'internal.breeding', sampleSize: d.active_pairs * 2 }),
    sources: ['internal.breeding'],
  })));
}

// ---------- Breeder market share / HHI --------------------------------
export function queryBreederShare({ regions = [], timeframe = '12m' } = {}) {
  const records = filterTx({ regions, timeframe, status: 'sold' });
  const byBreeder = {};
  records.forEach((r) => {
    byBreeder[r.breeder_id] = byBreeder[r.breeder_id] || { revenue: 0, count: 0 };
    byBreeder[r.breeder_id].revenue += r.sold_price || 0;
    byBreeder[r.breeder_id].count += 1;
  });
  const totalRevenue = Object.values(byBreeder).reduce((s, x) => s + x.revenue, 0) || 1;
  const breederMap = brById();
  const ranked = Object.entries(byBreeder).map(([id, v]) => ({
    breeder_id: id,
    name: breederMap[id]?.name ?? id,
    tier: breederMap[id]?.tier ?? 'unknown',
    region: breederMap[id]?.region ?? '—',
    revenue: Math.round(v.revenue),
    volume: v.count,
    share_pct: +((v.revenue / totalRevenue) * 100).toFixed(2),
    __mock: true,
  })).sort((a, b) => b.revenue - a.revenue);
  // Herfindahl-Hirschman Index, 0..10000. <1500 competitive, >2500 concentrated.
  const hhi = Math.round(ranked.reduce((s, b) => s + Math.pow(b.share_pct, 2), 0));
  return ok({
    breeders: ranked,
    hhi,
    concentration_label: hhi < 1500 ? 'competitive' : hhi < 2500 ? 'moderately concentrated' : 'highly concentrated',
    sample_size: records.length,
    confidence: scoreConfidence({ sourceId: 'estimated.blend', sampleSize: records.length }),
    __mock: true,
  });
}

// ---------- Transactions drilldown ------------------------------------
export function queryTransactions({
  combo_id, region, regions, sources, timeframe, age_class, lineage_tier, limit = 50,
} = {}) {
  const rows = filterTx({ combo_id, region, regions, sources, timeframe, age_class, lineage_tier })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  return ok(rows);
}

// ---------- Demand signals --------------------------------------------
export function queryDemandVelocity({ morphs } = {}) {
  const all = getDemandSignals();
  const list = morphs?.length ? morphs.map((m) => all[m]).filter(Boolean) : Object.values(all);
  return ok(list.map((r) => ({
    ...r,
    headline_searches_per_week: r.weekly.slice(-1)[0]?.searches ?? 0,
    four_week_change_pct: pct(
      mean(r.weekly.slice(-4).map((w) => w.searches)),
      mean(r.weekly.slice(-8, -4).map((w) => w.searches)),
    ),
    confidence: scoreConfidence({ sourceId: 'internal.behavior', sampleSize: mean(r.weekly.map((w) => w.searches)) }),
    sources: ['internal.behavior'],
  })));
}

// ---------- Market events (expo calendar, breeder releases) ----------
export function queryMarketEvents() { return ok(getMarketEvents()); }

// ---------- Taxonomy passthrough (handy for UI selectors) ------------
export function getAllCombos()    { return HIGH_VALUE_COMBOS; }
export function getAllMorphs()    { return CANONICAL_MORPHS; }
export function getAllRegions()   { return REGIONS; }
export function getAllAgeClasses(){ return AGE_CLASSES; }
export function getAllLineageTiers() { return LINEAGE_TIERS; }
export function getAllTimeframes(){ return TIMEFRAMES; }

// ---------- Blended headline ------------------------------------------
// A demonstrative helper showing the blend: given the raw-source means
// for one combo in one region, produce a blended price with full
// contribution metadata.
export function blendedHeadline({ combo_id, region }) {
  const records = filterTx({ combo_id, region, timeframe: '12m', status: 'sold' });
  const bySource = {};
  records.forEach((r) => {
    bySource[r.source_id] = bySource[r.source_id] || [];
    bySource[r.source_id].push(r.sold_price);
  });
  const observations = Object.entries(bySource).map(([sourceId, prices]) => ({
    sourceId, value: mean(prices), sampleSize: prices.length, regionMatch: true,
  }));
  if (!observations.length) return ok(null);
  const blended = blendObservations(observations);
  return ok({ ...blended, combo_id, region, __mock: true });
}
