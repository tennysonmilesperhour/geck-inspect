/**
 * Fact-check corpus assembly for the writer agent.
 *
 * Reads the canonical genetics sources shipping with the repo and returns
 * a single concatenated string that's injected into the writer/reviewer
 * system prompt (behind a cache breakpoint). When the Foundation Genetics
 * module lands, add it to the list here and every subsequent run picks it
 * up automatically.
 *
 * Order matters: we put the most authoritative sources first so callers
 * citing order ("source 1, source 2") degrade gracefully if we ever
 * truncate the corpus.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const SOURCES = [
  // TODO: once the Foundation Genetics module is integrated, prepend its
  // exported fact sheet here ,  it supersedes every other source.
  { label: 'morph-guide.js (local canonical catalogue)', path: 'src/data/morph-guide.js' },
  { label: 'genetics-glossary.js',                       path: 'src/data/genetics-glossary.js' },
  { label: 'genetics-sections.jsx (long-form)',          path: 'src/data/genetics-sections.jsx' },
  { label: 'genetics-jsonld.js (structured FAQ)',        path: 'src/data/genetics-jsonld.js' },
];

function safeRead(relPath) {
  try {
    const base = path.resolve(REPO_ROOT);
    const target = path.resolve(base, relPath);
    const relative = path.relative(base, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid path');
    }
    return fs.readFileSync(target, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Returns a single string, around 60-120K characters depending on how much
 * the genetics content has grown. Structured as:
 *
 *   === FACT CHECK CORPUS ===
 *   ## source 1: morph-guide.js
 *   <contents>
 *   ## source 2: genetics-glossary.js
 *   <contents>
 *   ...
 *   === END FACT CHECK CORPUS ===
 *
 * The writer agent is instructed to only make genetic claims that can be
 * grounded in this corpus.
 */
export function loadFactCheckCorpus() {
  const pieces = ['=== FACT CHECK CORPUS ==='];
  const included = [];
  for (const src of SOURCES) {
    const contents = safeRead(src.path);
    if (contents == null) continue;
    pieces.push(`\n## Source: ${src.label} (${src.path})\n`);
    pieces.push(contents);
    included.push({ label: src.label, path: src.path, bytes: contents.length });
  }
  pieces.push('\n=== END FACT CHECK CORPUS ===\n');
  return {
    text: pieces.join('\n'),
    sources: included,
  };
}

/**
 * Load only the cheap-to-read slug + inheritance lookup table. Used by
 * the research scorer (Haiku) to pre-filter topics to morphs the writer
 * can actually fact-check without loading the full corpus.
 */
export function loadMorphSlugs() {
  const morphGuide = safeRead('src/data/morph-guide.js');
  if (!morphGuide) return [];
  const out = [];
  // Match each `slug: '…'` + its surrounding `name:` + `inheritance:`.
  const re = /slug:\s*['"]([^'"]+)['"][\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?inheritance:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(morphGuide)) !== null) {
    out.push({ slug: m[1], name: m[2], inheritance: m[3] });
  }
  return out;
}

/**
 * Load the list of slugs of blog posts we've already published so the
 * research agent can avoid duplicating existing coverage.
 */
export function loadPublishedPostSlugs() {
  const blogPosts = safeRead('src/data/blog-posts.js');
  if (!blogPosts) return [];
  const slugs = [];
  const re = /slug:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(blogPosts)) !== null) slugs.push(m[1]);
  return slugs;
}
