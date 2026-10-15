/**
 * The weekly scoreboard on the admin Funnel card (comprehensive review,
 * Part E5). The database function public.admin_scoreboard() returns the
 * raw counts; this file turns them into the numbers on the card and holds
 * the day 30, 60 and 90 targets, so the card and its tests read the same
 * definitions.
 */
import { TIER_PRICING } from '@/lib/stripe-config';

/** The three checkpoints of the 90-day plan, as written in E5. */
export const SCOREBOARD_CHECKPOINTS = [
  { key: 'day30', label: 'Day 30', date: '2026-11-17', dateLabel: '17 Nov 2026' },
  { key: 'day60', label: 'Day 60', date: '2026-12-17', dateLabel: '17 Dec 2026' },
  { key: 'day90', label: 'Day 90', date: '2027-01-17', dateLabel: '17 Jan 2027' },
];

/**
 * Targets per metric and checkpoint. `min` is "this many or more"; `max`
 * is "under this". `note` carries the E5 wording when a bare number would
 * lose meaning. A missing checkpoint means E5 sets no number for it.
 */
export const SCOREBOARD_TARGETS = {
  conversations: {
    day30: { min: 15, note: 'Fewer than 15 means engineering pauses for conversations' },
    day60: { min: 20 },
  },
  imports: {
    day30: { min: 5 },
    day60: { min: 10 },
  },
  payingBreeders: {
    day30: { min: 2 },
    day60: { min: 6, note: 'Under 3 after 20 conversations and 10 imports means a record book, not a subscription business' },
    day90: { min: 10, note: 'Invest: 10 or more at $10 a month or more. Maintain: 3 to 9. Reference: under 3' },
  },
  mrr: {
    day60: { note: 'Tripwire: cost over $150 a month with revenue under $50' },
  },
  passportsIssued: {
    day30: { min: 10 },
    day60: { min: 50 },
  },
  passportsClaimed: {
    day60: { min: 15 },
    day90: { min: 25 },
  },
  claimersActive: {
    day60: { min: 3 },
  },
  weeklyActiveBreeders: {
    day60: { min: 4 },
    day90: { min: 5, note: 'For four straight weeks' },
  },
  monthlyCost: {
    day30: { max: 100 },
  },
};

const PAID_TIERS = new Set(['keeper', 'breeder', 'enterprise']);
// Breeder and Enterprise are the plans breeders buy; Keeper is for keepers.
const BREEDER_TIERS = new Set(['breeder', 'enterprise']);

function priceNumber(text) {
  const n = Number(String(text ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * What one member on this plan adds to monthly recurring revenue, in
 * dollars. Annual plans count a twelfth of the year's price. Lifetime
 * plans are a one-time payment, so they add nothing recurring.
 */
export function monthlyValue(tier, cycle) {
  const plan = TIER_PRICING[tier];
  if (!plan) return 0;
  if (cycle === 'annual') return priceNumber(plan.annual?.price) / 12;
  if (cycle === 'lifetime') return 0;
  return priceNumber(plan.monthly?.price);
}

/**
 * Turn the function's paid_plans rows ({ tier, cycle, source, comped, n })
 * into the card's money numbers. Members who also hold a current
 * complimentary grant are counted apart and left out of both "paying" and
 * revenue: E5 says a comped account is not evidence.
 */
export function summarizePaidPlans(rows) {
  const out = {
    payingBreeders: 0,
    payingKeepers: 0,
    payingAll: 0,
    lifetime: 0,
    compedPayers: 0,
    mrr: 0,
  };
  for (const r of Array.isArray(rows) ? rows : []) {
    const n = Number(r?.n) || 0;
    if (!n || !PAID_TIERS.has(r.tier)) continue;
    if (r.comped) {
      out.compedPayers += n;
      continue;
    }
    out.payingAll += n;
    if (BREEDER_TIERS.has(r.tier)) out.payingBreeders += n;
    else out.payingKeepers += n;
    if (r.cycle === 'lifetime') out.lifetime += n;
    out.mrr += monthlyValue(r.tier, r.cycle) * n;
  }
  out.mrr = Math.round(out.mrr * 100) / 100;
  return out;
}

function dayNumber(isoDay) {
  const [y, m, d] = String(isoDay).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Today's date in Denver as YYYY-MM-DD (the admin's own calendar). */
export function denverToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return parts;
}

/**
 * Count the hand-recorded entries: conversations and imports in total and
 * in the last 7 days (today and the six days before), and the newest
 * monthly cost entry.
 */
export function summarizeEntries(entries, today = denverToday()) {
  const todayN = dayNumber(today);
  const out = {
    conversations: 0,
    conversations7d: 0,
    imports: 0,
    imports7d: 0,
    latestCost: null,
  };
  for (const e of Array.isArray(entries) ? entries : []) {
    const day = dayNumber(e?.entry_date);
    const recent = day !== null && todayN !== null && todayN - day >= 0 && todayN - day < 7;
    if (e?.kind === 'conversation') {
      out.conversations += 1;
      if (recent) out.conversations7d += 1;
    } else if (e?.kind === 'import') {
      out.imports += 1;
      if (recent) out.imports7d += 1;
    } else if (e?.kind === 'monthly_cost' && e.amount_usd !== null && e.amount_usd !== undefined) {
      const newer = !out.latestCost
        || String(e.entry_date) > String(out.latestCost.entry_date)
        || (String(e.entry_date) === String(out.latestCost.entry_date)
          && String(e.created_date || '') > String(out.latestCost.created_date || ''));
      if (newer) out.latestCost = { amount: Number(e.amount_usd), entry_date: e.entry_date, created_date: e.created_date };
    }
  }
  return out;
}

/**
 * The first checkpoint that has not passed yet, so the card can say which
 * target to aim at now. After day 90 it stays on day 90.
 */
export function nextCheckpoint(today = denverToday()) {
  return SCOREBOARD_CHECKPOINTS.find((c) => c.date >= today) || SCOREBOARD_CHECKPOINTS[SCOREBOARD_CHECKPOINTS.length - 1];
}

/** Whether a value meets a target. Returns null when there is nothing to compare. */
export function meetsTarget(value, target) {
  if (!target || value === null || value === undefined || Number.isNaN(Number(value))) return null;
  if (typeof target.min === 'number') return Number(value) >= target.min;
  if (typeof target.max === 'number') return Number(value) < target.max;
  return null;
}

/** Short text for a target: "15+", "under $100", or nothing. */
export function targetText(target, { money = false } = {}) {
  if (!target) return '';
  if (typeof target.min === 'number') return money ? `$${target.min}+` : `${target.min}+`;
  if (typeof target.max === 'number') return money ? `under $${target.max}` : `under ${target.max}`;
  return '';
}

export function formatUsd(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function percent(part, whole) {
  if (!whole) return 'n/a';
  return `${Math.round((Number(part) / Number(whole)) * 100)}%`;
}
