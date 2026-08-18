/**
 * Clutch Lab: the learn-mode puzzle engine.
 *
 * Pigeonetics (University of Utah) proved the format: always-solvable
 * breeding puzzles where the player picks parents with the right
 * GENOTYPES to hit a target PHENOTYPE, scored by how few crosses it
 * takes. This is that format on the real crested gecko engine.
 *
 * Design choices that keep puzzles fair:
 *   - A cross shows every DISTINCT possible offspring with its odds
 *     and the player picks which one to keep. No dice: the lesson is
 *     the genetics, not the luck (the calculator's hatch simulator
 *     teaches luck).
 *   - Every puzzle's bench provably contains the alleles the target
 *     needs, and the scripted solution in the test suite plays each
 *     puzzle to completion within par.
 */
import { WILD_TYPE } from '@/lib/genetics';
import { REVERSE_TARGETS_BY_ID, childPairDist } from './reverseSolver';
import { stateToSpec, genotypeToState, stateToChips } from './calculatorCatalog';

const MAX_OFFSPRING_OPTIONS = 32;

/** Definite genotype from a picker state (puzzles never use poss hets). */
export function genotypeFromState(state) {
  const genotype = {};
  for (const [locus, options] of Object.entries(stateToSpec(state).loci)) {
    genotype[locus] = [...options[0].pair];
  }
  return genotype;
}

/** Chips describing a bench animal, reusing the calculator vocabulary. */
export function describeGenotypeChips(genotype) {
  const state = genotypeToState(genotype);
  if (!state) return ['(not viable)'];
  const chips = stateToChips(state);
  return chips.length ? chips : ['wild-type'];
}

/**
 * All distinct offspring genotypes of a cross with probabilities,
 * across the union of both parents' loci.
 */
export function crossOptions(genotypeA, genotypeB) {
  const loci = [...new Set([...Object.keys(genotypeA), ...Object.keys(genotypeB)])];
  let options = [{ genotype: {}, p: 1 }];
  for (const locus of loci) {
    const dist = childPairDist(
      genotypeA[locus] || [WILD_TYPE, WILD_TYPE],
      genotypeB[locus] || [WILD_TYPE, WILD_TYPE],
    );
    const next = [];
    for (const o of options) {
      for (const d of dist) {
        next.push({ genotype: { ...o.genotype, [locus]: [...d.pair] }, p: o.p * d.p });
      }
    }
    options = next.sort((x, y) => y.p - x.p).slice(0, MAX_OFFSPRING_OPTIONS);
  }
  return options.map((o) => ({
    ...o,
    lethal: o.genotype.L?.[0] === 'lilly_white' && o.genotype.L?.[1] === 'lilly_white',
    chips: describeGenotypeChips(o.genotype),
  }));
}

/** Does a genotype satisfy a reverse-target's conditions? */
export function satisfiesTarget(genotype, targetId) {
  const target = REVERSE_TARGETS_BY_ID[targetId];
  if (!target) return false;
  return Object.entries(target.conditions).every(([locus, predicate]) =>
    predicate(genotype[locus] || [WILD_TYPE, WILD_TYPE]),
  );
}

/**
 * The puzzle ladder. Bench animals are defined as picker states so the
 * puzzles stay readable; `par` is the crosses an efficient solution
 * needs, and the test suite plays each solution to prove it.
 */
export const PUZZLES = [
  {
    id: 'first-lilly',
    title: 'Your first Lilly White',
    brief:
      'Lilly White needs only one copy of its gene to show. Ruru carries it; Pudding does not. Produce a Lilly White in as few crosses as you can.',
    lesson:
      'One copy of an incomplete dominant is visible, so half the eggs from Lilly White x normal are Lilly Whites. No Lilly x Lilly needed, ever.',
    par: 1,
    target: 'lilly_white',
    bench: [
      { name: 'Ruru', sex: 'M', state: { lilly_white: 'het' } },
      { name: 'Pudding', sex: 'F', state: {} },
    ],
  },
  {
    id: 'hidden-carriers',
    title: 'The hidden carriers',
    brief:
      'Miso and Mochi look completely normal, but both came from an Axanthic project. Produce a visual Axanthic.',
    lesson:
      'Recessive genes hide: two normal-looking hets throw 1 in 4 visual Axanthics. This is why lineage records matter more than looks.',
    par: 1,
    target: 'axanthic_visual',
    bench: [
      { name: 'Miso', sex: 'M', state: { axanthic: 'het' } },
      { name: 'Mochi', sex: 'F', state: { axanthic: 'het' } },
    ],
  },
  {
    id: 'safe-luwak',
    title: 'Luwak, the safe way',
    brief:
      'Kona is a Cappuccino; so is Espresso. Latte is a Sable. Produce a Luwak WITHOUT ever risking a Super Cappuccino.',
    lesson:
      'Cappuccino and Sable are versions of the same gene. Capp x Capp risks the health-compromised super; Capp x Sable makes Luwak and cannot make a super. Same locus, opposite outcomes.',
    par: 1,
    target: 'luwak',
    forbidden: {
      description: 'a pairing that can produce Super Cappuccino',
      test: (genotypeA, genotypeB) => {
        const hasCapp = (g) => (g.SABLE_COMPLEX || []).includes('cappuccino');
        return hasCapp(genotypeA) && hasCapp(genotypeB);
      },
    },
    bench: [
      { name: 'Kona', sex: 'M', state: { sable_complex: 'cappuccino' } },
      { name: 'Espresso', sex: 'F', state: { sable_complex: 'cappuccino' } },
      { name: 'Latte', sex: 'F', state: { sable_complex: 'sable' } },
    ],
  },
  {
    id: 'frappuccino',
    title: 'Order a Frappuccino',
    brief:
      'A Frappuccino is Cappuccino plus Lilly White in one gecko (it is NOT the super form of Cappuccino). Produce one from Bean and Blizzard.',
    lesson:
      'Two different genes, one gecko: a quarter of eggs carry both. The name game is marketing; the genetics is just two independent coin flips.',
    par: 1,
    target: 'frappuccino',
    bench: [
      { name: 'Bean', sex: 'M', state: { sable_complex: 'cappuccino' } },
      { name: 'Blizzard', sex: 'F', state: { lilly_white: 'het' } },
    ],
  },
  {
    id: 'axanthic-lilly',
    title: 'The two-generation project',
    brief:
      'Ghost is a visual Axanthic; Cloud is a Lilly White with no Axanthic blood. An Axanthic Lilly White is impossible in one cross. Plan the route.',
    lesson:
      'Cross one: every baby is het Axanthic, half are Lilly White. Hold back a Lilly White het Axanthic and breed it back to the visual: a quarter of those eggs are the goal. Serious projects are measured in seasons, not clutches.',
    par: 2,
    target: 'axanthic_lilly',
    bench: [
      { name: 'Ghost', sex: 'F', state: { axanthic: 'visual' } },
      { name: 'Cloud', sex: 'M', state: { lilly_white: 'het' } },
    ],
  },
  {
    id: 'phantom-frapp',
    title: 'The grail: Phantom Frappuccino',
    brief:
      'Solo is a Frappuccino. Shadow is a visual Phantom. A Phantom Frappuccino needs Cappuccino, Lilly White, AND two copies of Phantom. Get there.',
    lesson:
      'Stack a het first, then double it up: gen one makes Frappuccinos that are het Phantom, gen two crosses back to the visual Phantom. Multi-gene grails are just single-gene steps in a row.',
    par: 2,
    target: 'phantom_frappuccino',
    bench: [
      { name: 'Solo', sex: 'M', state: { sable_complex: 'cappuccino', lilly_white: 'het' } },
      { name: 'Shadow', sex: 'F', state: { phantom: 'visual' } },
    ],
  },
];

export const PUZZLES_BY_ID = Object.fromEntries(PUZZLES.map((p) => [p.id, p]));

/** Build the initial bench (name + genotype + chips) for a puzzle. */
export function initialBench(puzzle) {
  return puzzle.bench.map((animal, index) => {
    const genotype = genotypeFromState(animal.state);
    return {
      id: `start-${index}`,
      name: animal.name,
      sex: animal.sex,
      genotype,
      chips: describeGenotypeChips(genotype),
      starter: true,
    };
  });
}
