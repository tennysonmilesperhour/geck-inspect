#!/usr/bin/env node
/**
 * Build /llms-full.txt from the canonical data sources.
 *
 * llms.txt is the short navigation / "welcome mat" for AI crawlers —
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
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const OUT = resolve(REPO_ROOT, 'public/llms-full.txt');
const CARE = resolve(REPO_ROOT, 'src/data/care-guide.js');
const MORPH = resolve(REPO_ROOT, 'src/data/morph-guide.js');
const BLOG = resolve(REPO_ROOT, 'src/data/blog-posts.js');
const LLMS = resolve(REPO_ROOT, 'public/llms.txt');

// ---- care guide parsing --------------------------------------------------

/**
 * The care-guide data is a large exported array of category objects;
 * each category has `sections`, each section has a `body` array of
 * block objects. We parse the JS source with a tolerant regex walker.
 */
function parseCareGuide() {
  const src = readFileSync(CARE, 'utf8');
  const out = [];
  // Grab each section block: id, title, level, body literal.
  const re =
    /\n\s{6}\{\s*\n\s{8}id:\s*'([a-z0-9-]+)',\s*\n\s{8}title:\s*'([^']+)',[\s\S]*?body:\s*\[([\s\S]*?)\n\s{8}\],\s*\n\s{6}\},/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const id = m[1];
    const title = m[2];
    const bodySrc = m[3];
    out.push({ id, title, blocks: parseBlocks(bodySrc) });
  }
  return out;
}

function parseBlocks(bodySrc) {
  // Paragraphs: { type: 'p', text: '…' }
  const blocks = [];
  const pRe = /type:\s*'p',\s*\n\s*text:\s*'((?:\\.|[^'\\])*)'/g;
  let m;
  while ((m = pRe.exec(bodySrc)) !== null) {
    blocks.push({ type: 'p', text: unescape(m[1]) });
  }
  // Unordered lists (items: [ '...', ... ])
  const ulRe = /type:\s*'ul',\s*\n\s*items:\s*\[([\s\S]*?)\n\s*\],/g;
  while ((m = ulRe.exec(bodySrc)) !== null) {
    blocks.push({ type: 'ul', items: extractStringArray(m[1]) });
  }
  const olRe = /type:\s*'ol',\s*\n\s*items:\s*\[([\s\S]*?)\n\s*\],/g;
  while ((m = olRe.exec(bodySrc)) !== null) {
    blocks.push({ type: 'ol', items: extractStringArray(m[1]) });
  }
  const calloutRe =
    /type:\s*'callout',[\s\S]*?(?:title:\s*'([^']*)',)?[\s\S]*?items:\s*\[([\s\S]*?)\n\s*\],/g;
  while ((m = calloutRe.exec(bodySrc)) !== null) {
    blocks.push({ type: 'callout', title: m[1] || null, items: extractStringArray(m[2]) });
  }
  return blocks;
}

function extractStringArray(src) {
  const out = [];
  const re = /'((?:\\.|[^'\\])*)'/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push(unescape(m[1]));
  return out;
}

function unescape(s) {
  return s.replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

// ---- morph guide parsing -------------------------------------------------

function parseMorphs() {
  const src = readFileSync(MORPH, 'utf8');
  const m = src.match(/export const MORPHS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('MORPHS not found');
  const body = m[1];
  const entries = body.split(/\n\s{2}\},\s*\n\s{2}\{/).map((c, i, arr) => {
    let x = c;
    if (i === 0) x = x.replace(/^\s*\{\s*/, '');
    if (i === arr.length - 1) x = x.replace(/\s*\}\s*$/, '');
    return x;
  });
  const out = [];
  for (const chunk of entries) {
    const gs = (f) => {
      const re = new RegExp(`${f}:\\s*'((?:\\\\.|[^'\\\\])*)'`, 's');
      const hit = chunk.match(re);
      return hit ? unescape(hit[1]) : null;
    };
    const slug = gs('slug');
    if (!slug) continue;
    const keyFeaturesMatch = chunk.match(/keyFeatures:\s*\[([\s\S]*?)\]/);
    out.push({
      slug,
      name: gs('name') || slug,
      summary: gs('summary'),
      description: gs('description'),
      history: gs('history'),
      notes: gs('notes'),
      inheritance: gs('inheritance'),
      rarity: gs('rarity'),
      category: gs('category'),
      keyFeatures: keyFeaturesMatch ? extractStringArray(keyFeaturesMatch[1]) : [],
    });
  }
  return out;
}

// ---- blog parsing --------------------------------------------------------

function parseBlogPosts() {
  const src = readFileSync(BLOG, 'utf8');
  const m = src.match(/export const BLOG_POSTS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) return [];
  const body = m[1];
  const entries = body.split(/\n\s{2}\},\s*\n\s{2}\{/).map((c, i, arr) => {
    let x = c;
    if (i === 0) x = x.replace(/^\s*\{\s*/, '');
    if (i === arr.length - 1) x = x.replace(/\s*\}\s*,?\s*$/, '');
    return x;
  });
  const out = [];
  for (const chunk of entries) {
    const gs = (f) => {
      const re = new RegExp(`${f}:\\s*'((?:\\\\.|[^'\\\\])*)'`, 's');
      const hit = chunk.match(re);
      return hit ? unescape(hit[1]) : null;
    };
    const slug = gs('slug');
    if (!slug) continue;
    const tldrMatch = chunk.match(/tldr:\s*\[([\s\S]*?)\n\s*\],/);
    const bodyMatch = chunk.match(/body:\s*\[([\s\S]*?)\n\s{4}\],/);
    const faqMatch = chunk.match(/faq:\s*\[([\s\S]*?)\n\s{4}\],/);

    const tldr = tldrMatch ? extractStringArray(tldrMatch[1]) : [];
    const blocks = bodyMatch ? parseBlocks(bodyMatch[1]) : [];

    const faq = [];
    if (faqMatch) {
      const qaRe =
        /question:\s*'((?:\\.|[^'\\])*)',\s*\n\s*answer:\s*\n?\s*'((?:\\.|[^'\\])*)'/g;
      let q;
      while ((q = qaRe.exec(faqMatch[1])) !== null) {
        faq.push({ question: unescape(q[1]), answer: unescape(q[2]) });
      }
    }

    out.push({
      slug,
      title: gs('title'),
      description: gs('description'),
      datePublished: gs('datePublished'),
      dateModified: gs('dateModified'),
      keyphrase: gs('keyphrase'),
      tldr,
      blocks,
      faq,
    });
  }
  return out;
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
      return `${head}${block.items.map((i) => `- ${i}`).join('\n')}`;
    }
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

function build() {
  const intro = readFileSync(LLMS, 'utf8');
  const care = careToMarkdown(parseCareGuide());
  const morphs = morphsToMarkdown(parseMorphs());
  const blog = blogToMarkdown(parseBlogPosts());
  const now = new Date().toISOString().slice(0, 10);

  const body = [
    `# Geck Inspect — full reference for AI assistants`,
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

build();
