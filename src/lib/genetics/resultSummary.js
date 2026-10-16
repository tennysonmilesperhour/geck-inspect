/**
 * The calculator's answer in one line, for the summary that sits under
 * "Fill parents" (adversarial review, October 2026: on a phone the first
 * result rendered about 4,560 pixels below the button, with no summary).
 *
 * It runs the same engine as the full results (predictWeighted on the same
 * specs), then adds up, for each visible trait and named combo, the chance
 * that one egg shows it: "Lilly White 50%, Het Axanthic 50%, Sable 50%".
 * Whole-egg outcomes stay in the full odds below; this is the at-a-glance
 * answer a breeder asks first.
 */
import { outcomeCombos, outcomeTraits } from '@/lib/genetics';
import { predictWeighted } from '@/lib/genetics/predictWeighted';
import { animalToSpec } from '@/lib/genetics/pairOutcomes';

const WILD_TYPE = 'Wild-type';

function hasGenes(spec) {
  return Object.keys(spec?.loci || {}).length > 0;
}

/**
 * Returns null when there is nothing to calculate, otherwise:
 *   { items: [{ label, probability, lethal }], lethal: [{ label, probability }],
 *     uncertain, outcomeCount }
 * Items are sorted most likely first; "Wild-type" (an egg with none of the
 * picked genes) comes last when it is possible.
 */
export function summariseParents(sire, dam) {
  if (!sire || !dam) return null;
  const sireSpec = animalToSpec(sire);
  const damSpec = animalToSpec(dam);
  if (!hasGenes(sireSpec) && !hasGenes(damSpec)) return null;
  let prediction;
  try {
    prediction = predictWeighted(sireSpec, damSpec);
  } catch {
    return null;
  }
  return summariseOutcomes(prediction.offspring_phenotypes || [], prediction.uncertain);
}

export function summariseOutcomes(outcomes, uncertain = false) {
  const shares = new Map();
  // An item is marked lethal only when every egg that shows it dies (Super
  // Lilly White), not when it merely shares an egg with a lethal gene.
  const add = (label, probability, lethal) => {
    const entry = shares.get(label) || { label, probability: 0, lethalShare: 0 };
    entry.probability += probability;
    if (lethal) entry.lethalShare += probability;
    shares.set(label, entry);
  };
  let wildType = 0;
  const lethal = [];
  for (const o of outcomes) {
    const p = Number(o.probability) || 0;
    if (p <= 0) continue;
    const isLethal = o.health_risk === 'lethal';
    const traits = outcomeTraits(o)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (traits.length === 1 && traits[0] === WILD_TYPE) {
      wildType += p;
      continue;
    }
    for (const t of traits) add(t, p, isLethal);
    for (const combo of outcomeCombos(o)) add(combo, p, isLethal);
    if (isLethal) lethal.push({ label: traits.join(', '), probability: p });
  }
  const items = [...shares.values()]
    .map(({ label, probability, lethalShare }) => ({
      label,
      probability: Math.min(1, probability),
      lethal: lethalShare > 0 && lethalShare >= probability - 1e-9,
    }))
    .sort((a, b) => b.probability - a.probability || a.label.localeCompare(b.label));
  if (wildType > 0) items.push({ label: WILD_TYPE, probability: Math.min(1, wildType), lethal: false });
  return { items, lethal, uncertain: Boolean(uncertain), outcomeCount: outcomes.length };
}
