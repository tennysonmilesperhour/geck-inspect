#!/usr/bin/env node
/**
 * Generate /morphs.csv ,  the open, machine-readable crested gecko
 * morph dataset sourced from src/data/morph-guide.js.
 *
 * The GEO audit's 30-day plan flagged an open dataset as a
 * Perplexity-friendly signal: AI engines love citing primary data
 * sources they can quote exactly. Shipping a plain CSV at a stable
 * URL accomplishes two things cheaply:
 *
 *   1. Becomes a citable primary source for "crested gecko morphs by
 *      inheritance" style queries.
 *   2. Works as a machine-readable complement to llms-full.txt ,  some
 *      ingestion pipelines prefer CSV to markdown for tabular data.
 *
 * The CSV is regenerated on every build from the canonical morph
 * dataset, so adding a morph to morph-guide.js automatically updates
 * the public dataset.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT = resolve(REPO_ROOT, 'public/morphs.csv');
const SRC = resolve(REPO_ROOT, 'src/data/morph-guide.js');

function unescape(s) {
  return s.replace(/\\'/g, "'").replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
}

function parseMorphs() {
  const src = readFileSync(SRC, 'utf8');
  const m = src.match(/export const MORPHS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('MORPHS array not found');
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
      return hit ? unescape(hit[1]) : '';
    };
    const slug = gs('slug');
    if (!slug) continue;
    out.push({
      slug,
      name: gs('name'),
      category: gs('category'),
      inheritance: gs('inheritance'),
      rarity: gs('rarity'),
      priceTier: gs('priceTier'),
      priceRange: gs('priceRange'),
      summary: gs('summary').replace(/\s+/g, ' ').trim(),
      url: `https://geckinspect.com/MorphGuide/${slug}`,
    });
  }
  return out;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function build() {
  const morphs = parseMorphs();
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

build();
