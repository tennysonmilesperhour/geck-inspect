/**
 * Genetics engine for the Morph Visualizer.
 *
 * Pure functions ,  no React, no rendering. Kept small and well-typed so it can
 * later back a breeding predictor, a probability calculator, or an LLM tool.
 */

import { ZYGOSITY, GENETICS_TYPE, TRAITS_BY_ID } from './traits';

const Z = ZYGOSITY;

/* -----------------------------------------------------------
 * Zygosity helpers
 * --------------------------------------------------------- */

/** Whether a zygosity should visibly express given the trait's inheritance type. */
export function isVisuallyExpressed(traitId, zygosity) {
  const trait = TRAITS_BY_ID[traitId];
  if (!trait) return false;
  const t = trait.genetics?.type;

  if (t === GENETICS_TYPE.RECESSIVE) {
    return zygosity === Z.VISUAL; // hom only
  }
  if (t === GENETICS_TYPE.INCOMPLETE_DOMINANT) {
    return zygosity === Z.VISUAL || zygosity === Z.SUPER;
  }
  if (t === GENETICS_TYPE.DOMINANT) {
    return zygosity === Z.VISUAL || zygosity === Z.SUPER || zygosity === Z.HET;
  }
  return false;
}

/** Every zygosity option valid for a trait, in canonical display order. */
export function zygosityOptions(traitId) {
  const trait = TRAITS_BY_ID[traitId];
  if (!trait) return [Z.ABSENT];
  const t = trait.genetics?.type;

  if (t === GENETICS_TYPE.RECESSIVE) {
    return [Z.ABSENT, Z.HET, Z.VISUAL];
  }
  if (t === GENETICS_TYPE.INCOMPLETE_DOMINANT) {
    // Super is offered but flagged lethal in UI for LW.
    return [Z.ABSENT, Z.VISUAL, Z.SUPER];
  }
  if (t === GENETICS_TYPE.DOMINANT) {
    return [Z.ABSENT, Z.VISUAL];
  }
  return [Z.ABSENT, Z.VISUAL];
}

/** A short, human label describing the zygosity in the context of a trait. */
export function zygosityLabel(traitId, zygosity) {
  const trait = TRAITS_BY_ID[traitId];
  if (!trait || zygosity === Z.ABSENT) return 'Not carried';
  const t = trait.genetics?.type;

  if (t === GENETICS_TYPE.RECESSIVE) {
    if (zygosity === Z.HET) return `Het ${trait.shortCode || trait.name}`;
    if (zygosity === Z.VISUAL) return `Visual ${trait.name}`;
  }
  if (t === GENETICS_TYPE.INCOMPLETE_DOMINANT) {
    if (zygosity === Z.VISUAL) return `Visual ${trait.name}`;
    if (zygosity === Z.SUPER) return trait.genetics?.superForm || `Super ${trait.name}`;
  }
  if (zygosity === Z.VISUAL) return trait.name;
  return trait.name;
}

/* -----------------------------------------------------------
 * Punnett math ,  per-trait probabilities for ONE offspring
 * --------------------------------------------------------- */

function allelesFor(zygosity) {
  // 'a' = affected/morph allele, 'N' = wild type.
  if (zygosity === Z.SUPER) return ['a', 'a'];
  if (zygosity === Z.VISUAL) return ['a', 'a']; // recessive visual is hom
  if (zygosity === Z.HET) return ['a', 'N'];
  return ['N', 'N'];
}

/** Return { hom: pct, het: pct, normal: pct } for one trait across two parents. */
export function punnettOffspring(sireZyg, damZyg, traitId) {
  const trait = TRAITS_BY_ID[traitId];
  const t = trait?.genetics?.type;

  // For incomp-dom, the visual parent is heterozygous (a/N). Super is (a/a).
  const sireAlleles = t === GENETICS_TYPE.INCOMPLETE_DOMINANT && sireZyg === Z.VISUAL
    ? ['a', 'N']
    : allelesFor(sireZyg);
  const damAlleles = t === GENETICS_TYPE.INCOMPLETE_DOMINANT && damZyg === Z.VISUAL
    ? ['a', 'N']
    : allelesFor(damZyg);

  const tally = { hom: 0, het: 0, normal: 0 };
  for (const s of sireAlleles) {
    for (const d of damAlleles) {
      if (s === 'a' && d === 'a') tally.hom += 1;
      else if (s === 'a' || d === 'a') tally.het += 1;
      else tally.normal += 1;
    }
  }
  return {
    hom:    Math.round((tally.hom    / 4) * 100),
    het:    Math.round((tally.het    / 4) * 100),
    normal: Math.round((tally.normal / 4) * 100),
  };
}

/* -----------------------------------------------------------
 * Compatibility + warnings
 * --------------------------------------------------------- */

/** Return an array of warning objects for the current selections. */
export function detectWarnings(selections) {
  const warnings = [];
  const mend = selections.mendelian || {};

  // Super Lilly White = lethal
  if (mend.lilly_white === Z.SUPER) {
    warnings.push({
      severity: 'lethal',
      traitId: 'lilly_white',
      title: 'Super Lilly White is non-viable',
      body: 'Homozygous Lilly White is embryonic-lethal in crested geckos. No animal of this genotype exists in captivity.',
    });
  }

  // Axanthic masks warm pigment
  if (mend.axanthic === Z.VISUAL) {
    warnings.push({
      severity: 'info',
      traitId: 'axanthic',
      title: 'Axanthic masks base color',
      body: 'A visual axanthic lacks yellow/red pigment and appears grayscale regardless of the carried base color.',
    });
  }

  // Frappuccino fertility note
  if (mend.cappuccino === Z.SUPER) {
    warnings.push({
      severity: 'info',
      traitId: 'cappuccino',
      title: 'Frappuccino (Super Cappuccino)',
      body: 'Homozygous Cappuccino ,  some breeders report fertility concerns but the genotype is viable.',
    });
  }

  // Empty Back vs pattern traits
  if (mend.empty_back && mend.empty_back !== Z.ABSENT) {
    const pattern = selections.patterns || {};
    const dorsalActive = (pattern.pinstripe || 0) >= 2 || (pattern.harlequin || 0) >= 3;
    if (dorsalActive) {
      warnings.push({
        severity: 'info',
        traitId: 'empty_back',
        title: 'Empty Back suppresses dorsal pattern',
        body: 'Empty Back clears dorsal markings, so strong pinstripe or harlequin that crosses the back will be visually quieted.',
      });
    }
  }
  return warnings;
}
