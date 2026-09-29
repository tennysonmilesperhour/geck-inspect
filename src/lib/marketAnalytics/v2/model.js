/**
 * Market Analytics v2: view model.
 *
 * Pure functions that turn the aggregates object (shape documented in
 * demoAggregates.js, produced by public.market_analytics_v2) into what
 * each card draws. No fetching, no React, so the demo and the live tab
 * share every calculation and the numbers can be unit-tested.
 *
 * Nothing here assumes particular dates. The week axis, the outage gaps,
 * the index anchor and the two comparison periods all come from the data,
 * so the tab keeps working when the collector resumes.
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

// A weekly median from fewer listings than this is left off trend lines.
const MIN_WEEKLY_N = 5;
// Both periods need at least this many listings for a trait to be a mover.
export const MIN_MOVER_N = 15;

// Asks are an upper bound on what buyers pay, so confidence built on
// asking prices is capped at Medium: a big sample reads Medium, a thin
// one reads Low or Very low, and nothing reads High until real sold
// prices flow.
const ASK_BASIS_SCALE = 0.85;

const DAY_MS = 86_400_000;
const clamp = (v) => Math.max(-1, Math.min(1, v));
const toUtc = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
const isoDay = (d) => d.toISOString().slice(0, 10);

/** "May 11" for a YYYY-MM-DD date. */
export function dayLabel(iso) {
  return toUtc(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export const weekLabel = dayLabel;

export function traitConfidence(sampleSize) {
  const base = scoreConfidence({ sourceId: 'external.morphmarket', sampleSize });
  return +(base * ASK_BASIS_SCALE).toFixed(3);
}

// ---------- Week axis ---------------------------------------------------
// Every Monday from `start` to the last collected week. Weeks with no
// listings stay in the axis so charts draw the outage to scale.
function mondaysFrom(start, end) {
  const out = [];
  for (let t = toUtc(start).getTime(); t <= toUtc(end).getTime(); t += 7 * DAY_MS) {
    out.push(isoDay(new Date(t)));
  }
  return out;
}

/**
 * Week axis for charts. `full` starts at the first collected week (which
 * can be a partial week, since tracking started mid-week); `axis` starts
 * at the first full week, which is also the index anchor.
 */
export function weekAxis(agg) {
  const weeks = agg.coverage.weeks.map((w) => w.week).sort();
  if (weeks.length === 0) return { full: [], axis: [], gaps: [] };
  const last = weeks[weeks.length - 1];
  const full = mondaysFrom(weeks[0], last);
  const firstSeen = toUtc(agg.coverage.first_seen).getTime();
  const firstFull = full.find((w) => toUtc(w).getTime() >= firstSeen) || full[0];
  const axis = full.slice(full.indexOf(firstFull));
  const has = new Set(agg.coverage.weeks.filter((w) => w.listings > 0).map((w) => w.week));
  const gaps = [];
  let run = null;
  for (const w of axis) {
    if (!has.has(w)) {
      if (run) run.to = w;
      else run = { from: w, to: w };
    } else if (run) {
      gaps.push(run);
      run = null;
    }
  }
  if (run) gaps.push(run);
  return { full, axis, gaps };
}

// ---------- Periods -----------------------------------------------------
// Labels describe the weeks that actually hold listings, so "May 9 to
// Jun 14" rather than "May 9 to Jul 31" when July was never collected.
export function periodLabels(agg) {
  const recentFrom = toUtc(agg.periods.recent.from).getTime();
  const withData = agg.coverage.weeks.filter((w) => w.listings > 0).map((w) => w.week).sort();
  const earlierWeeks = withData.filter((w) => toUtc(w).getTime() < recentFrom);
  const recentWeeks = withData.filter((w) => toUtc(w).getTime() + 6 * DAY_MS >= recentFrom);
  const earlierEnd = earlierWeeks.length
    ? isoDay(new Date(Math.min(toUtc(earlierWeeks[earlierWeeks.length - 1]).getTime() + 6 * DAY_MS, recentFrom - DAY_MS)))
    : agg.periods.earlier.to;
  const recentStart = recentWeeks.length
    ? isoDay(new Date(Math.max(toUtc(recentWeeks[0]).getTime(), recentFrom)))
    : agg.periods.recent.from;
  return {
    earlier: `${dayLabel(agg.coverage.first_seen)} to ${dayLabel(earlierEnd)}`,
    recent: `${dayLabel(recentStart)} to ${dayLabel(agg.coverage.last_seen)}`,
    earlierShort: monthSpan(agg.coverage.first_seen, earlierEnd),
    recentShort: monthSpan(recentStart, agg.coverage.last_seen),
  };
}

// "Aug" when both dates fall in one month, else "May to Jun".
function monthSpan(fromIso, toIso) {
  const m = (iso) => toUtc(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return m(fromIso) === m(toIso) ? m(toIso) : `${m(fromIso)} to ${m(toIso)}`;
}

/** Whole weeks in the sales window, or null when no sales were observed. */
export function soldWindowWeeks(agg) {
  const w = agg.coverage.sold_window;
  if (!w) return null;
  return Math.max(1, Math.round((toUtc(w.to) - toUtc(w.from)) / (7 * DAY_MS)));
}

// ---------- Asking Price Index ----------------------------------------
// Weekly median ask of newly seen listings, 1,000 = the first full week.
export function askingPriceIndex(agg) {
  const { axis, gaps } = weekAxis(agg);
  const byWeek = Object.fromEntries(agg.coverage.weeks.map((w) => [w.week, w]));
  const anchorWeek = axis.find((w) => byWeek[w]?.listings > 0) || axis[0];
  const anchor = byWeek[anchorWeek]?.median_ask || 1;
  const series = axis.map((key) => {
    const w = byWeek[key];
    const has = w && w.listings > 0;
    return {
      week: key,
      label: dayLabel(key),
      index: has ? Math.round((w.median_ask / anchor) * 1000) : null,
      median_ask: has ? w.median_ask : null,
      listings: w?.listings ?? 0,
    };
  });
  const filled = series.filter((s) => s.index != null);
  const latest = filled[filled.length - 1];
  const sampleSize = filled.reduce((s, w) => s + w.listings, 0);
  return {
    value: latest?.index ?? 1000,
    change_pct: latest ? ((latest.index - 1000) / 1000) * 100 : 0,
    anchor_week: anchorWeek,
    anchor_median: anchor,
    latest_week: latest?.week ?? null,
    series,
    gaps: gaps.map((g) => ({ from: dayLabel(g.from), to: dayLabel(g.to) })),
    sample_size: sampleSize,
    confidence: traitConfidence(sampleSize),
  };
}

// ---------- Trait rows -------------------------------------------------
export function traitRows(agg) {
  const { axis } = weekAxis(agg);
  return agg.traits.map((t) => {
    const [earlierN, earlierMed] = t.earlier;
    const [recentN, recentMed] = t.recent;
    const change = earlierMed ? ((recentMed - earlierMed) / earlierMed) * 100 : 0;
    return {
      ...t,
      change_pct: change,
      mover_eligible: earlierN >= MIN_MOVER_N && recentN >= MIN_MOVER_N && earlierMed > 0 && recentMed > 0,
      // A change is only as solid as its thinner side, usually the recent one.
      change_confidence: traitConfidence(2 * Math.min(earlierN, recentN)),
      sparkline: axis.map((key) => {
        const cell = t.weekly?.[key];
        return cell && cell[0] >= MIN_WEEKLY_N ? cell[1] : null;
      }),
      confidence: traitConfidence(t.n),
    };
  });
}

// ---------- Top movers -------------------------------------------------
// Median ask of newly seen listings, earlier period vs the recent one.
// Different animals in each period, so a shift in age mix moves these
// numbers too; the methodology popover says so.
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
//   price momentum   earlier to recent ask change, +30% = +1
//   demand           sell-through vs the market's, +10 points = +1
//   supply pressure  change in the trait's share of new listings
//   sale speed       days to sell vs the market's, 3 days faster = +1
export function marketTemperature(agg) {
  const earlierTotal = agg.traits.reduce((s, t) => s + t.earlier[0], 0) || 1;
  const recentTotal = agg.traits.reduce((s, t) => s + t.recent[0], 0) || 1;
  const marketSellThrough = agg.kpis.sell_through;
  const marketDays = agg.kpis.avg_days_to_sell;
  return traitRows(agg)
    .filter((r) => r.mover_eligible)
    .map((r) => {
      const earlierShare = r.earlier[0] / earlierTotal;
      const recentShare = r.recent[0] / recentTotal;
      const components = {
        priceMomentum: clamp(r.change_pct / 30),
        volumeMomentum: marketSellThrough != null && r.sell_through != null
          ? clamp((r.sell_through - marketSellThrough) / 0.10) : 0,
        supplyPressure: clamp(earlierShare ? recentShare / earlierShare - 1 : 0),
        adoptionBreadth: marketDays != null && r.days != null ? clamp((marketDays - r.days) / 3) : 0,
      };
      const score = peakScore(components);
      return {
        name: r.name,
        score,
        label: peakLabel(score),
        components,
        share_change_pct: earlierShare ? (recentShare / earlierShare - 1) * 100 : 0,
        sample_size: r.earlier[0] + r.recent[0],
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
  // The color scale tops out at the 90th percentile so one outlier cell
  // does not wash every other cell to green.
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
// Each trait's share of newly seen listings, earlier vs recent.
export function supplyShift(agg) {
  const earlierTotal = agg.traits.reduce((s, t) => s + t.earlier[0], 0) || 1;
  const recentTotal = agg.traits.reduce((s, t) => s + t.recent[0], 0) || 1;
  return agg.traits
    .map((t) => ({
      name: t.name,
      earlier_share: (t.earlier[0] / earlierTotal) * 100,
      recent_share: (t.recent[0] / recentTotal) * 100,
      recent_n: t.recent[0],
    }))
    .map((r) => ({ ...r, delta: r.recent_share - r.earlier_share }))
    .sort((a, b) => b.recent_share - a.recent_share);
}

// ---------- Pipeline valuation -----------------------------------------
// Values each clutch with the baby-age band of its most valuable trait,
// since the best trait usually sets the ask. Falls back to the trait's
// overall band scaled to baby prices when there is no age split.
export function valuePipeline(agg, clutches) {
  const byName = new Map(agg.traits.map((t) => [t.name.toLowerCase(), t]));
  return clutches.map((c) => {
    const bands = c.traits
      .map((name) => byName.get(String(name).toLowerCase()))
      .filter(Boolean)
      .map((t) => {
        const babyMedian = t.by_age?.baby?.[1];
        const scale = babyMedian && t.median ? babyMedian / t.median : 0.7;
        return { name: t.name, low: Math.round(t.p25 * scale), mid: Math.round(babyMedian ?? t.median * 0.7), high: Math.round(t.p75 * scale) };
      });
    const best = bands.sort((a, b) => b.mid - a.mid)[0] || null;
    const each = best || { name: null, low: 0, mid: 0, high: 0 };
    return {
      ...c,
      priced: !!best,
      each,
      total: { low: each.low * c.eggs, mid: each.mid * c.eggs, high: each.high * c.eggs },
    };
  });
}
