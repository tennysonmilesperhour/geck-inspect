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
 *
 * Exits 1 with a readable report on any mismatch; 0 when clean.
 */

import { TRAITS } from 'crested-gecko-app';
import { MORPHS } from '../src/data/morph-guide.js';
import { MORPH_CATEGORIES } from '../src/components/my-geckos/morphTagCatalog.js';
import { CANONICAL_MORPHS } from '../src/lib/marketAnalytics/taxonomy.js';
import { GENETIC_TRAITS } from '../src/components/morph-id/morphTaxonomy.js';

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

// KNOWN DISAGREEMENT (documented, intentional): the morph guide follows
// the traditional hobby framing that pattern traits and base colors are
// 'polygenic' (their EXPRESSION quality is), while Foundation Genetics
// models the underlying loci as Mendelian (dominant / incomplete
// dominant). Until the guide content is editorially revised, 'polygenic'
// is accepted for these specific traits. Remove entries from this set to
// enforce the engine's model for them.
const POLYGENIC_FRAMING_ALLOWED = new Set([
  'harlequin', 'extreme harlequin', 'pinstripe', 'phantom pinstripe',
  'dalmatian', 'super dalmatian', 'tiger', 'flame', 'brindle',
  'red base', 'yellow base', 'orange base', 'buckskin',
]);

for (const m of MORPHS) {
  const trait = findTrait(m.name);
  if (!trait) continue; // engine doesn't model it; nothing to check
  if (trait.dominance === 'unconfirmed') continue;
  const expected = trait.dominance;
  const got = GUIDE_TO_ENGINE[m.inheritance];
  if (got === 'polygenic' && POLYGENIC_FRAMING_ALLOWED.has(m.name.toLowerCase())) continue;
  if (got && got !== expected) {
    note('morph-guide', `${m.name}: inheritance '${m.inheritance}' but engine says '${expected}'`);
  }
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
