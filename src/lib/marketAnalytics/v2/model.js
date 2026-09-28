/**
 * Market Analytics v2: view model.
 *
 * Pure functions that turn the aggregates object (see demoAggregates.js
 * for the shape) into what each card draws. No fetching, no React, so
 * the demo and the live tab share every calculation and the numbers can
 * be unit-tested.
 *
 * The unit of analysis is the single trait (Lilly White, Harlequin,
 * Cappuccino), not the multi-trait combo: only 28 exact combos have 5
 * or more sales, while the top traits have hundreds of listings each.
 */

import { scoreConfidence, peakScore, peakLabel } from '../confidence.js';

export const AGE_COLUMNS = [
  { code: 'baby', label: 'Baby' },
  { code: 'juvenile', label: 'Juvenile' },
  { code: 'subadult', label: 'Subadult' },
  { code: 'adult', label: 'Adult' },
];

// Mondays from the first full tracked week to the last. Weeks with no
// collection stay in the axis as nulls so charts show the outage to scale.
export const WEEK_AXIS = [
  '05-11', '05-18', '05-25', '06-01', '06-08', '06-15', '06-22', '06-29',
  '07-06', '07-13', '07-20', '07-27', '08-03', '08-10', '08-17', '08-24',
];

// A weekly median from fewer listings than this is left off sparklines.
const MIN_WEEKLY_N = 5;
// Both periods need at least this many listings for a trait to be a mover.
export const MIN_MOVER_N = 15;

// Asks are an upper bound on what buyers pay, so confidence built on
// asking prices is capped at Medium: a big sample reads Medium, a thin
// one reads Low or Very low, and nothing reads High until real sold
// prices flow.
const ASK_BASIS_SCALE = 0.85;

const clamp = (v) => Math.max(-1, Math.min(1, v));

export function weekLabel(key) {
  const [m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(2026, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function traitConfidence(sampleSize) {
  const base = scoreConfidence({ sourceId: 'external.morphmarket', sampleSize });
  return +(base * ASK_BASIS_SCALE).toFixed(3);
}

// ---------- Asking Price Index ----------------------------------------
// Weekly median ask of newly seen listings, 1,000 = the first full week.
export function askingPriceIndex(agg) {
  const byWeek = Object.fromEntries(agg.coverage.weeks.map((w) => [w.week, w]));
  const anchor = byWeek[WEEK_AXIS[0]]?.median_ask || 1;
  const series = WEEK_AXIS.map((key) => {
    const w = byWeek[key];
    return {
      week: key,
      label: weekLabel(key),
      index: w ? Math.round((w.median_ask / anchor) * 1000) : null,
      median_ask: w?.median_ask ?? null,
      listings: w?.listings ?? 0,
    };
  });
  const filled = series.filter((s) => s.index != null);
  const latest = filled[filled.length - 1];
  const sampleSize = filled.reduce((s, w) => s + w.listings, 0);
  return {
    value: latest?.index ?? 1000,
    change_pct: latest ? ((latest.index - 1000) / 1000) * 100 : 0,
    latest_week: latest?.week ?? null,
    series,
    sample_size: sampleSize,
    confidence: traitConfidence(sampleSize),
  };
}

// ---------- Trait rows -------------------------------------------------
export function traitRows(agg) {
  return agg.traits.map((t) => {
    const [springN, springMed] = t.spring;
    const [lateN, lateMed] = t.late;
    const change = springMed ? ((lateMed - springMed) / springMed) * 100 : 0;
    return {
      ...t,
      change_pct: change,
      mover_eligible: springN >= MIN_MOVER_N && lateN >= MIN_MOVER_N,
      // A change is only as solid as its thinner side, usually August.
      change_confidence: traitConfidence(2 * Math.min(springN, lateN)),
      sparkline: WEEK_AXIS.map((key) => {
        const cell = t.weekly?.[key];
        return cell && cell[0] >= MIN_WEEKLY_N ? cell[1] : null;
      }),
      confidence: traitConfidence(t.n),
    };
  });
}

// ---------- Top movers -------------------------------------------------
// Spring (May 9 to Jun 30) vs late summer (Aug 17 to 29) median ask of
// newly seen listings. Different animals in each period, so a shift in
// age mix moves these numbers too; the methodology popover says so.
export function topMovers(agg, limit = 5) {
  const rows = traitRows(agg).filter((r) => r.mover_eligible);
  return {
    up: [...rows].filter((r) => r.change_pct > 0).sort((a, b) => b.change_pct - a.change_pct).slice(0, limit),
    down: [...rows].filter((r) => r.change_pct < 0).sort((a, b) => a.change_pct - b.change_pct).slice(0, limit),
  };
}

// ---------- Market temperature ----------------------------------------
// Reuses the v1 peak score (0 to 100, high = sell into strength) with
// inputs the data actually has:
//   price momentum   spring to late-summer ask change, +30% = +1
//   demand           sell-through vs the market's, +10 points = +1
//   supply pressure  change in the trait's share of new listings
//   sale speed       days to sell vs the market's, 3 days faster = +1
export function marketTemperature(agg) {
  const springTotal = agg.traits.reduce((s, t) => s + t.spring[0], 0) || 1;
  const lateTotal = agg.traits.reduce((s, t) => s + t.late[0], 0) || 1;
  const marketSellThrough = agg.kpis.sell_through;
  const marketDays = agg.kpis.avg_days_to_sell;
  return traitRows(agg)
    .filter((r) => r.mover_eligible)
    .map((r) => {
      const springShare = r.spring[0] / springTotal;
      const lateShare = r.late[0] / lateTotal;
      const components = {
        priceMomentum: clamp(r.change_pct / 30),
        volumeMomentum: clamp((r.sell_through - marketSellThrough) / 0.10),
        supplyPressure: clamp(springShare ? lateShare / springShare - 1 : 0),
        adoptionBreadth: clamp((marketDays - r.days) / 3),
      };
      const score = peakScore(components);
      return {
        name: r.name,
        score,
        label: peakLabel(score),
        components,
        share_change_pct: springShare ? (lateShare / springShare - 1) * 100 : 0,
        sample_size: r.spring[0] + r.late[0],
        confidence: r.change_confidence,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------- Trait x age heatmap ----------------------------------------
export function ageHeatmap(agg, metric = 'median') {
  const rows = agg.traits.filter((t) => t.by_age);
  const cells = rows.map((t) => ({
    name: t.name,
    cells: AGE_COLUMNS.map((a) => {
      const [n, median] = t.by_age[a.code] || [0, 0];
      return {
        age: a.code,
        n,
        value: metric === 'volume' ? n : median,
        confidence: traitConfidence(n),
      };
    }),
  }));
  // The color scale tops out at the 90th percentile so one outlier (an
  // Axanthic adult at $1,500) does not wash every other cell to green.
  const values = cells.flatMap((r) => r.cells.map((c) => c.value)).filter((v) => v > 0).sort((a, b) => a - b);
  const p90 = values.length ? values[Math.floor((values.length - 1) * 0.9)] : 1;
  return {
    rows: cells,
    min: values.length ? values[0] : 0,
    max: p90,
    top: values.length ? values[values.length - 1] : 1,
  };
}

// ---------- Grow-out radar ---------------------------------------------
// Is it worth holding a hatchling until it is an adult? Buy side is the
// starting age's median ask, sell side the adult median, minus upkeep.
export const GROW_OUT_MONTHS = { baby: 14, juvenile: 10, subadult: 5 };

export function growOut(agg, { from = 'baby', monthlyCost = 8 } = {}) {
  const months = GROW_OUT_MONTHS[from] ?? 12;
  return agg.traits
    .filter((t) => t.by_age?.[from] && t.by_age?.adult)
    .map((t) => {
      const [nFrom, buy] = t.by_age[from];
      const [nAdult, sell] = t.by_age.adult;
      const upkeep = monthlyCost * months;
      const net = sell - buy - upkeep;
      const sample = Math.min(nFrom, nAdult);
      return {
        name: t.name,
        buy,
        sell,
        upkeep,
        months,
        net,
        gross_pct: buy ? ((sell - buy) / buy) * 100 : 0,
        net_pct: buy ? (net / buy) * 100 : 0,
        per_month: net / months,
        n_from: nFrom,
        n_adult: nAdult,
        confidence: traitConfidence(sample * 2),
      };
    })
    .sort((a, b) => b.net_pct - a.net_pct);
}

// ---------- Supply shift -----------------------------------------------
// Each trait's share of newly seen listings, spring vs late summer.
export function supplyShift(agg) {
  const springTotal = agg.traits.reduce((s, t) => s + t.spring[0], 0) || 1;
  const lateTotal = agg.traits.reduce((s, t) => s + t.late[0], 0) || 1;
  return agg.traits
    .map((t) => ({
      name: t.name,
      spring_share: (t.spring[0] / springTotal) * 100,
      late_share: (t.late[0] / lateTotal) * 100,
      late_n: t.late[0],
    }))
    .map((r) => ({ ...r, delta: r.late_share - r.spring_share }))
    .sort((a, b) => b.late_share - a.late_share);
}

// ---------- Pipeline valuation -----------------------------------------
// Values each clutch with the baby-age median of its traits (the highest
// one, since the best trait usually sets the ask). Falls back to the
// trait's overall median when there is no age split.
export function valuePipeline(agg, clutches) {
  const byName = Object.fromEntries(agg.traits.map((t) => [t.name, t]));
  return clutches.map((c) => {
    const bands = c.traits
      .map((name) => byName[name])
      .filter(Boolean)
      .map((t) => {
        const babyMedian = t.by_age?.baby?.[1];
        const scale = babyMedian && t.median ? babyMedian / t.median : 0.7;
        return { name: t.name, low: Math.round(t.p25 * scale), mid: Math.round(babyMedian ?? t.median * 0.7), high: Math.round(t.p75 * scale) };
      });
    const best = bands.sort((a, b) => b.mid - a.mid)[0] || { low: 0, mid: 0, high: 0 };
    return { ...c, each: best, total: { low: best.low * c.eggs, mid: best.mid * c.eggs, high: best.high * c.eggs } };
  });
}
