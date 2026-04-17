/**
 * Market Analytics — Mock Fixtures
 *
 * Deterministic mock data generators for the Market Analytics module.
 * Everything here is seeded from a single constant so the UI renders
 * the same numbers across reloads — serious users get twitchy when
 * values jump randomly between page loads.
 *
 * Every record is tagged with `__mock: true` and a `source_id` so the
 * visualization layer can render the SourceBadge accurately and, when
 * real data pipelines are wired up, these generators can be dropped
 * without touching any view component.
 *
 * To migrate: replace each `fakeXxx()` call in `queries.js` with a
 * Supabase query. The shape of the records here matches the schema
 * the analytics tables should have.
 */

import {
  CANONICAL_MORPHS,
  HIGH_VALUE_COMBOS,
  REGIONS,
  AGE_CLASSES,
  LINEAGE_TIERS,
} from './taxonomy.js';

// ---------- Seeded RNG ------------------------------------------------
// mulberry32 — tiny, fast, repeatable. We expose helpers for deterministic
// "random" choices so the same morph/region pair always gets the same
// mock distribution.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seeded(key) { return mulberry32(hashString(String(key))); }

// ---------- Breeder identities ----------------------------------------
// A curated cast of synthetic breeder names across regions so the UI
// has realistic-looking attribution. Real ingestion would populate
// this table from scraped breeder profiles.
const BREEDER_NAMES = [
  'Ridgeback Reptiles', 'Moonlit Morphs', 'Crested Cascades', 'Alpine Geckos',
  'Tidewater Exotics', 'Northern Lights Cresties', 'Sable Coast Herps',
  'Obsidian Line Reptiles', 'Frost & Flame', 'Harbor City Geckos',
  'Terra Nova Cresties', 'Kodama Reptiles', 'Kobe Color Lab',
  'Nordic Morph Works', 'Lowlands Reptile Collective', 'Cordillera Geckos',
  'Pacific Rim Exotics', 'Outback Cresties', 'Midland Morphs',
  'Rainwood Reptiles', 'Skyline Geckos', 'Copperleaf Cresties',
  'Silverstream Exotics', 'High Desert Herps', 'Channel Island Geckos',
];

export function getBreeders() {
  return BREEDER_NAMES.map((name, i) => {
    const rng = seeded(`breeder:${name}`);
    const tierRoll = rng();
    const tier =
      tierRoll < 0.05 ? 'og_line' :
      tierRoll < 0.25 ? 'named' :
      tierRoll < 0.6  ? 'regional_known' :
      'hobby';
    const regionPool = ['US','US','US','EU','EU','UK','CA','AU','JP','SE'];
    const region = regionPool[Math.floor(rng() * regionPool.length)];
    return {
      id: `b_${i.toString().padStart(3, '0')}`,
      name,
      tier,
      region,
      active_since: 2005 + Math.floor(rng() * 18),
      specialties: pickSpecialties(rng),
      __mock: true,
    };
  });
}
function pickSpecialties(rng) {
  const pool = CANONICAL_MORPHS.map((m) => m.name);
  const count = 1 + Math.floor(rng() * 3);
  const out = new Set();
  while (out.size < count) out.add(pool[Math.floor(rng() * pool.length)]);
  return [...out];
}

// ---------- Transactions / listings ----------------------------------
// One unified record type with `status`: 'sold' or 'listed'. Downstream
// queries filter by status to produce sold-vs-ask analytics.
function morphBasePrice(morphName) {
  // Premium tier drives the anchor price; individual morphs drift
  // around that anchor.
  const m = CANONICAL_MORPHS.find((x) => x.name === morphName);
  const anchor =
    m?.premium_tier === 'flagship' ? 800 :
    m?.premium_tier === 'premium'  ? 450 :
    m?.premium_tier === 'mid'      ? 200 :
    100;
  const rng = seeded(`anchor:${morphName}`);
  return Math.round(anchor * (0.85 + rng() * 0.3));
}

function regionMultiplier(region, morphName) {
  // Simulate real regional preferences. These biases are drawn from
  // the brief: EU premium on Lilly White combos, JP on specific aesthetic
  // traits, US depth on structural (pinstripe), AU scarcity premium.
  const rng = seeded(`regbias:${region}:${morphName}`);
  const noise = 0.9 + rng() * 0.2;
  const m = morphName;
  const byRegion = {
    US:  1.0,
    EU:  m.includes('Lilly') ? 1.25 : m.includes('Axanthic') ? 1.15 : 1.0,
    UK:  m.includes('Lilly') ? 1.2  : 0.95,
    CA:  0.9,
    AU:  1.6,                      // scarcity — imports banned
    JP:  m === 'Moonglow' || m === 'Sable' || m.includes('Soft Scale') ? 1.5 : 1.1,
    SE:  m === 'Axanthic' ? 1.3 : 1.0,
    SEA: 0.7,
  };
  return (byRegion[region] ?? 1.0) * noise;
}

function ageMultiplier(ageCode) {
  return AGE_CLASSES.find((a) => a.code === ageCode)?.price_multiplier ?? 1;
}
function lineageMultiplier(tierCode) {
  return LINEAGE_TIERS.find((t) => t.code === tierCode)?.price_multiplier ?? 1;
}

const TX_POOL_SIZE = 600;

export function getTransactions() {
  const breeders = getBreeders();
  const rng = seeded('transactions:v2');
  const out = [];
  const now = Date.now();
  const dayMs = 86_400_000;
  for (let i = 0; i < TX_POOL_SIZE; i++) {
    const combo = HIGH_VALUE_COMBOS[Math.floor(rng() * HIGH_VALUE_COMBOS.length)];
    const primaryMorph = combo.traits[0];
    const region = REGIONS[Math.floor(rng() * REGIONS.length)].code;
    const age = AGE_CLASSES[Math.floor(rng() * AGE_CLASSES.length)].code;
    const lineage = LINEAGE_TIERS[Math.floor(rng() * LINEAGE_TIERS.length)].code;
    const breeder = breeders[Math.floor(rng() * breeders.length)];
    const daysAgo = Math.floor(rng() * 540);             // up to ~18 months
    const status = rng() < 0.55 ? 'sold' : 'listed';
    const basePrice = morphBasePrice(primaryMorph)
      * regionMultiplier(region, primaryMorph)
      * ageMultiplier(age)
      * lineageMultiplier(lineage);
    // Combo premium — buyers pay a synergy premium for true combos.
    const comboPremium = 1 + (combo.traits.length - 1) * (0.15 + rng() * 0.2);
    const askPrice = basePrice * comboPremium * (0.9 + rng() * 0.25);
    const soldSpread = 0.82 + rng() * 0.14;              // 82-96% of ask
    const soldPrice = askPrice * soldSpread;
    // Which source this came from (internal dominates — we see our own
    // users' data cleanly; external is noisier).
    const sourceRoll = rng();
    const source_id =
      sourceRoll < 0.35 ? 'internal.sales' :
      sourceRoll < 0.55 ? 'internal.listings' :
      sourceRoll < 0.78 ? 'external.morphmarket' :
      sourceRoll < 0.88 ? 'external.breeder_sites' :
      sourceRoll < 0.94 ? 'external.pangea' :
      sourceRoll < 0.98 ? 'external.eu_classifieds' :
      'external.fb';
    const time_on_market = status === 'sold'
      ? Math.round(3 + rng() * 60)
      : Math.round(1 + rng() * 90);
    out.push({
      id: `tx_${i.toString().padStart(4, '0')}`,
      combo_id: combo.id,
      combo_name: combo.name,
      traits: combo.traits,
      primary_morph: primaryMorph,
      region,
      age_class: age,
      lineage_tier: lineage,
      breeder_id: breeder.id,
      breeder_name: breeder.name,
      status,
      ask_price: Math.round(askPrice),
      sold_price: status === 'sold' ? Math.round(soldPrice) : null,
      time_on_market_days: time_on_market,
      date: new Date(now - daysAgo * dayMs).toISOString().slice(0, 10),
      source_id,
      __mock: true,
    });
  }
  return out;
}

// ---------- Supply pipeline (internal breeding records) ---------------
// Synthetic "our users' breeding pairs" → projected hatchlings per month
// by trait combo. This is the signal external markets don't have.
export function getSupplyPipeline() {
  const rng = seeded('supply:v2');
  const now = new Date();
  const months = [];
  for (let m = 0; m < 9; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en', { month: 'short', year: '2-digit' }) });
  }
  const pipeline = HIGH_VALUE_COMBOS.map((combo) => {
    const baseHatchlings = 4 + Math.floor(rng() * 16);
    const series = months.map((mo, idx) => {
      const seasonal = [0.4, 0.6, 1.2, 1.6, 1.8, 1.4, 1.0, 0.7, 0.4][idx];  // spring/summer breeding season
      const projected = Math.round(baseHatchlings * seasonal * (0.7 + rng() * 0.6));
      return { month: mo.key, label: mo.label, projected_hatchlings: projected };
    });
    return {
      combo_id: combo.id,
      combo_name: combo.name,
      traits: combo.traits,
      active_pairs: 1 + Math.floor(rng() * 12),
      source_id: 'internal.breeding',
      series,
      __mock: true,
    };
  });
  return pipeline;
}

// ---------- Demand signals (internal behavior) ------------------------
// Search/watchlist volume per morph. A leading indicator: when demand
// rises 3+ weeks ahead of price, the trait is likely to appreciate.
export function getDemandSignals() {
  const out = {};
  CANONICAL_MORPHS.forEach((m) => {
    const rng = seeded(`demand:${m.name}`);
    const base = 30 + Math.floor(rng() * 200);
    const weeks = [];
    let cur = base;
    for (let w = 25; w >= 0; w--) {
      const drift = (rng() - 0.45) * 12;
      cur = Math.max(5, cur + drift);
      weeks.push({
        week: w,
        searches: Math.round(cur),
        watchlist_adds: Math.round(cur * (0.05 + rng() * 0.15)),
      });
    }
    out[m.name] = {
      morph: m.name,
      weekly: weeks.reverse(),
      source_id: 'internal.behavior',
      __mock: true,
    };
  });
  return out;
}

// ---------- Expo / release calendar ----------------------------------
// External: calendar events that historically move the market.
export function getMarketEvents() {
  const now = new Date();
  const events = [
    { id: 'e1', name: 'Tinley Park Herpetoculture',  region: 'US', days_from_now: -8,  impact: 'high',   kind: 'expo',     source_id: 'external.expos' },
    { id: 'e2', name: 'Houston Reptile Expo',         region: 'US', days_from_now: 14,  impact: 'medium', kind: 'expo',     source_id: 'external.expos' },
    { id: 'e3', name: 'Hamm Terraristika',            region: 'EU', days_from_now: 42,  impact: 'high',   kind: 'expo',     source_id: 'external.expos' },
    { id: 'e4', name: 'Ridgeback Q2 release drop',    region: 'US', days_from_now: 21,  impact: 'medium', kind: 'release',  source_id: 'external.breeder_sites' },
    { id: 'e5', name: 'Kodama Reptiles summer drop',  region: 'JP', days_from_now: 60,  impact: 'high',   kind: 'release',  source_id: 'external.breeder_sites' },
    { id: 'e6', name: 'Nordic Morph Works release',   region: 'SE', days_from_now: 80,  impact: 'medium', kind: 'release',  source_id: 'external.breeder_sites' },
    { id: 'e7', name: 'Doncaster IHS show',           region: 'UK', days_from_now: 95,  impact: 'medium', kind: 'expo',     source_id: 'external.expos' },
  ];
  return events.map((e) => ({
    ...e,
    date: new Date(now.getTime() + e.days_from_now * 86400000).toISOString().slice(0, 10),
    __mock: true,
  }));
}
