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
 *      src/pages/GeneticsGuide.jsx) and the search and server-HTML text
 *      built from the same facts (src/lib/geneticsGuideSeo.js, the morph
 *      snippets in src/data/morph-seo-descriptions.js, the pairing page
 *      summaries in src/lib/genetics/pairingPageSummary.js)
 *   7. the genetics glossary (src/data/genetics-glossary.js)
 *   8. project lines (src/data/project-lines.js)
 *   9. the Morph Visualizer trait data (src/components/morph-visualizer/data/traits.js)
 *   and the AI keeper assistant's server rules (supabase/functions/invoke-llm/consultant.ts)
 *
 * Prose surfaces (6 to 9, and the assistant's rules) follow the dual-model policy below: text may
 * call an engine-modeled gene polygenic or unproven only if the same
 * passage also names the engine's model or credits Foundation Genetics.
 *
 *  10. accepted facts (scripts/lib/accepted-facts.mjs): origin and history
 *      (Lilly White from Lilly Exotics, late 2010; Cappuccino from South
 *      Korea), super-form health (Super Lilly White lethal, Super
 *      Cappuccino not lethal but unhealthy, Super Highway only reported)
 *      and the husbandry numbers in src/data/husbandry-facts.js (life
 *      stages, adult weight, breeding minimum, incubation, sheds). Checked
 *      on the blog, the care guide, the Keeper's Guides, the morph guide
 *      and its search snippets, project lines, the genetics guide, its
 *      search text and glossary, the calculator and its pairing pages,
 *      llms.txt, the getting-started emails, the Weekly Gecko Notes
 *      (content/weekly-notes) and the AI prompts (Morph ID,
 *      the Promote writer, the consultant, the health screen; genetics and
 *      origin facts only for prompts).
 *
 * Runs in CI and inside `pnpm build` (through `pnpm test`: see
 * src/lib/__tests__/acceptedFacts.test.js), so a Vercel deploy enforces it.
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
import { CARE_CATEGORIES } from '../src/data/care-guide.js';
import { BLOG_POSTS } from '../src/data/blog-posts.js';
import { FEEDING_GUIDE } from '../src/data/keepers-guides/feeding.js';
import { SETUP_GUIDE } from '../src/data/keepers-guides/setup.js';
import { HANDBOOK_GUIDE } from '../src/data/keepers-guides/handbook.js';
import { MORPH_GUIDE } from '../src/data/keepers-guides/morph.js';
import { BREEDING_GUIDE } from '../src/data/keepers-guides/breeding.js';
import { checkAcceptedFacts } from './lib/accepted-facts.mjs';
import { parseNote } from './lib/weekly-notes.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
// Plus the text built for search results and server HTML from the same
// facts: the Genetics Guide's title and groups, the hand-written morph
// snippets, and the calculator pairing pages' summaries.
const GUIDE_FILES = [
  'src/data/genetics-sections.jsx',
  'src/data/genetics-jsonld.js',
  'src/pages/GeneticsGuide.jsx',
  'src/lib/geneticsGuideSeo.js',
  'src/data/morph-seo-descriptions.js',
  'src/lib/genetics/pairingPageSummary.js',
];
for (const file of GUIDE_FILES) {
  const source = readSource(file);
  for (const { text, line } of stringLiterals(source)) {
    checkPassage('genetics-guide', `${file}:${line}`, text);
  }
}
// The AI keeper assistant's rules, which live on the server since October
// 2026 (they used to be in src/pages/BreederConsultant.jsx). They told the
// model Harlequin, Pinstripe and Dalmatian "are line-bred, not single
// genes" with no word of the Foundation Genetics models.
const PROMPT_PROSE_FILES = ['supabase/functions/invoke-llm/consultant.ts'];
for (const file of PROMPT_PROSE_FILES) {
  const source = readSource(file);
  for (const { text, line } of stringLiterals(source)) {
    checkPassage('ai-prompt', `${file}:${line}`, text);
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

// ---------- 10. accepted facts ------------------------------------------
// Every string inside a data module, with a readable path to it, so the
// check reads the text as rendered (the care guide builds some of its
// sentences from husbandry-facts.js).
function* walkStrings(value, path) {
  if (typeof value === 'string') {
    yield { where: path, text: value };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const item = value[i];
      const label = item && typeof item === 'object' && (item.slug || item.id) ? `${item.slug || item.id}` : String(i);
      yield* walkStrings(item, `${path}/${label}`);
    }
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) yield* walkStrings(item, `${path}.${key}`);
  }
}

// Data modules: every rule.
const FACT_DATA = [
  ['care-guide', CARE_CATEGORIES],
  ['blog', BLOG_POSTS],
  ['morph-guide', MORPHS],
  ['project-lines', PROJECT_LINES],
  ['glossary', GLOSSARY_GROUPS],
  ['keepers-guide', [FEEDING_GUIDE, SETUP_GUIDE, HANDBOOK_GUIDE, MORPH_GUIDE, BREEDING_GUIDE]],
];
for (const [surface, data] of FACT_DATA) {
  for (const { where, text } of walkStrings(data, surface)) {
    checkAcceptedFacts(text, (msg) => note(surface, `${where}: ${msg}`));
  }
}

// Source files read as text: their string literals, with line numbers.
// `only` limits AI prompts to the genetics, origin and history facts.
const GENETICS_FACTS = ['lillyWhiteOrigin', 'superLillyWhite', 'superCappuccino', 'superHighway', 'cappuccinoOrigin', 'albinoStatus'];
const FACT_FILES = [
  ['genetics-guide', 'src/data/genetics-sections.jsx'],
  ['genetics-guide', 'src/data/genetics-jsonld.js'],
  ['genetics-guide', 'src/pages/GeneticsGuide.jsx'],
  ['calculator', 'src/pages/GeneticCalculatorTool.jsx'],
  ['calculator', 'src/lib/genetics/calculatorCatalog.js'],
  ['calculator', 'src/lib/genetics/tagTranslation.js'],
  ['calculator', 'src/lib/genetics/pairingPageSummary.js'],
  ['genetics-guide', 'src/lib/geneticsGuideSeo.js'],
  ['morph-seo', 'src/data/morph-seo-descriptions.js'],
  ['morph-faq', 'src/lib/morphFaq.js'],
  ['visualizer', 'src/components/morph-visualizer/data/traits.js'],
  ['visualizer', 'src/components/morph-visualizer/data/genetics.js'],
  ['visualizer', 'src/components/morph-visualizer/engine/compose.js'],
  ['emails', 'supabase/functions/_shared/lifecycle-copy.ts'],
  ['ai-prompt', 'src/components/morph-id/morphTaxonomy.js', GENETICS_FACTS],
  ['ai-prompt', 'supabase/functions/recognize-gecko-morph/index.ts', GENETICS_FACTS],
  // The Morph ID instructions themselves (moved out of index.ts on 17 Oct 2026).
  ['ai-prompt', 'supabase/functions/recognize-gecko-morph/request.ts', GENETICS_FACTS],
  ['ai-prompt', 'supabase/functions/generate-social-post/index.ts', GENETICS_FACTS],
  ['ai-prompt', 'supabase/functions/health-screen/index.ts', GENETICS_FACTS],
  ['ai-prompt', 'src/pages/BreederConsultant.jsx', GENETICS_FACTS],
  ['ai-prompt', 'supabase/functions/invoke-llm/consultant.ts', GENETICS_FACTS],
  ['ai-prompt', 'src/lib/assistantActions.js', GENETICS_FACTS],
];
for (const [surface, file, only] of FACT_FILES) {
  let source;
  try {
    source = readSource(file);
  } catch {
    note(surface, `${file} is missing; update FACT_FILES in this script`);
    continue;
  }
  for (const { text, line } of stringLiterals(source)) {
    checkAcceptedFacts(text, (msg) => note(surface, `${file}:${line}: ${msg}`), { only });
  }
}

// llms.txt is hand-written (its per-morph list is generated), line by line.
{
  const llms = readSource('public/llms.txt');
  llms.split('\n').forEach((text, i) => {
    checkAcceptedFacts(text, (msg) => note('llms.txt', `public/llms.txt:${i + 1}: ${msg}`));
  });
}

// Weekly Gecko Notes (content/weekly-notes/*.md), the source files, not the
// generated supabase/functions/_shared/weekly-notes.generated.ts: it holds
// the same words and would report every problem twice. Each body paragraph
// is checked as one passage, so a sentence wrapped over two lines in the
// file is still read whole; problems point at the paragraph's first line.
// The subject and both buttons' words are checked too, and so is the
// dual-model rule. The accepted facts include the husbandry numbers (the
// heat danger line, the safe incubation maximum and the weigh-in gaps), so
// a note cannot drift from src/data/husbandry-facts.js either.
{
  const dir = resolve(here, '..', 'content/weekly-notes');
  let files = [];
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
  } catch {
    note('weekly-notes', 'content/weekly-notes is missing; the Weekly Gecko Notes must be checked');
  }
  if (!files.length && existsSync(dir)) note('weekly-notes', 'content/weekly-notes has no notes');
  for (const name of files) {
    const rel = `content/weekly-notes/${name}`;
    const parsed = parseNote(name, readFileSync(resolve(dir, name), 'utf8'));
    // The subject and both buttons' words, each on its own front matter line.
    const fileLines = readFileSync(resolve(dir, name), 'utf8').split('\n');
    for (const [key, value] of [['subject', parsed.subject], ['cta', parsed.cta], ['cta_no_gecko', parsed.ctaNoGecko]]) {
      if (!value) continue;
      const line = fileLines.findIndex((l) => l.startsWith(`${key}: `)) + 1;
      checkAcceptedFacts(value, (msg) => note('weekly-notes', `${rel}:${line}: ${msg}`));
      checkPassage('weekly-notes', `${rel}:${line}`, value);
    }
    for (const paragraph of parsed.paragraphs) {
      checkAcceptedFacts(paragraph.text, (msg) => note('weekly-notes', `${rel}:${paragraph.line}: ${msg}`));
      checkPassage('weekly-notes', `${rel}:${paragraph.line}`, paragraph.text);
    }
  }
}

// ---------- report ------------------------------------------------------
if (problems.length) {
  console.error(`[genetics-check] ${problems.length} inconsistencies:\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('[genetics-check] all curated surfaces agree with the Foundation Genetics engine.');
