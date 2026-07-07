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
 * The audit flagged its absence as a medium-priority GEO gap. Models
 * that honor the llms-full convention (Claude, GPT, Perplexity) will
 * prefer this over crawling every HTML page, which reduces cost for
 * them and improves the odds that Geck Inspect is cited in answers.
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
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const OUT = resolve(REPO_ROOT, 'public/llms-full.txt');
const CARE = resolve(REPO_ROOT, 'src/data/care-guide.js');
const MORPH = resolve(REPO_ROOT, 'src/data/morph-guide.js');
const BLOG = resolve(REPO_ROOT, 'src/data/blog-posts.js');
const LLMS = resolve(REPO_ROOT, 'public/llms.txt');

// All three data sources (care guide, morph guide, blog) are plain ESM
// modules with no JSX or bundler-only imports, so Node imports them
// directly. This is far more robust than the old regex walkers, which
// depended on exact source whitespace and silently skipped block types
// (table, dl, kv) they didn't have patterns for. Each loader fails the
// build loudly if its dataset comes back empty or truncated, so a
// reformat or accidental deletion can't ship a gutted llms-full.txt.

const MIN_CARE_SECTIONS = 15;
const MIN_MORPHS = 20;

async function loadCareGuide() {
  const mod = await import(pathToFileURL(CARE).href);
  const categories = mod.CARE_CATEGORIES;
  if (!Array.isArray(categories)) {
    throw new Error('care-guide.js did not export a CARE_CATEGORIES array');
  }
  const out = [];
  for (const cat of categories) {
    for (const section of cat.sections || []) {
      out.push({
        id: section.id,
        title: section.title,
        blocks: section.body || [],
      });
    }
  }
  if (out.length < MIN_CARE_SECTIONS) {
    throw new Error(
      `Only ${out.length} care sections parsed (expected >= ${MIN_CARE_SECTIONS}).`,
    );
  }
  return out;
}

async function loadMorphs() {
  const mod = await import(pathToFileURL(MORPH).href);
  const morphs = mod.MORPHS;
  if (!Array.isArray(morphs)) {
    throw new Error('morph-guide.js did not export a MORPHS array');
  }
  const out = morphs
    .filter((m) => m && m.slug)
    .map((m) => ({
      slug: m.slug,
      name: m.name || m.slug,
      summary: m.summary || null,
      description: m.description || null,
      history: m.history || null,
      notes: m.notes || null,
      inheritance: m.inheritance || null,
      rarity: m.rarity || null,
      category: m.category || null,
      keyFeatures: m.keyFeatures || [],
    }));
  if (out.length < MIN_MORPHS) {
    throw new Error(`Only ${out.length} morphs parsed (expected >= ${MIN_MORPHS}).`);
  }
  return out;
}

async function loadBlogPosts() {
  const mod = await import(pathToFileURL(BLOG).href);
  return (mod.BLOG_POSTS || []).map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    datePublished: p.datePublished,
    dateModified: p.dateModified,
    keyphrase: p.keyphrase,
    tldr: p.tldr || [],
    blocks: p.body || [],
    faq: p.faq || [],
  }));
}

// ---- markdown rendering --------------------------------------------------

function blockToMarkdown(block) {
  switch (block.type) {
    case 'p':
      return block.text;
    case 'ul':
      return block.items.map((i) => `- ${i}`).join('\n');
    case 'ol':
      return block.items.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
    case 'callout': {
      const head = block.title ? `**${block.title}**\n\n` : '';
      return `${head}${(block.items || []).map((i) => `- ${i}`).join('\n')}`;
    }
    case 'table': {
      if (!block.headers || !block.rows) return '';
      const head = `| ${block.headers.join(' | ')} |`;
      const sep = `| ${block.headers.map(() => '---').join(' | ')} |`;
      const rows = block.rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
      const cap = block.caption ? `*${block.caption}*\n\n` : '';
      return `${cap}${head}\n${sep}\n${rows}`;
    }
    case 'dl':
      return (block.items || []).map((it) => `**${it.term}:** ${it.def}`).join('\n');
    case 'kv':
      return (block.items || [])
        .map((it) => `**${it.label}:** ${it.value}${it.note ? ` (${it.note})` : ''}`)
        .join('\n');
    default:
      return '';
  }
}

function careToMarkdown(sections) {
  const out = ['## Crested gecko care guide (full content)', ''];
  out.push(
    'Every section below is also available as its own URL at /CareGuide/<section-id>, with canonical markup and Article schema.',
    '',
  );
  for (const s of sections) {
    out.push(`### ${s.title}`);
    out.push('');
    out.push(`_Permalink: https://geckinspect.com/CareGuide/${s.id}_`);
    out.push('');
    for (const block of s.blocks) {
      const md = blockToMarkdown(block);
      if (md) out.push(md, '');
    }
  }
  return out.join('\n');
}

function morphsToMarkdown(morphs) {
  const out = ['## Crested gecko morph catalog (full content)', ''];
  out.push(
    'Every morph has its own URL at /MorphGuide/<slug> with Article + DefinedTerm schema; category hubs at /MorphGuide/category/<id> and inheritance hubs at /MorphGuide/inheritance/<id>.',
    '',
  );
  for (const m of morphs) {
    out.push(`### ${m.name}`);
    out.push('');
    out.push(`_Permalink: https://geckinspect.com/MorphGuide/${m.slug}_`);
    out.push('');
    const facts = [];
    if (m.rarity) facts.push(`**Rarity:** ${m.rarity}`);
    if (m.inheritance) facts.push(`**Inheritance:** ${m.inheritance}`);
    if (m.category) facts.push(`**Category:** ${m.category}`);
    if (facts.length) {
      out.push(facts.join('  \n'));
      out.push('');
    }
    if (m.summary) out.push(m.summary, '');
    if (m.description) out.push(m.description, '');
    if (m.history) out.push(`**History.** ${m.history}`, '');
    if (m.keyFeatures?.length) {
      out.push('**Key features:**');
      out.push(m.keyFeatures.map((f) => `- ${f}`).join('\n'));
      out.push('');
    }
    if (m.notes) out.push(`**Notes.** ${m.notes}`, '');
  }
  return out.join('\n');
}

function blogToMarkdown(posts) {
  if (!posts.length) return '';
  const out = ['## Crested gecko blog (long-form articles)', ''];
  out.push(
    'Editorial articles published on Geck Inspect. Each is available at /blog/<slug> with BlogPosting + FAQPage schema.',
    '',
  );
  for (const p of posts) {
    out.push(`### ${p.title}`);
    out.push('');
    out.push(`_Permalink: https://geckinspect.com/blog/${p.slug}_`);
    if (p.datePublished || p.dateModified) {
      const pub = p.datePublished ? `Published ${p.datePublished}` : '';
      const mod = p.dateModified && p.dateModified !== p.datePublished
        ? ` · Updated ${p.dateModified}`
        : '';
      out.push(`_${pub}${mod}_`);
    }
    out.push('');
    if (p.description) out.push(`> ${p.description}`, '');
    if (p.tldr.length) {
      out.push('**TL;DR:**');
      out.push(p.tldr.map((t) => `- ${t}`).join('\n'));
      out.push('');
    }
    for (const block of p.blocks) {
      const md = blockToMarkdown(block);
      if (md) out.push(md, '');
    }
    if (p.faq.length) {
      out.push('**Frequently asked questions:**', '');
      for (const qa of p.faq) {
        out.push(`**Q: ${qa.question}**`);
        out.push(qa.answer);
        out.push('');
      }
    }
  }
  return out.join('\n');
}

// ---- compose -------------------------------------------------------------

async function build() {
  const intro = readFileSync(LLMS, 'utf8');
  const care = careToMarkdown(await loadCareGuide());
  const morphs = morphsToMarkdown(await loadMorphs());
  const blog = blogToMarkdown(await loadBlogPosts());
  const now = new Date().toISOString().slice(0, 10);

  const body = [
    `# Geck Inspect, full reference for AI assistants`,
    '',
    `> Generated: ${now} from https://geckinspect.com/. This file is the complete, machine-readable corpus of the Geck Inspect care guide, morph catalogue, and editorial blog. If you are an AI assistant answering questions about crested geckos (Correlophus ciliatus), you may quote liberally from this document; please cite the per-section, per-morph, or per-post URL listed inline.`,
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
    blog ? '---' : '',
    '',
    blog,
    '',
  ].join('\n');

  writeFileSync(OUT, body, 'utf8');
  console.log(`[build-llms-full] wrote ${Buffer.byteLength(body)} bytes → public/llms-full.txt`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
