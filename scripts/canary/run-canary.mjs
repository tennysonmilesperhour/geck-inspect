#!/usr/bin/env node
// Daily health check for the two features members pay for most: Morph ID and
// the "what is my gecko worth" estimate. Runs from
// .github/workflows/daily-canary.yml against production and fails the run
// (GitHub then emails the repo owner) when either one is broken.
//
// It signs in as the Morph ID evaluation account (see
// scripts/morph-id-eval/evalAccount.mjs), so it goes through the same
// signed-in paths a member uses and spends no member credits.
//
// What it checks:
//   1. Market data: listings feeding the estimates are still arriving
//      (public.market_data_health). This is the check that would have caught
//      the 1 to 5 Oct 2026 freeze, when new listings were stored under a
//      species name the price readers ignored.
//   2. Value table: public.trait_value_table() loads, the core morphs have
//      enough listings, and the app's own valuation code
//      (src/lib/traitValuation.js) prices reference geckos inside sane bands.
//   3. Morph ID: two real identifications on held-out breeder-tagged geckos
//      return a usable answer in time. Accuracy is reported, not enforced:
//      two geckos are too few to grade, and the eval workflow does that.
//
// Cost: two identifications, about 6 cents a day.

import { appendFile, readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { evalAccount, authOptions } from '../morph-id-eval/evalAccount.mjs';
import { buildTraitValueIndex, valueFromTraitTable } from '../../src/lib/traitValuation.js';
import { CORE_TRAITS, REFERENCE_GECKOS } from './references.mjs';

const env = process.env;
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const MANIFEST = env.CANARY_MANIFEST || 'scripts/morph-id-eval/test-split-breeder-tags.jsonl';
const MORPH_ID_SAMPLES = Math.max(0, Number(env.CANARY_MORPH_ID_SAMPLES ?? 2));
const SKIP_MORPH_ID = env.CANARY_SKIP_MORPH_ID === '1';

const results = [];
function record(area, check, ok, detail) {
  results.push({ area, check, ok, detail });
  console.error(`${ok ? 'PASS' : 'FAIL'}  ${area}: ${check}${detail ? `  (${detail})` : ''}`);
}

// ---------------------------------------------------------------- market data
async function checkMarketData(admin) {
  const { data, error } = await admin.rpc('market_data_health');
  if (error) {
    record('Market data', 'health function answers', false, error.message);
    return;
  }
  record('Market data', 'health function answers', true);
  record('Market data', 'new listings arrived in the last 3 days', data.new_last_3_days > 0,
    `${data.new_last_3_days} new, newest first seen ${data.newest_first_seen}`);
  const uncounted = Object.entries(data.uncounted_species || {}).reduce((sum, [, n]) => sum + Number(n), 0);
  record('Market data', 'no listings hidden by an unknown species value', uncounted < 50,
    uncounted ? JSON.stringify(data.uncounted_species) : 'none');
}

async function fetchTraitRows(client) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.rpc('trait_value_table').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function checkValueTable(client) {
  let rows;
  try {
    rows = await fetchTraitRows(client);
  } catch (error) {
    record('Value estimate', 'trait_value_table loads for a signed-in member', false, error.message);
    return;
  }
  record('Value estimate', 'trait_value_table loads for a signed-in member', rows.length >= 200, `${rows.length} rows`);

  const index = buildTraitValueIndex(rows);
  for (const name of CORE_TRAITS) {
    const trait = index.traits.get(name.toLowerCase()) || [...index.traits.values()].find((t) => t.name === name);
    const n = trait?.n ?? 0;
    record('Value estimate', `${name} has at least 50 listings`, n >= 50, `n=${n}`);
  }

  for (const ref of REFERENCE_GECKOS) {
    const estimate = valueFromTraitTable(ref.gecko, index);
    const value = estimate?.value;
    const ok = Number.isFinite(value) && value >= ref.min && value <= ref.max;
    record('Value estimate', `${ref.label} prices between $${ref.min} and $${ref.max}`, ok,
      estimate ? `$${Math.round(value)} from ${estimate.trait}, ${estimate.levelLabel}` : 'no estimate');
  }
}

// ------------------------------------------------------------------- morph id
async function pickMorphIdRows() {
  const text = await readFile(MANIFEST, 'utf8');
  const rows = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  // Rotate through the set day by day so a single dead photo link cannot
  // fail the check forever, and different patterns get exercised.
  const day = Math.floor(Date.now() / 86_400_000);
  const picked = [];
  for (let offset = 0; offset < rows.length && picked.length < MORPH_ID_SAMPLES; offset += 1) {
    const row = rows[(day * 7 + offset * 37) % rows.length];
    const urls = row.image_urls || [];
    if (urls.length < 2) continue;
    const reachable = await Promise.all(urls.slice(0, 2).map((url) =>
      fetch(url, { method: 'HEAD' }).then((res) => res.ok).catch(() => false)));
    if (reachable.every(Boolean)) picked.push({ ...row, image_urls: urls.slice(0, 2) });
  }
  return picked;
}

async function identify(token, row) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 125_000);
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/recognize-gecko-morph`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageUrls: row.image_urls,
        age_stage: 'unknown',
        fired_state: 'unknown',
        surface: 'morph_id_eval',
      }),
    });
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload, seconds: (Date.now() - started) / 1000 };
  } catch (error) {
    return { status: 0, payload: { error: error.name === 'AbortError' ? 'timed out after 125s' : error.message }, seconds: (Date.now() - started) / 1000 };
  } finally {
    clearTimeout(timer);
  }
}

async function checkMorphId(token) {
  const rows = await pickMorphIdRows();
  record('Morph ID', `found ${MORPH_ID_SAMPLES} test geckos with reachable photos`, rows.length === MORPH_ID_SAMPLES, `${rows.length} found`);
  for (const row of rows) {
    const { status, payload, seconds } = await identify(token, row);
    const analysis = payload.analysis || {};
    const ok = status === 200 && payload.success === true
      && typeof analysis.primary_morph === 'string' && analysis.primary_morph.length > 0
      && typeof analysis.assessment_status === 'string';
    const accepted = new Set([row.expected_primary_morph, ...(row.accepted_morphs || [])]);
    const top3 = [analysis.primary_morph, ...(analysis.candidate_morphs || []).map((c) => c.morph)].filter(Boolean);
    const hit = top3.slice(0, 3).some((m) => accepted.has(m));
    record('Morph ID', `identifies ${row.id}`, ok,
      ok
        ? `${analysis.primary_morph} (${analysis.assessment_status}) in ${seconds.toFixed(0)}s; breeder tagged ${[...accepted].join('/')}; ${hit ? 'match in top 3' : 'no match in top 3'}`
        : `HTTP ${status}: ${payload.code || ''} ${payload.error || ''}`.trim());
    if (ok) record('Morph ID', `answers ${row.id} in under 100 seconds`, seconds < 100, `${seconds.toFixed(0)}s`);
  }
}

// ----------------------------------------------------------------------- main
async function main() {
  for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, SUPABASE_ANON_KEY: ANON_KEY })) {
    if (!value) {
      console.error(`${name} is not set. Add it under Settings > Secrets and variables > Actions.`);
      process.exit(1);
    }
  }

  const { admin, ensureEvalAccount, signIn } = evalAccount({
    supabaseUrl: SUPABASE_URL,
    serviceKey: SERVICE_KEY,
    anonKey: ANON_KEY,
    email: env.MORPH_EVAL_EMAIL || 'morph-eval@geckinspect.com',
  });
  await ensureEvalAccount();
  const token = await signIn();
  const member = createClient(SUPABASE_URL, ANON_KEY, {
    ...authOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  await checkMarketData(admin);
  await checkValueTable(member);
  if (!SKIP_MORPH_ID && MORPH_ID_SAMPLES > 0) await checkMorphId(token);

  const failed = results.filter((r) => !r.ok);
  const lines = [
    `## Daily health check: ${failed.length ? `${failed.length} problem${failed.length === 1 ? '' : 's'}` : 'all clear'}`,
    '',
    '| | Area | Check | Detail |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.ok ? 'ok' : '**FAIL**'} | ${r.area} | ${r.check} | ${(r.detail || '').replace(/\|/g, '/')} |`),
  ];
  const summary = lines.join('\n');
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
