#!/usr/bin/env node
/**
 * Draft pass ,  runs Mon/Wed/Fri at 07:00 UTC, one hour after research.
 *
 * Flow:
 *   1. Read docs/blog-queue.json. Pick the highest-scored "new" topic.
 *   2. Load the style guide, voice examples, and fact-check corpus.
 *   3. Ask Sonnet 4.6 to write a full draft as a JSON structure the publish
 *      pass can feed into src/data/blog-posts.js. Writer output goes through
 *      a separate self-critique pass before we open a PR.
 *   4. Write the draft markdown + metadata to content/blog-drafts/<slug>/
 *      and update the queue entry to status=drafted.
 *   5. The workflow commits + opens the PR (this script writes files only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODELS, callClaude, callClaudeJson, extractText } from './lib/anthropic.mjs';
import { BudgetExceededError, currentWeekSpend } from './lib/budget.mjs';
import { loadFactCheckCorpus, loadMorphSlugs } from './lib/fact-check.mjs';
import { sanitizeDraft, findResidualDashes } from './lib/sanitize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const QUEUE_PATH = path.join(REPO_ROOT, 'docs', 'blog-queue.json');
const DRAFTS_DIR = path.join(REPO_ROOT, 'content', 'blog-drafts');

function readText(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

function readQueue() {
  return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
}

function writeQueue(queue) {
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

/**
 * Matches the src/data/blog-posts.js object shape. We intentionally keep
 * this schema narrower than the real file ,  publish.mjs fills in
 * datePublished, tags, hero metadata, and JSON-LD wiring from the draft
 * output plus sensible defaults.
 */
const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'description', 'keyphrase', 'category', 'heroEyebrow', 'tldr', 'markdown', 'faq', 'internalLinks', 'externalCitations', 'selfCritique'],
  properties: {
    slug:        { type: 'string', pattern: '^[a-z0-9-]+$' },
    title:       { type: 'string', maxLength: 75, description: 'Under 60 chars if possible. Contains keyphrase.' },
    description: { type: 'string', minLength: 120, maxLength: 180, description: 'Meta description. 140-160 chars ideal. Contains keyphrase.' },
    keyphrase:   { type: 'string', description: 'Primary search keyphrase the post targets.' },
    category:    { type: 'string', enum: ['genetics', 'breeding', 'mythbusters', 'identification'] },
    heroEyebrow: { type: 'string', description: 'Short eyebrow line shown above the title.' },
    tldr: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string' },
      description: 'Bullet-sized TL;DR items. These drive LLM citations.',
    },
    markdown: {
      type: 'string',
      minLength: 3000,
      description: 'The full post body as GitHub-flavored markdown (no frontmatter). Follows the style guide ,  hook paragraph, subsections, opinionated section, practical takeaways, callback. Publish pass converts this into the block structure used by src/data/blog-posts.js.',
    },
    faq: {
      type: 'array',
      minItems: 4,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer'],
        properties: {
          question: { type: 'string' },
          answer:   { type: 'string', maxLength: 600 },
        },
      },
    },
    internalLinks: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['href', 'label'],
        properties: {
          href:  { type: 'string', pattern: '^/[A-Za-z0-9/_-]+$', description: 'Relative path to an existing page like /MorphGuide/lilly-white' },
          label: { type: 'string' },
        },
      },
    },
    externalCitations: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'label'],
        properties: {
          url:   { type: 'string', pattern: '^https?://' },
          label: { type: 'string' },
        },
      },
    },
    selfCritique: {
      type: 'string',
      minLength: 200,
      description: 'Honest self-review: what\'s weakest about this draft, which claims the reviewer should fact-check hardest, and which style-guide rules you struggled with. Read by the human reviewer on the PR.',
    },
  },
};

function pickTopic(queue) {
  const candidates = queue.topics
    .filter((t) => t.status === 'new' || t.status === 'scheduled')
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
  return candidates[0] || null;
}

function buildWriterSystem({ styleGuide, voiceExamples, factCheck, knownMorphs }) {
  // Order matters for caching: styleGuide + voiceExamples + factCheck are
  // stable across runs (cached), the per-topic brief gets appended via
  // `messages` so it does not invalidate the cache.
  return [
    {
      type: 'text',
      text: [
        'You are the writer agent for the Geck Inspect blog pipeline.',
        '',
        'You produce draft blog posts for experienced crested gecko breeders.',
        'Always follow the style guide and voice examples provided below.',
        'Every genetics claim must be grounded in the fact-check corpus.',
        '',
        'You write opinionated, specific, well-researched posts. Not SEO fluff.',
        '',
        'HARD PUNCTUATION RULE: do not use em dashes (—) or en dashes (–) anywhere.',
        'Do not substitute "--" for them either. When a sentence wants to pause, use a',
        'comma, a period, parentheses, or a colon. This rule applies to titles,',
        'descriptions, TLDR bullets, body markdown, FAQ entries, and selfCritique.',
        'Hyphens in compound words (crested-gecko-first, well-known) are fine.',
        '',
        'Output format: call the write_draft tool with the full structured draft.',
      ].join('\n'),
    },
    { type: 'text', text: '# STYLE GUIDE\n\n' + styleGuide },
    { type: 'text', text: '# VOICE EXAMPLES\n\n' + voiceExamples },
    { type: 'text', text: factCheck },
    {
      type: 'text',
      text: [
        '# ALLOWED MORPH SLUGS',
        'When linking internally to /MorphGuide/<slug>, use one of these:',
        knownMorphs.map((m) => `  - ${m.slug} ,  ${m.name} (${m.inheritance})`).join('\n'),
        '',
        'Acceptable internal link paths:',
        '  /MorphGuide                        ,  morph catalogue index',
        '  /MorphGuide/<slug>                 ,  specific morph detail',
        '  /MorphGuide/category/<id>          ,  category hub (base|color|pattern|structure|combo)',
        '  /MorphGuide/inheritance/<id>       ,  inheritance hub (recessive|incomplete-dominant|...)',
        '  /GeneticsGuide                     ,  long-form genetics encyclopedia',
        '  /GeneticCalculatorTool             ,  Punnett calculator',
        '  /CareGuide, /CareGuide/<topic>     ,  care guide',
        '  /MorphVisualizer                   ,  visual morph simulator',
        '  /blog/<slug>                       ,  other blog posts',
      ].join('\n'),
    },
  ];
}

async function main() {
  console.log(`[draft] Starting at ${new Date().toISOString()}`);

  const spend = currentWeekSpend();
  console.log(`[draft] Budget: $${spend.usd.toFixed(4)} / $${spend.capUsd.toFixed(2)} used (${spend.weekKey})`);

  const queue = readQueue();
  const topic = pickTopic(queue);
  if (!topic) {
    console.log('[draft] No eligible topic in queue. Nothing to do. Exiting cleanly.');
    process.exit(0);
  }

  console.log(`[draft] Picked topic: ${topic.slug} (score ${topic.score?.total}). Category: ${topic.category}`);

  const styleGuide = readText('docs/blog-style-guide.md');
  const voiceExamples = readText('docs/blog-voice-examples.md');
  const { text: factCheck, sources: factSources } = loadFactCheckCorpus();
  const knownMorphs = loadMorphSlugs();
  const system = buildWriterSystem({ styleGuide, voiceExamples, factCheck, knownMorphs });

  const brief = [
    'Write the next Geck Inspect blog post.',
    '',
    `Topic:       ${topic.title}`,
    `Slug:        ${topic.slug}`,
    `Category:    ${topic.category}`,
    '',
    'Evidence gathered by the research agent:',
    ...topic.evidence.map((e) => `  [${e.source}] ${e.snippet}${e.url ? ` (${e.url})` : ''}`),
    '',
    'Candidate angles the research agent proposed (pick one or invent a better one):',
    ...topic.angleIdeas.map((a, i) => `  ${i + 1}. ${a}`),
    '',
    'Target length: 1,500-2,200 words (standard post). Only go longer if the topic genuinely needs it and you can sustain quality.',
    '',
    'Ground every genetic claim in the fact-check corpus. If the corpus does not support a claim, cut the claim or caveat it clearly. Prefer the canonical morph-guide.js and genetics-sections.jsx over forum consensus; prefer the Foundation Genetics module over everything else (when available).',
    '',
    'Emit via the write_draft tool.',
  ].join('\n');

  let draft;
  try {
    const result = await callClaudeJson({
      model: MODELS.DRAFT,
      system,
      messages: [{ role: 'user', content: brief }],
      maxTokens: 16000,
      stopLabel: 'draft-write',
      schemaName: 'write_draft',
      schemaDescription: 'Emit the full structured blog post draft.',
      schema: DRAFT_SCHEMA,
    });
    draft = result.data;
    console.log(`[draft] Writer cost: $${result.cost.totalUsd.toFixed(4)} (cache read ${result.cost.cacheReadTokens} / write ${result.cost.cacheWriteTokens} tokens)`);

    // Hard rule from CLAUDE.md: no em dashes anywhere. Strip and verify.
    // We do this BEFORE the critique pass so the critique sees the final
    // text the reader will see.
    draft = sanitizeDraft(draft);
    const residuals = findResidualDashes(draft);
    if (residuals.length > 0) {
      console.error('[draft] Sanitizer left residual dashes; failing run:', residuals);
      process.exit(1);
    }
    console.log('[draft] Dash sanitization OK (zero residuals).');
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.log(`[draft] ${err.message}`);
      process.exit(0);
    }
    throw err;
  }

  // Light self-review pass: does the draft violate any forbidden patterns
  // from the style guide, and does anything look unsupported by the
  // fact-check corpus?
  console.log('[draft] Running self-critique pass...');
  const critiqueSystem = [
    { type: 'text', text: 'You are the review agent for the Geck Inspect blog pipeline. Review the draft against the style guide and fact-check corpus and return specific concerns.' },
    { type: 'text', text: '# STYLE GUIDE\n\n' + styleGuide },
    { type: 'text', text: factCheck },
  ];
  const critiquePrompt = `Here is the draft to review.\n\nTitle: ${draft.title}\n\nMarkdown:\n${draft.markdown}\n\nEmit a plain-text critique covering (a) forbidden-pattern violations, (b) claims not supported by the fact-check corpus, (c) readability concerns. Be specific with line quotes. Keep it under 600 words.`;
  let critiqueText = '';
  try {
    const critiqueResp = await callClaude({
      model: MODELS.REVIEW,
      system: critiqueSystem,
      messages: [{ role: 'user', content: critiquePrompt }],
      maxTokens: 2000,
      stopLabel: 'draft-critique',
    });
    critiqueText = extractText(critiqueResp.content);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      critiqueText = '(skipped ,  weekly budget exhausted before critique pass)';
    } else {
      critiqueText = `(critique pass failed: ${err.message})`;
    }
  }

  // Persist draft files.
  const draftDir = path.join(DRAFTS_DIR, draft.slug);
  fs.mkdirSync(draftDir, { recursive: true });
  fs.writeFileSync(path.join(draftDir, 'post.md'), draft.markdown + '\n');
  fs.writeFileSync(
    path.join(draftDir, 'metadata.json'),
    JSON.stringify({
      slug: draft.slug,
      title: draft.title,
      description: draft.description,
      keyphrase: draft.keyphrase,
      category: draft.category,
      heroEyebrow: draft.heroEyebrow,
      tldr: draft.tldr,
      faq: draft.faq,
      internalLinks: draft.internalLinks,
      externalCitations: draft.externalCitations,
      topicId: topic.id,
      originalQueueEntry: topic,
      factSources: factSources.map((s) => ({ label: s.label, path: s.path, bytes: s.bytes })),
      generatedAt: new Date().toISOString(),
    }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(draftDir, 'self-critique.md'), draft.selfCritique + '\n\n---\n\n## Automated reviewer notes\n\n' + critiqueText + '\n');

  // Update queue state.
  const entry = queue.topics.find((t) => t.id === topic.id);
  if (entry) {
    entry.status = 'drafted';
    entry.draftedAt = new Date().toISOString();
  }
  writeQueue(queue);

  // Hint file for the workflow to know which branch/PR to open.
  fs.writeFileSync(
    path.join(REPO_ROOT, 'docs', 'blog-reports', '_latest-draft.json'),
    JSON.stringify({
      slug: draft.slug,
      title: draft.title,
      draftDir: path.relative(REPO_ROOT, draftDir),
      draftedAt: new Date().toISOString(),
    }, null, 2) + '\n',
  );

  console.log(`[draft] Draft written to ${path.relative(REPO_ROOT, draftDir)}/`);
  console.log('[draft] Done.');
}

main().catch((err) => {
  console.error('[draft] Fatal:', err);
  process.exit(1);
});
