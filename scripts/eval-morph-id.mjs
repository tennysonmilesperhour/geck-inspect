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
const limit = Math.max(0, Number(process.env.EVAL_LIMIT) || 0);
const concurrency = Math.min(8, Math.max(1, Number(process.env.EVAL_CONCURRENCY) || 1));

if (!manifestPath || !baseUrl || !accessToken || !anonKey) {
  console.error(`Usage: pnpm eval:morph-id path/to/holdout.jsonl

Required environment:
  MORPH_ID_ACCESS_TOKEN  Auth token for an admin or evaluation account
  SUPABASE_ANON_KEY      Public key for the app project
  SUPABASE_URL           App project URL, unless MORPH_ID_FUNCTION_URL is set

Optional environment:
  EVAL_SHARED_SECRET     Tags calls as morph_id_eval
  MORPH_ID_MODEL         Defaults to claude-sonnet-4-6
  EVAL_LIMIT             Grade an evenly spaced sample of this many rows
  EVAL_CONCURRENCY       Calls in flight at once (1 to 8, default 1)

Each JSONL row needs image_url or image_urls plus expected_primary_morph.
Optional accepted_morphs lists every pattern the breeder tagged; a prediction
that matches any of them counts toward the breeder-tag accuracy lines.
Use a holdout set that was never included in prompts or the training corpus.`);
  process.exit(1);
}

const text = await readFile(manifestPath, 'utf8');
const allRows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
  }
});

if (allRows.length === 0) throw new Error('The evaluation manifest is empty.');

// An evenly spaced sample keeps a small smoke run spread across the file
// instead of grading only the first few listings.
const rows = limit && limit < allRows.length
  ? allRows.filter((_, index) => index % (allRows.length / limit) < 1).slice(0, limit)
  : allRows;

async function identify(imageUrls, row) {
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150_000);
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        signal: controller.signal,
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
      if (response.ok && !payload.error) return { payload };
      lastError = payload.error || `HTTP ${response.status}`;
      // Retry only what is worth retrying: upstream overload or a gateway blip.
      if (![429, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error.name === 'AbortError' ? 'timed out after 150s' : error.message;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
  }
  return { error: lastError };
}

async function gradeRow(row, index) {
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls
    : row.image_url ? [row.image_url] : [];
  if (!imageUrls.length || !row.expected_primary_morph) {
    throw new Error(`Row ${index + 1} needs image_url(s) and expected_primary_morph.`);
  }

  const { payload, error } = await identify(imageUrls, row);
  if (error) {
    console.error(`[${index + 1}/${rows.length}] ${row.expected_primary_morph} -> error: ${error}`);
    return { id: row.id || index + 1, expected: row.expected_primary_morph, error };
  }

  const accepted = new Set([row.expected_primary_morph, ...(Array.isArray(row.accepted_morphs) ? row.accepted_morphs : [])]);
  const analysis = payload.analysis || payload;
  const candidates = (analysis.candidate_morphs || []).map((candidate) => candidate.morph);
  if (analysis.primary_morph && !candidates.includes(analysis.primary_morph)) {
    candidates.unshift(analysis.primary_morph);
  }
  console.error(`[${index + 1}/${rows.length}] ${row.expected_primary_morph} -> ${analysis.primary_morph} (${analysis.assessment_status})`);
  return {
    id: row.id || index + 1,
    expected: row.expected_primary_morph,
    predicted: analysis.primary_morph,
    candidates: candidates.slice(0, 3),
    secondary_traits: analysis.secondary_traits || [],
    assessment_status: analysis.assessment_status,
    retrieval_status: analysis.visual_evidence?.status || 'missing',
    model_signal: analysis.model_signal,
    taxonomy_version: analysis.taxonomy_version,
    top1_correct: analysis.primary_morph === row.expected_primary_morph,
    top3_correct: candidates.slice(0, 3).includes(row.expected_primary_morph),
    accepted: [...accepted],
    top1_breeder_tag: accepted.has(analysis.primary_morph),
    top3_breeder_tag: candidates.slice(0, 3).some((morph) => accepted.has(morph)),
  };
}

const startedAt = new Date().toISOString();
const results = new Array(rows.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
  while (next < rows.length) {
    const index = next;
    next += 1;
    results[index] = await gradeRow(rows[index], index);
  }
}));

const completed = results.filter((row) => !row.error);
const answered = completed.filter((row) => row.assessment_status !== 'insufficient_evidence');
const ratio = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(4)) : null;
const tally = (items, keyOf) => items.reduce((counts, item) => {
  const key = keyOf(item);
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const confusion = tally(answered.filter((row) => !row.top1_breeder_tag), (row) => `${row.expected} -> ${row.predicted}`);

// Per expected class: how often the first answer matched a breeder tag.
const perClass = {};
for (const row of completed) {
  const entry = perClass[row.expected] || { n: 0, top1_breeder_tag: 0, top3_breeder_tag: 0 };
  entry.n += 1;
  if (row.top1_breeder_tag) entry.top1_breeder_tag += 1;
  if (row.top3_breeder_tag) entry.top3_breeder_tag += 1;
  perClass[row.expected] = entry;
}

const report = {
  generated_at: new Date().toISOString(),
  started_at: startedAt,
  model,
  manifest: manifestPath,
  manifest_size: allRows.length,
  sample_size: rows.length,
  completed: completed.length,
  failures: results.length - completed.length,
  coverage: ratio(answered.length, completed.length),
  overall_top1_accuracy: ratio(completed.filter((row) => row.top1_correct).length, completed.length),
  answered_top1_accuracy: ratio(answered.filter((row) => row.top1_correct).length, answered.length),
  overall_top3_accuracy: ratio(completed.filter((row) => row.top3_correct).length, completed.length),
  // Breeders often tag more than one pattern on one animal. These count a
  // prediction as right when it matches any pattern the breeder tagged.
  overall_top1_breeder_tag: ratio(completed.filter((row) => row.top1_breeder_tag).length, completed.length),
  answered_top1_breeder_tag: ratio(answered.filter((row) => row.top1_breeder_tag).length, answered.length),
  overall_top3_breeder_tag: ratio(completed.filter((row) => row.top3_breeder_tag).length, completed.length),
  status_counts: tally(completed, (row) => row.assessment_status || 'missing'),
  retrieval_status_counts: tally(completed, (row) => row.retrieval_status),
  taxonomy_versions: tally(completed, (row) => row.taxonomy_version || 'missing'),
  per_class: perClass,
  confusion,
  results,
};

console.log(JSON.stringify(report, null, 2));
