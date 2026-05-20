// Render a morph tag with an inferred het probability suffix.
//
// In crested-gecko breeder shorthand:
//   "Het X"          → confirmed carrier (100%, e.g. proven offspring of homozygous X)
//   "100% Het X"     → same, made explicit
//   "Possible Het X" → typical product of het × normal pairing, 66% likely to be a carrier
//   "66% Het X"      → already labeled
//   "50% Het X"      → typical product of het × het sibling (when the sibling
//                      wasn't proven), 50% likely
//
// We only annotate tags that don't already carry a percentage. Free-form
// percentages typed by the user pass through unchanged.
const HET_PERCENT_RE = /\b\d{1,3}\s*%/;

export function formatHetTag(tag) {
  if (!tag || typeof tag !== 'string') return tag;
  if (HET_PERCENT_RE.test(tag)) return tag;
  const lower = tag.toLowerCase();
  if (lower.startsWith('possible het')) return `${tag} (66%)`;
  if (lower.startsWith('het ')) return `${tag} (100%)`;
  return tag;
}
