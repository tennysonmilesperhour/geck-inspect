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
 * expression bands, per MORPH_CALCULATOR_PLAN.md.
 */
import { getTrait, WILD_TYPE } from '@/lib/genetics';

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
      'Incomplete dominant, the first proven crested gecko gene (2012). One copy is the Lilly White look; the homozygous Super form is lethal in the egg.',
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
    confidence: 'proven',
    super_label: 'Super Empty Back',
    blurb:
      'Incomplete dominant. Reduces dorsal pattern; the Super form strips nearly all dorsal markings. Proven through AC Reptiles breeding trials.',
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
 * SABLE_COMPLEX. Cappuccino and Sable are proven allelic (the hobby's
 * first allelic complex); Highway is suspected to be a third allele,
 * flagged provisional. Compound hets can never produce a super from
 * the same pairing, which is why Capp x Sable (Luwak) is the safe way
 * to work the complex.
 */
export const COMPLEX_OPTIONS = [
  { value: 'none', label: 'No (wild-type)', pair: [WILD_TYPE, WILD_TYPE] },
  { value: 'cappuccino', label: 'Cappuccino', pair: ['cappuccino', WILD_TYPE], confidence: 'proven' },
  { value: 'sable', label: 'Sable', pair: ['sable', WILD_TYPE], confidence: 'proven' },
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
    confidence: 'proven',
  },
  {
    value: 'capp_highway',
    label: 'Cappuccino + Highway (compound)',
    pair: ['cappuccino', 'highway'],
    confidence: 'emerging',
  },
  {
    value: 'sable_highway',
    label: 'Sable + Highway (compound)',
    pair: ['sable', 'highway'],
    confidence: 'emerging',
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
    confidence: 'proven',
    caution: 'Super Sable appears viable; the community norm is to check nostril openings at hatch on any super in this complex.',
  },
  {
    value: 'super_highway',
    label: 'Super Highway (health reports)',
    pair: ['highway', 'highway'],
    confidence: 'emerging',
    caution: 'Super Highway hatchlings have reported nostril and health issues, which is itself the evidence that Highway sits in this complex.',
  },
];

export const COMPLEX_OPTIONS_BY_VALUE = Object.fromEntries(
  COMPLEX_OPTIONS.map((o) => [o.value, o]),
);

/** The complex rendered as a picker entry alongside SIMPLE_TRAITS. */
export const COMPLEX_ENTRY = {
  id: COMPLEX_ID,
  label: 'Cappuccino complex',
  locus: COMPLEX_LOCUS,
  dominance: 'incomplete_dominant',
  confidence: 'proven',
  blurb:
    'One gene, three known versions: Cappuccino and Sable are proven allelic, Highway is provisionally placed here. A gecko carries at most two, so Cappuccino x Sable makes Luwak and can never make a super.',
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
  for (const trait of SIMPLE_TRAITS) {
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
  for (const trait of SIMPLE_TRAITS) {
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
const SIMPLE_BY_ID = Object.fromEntries(SIMPLE_TRAITS.map((t) => [t.id, t]));

export function encodeParentState(state) {
  const parts = [];
  for (const [id, v] of Object.entries(state || {})) {
    if (!v || v === 'none') continue;
    if (id === COMPLEX_ID) {
      if (COMPLEX_OPTIONS_BY_VALUE[v]) parts.push(`${id}:${v}`);
    } else if (SIMPLE_BY_ID[id] && VALID_STATES.has(v)) {
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
    } else if (SIMPLE_BY_ID[id] && VALID_STATES.has(v)) {
      // Validate the state fits the trait's dominance
      const trait = SIMPLE_BY_ID[id];
      const valid = zygosityOptions(trait).some((o) => o.value === v);
      if (valid) state[id] = v;
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
      'Incomplete dominant, allelic with Cappuccino (the hobby’s first proven allelic complex). Sable x Cappuccino produces Luwak; Super Sable appears viable with a check-nostrils-at-hatch caution.',
    confidence: 'proven',
    super_lethal: false,
    defaultState: { [COMPLEX_ID]: 'sable' },
  },
  {
    slug: 'highway',
    label: 'Highway',
    blurb:
      'Provisionally a third allele in the Cappuccino complex: Super Highway health reports are the main evidence. Treated as allelic here, badged Emerging until the community settles it.',
    confidence: 'emerging',
    super_lethal: false,
    super_warning: 'Super Highway hatchlings have reported nostril and health issues.',
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
// Maps engine trait/combo ids to Morph Guide slugs where an entry
// exists today. Missing entries (sable, phantom, empty-back, luwak) are
// a content follow-up; the UI simply renders no link for those.

export const MORPH_GUIDE_SLUGS = {
  lilly_white: 'lilly-white',
  cappuccino: 'cappuccino',
  axanthic: 'axanthic',
  hypo: 'hypo',
  softscale: 'soft-scale',
  whiteout: 'white-wall',
  harlequin: 'harlequin',
  pinstripe: 'pinstripe',
  dalmatian: 'dalmatian',
  tiger: 'tiger',
  flame: 'flame',
  // combos
  frappuccino: 'frappuccino',
  tricolor: 'tricolor',
  patternless: 'patternless',
};

/** Engine trait metadata (sources, proven-by) for a catalog entry. */
export function engineTrait(idOrAllele) {
  try {
    return getTrait(idOrAllele) || null;
  } catch {
    return null;
  }
}
