#!/usr/bin/env node
/**
 * Genetics drift check.
 *
 * The Foundation Genetics engine (`crested-gecko-app`) owns genetic
 * facts. Several curated surfaces in the app restate those facts in
 * their own words; this script fails CI when any of them contradicts
 * the engine, which is how the June 2026 audit's "seven disagreeing
 * trait lists" problem stays fixed.
 *
 * Checked surfaces:
 *   1. src/data/morph-guide.js          (public morph guide content)
 *   2. src/components/my-geckos/morphTagCatalog.js  (tag picker groups)
 *   3. src/lib/marketAnalytics/taxonomy.js          (analytics kinds)
 *   4. src/components/morph-id/morphTaxonomy.js     (ML training labels)
 *   5. every tag in the tag picker, run through lib/genetics/tagTranslation.js
 *   6. the Genetics Guide (src/data/genetics-sections.jsx, genetics-jsonld.js,
 *      src/pages/GeneticsGuide.jsx)
 *   7. the genetics glossary (src/data/genetics-glossary.js)
 *   8. project lines (src/data/project-lines.js)
 *   9. the Morph Visualizer trait data (src/components/morph-visualizer/data/traits.js)
 *
 * Prose surfaces (6 to 9) follow the dual-model policy below: text may
 * call an engine-modeled gene polygenic or unproven only if the same
 * passage also names the engine's model or credits Foundation Genetics.
 *
 * Exits 1 with a readable report on any mismatch; 0 when clean.
 */

import { TRAITS } from 'crested-gecko-app';
import { MORPHS } from '../src/data/morph-guide.js';
import { MORPH_CATEGORIES } from '../src/components/my-geckos/morphTagCatalog.js';
import { CANONICAL_MORPHS } from '../src/lib/marketAnalytics/taxonomy.js';
import { GENETIC_TRAITS } from '../src/components/morph-id/morphTaxonomy.js';
import { translateMorphTags } from '../src/lib/genetics/tagTranslation.js';
import { GLOSSARY_GROUPS } from '../src/data/genetics-glossary.js';
import { PROJECT_LINES } from '../src/data/project-lines.js';
import { TRAITS_BY_ID as VISUALIZER_TRAITS_BY_ID } from '../src/components/morph-visualizer/data/traits.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const problems = [];
const note = (surface, msg) => problems.push(`[${surface}] ${msg}`);

// ---------- engine lookup tables ---------------------------------------

// App display spellings that intentionally differ from engine names.
const APP_SPELLINGS = new Map([
  ['softscale', 'soft scale'],
  ['super softscale', 'super soft scale'],
]);

const traitByName = new Map();
for (const t of TRAITS) {
  const names = [t.name, ...(t.alternate_names || [])];
  if (t.has_super_form && t.super_form_name) names.push(t.super_form_name);
  for (const n of names) traitByName.set(n.toLowerCase(), t);
  const appName = APP_SPELLINGS.get(t.name.toLowerCase());
  if (appName) traitByName.set(appName, t);
}
// Super forms in app vocabulary.
traitByName.set('super cappuccino', traitByName.get('cappuccino'));
traitByName.set('frappuccino', traitByName.get('cappuccino'));
traitByName.set('super soft scale', traitByName.get('softscale'));
traitByName.set('super empty back', traitByName.get('empty back') || traitByName.get('empty_back'));
// Decision D13: White Wall is the engine's Whiteout, and Phantom Pinstripe
// is how the recessive Phantom reads on a pinstriped animal.
traitByName.set('white wall', traitByName.get('whiteout'));
traitByName.set('super white wall', traitByName.get('whiteout'));
traitByName.set('phantom pinstripe', traitByName.get('phantom'));

const findTrait = (label) => traitByName.get(String(label).toLowerCase().trim());

// ---------- 1. morph guide content -------------------------------------
// morph-guide inheritance vocabulary -> engine dominance vocabulary.
const GUIDE_TO_ENGINE = {
  'recessive': 'recessive',
  'incomplete-dominant': 'incomplete_dominant',
  'co-dominant': 'codominant',
  'dominant': 'dominant',
  'polygenic': 'polygenic',
  'line-bred': 'polygenic', // engine models line-bred looks as polygenic
};

// DUAL-MODEL POLICY (decided 2026-06-10): where the traditional hobby
// framing ('polygenic') and the Foundation Genetics single-locus model
// disagree, the guide EXPLAINS BOTH. The entry keeps the traditional
// 'inheritance' label (which also pins the hub URL grouping) and must
// carry a `foundationGenetics` paragraph that names the engine's
// dominance model. This check enforces that the explanation exists and
// mentions the right model, so the dual framing can't silently rot.
const DOMINANCE_PHRASE = {
  incomplete_dominant: 'incomplete dominant',
  dominant: 'dominant',
  fixed_dominant: 'fixed dominant',
  recessive: 'recessive',
  polygenic: 'polygenic',
};

for (const m of MORPHS) {
  const trait = findTrait(m.name);
  if (!trait) continue; // engine doesn't model it; nothing to check
  if (trait.dominance === 'unconfirmed') continue;
  const expected = trait.dominance;
  const got = GUIDE_TO_ENGINE[m.inheritance];
  if (!got || got === expected) continue;
  if (got === 'polygenic') {
    const phrase = DOMINANCE_PHRASE[expected];
    const fg = String(m.foundationGenetics || '');
    if (!fg) {
      note('morph-guide', `${m.name}: labeled '${m.inheritance}' but engine says '${expected}'; add a foundationGenetics paragraph explaining both models`);
    } else if (!fg.toLowerCase().includes(phrase)) {
      note('morph-guide', `${m.name}: foundationGenetics paragraph does not mention the engine model '${phrase}'`);
    }
    continue;
  }
  note('morph-guide', `${m.name}: inheritance '${m.inheritance}' but engine says '${expected}'`);
}

// ---------- 2. tag picker groups ---------------------------------------
const pickerChecks = [
  ['Proven Genetics (Incomplete Dominant)', 'incomplete_dominant'],
  ['Proven Genetics (Recessive)', 'recessive'],
];
for (const [group, expected] of pickerChecks) {
  const cat = MORPH_CATEGORIES[group];
  if (!cat) { note('tag-catalog', `group '${group}' missing`); continue; }
  for (const tag of cat.morphs) {
    const trait = findTrait(tag.replace(/^Super /i, ''));
    if (!trait) continue; // curated extension (e.g. Moonglow, White Wall)
    if (trait.dominance !== 'unconfirmed' && trait.dominance !== expected) {
      note('tag-catalog', `'${tag}' sits in '${group}' but engine dominance is '${trait.dominance}'`);
    }
  }
}

// ---------- 3. market analytics kinds ----------------------------------
const KIND_TO_ENGINE = {
  'recessive': 'recessive',
  'codominant': 'codominant',
  'incomplete-dominant': 'incomplete_dominant',
};
for (const m of CANONICAL_MORPHS) {
  const engineKind = KIND_TO_ENGINE[m.kind];
  if (!engineKind) continue; // color/pattern/structural/polygenic kinds are pricing buckets, not genetics claims
  const trait = findTrait(m.name);
  if (!trait) continue;
  if (trait.dominance !== 'unconfirmed' && trait.dominance !== engineKind) {
    note('market-analytics', `${m.name}: kind '${m.kind}' but engine dominance is '${trait.dominance}'`);
  }
}

// ---------- 4. ML training labels --------------------------------------
for (const t of GENETIC_TRAITS) {
  if (!t.canonical_trait_id) continue;
  const trait = TRAITS.find((x) => x.id === t.canonical_trait_id);
  if (!trait) {
    note('morphTaxonomy', `${t.id}: canonical_trait_id '${t.canonical_trait_id}' not found in engine`);
    continue;
  }
  // Entries describing the SUPER form of a trait (e.g. Melanistic is the
  // engine's "Super Cappuccino (Melanistic)") carry the super label and
  // their own inheritance note; skip name/inheritance comparison.
  if (trait.has_super_form && trait.super_form_name &&
      trait.super_form_name.toLowerCase().includes(t.label.toLowerCase())) {
    continue;
  }
  // Labels must use the app/canonical display spelling, not drift back
  // to variants like 'Lily White'.
  const ok = [trait.name.toLowerCase(), APP_SPELLINGS.get(trait.name.toLowerCase())].filter(Boolean);
  if (!ok.some((n) => t.label.toLowerCase().includes(n.split(' (')[0]))) {
    // Allow qualified labels like 'Axanthic (VCA)' that start with the name.
    if (!t.label.toLowerCase().startsWith(trait.name.toLowerCase().split(' ')[0])) {
      note('morphTaxonomy', `${t.id}: label '${t.label}' does not match engine name '${trait.name}'`);
    }
  }
  const inh = String(t.inheritance || '').replace(/[^a-z_]/gi, '');
  if (trait.dominance !== 'unconfirmed' && inh && inh !== trait.dominance && !inh.startsWith('proto')) {
    note('morphTaxonomy', `${t.id}: inheritance '${t.inheritance}' but engine says '${trait.dominance}'`);
  }
}

// ---------- 5. every picker tag reaches the engine ---------------------
// Done-when for audit step 24: each tag produces a genotype or a visible
// "not used" reason. Tags in the proven-genetics groups must produce a
// genotype; a reason there means the group is wrong.
for (const [group, cat] of Object.entries(MORPH_CATEGORIES)) {
  for (const tag of cat.morphs) {
    const { used, notUsed, spec } = translateMorphTags([tag]);
    const hasGenotype = used.length > 0 && Object.keys(spec.loci).length > 0;
    if (!hasGenotype && notUsed.length === 0) {
      note('tag-translation', `'${tag}' neither sets a genotype nor gives a not-used reason`);
    }
    if (group.startsWith('Proven Genetics') && !hasGenotype) {
      note('tag-translation', `'${tag}' sits in '${group}' but the engine cannot compute it`);
    }
  }
}

// ---------- prose helpers (dual-model policy) ---------------------------
const MODELED = new Set(['recessive', 'dominant', 'incomplete_dominant', 'fixed_dominant']);
// Words too common in ordinary prose to treat as gene names ("fire up").
const PROSE_SKIP = new Set(['fire', 'bel', 'blizzard']);
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const proseNames = [...traitByName.entries()]
  .filter(([name, t]) => t && MODELED.has(t.dominance) && !PROSE_SKIP.has(name))
  .map(([name, t]) => ({ re: new RegExp(`\\b${escapeRe(name)}\\b`, 'i'), trait: t }));

const normalizeProse = (text) => String(text || '').toLowerCase().replace(/[-_]/g, ' ');

function mentionsModel(text, dominance) {
  let norm = normalizeProse(text);
  const phrase = DOMINANCE_PHRASE[dominance];
  if (dominance === 'dominant') {
    norm = norm.replace(/incomplete dominant|fixed dominant|co dominant|codominant/g, '');
  }
  return norm.includes(phrase);
}

const DOUBT = /\bpolygenic\b|not mendelian|not a proven|not proven|line[\s-]?bred|not a single gene|not confirmed as a single/i;

// A comma list of short phrases (SEO keywords) makes no claims.
const isKeywordList = (text) =>
  text.includes(',') && !/[.!?]/.test(text) && text.split(',').every((c) => c.trim().split(/\s+/).length <= 4);

/**
 * A sentence that calls a modeled gene polygenic or unproven must also
 * give the engine's view: name that gene's engine model in the same
 * sentence, or the passage credits Foundation Genetics (the dual-model
 * explanation). A sentence that denies the engine model outright ("not
 * a proven recessive") fails even when it names the model.
 */
function checkPassage(surface, where, text) {
  if (isKeywordList(text)) return;
  const credited = /foundation genetics/i.test(text);
  for (const sentence of String(text).split(/(?<=[.!?])\s+|\n/)) {
    const traits = new Map();
    for (const { re, trait } of proseNames) {
      if (re.test(sentence)) traits.set(trait.id, trait);
    }
    for (const trait of traits.values()) {
      const phrase = DOMINANCE_PHRASE[trait.dominance];
      const denied = new RegExp(`\\bnot (a |an )?(proven |separate |single )?${phrase}`).test(normalizeProse(sentence));
      if (denied) {
        note(surface, `${where}: denies that ${trait.name} is ${phrase}, which is the engine model`);
        continue;
      }
      if (!DOUBT.test(sentence) || credited) continue;
      if (!mentionsModel(sentence, trait.dominance)) {
        note(surface, `${where}: calls ${trait.name} polygenic or unproven without the engine model '${phrase}' (or a Foundation Genetics note)`);
      }
    }
  }
}

/** A passage about one gene must state that gene's engine model. */
function checkAbout(surface, where, label, text) {
  const name = String(label).replace(/\s*\(.*\)\s*$/, '').replace(/,.*$/, '').trim();
  // Super forms and combo names are about one form of a gene; the gene's
  // own passage carries its model.
  if (/^super\b/i.test(name) || name.toLowerCase() === 'frappuccino') return;
  const trait = findTrait(name);
  if (!trait || !MODELED.has(trait.dominance)) return;
  if (!mentionsModel(text, trait.dominance)) {
    note(surface, `${where}: about ${trait.name} but never says '${DOMINANCE_PHRASE[trait.dominance]}' (the engine model)`);
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const readSource = (rel) => readFileSync(resolve(here, '..', rel), 'utf8');

/** String literals in a source file, with line numbers. */
function stringLiterals(source) {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(source))) {
    const text = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\'/g, "'");
    if (text.length < 12) continue;
    out.push({ text, line: source.slice(0, m.index).split('\n').length });
  }
  return out;
}

// ---------- 6. Genetics Guide -----------------------------------------
const GUIDE_FILES = ['src/data/genetics-sections.jsx', 'src/data/genetics-jsonld.js', 'src/pages/GeneticsGuide.jsx'];
for (const file of GUIDE_FILES) {
  const source = readSource(file);
  for (const { text, line } of stringLiterals(source)) {
    checkPassage('genetics-guide', `${file}:${line}`, text);
  }
}
// Each guide subsection titled after a gene must state its model.
{
  const source = readSource('src/data/genetics-sections.jsx');
  const titles = [...source.matchAll(/title:\s*'((?:[^'\\]|\\.)*)'/g)];
  titles.forEach((m, idx) => {
    const end = idx + 1 < titles.length ? titles[idx + 1].index : source.length;
    const body = source.slice(m.index, end);
    const line = source.slice(0, m.index).split('\n').length;
    checkAbout('genetics-guide', `src/data/genetics-sections.jsx:${line} '${m[1]}'`, m[1], body);
  });
}

// ---------- 7. glossary -----------------------------------------------
for (const group of GLOSSARY_GROUPS) {
  for (const { term, def } of group.entries) {
    checkAbout('glossary', `'${term}'`, term, def);
    checkPassage('glossary', `'${term}'`, `${term}: ${def}`);
  }
}

// ---------- 8. project lines ------------------------------------------
const entryText = (value) => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(entryText);
  if (value && typeof value === 'object') return Object.values(value).flatMap(entryText);
  return [];
};
for (const line of PROJECT_LINES) {
  const text = entryText(line).join(' \n');
  checkPassage('project-lines', line.slug, text);
  // A line named after a gene ("Phantom Line", "Cho Cho") must say what
  // the engine says that gene is.
  checkAbout('project-lines', line.slug, line.name.replace(/\s+line$/i, ''), text);
}

// ---------- 9. Morph Visualizer trait data -----------------------------
const VISUALIZER_TYPES = new Set(['recessive', 'dominant', 'incomplete_dominant']);
for (const t of Object.values(VISUALIZER_TRAITS_BY_ID)) {
  const trait = findTrait(t.name);
  const type = t.genetics?.type;
  const summary = t.genetics?.summary || '';
  if (trait && MODELED.has(trait.dominance)) {
    if (VISUALIZER_TYPES.has(type)) {
      if (type !== trait.dominance) {
        note('visualizer', `${t.name}: type '${type}' but engine says '${trait.dominance}'`);
      }
    } else if (!mentionsModel(summary, trait.dominance)) {
      note('visualizer', `${t.name}: shown as '${type}' but the summary does not give the engine model '${DOMINANCE_PHRASE[trait.dominance]}'`);
    }
  }
  checkPassage('visualizer', t.name, `${summary} ${t.description || ''}`);
}

// 'Lily White' (one l) must never appear as a display label anywhere checked.
const allLabels = [
  ...MORPHS.map((m) => m.name),
  ...Object.values(MORPH_CATEGORIES).flatMap((c) => c.morphs),
  ...CANONICAL_MORPHS.map((m) => m.name),
  ...GENETIC_TRAITS.map((t) => t.label),
];
for (const label of allLabels) {
  if (/\blily white\b/i.test(label)) {
    note('spelling', `'${label}' uses the one-L spelling; canonical is 'Lilly White'`);
  }
}

// ---------- report ------------------------------------------------------
if (problems.length) {
  console.error(`[genetics-check] ${problems.length} inconsistencies:\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('[genetics-check] all curated surfaces agree with the Foundation Genetics engine.');
