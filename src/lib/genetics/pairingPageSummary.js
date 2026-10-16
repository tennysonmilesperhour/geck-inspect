/**
 * The odds and warnings for one calculator pairing page
 * (/calculator/pairing/<slug>), as plain data.
 *
 * Why this exists: those pages used to send crawlers that do not run
 * JavaScript (GPTBot, ClaudeBot, link previews) about 110 words, mostly
 * navigation, because the odds were only computed in the browser.
 * scripts/prerender.mjs now writes this summary into the server HTML, and
 * it uses exactly the same steps as the live calculator (stateToSpec,
 * then predictWeighted, then outcomeLabel), so the two cannot disagree.
 *
 * Presentation rule (comprehensive review, items 27 and 28): only
 * single-gene traits get a percentage. Pattern and base color are
 * polygenic, so the page describes them as likely or possible and never
 * as a Punnett percentage.
 */
import { displayText, outcomeCombos, outcomeTraits } from '@/lib/genetics';
import { predictWeighted } from '@/lib/genetics/predictWeighted';
import { outcomeLabel } from '@/lib/genetics/pairOutcomes';
import {
  COMPLEX_ID,
  MORPH_GUIDE_SLUGS,
  stateToChips,
  stateToSpec,
  PAIRING_PAGES,
  PAIRING_PAGES_BY_SLUG,
} from '@/lib/genetics/calculatorCatalog';
import { pct, simpleFraction, EGGS_PER_CLUTCH, DEFAULT_CLUTCHES_PER_SEASON, roundExpected } from '@/lib/genetics/clutchMath';

export const POLYGENIC_NOTE =
  'Pattern and base color (Harlequin, Pinstripe, Dalmatian, Flame, red or yellow base) are polygenic: many small genes add up. ' +
  'They are never given a percentage here. A look both parents show is likely in the babies, a look one parent shows is possible, ' +
  'and how strongly it shows varies from baby to baby.';

const EGGS_PER_SEASON = EGGS_PER_CLUTCH * DEFAULT_CLUTCHES_PER_SEASON;

/**
 * The live calculator's outcome name (outcomeLabel: combo name first),
 * plus the genes behind a combo name, because a reader of the server HTML
 * cannot tap the outcome to see them. Phantom x Phantom reads
 * "Patternless (Visual Phantom)" instead of a bare "Patternless".
 */
function serverLabels(outcome) {
  const name = outcomeLabel(outcome);
  const traits = outcomeTraits(outcome);
  if (name === 'Wild-type') return { label: 'Normal (none of these genes)', short: 'normal' };
  const isCombo = outcomeCombos(outcome).length > 0 && traits && traits !== name;
  if (!isCombo) return { label: name, short: name.replace(/, /g, ' + ') };
  const label = `${name} (${traits})`;
  // A combo built from several genes reads best by its own name
  // ("Luwak", "Frappuccino"); one built from a single gene keeps the gene
  // ("Patternless (Visual Phantom)"), which is what a breeder searched for.
  const severalGenes = /,|\+|^Compound/.test(traits);
  return { label, short: severalGenes ? name : label };
}

/**
 * Morph Guide slugs for the genes a pairing uses, for "read more" links.
 * Some may not have a page yet; the caller drops those.
 */
function guideSlugsFor(...states) {
  const out = [];
  for (const state of states) {
    for (const [id, value] of Object.entries(state || {})) {
      if (!value || value === 'none') continue;
      const key = id === COMPLEX_ID ? value : id;
      out.push(MORPH_GUIDE_SLUGS[key] || key.replace(/_/g, '-'));
    }
  }
  return [...new Set(out)];
}

/** "Lilly White" or "Normal" for a parent with no gene picked. */
function parentLabel(state) {
  const chips = stateToChips(state);
  return chips.length ? chips.join(', ') : 'Normal (no proven genes)';
}

/**
 * @param {{ slug: string, label: string, sire: object, dam: object }} page
 * @returns {{
 *   slug: string, label: string, sire: string, dam: string,
 *   outcomes: Array<{ label: string, probability: number, percent: string, fraction: string|null, healthRisk: string|null, perSeason: number }>,
 *   warnings: Array<{ severity: string, message: string }>,
 *   nonViable: number, polygenicNote: string, eggsPerSeason: number,
 * }}
 */
export function pairingPageSummary(page) {
  const result = predictWeighted(stateToSpec(page.sire), stateToSpec(page.dam));

  // Equal labels merge (two genotypes can look the same), the way the
  // live calculator and the MCP pairing tool count them.
  const merged = new Map();
  for (const o of result.offspring_phenotypes || []) {
    const { label, short } = serverLabels(o);
    const prev = merged.get(label);
    if (prev) prev.probability += o.probability;
    else merged.set(label, { label, short, probability: o.probability, healthRisk: o.health_risk && o.health_risk !== 'none' ? o.health_risk : null });
  }
  const outcomes = [...merged.values()]
    .sort((a, b) => b.probability - a.probability)
    .map((o) => ({
      ...o,
      percent: pct(o.probability),
      fraction: simpleFraction(o.probability),
      perSeason: roundExpected(o.probability * EGGS_PER_SEASON),
    }));

  // Warnings are always shown on the live page and never filterable; the
  // server copy keeps every one of them.
  const warnings = (result.warnings || []).map((w) => ({
    severity: String(w.severity || 'warning'),
    message: displayText(String(w.message || '')),
  }));

  const nonViable = outcomes.filter((o) => o.healthRisk === 'lethal').reduce((s, o) => s + o.probability, 0);

  return {
    slug: page.slug,
    label: page.label,
    blurb: page.blurb || '',
    sire: parentLabel(page.sire),
    dam: parentLabel(page.dam),
    guideSlugs: guideSlugsFor(page.sire, page.dam),
    outcomes,
    warnings,
    nonViable,
    polygenicNote: POLYGENIC_NOTE,
    eggsPerSeason: EGGS_PER_SEASON,
  };
}

const DESCRIPTION_MAX = 158;

/**
 * The search snippet for a pairing page, built from its real odds:
 * "Lilly White x Lilly White odds per egg: 50% Lilly White, 25% Super
 * Lilly White (dies in the egg), 25% normal. ..." Outcomes that do not
 * fit in a snippet are left off rather than cut mid-word. Used by the live
 * page and the server HTML, so both say the same thing.
 */
export function pairingMetaDescription(summary) {
  const risky = summary.warnings.some((w) => w.severity === 'critical');
  // Longest tail that fits wins, so short odds lists still get a full snippet.
  // A certain outcome (Axanthic x Axanthic) cannot differ in a real clutch.
  const certain = summary.outcomes.some((o) => o.probability > 0.999);
  const tails = risky
    ? [' Why breeders avoid it, and a free calculator.', ' Why breeders avoid it.']
    : [
        ...(certain ? [' Every egg, every clutch. Free crested gecko calculator, no signup.'] : [' Each egg is independent, so a real clutch can differ. Free calculator, no signup.']),
        ' Free crested gecko calculator, no signup.',
        ' Free calculator.',
      ];
  const head = `${summary.label} odds per egg: `;
  const parts = summary.outcomes.map((o) => {
    const note = o.healthRisk === 'lethal' ? ' (dies in the egg)' : o.healthRisk ? ' with health problems' : '';
    return `${o.percent} ${o.short}${note}`;
  });
  const shortestTail = tails[tails.length - 1];
  let odds = '';
  for (const part of parts) {
    const next = odds ? `${odds}, ${part}` : part;
    // The most likely outcome always goes in, even on its own.
    if (odds && (head + next + '.' + shortestTail).length > DESCRIPTION_MAX) break;
    odds = next;
  }
  const body = `${head}${odds}.`;
  const tail = tails.find((t) => (body + t).length <= DESCRIPTION_MAX);
  return tail ? body + tail : body;
}

/** Every pairing page's summary, keyed by slug (what the prerender reads). */
export function allPairingPageSummaries() {
  return Object.fromEntries(PAIRING_PAGES.map((p) => [p.slug, pairingPageSummary(p)]));
}

export { PAIRING_PAGES, PAIRING_PAGES_BY_SLUG };
