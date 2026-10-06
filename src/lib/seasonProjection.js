/**
 * Season projection for a pairing: what a season of eggs is worth, how
 * fast it sells, and how old to let the hatchlings get before listing.
 *
 * Built on the same pieces as the pairing value (src/lib/pairingValue.js):
 * the genetics engine's odds per egg and the MorphMarket asking-price
 * table (src/lib/traitValuation.js). The new part is the spread. A season
 * is a handful of eggs, so the total is lumpy: one Lilly White more or
 * less moves it a lot. simulateSeason() plays the season out many times
 * (each egg hatches or not, then draws an outcome from the odds) and
 * keeps every total, so the page can say "a 1 in 10 chance of at least
 * $X" instead of only an average.
 *
 * Pure functions with a seeded random generator, so the same pairing
 * always shows the same numbers and tests can pin them.
 */
import { outcomeCombos, outcomeTraits } from '@/lib/genetics';
import { outcomeLabel } from '@/lib/pairingValue';
import { valueFromTraitTable } from '@/lib/traitValuation';
import { estimateSellTime } from '@/lib/sellTime';

// A crested gecko female lays two eggs about every 30 to 45 days from
// spring into late summer: eight or so clutches, sixteen eggs. Most
// keepers hatch a bit under 80% of them. Both are editable on the page.
export const DEFAULT_SEASON_EGGS = 16;
export const DEFAULT_HATCH_RATE = 0.75;
// Monthly cost to keep one young gecko (food, supplements, a share of
// the enclosure), the same default as the Grow-out radar in Market
// analytics. Editable on the page.
export const DEFAULT_MONTHLY_UPKEEP = 8;

// When each age class is usually listed, in months from hatching, and a
// weight inside that class so the price table picks the right band
// (ageClassFor cuts at 12g, 22g and 37g). Matches the Grow-out radar
// (baby to adult 14 months, juvenile 10, subadult 5).
export const LISTING_AGES = [
  { key: 'hatchling', label: 'Hatchling', months: 4, grams: 6 },
  { key: 'juvenile', label: 'Juvenile', months: 8, grams: 16 },
  { key: 'subadult', label: 'Subadult', months: 13, grams: 30 },
  { key: 'adult', label: 'Adult', months: 18, grams: 45 },
];

const SIMULATIONS = 4000;

/** Small, fast seeded generator (mulberry32). */
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed from a string, so a pairing always simulates the same way. */
export function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < String(text).length; i += 1) {
    h ^= String(text).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Price for a gecko with no priced trait at this age: the low end of the
 * cheapest trait with at least `minListings` listings at that age (the
 * age-by-age version of basicHatchlingValue).
 */
export function basicValueAt(index, ageKey, minListings = 20) {
  let low = null;
  for (const trait of index?.traits?.values() || []) {
    const band = trait.bands.get(`${ageKey}|unsexed`) || trait.bands.get(`${ageKey}|any`);
    if (band && band.n >= minListings && (low == null || band.p25 < low)) low = band.p25;
  }
  return low;
}

function outcomeText(ph) {
  return [outcomeTraits(ph), ...outcomeCombos(ph)].join(', ');
}

/**
 * The pairing's outcomes with a price at every listing age, most likely
 * first. Lethal outcomes (Super Lilly White) never hatch and are kept
 * only so their share is visible.
 */
export function priceOutcomes(phenotypes, index) {
  const floors = Object.fromEntries(LISTING_AGES.map((a) => [a.key, index ? basicValueAt(index, a.key) || 0 : 0]));
  const out = [];
  for (const ph of phenotypes || []) {
    const probability = Number(ph.probability) || 0;
    if (probability <= 0) continue;
    const lethal = ph.health_risk === 'lethal';
    const text = outcomeText(ph);
    const prices = {};
    let pricedBy = null;
    for (const age of LISTING_AGES) {
      if (lethal) { prices[age.key] = 0; continue; }
      const priced = index
        ? valueFromTraitTable({ morphs_traits: text, weight_grams: age.grams }, index, 'breeder')
        : null;
      prices[age.key] = priced ? priced.value : floors[age.key];
      if (priced && !pricedBy) pricedBy = priced.trait;
    }
    out.push({ label: outcomeLabel(ph), text, probability, lethal, prices, pricedBy });
  }
  return out.sort((a, b) => b.probability - a.probability);
}

/**
 * Play the season out `runs` times. Each egg hatches with `hatchRate`;
 * a hatched egg draws an outcome from the odds (a lethal draw is a
 * hatchling that never makes it, so it adds nothing). Every hatchling is
 * sold at `ageKey` for its outcome's median price, less upkeep for the
 * months it was kept.
 *
 * Returns { totals (sorted, ascending), hatchlings (per run, same order
 * as totals), mean, ageKey, eggs, hatchRate }.
 */
export function simulateSeason(outcomes, {
  eggs = DEFAULT_SEASON_EGGS,
  hatchRate = DEFAULT_HATCH_RATE,
  ageKey = 'hatchling',
  monthlyUpkeep = DEFAULT_MONTHLY_UPKEEP,
  runs = SIMULATIONS,
  seed = 1,
} = {}) {
  const age = LISTING_AGES.find((a) => a.key === ageKey) || LISTING_AGES[0];
  const upkeep = monthlyUpkeep * age.months;
  const total = outcomes.reduce((s, o) => s + o.probability, 0) || 1;
  const cumulative = [];
  let acc = 0;
  for (const o of outcomes) {
    acc += o.probability / total;
    cumulative.push(acc);
  }
  const rand = seededRandom(seed);
  const runsOut = [];
  let sum = 0;
  for (let r = 0; r < runs; r += 1) {
    let value = 0;
    let alive = 0;
    for (let e = 0; e < eggs; e += 1) {
      if (rand() >= hatchRate) continue;
      const u = rand();
      let i = 0;
      while (i < cumulative.length - 1 && u > cumulative[i]) i += 1;
      const o = outcomes[i];
      if (!o || o.lethal) continue;
      alive += 1;
      value += o.prices[age.key] - upkeep;
    }
    runsOut.push({ value, alive });
    sum += value;
  }
  runsOut.sort((a, b) => a.value - b.value);
  return {
    totals: runsOut.map((x) => x.value),
    hatchlings: runsOut.map((x) => x.alive),
    mean: runs ? sum / runs : 0,
    ageKey: age.key,
    eggs,
    hatchRate,
  };
}

/** Value at a percentile (0 to 100) of the simulated seasons. */
export function percentileValue(sim, pct) {
  const n = sim.totals.length;
  if (n === 0) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.round((pct / 100) * (n - 1))));
  return sim.totals[i];
}

/** Share of simulated seasons worth at least `value`. */
export function chanceAtLeast(sim, value) {
  const n = sim.totals.length;
  if (n === 0) return 0;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sim.totals[mid] < value) lo = mid + 1; else hi = mid;
  }
  return (n - lo) / n;
}

/**
 * One outcome over a season: how many to expect and the chance of at
 * least one. `eggs` and `hatchRate` as in simulateSeason.
 */
export function outcomeSeasonOdds(outcome, { eggs = DEFAULT_SEASON_EGGS, hatchRate = DEFAULT_HATCH_RATE } = {}) {
  const perEgg = outcome.probability * hatchRate;
  return {
    expected: perEgg * eggs,
    atLeastOne: 1 - (1 - perEgg) ** eggs,
  };
}

/**
 * How fast a season's hatchlings sell once listed at `ageKey`, from the
 * time to sell model (Enterprise). Each outcome sells at its own rate;
 * the season is the mix, weighted by odds. Subadults and adults are
 * sexed by then, so they average the male and female rates.
 *
 * Returns { halfDays, mostDays (80% sold), within30 } or null.
 */
export function seasonSellTime(outcomes, sellModel, index, ageKey = 'hatchling') {
  if (!sellModel?.allowed) return null;
  const age = LISTING_AGES.find((a) => a.key === ageKey) || LISTING_AGES[0];
  const sexed = age.key === 'subadult' || age.key === 'adult';
  const parts = [];
  for (const o of outcomes) {
    if (o.lethal || o.probability <= 0) continue;
    const base = { morphs_traits: o.text, weight_grams: age.grams };
    const rates = (sexed ? ['Male', 'Female'] : ['']).map((sex) => {
      const est = estimateSellTime({ ...base, sex }, sellModel, index);
      return est ? est.rate : null;
    }).filter((r) => r > 0);
    if (rates.length === 0) continue;
    parts.push({ w: o.probability, rate: rates.reduce((s, r) => s + r, 0) / rates.length });
  }
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  if (!totalW) return null;
  const soldBy = (d) => parts.reduce((s, p) => s + (p.w / totalW) * (1 - Math.exp(-p.rate * d)), 0);
  const daysFor = (share) => {
    let lo = 0;
    let hi = 3650;
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      if (soldBy(mid) < share) lo = mid; else hi = mid;
    }
    return hi;
  };
  return { halfDays: daysFor(0.5), mostDays: daysFor(0.8), within30: soldBy(30) };
}

/**
 * Which age to list at. For each age: the expected sale price per
 * hatchling (odds-weighted), less upkeep while growing it out. With the
 * time to sell model, the typical wait for a buyer adds upkeep too.
 * The best age earns the most per hatchling; a later age has to beat an
 * earlier one by `minGain` (5%) to win, since holding longer ties up
 * space and risks losses the numbers do not see.
 *
 * Returns { ages: [...], best } with each age's price, upkeep, net and
 * sell time (when known).
 */
export function listingAgeAdvice(outcomes, {
  monthlyUpkeep = DEFAULT_MONTHLY_UPKEEP,
  sellModel = null,
  index = null,
  minGain = 0.05,
} = {}) {
  const live = outcomes.filter((o) => !o.lethal && o.probability > 0);
  const w = live.reduce((s, o) => s + o.probability, 0);
  if (!w) return null;
  const ages = LISTING_AGES.map((age) => {
    const price = live.reduce((s, o) => s + (o.probability / w) * o.prices[age.key], 0);
    const sell = sellModel ? seasonSellTime(outcomes, sellModel, index, age.key) : null;
    const waitMonths = sell ? sell.halfDays / 30.44 : 0;
    const upkeep = monthlyUpkeep * (age.months + waitMonths);
    return { ...age, price, upkeep, net: price - upkeep, sell };
  });
  let best = ages[0];
  for (const a of ages.slice(1)) {
    if (a.net - best.net > Math.max(1, minGain * Math.abs(best.net))) best = a;
  }
  return { ages, best };
}
