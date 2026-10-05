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
import { evalAccount } from './evalAccount.mjs';

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

const { admin, ensureEvalAccount, signIn } = evalAccount({
  supabaseUrl: SUPABASE_URL,
  serviceKey: SERVICE_KEY,
  anonKey: ANON_KEY,
  email: EVAL_EMAIL,
});

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
        // One compact line per gecko, so a run can be picked apart with SQL
        // without downloading the artifact.
        rows: (report.results || []).map((row) => ({
          id: row.id,
          expected: row.expected,
          accepted: row.accepted,
          predicted: row.predicted,
          top3: row.candidates,
          tags: row.secondary_traits,
          pattern_family: row.pattern_family,
          pinning: row.pinning,
          lookup: row.retrieval_leader,
          status: row.assessment_status,
          error: row.error,
        })),
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
