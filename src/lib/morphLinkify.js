/**
 * Turns mentions of other crested gecko morphs inside a piece of guide
 * text into link segments, so "sits one step above Flame" can link to the
 * Flame page without anyone hand-writing links into the data.
 *
 * Kept free of React and the DOM so it can be unit-tested; the page turns
 * the segments into <Link>s (see MorphText.jsx).
 */
import { MORPHS } from '@/data/morph-guide';

/**
 * Aliases that are also ordinary words. "Red", "Pin" or "Solid" show up
 * in plain sentences all the time ("red tones", "solid color"), so they
 * would turn half a paragraph into links. Full morph names still link.
 */
const GENERIC_ALIASES = new Set([
  'red',
  'orange',
  'yellow',
  'solid',
  'pin',
  'cap',
  'trans',
  'tri',
  'white spot',
  'harle',
]);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Short all-caps aliases (LW, SS, WW, EH) only match in capitals, so
// the "ss" in a typo or a code sample never becomes a Soft Scale link.
function isAbbreviation(term) {
  return term.length <= 4 && term === term.toUpperCase() && /[A-Z]/.test(term);
}

const cache = new WeakMap();

/**
 * Build (and cache per morph list) the lookup used by linkifyMorphText:
 * one regex that tries the longest terms first, plus a map from the
 * lower-cased term back to its morph.
 */
export function buildMorphMatcher(morphs = MORPHS) {
  const hit = cache.get(morphs);
  if (hit) return hit;
  const terms = new Map();
  for (const m of morphs) {
    const candidates = [m.name, ...(m.aliases || []).filter((a) => !GENERIC_ALIASES.has(a.toLowerCase()))];
    for (const term of candidates) {
      const t = String(term || '').trim();
      if (t.length < 2) continue;
      const key = t.toLowerCase();
      // The first morph to claim a term keeps it (names come before aliases
      // in the loop, and MORPHS lists the main morphs first).
      if (!terms.has(key)) terms.set(key, { term: t, slug: m.slug, caseSensitive: isAbbreviation(t) });
    }
  }
  const ordered = [...terms.values()].sort((a, b) => b.term.length - a.term.length);
  // Hyphens count as part of a word, so "white-wall" or "near-flame" in a
  // compound is left alone.
  const regex = ordered.length
    ? new RegExp(`(?<![\\w-])(${ordered.map((t) => escapeRegExp(t.term)).join('|')})(s?)(?![\\w-])`, 'gi')
    : null;
  const result = { regex, terms };
  cache.set(morphs, result);
  return result;
}

/**
 * Split `text` into segments: { type: 'text', text } and
 * { type: 'morph', text, slug }.
 *
 * - Longest name wins ("Super Dalmatian" before "Dalmatian").
 * - Case-insensitive, whole words only (a plural "s" is allowed).
 * - The current morph (and any slug in `skip`) is never linked.
 * - Each morph is linked at most once per call, so call it once per
 *   paragraph.
 */
export function linkifyMorphText(text, { currentSlug, skip = [], morphs = MORPHS } = {}) {
  const str = text == null ? '' : String(text);
  if (!str) return [];
  const { regex, terms } = buildMorphMatcher(morphs);
  if (!regex) return [{ type: 'text', text: str }];

  const skipped = new Set([currentSlug, ...skip].filter(Boolean));
  const linked = new Set();
  const out = [];
  let last = 0;
  const push = (seg) => {
    const prev = out[out.length - 1];
    if (seg.type === 'text' && prev?.type === 'text') prev.text += seg.text;
    else out.push(seg);
  };

  regex.lastIndex = 0;
  let m;
  while ((m = regex.exec(str))) {
    // m[2] is an optional plural "s" ("two Harlequins"), kept in the link.
    const match = m[1] + m[2];
    const entry = terms.get(m[1].toLowerCase());
    if (m.index > last) push({ type: 'text', text: str.slice(last, m.index) });
    const ok =
      entry &&
      !skipped.has(entry.slug) &&
      !linked.has(entry.slug) &&
      (!entry.caseSensitive || m[1] === entry.term);
    if (ok) {
      linked.add(entry.slug);
      push({ type: 'morph', text: match, slug: entry.slug });
    } else {
      push({ type: 'text', text: match });
    }
    last = m.index + match.length;
  }
  if (last < str.length) push({ type: 'text', text: str.slice(last) });
  return out;
}

/**
 * "Where to look" chips for a lookalike comparison: the body parts and
 * checks that the difference sentence and the two morphs' visual
 * identifiers talk about. Words in the difference sentence count double,
 * since that sentence is the actual tell.
 */
const LOOK_AREAS = [
  { label: 'Eyes', re: /\b(eyes?|pupils?)\b/i },
  { label: 'Dorsal line', re: /\b(raised (back )?scales|dorsal (line|ridge)|pinstripe)\b/i },
  { label: 'Back', re: /\b(back|dorsum|dorsal|saddle)\b/i },
  { label: 'Flanks', re: /\b(flanks?|sides|lateral line)\b/i },
  { label: 'Legs', re: /\blegs?\b/i },
  { label: 'Head', re: /\bhead\b/i },
  { label: 'Tail', re: /\btail\b/i },
  { label: 'Spot count', re: /\bspots?\b/i },
  { label: 'Scale texture', re: /\b(scales?|texture|leather|skin)\b/i },
  { label: 'Fired down', re: /\bfire[sd]? (up|down)\b|\bfired\b/i },
  { label: 'Color', re: /\b(colou?rs?|pigments?|tones?|red|yellow|cream|white|black|gray|brown)\b/i },
];

export function whereToLook(difference, ...identifierLists) {
  const scores = new Map();
  const add = (text, weight) => {
    if (!text) return;
    for (const area of LOOK_AREAS) {
      if (area.re.test(text)) scores.set(area.label, (scores.get(area.label) || 0) + weight);
    }
  };
  add(difference, 3);
  for (const list of identifierLists) for (const t of list || []) add(t, 1);
  // Body parts beat the generic "Color" chip when they tie.
  const order = LOOK_AREAS.map((a) => a.label);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
    .slice(0, 3)
    .map(([label]) => label);
}
