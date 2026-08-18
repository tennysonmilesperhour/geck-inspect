/**
 * useBreedingSimulator, season-level breeding outcome simulation.
 *
 * Crested geckos lay 2-egg clutches, so the simulator's unit is a
 * SEASON (N clutches x 2 eggs), not an arbitrary clutch size. The
 * per-egg distribution comes from the shared weighted prediction
 * (`predictWeighted`), which handles possible hets and the Cappuccino
 * complex; Monte Carlo sampling then shows what real seasons look
 * like, while the at-least-one probabilities are computed exactly
 * (1 - (1-p)^n) so they carry no sampling noise.
 */
import { useMemo } from 'react';
import { getComboMorph } from '@/lib/genetics';
import { predictWeighted, tagsToSpec } from '@/lib/genetics/predictWeighted';
import { EGGS_PER_CLUTCH, pAtLeastOne } from '@/lib/genetics/clutchMath';

function animalToSpec(animal) {
  if (animal?.genotype_spec) return animal.genotype_spec;
  return tagsToSpec(animal?.morph_tags || []);
}

function sampleFromDistribution(phenotypes, r) {
  let cumulative = 0;
  for (const p of phenotypes) {
    cumulative += p.probability;
    if (r <= cumulative) return p;
  }
  return phenotypes[phenotypes.length - 1];
}

/**
 * @param {object} sire - gecko with morph_tags[] or genotype_spec
 * @param {object} dam - gecko with morph_tags[] or genotype_spec
 * @param {number} [trials=1000] - number of simulated seasons
 * @param {number} [clutchCount=8] - clutches per simulated season
 */
export function useBreedingSimulator(sire, dam, trials = 1000, clutchCount = 8) {
  return useMemo(() => {
    if (!sire || !dam) return null;

    let prediction;
    try {
      prediction = predictWeighted(animalToSpec(sire), animalToSpec(dam));
    } catch {
      return null;
    }
    const phenotypes = prediction.offspring_phenotypes || [];
    const warnings = prediction.warnings || [];
    const eggsPerSeason = clutchCount * EGGS_PER_CLUTCH;

    if (phenotypes.length === 0) {
      return {
        phenotypeDist: [], atLeastOne: [], trials, clutchCount, eggsPerSeason, warnings,
      };
    }

    // Exact per-egg probability per combo morph, for noise-free
    // at-least-one numbers.
    const comboP = Object.create(null);
    for (const p of phenotypes) {
      for (const combo of p.matching_combo_morphs || []) {
        comboP[combo] = (comboP[combo] || 0) + p.probability;
      }
    }
    const atLeastOne = Object.entries(comboP)
      .map(([combo, p]) => ({
        trait: getComboMorph(combo)?.name || combo,
        perEgg: Math.round(p * 1000) / 10,
        perClutch: Math.round(pAtLeastOne(p, EGGS_PER_CLUTCH) * 1000) / 10,
        perSeason: Math.round(pAtLeastOne(p, eggsPerSeason) * 1000) / 10,
      }))
      .sort((a, b) => b.perSeason - a.perSeason);

    // Monte Carlo: what the eggs of `trials` seasons actually look like.
    const totalOffspring = trials * eggsPerSeason;
    const phenotypeCounts = Object.create(null);
    for (let t = 0; t < trials; t++) {
      for (let e = 0; e < eggsPerSeason; e++) {
        const sampled = sampleFromDistribution(phenotypes, Math.random());
        const label = sampled.phenotype_description || 'Wild-type';
        phenotypeCounts[label] = (phenotypeCounts[label] || 0) + 1;
      }
    }

    const phenotypeDist = Object.entries(phenotypeCounts)
      .map(([phenotype, count]) => ({
        phenotype,
        count,
        percent: Math.round((count / totalOffspring) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    return { phenotypeDist, atLeastOne, trials, clutchCount, eggsPerSeason, warnings };
  }, [sire, dam, trials, clutchCount]);
}
