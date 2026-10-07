#!/usr/bin/env node
/**
 * Weekly AI traffic export for the agent review.
 *
 * Runs in GitHub Actions (.github/workflows/agent-traffic.yml) every Monday
 * before the scheduled agent review session. It writes what the review
 * needs into the repo, so the review session works from files and needs
 * no database connector or network access of its own:
 *
 *   docs/agent-review/YYYY-MM-DD.json
 *     traffic      public.agent_traffic_summary() for 7 and 28 days
 *     priceIndex   generated_at and row counts of the live price index
 *     mcp          whether https://geckinspect.com/mcp answers tools/list
 *     pruned       how many agent_hits rows older than 180 days were removed
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (repo secrets).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'docs/agent-review');
const SITE = 'https://geckinspect.com';
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const today = new Date().toISOString().slice(0, 10);

const headers = KEY
  ? { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
  : null;

async function summary(days) {
  const res = await fetch(`${URL_}/rest/v1/rpc/agent_traffic_summary`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_days: days }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`agent_traffic_summary(${days}): HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function prune() {
  const cutoff = new Date(Date.now() - 180 * 864e5).toISOString();
  const res = await fetch(`${URL_}/rest/v1/agent_hits?at=lt.${encodeURIComponent(cutoff)}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'count=exact,return=minimal' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const range = res.headers.get('content-range') || '';
  return { cutoff, removed: Number(range.split('/')[1]) || 0 };
}

async function priceIndex() {
  try {
    const res = await fetch(`${SITE}/data/price-index.json`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = await res.json();
    const days = (Date.now() - new Date(data.generated_at).getTime()) / 864e5;
    const lastChecks = {};
    for (const r of data.latest || []) lastChecks[r.market] = r.checked_on;
    return {
      generated_at: data.generated_at,
      age_days: Math.round(days * 10) / 10,
      fresh: days <= 7,
      latest_rows: data.latest?.length || 0,
      monthly_rows: data.monthly?.length || 0,
      last_full_check_by_market: lastChecks,
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function mcp() {
  try {
    const res = await fetch(`${SITE}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'User-Agent': 'geckinspect-agent-review' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, tools: body?.result?.tools?.map((t) => t.name) || [], ok: res.ok && Boolean(body?.result) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const report = { generated_at: new Date().toISOString() };
if (!headers || !URL_) {
  report.traffic = { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' };
} else {
  try {
    report.traffic = { last7: await summary(7), last28: await summary(28) };
  } catch (e) {
    report.traffic = { error: e.message };
  }
  report.pruned = await prune();
}
report.priceIndex = await priceIndex();
report.mcp = await mcp();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, `${today}.json`), `${JSON.stringify(report, null, 2)}\n`);
const t7 = report.traffic?.last7;
console.log(
  `[agent-traffic] ${today}: ${t7 ? `${t7.total} bot hits in 7 days (previous 7: ${t7.previous_total})` : report.traffic?.error}; ` +
    `price index ${report.priceIndex.fresh ? 'fresh' : 'stale or unreachable'}; MCP ${report.mcp.ok ? 'up' : 'down'}`,
);
