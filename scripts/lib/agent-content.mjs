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

/** The committed or freshly fetched price index, or null. */
export function loadPriceIndex() {
  if (!existsSync(PRICE_INDEX)) return null;
  try {
    const data = JSON.parse(readFileSync(PRICE_INDEX, 'utf8'));
    return Array.isArray(data?.latest) ? data : null;
  } catch {
    return null;
  }
}

export const MARKET_NAMES = { US: 'United States', KR: 'South Korea', JP: 'Japan', EU: 'Europe' };
const MARKET_ORDER = Object.keys(MARKET_NAMES);
const byMarketOrder = (a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market);

// Market trait names that differ from the morph guide's name or aliases.
const MARKET_TRAIT_TO_SLUG = {
  'tri-color': 'tricolor',
  phantom: 'phantom-pinstripe',
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

/** One morph as markdown. `full` adds lookalikes, identification, sources and live prices. */
export function morphMarkdown(m, { level = 3, full = false, priceIndex = null, nameOf = (s) => s } = {}) {
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
  if (full && priceIndex) {
    const rows = priceRowsForMorph(priceIndex, m);
    if (rows.length) {
      out.push(
        `**Current asking prices (Geck Inspect Price Index, ${rows[0].checked_on}).** Asking prices on public crested gecko listings, converted to USD, not sale prices. Full dataset: ${SITE_URL}/data/price-index.json`,
        '',
        '| Market | Listings | 25th percentile | Median | 75th percentile |',
        '| --- | --- | --- | --- | --- |',
        ...rows.map((r) => `| ${MARKET_NAMES[r.market] || r.market} | ${r.listings} | ${usd(r.p25)} | ${usd(r.median)} | ${usd(r.p75)} |`),
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
    `Generated ${String(index.generated_at || '').slice(0, 10)}. Original data compiled by Geck Inspect from public crested gecko listings on the largest online reptile marketplaces in the United States, South Korea, Japan and Europe. These are **asking prices** on open listings, converted to USD at stored exchange rates, not sale prices. Only full catalog checks count, and a trait is shown only with at least 5 listings. Cite as "Geck Inspect Price Index" with a link to ${SITE_URL}/data. JSON: ${SITE_URL}/data/price-index.json. CSV: ${SITE_URL}/data/price-index.csv.`,
    '',
  ];
  const byMarket = new Map();
  for (const r of [...index.latest].sort(byMarketOrder)) {
    if (!byMarket.has(r.market)) byMarket.set(r.market, []);
    byMarket.get(r.market).push(r);
  }
  for (const [market, rows] of byMarket) {
    out.push(`### ${MARKET_NAMES[market] || market} (checked ${rows[0].checked_on})`, '');
    out.push('| Trait | Listings | 25th percentile | Median | 75th percentile |', '| --- | --- | --- | --- | --- |');
    for (const r of rows) {
      out.push(`| ${r.trait || 'All crested geckos'} | ${r.listings} | ${usd(r.p25)} | ${usd(r.median)} | ${usd(r.p75)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
