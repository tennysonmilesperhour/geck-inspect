#!/usr/bin/env node
/**
 * Publish pass ,  runs after a blog-draft PR is merged.
 *
 * Flow:
 *   1. Read content/blog-drafts/<slug>/{post.md, metadata.json}.
 *   2. Convert the markdown body into the block structure used by
 *      src/data/blog-posts.js (paragraphs, lists, tables, callouts).
 *   3. Append a new object literal to the BLOG_POSTS array by locating the
 *      closing bracket with a tolerant regex (not a full JS parser ,  the
 *      file is append-only and well-formatted). Writes a trailing comma
 *      on the previous entry if it's missing.
 *   4. Delete the content/blog-drafts/<slug>/ directory.
 *   5. Update docs/blog-queue.json: topic.status = 'published', publishedAt set.
 *   6. The workflow commits + pushes.
 *
 * Block discriminator reference (from src/data/blog-posts.js header):
 *   { type: 'p', text }
 *   { type: 'ul', items: [string] }
 *   { type: 'ol', items: [string] }
 *   { type: 'dl', items: [{ term, def }] }
 *   { type: 'callout', tone: 'info'|'warn'|'success'|'danger', title?, items: [string] }
 *   { type: 'table', headers: [string], rows: [[string]], caption? }
 *   { type: 'kv', items: [{ label, value, note? }] }
 *
 * Usage: node scripts/blog/publish.mjs <slug>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeDraft, findResidualDashes } from './lib/sanitize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const QUEUE_PATH = path.join(REPO_ROOT, 'docs', 'blog-queue.json');
const BLOG_POSTS_PATH = path.join(REPO_ROOT, 'src', 'data', 'blog-posts.js');
const DRAFTS_DIR = path.join(REPO_ROOT, 'content', 'blog-drafts');

function parseMarkdownIntoBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];

  // Helpers to flush accumulated state.
  let para = [];
  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ type: 'p', text: para.join(' ').trim() });
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Heading: H2 becomes the conventional "section header" blocks.
    // blog-posts.js doesn't have an explicit h2 block type ,  the existing
    // renderer expects a paragraph with a bolded heading, so we use a
    // callout:tone=info with just a title, which renders cleanly.
    if (/^##\s+/.test(trimmed)) {
      flushPara();
      const title = trimmed.replace(/^##\s+/, '').trim();
      blocks.push({ type: 'callout', tone: 'info', title });
      i++;
      continue;
    }
    if (/^###\s+/.test(trimmed)) {
      flushPara();
      const title = trimmed.replace(/^###\s+/, '').trim();
      blocks.push({ type: 'p', text: `**${title}**` });
      i++;
      continue;
    }

    // Unordered list.
    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Blockquote → callout info.
    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const quoted = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoted.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'callout', tone: 'info', items: [quoted.join(' ').trim()] });
      continue;
    }

    // Markdown table.
    if (/^\|.+\|$/.test(trimmed) && i + 1 < lines.length && /^\|[\s|:-]+\|$/.test(lines[i + 1].trim())) {
      flushPara();
      const headerCells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      i += 2; // skip separator
      const rows = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      blocks.push({ type: 'table', headers: headerCells, rows });
      continue;
    }

    // Horizontal rule → para break.
    if (/^---+$/.test(trimmed)) {
      flushPara();
      i++;
      continue;
    }

    // Blank line → end paragraph.
    if (trimmed === '') {
      flushPara();
      i++;
      continue;
    }

    // Default: accumulate paragraph.
    para.push(trimmed);
    i++;
  }
  flushPara();

  return blocks;
}

function today() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Emit a JavaScript object literal with nice indentation. */
function emitObjectLiteral(obj, indent = 2) {
  const pad = ' '.repeat(indent);
  if (obj === null) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map((x) => pad + '  ' + emitObjectLiteral(x, indent + 2));
    return '[\n' + items.join(',\n') + ',\n' + pad + ']';
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj).map(([k, v]) =>
      pad + '  ' + (/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + emitObjectLiteral(v, indent + 2)
    );
    return '{\n' + entries.join(',\n') + ',\n' + pad + '}';
  }
  return 'undefined';
}

function appendPostToBlogPosts(entry) {
  const src = fs.readFileSync(BLOG_POSTS_PATH, 'utf8');
  // Find the line containing the closing `];` of `export const BLOG_POSTS = [ ... ];`.
  // The file header guarantees this regex shape: `export const BLOG_POSTS = [` opens the
  // array and the corresponding `];` closes it. We scan for the last `];` in the file,
  // which works as long as the array is the final export (true by convention here).
  const closeIdx = src.lastIndexOf('];');
  if (closeIdx < 0) {
    throw new Error(`Cannot find closing "];" in ${BLOG_POSTS_PATH}; refusing to append.`);
  }

  // Walk backwards from `];` to find the end of the last entry. We want
  // `before` to end at the closing `}` PLUS its trailing comma (whether one
  // existed already or we synthesize it). That way the new entry can be
  // appended directly after a comma, which is what the array shape demands.
  //
  // Earlier versions of this function tracked hasTrailingComma but moved `j`
  // past the comma, so the comma ended up inside `after` instead of `before`,
  // and the rewritten file was `}\n  {new},\n];` (invalid JS). The new shape
  // is unconditional: find `}`, then always emit a comma before the new entry.
  let j = closeIdx - 1;
  while (j > 0 && /\s/.test(src[j])) j--;
  if (src[j] === ',') j--;
  while (j > 0 && /\s/.test(src[j])) j--;
  if (src[j] !== '}') {
    throw new Error(`Unexpected char before "]" at index ${j}: ${JSON.stringify(src[j])}`);
  }
  // before ends at the previous entry's `}`. Always append a comma; if one
  // was already there it lived in the slice we discarded.
  const before = src.slice(0, j + 1) + ',';
  const after = src.slice(j + 1).replace(/^\s*,/, '');

  const emitted = emitObjectLiteral(entry, 2);
  const patched = before + '\n  ' + emitted + after;
  fs.writeFileSync(BLOG_POSTS_PATH, patched);
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/blog/publish.mjs <slug>');
    process.exit(2);
  }
  const draftDir = path.join(DRAFTS_DIR, slug);
  if (!fs.existsSync(draftDir)) {
    console.error(`No draft directory at ${draftDir}`);
    process.exit(2);
  }

  const rawMetadata = JSON.parse(fs.readFileSync(path.join(draftDir, 'metadata.json'), 'utf8'));
  const rawMarkdown = fs.readFileSync(path.join(draftDir, 'post.md'), 'utf8');

  // Defense in depth: even though draft.mjs already sanitized, sanitize again
  // here so any later code path that bypasses draft.mjs cannot introduce
  // em dashes into the published file.
  const metadata = sanitizeDraft(rawMetadata);
  const markdown = sanitizeDraft(rawMarkdown);
  const body = parseMarkdownIntoBlocks(markdown);
  const tldr = metadata.tldr || [];

  const entry = {
    slug: metadata.slug,
    title: metadata.title,
    description: metadata.description,
    keyphrase: metadata.keyphrase,
    category: metadata.category,
    tags: inferTags(metadata, markdown),
    datePublished: today(),
    dateModified: today(),
    heroEyebrow: metadata.heroEyebrow,
    tldr,
    body,
    faq: metadata.faq,
    internalLinks: metadata.internalLinks,
    externalCitations: metadata.externalCitations,
  };

  // Last-mile residual check on the assembled entry. If somehow a forbidden
  // dash survived both passes, refuse to publish and fail loudly so the
  // notify-failure email fires and we can fix the sanitizer.
  const residuals = findResidualDashes(entry);
  if (residuals.length > 0) {
    console.error('[publish] Refusing to write entry with residual dashes:', residuals);
    process.exit(1);
  }

  appendPostToBlogPosts(entry);

  // Remove the draft directory now that it's been published.
  fs.rmSync(draftDir, { recursive: true, force: true });

  // Mark the queue entry published.
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const t = queue.topics.find((x) => x.slug === slug);
  if (t) {
    t.status = 'published';
    t.publishedAt = new Date().toISOString();
  }
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');

  console.log(`[publish] ${slug} appended to src/data/blog-posts.js and queue updated.`);
}

function inferTags(metadata, markdown) {
  const tagSet = new Set();
  tagSet.add(metadata.category);
  // simple heuristic: known morph names appearing in markdown become tags
  const known = ['cappuccino', 'lilly-white', 'axanthic', 'soft-scale', 'moonglow', 'white-wall', 'harlequin', 'pinstripe', 'dalmatian', 'frappuccino', 'super-cappuccino', 'super-lilly-white'];
  for (const k of known) {
    if (markdown.toLowerCase().includes(k.replace(/-/g, ' ')) || markdown.toLowerCase().includes(k)) {
      tagSet.add(k);
    }
  }
  return Array.from(tagSet);
}

main().catch((err) => {
  console.error('[publish] Fatal:', err);
  process.exit(1);
});
