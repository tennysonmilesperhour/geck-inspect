/**
 * Collection-mode genotype specs with lineage-inferred possible hets.
 *
 * Explicit morph tags are the first source of truth. On top of those,
 * the hidden-het inference model (lib/genetics/hetInference.js) walks
 * up to three generations of recorded lineage and estimates the odds
 * this animal secretly carries each recessive allele. Those estimates
 * become weighted genotype scenarios, so the calculator's odds for a
 * pairing reflect what the pedigree actually implies instead of
 * treating every untagged animal as wild-type.
 *
 * Only recessives are inferred: a single copy of an incomplete
 * dominant is visible, so a hidden het for those is not a thing this
 * model should invent (explicit tags still work for them).
 */
import { TRAITS, WILD_TYPE } from '@/lib/genetics';
import { tagsToSpec } from './predictWeighted';
import { buildAncestry, inferHiddenHets } from './hetInference';

const TRAIT_BY_NAME = new Map(TRAITS.map((t) => [t.name, t]));

/**
 * Merge inferred hets into a tag-derived spec. Pure and synchronous so
 * it is unit-testable; `inferred` is the output of inferHiddenHets.
 */
export function applyInferredHets(spec, inferred) {
  const applied = [];
  for (const { traitName, probability, basis } of inferred || []) {
    const trait = TRAIT_BY_NAME.get(traitName);
    if (!trait || trait.dominance !== 'recessive') continue;
    // Explicit tags at this locus win over inference.
    if (spec.loci[trait.locus]) continue;
    if (!(probability > 0) || probability >= 1) continue;
    spec.loci[trait.locus] = [
      { pair: [trait.id, WILD_TYPE], weight: probability },
      { pair: [WILD_TYPE, WILD_TYPE], weight: 1 - probability },
    ];
    applied.push({ trait: trait.name, probability, basis });
  }
  return applied;
}

/**
 * Build the enriched spec for a collection gecko. Falls back to the
 * plain tag spec when lineage is unavailable.
 */
export async function specWithInferredHets(gecko, { GeckoEntity, maxDepth = 3 } = {}) {
  const spec = tagsToSpec(gecko?.morph_tags || []);
  let inferredHets = [];
  try {
    const ancestry = await buildAncestry(gecko?.id, { maxDepth, GeckoEntity });
    inferredHets = applyInferredHets(spec, inferHiddenHets(gecko, ancestry));
  } catch {
    // No lineage or fetch failure: tags-only spec is still correct.
  }
  return { spec, inferredHets };
}
