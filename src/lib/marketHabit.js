/**
 * The market habit loop: data calls and wording for the Market page, the
 * Today card's market lines, the watchlist and Guess the Price.
 *
 * Every number comes from the database (geck_data.market_daily, the
 * listings, public.market_value_daily). This module only fetches it and
 * turns it into plain sentences, so the wording can be tested without a
 * database. Prices are asking prices on listings, never sale prices, and
 * the copy says so wherever a price is shown.
 */
import { supabase } from '@/lib/supabaseClient';

// ---------- data calls ------------------------------------------------

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export const loadMarketToday = () => rpc('my_market_today');
export const loadMarketBrief = () => rpc('market_brief');
export const loadMarketTape = ({ before = null, beforeId = null, limit = 40, scope = 'all' } = {}) =>
  rpc('market_tape', { p_before: before, p_limit: limit, p_scope: scope, p_before_id: beforeId });
export const loadWatchlist = () => rpc('market_watch_list');
export const loadWatchMatches = (limit = 30) => rpc('market_watch_matches', { p_limit: limit });
export const removeWatch = (id) => rpc('market_watch_remove', { p_id: id });
export const setWatchActive = (id, active) => rpc('market_watch_set_active', { p_id: id, p_active: active });
export const loadPriceGame = () => rpc('price_game_today');
export const submitGuess = (slot, guess) => rpc('price_game_guess', { p_slot: slot, p_guess: guess });
export const submitPrediction = (slot, sells) => rpc('price_game_predict', { p_slot: slot, p_sells: sells });
export const loadSellerView = (slug = null) => rpc('seller_market_view', { p_slug: slug });
export const findStores = (query) => rpc('seller_market_find', { p_query: query });

export function saveWatch({ id = null, traits = [], maxPrice = null, minPrice = null, sex = null, cutsOnly = false, sellerSlug = null, name = null }) {
  return rpc('market_watch_save', {
    p_id: id,
    p_traits: traits,
    p_max_price: maxPrice,
    p_min_price: minPrice,
    p_sex: sex,
    p_cuts_only: cutsOnly,
    p_seller_slug: sellerSlug,
    p_name: name,
  });
}

// ---------- wording ---------------------------------------------------

export function formatUsd(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

/** Percent change from `before` to `now`, rounded to one decimal, or null. */
export function pctChange(now, before) {
  const a = Number(now);
  const b = Number(before);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

/** "Sep 29" for a YYYY-MM-DD date, read as a calendar day (no time zone shift). */
export function shortDay(day) {
  if (!day) return '';
  const [y, m, d] = String(day).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Whole days between a YYYY-MM-DD date and `now`. */
export function daysSince(day, now = new Date()) {
  if (!day) return null;
  const [y, m, d] = String(day).slice(0, 10).split('-').map(Number);
  if (!y) return null;
  const then = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - then) / 86_400_000);
}

export const POSITION_LABELS = {
  low: 'Low for its kind',
  typical: 'Typical price',
  high: 'High for its kind',
};

export function positionLabel(position) {
  return POSITION_LABELS[position] || '';
}

/** "Female adult", "Unsexed hatchling", or "". */
export function sexAgeLabel(sex, age) {
  const s = sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : sex === 'unsexed' ? 'Unsexed' : '';
  const a = age || '';
  if (s && a) return `${s} ${a}`;
  return s || (a ? a.charAt(0).toUpperCase() + a.slice(1) : '');
}

export function morphLabel(morphs, fallback = 'Crested gecko') {
  const list = Array.isArray(morphs) ? morphs.filter(Boolean) : [];
  return list.length ? list.join(' ') : fallback;
}

/**
 * The value line for the member's crested geckos, from a
 * market_value_daily summary ({ value, value_low, value_high, priced,
 * geckos, value_7d, value_30d, day }).
 */
export function describeValue(value) {
  if (!value || !(Number(value.priced) > 0)) return null;
  const range = `${formatUsd(value.value_low)} to ${formatUsd(value.value_high)}`;
  const change30 = pctChange(value.value, value.value_30d);
  const change7 = pctChange(value.value, value.value_7d);
  let change = 'Tracking started this week. Changes show here after 7 days.';
  if (change30 !== null) {
    change = change30 === 0 ? 'Steady over 30 days' : `${change30 > 0 ? 'Up' : 'Down'} ${Math.abs(change30)}% in 30 days`;
  } else if (change7 !== null) {
    change = change7 === 0 ? 'Steady this week' : `${change7 > 0 ? 'Up' : 'Down'} ${Math.abs(change7)}% this week`;
  }
  const unpriced = Number(value.geckos) - Number(value.priced);
  return {
    headline: `Your crested geckos: ${range}`,
    detail: change,
    note: unpriced > 0
      ? `${value.priced} of ${value.geckos} priced. Add morph traits to the rest to include them.`
      : `All ${value.priced} priced from similar listings.`,
  };
}

/** How fresh the MorphMarket data is, as a short clause, or null when fresh. */
export function staleNote(lastCheckDay, now = new Date()) {
  const age = daysSince(lastCheckDay, now);
  if (age === null) return 'US listings have not been checked yet.';
  if (age <= 1) return null;
  return `US listings last checked ${shortDay(lastCheckDay)}.`;
}

/** Lines for the Today card from my_market_today(). */
export function marketTodayLines(data, now = new Date()) {
  if (!data) return [];
  const lines = [];
  const value = describeValue(data.value);
  if (value) {
    lines.push({ id: 'value', kind: 'value', label: value.headline, detail: value.detail, href: '/Market' });
  }
  const watch = data.watch || {};
  if (Number(watch.matches_24h) > 0) {
    const n = Number(watch.matches_24h);
    lines.push({
      id: 'watch',
      kind: 'watch',
      label: `${n} new watchlist ${n === 1 ? 'match' : 'matches'}`,
      detail: 'Listings that fit your watches since yesterday',
      href: '/Market?tab=watchlist',
    });
  } else if (!Number(watch.alerts)) {
    lines.push({
      id: 'watch-setup',
      kind: 'watch',
      label: 'Watch a morph',
      detail: 'Get told when one is listed under your price',
      href: '/Market?tab=watchlist',
    });
  }
  const top = (data.morphs || []).find((m) => Number(m.new_7d) > 0);
  if (top) {
    lines.push({
      id: 'morph-news',
      kind: 'morph',
      label: `${top.new_7d} new ${top.trait} ${Number(top.new_7d) === 1 ? 'listing' : 'listings'} this week`,
      detail: top.p50 ? `Middle asking price ${formatUsd(top.p50)}` : 'See them on the Market page',
      href: '/Market?tab=live',
    });
  }
  const stale = staleNote(data.market?.last_check_day, now);
  if (stale && lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1], stale };
  return lines;
}

/** "Busy", "Normal", "Slow" with the comparison, or null. */
export function describeDayWord(us) {
  if (!us || !us.word || us.typical_new == null) return null;
  const word = { busy: 'A busy day', normal: 'A normal day', slow: 'A slow day' }[us.word];
  return word ? `${word}: ${us.new_listings} new against a typical ${us.typical_new}` : null;
}

/** The brief's "one thing worth knowing" as a sentence, or null. */
export function describeFact(fact) {
  if (!fact || !fact.kind) return null;
  if (fact.kind === 'cut_wave') {
    const pct = fact.median_cut_pct != null ? `, a typical cut of ${Math.round(Number(fact.median_cut_pct) * 100)}%` : '';
    return `Price cuts ran at more than twice the usual rate on ${shortDay(fact.day)}: ${Number(fact.cuts).toLocaleString('en-US')} cuts against a typical ${Number(fact.typical_cuts).toLocaleString('en-US')}${pct}.`;
  }
  if (fact.kind === 'mover') {
    const change = pctChange(fact.p50, fact.p50_before);
    const dir = change > 0 ? 'rose' : 'fell';
    return `The middle asking price for ${fact.trait} ${dir} from ${formatUsd(fact.p50_before)} to ${formatUsd(fact.p50)} between ${shortDay(fact.day_before)} and ${shortDay(fact.day)} (${fact.for_sale} for sale).`;
  }
  if (fact.kind === 'korea_gap') {
    const cheaper = Number(fact.kr_p50) < Number(fact.us_p50);
    return `${fact.trait} asks ${cheaper ? 'less' : 'more'} in Korea: a middle price of ${formatUsd(fact.kr_p50)} against ${formatUsd(fact.us_p50)} in the US. Shipping and import costs are not included.`;
  }
  return null;
}

export const MARKET_NAMES = { US: 'United States', KR: 'South Korea', JP: 'Japan', EU: 'Europe' };

/** The store slug from a MorphMarket store link, or null. */
export function storeSlugFromUrl(text) {
  const m = /morphmarket\.com\/stores\/([^/?#\s]+)/i.exec(String(text || ''));
  return m ? m[1].toLowerCase() : null;
}

// ---------- the tape --------------------------------------------------

/** Mark events newer than the member's last visit. */
export function markNewSince(events, lastVisitIso) {
  const since = lastVisitIso ? Date.parse(lastVisitIso) : NaN;
  return (events || []).map((e) => ({
    ...e,
    isNew: Number.isFinite(since) ? Date.parse(e.at) > since : false,
  }));
}

/** "12 min ago", "3 h ago", "Sep 29". */
export function timeAgo(iso, now = new Date()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((now.getTime() - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------- Guess the Price -------------------------------------------

/** Same formula as public._price_game_score, for instant feedback. */
export function priceGameScore(guess, price) {
  const g = Number(guess);
  const p = Number(price);
  if (!(g > 0) || !(p > 0)) return 0;
  return Math.max(0, Math.round(100 * (1 - Math.abs(Math.log(g / p)) / Math.log(3))));
}

export function scoreWord(score) {
  if (score >= 95) return 'Spot on';
  if (score >= 85) return 'Very close';
  if (score >= 65) return 'Close';
  if (score >= 35) return 'In the neighborhood';
  return 'Way off';
}

/** Share text for a finished day, one mark per round. */
export function gameShareText(day, rounds) {
  const scored = (rounds || []).filter((r) => r.guessed);
  const total = scored.reduce((s, r) => s + (Number(r.score) || 0), 0);
  const marks = scored
    .map((r) => (r.score >= 85 ? '[x]' : r.score >= 50 ? '[~]' : '[ ]'))
    .join(' ');
  return `Guess the Price, ${shortDay(day)}: ${total} of ${scored.length * 100}\n${marks}\ngeckinspect.com`;
}
