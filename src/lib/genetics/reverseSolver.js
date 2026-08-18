/**
 * Reverse calculator: pick a target gecko, get the pairings that
 * produce it, ranked by per-egg odds.
 *
 * Every supported target decomposes into independent per-locus
 * conditions (offspring loci assort independently), so the solver
 * computes P(target) = product over loci of P(child allele pair at
 * that locus satisfies the condition), from exact 50/50 gamete math.
 * No sampling, no brute-force prediction calls; a full enumeration of
 * candidate parents is a few thousand multiplications.
 *
 * Honesty rules baked in:
 *   - Targets are only offered where the underlying loci are
 *     Mendelian-calculable. Polygenic-dependent combos (Tricolor,
 *     Extreme Harlequin, and friends) are not offered because no
 *     honest per-egg number exists for them.
 *   - Lethal or health-compromised animals are never suggested AS
 *     parents (Super Lilly White does not exist to breed; Super
 *     Cappuccino and Super Highway are excluded on welfare grounds;
 *     Super Sable is allowed with a caution).
 *   - Pairings that produce lethal or compromised offspring as a side
 *     effect carry that number so the UI can show the cost, and safer
 *     pairings win ties.
 */
import { WILD_TYPE } from '@/lib/genetics';
import {
  SIMPLE_TRAITS,
  COMPLEX_LOCUS,
  COMPLEX_OPTIONS_BY_VALUE,
  encodeParentState,
} from './calculatorCatalog';

// ---------- child-pair math --------------------------------------------

/** Distribution of child allele pairs given two parent pairs (exact). */
export function childPairDist(sirePair, damPair) {
  const dist = new Map();
  for (const a of sirePair) {
    for (const b of damPair) {
      // Normalize unordered pair so [a,WT] and [WT,a] pool together.
      const pair = [a, b].sort();
      const key = pair.join('|');
      const entry = dist.get(key);
      if (entry) entry.p += 0.25;
      else dist.set(key, { pair, p: 0.25 });
    }
  }
  return [...dist.values()];
}

function pSatisfies(sirePair, damPair, predicate) {
  let p = 0;
  for (const { pair, p: pp } of childPairDist(sirePair, damPair)) {
    if (predicate(pair)) p += pp;
  }
  return p;
}

// Per-locus predicates
const hasAllele = (allele) => (pair) => pair[0] === allele || pair[1] === allele;
const isHom = (allele) => (pair) => pair[0] === allele && pair[1] === allele;
const isHetOnly = (allele) => (pair) =>
  (pair[0] === allele) !== (pair[1] === allele);
const isExactPair = (a, b) => {
  const want = [a, b].sort().join('|');
  return (pair) => [...pair].sort().join('|') === want;
};

// ---------- target catalog ---------------------------------------------

/**
 * Targets: { id, label, group, conditions: {locus: predicate},
 * stateHint (for display), emerging?, note? }.
 * Conditions are conjunctions; loci not listed are unconstrained.
 */
export const REVERSE_TARGETS = [
  // Single proven genes
  {
    id: 'lilly_white',
    label: 'Lilly White',
    group: 'Proven genes',
    conditions: { L: isHetOnly('lilly_white') },
    note: 'A living Lilly White always has exactly one copy; two copies are lethal in the egg.',
  },
  {
    id: 'axanthic_visual',
    label: 'Axanthic (visual)',
    group: 'Proven genes',
    conditions: { AX: isHom('axanthic') },
  },
  {
    id: 'phantom_visual',
    label: 'Phantom (visual)',
    group: 'Proven genes',
    conditions: { PH: isHom('phantom') },
  },
  {
    id: 'empty_back',
    label: 'Empty Back',
    group: 'Proven genes',
    conditions: { EB: hasAllele('empty_back') },
  },
  {
    id: 'super_empty_back',
    label: 'Super Empty Back',
    group: 'Proven genes',
    conditions: { EB: isHom('empty_back') },
  },
  // The Cappuccino complex
  {
    id: 'cappuccino',
    label: 'Cappuccino',
    group: 'Cappuccino complex',
    conditions: { [COMPLEX_LOCUS]: isExactPair('cappuccino', WILD_TYPE) },
  },
  {
    id: 'sable',
    label: 'Sable',
    group: 'Cappuccino complex',
    conditions: { [COMPLEX_LOCUS]: isExactPair('sable', WILD_TYPE) },
  },
  {
    id: 'luwak',
    label: 'Luwak (Cappuccino + Sable)',
    group: 'Cappuccino complex',
    conditions: { [COMPLEX_LOCUS]: isExactPair('cappuccino', 'sable') },
  },
  {
    id: 'super_sable',
    label: 'Super Sable',
    group: 'Cappuccino complex',
    conditions: { [COMPLEX_LOCUS]: isHom('sable') },
    note: 'Super Sable appears viable; check nostril openings at hatch on any super in this complex.',
  },
  {
    id: 'highway',
    label: 'Highway',
    group: 'Cappuccino complex',
    conditions: { [COMPLEX_LOCUS]: isExactPair('highway', WILD_TYPE) },
    emerging: true,
  },
  // Calculable combos
  {
    id: 'frappuccino',
    label: 'Frappuccino (Cappuccino + Lilly White)',
    group: 'Combos',
    conditions: {
      [COMPLEX_LOCUS]: hasAllele('cappuccino'),
      L: isHetOnly('lilly_white'),
    },
  },
  {
    id: 'phantom_frappuccino',
    label: 'Phantom Frappuccino',
    group: 'Combos',
    conditions: {
      [COMPLEX_LOCUS]: hasAllele('cappuccino'),
      L: isHetOnly('lilly_white'),
      PH: isHom('phantom'),
    },
  },
  {
    id: 'axanthic_lilly',
    label: 'Axanthic Lilly White',
    group: 'Combos',
    conditions: {
      AX: isHom('axanthic'),
      L: isHetOnly('lilly_white'),
    },
  },
  {
    id: 'phantom_lilly',
    label: 'Phantom Lilly White',
    group: 'Combos',
    conditions: {
      PH: isHom('phantom'),
      L: isHetOnly('lilly_white'),
    },
  },
  // Emerging genes
  {
    id: 'softscale',
    label: 'Soft Scale',
    group: 'Emerging genes',
    conditions: { SS: hasAllele('softscale') },
    emerging: true,
  },
  {
    id: 'super_softscale',
    label: 'Super Soft Scale',
    group: 'Emerging genes',
    conditions: { SS: isHom('softscale') },
    emerging: true,
  },
  {
    id: 'whiteout',
    label: 'Whiteout',
    group: 'Emerging genes',
    conditions: { WO: hasAllele('whiteout') },
    emerging: true,
  },
  {
    id: 'chocho_visual',
    label: 'ChoCho (visual)',
    group: 'Emerging genes',
    conditions: { CHOCHO: isHom('chocho') },
    emerging: true,
  },
];

export const REVERSE_TARGETS_BY_ID = Object.fromEntries(
  REVERSE_TARGETS.map((t) => [t.id, t]),
);

// ---------- parent candidate enumeration -------------------------------

const SIMPLE_BY_LOCUS = Object.fromEntries(SIMPLE_TRAITS.map((t) => [t.locus, t]));

/**
 * Viable parent options at a locus: [{pair, state, label, caution?}].
 * `state` is the calculatorCatalog picker state entry used to build
 * permalinks back into the forward calculator.
 */
export function parentOptionsForLocus(locus) {
  if (locus === COMPLEX_LOCUS) {
    // Every viable complex pair. Super Capp / Super Highway are
    // excluded as parents on welfare grounds (and Super Capp cannot be
    // sold on MorphMarket); Super Sable is allowed with a caution.
    return ['none', 'cappuccino', 'sable', 'highway', 'luwak', 'capp_highway', 'sable_highway', 'super_sable']
      .map((value) => {
        const opt = COMPLEX_OPTIONS_BY_VALUE[value];
        return {
          pair: [...opt.pair],
          state: value === 'none' ? {} : { sable_complex: value },
          label: value === 'none' ? 'no complex gene' : opt.label.replace(/ \(.*\)$/, ''),
          caution: value === 'super_sable' ? 'Super Sable parent: check-nostrils lineage caution.' : undefined,
        };
      });
  }
  const trait = SIMPLE_BY_LOCUS[locus];
  if (!trait) return [{ pair: [WILD_TYPE, WILD_TYPE], state: {}, label: 'wild-type' }];
  const a = trait.id;
  const options = [{ pair: [WILD_TYPE, WILD_TYPE], state: {}, label: `no ${trait.label}` }];
  if (trait.dominance === 'recessive') {
    options.push({ pair: [a, WILD_TYPE], state: { [a]: 'het' }, label: `het ${trait.label}`, invisible: true });
    options.push({ pair: [a, a], state: { [a]: 'visual' }, label: `visual ${trait.label}` });
  } else if (trait.dominance === 'incomplete_dominant') {
    options.push({ pair: [a, WILD_TYPE], state: { [a]: 'het' }, label: trait.label });
    if (!trait.super_lethal) {
      options.push({ pair: [a, a], state: { [a]: 'super' }, label: trait.super_label || `Super ${trait.label}` });
    }
    // Lethal supers (Super Lilly White) never exist as parents.
  } else {
    options.push({ pair: [a, WILD_TYPE], state: { [a]: 'visual' }, label: trait.label });
    options.push({ pair: [a, a], state: { [a]: 'hom' }, label: `${trait.label} (homozygous)` });
  }
  return options;
}

/** Per-egg probability that offspring of these parents are non-viable. */
export function lethalLoss(sireByLocus, damByLocus) {
  let pAllSurvive = 1;
  // Lilly White is the only lethal homozygote among calculable loci.
  const s = sireByLocus.L;
  const d = damByLocus.L;
  if (s && d) {
    pAllSurvive *= 1 - pSatisfies(s, d, isHom('lilly_white'));
  }
  return 1 - pAllSurvive;
}

/** Per-egg probability of health-compromised supers (Capp, Highway). */
export function compromisedRisk(sireByLocus, damByLocus) {
  const s = sireByLocus[COMPLEX_LOCUS];
  const d = damByLocus[COMPLEX_LOCUS];
  if (!s || !d) return 0;
  return (
    pSatisfies(s, d, isHom('cappuccino')) + pSatisfies(s, d, isHom('highway'))
  );
}

function describeParent(optionByLocus, loci) {
  const parts = loci
    .map((locus) => optionByLocus[locus])
    .filter((o) => o && o.label && !o.label.startsWith('no ') && o.label !== 'no complex gene' && o.label !== 'wild-type')
    .map((o) => o.label);
  return parts.length ? parts.join(', ') : 'wild-type (no target genes)';
}

function mergedState(optionByLocus, loci) {
  const state = {};
  for (const locus of loci) Object.assign(state, optionByLocus[locus]?.state || {});
  return state;
}

/**
 * Solve: enumerate viable parent combinations over the target's loci,
 * compute exact per-egg odds, and return ranked suggestions.
 *
 * @returns Array<{
 *   p, sireLabel, damLabel, sireState, damState, permalink,
 *   lethalP, compromisedP, needsProvenHet, cautions: string[]
 * }>
 */
export function solveTarget(targetId, { limit = 12 } = {}) {
  const target = REVERSE_TARGETS_BY_ID[targetId];
  if (!target) return [];
  const loci = Object.keys(target.conditions);

  // Enumerate one parent's option sets across loci (cartesian).
  let parentCombos = [{}];
  for (const locus of loci) {
    const next = [];
    for (const combo of parentCombos) {
      for (const opt of parentOptionsForLocus(locus)) {
        next.push({ ...combo, [locus]: opt });
      }
    }
    parentCombos = next;
  }

  const results = [];
  for (let i = 0; i < parentCombos.length; i++) {
    for (let j = i; j < parentCombos.length; j++) {
      const sire = parentCombos[i];
      const dam = parentCombos[j];
      let p = 1;
      for (const locus of loci) {
        p *= pSatisfies(sire[locus].pair, dam[locus].pair, target.conditions[locus]);
        if (p === 0) break;
      }
      if (p <= 0) continue;
      const sireByLocus = Object.fromEntries(loci.map((l) => [l, sire[l].pair]));
      const damByLocus = Object.fromEntries(loci.map((l) => [l, dam[l].pair]));
      const sireState = mergedState(sire, loci);
      const damState = mergedState(dam, loci);
      const alleleCount = [...Object.values(sire), ...Object.values(dam)]
        .reduce((s2, o) => s2 + o.pair.filter((x) => x !== WILD_TYPE).length, 0);
      results.push({
        p,
        sireLabel: describeParent(sire, loci),
        damLabel: describeParent(dam, loci),
        sireState,
        damState,
        permalink: `/calculator?sire=${encodeURIComponent(encodeParentState(sireState))}&dam=${encodeURIComponent(encodeParentState(damState))}`,
        lethalP: lethalLoss(sireByLocus, damByLocus),
        compromisedP: compromisedRisk(sireByLocus, damByLocus),
        needsProvenHet: [...Object.values(sire), ...Object.values(dam)].some((o) => o.invisible),
        cautions: [...Object.values(sire), ...Object.values(dam)]
          .map((o) => o.caution)
          .filter(Boolean),
        alleleCount,
      });
    }
  }

  results.sort(
    (a, b) =>
      b.p - a.p ||
      a.lethalP + a.compromisedP - (b.lethalP + b.compromisedP) ||
      a.alleleCount - b.alleleCount,
  );
  return results.slice(0, limit);
}

// ---------- collection scanning ----------------------------------------

/**
 * Rank pairings from the user's own collection for a target.
 * Geckos arrive as { id, name, sex, spec } where spec is a
 * definite-locus spec (from tagsToSpec); missing loci read wild-type.
 */
export function scanCollection(targetId, geckos, { limit = 10, maxPairs = 2500 } = {}) {
  const target = REVERSE_TARGETS_BY_ID[targetId];
  if (!target) return { results: [], truncated: false };
  const loci = Object.keys(target.conditions);

  const pairFor = (gecko, locus) => {
    const options = gecko.spec?.loci?.[locus];
    return options?.[0]?.pair || [WILD_TYPE, WILD_TYPE];
  };

  const sires = geckos.filter((g) => g.sex === 'Male' || g.sex === 'Unsexed');
  const dams = geckos.filter((g) => g.sex === 'Female' || g.sex === 'Unsexed');

  const results = [];
  let pairs = 0;
  let truncated = false;
  for (const sire of sires) {
    for (const dam of dams) {
      if (sire.id === dam.id) continue;
      if (++pairs > maxPairs) { truncated = true; break; }
      let p = 1;
      for (const locus of loci) {
        p *= pSatisfies(pairFor(sire, locus), pairFor(dam, locus), target.conditions[locus]);
        if (p === 0) break;
      }
      if (p <= 0) continue;
      const sireByLocus = Object.fromEntries(loci.map((l) => [l, pairFor(sire, l)]));
      const damByLocus = Object.fromEntries(loci.map((l) => [l, pairFor(dam, l)]));
      results.push({
        p,
        sire,
        dam,
        lethalP: lethalLoss(sireByLocus, damByLocus),
        compromisedP: compromisedRisk(sireByLocus, damByLocus),
      });
    }
    if (truncated) break;
  }

  results.sort((a, b) => b.p - a.p || a.lethalP + a.compromisedP - (b.lethalP + b.compromisedP));
  return { results: results.slice(0, limit), truncated };
}
