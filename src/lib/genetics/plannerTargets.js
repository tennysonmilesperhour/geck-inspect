/**
 * Targets for the Pairing Planner's "Target a morph" goal.
 *
 * The planner ranks pairings by how likely each one is to produce the
 * target. Two kinds of target need two kinds of answer:
 *
 *   - Single-gene traits and combos built only from them (Lilly White,
 *     Axanthic, Cappuccino, Frappuccino, Lucy...): a per-egg percentage
 *     from the Punnett math.
 *   - Polygenic looks (Harlequin, Pinstripe, Dalmatian, Tiger, base
 *     colours...): no percentage at all, because these looks come from
 *     many small genes. They are kept out of the math (see POLYGENIC_LOCI
 *     in tagTranslation.js), so a percentage here would always read "0%".
 *     Instead the planner says "likely" when both parents show the look
 *     and "possible" when one does, the way breeders talk about them.
 *
 * Combos that need a polygenic look (Extreme Harlequin, Tricolor,
 * Halloween, Lavender, Pink, Cream, Charcoal, Brindlequin, XXX), or that
 * are defined by its absence (Patternless), cannot be judged by the
 * math any more, so they are not offered.
 */
import { TRAITS, COMBO_MORPHS } from './index.js';
import {
  isPercentTrait,
  comboTouchesPolygenic,
  POLYGENIC_LOOK_NAMES,
  translateMorphTags,
} from './tagTranslation.js';
import { polygenicLookChances } from './polygenic.js';

/** Dropdown options: value is "trait:Name", "combo:Name" or "look:Name". */
export function buildMorphTargetOptions() {
  const traits = TRAITS
    .filter(isPercentTrait)
    // The value keeps the engine spelling (it is matched against engine
    // outcome text); the label uses the app spelling.
    .map((t) => ({ value: `trait:${t.name}`, label: t.name === 'Softscale' ? 'Soft Scale' : t.name }));
  const combos = COMBO_MORPHS
    .filter((c) => !comboTouchesPolygenic(c))
    .map((c) => ({ value: `combo:${c.name}`, label: `${c.name} (combo)` }));
  const looks = POLYGENIC_LOOK_NAMES
    // Only looks a gecko tag can actually carry (a "Tangerine" tag, for
    // one, is not read as a look), or the target could never be met.
    .filter((name) => translateMorphTags([name]).polygenic.some((l) => l.look === name))
    .map((name) => ({ value: `look:${name}`, label: `${name} (polygenic look)` }));
  return [...traits, ...combos, ...looks].sort((a, b) => a.label.localeCompare(b.label));
}

/** "look" for a polygenic target, "odds" for everything else. */
export function targetKind(target) {
  return String(target || '').startsWith('look:') ? 'look' : 'odds';
}

// Does an offspring phenotype satisfy a percentage target? Traits match
// the engine's phenotype_description, combos the lowercase combo id list.
export function phenotypeHitsTarget(pheno, target) {
  if (!target) return false;
  const [kind, name] = target.split(/:(.+)/);
  if (kind === 'combo') {
    const wanted = name.toLowerCase();
    return (pheno.matching_combo_morphs || []).some((c) => c.toLowerCase() === wanted);
  }
  if (kind !== 'trait') return false;
  return (pheno.phenotype_description || '').toLowerCase().includes(name.toLowerCase());
}

/**
 * Score one pairing against a morph target.
 *
 * @param {string} target  a dropdown value
 * @param {Array} phenotypes  offspring_phenotypes from the prediction
 * @param {Array<{look: string}>} sireLooks  translateMorphTags(sire).polygenic
 * @param {Array<{look: string}>} damLooks   translateMorphTags(dam).polygenic
 * @returns {{ score: number, label: string }}
 *   score ranks the pairings (higher is better). For a percentage
 *   target it is the per-egg percentage. For a polygenic look it is
 *   2 (likely), 1 (possible) or 0, and the label never carries a number.
 */
export function scoreMorphTarget(target, phenotypes, sireLooks, damLooks) {
  if (targetKind(target) === 'look') {
    const name = target.slice('look:'.length);
    const hit = polygenicLookChances(sireLooks, damLooks).find((c) => c.look === name);
    if (!hit) return { score: 0, label: `Neither parent shows ${name}` };
    const who = hit.chance === 'likely' ? 'both parents show it' : 'one parent shows it';
    return {
      score: hit.chance === 'likely' ? 2 : 1,
      label: `${name} ${hit.chance} (${who})`,
    };
  }
  let p = 0;
  for (const ph of phenotypes || []) {
    if (phenotypeHitsTarget(ph, target)) p += ph.probability;
  }
  const score = Math.round(p * 1000) / 10;
  return { score, label: `${score}% chance per egg` };
}
