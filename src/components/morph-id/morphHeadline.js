/**
 * The name Morph ID leads with, the way breeders name the animal.
 *
 * Tennyson's rules (28 Sep 2026):
 * - Harlequin is the base. It is so common that most other morphs sit on
 *   top of it, and when anything else is present that name leads. A Lilly
 *   White with harlequin patterning is a Lilly White.
 * - Lilly White, Axanthic, Cappuccino, Frappuccino, Soft Scale and White
 *   Wall lead the name when Morph ID sees them, and they stack with any
 *   pattern other than plain Harlequin: "Pinstripe White Wall".
 *
 * Stacking follows breeder listings (9,920 MorphMarket titles in
 * geck_data.listings): the pattern first, as in Tennyson's "Pinstripe White
 * Wall" and the common "Tricolor Lilly White"; Axanthic, Soft Scale and White
 * Wall ahead of Lilly White ("Axanthic Lilly White" outnumbers the reverse
 * 66 to 29). Lilly White with Cappuccino is its own combo, Frappuccino.
 * Extreme Harlequin is a morph in its own right and stays in the name.
 */
import { labelFor } from './morphTaxonomy';

// In name order. Axanthic lines (VCA, TSM) read as Axanthic here; the
// panel below the headline keeps the detail.
const HEADLINE_GENES = [
  ['axanthic', 'Axanthic'],
  ['axanthic_vca', 'Axanthic'],
  ['axanthic_tsm', 'Axanthic'],
  ['soft_scale', 'Soft Scale'],
  ['white_wall', 'White Wall'],
  ['frappuccino', 'Frappuccino'],
  ['lily_white', 'Lilly White'],
  ['cappuccino', 'Cappuccino'],
];

/**
 * @param {string} primaryMorph - pattern id, e.g. 'pinstripe'
 * @param {string[]} genetics - genetic trait ids Morph ID saw, e.g. ['white_wall']
 * @returns {{ name: string, pattern: string | null, genes: string[], patternInName: boolean }}
 */
export function morphHeadline(primaryMorph, genetics = []) {
  const seen = new Set(Array.isArray(genetics) ? genetics : []);
  if (seen.has('lily_white') && seen.has('cappuccino')) seen.add('frappuccino');
  if (seen.has('frappuccino')) {
    seen.delete('lily_white');
    seen.delete('cappuccino');
  }
  const genes = [...new Set(HEADLINE_GENES.filter(([id]) => seen.has(id)).map(([, label]) => label))];
  const pattern = primaryMorph ? labelFor(primaryMorph, null) : null;
  const patternInName = !!pattern && !(primaryMorph === 'harlequin' && genes.length > 0);
  const name = [patternInName ? pattern : null, ...genes].filter(Boolean).join(' ');
  return { name, pattern, genes, patternInName };
}
