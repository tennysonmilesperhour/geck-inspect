/**
 * useBreedingSimulator — Monte Carlo breeding outcome simulation.
 *
 * Computes exact per-offspring phenotype probabilities via the
 * Foundation Genetics-backed `predict()` from `crested-gecko-app`,
 * then samples N virtual clutches from that distribution to produce
 * histogram-ready data. All genetic math lives in the shared module;
 * this hook only handles the sampling + aggregation UI glue.
 */
import { useMemo } from 'react';
import { predict, tagToGenotype } from 'crested-gecko-app';

function tagsToAnimal(id, tags) {
  // tagToGenotype returns Partial<AnimalGenotype>; predict() treats missing
  // loci as wild-type, so the partial is runtime-safe. Cast to satisfy the
  // stricter TS signature on the shared Animal type.
  const partial = tagToGenotype(tags || []).genotype;
  const genotype = /** @type {import('crested-gecko-app').AnimalGenotype} */ (partial);
  return {
    id,
    species: 'correlophus_ciliatus',
    genotype,
    status: 'active',
    is_breeder: true,
    owner_id: id,
    created_at: '',
    updated_at: '',
  };
}

function sampleFromDistribution(phenotypes) {
  const r = Math.random();
  let cumulative = 0;
  for (const p of phenotypes) {
    cumulative += p.probability;
    if (r <= cumulative) return p;
  }
  return phenotypes[phenotypes.length - 1];
}

/**
 * Run a Monte Carlo simulation of breeding outcomes.
 *
 * @param {object} sire - sire gecko with morph_tags[]
 * @param {object} dam - dam gecko with morph_tags[]
 * @param {number} [trials=1000] - number of virtual clutches
 * @param {number} [clutchSize=6] - eggs per clutch
 * @returns {{ phenotypeDist, atLeastOneProb, trials, clutchSize, warnings } | null}
 */
export function useBreedingSimulator(sire, dam, trials = 1000, clutchSize = 6) {
  return useMemo(() => {
    if (!sire || !dam) return null;

    const sireAnimal = tagsToAnimal(sire.id || 'sire', sire.morph_tags || []);
    const damAnimal = tagsToAnimal(dam.id || 'dam', dam.morph_tags || []);
    const prediction = predict(sireAnimal, damAnimal);
    const phenotypes = prediction.offspring_phenotypes || [];
    const warnings = prediction.warnings || [];

    if (phenotypes.length === 0) {
      return { phenotypeDist: [], atLeastOneProb: [], trials, clutchSize, warnings };
    }

    const totalOffspring = trials * clutchSize;
    const phenotypeCounts = Object.create(null);
    const comboInClutch = Object.create(null);

    for (let t = 0; t < trials; t++) {
      const combosSeenThisClutch = new Set();
      for (let e = 0; e < clutchSize; e++) {
        const sampled = sampleFromDistribution(phenotypes);
        const label = sampled.phenotype_description || 'Wild-type';
        phenotypeCounts[label] = (phenotypeCounts[label] || 0) + 1;
        for (const combo of sampled.matching_combo_morphs) {
          combosSeenThisClutch.add(combo);
        }
      }
      for (const combo of combosSeenThisClutch) {
        comboInClutch[combo] = (comboInClutch[combo] || 0) + 1;
      }
    }

    const phenotypeDist = Object.entries(phenotypeCounts)
      .map(([phenotype, count]) => ({
        phenotype,
        count,
        percent: Math.round((count / totalOffspring) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    const atLeastOneProb = Object.entries(comboInClutch)
      .map(([trait, clutches]) => ({
        trait,
        probability: Math.round((clutches / trials) * 1000) / 10,
      }))
      .sort((a, b) => b.probability - a.probability);

    return { phenotypeDist, atLeastOneProb, trials, clutchSize, warnings };
  }, [sire, dam, trials, clutchSize]);
}
