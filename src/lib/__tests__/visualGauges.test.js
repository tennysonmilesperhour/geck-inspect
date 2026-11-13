// Two ceilings from the experience review of 11 November 2026 (findings
// K1 and K2, docs/planning/experience-review-2026-11-11.md), held here so
// the app cannot drift back:
//
//   K1  nothing a member reads is smaller than 12 px (`text-xs`). 11 px
//       (`text-[11px]`) is allowed only for uppercase eyebrow labels and
//       the phone tab labels, so this counts 10 px and smaller.
//   K2  five colour roles in app screens: accent (emerald, which follows
//       the member's theme), success (green), warning (amber), danger
//       (red) and neutral (slate). Purple, violet, pink, sky and blue are
//       left only where they carry meaning: the male and female markers,
//       charts and illustrations.
//
// Each number below is today's count after the first pass (My Geckos,
// Today, the gecko record, Morph ID, Breeding and the Overview). A count
// may only go down. WHEN YOU REMOVE MORE, LOWER THE NUMBER to the new
// count in the same commit, so the next person cannot add them back. If
// this fails because you added one: use `text-xs`, or the accent or
// neutral colour of the same weight, instead of raising the number.
//
// Left out of the count: tests, admin screens, and retired features
// (their code is kept untouched; src/lib/retiredPages.js lists them).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RETIRED_PAGES } from '../retiredPages.js';

const SRC = path.resolve(__dirname, '../..');

// Component folders that belong to a retired feature.
const RETIRED_FOLDERS = ['store', 'other-reptiles', 'morph-visualizer', 'promote'];
const RETIRED_PAGE_FILES = new Set(RETIRED_PAGES.map((r) => `pages/${r.page}.jsx`));

function isCounted(rel) {
  if (!/\.(jsx|js)$/.test(rel)) return false;
  if (rel.includes('__tests__/') || /\.test\.(jsx|js)$/.test(rel)) return false;
  if (rel.startsWith('components/admin/') || /^pages\/Admin[^/]*\.jsx$/.test(rel)) return false;
  if (RETIRED_FOLDERS.some((folder) => rel.startsWith(`components/${folder}/`))) return false;
  if (RETIRED_PAGE_FILES.has(rel)) return false;
  return true;
}

function sourceFiles(dir = SRC, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (isCounted(path.relative(SRC, full).split(path.sep).join('/'))) out.push(full);
  }
  return out;
}

const SOURCE = sourceFiles().map((file) => fs.readFileSync(file, 'utf8')).join('\n');

const count = (pattern) => (SOURCE.match(pattern) || []).length;

describe('visual gauges (experience review K1 and K2)', () => {
  it('reads a real number of files', () => {
    // Guards the walk itself: a wrong folder would make every count 0
    // and every ceiling pass.
    expect(sourceFiles().length).toBeGreaterThan(500);
    expect(count(/text-xs\b/g)).toBeGreaterThan(1000);
  });

  it('K1: text of 10 px and smaller does not grow', () => {
    // Every arbitrary size class at or under 10 px: text-[10px],
    // text-[9px], text-[9.5px], text-[8px].
    const small = (SOURCE.match(/text-\[(\d+(?:\.\d+)?)px\]/g) || [])
      .filter((cls) => Number(cls.slice(6, -3)) <= 10);
    expect(small.length).toBeLessThanOrEqual(188); // was 232; lower me when you remove more
  });

  it('K2: off-palette colour classes do not grow', () => {
    // One ceiling per family, so a fall in one cannot hide a rise in
    // another. Lower each when you remove more.
    // Before the first pass: purple 136, violet 71, pink 89, sky 118, blue 124.
    const ceilings = { purple: 78, violet: 61, pink: 75, sky: 99, blue: 96 };
    const counts = Object.fromEntries(
      Object.keys(ceilings).map((family) => [family, count(new RegExp(`\\b${family}-\\d{2,3}\\b`, 'g'))]),
    );
    for (const family of Object.keys(ceilings)) {
      expect(counts[family], `${family}-* classes`).toBeLessThanOrEqual(ceilings[family]);
    }
  });
});
