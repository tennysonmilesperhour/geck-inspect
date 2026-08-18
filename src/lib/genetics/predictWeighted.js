/**
 * Probability-weighted breeding prediction.
 *
 * The engine's predict() takes two definite genotypes. Real breeding
 * questions are often probabilistic: a "66% poss het Axanthic" parent
 * is het with probability 2/3 and wild-type with probability 1/3.
 * This wrapper expands each parent's uncertain loci into weighted
 * genotype scenarios, runs the exact engine prediction per scenario
 * pair, and merges the results into one distribution.
 *
 * Scenario counts stay tiny in practice (a poss-het locus doubles a
 * parent's scenarios, so even three uncertain loci per parent is 8x8).
 * A hard cap guards against pathological inputs.
 *
 * Poss-het math note: this produces per-egg odds marginalized over the
 * parent's unknown genotype, which is the number a buyer or planner
 * wants. Example: 66% poss het Axanthic x visual Axanthic gives
 * 2/3 x 1/2 = 33.3% visual per egg.
 */
import { predict, tagToGenotype, WILD_TYPE, LOCI } from '@/lib/genetics';
import { getSimpleTraits } from './calculatorCatalog';

const MAX_SCENARIOS = 256;

/**
 * Loci the vendored engine does not know about (traits added at
 * runtime through the genetics_trait_overrides store) are computed
 * here with the same exact gamete math and folded into the merged
 * result, so a newly proven gene works the day its row is added.
 */
function splitExtraLoci(spec) {
  const engineLoci = {};
  const extraLoci = {};
  for (const [locus, options] of Object.entries(spec?.loci || {})) {
    if (LOCI[locus]) engineLoci[locus] = options;
    else extraLoci[locus] = options;
  }
  return { engineSpec: { loci: engineLoci }, extraLoci };
}

function extraTraitFor(locus) {
  return getSimpleTraits().find((t) => t.locus === locus) || null;
}

/** Phenotype label for an extra-trait allele pair. */
function extraPairLabel(trait, pair) {
  const copies = pair.filter((a) => a === trait.id).length;
  if (copies === 0) return 'Wild-type';
  if (trait.dominance === 'recessive') {
    return copies === 2 ? trait.label : `Het ${trait.label}`;
  }
  if (copies === 2) return trait.super_label || `Super ${trait.label}`;
  return trait.label;
}

/**
 * Child-pair distribution for one extra locus, marginalized over both
 * parents' weighted options.
 */
function extraLocusOutcomes(trait, sireOptions, damOptions) {
  const dist = new Map();
  for (const so of sireOptions) {
    for (const dop of damOptions) {
      for (const a of so.pair) {
        for (const b of dop.pair) {
          const pair = [a, b].sort();
          const key = pair.join('|');
          const p = 0.25 * so.weight * dop.weight;
          const entry = dist.get(key);
          if (entry) entry.probability += p;
          else dist.set(key, { genotype: pair, probability: p, phenotype_label: extraPairLabel(trait, pair) });
        }
      }
    }
  }
  return [...dist.values()].sort((a, b) => b.probability - a.probability);
}

/** Expand { loci: { locus: [{pair, weight}] } } into weighted genotypes. */
export function expandScenarios(spec) {
  let scenarios = [{ genotype: {}, weight: 1 }];
  for (const [locus, options] of Object.entries(spec?.loci || {})) {
    const next = [];
    for (const s of scenarios) {
      for (const opt of options) {
        next.push({
          genotype: { ...s.genotype, [locus]: [...opt.pair] },
          weight: s.weight * opt.weight,
        });
      }
    }
    scenarios = next;
    if (scenarios.length > MAX_SCENARIOS) {
      throw new Error('Too many genotype scenarios to compute.');
    }
  }
  return scenarios;
}

/** Convert legacy morph_tags into a single-scenario spec. */
export function tagsToSpec(tags) {
  const partial = tagToGenotype(tags || []).genotype;
  const loci = {};
  for (const [locus, pair] of Object.entries(partial)) {
    loci[locus] = [{ pair: [...pair], weight: 1 }];
  }
  return { loci };
}

function toAnimal(id, genotype) {
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

const pairKey = (pair) => `${pair[0]}|${pair[1]}`;

/**
 * Run the weighted prediction.
 *
 * @param sireSpec {loci} spec for the sire (see stateToSpec / tagsToSpec)
 * @param damSpec  {loci} spec for the dam
 * @returns {{
 *   offspring_phenotypes: Array<{phenotype_description, probability, matching_combo_morphs, health_risk, genotype}>,
 *   locus_predictions: Array<{locus, trait, outcomes: Array<{genotype, probability, phenotype_label}>}>,
 *   warnings: Array<{severity, code, message, source_url, conditional}>,
 *   uncertain: boolean,
 * }}
 */
export function predictWeighted(sireSpec, damSpec) {
  const { engineSpec: sireEngine, extraLoci: sireExtra } = splitExtraLoci(sireSpec);
  const { engineSpec: damEngine, extraLoci: damExtra } = splitExtraLoci(damSpec);
  const sireScenarios = expandScenarios(sireEngine);
  const damScenarios = expandScenarios(damEngine);
  if (sireScenarios.length * damScenarios.length > MAX_SCENARIOS) {
    throw new Error('Too many genotype scenarios to compute.');
  }
  const extraUncertain = [...Object.values(sireExtra), ...Object.values(damExtra)]
    .some((options) => options.length > 1);
  const uncertain = sireScenarios.length > 1 || damScenarios.length > 1 || extraUncertain;

  const phenoMap = new Map();
  const locusMap = new Map();
  const warningMap = new Map();
  let totalWeight = 0;

  for (const ss of sireScenarios) {
    for (const ds of damScenarios) {
      const w = ss.weight * ds.weight;
      if (w <= 0) continue;
      totalWeight += w;
      const prediction = predict(toAnimal('sire', ss.genotype), toAnimal('dam', ds.genotype));

      for (const op of prediction.offspring_phenotypes || []) {
        const key = op.phenotype_description;
        const entry = phenoMap.get(key);
        if (entry) {
          entry.probability += w * op.probability;
          if (w > entry._weight) {
            entry._weight = w;
            entry.genotype = op.genotype;
          }
        } else {
          phenoMap.set(key, {
            phenotype_description: op.phenotype_description,
            probability: w * op.probability,
            matching_combo_morphs: op.matching_combo_morphs || [],
            health_risk: op.health_risk,
            genotype: op.genotype,
            _weight: w,
          });
        }
      }

      const seenLoci = new Set();
      for (const lp of prediction.locus_predictions || []) {
        seenLoci.add(lp.locus);
        let bucket = locusMap.get(lp.locus);
        if (!bucket) {
          bucket = { locus: lp.locus, trait: lp.trait, outcomes: new Map(), _seenWeight: 0 };
          locusMap.set(lp.locus, bucket);
        }
        bucket._seenWeight += w;
        for (const o of lp.outcomes) {
          const key = `${pairKey(o.genotype)}::${o.phenotype_label}`;
          const existing = bucket.outcomes.get(key);
          if (existing) existing.probability += w * o.probability;
          else bucket.outcomes.set(key, { genotype: [...o.genotype], phenotype_label: o.phenotype_label, probability: w * o.probability });
        }
      }
      // Loci absent from this scenario (poss het that did not prove out)
      // contribute pure wild-type weight, added after the loop via the
      // _seenWeight bookkeeping below.

      for (const warning of prediction.warnings || []) {
        const existing = warningMap.get(warning.code);
        if (existing) existing._weight += w;
        else warningMap.set(warning.code, { ...warning, _weight: w });
      }
    }
  }

  const hasExtras = Object.keys(sireExtra).length > 0 || Object.keys(damExtra).length > 0;
  if (totalWeight <= 0 && !hasExtras) {
    return { offspring_phenotypes: [], locus_predictions: [], warnings: [], uncertain: false };
  }
  if (totalWeight <= 0) totalWeight = 1;

  // Top up loci that were missing from some scenarios with wild-type
  // outcomes so every locus's outcome probabilities sum to 1.
  for (const bucket of locusMap.values()) {
    const missing = totalWeight - bucket._seenWeight;
    if (missing > 1e-9) {
      const key = `${WILD_TYPE}|${WILD_TYPE}::Wild-type`;
      const existing = bucket.outcomes.get(key);
      if (existing) existing.probability += missing;
      else bucket.outcomes.set(key, { genotype: [WILD_TYPE, WILD_TYPE], phenotype_label: 'Wild-type', probability: missing });
    }
  }

  let offspring_phenotypes = [...phenoMap.values()]
    .map(({ _weight, ...rest }) => ({ ...rest, probability: rest.probability / totalWeight }))
    .sort((a, b) => b.probability - a.probability);

  const locus_predictions = [...locusMap.values()].map((bucket) => ({
    locus: bucket.locus,
    trait: bucket.trait,
    outcomes: [...bucket.outcomes.values()]
      .map((o) => ({ ...o, probability: o.probability / totalWeight }))
      .filter((o) => o.probability > 1e-9)
      .sort((a, b) => b.probability - a.probability),
  }));

  const warnings = [...warningMap.values()].map(({ _weight, ...w }) => ({
    ...w,
    // A warning that only fires in some scenarios depends on an
    // unproven het proving out; the UI notes that instead of stating
    // the hazard as certain.
    conditional: _weight < totalWeight - 1e-9,
  }));

  // Fold in override-added loci the engine does not know about.
  if (hasExtras) {
    if (offspring_phenotypes.length === 0) {
      offspring_phenotypes = [{
        phenotype_description: 'Wild-type',
        probability: 1,
        matching_combo_morphs: [],
        health_risk: undefined,
        genotype: {},
      }];
    }
    const allExtraLoci = new Set([...Object.keys(sireExtra), ...Object.keys(damExtra)]);
    const wildOption = [{ pair: [WILD_TYPE, WILD_TYPE], weight: 1 }];
    for (const locus of allExtraLoci) {
      const trait = extraTraitFor(locus);
      if (!trait) continue; // no catalog definition: skip rather than guess
      const outcomes = extraLocusOutcomes(
        trait,
        sireExtra[locus] || wildOption,
        damExtra[locus] || wildOption,
      );
      locus_predictions.push({ locus, trait: trait.id, outcomes });

      const crossed = new Map();
      for (const op of offspring_phenotypes) {
        for (const o of outcomes) {
          const isWild = o.phenotype_label === 'Wild-type';
          const isLethal = trait.super_lethal &&
            o.genotype[0] === trait.id && o.genotype[1] === trait.id;
          const description = isWild
            ? op.phenotype_description
            : op.phenotype_description === 'Wild-type'
              ? o.phenotype_label
              : `${op.phenotype_description}, ${o.phenotype_label}`;
          const entry = crossed.get(description);
          const probability = op.probability * o.probability;
          if (entry) entry.probability += probability;
          else {
            crossed.set(description, {
              ...op,
              phenotype_description: description,
              probability,
              health_risk: isLethal ? 'lethal' : op.health_risk,
              genotype: { ...op.genotype, [locus]: [...o.genotype] },
            });
          }
        }
      }
      offspring_phenotypes = [...crossed.values()].sort((a, b) => b.probability - a.probability);

      if (trait.super_lethal) {
        const lethalP = outcomes
          .filter((o) => o.genotype[0] === trait.id && o.genotype[1] === trait.id)
          .reduce((s, o) => s + o.probability, 0);
        if (lethalP > 0) {
          warnings.push({
            severity: 'critical',
            code: `override_lethal_${trait.id}`,
            message: `${trait.super_label || `Super ${trait.label}`} is flagged lethal: ${Math.round(lethalP * 100)}% of eggs from this pairing are expected non-viable.`,
            conditional: false,
          });
        }
      }
    }
  }

  return { offspring_phenotypes, locus_predictions, warnings, uncertain };
}
