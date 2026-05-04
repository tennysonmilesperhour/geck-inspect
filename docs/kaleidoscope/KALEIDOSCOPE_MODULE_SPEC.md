# Kaleidoscope Inheritance Module — Implementation Spec

This is the specification for a headless TypeScript module that implements Kaleidoscope-Model breeding predictions. It is designed to live alongside the existing "Foundation Genetics" module, not replace it.

**Recommended location:** `src/lib/genetics/kaleidoscope/` in the Geck Inspect repo.

**Naming convention:** Match the existing genetics module's naming style. If that module is `src/lib/genetics/foundation/`, this becomes `src/lib/genetics/kaleidoscope/`.

---

## Module structure

```
src/lib/genetics/kaleidoscope/
├── types.ts              // TypeScript types for genotypes, predictions
├── inheritance.ts        // Core Mendelian math
├── linkage.ts           // Harlequin/CvG linked inheritance
├── phenotype.ts         // Genotype-to-phenotype clustering
├── predict.ts           // Top-level prediction function
├── notation.ts          // Format/parse the "1/2/1, T1, P0, Hq2" string
└── index.ts             // Public exports
```

---

## types.ts

```typescript
// Allele counts, always 0, 1, or 2
export type AlleleCount = 0 | 1 | 2;

// Confidence in a recorded genotype
export type ConfidenceLevel =
  | 'confirmed_by_breeding'
  | 'phenotype_estimate'
  | 'lineage_estimate'
  | 'unknown';

// CvG (Coverage Gene) status, completely linked to Harlequin
export type CvGStatus =
  | 'absent'                    // No Harlequin = no CvG
  | 'linked_to_one_harlequin'   // One Harlequin allele has CvG attached
  | 'linked_to_both_harlequin'  // Both Harlequin alleles have CvG attached
  | 'unknown';

// Expression score for gene stacking, 1-10 scale
// 1 = weakest expressing allele, 10 = strongest
export type ExpressionScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// A gecko's full Kaleidoscope genotype
export interface KaleidoscopeGenotype {
  // Base color (Y/R/B triplet)
  yellow: AlleleCount;
  red: AlleleCount;
  black: AlleleCount;
  baseColorConfidence: ConfidenceLevel;
  
  // Pattern
  tiger: AlleleCount;
  pinstripe: AlleleCount;
  patternConfidence: ConfidenceLevel;
  
  // Coverage
  harlequin: AlleleCount;
  cvgStatus: CvGStatus;
  coverageConfidence: ConfidenceLevel;
  
  // Optional expression scores (default to 5 if not provided)
  yellowExpression?: ExpressionScore;
  redExpression?: ExpressionScore;
  blackExpression?: ExpressionScore;
  tigerExpression?: ExpressionScore;
  pinstripeExpression?: ExpressionScore;
  cvgExpression?: ExpressionScore;
  
  // Model version
  modelVersion: string; // e.g., 'kaleidoscope_v1.0'
}

// A possible offspring genotype with its probability
export interface OffspringGenotype {
  genotype: KaleidoscopeGenotype;
  probability: number; // 0 to 1
}

// A phenotype cluster (group of similar-looking genotypes)
export interface PhenotypeCluster {
  label: string;              // e.g., "Tri-Color with high coverage"
  description: string;
  totalProbability: number;   // sum of all genotype probabilities in this cluster
  genotypes: OffspringGenotype[];
  predictedExpressionStrength: 'low' | 'medium' | 'high';
}

// Top-level prediction result
export interface BreedingPrediction {
  sireGenotype: KaleidoscopeGenotype;
  damGenotype: KaleidoscopeGenotype;
  modelVersion: string;
  phenotypeClusters: PhenotypeCluster[];
  edgeCaseNotes: string[];    // e.g., warnings about (2/2/0) impossibilities
  totalGenotypeCount: number; // how many distinct offspring genotypes were enumerated
}
```

## inheritance.ts

The core Mendelian math. Each gene is inherited independently (with one exception: CvG is linked to Harlequin, see linkage.ts).

```typescript
import { AlleleCount } from './types';

/**
 * Given a parent's allele count for one gene, return the probability
 * distribution over what allele they pass to one offspring.
 *
 * - Homozygous parent (0 or 2): always passes that allele.
 * - Heterozygous parent (1): 50% chance of passing 0, 50% of passing 1.
 *
 * Returns probability of passing a "1" (dominant allele).
 */
export function probabilityOfPassingDominant(
  parentAlleles: AlleleCount
): number {
  if (parentAlleles === 0) return 0;
  if (parentAlleles === 2) return 1;
  return 0.5; // heterozygous
}

/**
 * Combine two parents' contributions to give the probability distribution
 * over the offspring's allele count for a single gene.
 *
 * Returns: { 0: prob, 1: prob, 2: prob }
 */
export function offspringAlleleDistribution(
  sireAlleles: AlleleCount,
  damAlleles: AlleleCount
): { 0: number; 1: number; 2: number } {
  const sirePassesDom = probabilityOfPassingDominant(sireAlleles);
  const damPassesDom = probabilityOfPassingDominant(damAlleles);
  
  return {
    0: (1 - sirePassesDom) * (1 - damPassesDom),
    1: sirePassesDom * (1 - damPassesDom) + (1 - sirePassesDom) * damPassesDom,
    2: sirePassesDom * damPassesDom,
  };
}
```

## linkage.ts

CvG is treated as completely linked to Harlequin. This is the key Kaleidoscope hypothesis. We model it by tracking, for each Harlequin allele, whether CvG is attached.

```typescript
import { AlleleCount, CvGStatus } from './types';

/**
 * Determine, for a parent with given Harlequin count and CvG status,
 * the probability they pass each of the four possible Harlequin/CvG combos
 * to an offspring.
 *
 * The combos:
 * - 'no_hq'        : Pass no Harlequin allele (and therefore no CvG)
 * - 'hq_no_cvg'    : Pass a Harlequin allele without CvG
 * - 'hq_with_cvg'  : Pass a Harlequin allele with CvG attached
 *
 * Note: under "completely linked" assumption, recombination rate is 0.
 * If breeding data suggests CvG can occasionally separate, we'd add a
 * recombination rate parameter here.
 */
export function harlequinCvGContribution(
  parentHarlequin: AlleleCount,
  parentCvG: CvGStatus
): { no_hq: number; hq_no_cvg: number; hq_with_cvg: number } {
  // No Harlequin alleles, can't pass any
  if (parentHarlequin === 0) {
    return { no_hq: 1, hq_no_cvg: 0, hq_with_cvg: 0 };
  }
  
  // Two Harlequin alleles, always pass one
  if (parentHarlequin === 2) {
    if (parentCvG === 'absent' || parentCvG === 'unknown') {
      return { no_hq: 0, hq_no_cvg: 1, hq_with_cvg: 0 };
    }
    if (parentCvG === 'linked_to_one_harlequin') {
      // 50% chance the passed Hq is the one with CvG
      return { no_hq: 0, hq_no_cvg: 0.5, hq_with_cvg: 0.5 };
    }
    if (parentCvG === 'linked_to_both_harlequin') {
      return { no_hq: 0, hq_no_cvg: 0, hq_with_cvg: 1 };
    }
  }
  
  // One Harlequin allele
  if (parentHarlequin === 1) {
    // 50% chance of passing the Hq allele
    if (parentCvG === 'absent' || parentCvG === 'unknown') {
      return { no_hq: 0.5, hq_no_cvg: 0.5, hq_with_cvg: 0 };
    }
    if (parentCvG === 'linked_to_one_harlequin') {
      // CvG is attached to the single Hq allele
      return { no_hq: 0.5, hq_no_cvg: 0, hq_with_cvg: 0.5 };
    }
    // 'linked_to_both_harlequin' is impossible with only one Hq, treat as 'linked_to_one'
  }
  
  // Fallback for unknown states, treat as no CvG
  return { no_hq: 0.5, hq_no_cvg: 0.5, hq_with_cvg: 0 };
}

/**
 * Combine two parents' Harlequin/CvG contributions into the offspring's
 * Harlequin allele count and CvG status.
 *
 * Returns probability distribution over offspring (Hq, CvG) combinations.
 */
export function offspringHarlequinCvGDistribution(
  sireHarlequin: AlleleCount,
  sireCvG: CvGStatus,
  damHarlequin: AlleleCount,
  damCvG: CvGStatus
): Array<{
  harlequin: AlleleCount;
  cvgStatus: CvGStatus;
  probability: number;
}> {
  const sireContrib = harlequinCvGContribution(sireHarlequin, sireCvG);
  const damContrib = harlequinCvGContribution(damHarlequin, damCvG);
  
  const results: Array<{
    harlequin: AlleleCount;
    cvgStatus: CvGStatus;
    probability: number;
  }> = [];
  
  // Enumerate all 9 combinations (3 sire options × 3 dam options)
  const sireOptions = ['no_hq', 'hq_no_cvg', 'hq_with_cvg'] as const;
  const damOptions = ['no_hq', 'hq_no_cvg', 'hq_with_cvg'] as const;
  
  for (const sireOpt of sireOptions) {
    for (const damOpt of damOptions) {
      const prob = sireContrib[sireOpt] * damContrib[damOpt];
      if (prob === 0) continue;
      
      // Determine offspring harlequin count and CvG status
      const sireHq = sireOpt === 'no_hq' ? 0 : 1;
      const damHq = damOpt === 'no_hq' ? 0 : 1;
      const offspringHq = (sireHq + damHq) as AlleleCount;
      
      const sireCvGAttached = sireOpt === 'hq_with_cvg';
      const damCvGAttached = damOpt === 'hq_with_cvg';
      const cvgCount = (sireCvGAttached ? 1 : 0) + (damCvGAttached ? 1 : 0);
      
      let offspringCvG: CvGStatus;
      if (offspringHq === 0) offspringCvG = 'absent';
      else if (cvgCount === 0) offspringCvG = 'absent';
      else if (cvgCount === 1) offspringCvG = 'linked_to_one_harlequin';
      else offspringCvG = 'linked_to_both_harlequin';
      
      // Aggregate same outcomes
      const existing = results.find(
        r => r.harlequin === offspringHq && r.cvgStatus === offspringCvG
      );
      if (existing) {
        existing.probability += prob;
      } else {
        results.push({
          harlequin: offspringHq,
          cvgStatus: offspringCvG,
          probability: prob,
        });
      }
    }
  }
  
  return results;
}
```

## phenotype.ts

Maps offspring genotypes to human-friendly phenotype cluster labels. These cluster definitions come directly from the Kaleidoscope paper's discussion of named phenotypes.

```typescript
import { KaleidoscopeGenotype, PhenotypeCluster, OffspringGenotype } from './types';

/**
 * Determine which phenotype cluster a genotype belongs to.
 * Cluster names match common hobby terminology where possible.
 */
export function classifyPhenotype(genotype: KaleidoscopeGenotype): {
  label: string;
  description: string;
} {
  const { yellow, red, black, tiger, pinstripe, harlequin, cvgStatus } = genotype;
  
  // Phantom = no Harlequin
  if (harlequin === 0) {
    if (yellow === 2 && red === 0 && black === 0) {
      return {
        label: 'Pure Yellow Phantom',
        description: 'Homozygous Yellow base, no Harlequin or CvG.',
      };
    }
    if (yellow === 0 && red === 2 && black === 0) {
      return {
        label: 'Pure Red Phantom',
        description: 'Homozygous Red base, no Harlequin or CvG.',
      };
    }
    if (yellow === 0 && red === 0 && black === 2) {
      return {
        label: 'Pure Black Phantom',
        description: 'Homozygous Black base, no Harlequin or CvG.',
      };
    }
    if (yellow === 0 && red === 0 && black === 0) {
      return {
        label: 'True Pale Cream (0/0/0)',
        description: 'No pigment alleles. Does not fire normally.',
      };
    }
    return {
      label: `Phantom (${yellow}/${red}/${black})`,
      description: 'Phantom phenotype with mixed base colors.',
    };
  }
  
  // Tri-Color: 2/0/2 with at least one Harlequin
  if (yellow === 2 && red === 0 && black === 2 && harlequin >= 1) {
    if (cvgStatus === 'linked_to_both_harlequin') {
      return {
        label: 'Tri-Color (high coverage)',
        description: 'The "Perfect Recipe" 2/0/2 with two CvG copies. Maximum white pattern.',
      };
    }
    return {
      label: 'Tri-Color',
      description: '2/0/2 base with Harlequin. Yellow segregated into Harlequin regions over Black.',
    };
  }
  
  // Lavender: (2/0/2) or (2/1/1) with Hq=2, low Tiger, strong Pin
  // (Subset of Tri-Color with specific pattern config)
  if (
    ((yellow === 2 && red === 0 && black === 2) ||
      (yellow === 2 && red === 1 && black === 1)) &&
    harlequin === 2 &&
    tiger <= 1 &&
    pinstripe >= 1
  ) {
    return {
      label: 'Lavender',
      description: 'Soft purple-tinted phenotype from specific base color + low Tiger + Pin.',
    };
  }
  
  // Red-based Harlequin
  if (red >= 1 && yellow <= 1 && harlequin >= 1) {
    return {
      label: red === 2 ? 'Red-based Harlequin' : 'Mixed Red Harlequin',
      description: 'Red base color with Harlequin segregating any Yellow into pattern regions.',
    };
  }
  
  // Yellow-based Harlequin
  if (yellow >= 1 && red === 0 && harlequin >= 1) {
    return {
      label: 'Yellow-based Harlequin',
      description: 'Yellow base with Harlequin pattern.',
    };
  }
  
  // Dark-based Harlequin
  if (black >= 1 && yellow <= 1 && red <= 1 && harlequin >= 1) {
    return {
      label: 'Dark-based Harlequin',
      description: 'Black base with Harlequin segregating Yellow.',
    };
  }
  
  // Fallback
  return {
    label: `Mixed Harlequin (${yellow}/${red}/${black}, Hq${harlequin})`,
    description: 'Multi-base color Harlequin combination.',
  };
}

/**
 * Group offspring genotypes into phenotype clusters and sum their probabilities.
 */
export function clusterOffspring(
  offspring: OffspringGenotype[]
): PhenotypeCluster[] {
  const clusterMap = new Map<string, PhenotypeCluster>();
  
  for (const og of offspring) {
    const { label, description } = classifyPhenotype(og.genotype);
    
    if (!clusterMap.has(label)) {
      clusterMap.set(label, {
        label,
        description,
        totalProbability: 0,
        genotypes: [],
        predictedExpressionStrength: 'medium',
      });
    }
    
    const cluster = clusterMap.get(label)!;
    cluster.totalProbability += og.probability;
    cluster.genotypes.push(og);
  }
  
  // Compute expected expression strength per cluster
  for (const cluster of clusterMap.values()) {
    cluster.predictedExpressionStrength = computeExpressionStrength(cluster.genotypes);
  }
  
  // Sort by probability descending
  return Array.from(clusterMap.values()).sort(
    (a, b) => b.totalProbability - a.totalProbability
  );
}

function computeExpressionStrength(
  genotypes: OffspringGenotype[]
): 'low' | 'medium' | 'high' {
  // Average expression scores across the cluster, weighted by probability
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const og of genotypes) {
    const scores = [
      og.genotype.yellowExpression ?? 5,
      og.genotype.redExpression ?? 5,
      og.genotype.blackExpression ?? 5,
      og.genotype.tigerExpression ?? 5,
      og.genotype.pinstripeExpression ?? 5,
      og.genotype.cvgExpression ?? 5,
    ];
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    totalScore += avgScore * og.probability;
    totalWeight += og.probability;
  }
  
  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 5;
  if (finalScore < 4) return 'low';
  if (finalScore > 7) return 'high';
  return 'medium';
}
```

## predict.ts

Top-level prediction function that ties everything together.

```typescript
import {
  KaleidoscopeGenotype,
  BreedingPrediction,
  OffspringGenotype,
  AlleleCount,
} from './types';
import { offspringAlleleDistribution } from './inheritance';
import { offspringHarlequinCvGDistribution } from './linkage';
import { clusterOffspring } from './phenotype';

/**
 * Predict offspring phenotype distribution for a given pairing.
 */
export function predictBreedingOutcome(
  sire: KaleidoscopeGenotype,
  dam: KaleidoscopeGenotype
): BreedingPrediction {
  const offspring: OffspringGenotype[] = [];
  const edgeCaseNotes: string[] = [];
  
  // Edge case detection: (2/2/0) cannot directly produce phantoms
  const sireIs220 = sire.yellow === 2 && sire.red === 0 && sire.black === 2;
  const damIs220 = dam.yellow === 2 && dam.red === 0 && dam.black === 2;
  if (sireIs220 && damIs220 && sire.harlequin >= 1 && dam.harlequin >= 1) {
    edgeCaseNotes.push(
      'Per the Kaleidoscope Model, 2/2/0 × 2/2/0 pairings cannot directly produce phantoms when both parents carry Harlequin.'
    );
  }
  
  // Enumerate base color combinations
  const yDist = offspringAlleleDistribution(sire.yellow, dam.yellow);
  const rDist = offspringAlleleDistribution(sire.red, dam.red);
  const bDist = offspringAlleleDistribution(sire.black, dam.black);
  
  // Enumerate pattern combinations
  const tDist = offspringAlleleDistribution(sire.tiger, dam.tiger);
  const pDist = offspringAlleleDistribution(sire.pinstripe, dam.pinstripe);
  
  // Enumerate Harlequin/CvG combinations (linked)
  const hqCvGDist = offspringHarlequinCvGDistribution(
    sire.harlequin,
    sire.cvgStatus,
    dam.harlequin,
    dam.cvgStatus
  );
  
  // Cartesian product over all genes
  for (const [yStr, yProb] of Object.entries(yDist)) {
    if (yProb === 0) continue;
    const y = parseInt(yStr) as AlleleCount;
    
    for (const [rStr, rProb] of Object.entries(rDist)) {
      if (rProb === 0) continue;
      const r = parseInt(rStr) as AlleleCount;
      
      for (const [bStr, bProb] of Object.entries(bDist)) {
        if (bProb === 0) continue;
        const b = parseInt(bStr) as AlleleCount;
        
        for (const [tStr, tProb] of Object.entries(tDist)) {
          if (tProb === 0) continue;
          const t = parseInt(tStr) as AlleleCount;
          
          for (const [pStr, pProb] of Object.entries(pDist)) {
            if (pProb === 0) continue;
            const p = parseInt(pStr) as AlleleCount;
            
            for (const hqCvG of hqCvGDist) {
              const totalProb =
                yProb * rProb * bProb * tProb * pProb * hqCvG.probability;
              if (totalProb === 0) continue;
              
              // Edge case override: zero out (2/2/0) phantoms when both parents are 2/2/0 with Hq
              const isPhantomOutcome = hqCvG.harlequin === 0;
              const isOffspring220 = y === 2 && r === 0 && b === 2;
              if (isPhantomOutcome && isOffspring220 && sireIs220 && damIs220 && sire.harlequin >= 1 && dam.harlequin >= 1) {
                continue; // Per the model, this is impossible
              }
              
              // Compute expected expression scores (average of parent scores)
              const yellowExpression = avgExpression(sire.yellowExpression, dam.yellowExpression);
              const redExpression = avgExpression(sire.redExpression, dam.redExpression);
              const blackExpression = avgExpression(sire.blackExpression, dam.blackExpression);
              const tigerExpression = avgExpression(sire.tigerExpression, dam.tigerExpression);
              const pinstripeExpression = avgExpression(sire.pinstripeExpression, dam.pinstripeExpression);
              const cvgExpression = avgExpression(sire.cvgExpression, dam.cvgExpression);
              
              offspring.push({
                genotype: {
                  yellow: y,
                  red: r,
                  black: b,
                  baseColorConfidence: 'phenotype_estimate',
                  tiger: t,
                  pinstripe: p,
                  patternConfidence: 'phenotype_estimate',
                  harlequin: hqCvG.harlequin,
                  cvgStatus: hqCvG.cvgStatus,
                  coverageConfidence: 'phenotype_estimate',
                  yellowExpression,
                  redExpression,
                  blackExpression,
                  tigerExpression,
                  pinstripeExpression,
                  cvgExpression,
                  modelVersion: 'kaleidoscope_v1.0',
                },
                probability: totalProb,
              });
            }
          }
        }
      }
    }
  }
  
  // Re-normalize probabilities if we removed any due to edge cases
  const totalProb = offspring.reduce((sum, og) => sum + og.probability, 0);
  if (totalProb > 0 && totalProb < 1) {
    for (const og of offspring) {
      og.probability /= totalProb;
    }
  }
  
  const phenotypeClusters = clusterOffspring(offspring);
  
  return {
    sireGenotype: sire,
    damGenotype: dam,
    modelVersion: 'kaleidoscope_v1.0',
    phenotypeClusters,
    edgeCaseNotes,
    totalGenotypeCount: offspring.length,
  };
}

function avgExpression(
  sireScore: number | undefined,
  damScore: number | undefined
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  const s = sireScore ?? 5;
  const d = damScore ?? 5;
  return Math.round((s + d) / 2) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}
```

## notation.ts

Helpers to format and parse the human-readable Kaleidoscope notation string.

```typescript
import { KaleidoscopeGenotype } from './types';

/**
 * Format a genotype as a human-readable string.
 * Example: "1/2/1, T1, P0, Hq2, CvG2"
 */
export function formatGenotype(g: KaleidoscopeGenotype): string {
  const cvgCount =
    g.cvgStatus === 'absent' ? 0 :
    g.cvgStatus === 'linked_to_one_harlequin' ? 1 :
    g.cvgStatus === 'linked_to_both_harlequin' ? 2 :
    null; // unknown
  
  const cvgPart = cvgCount === null ? 'CvG?' : `CvG${cvgCount}`;
  
  return `${g.yellow}/${g.red}/${g.black}, T${g.tiger}, P${g.pinstripe}, Hq${g.harlequin}, ${cvgPart}`;
}

/**
 * Parse a string back into a partial genotype.
 * Used for breeder notes and shorthand input.
 *
 * Returns null if parsing fails.
 */
export function parseNotation(input: string): Partial<KaleidoscopeGenotype> | null {
  // Implementation: regex parse of the format above
  // (Detail this when implementing — straightforward but tedious)
  return null; // TODO
}
```

## index.ts

```typescript
export * from './types';
export { predictBreedingOutcome } from './predict';
export { formatGenotype, parseNotation } from './notation';
export { classifyPhenotype } from './phenotype';
```

---

## Testing requirements

Write unit tests for:

1. **inheritance.ts**: For each parent allele combination (0×0, 0×1, 0×2, 1×1, 1×2, 2×2), verify the offspring distribution sums to 1 and matches expected Mendelian ratios.

2. **linkage.ts**: 
   - Hq=0 parent contributes only `no_hq`.
   - Hq=2, CvG=both parent always contributes `hq_with_cvg`.
   - Hq=1, CvG=one parent contributes 50% no_hq, 50% hq_with_cvg.
   - Verify cross-parent combinations sum to 1.

3. **predict.ts**: 
   - Test the canonical Tri-Color pairing: (2/0/2, T0, P0, Hq2, CvG=both) × (2/0/2, T0, P0, Hq2, CvG=both) should yield ~100% Tri-Color offspring.
   - Test (2/2/0, Hq=1) × (2/2/0, Hq=1) should yield zero phantom probability.
   - Test (2/0/0 Hq=2) × (0/2/0 Hq=0) — Yellow Harlequin × Red Phantom — should yield orange-tinted offspring per the paper's example.

4. **phenotype.ts**:
   - Phantom classification correctly identifies Pure Yellow/Red/Black phantoms.
   - Tri-Color identification works for 2/0/2 + Hq variants.
   - Lavender identification matches the paper's specific (2/0/2)/(2/1/1) + Hq=2 + low Tiger + Pin definition.

## Worked example for verification

From the Kaleidoscope paper, page 8:

> Pairing an Extreme Harlequin (TT × pp) with a Tiger-less Full Pinstripe (tt × PP) yields all offspring as Tt × pP.

In our notation:
- Sire: tiger=2, pinstripe=0
- Dam: tiger=0, pinstripe=2
- Predicted offspring: 100% tiger=1, pinstripe=1

Test:
```typescript
const sire = makeGenotype({ tiger: 2, pinstripe: 0 });
const dam = makeGenotype({ tiger: 0, pinstripe: 2 });
const result = predictBreedingOutcome(sire, dam);
// Verify: all offspring have tiger=1 and pinstripe=1
// Verify: phenotype cluster shows intermediate Tiger/Pinstripe expression
```

## Integration with the existing Foundation Genetics module

The existing module handles:
- Lilly White (incomplete dominant)
- Axanthic (recessive)
- Cappuccino/Sable/Frappuccino (allelic series)
- Polygenic patterning

These traits **layer on top of** the Kaleidoscope genotype rather than replacing it. A gecko can be:
- Kaleidoscope: 1/2/1, T1, P0, Hq2, CvG=both
- Plus: Heterozygous Lilly White, Heterozygous Axanthic carrier

The combined prediction must account for both. Recommended approach: the calculator runs the Kaleidoscope prediction first to get base color/pattern/coverage outcomes, then applies the recessive/incomplete-dominant Foundation Genetics traits as filters/modifiers on each predicted offspring genotype.

The two modules should not duplicate work. If the existing module handles axanthic inheritance correctly, leave that alone and just compose the outputs.
