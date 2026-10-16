/**
 * Calculator trait catalog: the single source of truth for what the
 * public Morph Calculator lets you pick, how each choice maps to a
 * genotype, and how honest the science is about it.
 *
 * Two kinds of entries:
 *   - Simple traits: one engine locus, one non-wild allele. Zygosity
 *     options depend on dominance, and recessives additionally offer
 *     probabilistic "possible het" states (66% / 50%) that expand into
 *     weighted genotype scenarios in predictWeighted.js.
 *   - The Cappuccino complex: one locus (SABLE_COMPLEX), three known
 *     alleles (Cappuccino, Sable, and the provisionally-allelic
 *     Highway). A parent picks one allele PAIR, which is how compound
 *     hets like Luwak (Cappuccino + Sable) become expressible. The
 *     old tag-string path could never represent these because the tag
 *     importer resolves one allele per tag with last-writer-wins.
 *
 * Confidence levels follow the plan's honesty pillar:
 *   'proven'   - replicated breeding-trial proof, community consensus
 *   'emerging' - documented by one or few breeders, or newly proven;
 *                computed like any gene but badged so nobody mistakes
 *                the state of the science
 * Polygenic traits (Harlequin, Pinstripe coverage, Dalmatian density,
 * base colors) are deliberately NOT in this catalog: Punnett math on
 * them would be fake precision. They arrive in a later phase as
 * expression bands, per docs/planning/MORPH_CALCULATOR_PLAN.md.
 */
// Relative, not '@/lib/genetics', so Node scripts (build-agent-data.mjs,
// prerender.mjs) can import this catalog without Vite.
import { getTrait, WILD_TYPE } from './index.js';

export const COMPLEX_LOCUS = 'SABLE_COMPLEX';
export const COMPLEX_ID = 'sable_complex';

/**
 * Simple (single-allele) traits exposed in the picker.
 * `id` doubles as the engine trait id and the allele string.
 */
export const SIMPLE_TRAITS = [
  {
    id: 'lilly_white',
    slug: 'lilly-white',
    label: 'Lilly White',
    locus: 'L',
    dominance: 'incomplete_dominant',
    confidence: 'proven',
    super_label: 'Super Lilly White',
    super_lethal: true,
    blurb:
      'Incomplete dominant, the first proven crested gecko gene (2012). One copy is the Lilly White look; the homozygous Super form is lethal (it dies in the egg or within days of hatching).',
  },
  {
    id: 'axanthic',
    slug: 'axanthic',
    label: 'Axanthic',
    locus: 'AX',
    dominance: 'recessive',
    confidence: 'proven',
    blurb:
      'Recessive. Het carriers look normal; the homozygous visual lacks red and yellow pigment for a black, white, and silver gecko.',
  },
  {
    id: 'phantom',
    slug: 'phantom',
    label: 'Phantom',
    locus: 'PH',
    dominance: 'recessive',
    confidence: 'proven',
    blurb:
      'Recessive. Visual Phantoms mute pattern color; het Phantoms look normal, which is why Phantom explains so many surprise hatchlings.',
  },
  {
    id: 'empty_back',
    slug: 'empty-back',
    label: 'Empty Back',
    locus: 'EB',
    dominance: 'incomplete_dominant',
    // Emerging, not proven: the engine's only source is Foundation
    // Genetics, and this blurb used to credit "AC Reptiles breeding
    // trials" with no source behind it (October 2026 review).
    confidence: 'emerging',
    super_label: 'Super Empty Back',
    blurb:
      'Incomplete dominant in the Foundation Genetics model, its main published source, so it is badged Emerging. Reduces dorsal pattern; the Super form is described as clearing it further and as healthy.',
  },
  {
    id: 'softscale',
    slug: 'soft-scale',
    label: 'Soft Scale',
    locus: 'SS',
    dominance: 'incomplete_dominant',
    confidence: 'emerging',
    super_label: 'Super Soft Scale',
    blurb:
      'Incomplete dominant with documented 25/50/25 ratios. The Super form has visibly softened scalation and is healthy.',
  },
  {
    id: 'whiteout',
    slug: 'whiteout',
    label: 'Whiteout',
    locus: 'WO',
    dominance: 'incomplete_dominant',
    confidence: 'emerging',
    super_label: 'Super Whiteout',
    blurb:
      'Incomplete dominant per AC Reptiles, whose data is the main documentation. Much of the hobby still treats white wall as line-bred, so this is badged Emerging.',
  },
  {
    id: 'hypo',
    slug: 'hypo',
    label: 'Hypo',
    locus: 'HYPO',
    dominance: 'dominant',
    confidence: 'emerging',
    blurb:
      'Dominant in this model. Hypomelanism has been line-bred since the early 2000s and single-gene "Genetic Hypo" claims are still being proven out, so this is badged Emerging.',
  },
  {
    id: 'chocho',
    slug: 'chocho',
    label: 'ChoCho',
    locus: 'CHOCHO',
    dominance: 'recessive',
    confidence: 'emerging',
    blurb:
      'Recessive in this model. A newer project trait with limited independent documentation, so it is badged Emerging.',
  },
];

/**
 * The Cappuccino complex: allele pairs a parent can hold at
 * SABLE_COMPLEX. Cappuccino is a proven gene. Sable being a second
 * version of the same gene (allelic) is widely reported and is how the
 * Foundation Genetics model works, but MorphMarket's Morphpedia still
 * calls it suspected, so everything that depends on it (Sable placed on
 * this gene, Luwak, Super Sable) is badged Emerging. Highway is a
 * suspected third allele, also Emerging. Pairing two different single
 * versions (Capp x Sable) cannot make a super in that pairing, which is
 * why it is the safer way to work the complex.
 */
export const COMPLEX_OPTIONS = [
  { value: 'none', label: 'No (wild-type)', pair: [WILD_TYPE, WILD_TYPE] },
  { value: 'cappuccino', label: 'Cappuccino', pair: ['cappuccino', WILD_TYPE], confidence: 'proven' },
  { value: 'sable', label: 'Sable', pair: ['sable', WILD_TYPE], confidence: 'emerging' },
  {
    value: 'highway',
    label: 'Highway (provisional allele)',
    pair: ['highway', WILD_TYPE],
    confidence: 'emerging',
  },
  {
    value: 'luwak',
    label: 'Luwak (Cappuccino + Sable)',
    pair: ['cappuccino', 'sable'],
    confidence: 'emerging',
  },
  {
    value: 'capp_highway',
    label: 'Cappuccino + Highway (compound)',
    pair: ['cappuccino', 'highway'],
    confidence: 'emerging',
    caution: 'The health of this compound is not documented yet. Check nostril openings at hatch, as with any animal carrying two versions of this gene.',
  },
  {
    value: 'sable_highway',
    label: 'Sable + Highway (compound)',
    pair: ['sable', 'highway'],
    confidence: 'emerging',
    caution: 'The health of this compound is not documented yet. Check nostril openings at hatch, as with any animal carrying two versions of this gene.',
  },
  {
    value: 'super_cappuccino',
    label: 'Super Cappuccino (severe health risk)',
    pair: ['cappuccino', 'cappuccino'],
    confidence: 'proven',
    caution: 'Super Cappuccino ("Melanistic") has documented severe health problems and cannot be sold on MorphMarket.',
  },
  {
    value: 'super_sable',
    label: 'Super Sable',
    pair: ['sable', 'sable'],
    confidence: 'emerging',
    caution: 'Super Sable appears viable but is thinly documented; the community norm is to check nostril openings at hatch on any super in this complex.',
  },
  {
    value: 'super_highway',
    label: 'Super Highway (health reports)',
    pair: ['highway', 'highway'],
    confidence: 'emerging',
    caution: 'Some breeders report nostril and health problems in Super Highway hatchlings. That is not established, and those reports are also the main reason Highway is placed in this complex.',
  },
];

export const COMPLEX_OPTIONS_BY_VALUE = Object.fromEntries(
  COMPLEX_OPTIONS.map((o) => [o.value, o]),
);

// ---------- runtime trait overrides ------------------------------------
// The genetics_trait_overrides table (loaded by traitOverrides.js) can
// patch existing traits (confidence, blurb, labels) or add provisional
// NEW simple traits without a deploy, which is how the hobby's next
// proven gene ships the day it is proven. The static SIMPLE_TRAITS
// export stays frozen for tests and build-time consumers; runtime
// surfaces read getSimpleTraits().

const TRAIT_PATCHES = new Map();
const EXTRA_TRAITS = [];

const OVERRIDE_PATCH_KEYS = new Set(['label', 'confidence', 'blurb', 'super_label', 'super_lethal']);
const VALID_DOMINANCE = new Set(['recessive', 'incomplete_dominant', 'dominant']);

/** Apply override rows ({id, patch, enabled}). Returns what applied. */
export function applyTraitOverrides(rows) {
  const applied = [];
  for (const row of rows || []) {
    if (!row?.id || row.enabled === false || !row.patch || typeof row.patch !== 'object') continue;
    const patch = row.patch;
    const existing = SIMPLE_TRAITS.find((t) => t.id === row.id);
    if (existing && !patch.new) {
      const clean = {};
      for (const key of OVERRIDE_PATCH_KEYS) {
        if (key in patch) clean[key] = patch[key];
      }
      if (Object.keys(clean).length === 0) continue;
      TRAIT_PATCHES.set(row.id, clean);
      applied.push(row.id);
    } else if (patch.new && !existing && !EXTRA_TRAITS.some((t) => t.id === row.id)) {
      // A brand-new provisional trait needs enough shape to compute.
      if (!patch.label || !patch.locus || !VALID_DOMINANCE.has(patch.dominance)) continue;
      EXTRA_TRAITS.push({
        id: row.id,
        slug: patch.slug || row.id.replace(/_/g, '-'),
        label: patch.label,
        locus: patch.locus,
        dominance: patch.dominance,
        confidence: patch.confidence === 'proven' ? 'proven' : 'emerging',
        super_label: patch.super_label,
        super_lethal: !!patch.super_lethal,
        blurb: patch.blurb || 'Provisional trait added from the live trait store.',
      });
      applied.push(row.id);
    }
  }
  return applied;
}

/** Test hook: clear runtime overrides. */
export function resetTraitOverrides() {
  TRAIT_PATCHES.clear();
  EXTRA_TRAITS.length = 0;
}

/** The live simple-trait list: static catalog + patches + additions. */
export function getSimpleTraits() {
  const patched = SIMPLE_TRAITS.map((t) =>
    TRAIT_PATCHES.has(t.id) ? { ...t, ...TRAIT_PATCHES.get(t.id) } : t,
  );
  return [...patched, ...EXTRA_TRAITS];
}

function simpleById(id) {
  return getSimpleTraits().find((t) => t.id === id) || null;
}

/** The complex rendered as a picker entry alongside SIMPLE_TRAITS. */
export const COMPLEX_ENTRY = {
  id: COMPLEX_ID,
  label: 'Cappuccino complex',
  locus: COMPLEX_LOCUS,
  dominance: 'incomplete_dominant',
  confidence: 'proven',
  blurb:
    'One gene with up to three versions: Cappuccino, plus Sable (widely reported as the same gene, still badged Emerging) and Highway (provisionally placed here). A gecko carries at most two, so Cappuccino x Sable makes Luwak and cannot make a super in that pairing.',
};

/** Zygosity states for recessive traits, including probabilistic hets. */
export const RECESSIVE_STATES = [
  { value: 'ph50', label: '50% poss het (1 in 2 chance of carrying)', weightHet: 0.5 },
  { value: 'ph66', label: '66% poss het (2 in 3 chance of carrying)', weightHet: 2 / 3 },
  { value: 'het', label: 'Het carrier (proven, 1 copy)', weightHet: 1 },
  { value: 'visual', label: 'Visual (homozygous)' },
];

export function zygosityOptions(trait) {
  const opts = [{ value: 'none', label: 'No (wild-type)' }];
  if (trait.dominance === 'recessive') {
    opts.push(...RECESSIVE_STATES.map(({ value, label }) => ({ value, label })));
  } else if (trait.dominance === 'incomplete_dominant') {
    opts.push({ value: 'het', label: 'Visual (heterozygous, 1 copy)' });
    opts.push({
      value: 'super',
      label: trait.super_lethal
        ? `${trait.super_label} (homozygous), lethal in the egg`
        : `${trait.super_label || 'Super'} (homozygous)`,
    });
  } else {
    // dominant
    opts.push({ value: 'visual', label: 'Expressing (heterozygous, 1 copy)' });
    opts.push({ value: 'hom', label: 'Expressing (homozygous, 2 copies)' });
  }
  return opts;
}

/**
 * Build a parent "spec" for predictWeighted from picker state.
 * State shape: { [traitId]: zygosityValue, sable_complex: optionValue }.
 * Returns { loci: { [locus]: [{ pair, weight }] } }; a locus with more
 * than one weighted pair encodes a possible het.
 */
export function stateToSpec(state) {
  const loci = {};
  for (const trait of getSimpleTraits()) {
    const z = state?.[trait.id];
    if (!z || z === 'none') continue;
    const a = trait.id;
    if (z === 'visual' && trait.dominance === 'recessive') {
      loci[trait.locus] = [{ pair: [a, a], weight: 1 }];
    } else if (z === 'visual' || z === 'het') {
      loci[trait.locus] = [{ pair: [a, WILD_TYPE], weight: 1 }];
    } else if (z === 'super' || z === 'hom') {
      loci[trait.locus] = [{ pair: [a, a], weight: 1 }];
    } else if (z === 'ph66' || z === 'ph50') {
      const w = z === 'ph66' ? 2 / 3 : 0.5;
      loci[trait.locus] = [
        { pair: [a, WILD_TYPE], weight: w },
        { pair: [WILD_TYPE, WILD_TYPE], weight: 1 - w },
      ];
    }
  }
  const complex = state?.[COMPLEX_ID];
  if (complex && complex !== 'none') {
    const opt = COMPLEX_OPTIONS_BY_VALUE[complex];
    if (opt) loci[COMPLEX_LOCUS] = [{ pair: [...opt.pair], weight: 1 }];
  }
  return { loci };
}

/** Human-readable chips summarizing a picker state. */
export function stateToChips(state) {
  const chips = [];
  for (const trait of getSimpleTraits()) {
    const z = state?.[trait.id];
    if (!z || z === 'none') continue;
    if (z === 'ph66') chips.push(`66% poss het ${trait.label}`);
    else if (z === 'ph50') chips.push(`50% poss het ${trait.label}`);
    else if (z === 'het' && trait.dominance === 'recessive') chips.push(`Het ${trait.label}`);
    else if (z === 'super') chips.push(trait.super_label || `Super ${trait.label}`);
    else if (z === 'hom') chips.push(`${trait.label} (homozygous)`);
    else chips.push(trait.label);
  }
  const complex = state?.[COMPLEX_ID];
  if (complex && complex !== 'none') {
    const opt = COMPLEX_OPTIONS_BY_VALUE[complex];
    if (opt) chips.push(opt.label.replace(/ \(.*\)$/, ''));
  }
  return chips;
}

/** True when the state selects anything at all. */
export function stateHasSelection(state) {
  return Object.entries(state || {}).some(([, v]) => v && v !== 'none');
}

// ---------- URL state codec --------------------------------------------
// Permalinks encode each parent as "traitId:state" pairs joined by
// commas, e.g. ?sire=lilly_white:het,axanthic:ph66&dam=sable_complex:luwak
// Unknown ids and states are dropped on decode so old links degrade
// gracefully instead of breaking.

const VALID_STATES = new Set(['het', 'visual', 'super', 'hom', 'ph66', 'ph50']);

export function encodeParentState(state) {
  const parts = [];
  for (const [id, v] of Object.entries(state || {})) {
    if (!v || v === 'none') continue;
    if (id === COMPLEX_ID) {
      if (COMPLEX_OPTIONS_BY_VALUE[v]) parts.push(`${id}:${v}`);
    } else if (simpleById(id) && VALID_STATES.has(v)) {
      parts.push(`${id}:${v}`);
    }
  }
  return parts.join(',');
}

export function decodeParentState(encoded) {
  const state = {};
  if (!encoded) return state;
  for (const part of String(encoded).split(',')) {
    const [id, v] = part.split(':').map((s) => s?.trim());
    if (!id || !v) continue;
    if (id === COMPLEX_ID && COMPLEX_OPTIONS_BY_VALUE[v]) {
      state[id] = v;
    } else if (VALID_STATES.has(v)) {
      // Validate the state fits the trait's dominance
      const trait = simpleById(id);
      const valid = trait && zygosityOptions(trait).some((o) => o.value === v);
      if (valid) state[id] = v;
    }
  }
  return state;
}

/**
 * Convert an offspring genotype (from a prediction) back into picker
 * state, so any predicted baby can become the next generation's parent
 * with one click ("continue with this offspring", the multi-generation
 * planning move). Loci outside the calculator catalog (polygenic tags
 * from collection animals) are skipped. Returns null for genotypes the
 * picker cannot represent (a lethal super parent, an unknown complex
 * pair).
 */
export function genotypeToState(genotype) {
  const state = {};
  for (const [locus, pair] of Object.entries(genotype || {})) {
    const nonWild = pair.filter((a) => a !== WILD_TYPE);
    if (nonWild.length === 0) continue;
    if (locus === COMPLEX_LOCUS) {
      const want = [...pair].sort().join('|');
      const option = COMPLEX_OPTIONS.find(
        (o) => [...o.pair].sort().join('|') === want,
      );
      if (!option || option.value === 'none') return null;
      state[COMPLEX_ID] = option.value;
      continue;
    }
    const trait = getSimpleTraits().find((t) => t.locus === locus);
    if (!trait) continue; // polygenic or unmodeled locus: skip honestly
    const copies = pair.filter((a) => a === trait.id).length;
    if (copies === 0) continue;
    if (trait.dominance === 'recessive') {
      state[trait.id] = copies === 2 ? 'visual' : 'het';
    } else if (trait.dominance === 'incomplete_dominant') {
      if (copies === 2 && trait.super_lethal) return null;
      state[trait.id] = copies === 2 ? 'super' : 'het';
    } else {
      state[trait.id] = copies === 2 ? 'hom' : 'visual';
    }
  }
  return state;
}

// ---------- SEO landing-page slugs -------------------------------------
// Every entry here gets a /calculator/<slug> route. Complex alleles get
// their own pages (people search "sable calculator", not "sable complex").
// Keep scripts/seo-routes.mjs CALCULATOR_MORPH_SLUGS in sync; the
// consistency of the two lists is asserted by a unit test.

export const CALCULATOR_PAGES = [
  ...SIMPLE_TRAITS.map((t) => ({
    slug: t.slug,
    label: t.label,
    blurb: t.blurb,
    confidence: t.confidence,
    super_lethal: !!t.super_lethal,
    defaultState: {
      [t.id]: t.dominance === 'dominant' ? 'visual' : 'het',
    },
  })),
  {
    slug: 'cappuccino',
    label: 'Cappuccino',
    blurb:
      'Incomplete dominant, allelic with Sable. The homozygous Super Cappuccino ("Melanistic") has documented severe health problems; pairing Cappuccino to Sable makes Luwak and can never make a super.',
    confidence: 'proven',
    super_lethal: false,
    super_warning:
      'Super Cappuccino has documented severe health concerns and cannot be sold on MorphMarket.',
    defaultState: { [COMPLEX_ID]: 'cappuccino' },
  },
  {
    slug: 'sable',
    label: 'Sable',
    blurb:
      'Incomplete dominant. Treated here as a second version of the Cappuccino gene, which is widely reported but not yet settled, so it is badged Emerging. Under that model Sable x Cappuccino produces Luwak; Super Sable appears viable with a check-nostrils-at-hatch caution.',
    confidence: 'emerging',
    super_lethal: false,
    defaultState: { [COMPLEX_ID]: 'sable' },
  },
  {
    slug: 'highway',
    label: 'Highway',
    blurb:
      'Provisionally a third allele in the Cappuccino complex: breeder reports of Super Highway health problems are the main evidence, and those reports are not established either. Treated as allelic here, badged Emerging until the community settles it.',
    confidence: 'emerging',
    super_lethal: false,
    super_warning: 'Some breeders report nostril and health problems in Super Highway hatchlings (not established).',
    defaultState: { [COMPLEX_ID]: 'highway' },
  },
];

export const CALCULATOR_PAGES_BY_SLUG = Object.fromEntries(
  CALCULATOR_PAGES.map((p) => [p.slug, p]),
);

// ---------- per-pairing SEO landing pages ------------------------------
// The crosses people actually search for and argue about in forums.
// Each gets a /calculator/pairing/<slug> route with both parents
// pre-filled. Keep scripts/seo-routes.mjs CALCULATOR_PAIRING_SLUGS in
// sync (asserted by unit test).

export const PAIRING_PAGES = [
  {
    slug: 'lilly-white-x-lilly-white',
    label: 'Lilly White x Lilly White',
    sire: { lilly_white: 'het' },
    dam: { lilly_white: 'het' },
    blurb:
      'The most-warned-about pairing in the hobby: 25% of eggs are lethal Super Lilly Whites that die in the egg, for the same 50% Lilly White rate a Lilly White x normal pairing gives without the losses. The math below shows exactly why breeders discourage it.',
  },
  {
    slug: 'lilly-white-x-normal',
    label: 'Lilly White x Normal',
    sire: { lilly_white: 'het' },
    dam: {},
    blurb:
      'The standard Lilly White pairing: 50% Lilly White per egg with no lethal outcomes. This is the route experienced breeders recommend over Lilly x Lilly.',
  },
  {
    slug: 'cappuccino-x-sable',
    label: 'Cappuccino x Sable',
    sire: { [COMPLEX_ID]: 'cappuccino' },
    dam: { [COMPLEX_ID]: 'sable' },
    blurb:
      'The safe way to work the Cappuccino complex: Cappuccino and Sable are different versions of the same gene, so this cross produces Luwak (25%) and can never produce a super.',
  },
  {
    slug: 'cappuccino-x-cappuccino',
    label: 'Cappuccino x Cappuccino',
    sire: { [COMPLEX_ID]: 'cappuccino' },
    dam: { [COMPLEX_ID]: 'cappuccino' },
    blurb:
      'This cross risks 25% Super Cappuccino, a homozygote with documented health problems that cannot be sold on MorphMarket. Pairing Cappuccino to Sable instead produces Luwak with no super risk.',
  },
  {
    slug: 'axanthic-x-axanthic',
    label: 'Axanthic x Axanthic',
    sire: { axanthic: 'visual' },
    dam: { axanthic: 'visual' },
    blurb:
      'Two visual Axanthics: every egg is a visual Axanthic, because both parents can only pass the Axanthic allele. Recessive genetics at its most satisfying.',
  },
  {
    slug: 'axanthic-x-het-axanthic',
    label: 'Axanthic x Het Axanthic',
    sire: { axanthic: 'visual' },
    dam: { axanthic: 'het' },
    blurb:
      'A visual bred to a proven het: 50% visual Axanthic per egg, and every non-visual baby is a guaranteed 100% het.',
  },
  {
    slug: 'het-axanthic-x-het-axanthic',
    label: 'Het Axanthic x Het Axanthic',
    sire: { axanthic: 'het' },
    dam: { axanthic: 'het' },
    blurb:
      'Two proven hets: 25% visual Axanthic per egg, and the normal-looking babies are 66% possible hets, which is where that number on sale listings comes from.',
  },
  {
    slug: 'lilly-white-x-axanthic',
    label: 'Lilly White x Axanthic',
    sire: { lilly_white: 'het' },
    dam: { axanthic: 'visual' },
    blurb:
      'The first cross of an Axanthic Lilly White project: every baby is 100% het Axanthic and half are Lilly White. The visual Axanthic Lillies come in generation two.',
  },
  {
    slug: 'phantom-x-phantom',
    label: 'Phantom x Phantom',
    sire: { phantom: 'visual' },
    dam: { phantom: 'visual' },
    blurb:
      'Two visual Phantoms: every egg is a visual Phantom. Phantom is recessive, so visuals always breed true to each other.',
  },
  {
    slug: 'frappuccino-x-normal',
    label: 'Frappuccino x Normal',
    sire: { [COMPLEX_ID]: 'cappuccino', lilly_white: 'het' },
    dam: {},
    blurb:
      'A Frappuccino carries one Cappuccino and one Lilly White allele, so bred to a normal it throws 25% Frappuccino, 25% Cappuccino, 25% Lilly White, and 25% normal.',
  },
];

export const PAIRING_PAGES_BY_SLUG = Object.fromEntries(
  PAIRING_PAGES.map((p) => [p.slug, p]),
);

// ---------- Morph Guide outcome links ----------------------------------
// Maps engine trait/combo ids to the Morph Guide page about that gene or
// combo, for "read more" links on calculator outcomes, the pairing pages
// and the calculator's gene rows. Every slug must be a real page (a test
// checks them against MORPHS), and each gene links to its own page:
// Whiteout to /MorphGuide/whiteout, Sable to /MorphGuide/sable. Until
// 16 Oct 2026 whiteout pointed at White Wall and sable had no entry, so
// those outcome links never reached the new pages.

export const MORPH_GUIDE_SLUGS = {
  lilly_white: 'lilly-white',
  cappuccino: 'cappuccino',
  sable: 'sable',
  axanthic: 'axanthic',
  hypo: 'hypo',
  softscale: 'soft-scale',
  whiteout: 'whiteout',
  phantom: 'phantom',
  empty_back: 'empty-back',
  highway: 'highway',
  harlequin: 'harlequin',
  pinstripe: 'pinstripe',
  dalmatian: 'dalmatian',
  tiger: 'tiger',
  flame: 'flame',
  // combos
  frappuccino: 'frappuccino',
  luwak: 'luwak',
  tricolor: 'tricolor',
  patternless: 'patternless',
};

// The Morph Guide entry whose price range values an outcome
// (outcomeValue.js). Kept apart from the links above so fixing a link
// cannot quietly change a season estimate: Whiteout has no guide price and
// is still valued as White Wall, the label it sells under, and Sable is
// still left out, so Sable outcomes stay unpriced until that is decided.
export const MORPH_PRICE_SLUGS = {
  ...Object.fromEntries(Object.entries(MORPH_GUIDE_SLUGS).filter(([id]) => id !== 'sable')),
  whiteout: 'white-wall',
};

// Morph Guide pages with no calculator page of their own whose look the
// calculator reads as another gene: a White Wall tag counts as Whiteout
// (decision D13), so the White Wall page keeps its /calculator/whiteout
// button. Phantom Pinstripe is left out: its page says the label does not
// prove the Phantom gene. Used by morphguide/morphCta.js and the server
// HTML (scripts/prerender.mjs).
export const GUIDE_CALCULATOR_ALIASES = {
  'white-wall': 'whiteout',
};

/** Engine trait metadata (sources, proven-by) for a catalog entry. */
export function engineTrait(idOrAllele) {
  try {
    return getTrait(idOrAllele) || null;
  } catch {
    return null;
  }
}
