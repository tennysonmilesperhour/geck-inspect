/**
 * Pairing value: what one egg from a sire x dam pairing is worth on
 * average, from the genetics engine's odds and the median hatchling asking
 * price for each outcome's traits (the MorphMarket listing table that also
 * prices the Portfolio).
 *
 * Shared by the Pairing Planner ("Maximize predicted value") and the
 * pairing value panel on each breeding plan, so the two always agree.
 */
import { outcomeTraits, outcomeCombos } from '@/lib/genetics';
import { predictWeighted } from '@/lib/genetics/predictWeighted';
import { tagsToSpec } from '@/lib/genetics/tagTranslation';
import { basicHatchlingValue, valueFromTraitTable } from '@/lib/traitValuation';

/**
 * Odds for a pair of collection geckos. Tags go through the shared app
 * tag translation (so Soft Scale, White Wall, Phantom and Possible Het
 * tags count), and possible hets are weighted rather than dropped.
 * Throws if the engine fails, like predict().
 */
export function predictGeckoPair(sire, dam) {
  return predictWeighted(tagsToSpec(sire?.morph_tags || []), tagsToSpec(dam?.morph_tags || []));
}

export function outcomeLabel(phenotype) {
  return [outcomeTraits(phenotype), ...outcomeCombos(phenotype).map((name) => `(${name})`)].join(' ').trim();
}

/**
 * Expected value of one egg. Lethal outcomes (Super Lilly White) never
 * hatch and count as $0. An outcome whose traits match nothing in the
 * table (a plain, untraited baby) counts at `floor`.
 * Returns { perEgg, lethalShare, outcomes, groups }: outcomes sorted by
 * odds, and groups adding up the odds per trait that set the price (a
 * pairing with many genes has dozens of small outcomes, but only a few
 * price levels).
 */
export function eggValue(phenotypes, priceIndex, floor = priceIndex ? basicHatchlingValue(priceIndex) || 0 : 0) {
  let perEgg = 0;
  let lethalShare = 0;
  const outcomes = [];
  for (const ph of phenotypes || []) {
    const p = Number(ph.probability) || 0;
    if (ph.health_risk === 'lethal') {
      lethalShare += p;
      outcomes.push({ label: outcomeLabel(ph), probability: p, price: 0, lethal: true });
      continue;
    }
    const text = [outcomeTraits(ph), ...outcomeCombos(ph)].join(', ');
    // Priced as an unsexed hatchling, like hatchlingValue().
    const priced = priceIndex ? valueFromTraitTable({ morphs_traits: text, weight_grams: 5 }, priceIndex, 'breeder') : null;
    const price = priced ? priced.value : floor;
    perEgg += p * price;
    outcomes.push({
      label: outcomeLabel(ph), probability: p, price, lethal: false,
      matched: !!priced, pricedBy: priced ? priced.trait : null,
    });
  }
  outcomes.sort((a, b) => b.probability - a.probability);

  const groups = new Map();
  for (const o of outcomes) {
    const key = o.lethal ? 'lethal' : o.pricedBy || 'none';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: o.lethal ? 'Does not survive' : o.pricedBy || 'No listed trait',
        probability: 0,
        price: o.price,
        lethal: o.lethal,
      });
    }
    groups.get(key).probability += o.probability;
  }
  return {
    perEgg: Math.round(perEgg),
    lethalShare,
    outcomes,
    groups: [...groups.values()].sort((a, b) => b.probability - a.probability),
  };
}

/** Predict a sire x dam pairing and price one egg. Null if the engine fails. */
export function pairingEggValue(sire, dam, priceIndex) {
  if (!sire || !dam) return null;
  let prediction;
  try {
    prediction = predictGeckoPair(sire, dam);
  } catch {
    return null;
  }
  return eggValue(prediction?.offspring_phenotypes || [], priceIndex);
}

/**
 * Eggs from this pairing that are still worth something: incubating or
 * hatched. Hatching archives an egg, so a hatched egg counts whether or not
 * it is archived; an archived egg still marked Incubating was deleted.
 * (Counting only unarchived eggs made the value drop as eggs hatched.)
 */
export function viableEggCount(eggs = []) {
  return eggs.filter((e) => e.status === 'Hatched' || (!e.archived && e.status === 'Incubating')).length;
}
