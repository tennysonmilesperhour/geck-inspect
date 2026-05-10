/**
 * Rarity + approximate market value heuristic.
 *
 * This is intentionally simple and explainable:
 *   - Start at a low baseline value driven by the base color.
 *   - For each expressed Mendelian morph, add its valueHint; stack ~1.3x when
 *     multiple Mendelian morphs co-occur (combos are worth more than sum).
 *   - For each polygenic trait, add a fraction of its valueHint scaled by
 *     how strong the expression is.
 *   - Rarity tier is the max of the inputs contributing to the phenotype.
 *
 * Prices are illustrative ,  reference retail floors at the time of writing.
 */

import {
  BASE_COLORS_BY_ID,
  MENDELIAN_MORPHS,
  PATTERN_TRAITS,
  ACCENT_TRAITS,
  TRAITS_BY_ID,
  ZYGOSITY as Z,
} from '../data/traits';

const TIER_LABELS = {
  1: 'Common',
  2: 'Mid-tier',
  3: 'High-end',
  4: 'Rare',
  5: 'Ultra Rare',
};

export function estimateRarityAndValue(phenotype, selections = {}) {
  const mend = selections.mendelian || {};
  let value = 0;
  let rarityTier = 1;
  const contributions = [];

  // Base color
  const baseColor = BASE_COLORS_BY_ID[phenotype.baseColorId];
  if (baseColor) {
    value += baseColor.valueHint * 0.6;
    rarityTier = Math.max(rarityTier, baseColor.rarity);
    contributions.push({
      source: baseColor.name + ' base',
      value: Math.round(baseColor.valueHint * 0.6),
    });
  }

  // Mendelian morphs ,  each expressed morph pays full value.
  const expressedCount = MENDELIAN_MORPHS.filter((m) => phenotype.expressed[m.id]).length;
  MENDELIAN_MORPHS.forEach((m) => {
    if (!phenotype.expressed[m.id]) return;
    let v = m.valueHint;
    const isSuper = mend[m.id] === Z.SUPER && !m.genetics?.superLethal;
    if (isSuper) v *= 1.5;
    value += v;
    rarityTier = Math.max(rarityTier, m.rarity);
    contributions.push({
      source: isSuper ? (m.genetics?.superForm || `Super ${m.name}`) : m.name,
      value: Math.round(v),
    });
  });
  if (expressedCount >= 2) {
    const bonus = value * 0.3 * Math.min(3, expressedCount - 1);
    value += bonus;
    contributions.push({ source: `Combo bonus (${expressedCount} morphs stacked)`, value: Math.round(bonus) });
    rarityTier = Math.min(5, rarityTier + 1);
  }

  // Polygenic patterns ,  scaled by intensity.
  PATTERN_TRAITS.forEach((p) => {
    const intensity = phenotype.patternIntensity[p.id] || 0;
    if (intensity <= 0) return;
    const scale = intensity / 4; // 0–1
    const v = Math.round(p.valueHint * scale);
    value += v;
    rarityTier = Math.max(rarityTier, Math.min(5, p.rarity + (intensity === 4 ? 1 : 0)));
    contributions.push({ source: `${p.name} (${['trace','partial','strong','extreme'][intensity - 1]})`, value: v });
  });

  // Accents
  ACCENT_TRAITS.forEach((a) => {
    if (!phenotype.accents[a.id]) return;
    value += a.valueHint * 0.6;
    rarityTier = Math.max(rarityTier, a.rarity);
    contributions.push({ source: a.name, value: Math.round(a.valueHint * 0.6) });
  });

  // Structural ,  crowned/furred bump value.
  if (phenotype.structural?.crowned) {
    value += TRAITS_BY_ID.crowned.valueHint;
    rarityTier = Math.max(rarityTier, TRAITS_BY_ID.crowned.rarity);
    contributions.push({ source: 'Crowned', value: TRAITS_BY_ID.crowned.valueHint });
  }
  if (phenotype.structural?.furred) {
    value += TRAITS_BY_ID.furred.valueHint;
    rarityTier = Math.max(rarityTier, TRAITS_BY_ID.furred.rarity);
    contributions.push({ source: 'Furred', value: TRAITS_BY_ID.furred.valueHint });
  }

  // Round to a sensible retail number.
  const rounded = Math.max(30, Math.round(value / 10) * 10);

  return {
    tier: rarityTier,
    tierLabel: TIER_LABELS[rarityTier],
    valueFloor: rounded,
    valueCeiling: Math.round(rounded * 1.8),
    contributions,
  };
}
