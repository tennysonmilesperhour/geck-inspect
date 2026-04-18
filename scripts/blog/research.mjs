#!/usr/bin/env node
/**
 * Research pass — runs Monday/Wednesday/Friday at 06:00 UTC.
 *
 * Flow:
 *   1. Collect raw signals from Reddit, MorphMarket, Google autocomplete, Pangea.
 *   2. Pass the full signal dump plus the list of already-published slugs to
 *      Haiku 4.5, which emits up to 3 scored topics via a strict tool schema.
 *   3. Merge new topics into docs/blog-queue.json (dedupe by slug), save.
 *   4. Commit the updated queue so the draft pass can pick it up.
 *
 * Commits happen from the GitHub Action runner using GITHUB_TOKEN. This script
 * only writes the file; the workflow commits + pushes.
 *
 * Exit codes:
 *   0 = success, queue updated (or no new topics clear the bar)
 *   1 = hard failure (API down, budget exhausted, unrecoverable)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODELS, callClaudeJson } from './lib/anthropic.mjs';
import { BudgetExceededError, currentWeekSpend } from './lib/budget.mjs';
import { loadMorphSlugs, loadPublishedPostSlugs } from './lib/fact-check.mjs';
import { collectRedditSignals } from './lib/sources/reddit.mjs';
import { collectMorphMarketSignals } from './lib/sources/morphmarket.mjs';
import { collectGoogleAutocomplete } from './lib/sources/google-ac.mjs';
import { collectPangeaSignals } from './lib/sources/pangea.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const QUEUE_PATH = path.join(REPO_ROOT, 'docs', 'blog-queue.json');

const MIN_SCORE_TO_KEEP = 5.0; // out of 10; tune over time
const MAX_NEW_PER_RUN = 3;
const MAX_QUEUE_SIZE = 30; // avoid runaway queue growth

const TOPIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['topics', 'rationale'],
  properties: {
    rationale: {
      type: 'string',
      description: 'One short paragraph explaining the overall shape of signals you saw and why you picked (or skipped) topics.',
    },
    topics: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'slug', 'category', 'score', 'evidence', 'angleIdeas'],
        properties: {
          title: { type: 'string', description: 'Working title — the writer agent may rewrite.' },
          slug:  { type: 'string', description: 'URL slug, lowercase, hyphens only.' },
          category: { type: 'string', enum: ['genetics', 'breeding', 'mythbusters', 'identification'] },
          score: {
            type: 'object',
            additionalProperties: false,
            required: ['total', 'demand', 'originality', 'accuracyRisk', 'voiceFit'],
            properties: {
              total:        { type: 'number' },
              demand:       { type: 'number' },
              originality:  { type: 'number' },
              accuracyRisk: { type: 'number' },
              voiceFit:     { type: 'number' },
            },
          },
          evidence: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['source', 'snippet'],
              properties: {
                source:  { type: 'string' },
                url:     { type: ['string', 'null'] },
                snippet: { type: 'string' },
              },
            },
          },
          angleIdeas: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: { type: 'string' },
          },
        },
      },
    },
  },
};

function readQueue() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { lastUpdated: null, topics: [] };
    throw err;
  }
}

function writeQueue(queue) {
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

function buildScorerSystem({ publishedSlugs, queuedSlugs, knownMorphs }) {
  return [
    {
      type: 'text',
      text: [
        'You are the research agent for the Geck Inspect blog pipeline.',
        '',
        'Your job: from the raw forum + listing + search signals below, pick AT MOST 3 topics that deserve a full blog post this week. Be selective — empty output is fine if nothing clears the bar.',
        '',
        'Scoring rubric (all on 0-10):',
        '  demand:       how much reader interest is there (forum heat, search volume, recency)?',
        '  originality:  how little coverage already exists (penalise topics we\'ve already published)?',
        '  accuracyRisk: HIGHER = more risky / harder to verify. We subtract this from the total.',
        '  voiceFit:     how well does this suit a breeder-to-breeder, opinionated, specific voice?',
        '  total = demand + originality + voiceFit - accuracyRisk   (range roughly -10..30)',
        '',
        'Reject topics that:',
        '  - Duplicate an already-published slug (see list below).',
        '  - Make claims we can\'t ground in src/data/morph-guide.js, genetics-glossary.js, or genetics-sections.jsx.',
        '  - Are general care/husbandry without a specific angle (the care guide already covers those).',
        '  - Are pure listicles with no through-line.',
        '',
        'Prefer topics with:',
        '  - A concrete misconception you can correct ("everyone says X, actually Y").',
        '  - A specific breeding or pairing outcome the reader can act on.',
        '  - Forum threads showing confusion or disagreement.',
        '',
        'Category must be one of: genetics | breeding | mythbusters | identification.',
        '',
        'For each topic, provide at least 2 evidence entries that reference the actual signals below — include the source and a verbatim-or-nearly-verbatim snippet so a human can verify.',
        '',
        'Provide 2-4 angleIdeas that are actual first-sentence hooks, not titles. Bad: "Cappuccino genetics explained." Good: "Most breeders who buy two Cappuccinos and pair them assume they\'ll get more Cappuccinos. Here\'s why that\'s expensive."',
      ].join('\n'),
    },
    {
      type: 'text',
      text: [
        'Already published slugs (reject duplicates):',
        publishedSlugs.length ? publishedSlugs.map((s) => `  - ${s}`).join('\n') : '  (none)',
        '',
        'Already queued slugs (don\'t re-queue):',
        queuedSlugs.length ? queuedSlugs.map((s) => `  - ${s}`).join('\n') : '  (none)',
        '',
        'Canonical morph list (you must use one of these slugs if the topic targets a specific morph):',
        knownMorphs.map((m) => `  - ${m.slug} — ${m.name} (${m.inheritance})`).join('\n'),
      ].join('\n'),
    },
  ];
}

async function main() {
  const now = new Date();
  console.log(`[research] Starting at ${now.toISOString()}`);

  const spend = currentWeekSpend();
  console.log(`[research] Budget: $${spend.usd.toFixed(4)} of $${spend.capUsd.toFixed(2)} used this week (${spend.weekKey})`);

  // 1. Gather signals (all in parallel; they're independent).
  console.log('[research] Collecting signals...');
  const [reddit, morphmarket, googleAc, pangea] = await Promise.all([
    collectRedditSignals().catch((e) => ({ items: [], errors: [e.message] })),
    collectMorphMarketSignals().catch((e) => ({ items: [], error: e.message })),
    collectGoogleAutocomplete().catch((e) => ({ items: [], error: e.message })),
    collectPangeaSignals().catch((e) => ({ items: [], error: e.message })),
  ]);
  console.log(`[research] Signals: reddit=${reddit.items.length}, morphmarket=${morphmarket.items.length}, google-ac=${googleAc.items.length}, pangea=${pangea.items.length}`);

  // 2. Prepare scorer input.
  const queue = readQueue();
  const publishedSlugs = loadPublishedPostSlugs();
  const queuedSlugs = queue.topics.filter((t) => t.status !== 'published' && t.status !== 'rejected').map((t) => t.slug);
  const knownMorphs = loadMorphSlugs();
  const system = buildScorerSystem({ publishedSlugs, queuedSlugs, knownMorphs });

  const userMessage = [
    'Here are the raw signals collected this run. Apply the rubric and emit up to 3 topics.',
    '',
    `Reddit (${reddit.items.length} items, sample follows):`,
    JSON.stringify(reddit.items.slice(0, 40), null, 2),
    '',
    `MorphMarket (${morphmarket.items.length} trait-mention items):`,
    JSON.stringify(morphmarket.items, null, 2),
    '',
    `Google autocomplete (${googleAc.items.length} suggestions, sample follows):`,
    JSON.stringify(googleAc.items.slice(0, 60), null, 2),
    '',
    `Pangea forum (${pangea.items.length} thread titles):`,
    JSON.stringify(pangea.items.slice(0, 30), null, 2),
  ].join('\n');

  // 3. Call the scorer.
  console.log('[research] Scoring with', MODELS.RESEARCH, '...');
  let result;
  try {
    result = await callClaudeJson({
      model: MODELS.RESEARCH,
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 4000,
      stopLabel: 'research-score',
      schemaName: 'propose_topics',
      schemaDescription: 'Emit up to 3 scored blog topics derived from the provided research signals.',
      schema: TOPIC_SCHEMA,
    });
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.log(`[research] ${err.message}`);
      process.exit(0); // soft success; wait for next week
    }
    throw err;
  }

  const proposed = result.data.topics || [];
  console.log(`[research] Scorer rationale: ${result.data.rationale || '(none)'}`);
  console.log(`[research] Proposed ${proposed.length} topics. Cost: $${result.cost.totalUsd.toFixed(4)}`);

  // 4. Filter + merge into queue.
  const knownSlugs = new Set([...publishedSlugs, ...queuedSlugs]);
  const added = [];
  for (const topic of proposed) {
    if (!topic.slug) continue;
    if (knownSlugs.has(topic.slug)) {
      console.log(`[research] Skipping duplicate slug: ${topic.slug}`);
      continue;
    }
    if ((topic.score?.total ?? 0) < MIN_SCORE_TO_KEEP) {
      console.log(`[research] Skipping low-score topic ${topic.slug} (total=${topic.score?.total})`);
      continue;
    }
    queue.topics.push({
      id: `tpc_${now.getTime()}_${topic.slug.replace(/[^a-z0-9]/g, '').slice(0, 10)}`,
      title: topic.title,
      slug: topic.slug,
      category: topic.category,
      status: 'new',
      score: topic.score,
      createdAt: now.toISOString(),
      draftedAt: null,
      publishedAt: null,
      evidence: topic.evidence,
      angleIdeas: topic.angleIdeas,
      rejectionReason: null,
      prUrl: null,
    });
    knownSlugs.add(topic.slug);
    added.push(topic.slug);
  }

  // Cap the queue so we don't accumulate forever.
  if (queue.topics.length > MAX_QUEUE_SIZE) {
    const [keep, drop] = partition(queue.topics, (t) => t.status !== 'rejected');
    queue.topics = keep.slice(-MAX_QUEUE_SIZE).concat(drop.slice(-20));
  }

  writeQueue(queue);
  console.log(`[research] Queue now has ${queue.topics.length} entries. Added this run: ${added.length ? added.join(', ') : '(none)'}.`);

  // 5. Emit a machine-readable summary for the workflow to stash.
  const summary = {
    ranAt: now.toISOString(),
    signals: {
      reddit: reddit.items.length,
      morphmarket: morphmarket.items.length,
      googleAc: googleAc.items.length,
      pangea: pangea.items.length,
      errors: [
        ...(reddit.errors || []),
        ...(morphmarket.error ? [`morphmarket: ${morphmarket.error}`] : []),
        ...(googleAc.error ? [`google-ac: ${googleAc.error}`] : []),
        ...(pangea.error ? [`pangea: ${pangea.error}`] : []),
      ],
    },
    costUsd: result.cost.totalUsd,
    addedSlugs: added,
    rationale: result.data.rationale || null,
  };
  fs.writeFileSync(path.join(REPO_ROOT, 'docs', 'blog-reports', `_latest-research.json`), JSON.stringify(summary, null, 2) + '\n');

  console.log('[research] Done.');
}

function partition(arr, pred) {
  const pass = [];
  const fail = [];
  for (const x of arr) (pred(x) ? pass : fail).push(x);
  return [pass, fail];
}

main().catch((err) => {
  console.error('[research] Fatal:', err);
  process.exit(1);
});
