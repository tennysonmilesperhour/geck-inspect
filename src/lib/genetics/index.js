/**
 * Genetics adapter: the single place the app talks to the Foundation
 * Genetics engine (`crested-gecko-app`, vendored in /vendor).
 *
 * The engine owns genetic FACTS: canonical trait names, spellings,
 * inheritance (dominance), loci, super forms, and risk warnings.
 * UI surfaces (MorphIDSelector catalog, morph guide content, market
 * analytics) stay curated by hand but are checked against the engine
 * by scripts/check-genetics-consistency.mjs so they cannot drift.
 *
 * Use this module instead of importing 'crested-gecko-app' directly in
 * new code, so display sanitation and tag canonicalization stay applied.
 */
import {
  TRAITS,
  getTrait,
  predict,
  tagToGenotype,
  detectRisks,
  describeGenotype,
  matchCombos,
  COMBO_MORPHS,
  RISK_PAIRINGS,
} from 'crested-gecko-app';

export {
  TRAITS,
  getTrait,
  predict,
  tagToGenotype,
  detectRisks,
  describeGenotype,
  matchCombos,
  COMBO_MORPHS,
  RISK_PAIRINGS,
};

// ---------- display sanitation ----------------------------------------
// Engine strings (risk notes, needs_review messages) may contain em
// dashes; the project bans them in anything rendered to users. Run any
// engine-sourced string through this before display.
export function displayText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ');
}

// ---------- tag canonicalization ---------------------------------------
// geckos.morph_tags is a free-string array written by several forms over
// the years, so spelling variants exist ('Lily White' vs 'Lilly White').
// Canonicalize on write: map known variants to the engine's canonical
// name, preserve Het / Possible Het prefixes, pass unknown tags through
// untouched (base colors, pattern tags, and display-state tags are not
// engine traits and stay as the curated catalog spells them).

const VARIANT_TO_CANONICAL = (() => {
  const map = new Map();
  for (const trait of TRAITS) {
    map.set(trait.name.toLowerCase(), trait.name);
    for (const alt of trait.alternate_names || []) {
      map.set(alt.toLowerCase(), trait.name);
    }
  }
  // Spellings seen in legacy data that the engine doesn't list.
  map.set('lillywhite', 'Lilly White');
  map.set('lilly-white', 'Lilly White');
  map.set('lily-white', 'Lilly White');
  return map;
})();

// Where the engine's spelling differs from the app's established display
// convention (catalog, marketplace filters, existing morph_tags rows),
// the app spelling wins for display and stored tags. Facts still come
// from the engine; this only restyles the label.
const APP_DISPLAY_OVERRIDES = new Map([
  ['Softscale', 'Soft Scale'],
  ['Super Softscale', 'Super Soft Scale'],
]);

function toAppSpelling(name) {
  return APP_DISPLAY_OVERRIDES.get(name) || name;
}

const HET_PREFIX = /^(possible\s+het|pos\s+het|p\.?\s*het|het)\s+/i;

export function canonicalizeMorphTag(tag) {
  if (typeof tag !== 'string') return tag;
  const trimmed = tag.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;

  const prefixMatch = trimmed.match(HET_PREFIX);
  const body = prefixMatch ? trimmed.slice(prefixMatch[0].length) : trimmed;
  const canonicalBody = VARIANT_TO_CANONICAL.get(body.toLowerCase());
  if (!canonicalBody) return trimmed;
  const display = toAppSpelling(canonicalBody);

  if (!prefixMatch) return display;
  const rawPrefix = prefixMatch[1].toLowerCase();
  const prefix = rawPrefix.startsWith('het') ? 'Het' : 'Possible Het';
  return `${prefix} ${display}`;
}

export function canonicalizeMorphTags(tags) {
  if (!Array.isArray(tags)) return tags;
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    const canonical = canonicalizeMorphTag(tag);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}
