/**
 * The predicted outcomes of one real pairing, labelled the way the
 * genetics calculator labels them. Shared by the calculator's
 * "Prediction vs reality" panel and the hatch dialog's "What hatched?"
 * question, so an outcome logged from either place uses the same names
 * (and the running comparison adds them up together).
 */
import { outcomeCombos, outcomeTraits } from '@/lib/genetics';
import { predictWeighted } from '@/lib/genetics/predictWeighted';
import { translateMorphTags } from '@/lib/genetics/tagTranslation';

/** A collection gecko's genotype spec, from its stored spec or its tags. */
export function animalToSpec(animal) {
  if (animal?.genotype_spec) return animal.genotype_spec;
  return translateMorphTags(animal?.morph_tags || []).spec;
}

/** Display name of one predicted outcome: combo names first, then traits. */
export function outcomeLabel(outcome) {
  const combos = outcomeCombos(outcome);
  if (combos.length > 0) return combos.join(' + ');
  return outcomeTraits(outcome);
}

/**
 * [{ label, probability, health_risk }] for a sire and dam, or [] when
 * neither parent has a gene the calculator can use.
 */
export function predictPairOutcomes(sire, dam) {
  if (!sire || !dam) return [];
  const sireSpec = animalToSpec(sire);
  const damSpec = animalToSpec(dam);
  if (Object.keys(sireSpec?.loci || {}).length === 0 && Object.keys(damSpec?.loci || {}).length === 0) {
    return [];
  }
  try {
    const { offspring_phenotypes } = predictWeighted(sireSpec, damSpec);
    return (offspring_phenotypes || []).map((o) => ({
      label: outcomeLabel(o),
      probability: o.probability,
      health_risk: o.health_risk,
    }));
  } catch {
    return [];
  }
}

/** The pairing_outcome_logs keys for a real pairing. */
export function outcomeLogKeys(sire, dam) {
  return {
    pairing_key: `${sire.id}|${dam.id}`,
    sire_label: (sire.morph_tags || []).join(', '),
    dam_label: (dam.morph_tags || []).join(', '),
    tag_key: [
      [...(sire.morph_tags || [])].sort().join('+').toLowerCase(),
      [...(dam.morph_tags || [])].sort().join('+').toLowerCase(),
    ].sort().join(' x '),
  };
}
