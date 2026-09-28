#!/usr/bin/env node
// Runs the Morph ID test set from GitHub Actions (.github/workflows/morph-id-eval.yml).
//
// 1. Makes sure the evaluation account exists. It is a normal account with
//    app_metadata.morph_eval = true. Only the service role can set
//    app_metadata, and recognize-gecko-morph reads that flag to skip credit
//    use for this account. It grants nothing else: not admin, not a tier.
// 2. Signs that account in without a password: the service role asks for a
//    one-time sign-in link and exchanges it for a session on the spot. No
//    email is sent.
// 3. Runs scripts/eval-morph-id.mjs with that session and writes the report.
// 4. Records the headline numbers in geck_data.morph_eval_runs, next to the
//    runs from May, so results can be compared without downloading anything.

import { spawn } from 'node:child_process';
import { writeFile, appendFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const EVAL_EMAIL = env.MORPH_EVAL_EMAIL || 'morph-eval@geckinspect.com';
const MANIFEST = env.EVAL_MANIFEST || 'scripts/morph-id-eval/test-split-breeder-tags.jsonl';
const REPORT_PATH = env.EVAL_REPORT_PATH || 'morph-id-report.json';

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, SUPABASE_ANON_KEY: ANON_KEY })) {
  if (!value) {
    console.error(`${name} is not set. Add it under Settings > Secrets and variables > Actions.`);
    process.exit(1);
  }
}

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SERVICE_KEY, authOptions);

async function findUser(email) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list accounts: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureEvalAccount() {
  const existing = await findUser(EVAL_EMAIL);
  if (existing) {
    // Never hand the flag to an account this workflow did not create.
    if (existing.app_metadata?.morph_eval !== true) {
      throw new Error(`${EVAL_EMAIL} already exists without the evaluation flag. Refusing to use it.`);
    }
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: EVAL_EMAIL,
    email_confirm: true,
    app_metadata: { morph_eval: true },
    user_metadata: { full_name: 'Morph ID evaluation (internal)' },
  });
  if (error) throw new Error(`Could not create the evaluation account: ${error.message}`);
  console.error(`Created evaluation account ${EVAL_EMAIL}.`);
  return data.user;
}

async function signIn() {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EVAL_EMAIL,
  });
  if (linkError) throw new Error(`Could not create a sign-in link: ${linkError.message}`);
  const client = createClient(SUPABASE_URL, ANON_KEY, authOptions);
  const { data, error } = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (error || !data.session) throw new Error(`Could not sign in: ${error?.message || 'no session returned'}`);
  return data.session.access_token;
}

function runEval(tokenFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/eval-morph-id.mjs', MANIFEST], {
      env: { ...env, MORPH_ID_TOKEN_FILE: tokenFile },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`eval-morph-id.mjs exited with code ${code}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Could not read the eval report: ${error.message}`));
      }
    });
  });
}

const pct = (value) => (value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`);

async function main() {
  await ensureEvalAccount();
  // Sessions last an hour and a full sequential run can take longer, so the
  // token lives in a file the eval re-reads, refreshed every 40 minutes.
  const tokenFile = join(await mkdtemp(join(tmpdir(), 'morph-eval-')), 'token');
  await writeFile(tokenFile, await signIn(), { mode: 0o600 });
  const refresher = setInterval(() => {
    signIn()
      .then((token) => writeFile(tokenFile, token, { mode: 0o600 }))
      .catch((error) => console.error(`Token refresh failed: ${error.message}`));
  }, 40 * 60 * 1000);
  let report;
  try {
    report = await runEval(tokenFile);
  } finally {
    clearInterval(refresher);
  }
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

  const taxonomyVersion = Object.keys(report.taxonomy_versions || {})[0] || null;
  const { data: runId, error: recordError } = await admin.rpc('record_morph_eval_run', {
    p_run: {
      started_at: report.started_at,
      finished_at: report.generated_at,
      model: report.model,
      taxonomy_version: taxonomyVersion,
      split: 'test',
      eval_set_size: report.completed,
      primary_morph_top1_accuracy: report.overall_top1_accuracy,
      primary_morph_top3_accuracy: report.overall_top3_accuracy,
      per_trait_metrics: {
        breeder_tag_top1: report.overall_top1_breeder_tag,
        breeder_tag_top1_answered: report.answered_top1_breeder_tag,
        breeder_tag_top3: report.overall_top3_breeder_tag,
        coverage: report.coverage,
        failures: report.failures,
        status_counts: report.status_counts,
        retrieval_status_counts: report.retrieval_status_counts,
        retrieval_notes: report.retrieval_notes,
        per_class: report.per_class,
      },
      top_confusions: Object.entries(report.confusion || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([pair, count]) => ({ pair, count })),
      notes: env.EVAL_NOTES || `CI run on ${report.manifest} (${report.sample_size} of ${report.manifest_size} geckos)`,
      triggered_by: env.GITHUB_ACTOR ? `github-actions:${env.GITHUB_ACTOR}` : 'local',
    },
  });
  if (recordError) console.error(`Could not record the run: ${recordError.message}`);

  const summary = [
    `## Morph ID evaluation`,
    '',
    `Model \`${report.model}\`, taxonomy \`${taxonomyVersion}\`, ${report.completed} of ${report.sample_size} geckos graded (${report.failures} failed).`,
    '',
    '| Measure | Result |',
    '|---|---|',
    `| First answer matches a pattern the breeder tagged | **${pct(report.overall_top1_breeder_tag)}** |`,
    `| A breeder-tagged pattern is in the top 3 | ${pct(report.overall_top3_breeder_tag)} |`,
    `| First answer matches the single picked pattern | ${pct(report.overall_top1_accuracy)} |`,
    `| Picked pattern is in the top 3 | ${pct(report.overall_top3_accuracy)} |`,
    `| Gave an answer (not "insufficient evidence") | ${pct(report.coverage)} |`,
    '',
    `Photo lookup status: ${JSON.stringify(report.retrieval_status_counts)}`,
    Object.keys(report.retrieval_notes || {}).length ? `Photo lookup notes: ${JSON.stringify(report.retrieval_notes)}` : '',
    runId ? `Recorded as geck_data.morph_eval_runs id ${runId}.` : '',
  ].join('\n');
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
