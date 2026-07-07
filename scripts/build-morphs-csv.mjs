#!/usr/bin/env node
/**
 * Generate /morphs.csv, the open, machine-readable crested gecko
 * morph dataset sourced from src/data/morph-guide.js.
 *
 * The GEO audit's 30-day plan flagged an open dataset as a
 * Perplexity-friendly signal: AI engines love citing primary data
 * sources they can quote exactly. Shipping a plain CSV at a stable
 * URL accomplishes two things cheaply:
 *
 *   1. Becomes a citable primary source for "crested gecko morphs by
 *      inheritance" style queries.
 *   2. Works as a machine-readable complement to llms-full.txt, some
 *      ingestion pipelines prefer CSV to markdown for tabular data.
 *
 * The CSV is regenerated on every build from the canonical morph
 * dataset, so adding a morph to morph-guide.js automatically updates
 * the public dataset.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT = resolve(REPO_ROOT, 'public/morphs.csv');
const SRC = resolve(REPO_ROOT, 'src/data/morph-guide.js');

// Minimum morph count we expect. morph-guide.js ships ~32 morphs; if the
// import yields fewer than this, something truncated the dataset and we
// fail the build loudly rather than publishing a gutted public CSV.
const MIN_MORPHS = 20;

async function loadMorphs() {
  // Import the canonical data module directly instead of regex-parsing
  // the source. morph-guide.js is plain ESM with no JSX or bundler-only
  // imports, so Node can load it. This is robust to source reformatting
  // (the old regex split on exact `\n  },\n  {` whitespace and threw
  // "MORPHS array not found" the moment that changed).
  const mod = await import(pathToFileURL(SRC).href);
  const morphs = mod.MORPHS;
  if (!Array.isArray(morphs)) {
    throw new Error('morph-guide.js did not export a MORPHS array');
  }
  const out = morphs
    .filter((m) => m && m.slug)
    .map((m) => ({
      slug: m.slug,
      name: m.name || '',
      category: m.category || '',
      inheritance: m.inheritance || '',
      rarity: m.rarity || '',
      priceTier: m.priceTier || '',
      priceRange: m.priceRange || '',
      summary: (m.summary || '').replace(/\s+/g, ' ').trim(),
      url: `https://geckinspect.com/MorphGuide/${m.slug}`,
    }));
  if (out.length < MIN_MORPHS) {
    throw new Error(
      `Only ${out.length} morphs parsed (expected >= ${MIN_MORPHS}). ` +
        'Refusing to write a truncated public dataset.',
    );
  }
  return out;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function build() {
  const morphs = await loadMorphs();
  const headers = [
    'slug',
    'name',
    'category',
    'inheritance',
    'rarity',
    'price_tier',
    'price_range',
    'summary',
    'url',
  ];
  const rows = morphs.map((m) => [
    m.slug,
    m.name,
    m.category,
    m.inheritance,
    m.rarity,
    m.priceTier,
    m.priceRange,
    m.summary,
    m.url,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
    '',
  ].join('\n');

  writeFileSync(OUT, csv, 'utf8');
  console.log(`[build-morphs-csv] wrote ${morphs.length} morphs → public/morphs.csv`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
