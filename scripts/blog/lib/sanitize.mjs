/**
 * Strip the "this was written by AI" punctuation tells before a draft hits
 * production. The hard rule from CLAUDE.md: no em dashes (U+2014), and don't
 * use en dashes (U+2013) or `--` as drop-in replacements either, because
 * those keep the same rhythm.
 *
 * Substitution rule (in order of preference):
 *   1. " — word"   → ", word"           (clausal pause)
 *   2. "word—word" → "word, word"        (parenthetical mid-clause)
 *   3. Standalone   →  ", "
 *
 * En dashes get the same treatment. Double-hyphens used as punctuation
 * (`word--word`, ` -- `) also get rewritten. Hyphens inside hyphenated
 * compounds (`crested-gecko-first`, `well-known`) are left alone.
 *
 * Number ranges with en dashes ("2–3 eggs") are converted to "2-3 eggs"
 * which is the existing house style elsewhere in the codebase.
 *
 * This is a string-level sweep; it does not parse markdown. It runs on
 * every field the publish step copies into src/data/blog-posts.js plus the
 * raw markdown body.
 */

const EM_DASH = /—/g;
const EN_DASH = /–/g;
// `--` used as punctuation: not inside a longer dash run, with surrounding text.
const DOUBLE_HYPHEN_PUNCT = /(\S)\s*--\s*(\S)/g;

/** Replace ALL forbidden dash forms in a single string. */
export function sanitizeDashes(input) {
  if (typeof input !== 'string') return input;
  let out = input;

  // 1. Em dash. Horizontal-only spacing on either side so we don't collapse
  //    paragraph breaks. "word — word" → "word, word"; "word—word" →
  //    "word, word"; "—Leading" → ", Leading".
  out = out.replace(/[ \t]*—[ \t]*/g, ', ');
  out = out.replace(EM_DASH, ', ');

  // 2. En dash.
  //    Numeric / currency range: 2–3, $300–$500 → 2-3, $300-$500.
  //    Anything else: clausal-pause treatment.
  out = out.replace(/(\d)[ \t]*–[ \t]*([\d$£€¥%])/g, '$1-$2');
  out = out.replace(/[ \t]*–[ \t]*/g, ', ');
  out = out.replace(EN_DASH, ', ');

  // 3. Double-hyphen used as a clause break. "word -- word" / "word--word".
  out = out.replace(DOUBLE_HYPHEN_PUNCT, '$1, $2');

  // Merge any double-comma artifacts the substitutions created (e.g.
  // "word, — word" → "word, , word" → "word, word"). We deliberately do
  // NOT do general whitespace normalization here, because dropping or
  // collapsing whitespace breaks code indentation when the sanitizer is
  // run over a JS source file (which we do as a one-time corpus sweep).
  out = out.replace(/,[ \t]*,/g, ',');

  return out;
}

/**
 * Recursively sanitize a draft object emitted by the writer. Strings get
 * scrubbed in place; objects and arrays are walked. Numbers/booleans pass
 * through untouched.
 */
export function sanitizeDraft(draft) {
  if (draft == null) return draft;
  if (typeof draft === 'string') return sanitizeDashes(draft);
  if (Array.isArray(draft)) return draft.map(sanitizeDraft);
  if (typeof draft === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(draft)) out[k] = sanitizeDraft(v);
    return out;
  }
  return draft;
}

/** Returns an array of strings that still contain forbidden dashes. */
export function findResidualDashes(value, path = '$') {
  const hits = [];
  if (typeof value === 'string') {
    if (/[–—]/.test(value) || /\S\s*--\s*\S/.test(value)) {
      hits.push({ path, sample: value.slice(0, 160) });
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findResidualDashes(v, `${path}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) hits.push(...findResidualDashes(v, `${path}.${k}`));
  }
  return hits;
}
