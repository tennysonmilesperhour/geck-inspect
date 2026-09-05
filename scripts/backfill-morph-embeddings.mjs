#!/usr/bin/env node

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith('--')) continue;
  const [key, inlineValue] = token.slice(2).split('=', 2);
  const next = process.argv[index + 1];
  const value = inlineValue ?? (next && !next.startsWith('--') ? process.argv[++index] : 'true');
  args.set(key, value);
}

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const backfillKey = process.env.MORPH_EMBED_BACKFILL_KEY || '';
const limit = Math.max(1, Math.min(5000, Number(args.get('limit') || 250)));
const concurrency = Math.max(1, Math.min(8, Number(args.get('concurrency') || 1)));
const maxAttempts = Math.max(1, Math.min(10, Number(args.get('max-attempts') || 3)));
const dryRun = args.get('dry-run') === 'true';

if (!supabaseUrl || !serviceKey || !backfillKey) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and MORPH_EMBED_BACKFILL_KEY are required.');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'x-morph-embed-key': backfillKey,
  'Content-Type': 'application/json',
};

const query = new URL(`${supabaseUrl}/rest/v1/gecko_images`);
query.searchParams.set('select', 'id,image_url,primary_morph,training_meta,embedding_status,embedding_attempts');
query.searchParams.set('image_embedding', 'is.null');
query.searchParams.set('image_url', 'not.is.null');
query.searchParams.set('verified', 'eq.true');
query.searchParams.set('primary_morph', 'not.is.null');
query.searchParams.set('embedding_attempts', `lt.${maxAttempts}`);
query.searchParams.set('order', 'embedding_attempts.asc,created_date.asc');
query.searchParams.set('limit', '1000');

const candidates = [];
for (let offset = 0; offset < 5000; offset += 1000) {
  query.searchParams.set('offset', String(offset));
  const response = await fetch(query, { headers });
  if (!response.ok) {
    throw new Error(`Could not load embedding queue (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const page = await response.json();
  candidates.push(...page);
  if (page.length < 1000) break;
}
const hostSamples = new Map();
for (const row of candidates) {
  try {
    const host = new URL(row.image_url).host;
    if (!hostSamples.has(host)) hostSamples.set(host, row.image_url);
  } catch {
    // Invalid URLs are excluded below.
  }
}
const hostChecks = await Promise.all([...hostSamples].map(async ([host, imageUrl]) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const check = await fetch(imageUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    });
    await check.body?.cancel();
    return [host, check.ok];
  } catch {
    return [host, false];
  } finally {
    clearTimeout(timeout);
  }
}));
const reachableHosts = new Set(hostChecks.filter(([, reachable]) => reachable).map(([host]) => host));
const unavailableHosts = hostChecks.filter(([, reachable]) => !reachable).map(([host]) => host);
if (unavailableHosts.length > 0) {
  console.warn(`Skipping unavailable image host(s): ${unavailableHosts.join(', ')}`);
}
const provenanceWeight = (row) => {
  const tier = row.training_meta?.verification_tier;
  const provenance = row.training_meta?.provenance;
  if (tier === 'hero_anchor') return 1;
  if (['expert_owner', 'expert_reviewed'].includes(provenance)) return 0.95;
  if (provenance === 'ai_then_expert') return 0.85;
  if (provenance === 'community') return 0.6;
  if (tier === 'auto_bulk_approved') return 0.4;
  return 0.5;
};
const groups = new Map();
const seenSources = new Set();
for (const row of candidates
  .filter((candidate) => {
    try { return reachableHosts.has(new URL(candidate.image_url).host); } catch { return false; }
  })
  .sort((a, b) => provenanceWeight(b) - provenanceWeight(a))) {
  const source = row.training_meta?.listing_id || row.training_meta?.gecko_id || row.id;
  if (seenSources.has(source)) continue;
  seenSources.add(source);
  const label = row.primary_morph || 'Unclassified';
  if (!groups.has(label)) groups.set(label, []);
  groups.get(label).push(row);
}
const rows = [];
const queues = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
while (rows.length < limit && queues.some((queue) => queue.length > 0)) {
  for (const queue of queues) {
    if (rows.length >= limit) break;
    const row = queue.shift();
    if (row) rows.push(row);
  }
}
console.log(`Embedding queue: ${rows.length} row(s) across ${groups.size} morph label(s), concurrency ${concurrency}${dryRun ? ' [dry run]' : ''}`);
if (dryRun) console.log(`Morph labels: ${[...groups.keys()].sort().join(', ')}`);

if (dryRun || rows.length === 0) process.exit(0);

let cursor = 0;
let completed = 0;
let failed = 0;

async function worker() {
  while (cursor < rows.length) {
    const row = rows[cursor++];
    try {
      const embedResponse = await fetch(`${supabaseUrl}/functions/v1/embed-gecko-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageUrl: row.image_url, geckoImageId: row.id }),
      });
      const body = await embedResponse.json().catch(() => ({}));
      if (!embedResponse.ok || !body.persisted) {
        throw new Error(body.error || `HTTP ${embedResponse.status}`);
      }
      completed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[${completed + failed}/${rows.length}] ${row.id}: ${error.message}`);
    }
    const processed = completed + failed;
    if (processed % 10 === 0 || processed === rows.length) {
      console.log(`Progress: ${processed}/${rows.length}; ready=${completed}; failed=${failed}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log(`Finished: ready=${completed}; failed=${failed}`);
if (failed > 0) process.exitCode = 2;
