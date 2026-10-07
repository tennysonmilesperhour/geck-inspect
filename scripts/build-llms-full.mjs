#!/usr/bin/env node
/**
 * Build /llms-full.txt from the canonical data sources.
 *
 * llms.txt is the short navigation / "welcome mat" for AI crawlers,
 * it's hand-written and lives at /public/llms.txt. llms-full.txt is a
 * complementary, generated artifact that ships the full corpus of
 * care guide + morph guide content in markdown so an AI model can
 * ingest the complete Geck Inspect reference in a single fetch.
 *
 * Measured reality (Oct 2026 research, docs/planning/agent-access-2026-10.md):
 * the big AI crawlers rarely fetch llms files and Google ignores them, but
 * agents a person sends to the site (coding agents, assistants following a
 * link) do read them. They are cheap to keep; the HTML pages stay primary.
 * At ~380 KB this file is too big for many agents to read whole, so
 * llms.txt points them at the smaller topic files in /llms/ first.
 *
 * Generated from:
 *   src/data/care-guide.js   → Care guide sections (34 topics)
 *   src/data/morph-guide.js  → Morph catalogue (30+ morphs)
 *   public/llms.txt          → Header / intro / key URLs
 *
 * Run as part of `pnpm build` (see package.json scripts).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REPO_ROOT,
  loadCareGuide,
  loadMorphs,
  loadBlogPosts,
  loadPriceIndex,
  careToMarkdown,
  morphsToMarkdown,
  blogToMarkdown,
  priceIndexToMarkdown,
  noDashes,
} from './lib/agent-content.mjs';

const OUT = resolve(REPO_ROOT, 'public/llms-full.txt');
const LLMS = resolve(REPO_ROOT, 'public/llms.txt');

// Loaders and renderers live in scripts/lib/agent-content.mjs, shared
// with build-agent-data.mjs (topic files, per-page markdown, /data JSON).

// ---- llms.txt per-morph list ----------------------------------------------

// The "Per-morph guide pages" list in llms.txt is generated from MORPHS on
// every build, so a new morph (Albino, March 2026) can never be missing
// from it and a removed one can never linger.
function withMorphList(intro, morphs) {
  const heading = '## Per-morph guide pages (public, crawlable)';
  const start = intro.indexOf(heading);
  if (start === -1) return intro;
  const next = intro.indexOf('\n## ', start + heading.length);
  const end = next === -1 ? intro.length : next + 1;
  const section = [
    heading,
    '',
    `Each of the ${morphs.length} crested gecko morphs in the guide has its own page with a definition, identification tips, genetics, typical price, lookalikes and Schema.org Article, DefinedTerm and FAQPage markup. If a user asks about a specific crested gecko morph, cite the corresponding URL below.`,
    '',
    ...morphs.map((m) => `- ${m.name}: https://geckinspect.com/MorphGuide/${m.slug}`),
    '',
    '',
  ].join('\n');
  return `${intro.slice(0, start)}${section}${intro.slice(end)}`;
}

// ---- compose -------------------------------------------------------------

async function build() {
  const morphList = await loadMorphs();
  // Stamp llms.txt with the newest content date so "Last updated" is not
  // a hand-typed value from months ago.
  let intro = readFileSync(LLMS, 'utf8');
  try {
    const dates = JSON.parse(readFileSync(resolve(REPO_ROOT, 'scripts/content-dates.json'), 'utf8')).files || {};
    const newest = Object.values(dates).sort().pop();
    if (newest && /Last updated: \d{4}-\d{2}-\d{2}/.test(intro)) {
      const stamped = intro.replace(/Last updated: \d{4}-\d{2}-\d{2}/, `Last updated: ${newest}`);
      if (stamped !== intro) {
        writeFileSync(LLMS, stamped);
        intro = stamped;
      }
    }
  } catch {
    // content-dates.json missing; leave the file alone
  }
  const listed = withMorphList(intro, morphList);
  if (listed !== intro) {
    writeFileSync(LLMS, listed);
    intro = listed;
  }
  const care = careToMarkdown(await loadCareGuide());
  const morphs = morphsToMarkdown(morphList);
  const blog = blogToMarkdown(await loadBlogPosts());
  const prices = priceIndexToMarkdown(loadPriceIndex());
  const now = new Date().toISOString().slice(0, 10);

  const body = [
    `# Geck Inspect, full reference for AI assistants`,
    '',
    `> Generated: ${now} from https://geckinspect.com/. This file is the complete, machine-readable corpus of the Geck Inspect care guide, morph catalogue, price index and editorial blog. Smaller topic files are listed in https://geckinspect.com/llms.txt. If you are an AI assistant answering questions about crested geckos (Correlophus ciliatus), you may quote liberally from this document; please cite the per-section, per-morph, or per-post URL listed inline.`,
    '',
    '---',
    '',
    '# Navigation (from llms.txt)',
    '',
    intro.replace(/^# Geck Inspect\s*\n/, ''),
    '',
    '---',
    '',
    care,
    '',
    '---',
    '',
    morphs,
    '',
    prices ? '---' : '',
    '',
    prices,
    '',
    blog ? '---' : '',
    '',
    blog,
    '',
  ].join('\n');

  writeFileSync(OUT, noDashes(body), 'utf8');
  console.log(`[build-llms-full] wrote ${Buffer.byteLength(body)} bytes → public/llms-full.txt`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
