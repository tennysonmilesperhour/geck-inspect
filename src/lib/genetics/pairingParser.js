/**
 * Omnibox pairing parser: turn breeder shorthand like
 *   "lilly white het axanthic x sable"
 *   "lw 66% het ax x visual phantom"
 *   "capp x luwak"
 * into two calculator picker states.
 *
 * Hobby conventions honored:
 *   - A bare recessive name means the visual ("axanthic" = homozygous
 *     visual); carriers are said with "het".
 *   - A bare incomplete-dominant name means the expressing het
 *     ("lilly white" = one copy).
 *   - "66% het" / "50% het" / "poss het" map to the probabilistic
 *     states introduced in Phase 1.
 *
 * Greedy longest-phrase matching over a generated dictionary; unknown
 * words are returned so the UI can say what it could not read instead
 * of silently dropping genetics (the silent-drop bug class is one of
 * the community's loudest complaints about incumbent calculators).
 */
import { SIMPLE_TRAITS, COMPLEX_ID } from './calculatorCatalog';

const ALIASES = {
  lilly_white: ['lilly white', 'lily white', 'lilly', 'lily', 'lw'],
  axanthic: ['axanthic', 'axan', 'ax'],
  phantom: ['phantom'],
  empty_back: ['empty back', 'eb'],
  softscale: ['soft scale', 'softscale'],
  whiteout: ['whiteout', 'white out', 'whitewall', 'white wall'],
  hypo: ['hypo', 'hypomelanistic'],
  chocho: ['chocho', 'cho cho'],
};

const HET_PREFIXES = [
  { words: ['66% het'], value: 'ph66' },
  { words: ['66 het'], value: 'ph66' },
  { words: ['50% het'], value: 'ph50' },
  { words: ['50 het'], value: 'ph50' },
  { words: ['poss het'], value: 'ph50' },
  { words: ['possible het'], value: 'ph50' },
  { words: ['het'], value: 'het' },
];

/** Build phrase -> state-entry dictionary once. */
function buildDictionary() {
  const dict = new Map();
  const add = (phrase, entry) => {
    // First writer wins so more specific phrases added earlier hold.
    if (!dict.has(phrase)) dict.set(phrase, entry);
  };

  for (const trait of SIMPLE_TRAITS) {
    const names = ALIASES[trait.id] || [trait.label.toLowerCase()];
    for (const name of names) {
      if (trait.dominance === 'recessive') {
        for (const { words, value } of HET_PREFIXES) {
          add(`${words[0]} ${name}`, { id: trait.id, value });
        }
        add(`visual ${name}`, { id: trait.id, value: 'visual' });
        add(name, { id: trait.id, value: 'visual' });
      } else if (trait.dominance === 'incomplete_dominant') {
        add(`super ${name}`, { id: trait.id, value: 'super' });
        add(name, { id: trait.id, value: 'het' });
      } else {
        add(name, { id: trait.id, value: 'visual' });
      }
    }
  }

  // The Cappuccino complex
  const complex = (value) => ({ id: COMPLEX_ID, value });
  add('super cappuccino', complex('super_cappuccino'));
  add('super capp', complex('super_cappuccino'));
  add('melanistic', complex('super_cappuccino'));
  add('super sable', complex('super_sable'));
  add('super highway', complex('super_highway'));
  add('luwak', complex('luwak'));
  add('cappuccino', complex('cappuccino'));
  add('capp', complex('cappuccino'));
  add('sable', complex('sable'));
  add('highway', complex('highway'));

  return dict;
}

const DICTIONARY = buildDictionary();
const MAX_PHRASE_WORDS = 4;
const FILLER = new Set(['and', 'with', 'the', 'a', 'an', 'plus']);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[×✕]/g, ' x ')
    .replace(/[,+/]/g, ' ')
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSide(text) {
  const state = {};
  const unrecognized = [];
  const words = text.split(' ').filter((w) => w && !FILLER.has(w));
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (let len = Math.min(MAX_PHRASE_WORDS, words.length - i); len >= 1; len--) {
      const phrase = words.slice(i, i + len).join(' ');
      const entry = DICTIONARY.get(phrase);
      if (entry) {
        state[entry.id] = entry.value;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      unrecognized.push(words[i]);
      i += 1;
    }
  }
  return { state, unrecognized };
}

/**
 * Parse a full pairing. Returns { sire, dam, unrecognized } where sire
 * and dam are picker states. With no "x" separator, everything goes to
 * the sire and dam stays empty.
 */
export function parsePairing(input) {
  const text = normalize(input);
  if (!text) return { sire: {}, dam: {}, unrecognized: [] };
  const sides = text.split(/\bx\b/);
  const sireSide = parseSide((sides[0] || '').trim());
  const damSide = parseSide(sides.slice(1).join(' ').trim());
  return {
    sire: sireSide.state,
    dam: damSide.state,
    unrecognized: [...sireSide.unrecognized, ...damSide.unrecognized],
  };
}
