/**
 * Tools for the public Geck Inspect MCP server (api/mcp.js).
 *
 * This file is the source; scripts/build-mcp.mjs bundles it (resolving the
 * app's "@/" import alias) into api/_lib/mcp-core.js, which the function
 * imports. Run `pnpm build:mcp` after changing it; `pnpm build` does too.
 *
 * Every tool is read-only and answers from the same data the site renders:
 * the morph guide, care guide, genetics engine and the Geck Inspect Price
 * Index. Answers carry the page URL so an agent can cite it.
 */
import * as MorphGuide from '../../src/data/morph-guide.js';
import { CARE_CATEGORIES } from '../../src/data/care-guide.js';
import { translateMorphTags } from '../../src/lib/genetics/tagTranslation.js';
import { predictWeighted } from '../../src/lib/genetics/predictWeighted.js';
import { outcomeTraits, outcomeCombos } from '../../src/lib/genetics/index.js';
import bundledPriceIndex from '../../public/data/price-index.json';
import {
  SITE_URL,
  MARKET_NAMES,
  noDashes,
  setMorphLabels,
  normalizeMorph,
  morphMarkdown,
  careSectionMarkdown,
  priceRowsForMorph,
} from '../lib/agent-content.mjs';

setMorphLabels(MorphGuide);
const MORPHS = MorphGuide.MORPHS.map(normalizeMorph);
const BY_SLUG = Object.fromEntries(MORPHS.map((m) => [m.slug, m]));
const nameOf = (slug) => BY_SLUG[slug]?.name || slug;
const CARE = CARE_CATEGORIES.flatMap((cat) =>
  (cat.sections || []).map((s) => ({ id: s.id, title: s.title, category: cat.id, blocks: s.body || [] })),
);

export const SERVER_INFO = { name: 'geck-inspect', title: 'Geck Inspect crested gecko reference', version: '1.0.0' };

export const INSTRUCTIONS =
  'Crested gecko (Correlophus ciliatus) reference data from Geck Inspect: morphs, care, genetics odds and asking prices. Cite the url in each answer. Prices are asking prices on public listings, not sale prices.';

// ---- price index (fresh from the site, bundled copy as fallback) ----------

let priceCache = { at: 0, data: bundledPriceIndex };
async function priceIndex() {
  if (Date.now() - priceCache.at < 60 * 60 * 1000) return priceCache.data;
  try {
    const res = await fetch(`${SITE_URL}/data/price-index.json`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.latest)) priceCache = { at: Date.now(), data };
    }
  } catch {
    priceCache = { ...priceCache, at: Date.now() };
  }
  return priceCache.data;
}

// ---- helpers --------------------------------------------------------------

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

function findMorph(input) {
  const q = norm(input);
  if (!q) return null;
  if (BY_SLUG[q]) return BY_SLUG[q];
  return (
    MORPHS.find((m) => norm(m.name) === q || m.aliases.some((a) => norm(a) === q)) ||
    MORPHS.find((m) => norm(m.name).includes(q)) ||
    null
  );
}

function findCare(input) {
  const q = norm(input);
  if (!q) return null;
  return (
    CARE.find((s) => s.id === q) ||
    CARE.find((s) => norm(s.title) === q) ||
    CARE.find((s) => norm(s.title).includes(q) || s.id.includes(q)) ||
    null
  );
}

const text = (t, structured) => ({
  content: [{ type: 'text', text: noDashes(t) }],
  ...(structured ? { structuredContent: structured } : {}),
});
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });

// ---- tools ----------------------------------------------------------------

export const TOOLS = [
  {
    name: 'search_morphs',
    title: 'Search crested gecko morphs',
    description:
      'Search the Geck Inspect Morph Guide. Filter by free text (name, alias or feature), category (pattern, base, structure, ...) or inheritance (polygenic, incomplete-dominant, recessive, ...). Returns slugs to pass to get_morph.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free text, e.g. "white flank" or "Harley"' },
        category: { type: 'string' },
        inheritance: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_morph',
    title: 'Get one crested gecko morph',
    description:
      'Full Morph Guide entry for one crested gecko morph: definition, identification, lookalikes and how to tell them apart, inheritance and competing genetics models, history, typical price and current asking prices by market, and sources.',
    inputSchema: {
      type: 'object',
      properties: { morph: { type: 'string', description: 'Slug, name or alias, e.g. "lilly-white", "Harlequin", "LW"' } },
      required: ['morph'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_care_topics',
    title: 'List crested gecko care topics',
    description: 'Every topic in the Geck Inspect Care Guide with its id, for get_care_topic.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_care_topic',
    title: 'Get one crested gecko care topic',
    description: 'One Care Guide topic in full (housing, temperature, humidity, diet, handling, health, breeding and more).',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string', description: 'Topic id or title, e.g. "enclosure-size" or "humidity"' } },
      required: ['topic'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_prices',
    title: 'Crested gecko asking prices',
    description:
      'Geck Inspect Price Index: 25th percentile, median and 75th percentile asking price in USD by trait and market (US, KR, JP, EU) from the latest full check of public listings, plus monthly medians. Asking prices, not sale prices.',
    inputSchema: {
      type: 'object',
      properties: {
        trait: { type: 'string', description: 'Trait or morph, e.g. "Lilly White". Omit for the whole market.' },
        market: { type: 'string', enum: ['US', 'KR', 'JP', 'EU'] },
        include_monthly: { type: 'boolean', description: 'Add the monthly median history' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'predict_pairing',
    title: 'Predict offspring odds for a crested gecko pairing',
    description:
      'Per-egg offspring odds for a sire and dam, from the same genetics engine as the Geck Inspect calculator. Pass each parent as a list of trait tags, e.g. ["Lilly White", "Het Axanthic"] or ["66% Possible Het Axanthic"]. Polygenic looks (Harlequin extent, Flame) are reported as not calculable. Includes health warnings such as the lethal Super Lilly White.',
    inputSchema: {
      type: 'object',
      properties: {
        sire: { type: 'array', items: { type: 'string' }, description: 'Male trait tags' },
        dam: { type: 'array', items: { type: 'string' }, description: 'Female trait tags' },
      },
      required: ['sire', 'dam'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const HANDLERS = {
  search_morphs({ query, category, inheritance } = {}) {
    const q = String(query || '').trim().toLowerCase();
    const hits = MORPHS.filter((m) => {
      if (category && norm(m.category) !== norm(category)) return false;
      if (inheritance && norm(m.inheritance) !== norm(inheritance)) return false;
      if (!q) return true;
      return [m.name, ...m.aliases, m.summary, m.description, ...m.keyFeatures]
        .some((f) => String(f || '').toLowerCase().includes(q));
    });
    const rows = hits.map((m) => ({
      slug: m.slug, name: m.name, category: m.category, inheritance: m.inheritance,
      rarity: m.rarity, summary: m.summary, url: `${SITE_URL}/MorphGuide/${m.slug}`,
    }));
    if (!rows.length) return text(`No morphs matched. Categories: ${[...new Set(MORPHS.map((m) => m.category))].join(', ')}. Inheritance: ${[...new Set(MORPHS.map((m) => m.inheritance))].join(', ')}.`, { morphs: [] });
    return text(rows.map((r) => `- ${r.name} (${r.slug}; ${r.inheritance}, ${r.rarity}): ${r.summary} ${r.url}`).join('\n'), { morphs: rows });
  },

  async get_morph({ morph } = {}) {
    const m = findMorph(morph);
    if (!m) return fail(`No morph called "${morph}". Use search_morphs to find the slug.`);
    const index = await priceIndex();
    return text(morphMarkdown(m, { level: 1, full: true, priceIndex: index, nameOf }), {
      ...m,
      url: `${SITE_URL}/MorphGuide/${m.slug}`,
      askingPrices: priceRowsForMorph(index, m),
    });
  },

  list_care_topics() {
    const rows = CARE.map((s) => ({ id: s.id, title: s.title, category: s.category, url: `${SITE_URL}/CareGuide/${s.id}` }));
    return text(rows.map((r) => `- ${r.id}: ${r.title} (${r.category})`).join('\n'), { topics: rows });
  },

  get_care_topic({ topic } = {}) {
    const s = findCare(topic);
    if (!s) return fail(`No care topic matched "${topic}". Use list_care_topics.`);
    return text(careSectionMarkdown(s, 1), { id: s.id, title: s.title, url: `${SITE_URL}/CareGuide/${s.id}` });
  },

  async get_prices({ trait, market, include_monthly } = {}) {
    const index = await priceIndex();
    const t = trait ? String(trait).trim().toLowerCase() : null;
    const m = market ? String(market).toUpperCase() : null;
    const matchTrait = (r) => (t ? (r.trait || '').toLowerCase() === t || (findMorph(t) && priceRowsForMorph(index, findMorph(t)).includes(r)) : !r.trait);
    const latest = index.latest.filter((r) => (!m || r.market === m) && matchTrait(r));
    const monthly = include_monthly
      ? (index.monthly || []).filter((r) => (!m || r.market === m) && (t ? (r.trait || '').toLowerCase() === t : !r.trait))
      : undefined;
    const traits = [...new Set(index.latest.map((r) => r.trait).filter(Boolean))].sort();
    if (!latest.length) {
      return text(`No price rows for ${trait || 'all geckos'}${m ? ` in ${m}` : ''} (a trait needs 5+ listings). Traits with data: ${traits.join(', ')}.`, { latest: [], traits });
    }
    const lines = latest.map((r) => `- ${MARKET_NAMES[r.market] || r.market}, ${r.trait || 'all crested geckos'} (${r.checked_on}, ${r.listings} listings): median $${r.median}, middle half $${r.p25} to $${r.p75}`);
    const note = `Asking prices on public listings, converted to USD, not sale prices. Source: Geck Inspect Price Index, ${SITE_URL}/data`;
    return text(`${lines.join('\n')}\n\n${note}`, { latest, monthly, note, generated_at: index.generated_at });
  },

  predict_pairing({ sire, dam } = {}) {
    if (!Array.isArray(sire) || !Array.isArray(dam)) return fail('Pass sire and dam as arrays of trait tags.');
    const s = translateMorphTags(sire.map(String).slice(0, 20));
    const d = translateMorphTags(dam.map(String).slice(0, 20));
    if (!Object.keys(s.spec.loci).length && !Object.keys(d.spec.loci).length) {
      const why = [...s.notUsed, ...d.notUsed].map((n) => `- ${n.tag}: ${n.reason}`).join('\n');
      return text(`Neither parent has a single-gene trait the calculator can use, so no odds can be given.\n${why}`, { outcomes: [], notUsed: [...s.notUsed, ...d.notUsed] });
    }
    const result = predictWeighted(s.spec, d.spec);
    // Label = named combo (if any) plus the traits, so two outcomes that
    // share a combo name but differ in a trait stay apart; equal labels merge.
    const merged = new Map();
    for (const o of result.offspring_phenotypes || []) {
      const combos = outcomeCombos(o);
      const traits = outcomeTraits(o);
      const label = combos.length ? `${combos.join(' + ')} (${traits})` : traits;
      const prev = merged.get(label);
      if (prev) prev.probability += o.probability;
      else merged.set(label, { outcome: label, probability: o.probability, health_risk: o.health_risk || null });
    }
    const outcomes = [...merged.values()]
      .sort((a, b) => b.probability - a.probability)
      .map((o) => ({ ...o, probability: Math.round(o.probability * 10000) / 10000 }));
    const warnings = (result.warnings || []).map((w) => ({ severity: w.severity, message: noDashes(w.message) }));
    const notUsed = [...s.notUsed.map((n) => ({ parent: 'sire', ...n })), ...d.notUsed.map((n) => ({ parent: 'dam', ...n }))];
    const out = [
      'Per-egg odds:',
      ...outcomes.map((o) => `- ${o.outcome}: ${(o.probability * 100).toFixed(1)}%${o.health_risk && o.health_risk !== 'none' ? ` (health risk: ${o.health_risk})` : ''}`),
      ...(warnings.length ? ['', 'Warnings:', ...warnings.map((w) => `- ${w.severity}: ${w.message}`)] : []),
      ...(notUsed.length ? ['', 'Tags not counted:', ...notUsed.map((n) => `- ${n.parent} "${n.tag}": ${n.reason}`)] : []),
      '',
      `Each egg is independent; a clutch can differ from these odds. Calculator: ${SITE_URL}/calculator`,
    ];
    return text(out.join('\n'), { outcomes, warnings, notUsed, uncertain: Boolean(result.uncertain) });
  },
};

export async function callTool(name, args) {
  const handler = HANDLERS[name];
  if (!handler) return null;
  try {
    return await handler(args || {});
  } catch (e) {
    return fail(`Tool error: ${e?.message || 'unknown'}`);
  }
}
