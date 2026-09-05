#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const manifestPath = process.argv[2];
const baseUrl = process.env.MORPH_ID_FUNCTION_URL
  || (process.env.SUPABASE_URL
    ? `${process.env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/recognize-gecko-morph`
    : '');
const accessToken = process.env.MORPH_ID_ACCESS_TOKEN || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const evalSecret = process.env.EVAL_SHARED_SECRET || '';
const model = process.env.MORPH_ID_MODEL || 'claude-sonnet-4-6';

if (!manifestPath || !baseUrl || !accessToken || !anonKey) {
  console.error(`Usage: pnpm eval:morph-id path/to/holdout.jsonl

Required environment:
  MORPH_ID_ACCESS_TOKEN  Auth token for an admin evaluation account
  SUPABASE_ANON_KEY      Public key for the app project
  SUPABASE_URL           App project URL, unless MORPH_ID_FUNCTION_URL is set

Optional environment:
  EVAL_SHARED_SECRET     Tags calls as morph_id_eval
  MORPH_ID_MODEL         Defaults to claude-sonnet-4-6

Each JSONL row needs image_url or image_urls plus expected_primary_morph.
Use a holdout set that was never included in prompts or the training corpus.`);
  process.exit(1);
}

const text = await readFile(manifestPath, 'utf8');
const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
  }
});

if (rows.length === 0) throw new Error('The evaluation manifest is empty.');

const results = [];
for (const [index, row] of rows.entries()) {
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls
    : row.image_url ? [row.image_url] : [];
  if (!imageUrls.length || !row.expected_primary_morph) {
    throw new Error(`Row ${index + 1} needs image_url(s) and expected_primary_morph.`);
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      ...(evalSecret ? { 'x-eval-secret': evalSecret } : {}),
    },
    body: JSON.stringify({
      imageUrls,
      age_stage: row.age_stage || 'unknown',
      fired_state: row.fired_state || 'unknown',
      model,
      surface: 'morph_id_eval',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    results.push({
      id: row.id || index + 1,
      expected: row.expected_primary_morph,
      error: payload.error || `HTTP ${response.status}`,
    });
    continue;
  }

  const analysis = payload.analysis || payload;
  const candidates = (analysis.candidate_morphs || []).map((candidate) => candidate.morph);
  if (analysis.primary_morph && !candidates.includes(analysis.primary_morph)) {
    candidates.unshift(analysis.primary_morph);
  }
  results.push({
    id: row.id || index + 1,
    expected: row.expected_primary_morph,
    predicted: analysis.primary_morph,
    candidates: candidates.slice(0, 3),
    assessment_status: analysis.assessment_status,
    model_signal: analysis.model_signal,
    top1_correct: analysis.primary_morph === row.expected_primary_morph,
    top3_correct: candidates.slice(0, 3).includes(row.expected_primary_morph),
  });
  console.error(`[${index + 1}/${rows.length}] ${row.expected_primary_morph} -> ${analysis.primary_morph} (${analysis.assessment_status})`);
}

const completed = results.filter((row) => !row.error);
const answered = completed.filter((row) => row.assessment_status !== 'insufficient_evidence');
const ratio = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(4)) : null;
const confusion = {};
for (const row of answered) {
  const key = `${row.expected} -> ${row.predicted}`;
  confusion[key] = (confusion[key] || 0) + 1;
}
const statusCounts = completed.reduce((counts, row) => {
  const key = row.assessment_status || 'missing';
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});

const report = {
  generated_at: new Date().toISOString(),
  model,
  manifest: manifestPath,
  sample_size: rows.length,
  completed: completed.length,
  failures: results.length - completed.length,
  coverage: ratio(answered.length, completed.length),
  overall_top1_accuracy: ratio(completed.filter((row) => row.top1_correct).length, completed.length),
  answered_top1_accuracy: ratio(answered.filter((row) => row.top1_correct).length, answered.length),
  overall_top3_accuracy: ratio(completed.filter((row) => row.top3_correct).length, completed.length),
  status_counts: statusCounts,
  confusion,
  results,
};

console.log(JSON.stringify(report, null, 2));
