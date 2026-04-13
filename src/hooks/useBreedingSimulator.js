/**
 * useBreedingSimulator — Monte Carlo breeding outcome simulation.
 *
 * Given two parent geckos, runs N virtual clutches and returns
 * phenotype probability distributions as histogram-ready data.
 *
 * Pure client-side math — no API calls, no storage.
 */
import { useMemo } from 'react';

// Co-dominant traits (visual in single copy, super in double)
const CO_DOM_TRAITS = [
  'Lilly White', 'Axanthic', 'Soft Scale', 'Moonglow',
  'Cappuccino', 'Hypo', 'Translucent', 'White Wall', 'Empty Back',
];

function inferCopies(trait, tags) {
  if (tags.includes(`Super ${trait}`)) return 2;
  if (tags.includes(trait)) return 1;
  return 0;
}

function simulateSingleOffspring(sireTraits, damTraits) {
  const phenotype = new Set();

  for (const trait of CO_DOM_TRAITS) {
    const sireCopies = inferCopies(trait, sireTraits);
    const damCopies = inferCopies(trait, damTraits);
    if (sireCopies === 0 && damCopies === 0) continue;

    const sireAlleles = sireCopies === 2 ? [1, 1] : sireCopies === 1 ? [1, 0] : [0, 0];
    const damAlleles = damCopies === 2 ? [1, 1] : damCopies === 1 ? [1, 0] : [0, 0];

    const fromSire = sireAlleles[Math.random() < 0.5 ? 0 : 1];
    const fromDam = damAlleles[Math.random() < 0.5 ? 0 : 1];
    const total = fromSire + fromDam;

    if (total === 2) phenotype.add(`Super ${trait}`);
    else if (total === 1) phenotype.add(trait);
  }

  return [...phenotype].sort().join(' + ') || 'Normal';
}

function simulateClutch(sireTraits, damTraits, clutchSize) {
  const offspring = [];
  for (let i = 0; i < clutchSize; i++) {
    offspring.push(simulateSingleOffspring(sireTraits, damTraits));
  }
  return offspring;
}

/**
 * Run a Monte Carlo simulation of breeding outcomes.
 *
 * @param {object} sire - sire gecko with morph_tags[]
 * @param {object} dam - dam gecko with morph_tags[]
 * @param {number} [trials=1000] - number of virtual clutches
 * @param {number} [clutchSize=6] - eggs per clutch
 * @returns {{ phenotypeDist, traitProb, atLeastOneProb }}
 */
export function useBreedingSimulator(sire, dam, trials = 1000, clutchSize = 6) {
  return useMemo(() => {
    if (!sire || !dam) return null;

    const sireTraits = sire.morph_tags || [];
    const damTraits = dam.morph_tags || [];

    // Count how many times each phenotype appears across all offspring
    const phenotypeCounts = {};
    // Count how many clutches contain at least one of each trait
    const traitInClutch = {};
    const totalOffspring = trials * clutchSize;

    for (let t = 0; t < trials; t++) {
      const clutch = simulateClutch(sireTraits, damTraits, clutchSize);
      const clutchTraitsSeen = new Set();

      for (const pheno of clutch) {
        phenotypeCounts[pheno] = (phenotypeCounts[pheno] || 0) + 1;
        // Track individual traits for "at least one" probability
        for (const part of pheno.split(' + ')) {
          clutchTraitsSeen.add(part);
        }
      }

      for (const trait of clutchTraitsSeen) {
        traitInClutch[trait] = (traitInClutch[trait] || 0) + 1;
      }
    }

    // Phenotype distribution: what % of all offspring have this phenotype
    const phenotypeDist = Object.entries(phenotypeCounts)
      .map(([phenotype, count]) => ({
        phenotype,
        count,
        percent: Math.round((count / totalOffspring) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // Per-trait probability: what % of clutches contain at least one
    const atLeastOneProb = Object.entries(traitInClutch)
      .filter(([trait]) => trait !== 'Normal')
      .map(([trait, clutches]) => ({
        trait,
        probability: Math.round((clutches / trials) * 1000) / 10,
      }))
      .sort((a, b) => b.probability - a.probability);

    return { phenotypeDist, atLeastOneProb, trials, clutchSize };
  }, [sire, dam, trials, clutchSize]);
}
