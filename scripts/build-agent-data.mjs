#!/usr/bin/env node
/**
 * Build the machine-readable side of Geck Inspect: the files written for
 * AI agents, search engines' dataset indexes and any other automation.
 *
 * Writes (all under public/, so they ship as static files):
 *   data/price-index.json  Geck Inspect Price Index, refreshed from the
 *                          database when the build has Supabase env vars;
 *                          otherwise the committed snapshot ships as is.
 *   data/price-index.csv   The same, flat.
 *   data/morphs.json       Every morph with definition, identification,
 *                          lookalikes, genetics models and sources.
 *   data/genetics.json     The genetics engine's traits, combos and risky
 *                          pairings (the same facts the calculator uses).
 *   data/care.json         The care guide as structured blocks.
 *   data/index.json        Catalog of every dataset (DCAT style).
 *   MorphGuide/<slug>.md   One markdown file per morph page.
 *   CareGuide/<id>.md      One markdown file per care topic page.
 *   llms/*.md              Topic files linked from /llms.txt, each small
 *                          enough for an agent to read whole.
 *
 * Why: AI search and agents cite sources with original data, clean text
 * and stable URLs. The HTML pages stay the main surface; these give an
 * agent the same facts without parsing a JavaScript app. See
 * docs/planning/agent-access-2026-10.md.
 *
 * Runs in `pnpm build` before build-llms-full.mjs (which reads the price
 * index written here).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import {
  REPO_ROOT,
  SITE_URL,
  PRICE_INDEX,
  noDashes,
  loadCareGuide,
  loadMorphs,
  loadPriceIndex,
  careSectionMarkdown,
  careToMarkdown,
  morphMarkdown,
  morphsToMarkdown,
  priceIndexToMarkdown,
  priceRowsForMorph,
  MORPH_LABELS,
} from './lib/agent-content.mjs';

const PUBLIC = resolve(REPO_ROOT, 'public');
const ENV = { ...loadEnv('production', REPO_ROOT, ''), ...process.env };
const TODAY = new Date().toISOString().slice(0, 10);

export const LICENSE_DATA = 'https://creativecommons.org/licenses/by/4.0/';
export const LICENSE_TEXT_NOTE =
  'Guide text: free to quote and cite with a link to the page; not licensed for republishing in full.';

function write(rel, body) {
  const path = resolve(PUBLIC, rel);
  mkdirSync(dirname(path), { recursive: true });
  const clean = noDashes(body);
  writeFileSync(path, clean, 'utf8');
  return Buffer.byteLength(clean);
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

// ---- price index ----------------------------------------------------------

const PRICE_META = {
  name: 'Geck Inspect Price Index',
  description:
    'Asking prices for crested geckos (Correlophus ciliatus) by trait and market, compiled by Geck Inspect from public listings on the largest online reptile marketplaces in the United States, South Korea, Japan and Europe.',
  url: `${SITE_URL}/data`,
  license: LICENSE_DATA,
  creator: 'Geck Inspect',
  attribution: `Geck Inspect Price Index, ${SITE_URL}/data`,
  methodology: [
    'Asking prices on open listings, not sale prices.',
    'Prices outside the US are converted to USD at stored exchange rates; shipping and import costs are not included.',
    'Only full catalog checks count. A partial check or the catch-up after an outage is left out.',
    'A trait is shown only when at least 5 listings carry it. trait null means all crested geckos in that market.',
    'p25, median and p75 are the 25th, 50th and 75th percentile asking price. monthly.median is the median of that month\'s daily medians.',
    'Trait labels are the marketplace labels as listed by sellers; a label does not prove genotype.',
  ],
};

async function fetchPriceIndex() {
  const url = ENV.VITE_SUPABASE_URL;
  const key = ENV.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/open_price_index`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.latest) || data.latest.length === 0) throw new Error('empty index');
    return data;
  } catch (e) {
    console.warn(`[build-agent-data] price index fetch failed (${e.message}); keeping the committed snapshot`);
    return null;
  }
}

function priceIndexCsv(index) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['kind', 'market', 'period', 'trait', 'listings', 'p25_usd', 'median_usd', 'p75_usd', 'full_checks']];
  for (const r of index.latest) {
    rows.push(['latest', r.market, r.checked_on, r.trait || 'All crested geckos', r.listings, r.p25, r.median, r.p75, '']);
  }
  for (const r of index.monthly || []) {
    rows.push(['monthly', r.market, r.month, r.trait || 'All crested geckos', r.avg_listings, '', r.median, '', r.full_checks]);
  }
  return `${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`;
}

// ---- genetics -------------------------------------------------------------

async function loadGenetics() {
  const g = await import(pathToFileURL(resolve(REPO_ROOT, 'src/lib/genetics/index.js')).href);
  const clean = (v) => JSON.parse(JSON.stringify(v), (_k, val) => noDashes(val));
  const glossary = await import(pathToFileURL(resolve(REPO_ROOT, 'src/data/genetics-glossary.js')).href);
  return {
    traits: clean(g.TRAITS),
    combos: clean(g.COMBO_MORPHS),
    riskPairings: clean(g.RISK_PAIRINGS),
    loci: g.LOCI,
    glossary: clean(glossary.GLOSSARY_GROUPS || []),
  };
}

const DOMINANCE_LABEL = {
  recessive: 'Recessive',
  incomplete_dominant: 'Incomplete dominant',
  dominant: 'Dominant',
  co_dominant: 'Co-dominant',
  fixed_dominant: 'Fixed dominant (base color)',
  polygenic: 'Polygenic',
};

function geneticsMarkdown(gen) {
  const out = [
    '# Crested gecko genetics: traits, inheritance and risky pairings',
    '',
    `> From the Geck Inspect genetics engine, the same facts the genetics calculator at ${SITE_URL}/calculator uses. Updated ${TODAY}. JSON: ${SITE_URL}/data/genetics.json. Guide: ${SITE_URL}/GeneticsGuide.`,
    '',
    'Most crested gecko looks are polygenic or line-bred and cannot be Punnett-squared. The traits below are the ones the engine models with a locus. "Confirmed" means the inheritance is proven by breeding records; unconfirmed traits are hobby models.',
    '',
    '## Pairings to avoid or plan carefully',
    '',
    ...gen.riskPairings.map((r) => `- **${r.severity}** (${r.code}): ${r.message}${r.source_url ? ` Source: ${r.source_url}` : ''}`),
    '',
    '## Traits',
    '',
  ];
  for (const t of gen.traits) {
    out.push(`### ${t.name}`, '');
    const facts = [
      `**Inheritance:** ${DOMINANCE_LABEL[t.dominance] || t.dominance}`,
      t.locus ? `**Locus:** ${t.locus}` : null,
      `**Super form:** ${t.has_super_form ? `yes (health risk: ${t.super_health_risk || 'unknown'})` : 'no'}`,
      `**Confirmed by breeding:** ${t.confirmed ? 'yes' : 'no'}`,
      t.last_reviewed ? `**Last reviewed:** ${t.last_reviewed}` : null,
    ].filter(Boolean);
    out.push(facts.join('  \n'), '');
    if (t.description) out.push(t.description, '');
    if (t.identification_markers?.length) {
      out.push('**Identification markers:**', t.identification_markers.map((m) => `- ${m}`).join('\n'), '');
    }
    if (t.primary_sources?.length) {
      out.push('**Sources:**', t.primary_sources.map((s) => `- ${s.name}: ${s.url}`).join('\n'), '');
    }
  }
  out.push('## Named combinations', '');
  for (const c of gen.combos.filter((x) => !x.is_marketing_term)) {
    out.push(`- **${c.name}:** ${c.description}`);
  }
  out.push('');
  if (gen.glossary.length) {
    out.push('## Glossary', '');
    for (const group of gen.glossary) {
      out.push(`### ${group.category}`, '');
      for (const e of group.entries || []) out.push(`- **${e.term}:** ${e.def}`);
      out.push('');
    }
  }
  return out.join('\n');
}

// ---- compose --------------------------------------------------------------

async function build() {
  const sizes = {};

  // Price index: fresh from the database when possible.
  const fresh = await fetchPriceIndex();
  if (fresh) {
    writeFileSync(PRICE_INDEX, json({ ...PRICE_META, ...fresh }), 'utf8');
  } else if (existsSync(PRICE_INDEX)) {
    // Refresh the metadata on the snapshot so a methodology change ships.
    const old = JSON.parse(readFileSync(PRICE_INDEX, 'utf8'));
    writeFileSync(PRICE_INDEX, json({ ...old, ...PRICE_META, latest: old.latest, monthly: old.monthly, generated_at: old.generated_at }), 'utf8');
  }
  const priceIndex = loadPriceIndex();
  if (priceIndex) sizes['data/price-index.csv'] = write('data/price-index.csv', priceIndexCsv(priceIndex));

  const morphs = await loadMorphs();
  const bySlug = Object.fromEntries(morphs.map((m) => [m.slug, m]));
  const nameOf = (slug) => bySlug[slug]?.name || slug;
  const care = await loadCareGuide();
  const genetics = await loadGenetics();

  // JSON datasets.
  sizes['data/morphs.json'] = write('data/morphs.json', json({
    name: 'Geck Inspect crested gecko morph catalog',
    url: `${SITE_URL}/MorphGuide`,
    license: LICENSE_DATA,
    attribution: `Geck Inspect Morph Guide, ${SITE_URL}/MorphGuide`,
    updated: TODAY,
    count: morphs.length,
    morphs: morphs.map((m) => ({
      ...m,
      url: `${SITE_URL}/MorphGuide/${m.slug}`,
      markdown: `${SITE_URL}/MorphGuide/${m.slug}.md`,
      categoryLabel: MORPH_LABELS.category[m.category] || m.category,
      inheritanceLabel: MORPH_LABELS.inheritance[m.inheritance] || m.inheritance,
      rarityLabel: MORPH_LABELS.rarity[m.rarity] || m.rarity,
      askingPrices: priceRowsForMorph(priceIndex, m),
    })),
  }));
  sizes['data/genetics.json'] = write('data/genetics.json', json({
    name: 'Geck Inspect crested gecko genetics engine data',
    url: `${SITE_URL}/GeneticsGuide`,
    license: LICENSE_DATA,
    attribution: `Geck Inspect genetics engine, ${SITE_URL}/calculator`,
    updated: TODAY,
    ...genetics,
  }));
  sizes['data/care.json'] = write('data/care.json', json({
    name: 'Geck Inspect crested gecko care guide',
    url: `${SITE_URL}/CareGuide`,
    license: 'Free to quote and cite with a link; not licensed for republishing in full.',
    updated: TODAY,
    sections: care.map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      url: `${SITE_URL}/CareGuide/${s.id}`,
      markdown: `${SITE_URL}/CareGuide/${s.id}.md`,
      blocks: s.blocks,
    })),
  }));

  // Per-page markdown twins of the HTML pages.
  for (const m of morphs) {
    write(`MorphGuide/${m.slug}.md`, `${morphMarkdown(m, { level: 1, full: true, priceIndex, nameOf })}\n_Source: Geck Inspect Morph Guide. Updated ${TODAY}. Cite ${SITE_URL}/MorphGuide/${m.slug}_\n`);
  }
  for (const s of care) {
    write(`CareGuide/${s.id}.md`, `${careSectionMarkdown(s, 1)}\n_Source: Geck Inspect Care Guide. Updated ${TODAY}. Cite ${SITE_URL}/CareGuide/${s.id}_\n`);
  }

  // Topic files for /llms.txt.
  const header = (title, blurb) => `# ${title}\n\n> ${blurb} Updated ${TODAY}. Index: ${SITE_URL}/llms.txt\n\n`;
  sizes['llms/morphs.md'] = write('llms/morphs.md', header(
    'Crested gecko morphs (Geck Inspect Morph Guide)',
    `All ${morphs.length} morphs with definitions, identification, lookalikes and live asking prices.`,
  ) + morphs.map((m) => morphMarkdown(m, { level: 2, full: true, priceIndex, nameOf })).join('\n'));
  sizes['llms/care.md'] = write('llms/care.md', header(
    'Crested gecko care (Geck Inspect Care Guide)',
    `All ${care.length} care topics: housing, temperature, humidity, diet, handling, health and breeding.`,
  ) + careToMarkdown(care).replace(/^## Crested gecko care guide \(full content\)\n\n/, ''));
  sizes['llms/genetics.md'] = write('llms/genetics.md', geneticsMarkdown(genetics));
  if (priceIndex) {
    sizes['llms/prices.md'] = write('llms/prices.md', header(
      'Crested gecko prices (Geck Inspect Price Index)',
      'Current asking prices by trait and market, original data.',
    ) + priceIndexToMarkdown(priceIndex).replace(/^## .*\n\n/, ''));
  }

  // Catalog of every dataset.
  const datasets = [
    {
      id: 'price-index',
      name: PRICE_META.name,
      description: PRICE_META.description,
      license: LICENSE_DATA,
      temporalCoverage: priceIndex?.monthly?.length
        ? `${priceIndex.monthly.map((r) => r.month).sort()[0]}/${TODAY.slice(0, 7)}`
        : undefined,
      updated: String(priceIndex?.generated_at || TODAY).slice(0, 10),
      distribution: [
        { format: 'application/json', url: `${SITE_URL}/data/price-index.json` },
        { format: 'text/csv', url: `${SITE_URL}/data/price-index.csv` },
        { format: 'text/markdown', url: `${SITE_URL}/llms/prices.md` },
      ],
    },
    {
      id: 'morphs',
      name: 'Crested gecko morph catalog',
      description: `Every documented crested gecko morph (${morphs.length}) with definition, inheritance, rarity, identification markers, lookalikes, competing genetics models, typical price range and sources.`,
      license: LICENSE_DATA,
      updated: TODAY,
      distribution: [
        { format: 'application/json', url: `${SITE_URL}/data/morphs.json` },
        { format: 'text/csv', url: `${SITE_URL}/morphs.csv` },
        { format: 'text/markdown', url: `${SITE_URL}/llms/morphs.md` },
      ],
    },
    {
      id: 'genetics',
      name: 'Crested gecko genetics: traits, loci, combos and risky pairings',
      description: `The ${genetics.traits.length} traits the Geck Inspect genetics engine models, with inheritance, locus, super form health risk, identification markers and primary sources, plus named combinations and pairings to avoid.`,
      license: LICENSE_DATA,
      updated: TODAY,
      distribution: [
        { format: 'application/json', url: `${SITE_URL}/data/genetics.json` },
        { format: 'text/markdown', url: `${SITE_URL}/llms/genetics.md` },
      ],
    },
    {
      id: 'care',
      name: 'Crested gecko care guide',
      description: `The Geck Inspect care guide (${care.length} topics) as structured blocks: housing, temperature, humidity, diet, handling, health and breeding.`,
      license: LICENSE_TEXT_NOTE,
      updated: TODAY,
      distribution: [
        { format: 'application/json', url: `${SITE_URL}/data/care.json` },
        { format: 'text/markdown', url: `${SITE_URL}/llms/care.md` },
      ],
    },
  ];
  sizes['data/index.json'] = write('data/index.json', json({
    publisher: { name: 'Geck Inspect', url: SITE_URL },
    description: 'Open crested gecko data from Geck Inspect. Free to use with attribution. Query it live through the MCP server at https://geckinspect.com/mcp.',
    contact: `${SITE_URL}/Contact`,
    updated: TODAY,
    mcp: `${SITE_URL}/mcp`,
    datasets,
  }));

  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  console.log(`[build-agent-data] ${morphs.length} morph .md, ${care.length} care .md, ${Object.keys(sizes).length} files (${Math.round(total / 1024)} KB)${fresh ? ', price index refreshed' : ''}`);
  for (const [f, n] of Object.entries(sizes)) {
    if (f.startsWith('llms/') && n > 200_000) console.warn(`[build-agent-data] ${f} is ${Math.round(n / 1024)} KB; agents may truncate it`);
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
