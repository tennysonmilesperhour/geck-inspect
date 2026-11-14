/**
 * Write src/lib/genetics/calculatorLinkData.js: the few facts a Morph Guide
 * page needs from the genetics calculator's catalog, which page a morph's
 * calculator button opens and which badge (Proven or Emerging) the
 * calculator gives its gene. The catalog itself is about 26 kB of trait
 * definitions the Morph Guide's public pages never use, and each of those
 * pages has a size budget.
 *
 * Run after changing src/lib/genetics/calculatorCatalog.js:
 *
 *   node scripts/write-calculator-links.mjs
 *
 * src/lib/__tests__/calculatorLinkData.test.js fails when the written file
 * is out of date.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/lib/genetics/calculatorLinkData.js');

const slugOf = (label) => String(label).toLowerCase().replace(/\s+/g, '-');

/** The three badge tables, from the catalog's own lists, in its order. */
export function calculatorLinkData(catalog) {
  // Every /calculator/<slug> page, with the badge its gene carries.
  const pageBadges = Object.fromEntries(catalog.CALCULATOR_PAGES.map((p) => [p.slug, p.confidence ?? null]));
  // The Cappuccino group's combos and supers (Luwak, Super Sable), by value.
  const complexBadges = Object.fromEntries(
    Object.entries(catalog.COMPLEX_OPTIONS_BY_VALUE)
      .filter(([, option]) => option?.confidence)
      .map(([value, option]) => [value, option.confidence]),
  );
  // The supers of the other genes (Super Empty Back), by the first gene
  // whose super label reads as that slug.
  const superBadges = {};
  for (const trait of catalog.SIMPLE_TRAITS) {
    if (!trait.super_label) continue;
    const slug = slugOf(trait.super_label);
    if (!(slug in superBadges)) superBadges[slug] = trait.confidence || null;
  }
  return { pageBadges, complexBadges, superBadges };
}

export function renderCalculatorLinkData(data) {
  return `// Written by scripts/write-calculator-links.mjs from
// src/lib/genetics/calculatorCatalog.js. Do not edit by hand: change the
// catalog and run node scripts/write-calculator-links.mjs.
// src/lib/__tests__/calculatorLinkData.test.js fails when this is out of date.

/** Every /calculator/<slug> page, with the badge its gene carries. */
export const CALCULATOR_PAGE_BADGES = ${JSON.stringify(data.pageBadges, null, 2)};

/** The Cappuccino group's combos and supers, by option value. */
export const COMPLEX_OPTION_BADGES = ${JSON.stringify(data.complexBadges, null, 2)};

/** The supers of the other genes, by the slug of their super label. */
export const SUPER_LABEL_BADGES = ${JSON.stringify(data.superBadges, null, 2)};
`;
}

export async function writeCalculatorLinks() {
  const catalog = await import(pathToFileURL(resolve(ROOT, 'src/lib/genetics/calculatorCatalog.js')).href);
  writeFileSync(OUT, renderCalculatorLinkData(calculatorLinkData(catalog)), 'utf8');
  console.log(`[calculator-links] wrote ${OUT.replace(`${ROOT}/`, '')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await writeCalculatorLinks();
}
