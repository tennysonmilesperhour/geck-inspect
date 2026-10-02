// Render a morph tag with an inferred het probability suffix.
//
// In crested-gecko breeder shorthand:
//   "Het X"          → confirmed carrier (100%, e.g. proven offspring of homozygous X)
//   "100% Het X"     → same, made explicit
//   "Possible Het X" → maybe a carrier. With no number it counts as 50%,
//                      the odds for a baby from a het × normal pairing.
//                      The genetics calculator reads POSSIBLE_HET_CHANCE
//                      from here (lib/genetics/tagTranslation.js), so the
//                      badge and the odds always agree.
//   "66% Het X"      → already labeled (a normal-looking baby from het × het)
//   "50% Het X"      → already labeled
//
// We only annotate tags that don't already carry a percentage. Free-form
// percentages typed by the user pass through unchanged.
// Kept here, free of imports, so profile pages can show it without
// loading the genetics engine.
export const POSSIBLE_HET_CHANCE = 0.5;

const HET_PERCENT_RE = /\b\d{1,3}\s*%/;

export function formatHetTag(tag) {
  if (!tag || typeof tag !== 'string') return tag;
  if (HET_PERCENT_RE.test(tag)) return tag;
  const lower = tag.toLowerCase();
  if (lower.startsWith('possible het')) return `${tag} (${Math.round(POSSIBLE_HET_CHANCE * 100)}%)`;
  if (lower.startsWith('het ')) return `${tag} (100%)`;
  return tag;
}
