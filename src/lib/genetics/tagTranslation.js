/**
 * App tag -> genetics engine translation.
 *
 * Geckos store their looks as free-text morph_tags, mostly picked from
 * the app's tag picker (components/my-geckos/morphTagCatalog.js). The
 * genetics engine reads a much smaller vocabulary, spelled its own way
 * ("Softscale", "Whiteout", "Visual Phantom"). Before this module, tags
 * the engine did not recognize were dropped without a word, so a Soft
 * Scale gecko computed as a plain normal.
 *
 * This is the ONE place that turns tags into a genotype spec. Every
 * screen that runs odds on real geckos goes through it: the calculator,
 * the plan genetics window, the Genetics tab, the Pairing Planner,
 * pairing value, waitlist odds and the reverse calculator.
 *
 * Each tag ends up in one of two lists:
 *   used     : the tag set a genotype (possibly a weighted "maybe")
 *   notUsed  : the tag cannot change the odds, with a plain reason
 *              (pattern descriptors, base color shades, unproven looks,
 *              display states). Screens show these as "N tags not used"
 *              so nothing is ever silently ignored.
 *
 * Decisions this encodes (feature-completeness audit D13):
 *   - A bare "Phantom" tag means a visual Phantom (two copies).
 *   - "White Wall" is the engine's Whiteout.
 *   - "Possible Het X" is a weighted maybe, never a confirmed het. With
 *     no number it counts as a 50% chance (a het x normal baby). A
 *     number in the tag ("66% Het Axanthic") is used as written.
 *
 * Plain JS with relative imports so the Node drift check
 * (scripts/check-genetics-consistency.mjs) can run it too.
 */
import { TRAITS, tagToGenotype, WILD_TYPE } from './index.js';
import { POSSIBLE_HET_CHANCE } from '../hetUtils.js';

/** Chance used for a "Possible Het" tag that carries no number. */
export { POSSIBLE_HET_CHANCE };

const MENDELIAN = new Set(['recessive', 'dominant', 'incomplete_dominant']);

const TRAIT_BY_NAME = new Map();
for (const trait of TRAITS) {
  TRAIT_BY_NAME.set(trait.name.toLowerCase(), trait);
  for (const alt of trait.alternate_names || []) TRAIT_BY_NAME.set(alt.toLowerCase(), trait);
}

// ---------- reasons shown for tags that are not used --------------------
const REASON = {
  pattern: 'Pattern descriptor. It describes how the gecko looks, not a gene the odds can use.',
  tiger: 'Foundation Genetics treats Tiger as present in every crested gecko, so it does not change the odds.',
  flame: 'Flame is polygenic (many small genes), so no ratio can be calculated.',
  baseShade: 'Base color shade. Only Red Base and Yellow Base are calculated.',
  phantomLook: 'Can be how a visual Phantom looks. Add a Phantom tag if this gecko is a visual Phantom.',
  spots: 'Spot descriptor. Add a Dalmatian tag if this gecko is a Dalmatian.',
  colorTrait: 'Polygenic color descriptor, so no ratio can be calculated.',
  structure: 'Line-bred structure, not a single gene.',
  marking: 'Marking descriptor. It is polygenic, so no ratio can be calculated.',
  display: 'Display or body state, not inherited.',
  unconfirmed: 'Inheritance is unconfirmed (polygenic suspected), so no ratio can be calculated.',
  moonglow: 'Moonglow is a line-bred look, not a proven gene. Tag the genes underneath it (Lilly White, for example).',
  hetOfNonGene: 'A het can only be counted for a single proven gene.',
  unknown: 'Not a gene the calculator knows.',
};

// ---------- app vocabulary -> engine tags -------------------------------
// Keys are lowercase tag bodies (after any Het / Possible Het prefix).
//   engine : engine tags fed to tagToGenotype, in order
//   note   : shown next to the odds when part of the tag is not counted
//   reason : the tag is not used at all, with this explanation
const APP_TAGS = new Map(Object.entries({
  // Spelling differences (app display spelling vs engine name)
  'soft scale': { engine: ['Softscale'] },
  'super soft scale': { engine: ['Super Softscale'] },
  // D13: White Wall is the engine's Whiteout
  'white wall': { engine: ['Whiteout'] },
  'super white wall': { engine: ['Super Whiteout'] },
  // D13: a bare Phantom tag means a visual Phantom
  'phantom': { engine: ['Visual Phantom'] },
  'visual phantom': { engine: ['Visual Phantom'] },

  // Combo names
  'frappuccino': { engine: ['Cappuccino', 'Lilly White'] },
  'cappuccino lilly white': { engine: ['Cappuccino', 'Lilly White'] },
  'lilly white cappuccino': { engine: ['Cappuccino', 'Lilly White'] },
  'axanthic lilly white': { engine: ['Axanthic', 'Lilly White'] },
  'lucy': { engine: ['Axanthic', 'Lilly White'] },
  'axanthic cappuccino': { engine: ['Axanthic', 'Cappuccino'] },
  'soft scale lilly white': { engine: ['Softscale', 'Lilly White'] },
  'soft scale cappuccino': { engine: ['Softscale', 'Cappuccino'] },
  'moonglow lilly white': {
    engine: ['Lilly White'],
    note: 'Moonglow Lilly White counted as Lilly White. Moonglow itself is a line-bred look, not a proven gene.',
  },
  'phantom frappuccino': { engine: ['Cappuccino', 'Lilly White', 'Visual Phantom'] },
  'luwak': { engine: ['Cappuccino', 'Sable'] },

  // Pattern variants of a modeled gene
  'full pinstripe': { engine: ['Pinstripe'] },
  'dashed pinstripe': { engine: ['Pinstripe'] },
  'reverse pinstripe': { engine: ['Pinstripe'] },
  'phantom pinstripe': {
    engine: ['Pinstripe'],
    note: 'Phantom Pinstripe counted as Pinstripe only. Add a Phantom tag if this gecko is a visual Phantom.',
  },
  'red harlequin': { engine: ['Harlequin'] },
  'yellow harlequin': { engine: ['Harlequin'] },
  'cream harlequin': { engine: ['Harlequin'] },
  'orange harlequin': { engine: ['Harlequin'] },
  'halloween harlequin': { engine: ['Harlequin'] },
  'extreme red harlequin': { engine: ['Extreme Harlequin'] },
  'dark red base': { engine: ['Red Base'] },
  'bright yellow base': { engine: ['Yellow Base'] },

  // Not used: pattern and marking descriptors
  'flame': { reason: REASON.flame },
  'chevron flame': { reason: REASON.flame },
  'tiger': { reason: REASON.tiger },
  'tiger striping': { reason: REASON.tiger },
  'brindle': { reason: REASON.tiger },
  'extreme brindle': { reason: REASON.tiger },
  'patternless': { reason: REASON.phantomLook },
  'bicolor': { reason: REASON.phantomLook },
  'quad stripe': { reason: REASON.pattern },
  'super stripe': { reason: REASON.pattern },

  // Not used: base color shades
  'orange base': { reason: REASON.baseShade },
  'cream base': { reason: `${REASON.baseShade} ${REASON.phantomLook}` },
  'pink base': { reason: REASON.baseShade },
  'olive base': { reason: REASON.baseShade },
  'dark olive base': { reason: REASON.baseShade },
  'green base': { reason: REASON.baseShade },
  'tan base': { reason: REASON.baseShade },
  'brown base': { reason: REASON.baseShade },
  'dark brown base': { reason: REASON.baseShade },
  'chocolate base': { reason: REASON.baseShade },
  'buckskin base': { reason: `${REASON.baseShade} ${REASON.phantomLook}` },
  'lavender base': { reason: REASON.baseShade },
  'near black base': { reason: REASON.baseShade },

  // Not used: color descriptors
  'translucent': { reason: REASON.colorTrait },
  'high white': { reason: REASON.colorTrait },
  'high contrast': { reason: REASON.colorTrait },

  // Not used: spot descriptors
  'ink spots': { reason: REASON.spots },
  'oil spots': { reason: REASON.spots },
  'red spots': { reason: REASON.spots },
  'confetti': { reason: REASON.spots },
  'spots on head': { reason: REASON.spots },
  'dalmatian tail': { reason: REASON.spots },

  // Not used: structure, markings, display state
  'crowned': { reason: REASON.structure },
  'white fringe': { reason: REASON.marking },
  'kneecaps': { reason: REASON.marking },
  'portholes': { reason: REASON.marking },
  'drippy dorsal': { reason: REASON.marking },
  'white tipped crests': { reason: REASON.marking },
  'colored crests': { reason: REASON.marking },
  'side stripe': { reason: REASON.marking },
  'banded': { reason: REASON.marking },
  'broken banding': { reason: REASON.marking },
  'chevron pattern': { reason: REASON.marking },
  'diamond pattern': { reason: REASON.marking },
  'reticulated': { reason: REASON.marking },
  'mottled': { reason: REASON.marking },
  'speckled': { reason: REASON.marking },
  'fired up': { reason: REASON.display },
  'fired down': { reason: REASON.display },
  'full tail': { reason: REASON.display },
  'tailless': { reason: REASON.display },

  // Not used: unproven looks
  'moonglow': { reason: REASON.moonglow },
  'furred': { reason: REASON.unconfirmed },
  'furry': { reason: REASON.unconfirmed },
  'harry': { reason: REASON.unconfirmed },
  'marbling': { reason: REASON.unconfirmed },
  'marble': { reason: REASON.unconfirmed },
  'snowflake': { reason: 'Snowflake inheritance is unconfirmed and it depends on White Pattern, so no ratio can be calculated.' },
}));

// ---------- tag parsing --------------------------------------------------
const PERCENT = /^(\d{1,3}(?:\.\d+)?)\s*%\s*/;
const POSSIBLE_PREFIX = /^(?:possible|poss\.?|pos\.?|probable|p\.?)\s*het\s+/i;
const HET_PREFIX = /^het\s+/i;
const HET_SUFFIX = /\s+het$/i;

function normalizeBody(text) {
  return text.trim().toLowerCase().replace(/[\s_]+/g, ' ').replace(/-/g, ' ');
}

/**
 * Split a raw tag into { kind, chance, body }.
 *   kind: 'visual' | 'het' | 'possible'
 *   chance: carrier probability for het kinds (1 for a plain het)
 */
export function parseTag(raw) {
  let text = String(raw || '').trim().replace(/\s+/g, ' ');
  let percent = null;
  const pm = text.match(PERCENT);
  if (pm) {
    percent = Number(pm[1]);
    text = text.slice(pm[0].length);
  }
  let kind = 'visual';
  if (POSSIBLE_PREFIX.test(text)) {
    kind = 'possible';
    text = text.replace(POSSIBLE_PREFIX, '');
  } else if (HET_PREFIX.test(text)) {
    kind = 'het';
    text = text.replace(HET_PREFIX, '');
  } else if (HET_SUFFIX.test(text)) {
    kind = 'het';
    text = text.replace(HET_SUFFIX, '');
  }
  let chance = 1;
  if (kind === 'possible') chance = POSSIBLE_HET_CHANCE;
  // A number only means a carrier chance on a het tag. On a plain tag it
  // is a coverage figure ("100% Pinstripe"), so it is dropped.
  if (kind !== 'visual' && percent !== null && percent > 0 && percent <= 100) {
    chance = percent / 100;
    kind = chance >= 1 ? 'het' : 'possible';
  }
  return { kind, chance, body: normalizeBody(text) };
}

// ---------- spec building ------------------------------------------------
const countCopies = (pair) => pair.filter((a) => a !== WILD_TYPE).length;
const pct = (p) => `${Math.round(p * 100)}%`;

/** Resolve a tag body to the single engine trait a het prefix refers to. */
function hetTraitFor(body) {
  const mapped = APP_TAGS.get(body);
  if (mapped?.engine?.length === 1) {
    const name = mapped.engine[0].toLowerCase().replace(/^visual\s+/, '');
    return TRAIT_BY_NAME.get(name) || null;
  }
  if (mapped) return null;
  return TRAIT_BY_NAME.get(body) || null;
}

/**
 * Merge one locus's options into the spec. Definite beats maybe; two
 * different single alleles at the allelic complex become a compound
 * (Cappuccino + Sable is a Luwak); otherwise the stronger claim wins.
 */
function mergeLocus(loci, locus, options) {
  const existing = loci[locus];
  if (!existing) {
    loci[locus] = options;
    return;
  }
  const existingDefinite = existing.length === 1;
  const newDefinite = options.length === 1;
  if (existingDefinite && !newDefinite) return;
  if (!existingDefinite && newDefinite) {
    loci[locus] = options;
    return;
  }
  if (!existingDefinite && !newDefinite) {
    const carrierWeight = (opts) => opts.filter((o) => countCopies(o.pair) > 0).reduce((s, o) => s + o.weight, 0);
    if (carrierWeight(options) > carrierWeight(existing)) loci[locus] = options;
    return;
  }
  const a = existing[0].pair;
  const b = options[0].pair;
  if (a[0] === b[0] && a[1] === b[1]) return;
  if (countCopies(a) === 1 && countCopies(b) === 1) {
    const alleleA = a.find((x) => x !== WILD_TYPE);
    const alleleB = b.find((x) => x !== WILD_TYPE);
    if (alleleA !== alleleB) {
      loci[locus] = [{ pair: [alleleA, alleleB], weight: 1 }];
    }
    return;
  }
  if (countCopies(b) > countCopies(a)) loci[locus] = options;
}

/**
 * Translate a gecko's morph_tags into an engine genotype spec.
 *
 * @param {string[]} tags
 * @returns {{
 *   spec: { loci: Record<string, Array<{pair: string[], weight: number}>> },
 *   used: Array<{ tag: string, chance: number }>,
 *   notUsed: Array<{ tag: string, reason: string }>,
 *   notes: string[],
 * }}
 */
export function translateMorphTags(tags) {
  const loci = {};
  const used = [];
  const notUsed = [];
  const notes = [];
  const seen = new Set();

  for (const raw of tags || []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const tag = raw.trim();
    const dedupeKey = tag.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const { kind, chance, body } = parseTag(tag);

    if (kind !== 'visual') {
      const trait = hetTraitFor(body);
      if (!trait || !MENDELIAN.has(trait.dominance)) {
        const mapped = APP_TAGS.get(body);
        notUsed.push({ tag, reason: mapped?.reason || REASON.hetOfNonGene });
        continue;
      }
      const carrier = [trait.id, WILD_TYPE];
      const options = chance >= 1
        ? [{ pair: carrier, weight: 1 }]
        : [
            { pair: carrier, weight: chance },
            { pair: [WILD_TYPE, WILD_TYPE], weight: 1 - chance },
          ];
      mergeLocus(loci, trait.locus, options);
      used.push({ tag, chance });
      if (chance < 1) {
        const appName = trait.name === 'Softscale' ? 'Soft Scale' : trait.name;
        let line = `${tag} counted as a ${pct(chance)} chance of carrying ${appName}.`;
        if (trait.dominance !== 'recessive') {
          line += ` One copy of ${appName} normally shows, so check the gecko.`;
        }
        notes.push(line);
      }
      continue;
    }

    const mapped = APP_TAGS.get(body);
    if (mapped?.reason) {
      notUsed.push({ tag, reason: mapped.reason });
      continue;
    }
    // One engine call per part: the engine keeps only the last tag at a
    // locus, which would turn Cappuccino + Sable (Luwak) into Sable.
    const parts = (mapped?.engine || [body]).map((t) => tagToGenotype([t]));
    if (parts.every((r) => Object.keys(r.genotype || {}).length === 0)) {
      // The engine knows the word but cannot compute it, or does not
      // know it at all.
      const known = parts.flatMap((r) => r.needs_review || []).find((n) => !/^Unknown tag/.test(n));
      notUsed.push({ tag, reason: known ? displayReason(known) : REASON.unknown });
      continue;
    }
    for (const result of parts) {
      for (const [locus, pair] of Object.entries(result.genotype || {})) {
        mergeLocus(loci, locus, [{ pair: [...pair], weight: 1 }]);
      }
    }
    used.push({ tag, chance: 1 });
    if (mapped?.note) notes.push(mapped.note);
  }

  return { spec: { loci }, used, notUsed, notes };
}

// Engine review notes use em dashes; the app does not.
function displayReason(text) {
  return String(text).replace(/\s*[\u2014\u2013]\s*/g, ', ');
}

/** Plain spec only, for callers that do not show warnings. */
export function tagsToSpec(tags) {
  return translateMorphTags(tags).spec;
}
