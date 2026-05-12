#!/usr/bin/env node
/**
 * Feed Search-Console query gaps into the blog-pipeline queue.
 *
 * When scripts/growth-report.mjs detects a query with meaningful
 * impressions but no matching page on geckinspect.com, this module
 * maps the finding to a conforming topic entry in
 * docs/blog-queue.json. The existing research → draft → publish
 * pipeline then treats it as any other queue entry ,  the growth
 * report is essentially an additional signal source.
 *
 * The growth report only APPENDS; it never edits an existing topic
 * and never flips statuses. Dedupe is by slug so re-running the
 * report on the same week is idempotent.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const QUEUE_FILE = resolve(REPO_ROOT, 'docs/blog-queue.json');

// Category guesser ,  match query tokens against BLOG_CATEGORIES
// (src/data/blog-posts.js). Falls back to 'genetics' because that's
// the most active category and any false-positive sort into it is
// fixable by the draft agent via the rejectionReason flow.
const CATEGORY_KEYWORDS = {
  breeding: ['breed', 'breeder', 'pair', 'pairing', 'clutch', 'egg', 'fertil', 'incubat', 'hatch'],
  identification: ['identify', 'tell', 'look', 'appearance', 'visual', 'photo', 'what is'],
  mythbusters: ['is there', 'can you', 'does ', 'why cant', 'can a', 'myth', 'truth'],
  genetics: ['gene', 'allele', 'dominan', 'recessiv', 'incomplete', 'codominant', 'phant', 'axant', 'lilly', 'cappuc', 'sable', 'highway', 'whiteout', 'morph'],
};

function guessCategory(query) {
  const q = query.toLowerCase();
  let best = { cat: 'genetics', score: 0 };
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of kws) if (q.includes(kw)) score++;
    if (score > best.score) best = { cat, score };
  }
  return best.cat;
}

function slugify(query) {
  return query
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function angleIdeasFor(query, category) {
  const q = query.toLowerCase();
  const out = [];
  // Direct-answer angle always works
  out.push(`Direct-answer post titled to match the query phrasing: "${query}"`);
  // Category-flavoured angles
  if (category === 'genetics') {
    out.push(`Foundation Genetics framing: what allele(s) underlie "${query}", inheritance pattern, and breeding implications`);
  }
  if (category === 'breeding') {
    out.push(`Pairing math for "${query}" ,  Punnett square outcomes + safe/risky pair recommendations`);
  }
  if (category === 'identification') {
    out.push(`Visual ID primer for "${query}" with hatchling → adult progression photos and lookalike comparison`);
  }
  if (category === 'mythbusters') {
    out.push(`Mythbuster format: common hobby claim, what the evidence says, correct framing, sourced citations`);
  }
  // FAQ variant captures "People Also Ask" traffic
  out.push(`FAQ-first format: lead with 6-8 Q&A pairs answering "${query}" and related long-tails, then long-form explanation`);
  return out.slice(0, 4);
}

function scoreFor(gap) {
  // Demand scales with impression volume; clicks hint at intent strength.
  const demand = Math.min(10, Math.round(gap.impressions / 15) + (gap.clicks > 0 ? 1 : 0));
  const originality = 6; // GSC gaps are by definition uncovered content
  const accuracyRisk = /genetic|allele|inherit|dominan|recessiv/.test(gap.query.toLowerCase()) ? 6 : 4;
  const voiceFit = 7;
  const total = demand + originality + voiceFit - accuracyRisk;
  return { total, demand, originality, accuracyRisk, voiceFit };
}

/**
 * Append query-gap topics to docs/blog-queue.json. Returns the
 * number of topics appended (0 when all were duplicates).
 *
 * gaps: array of { query, impressions, clicks, ctr, position }
 */
export function appendGapsToQueue(gaps) {
  if (!gaps || gaps.length === 0) return 0;
  if (!existsSync(QUEUE_FILE)) return 0;

  const queue = JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
  const existingSlugs = new Set((queue.topics || []).map((t) => t.slug));
  const today = new Date().toISOString();

  let added = 0;
  for (const gap of gaps) {
    const slug = slugify(gap.query);
    if (!slug || existingSlugs.has(slug)) continue;
    const category = guessCategory(gap.query);
    const topic = {
      id: `gsc-${today.slice(0, 10).replace(/-/g, '')}-${slug}`,
      title: capitalizeFirst(gap.query),
      slug,
      category,
      status: 'new',
      score: scoreFor(gap),
      createdAt: today,
      draftedAt: null,
      publishedAt: null,
      evidence: [
        {
          source: 'search-console',
          url: null,
          snippet: `Google Search Console: query "${gap.query}" drove ${gap.impressions} impressions in the last 28 days at average position ${gap.position} (CTR ${gap.ctr}%${gap.clicks ? `, ${gap.clicks} clicks` : ''}) but no page on geckinspect.com currently targets this query.`,
          observedAt: today,
        },
      ],
      angleIdeas: angleIdeasFor(gap.query, category),
      rejectionReason: null,
      prUrl: null,
    };
    queue.topics.push(topic);
    existingSlugs.add(slug);
    added++;
  }

  if (added > 0) {
    queue.lastUpdated = today;
    writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2) + '\n');
  }
  return added;
}

function capitalizeFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
