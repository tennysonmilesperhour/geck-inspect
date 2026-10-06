/**
 * One source for a morph page's title, description, H1 and opening
 * sentence. Used by the prerendered HTML (scripts/prerender.mjs, what AI
 * crawlers read) and by the live page (src/pages/MorphDetail.jsx, what
 * Google renders), so both say the same thing.
 *
 * Dependency-free so the prerender script can import it from Node.
 */
import { INHERITANCE, MORPH_CATEGORIES, MORPHS } from '../data/morph-guide.js';

const RARITY_WORD = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  very_rare: 'very rare',
};

const CATEGORY_NOUN = {
  base: 'base color',
  color: 'color morph',
  pattern: 'pattern morph',
  structure: 'structural trait',
  combo: 'combination morph',
};

const TITLE_MAX = 60;

/** "a" or "an" for the word that follows. */
export function article(word) {
  return /^[aeiou]/i.test(String(word || '').trim()) ? 'an' : 'a';
}

function sentence(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/** Cut at a word boundary, never mid-word, with no trailing punctuation mess. */
export function clip(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const atSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, atSpace > max * 0.5 ? atSpace : cut.length).replace(/[,;:\s]+$/, '')}…`;
}

/**
 * The quotable opening sentence: "A Pinstripe crested gecko is ...".
 * Uses the hand-written `definition` when the entry has one.
 */
export function morphDefinition(morph) {
  if (!morph) return '';
  if (morph.definition) return sentence(morph.definition);
  const rarity = RARITY_WORD[morph.rarity];
  const noun = CATEGORY_NOUN[morph.category] || 'morph';
  const inheritance = INHERITANCE[morph.inheritance]?.label;
  const lead = rarity
    ? `${morph.name} is ${article(rarity)} ${rarity} crested gecko ${noun}`
    : `${morph.name} is a crested gecko ${noun}`;
  const first = inheritance ? `${lead} (${inheritance.toLowerCase()}).` : `${lead}.`;
  return morph.summary ? `${first} ${sentence(morph.summary)}` : first;
}

/**
 * @returns {{ title: string, h1: string, description: string, definition: string, categoryLabel: string|null }}
 */
export function morphSeo(morph) {
  const name = morph?.name || 'Crested gecko morph';
  const long = `${name} Crested Gecko: Identification, Genetics and Price`;
  const mid = `${name} Crested Gecko: ID, Genetics and Price`;
  const title = long.length <= TITLE_MAX ? long : mid.length <= TITLE_MAX ? mid : `${name} Crested Gecko Guide`;
  const definition = morphDefinition(morph);
  const price = morph?.priceRange ? ` Typical adult price: ${morph.priceRange}.` : '';
  const description = clip(`${definition}${price} How to identify it, genetics and lookalikes.`, 158);
  const category = MORPH_CATEGORIES.find((c) => c.id === morph?.category);
  return {
    title,
    h1: `${name} Crested Gecko`,
    description,
    definition,
    categoryLabel: category?.label || null,
  };
}

// ---------- hub pages (/MorphGuide/category/:id, /MorphGuide/inheritance/:id)

// The best-known morphs lead a hub's preview list and rank higher in the
// sitemap.
export const HIGH_VALUE_MORPH_SLUGS = new Set([
  'harlequin', 'extreme-harlequin', 'pinstripe', 'dalmatian',
  'flame', 'cappuccino', 'lilly-white', 'axanthic',
]);

// Plural noun for each category, as it reads in a sentence.
export const CATEGORY_NOUNS = {
  base: 'base color morphs',
  color: 'color modifier morphs',
  pattern: 'pattern morphs',
  structure: 'structural morphs',
  combo: 'combination morphs',
};

function titleCase(text) {
  return text.replace(/(^|[\s-])([a-z])/g, (_, sep, c) => `${sep}${c.toUpperCase()}`);
}

export function namesPreview(morphs, n = 3) {
  const ranked = [...morphs].sort(
    (a, b) => Number(HIGH_VALUE_MORPH_SLUGS.has(b.slug)) - Number(HIGH_VALUE_MORPH_SLUGS.has(a.slug)),
  );
  const names = ranked.slice(0, n).map((m) => m.name);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Title, description and H1 for a category hub, shared by the app and the prerender. */
export function categoryHubSeo(categoryId, morphs = MORPHS.filter((m) => m.category === categoryId)) {
  const cat = MORPH_CATEGORIES.find((c) => c.id === categoryId);
  const noun = CATEGORY_NOUNS[categoryId] || `${(cat?.label || categoryId).toLowerCase()} morphs`;
  return {
    noun,
    title: `Crested Gecko ${titleCase(noun)}: All ${morphs.length} Listed`,
    description: `All ${morphs.length} crested gecko ${noun} in one list, including ${namesPreview(morphs)}, with inheritance, rarity, typical price and a link to each morph page.`,
    h1: `Crested gecko ${noun}`,
  };
}

/** Title, description and H1 for an inheritance hub, shared by the app and the prerender. */
export function inheritanceHubSeo(inheritanceId, morphs = MORPHS.filter((m) => m.inheritance === inheritanceId)) {
  const label = INHERITANCE[inheritanceId]?.label || inheritanceId;
  const n = morphs.length;
  return {
    title: `${titleCase(label)} Crested Gecko Morphs: All ${n} Listed`,
    description: n === 0
      ? `No crested gecko morph in the guide is ${label.toLowerCase()} yet.`
      : `${n === 1 ? 'One crested gecko morph is' : `${n} crested gecko morphs are`} ${label.toLowerCase()}${n > 4 ? ', including ' : ': '}${namesPreview(morphs, 4)}. What that means for breeding, with rarity, typical price and a link to each morph page.`,
    h1: `${label} crested gecko morphs`,
  };
}
