/**
 * Weekly budget tracker for the blog pipeline.
 *
 * Persists spend to docs/blog-budget.json committed to the repo (yes ,  we
 * want the ledger visible in PRs and the weekly report can link to it).
 * The file rolls into weekly buckets keyed by ISO week "YYYY-Www". Each
 * bucket tracks totalUsd, per-model totals, and a call log (capped at
 * 1000 entries / week) so the weekly report can show what drove spend.
 *
 * Hard weekly cap: $10 USD. Any call that would push the current week
 * over the cap throws BudgetExceededError immediately ,  callers should
 * treat that as a hard stop for the current run. The cron schedule will
 * try again next slot.
 *
 * Concurrency: GitHub Actions jobs in this repo don't run more than one
 * pipeline invocation at a time (research + draft are sequenced Mon/Wed/Fri
 * morning; weekly report is its own job on Sunday night). No file locking
 * needed. If we ever parallelise, add proper-lockfile or similar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEEKLY_CAP_USD = 10.00;
const MAX_LOG_ENTRIES_PER_WEEK = 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// anthropic.mjs and budget.mjs live in scripts/blog/lib/ ,  budget ledger
// is repo-relative so it gets committed.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUDGET_FILE = path.join(REPO_ROOT, 'docs', 'blog-budget.json');

export class BudgetExceededError extends Error {
  constructor(message, { currentUsd, capUsd }) {
    super(message);
    this.name = 'BudgetExceededError';
    this.currentUsd = currentUsd;
    this.capUsd = capUsd;
  }
}

/** Compute the ISO week key ("YYYY-Www") for the given Date. */
export function isoWeekKey(date = new Date()) {
  // Copy so we don't mutate the caller's date.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO week algorithm: shift to the Thursday of the current week.
  const dayNum = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function readLedger() {
  try {
    const raw = fs.readFileSync(BUDGET_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { $schema: 'docs/blog-budget.schema.json', weeks: {} };
    }
    throw err;
  }
}

function writeLedger(ledger) {
  fs.mkdirSync(path.dirname(BUDGET_FILE), { recursive: true });
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(ledger, null, 2) + '\n');
}

/** Return {usd, remainingUsd, capUsd} for the current ISO week. */
export function currentWeekSpend() {
  const ledger = readLedger();
  const key = isoWeekKey();
  const bucket = ledger.weeks[key] || { totalUsd: 0 };
  return {
    weekKey: key,
    usd: bucket.totalUsd || 0,
    capUsd: WEEKLY_CAP_USD,
    remainingUsd: Math.max(0, WEEKLY_CAP_USD - (bucket.totalUsd || 0)),
  };
}

/**
 * Throw BudgetExceededError if the current week is already at or over the cap.
 * Call this BEFORE an API call that you're not willing to run if we're out of
 * budget. Intentionally conservative ,  we check before the call rather than
 * trying to predict its cost.
 */
export function assertBudgetAvailable(context = '') {
  const { usd, capUsd, weekKey } = currentWeekSpend();
  if (usd >= capUsd) {
    throw new BudgetExceededError(
      `Blog pipeline weekly budget exhausted: $${usd.toFixed(2)} of $${capUsd.toFixed(2)} spent ` +
      `in ${weekKey}${context ? ` (blocked: ${context})` : ''}. Waiting until next week.`,
      { currentUsd: usd, capUsd }
    );
  }
}

/**
 * Append one call's spend to the ledger and persist. Called by anthropic.mjs
 * after every successful request.
 */
export async function recordSpend({ model, stopLabel, usage, totalUsd }) {
  const ledger = readLedger();
  const key = isoWeekKey();
  const bucket = (ledger.weeks[key] ||= {
    totalUsd: 0,
    byModel: {},
    byStop: {},
    log: [],
    firstCallAt: new Date().toISOString(),
  });

  bucket.totalUsd = round(bucket.totalUsd + totalUsd, 6);
  bucket.byModel[model] = round((bucket.byModel[model] || 0) + totalUsd, 6);
  bucket.byStop[stopLabel] = round((bucket.byStop[stopLabel] || 0) + totalUsd, 6);
  bucket.lastCallAt = new Date().toISOString();

  bucket.log.push({
    at: bucket.lastCallAt,
    model,
    stopLabel,
    usd: round(totalUsd, 6),
    in: usage.input_tokens || 0,
    out: usage.output_tokens || 0,
    cr: usage.cache_read_input_tokens || 0,
    cw: usage.cache_creation_input_tokens || 0,
  });
  if (bucket.log.length > MAX_LOG_ENTRIES_PER_WEEK) {
    // Keep the most recent; older entries are captured in committed
    // weekly report snapshots anyway.
    bucket.log = bucket.log.slice(-MAX_LOG_ENTRIES_PER_WEEK);
  }

  writeLedger(ledger);
  return { weekKey: key, weekTotalUsd: bucket.totalUsd };
}

/** Summary for the weekly report. */
export function weekSummary(weekKey = isoWeekKey()) {
  const ledger = readLedger();
  const bucket = ledger.weeks[weekKey];
  if (!bucket) return null;
  return {
    weekKey,
    totalUsd: bucket.totalUsd,
    byModel: bucket.byModel,
    byStop: bucket.byStop,
    callCount: bucket.log?.length || 0,
    firstCallAt: bucket.firstCallAt,
    lastCallAt: bucket.lastCallAt,
  };
}

function round(n, places) {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}
