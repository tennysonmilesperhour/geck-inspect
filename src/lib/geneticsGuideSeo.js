/**
 * Title, snippet and opening paragraph for the Genetics Guide, shared by
 * the live page (src/pages/GeneticsGuide.jsx), the sitemap route list
 * (scripts/seo-routes.mjs) and the server HTML (scripts/prerender.mjs).
 *
 * Why it exists: Search Console showed the homepage, not the Genetics
 * Guide, ranking for "crested gecko genetics" (position 12.6, October
 * 2026). The guide is the page that answers that search, so its title
 * and snippet lead with the exact phrase, and the old 560-character
 * description (Google shows about 155) is replaced with one that fits.
 *
 * Dependency-free so Node scripts can import it.
 */

export const GENETICS_GUIDE_PATH = '/GeneticsGuide';

export const GENETICS_GUIDE_TITLE = 'Crested Gecko Genetics: Guide to Morphs and Inheritance';

export const GENETICS_GUIDE_DESCRIPTION =
  'Crested gecko genetics in plain words: which morphs follow a Punnett square (Lilly White, Axanthic, Cappuccino), which are polygenic, and pairings to avoid.';

export const GENETICS_GUIDE_LEAD =
  'Crested gecko genetics decides what a pairing can hatch. A few morphs are single genes you can predict with a Punnett square: ' +
  'Lilly White, Cappuccino and Soft Scale are incomplete dominant, and Axanthic is recessive. ' +
  'Most of what you see on a crested gecko (Harlequin, Pinstripe, Dalmatian spots and base color) is polygenic, ' +
  'so breeders select toward it over generations instead of calculating it.';

/** Inheritance labels that mean one gene, so a Punnett square predicts the look. */
export const SINGLE_GENE_INHERITANCE = ['recessive', 'incomplete-dominant', 'co-dominant', 'dominant'];

// Albino is filed as recessive because albinism is recessive in other
// reptiles, but no crested gecko pairing has proven it yet (the first
// healthy albinos hatched in March 2026). Until one does, it is not offered
// as a morph a Punnett square predicts.
const NOT_YET_PROVEN = ['albino'];

// Well-known polygenic looks the guide uses as examples. Each is checked
// against the morph's own inheritance below, so a reclassified morph drops
// out of the list instead of being mislabelled.
const POLYGENIC_EXAMPLES = ['harlequin', 'pinstripe', 'dalmatian', 'flame', 'tiger', 'red-base'];

/**
 * The two morph link lists in the Genetics Guide's server HTML: morphs a
 * Punnett square predicts, and polygenic looks breeders select toward.
 *
 * Why it is computed: until 16 Oct 2026 the single-gene list was typed by
 * hand and included Phantom Pinstripe, a polygenic sale label, under the
 * heading "Punnett squares work". Reading each morph's inheritance from the
 * Morph Guide data keeps the two lists true as entries change.
 *
 * Leaves out combinations (Frappuccino is two genes, not one) and the
 * two-copy "super" forms, which are the same gene as their one-copy morph.
 *
 * @param {Array<{ slug: string, name: string, inheritance: string, category?: string }>} morphs
 * @param {Record<string, { label?: string }>} [inheritance] the INHERITANCE map, for the note
 */
export function geneticsGuideMorphGroups(morphs, inheritance = {}) {
  const list = Array.isArray(morphs) ? morphs : [];
  const link = (m) => ({ name: m.name, href: `/MorphGuide/${m.slug}` });
  const singleGene = list
    .filter((m) => SINGLE_GENE_INHERITANCE.includes(m.inheritance))
    .filter((m) => m.category !== 'combo' && !m.slug.startsWith('super-') && !NOT_YET_PROVEN.includes(m.slug))
    .map((m) => ({ ...link(m), note: (inheritance[m.inheritance]?.label || m.inheritance.replace(/-/g, ' ')).toLowerCase() }));
  const bySlug = new Map(list.map((m) => [m.slug, m]));
  const polygenic = POLYGENIC_EXAMPLES
    .map((slug) => bySlug.get(slug))
    .filter((m) => m && m.inheritance === 'polygenic')
    .map(link);
  return { singleGene, polygenic };
}
