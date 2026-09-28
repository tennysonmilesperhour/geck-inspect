/**
 * Trait valuation: price a gecko from the Geck Data trait value table.
 *
 * public.trait_value_table() returns asking-price bands (p25, p50, p75)
 * per crested trait, split by age class and sex with rolled-up 'any'
 * levels, plus each trait's taxonomy aliases. This module matches a
 * gecko's selected traits against that table and turns the best match
 * into a value. Pure functions only, so the Portfolio can call them in a
 * memo and tests can run without a database.
 *
 * Matching
 * --------
 * morph_tags and the older free-text morphs_traits field are both messy
 * ('Tricolor Lilly white', 'Het Phantom\nHarlequin', 'Dalmation'), so
 * matching scans words left to right and takes the longest alias phrase
 * at each position. Het handling:
 *   - 'Het X' (or '100% het X') counts only if the table has a 'Het X'
 *     trait (Het Axanthic does). The X after it is consumed either way,
 *     so a het never prices the animal as a visual X.
 *   - 'Possible het X', 'pos het X', '50% het X' and 'ph X' are skipped.
 *
 * Pricing
 * -------
 * For each matched trait, use the most specific band with enough data:
 * age + sex, then age, then sex, then all listings. The trait with the
 * highest median drives the price (the same rule geck_data.v_listing_value
 * uses: a Lilly White Dalmatian sells as a Lilly White). The quality tier
 * picks a point in that band: pet at p25, breeder at the median, high-end
 * halfway to p75, investment at p75.
 *
 * The table is built from crested gecko listings only, so animals logged
 * as another species (gargoyle, leopard) are never priced from it.
 */

import { patternGradeForScore } from './quality';

const WORD_FIXES = new Map([
  ['dalmation', 'dalmatian'],
  ['dalmations', 'dalmatian'],
  ['tricolore', 'tricolor'],
  ['harly', 'harley'],
  ['lillywhite', 'lilly white'],
]);

const POSSIBLE_PREFIX = new Set(['possible', 'poss', 'pos', 'p']);

export const TIER_POSITIONS = {
  pet: { label: 'the low end of the typical range', pick: (b) => b.p25 },
  breeder: { label: 'the median', pick: (b) => b.p50 },
  high_end: { label: 'the upper half of the typical range', pick: (b) => (b.p50 + b.p75) / 2 },
  investment: { label: 'the top of the typical range', pick: (b) => b.p75 },
};

const LEVEL_LABELS = {
  age_sex: (age, sex) => `${AGE_LABELS[age]} ${SEX_LABELS[sex]}`,
  age: (age) => AGE_LABELS[age],
  sex: (_age, sex) => SEX_LABELS[sex],
  all: () => 'all ages and sexes',
};

const AGE_LABELS = {
  hatchling: 'hatchling',
  juvenile: 'juvenile',
  subadult: 'subadult',
  adult: 'adult',
};

const SEX_LABELS = {
  male: 'male',
  female: 'female',
  unsexed: 'unsexed',
};

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Lowercase words with punctuation stripped and common misspellings fixed. */
export function toWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .flatMap((w) => (WORD_FIXES.get(w) || w).split(' '));
}

/**
 * Build a lookup from trait_value_table rows.
 * Returns { traits: Map(key -> { name, bands, n }), aliases: Map(phrase -> key), maxWords }.
 */
export function buildTraitValueIndex(rows) {
  const traits = new Map();
  const aliasSets = new Map();
  for (const row of rows || []) {
    const name = typeof row?.trait === 'string' ? row.trait.trim() : '';
    if (!name) continue;
    const p25 = toNumber(row.p25);
    const p50 = toNumber(row.p50);
    const p75 = toNumber(row.p75);
    if (!p25 || !p50 || !p75) continue;
    const key = name.toLowerCase();
    let trait = traits.get(key);
    if (!trait) {
      trait = { key, name, bands: new Map(), n: 0 };
      traits.set(key, trait);
      aliasSets.set(key, new Set());
    }
    const n = Number(row.n) || 0;
    trait.bands.set(`${row.age_class}|${row.sex_class}`, { n, p25, p50, p75 });
    if (row.age_class === 'any' && row.sex_class === 'any') trait.n = n;
    const set = aliasSets.get(key);
    set.add(name);
    for (const alias of Array.isArray(row.aliases) ? row.aliases : []) set.add(alias);
  }

  // A trait's own name always wins its phrase. A synonym shared by two
  // traits goes to the one with more listings behind it.
  const aliases = new Map();
  let maxWords = 1;
  const claim = (phrase, key, own) => {
    const cur = aliases.get(phrase);
    if (cur && cur.own && !own) return;
    if (cur && cur.own === own && traits.get(cur.key).n >= traits.get(key).n) return;
    aliases.set(phrase, { key, own });
  };
  for (const [key, set] of aliasSets) {
    const ownPhrase = toWords(traits.get(key).name).join(' ');
    for (const alias of set) {
      const words = toWords(alias);
      if (words.length === 0) continue;
      const phrase = words.join(' ');
      claim(phrase, key, phrase === ownPhrase);
      maxWords = Math.max(maxWords, words.length);
    }
  }
  const flat = new Map();
  for (const [phrase, { key }] of aliases) flat.set(phrase, key);
  return { traits, aliases: flat, maxWords };
}

function longestMatch(words, start, index) {
  const limit = Math.min(index.maxWords, words.length - start);
  for (let len = limit; len >= 1; len -= 1) {
    const key = index.aliases.get(words.slice(start, start + len).join(' '));
    if (key) return { key, len };
  }
  return null;
}

/** Trait keys found in one piece of text, in reading order, without repeats. */
export function matchTraitsInText(text, index) {
  const words = toWords(text);
  const found = [];
  const add = (key) => { if (!found.includes(key)) found.push(key); };
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    let het = false;
    let possible = false;
    let next = i;
    if (w === 'het') {
      het = true; next = i + 1;
    } else if (words[i + 1] === 'het' && (POSSIBLE_PREFIX.has(w) || /^\d+$/.test(w))) {
      if (w === '100') het = true; else possible = true;
      next = i + 2;
    } else if (w === 'ph') {
      possible = true; next = i + 1;
    }

    if (het || possible) {
      if (het) {
        const hetMatch = longestMatch(['het', ...words.slice(next)], 0, index);
        if (hetMatch) add(hetMatch.key);
      }
      const base = longestMatch(words, next, index);
      i = base ? next + base.len : next;
      continue;
    }

    const m = longestMatch(words, i, index);
    if (m) {
      add(m.key);
      i += m.len;
    } else {
      i += 1;
    }
  }
  return found;
}

/**
 * Trait keys for a gecko. Selected morph_tags come first; the free-text
 * morphs_traits field is the fallback when the tags match nothing.
 */
export function matchGeckoTraits(gecko, index) {
  const tags = Array.isArray(gecko?.morph_tags) ? gecko.morph_tags : [];
  const fromTags = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    for (const key of matchTraitsInText(tag, index)) {
      if (!fromTags.includes(key)) fromTags.push(key);
    }
  }
  if (fromTags.length > 0) return fromTags;
  return matchTraitsInText(gecko?.morphs_traits, index);
}

/**
 * Age class matching geck_data._age_class. Current weight is the better
 * signal because listings label maturity by size; hatch date is the
 * fallback. Weight cutoffs sit between the average listing weights per
 * class (baby 8g, juvenile 15g, subadult 28g, adult 46g).
 */
export function ageClassFor(gecko, now = new Date()) {
  const w = toNumber(gecko?.weight_grams);
  if (w) {
    if (w < 12) return 'hatchling';
    if (w < 22) return 'juvenile';
    if (w < 37) return 'subadult';
    return 'adult';
  }
  let hatch = gecko?.hatch_date ? new Date(gecko.hatch_date) : null;
  if ((!hatch || Number.isNaN(hatch.getTime())) && gecko?.estimated_hatch_year) {
    hatch = new Date(Date.UTC(Number(gecko.estimated_hatch_year), 6, 1));
  }
  if (!hatch || Number.isNaN(hatch.getTime())) return null;
  const months = (now.getTime() - hatch.getTime()) / (30.44 * 86_400_000);
  if (months < 0) return null;
  if (months < 6) return 'hatchling';
  if (months < 12) return 'juvenile';
  if (months < 18) return 'subadult';
  return 'adult';
}

/**
 * Quality tier for pricing: the stored pattern_grade, else the tier the
 * Quality Scale score falls in, else breeder (priced at the median).
 */
export function qualityTierFor(gecko) {
  if (gecko?.pattern_grade && TIER_POSITIONS[gecko.pattern_grade]) return gecko.pattern_grade;
  return patternGradeForScore(gecko?.quality_score) || 'breeder';
}

/** True when the gecko is a crested gecko (blank species means crested). */
export function isCrestedGecko(gecko) {
  const species = String(gecko?.species || '').trim();
  return species === '' || /crested/i.test(species);
}

/** Sex class matching geck_data._sex_class. */
export function sexClassFor(gecko) {
  const s = String(gecko?.sex || '').toLowerCase();
  if (s === 'male') return 'male';
  if (s === 'female') return 'female';
  return 'unsexed';
}

/** Most specific band available for this trait, age and sex. */
export function bandFor(trait, ageClass, sexClass) {
  const tries = [];
  if (ageClass) {
    tries.push(['age_sex', `${ageClass}|${sexClass}`]);
    tries.push(['age', `${ageClass}|any`]);
  }
  tries.push(['sex', `any|${sexClass}`]);
  tries.push(['all', 'any|any']);
  for (const [level, k] of tries) {
    const band = trait.bands.get(k);
    if (band) return { ...band, level };
  }
  return null;
}

/** Plain-language label for the slice of listings a band came from. */
export function bandLevelLabel(level, ageClass, sexClass) {
  const fn = LEVEL_LABELS[level] || LEVEL_LABELS.all;
  return fn(ageClass, sexClass);
}

/**
 * Value one gecko from the trait table. Returns null when no trait
 * matched. `tier` is the quality tier id (pet, breeder, high_end,
 * investment); unknown tiers price at the median.
 */
export function valueFromTraitTable(gecko, index, tier = 'breeder', now = new Date()) {
  if (!index || index.traits.size === 0 || !isCrestedGecko(gecko)) return null;
  const keys = matchGeckoTraits(gecko, index);
  if (keys.length === 0) return null;
  const ageClass = ageClassFor(gecko, now);
  const sexClass = sexClassFor(gecko);

  let best = null;
  for (const key of keys) {
    const trait = index.traits.get(key);
    const band = trait && bandFor(trait, ageClass, sexClass);
    if (band && (!best || band.p50 > best.band.p50)) best = { trait, band };
  }
  if (!best) return null;

  const position = TIER_POSITIONS[tier] || TIER_POSITIONS.breeder;
  return {
    value: position.pick(best.band),
    trait: best.trait.name,
    band: best.band,
    ageClass,
    sexClass,
    tier: TIER_POSITIONS[tier] ? tier : 'breeder',
    positionLabel: position.label,
    levelLabel: bandLevelLabel(best.band.level, ageClass, sexClass),
    matchedTraits: keys.map((k) => index.traits.get(k).name),
  };
}
