/**
 * Shared loaders and markdown renderers for the files written for AI
 * agents and other automation: /llms-full.txt (build-llms-full.mjs) and
 * the topic files, per-page markdown and /data JSON (build-agent-data.mjs).
 *
 * The care guide, morph guide and blog data files are plain ESM modules
 * with no JSX or bundler-only imports, so Node imports them directly.
 * Each loader fails the build loudly if its dataset comes back empty or
 * truncated, so a reformat or accidental deletion can't ship gutted files.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PRICE_DATA_TERMS,
  PRICE_INDEX_SAMPLE_RULE,
  PRICE_INDEX_WHAT,
  applyPricePolicy,
  staleMarketNote,
  staleMarkets,
} from '../../src/lib/priceIndexPolicy.js';
import { COMPLEX_OPTIONS, SIMPLE_TRAITS } from '../../src/lib/genetics/calculatorCatalog.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const REPO_ROOT = resolve(__dirname, '../..');
export const SITE_URL = 'https://geckinspect.com';

const CARE = resolve(REPO_ROOT, 'src/data/care-guide.js');
const MORPH = resolve(REPO_ROOT, 'src/data/morph-guide.js');
const BLOG = resolve(REPO_ROOT, 'src/data/blog-posts.js');
export const PRICE_INDEX = resolve(REPO_ROOT, 'public/data/price-index.json');

const MIN_CARE_SECTIONS = 15;
const MIN_MORPHS = 20;

/** No em or en dashes in anything we publish (CLAUDE.md hard rule). */
export function noDashes(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\s*\u2014\s*/g, ', ').replace(/\s*\u2013\s*/g, ' to ');
}

export async function loadCareGuide() {
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
        category: cat.id,
        categoryTitle: cat.label || cat.id,
        blocks: section.body || [],
      });
    }
  }
  if (out.length < MIN_CARE_SECTIONS) {
    throw new Error(`Only ${out.length} care sections parsed (expected >= ${MIN_CARE_SECTIONS}).`);
  }
  return out;
}

// Labels for the raw ids in morph-guide.js, filled by loadMorphs().
export let MORPH_LABELS = { inheritance: {}, rarity: {}, category: {} };

/** Fill MORPH_LABELS from the morph-guide module's lookup tables. */
export function setMorphLabels(mod) {
  MORPH_LABELS = {
    inheritance: Object.fromEntries(Object.values(mod.INHERITANCE || {}).map((i) => [i.id, i.label])),
    rarity: Object.fromEntries(Object.values(mod.RARITY || {}).map((r) => [r.id, r.label])),
    category: Object.fromEntries((mod.MORPH_CATEGORIES || []).map((c) => [c.id, c.label])),
  };
}

/** The fields agents get for one morph-guide entry. */
export function normalizeMorph(m) {
  return {
    slug: m.slug,
    name: m.name || m.slug,
    aliases: m.aliases || [],
    definition: m.definition || null,
    summary: m.summary || null,
    description: m.description || null,
    history: m.history || null,
    notes: m.notes || null,
    foundationGenetics: m.foundationGenetics || null,
    inheritance: m.inheritance || null,
    rarity: m.rarity || null,
    category: m.category || null,
    priceTier: m.priceTier || null,
    priceRange: m.priceRange || null,
    keyFeatures: m.keyFeatures || [],
    visualIdentifiers: m.visualIdentifiers || [],
    lookalikes: m.lookalikes || [],
    combinesWith: m.combinesWith || [],
    sources: m.sources || [],
  };
}

export async function loadMorphs() {
  const mod = await import(pathToFileURL(MORPH).href);
  setMorphLabels(mod);
  if (!Array.isArray(mod.MORPHS)) {
    throw new Error('morph-guide.js did not export a MORPHS array');
  }
  const out = mod.MORPHS.filter((m) => m && m.slug).map(normalizeMorph);
  if (out.length < MIN_MORPHS) {
    throw new Error(`Only ${out.length} morphs parsed (expected >= ${MIN_MORPHS}).`);
  }
  return out;
}

export async function loadBlogPosts() {
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

// ---- genetics status --------------------------------------------------

// The calculator's badge for each gene it offers ('proven' or 'emerging',
// src/lib/genetics/calculatorCatalog.js), by engine trait id. The Cappuccino
// gene's single versions (Cappuccino, Sable, Highway) carry their own.
export const CALCULATOR_STATUS = {
  ...Object.fromEntries(SIMPLE_TRAITS.map((t) => [t.id, t.confidence])),
  ...Object.fromEntries(
    COMPLEX_OPTIONS.filter((o) => o.confidence && o.pair?.[0] === o.value).map((o) => [o.value, o.confidence]),
  ),
};

/**
 * One engine trait as published in /data/genetics.json and
 * /llms/genetics.md. The engine marks Empty Back, Whiteout, Sable and
 * other newer genes `confirmed`, but Geck Inspect badges them Emerging:
 * reported by one or a few breeders, not yet independently proven
 * (Tennyson's decision of 16 Oct 2026 keeps Empty Back Emerging). The
 * published data follows the badge, so no file calls an Emerging gene
 * proven.
 */
export function withGeckInspectStatus(trait) {
  const status = CALCULATOR_STATUS[trait?.id];
  if (!status) return trait;
  return { ...trait, confirmed: Boolean(trait.confirmed) && status === 'proven', status };
}

/** The committed or freshly fetched price index, or null. */
export function loadPriceIndex() {
  if (!existsSync(PRICE_INDEX)) return null;
  try {
    const data = JSON.parse(readFileSync(PRICE_INDEX, 'utf8'));
    // The minimum-sample rule again, in case the file predates it.
    return Array.isArray(data?.latest) ? applyPricePolicy(data) : null;
  } catch {
    return null;
  }
}

/** "52 (thin sample)" for a row under the thin-sample line, else the count. */
export function listingsCell(row) {
  return row.thin ? `${row.listings} (thin sample)` : String(row.listings);
}

export const MARKET_NAMES = { US: 'United States', KR: 'South Korea', JP: 'Japan', EU: 'Europe' };
const MARKET_ORDER = Object.keys(MARKET_NAMES);
const byMarketOrder = (a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market);

// Market trait names that differ from the morph guide's name or aliases.
// "Phantom" needs no entry: it matches the Phantom (gene) page by name, the
// same page src/lib/priceIndexPolicy.js links it to. It used to point at
// Phantom Pinstripe, which put the gene's asking prices on that page too.
const MARKET_TRAIT_TO_SLUG = {
  'tri-color': 'tricolor',
};

/** Latest asking-price rows for one morph, keyed by market. */
export function priceRowsForMorph(index, morph) {
  if (!index) return [];
  const names = new Set([morph.name, ...(morph.aliases || [])].map((n) => n.toLowerCase()));
  return index.latest.filter((row) => {
    if (!row.trait) return false;
    const t = row.trait.toLowerCase();
    return names.has(t) || MARKET_TRAIT_TO_SLUG[t] === morph.slug;
  }).sort(byMarketOrder);
}

/**
 * Where a morph's asking prices are, for the morph catalog (data/morphs.json,
 * llms/morphs.md and the MorphGuide/<slug>.md twins), or null when the Price
 * Index has no rows for it. The catalog is CC BY 4.0 and the Price Index is
 * not (it is free to cite with a link), so the catalog names the morph's
 * trait labels in the index and links the index files instead of copying
 * its numbers.
 */
export function priceIndexPointer(index, morph) {
  const traits = [...new Set(priceRowsForMorph(index, morph).map((r) => r.trait))];
  if (!traits.length) return null;
  return {
    name: 'Geck Inspect Price Index',
    traits,
    json: `${SITE_URL}/data/price-index.json`,
    csv: `${SITE_URL}/data/price-index.csv`,
    terms: PRICE_DATA_TERMS,
  };
}

export const usd = (n) => (n == null ? 'n/a' : `$${Math.round(Number(n)).toLocaleString('en-US')}`);

// ---- markdown rendering --------------------------------------------------

export function blockToMarkdown(block) {
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

/** One care section as markdown, headed at the given level. */
export function careSectionMarkdown(s, level = 3) {
  const out = [`${'#'.repeat(level)} ${s.title}`, '', `_Permalink: ${SITE_URL}/CareGuide/${s.id}_`, ''];
  for (const block of s.blocks) {
    const md = blockToMarkdown(block);
    if (md) out.push(md, '');
  }
  return out.join('\n');
}

export function careToMarkdown(sections) {
  const out = ['## Crested gecko care guide (full content)', ''];
  out.push(
    'Every section below is also available as its own URL at /CareGuide/<section-id>, with canonical markup and Article schema. Append .md to that URL for this markdown alone.',
    '',
  );
  for (const s of sections) out.push(careSectionMarkdown(s, 3));
  return out.join('\n');
}

/**
 * One morph as markdown. `full` adds lookalikes, identification, sources and
 * live prices: the Price Index table, or with `priceTable: false` (the morph
 * catalog files, which are CC BY 4.0) a link to the morph's rows instead.
 */
export function morphMarkdown(m, { level = 3, full = false, priceIndex = null, priceTable = true, nameOf = (s) => s } = {}) {
  const h = '#'.repeat(level);
  const out = [`${h} ${m.name}`, '', `_Permalink: ${SITE_URL}/MorphGuide/${m.slug}_`, ''];
  const facts = [];
  if (m.aliases?.length && full) facts.push(`**Also called:** ${m.aliases.join(', ')}`);
  if (m.rarity) facts.push(`**Rarity:** ${MORPH_LABELS.rarity[m.rarity] || m.rarity}`);
  if (m.inheritance) facts.push(`**Inheritance:** ${MORPH_LABELS.inheritance[m.inheritance] || m.inheritance}`);
  if (m.category) facts.push(`**Category:** ${MORPH_LABELS.category[m.category] || m.category}`);
  if (m.priceRange) facts.push(`**Typical adult price:** ${m.priceRange}`);
  if (facts.length) out.push(facts.join('  \n'), '');
  if (full && m.definition) out.push(`**Definition.** ${m.definition}`, '');
  if (m.summary) out.push(m.summary, '');
  if (m.description) out.push(m.description, '');
  if (full && m.foundationGenetics) out.push(`**Genetics models.** ${m.foundationGenetics}`, '');
  if (m.history) out.push(`**History.** ${m.history}`, '');
  if (m.keyFeatures?.length) {
    out.push('**Key features:**', m.keyFeatures.map((f) => `- ${f}`).join('\n'), '');
  }
  if (full && m.visualIdentifiers?.length) {
    out.push('**How to identify it:**', m.visualIdentifiers.map((f) => `- ${f}`).join('\n'), '');
  }
  if (full && m.lookalikes?.length) {
    out.push('**Lookalikes and how to tell them apart:**');
    out.push(
      m.lookalikes
        .filter((l) => l?.slug && l?.difference)
        .map((l) => `- ${nameOf(l.slug)} (${SITE_URL}/MorphGuide/${l.slug}): ${l.difference}`)
        .join('\n'),
      '',
    );
  }
  if (full && m.combinesWith?.length) {
    out.push(`**Often combined with:** ${m.combinesWith.map(nameOf).join(', ')}`, '');
  }
  const pointer = full && !priceTable ? priceIndexPointer(priceIndex, m) : null;
  if (pointer) {
    out.push(
      `**Asking prices.** Not part of this morph catalog. The ${pointer.name} lists current asking prices for this morph under the trait label${pointer.traits.length > 1 ? 's' : ''} ${pointer.traits.map((t) => `"${t}"`).join(' and ')}: ${pointer.json} (CSV: ${pointer.csv}). ${pointer.terms}`,
      '',
    );
  }
  if (full && priceIndex && priceTable) {
    const rows = priceRowsForMorph(priceIndex, m);
    if (rows.length) {
      out.push(
        `**Current asking prices (Geck Inspect Price Index, ${rows[0].checked_on}).** Asking prices on public crested gecko listings, converted to USD, not sale prices. ${PRICE_DATA_TERMS} Full dataset: ${SITE_URL}/data/price-index.json`,
        '',
        // Markets not fully checked for over a week, as of the index's own date.
        ...staleMarkets(priceIndex, priceIndex.generated_at)
          .filter((st) => rows.some((r) => r.market === st.market))
          .flatMap((st) => [staleMarketNote(st, MARKET_NAMES[st.market]), '']),
        '| Market | Listings | 25th percentile | Median | 75th percentile |',
        '| --- | --- | --- | --- | --- |',
        ...rows.map((r) => `| ${MARKET_NAMES[r.market] || r.market} | ${listingsCell(r)} | ${usd(r.p25)} | ${usd(r.median)} | ${usd(r.p75)} |`),
        '',
      );
    }
  }
  if (m.notes) out.push(`**Notes.** ${m.notes}`, '');
  if (full && m.sources?.length) {
    out.push('**Sources:**', m.sources.map((s) => `- ${s}`).join('\n'), '');
  }
  return out.join('\n');
}

/**
 * One morph as the morph catalog publishes it in data/morphs.json. The
 * catalog is CC BY 4.0, so it carries no Price Index numbers: priceIndex
 * points at the morph's rows in the index instead (priceIndexPointer).
 */
export function morphCatalogRecord(m, priceIndex) {
  return {
    ...m,
    url: `${SITE_URL}/MorphGuide/${m.slug}`,
    markdown: `${SITE_URL}/MorphGuide/${m.slug}.md`,
    categoryLabel: MORPH_LABELS.category[m.category] || m.category,
    inheritanceLabel: MORPH_LABELS.inheritance[m.inheritance] || m.inheritance,
    rarityLabel: MORPH_LABELS.rarity[m.rarity] || m.rarity,
    priceIndex: priceIndexPointer(priceIndex, m),
  };
}

/** One morph as the catalog's markdown files have it (llms/morphs.md, MorphGuide/<slug>.md): no price table, a link to it. */
export function morphCatalogMarkdown(m, { level = 1, priceIndex = null, nameOf = (s) => s } = {}) {
  return morphMarkdown(m, { level, full: true, priceIndex, priceTable: false, nameOf });
}

export function morphsToMarkdown(morphs, opts = {}) {
  const out = ['## Crested gecko morph catalog (full content)', ''];
  out.push(
    'Every morph has its own URL at /MorphGuide/<slug> with Article + DefinedTerm schema; append .md to that URL for the markdown alone. Category hubs are at /MorphGuide/category/<id> and inheritance hubs at /MorphGuide/inheritance/<id>.',
    '',
  );
  for (const m of morphs) out.push(morphMarkdown(m, { level: 3, ...opts }));
  return out.join('\n');
}

export function blogToMarkdown(posts) {
  if (!posts.length) return '';
  const out = ['## Crested gecko blog (long-form articles)', ''];
  out.push(
    'Editorial articles published on Geck Inspect. Each is available at /blog/<slug> with BlogPosting + FAQPage schema.',
    '',
  );
  for (const p of posts) {
    out.push(`### ${p.title}`);
    out.push('');
    out.push(`_Permalink: ${SITE_URL}/blog/${p.slug}_`);
    if (p.datePublished || p.dateModified) {
      const pub = p.datePublished ? `Published ${p.datePublished}` : '';
      const mod = p.dateModified && p.dateModified !== p.datePublished ? ` · Updated ${p.dateModified}` : '';
      out.push(`_${pub}${mod}_`);
    }
    out.push('');
    if (p.description) out.push(`> ${p.description}`, '');
    if (p.tldr.length) {
      out.push('**TL;DR:**', p.tldr.map((t) => `- ${t}`).join('\n'), '');
    }
    for (const block of p.blocks) {
      const md = blockToMarkdown(block);
      if (md) out.push(md, '');
    }
    if (p.faq.length) {
      out.push('**Frequently asked questions:**', '');
      for (const qa of p.faq) {
        out.push(`**Q: ${qa.question}**`, qa.answer, '');
      }
    }
  }
  return out.join('\n');
}

/** The price index as a markdown section. */
export function priceIndexToMarkdown(index) {
  if (!index?.latest?.length) return '';
  const out = [
    '## Geck Inspect Price Index (crested gecko asking prices)',
    '',
    `Generated ${String(index.generated_at || '').slice(0, 10)}. ${PRICE_INDEX_WHAT.replace(/^an/, 'An')} of crested geckos in the United States, South Korea, Japan and Europe, compiled by Geck Inspect. These are **asking prices** on open listings, converted to USD at stored exchange rates, not sale prices. Only full catalog checks count. ${PRICE_INDEX_SAMPLE_RULE} ${PRICE_DATA_TERMS} Cite as "Geck Inspect Price Index" with a link to ${SITE_URL}/data. JSON: ${SITE_URL}/data/price-index.json. CSV: ${SITE_URL}/data/price-index.csv.`,
    '',
  ];
  const byMarket = new Map();
  for (const r of [...index.latest].sort(byMarketOrder)) {
    if (!byMarket.has(r.market)) byMarket.set(r.market, []);
    byMarket.get(r.market).push(r);
  }
  const stale = new Map(staleMarkets(index, index.generated_at).map((st) => [st.market, st]));
  for (const [market, rows] of byMarket) {
    out.push(`### ${MARKET_NAMES[market] || market} (checked ${rows[0].checked_on})`, '');
    if (stale.has(market)) out.push(`**${staleMarketNote(stale.get(market), MARKET_NAMES[market])}**`, '');
    out.push('| Trait | Listings | 25th percentile | Median | 75th percentile |', '| --- | --- | --- | --- | --- |');
    for (const r of rows) {
      out.push(`| ${r.trait || 'All crested geckos'} | ${listingsCell(r)} | ${usd(r.p25)} | ${usd(r.median)} | ${usd(r.p75)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
