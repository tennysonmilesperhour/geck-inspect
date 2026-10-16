/**
 * Accepted facts: the origin, history and super-form health facts, and the
 * husbandry numbers, that every page, guide, prompt and email must agree
 * on. scripts/check-genetics-consistency.mjs runs these rules over each
 * surface; a unit test (src/lib/__tests__/acceptedFacts.test.js) proves
 * each rule catches the mistakes it was written for.
 *
 * Why this exists: in October 2026 a blog post told search engines that
 * Lilly White "was discovered by Anthony Caponetto at ACR in 2014", the
 * care guide carried two life-stage weight scales, and the Super Highway
 * nostril claim was stated as fact on some pages and as a report on
 * others. Each rule below is one fact, written down once, with the
 * phrasings that contradict it.
 *
 * Rules work sentence by sentence, so they can be wrong about an unusual
 * sentence. When one is, rephrase the sentence rather than loosening the
 * rule, unless the rule is genuinely wrong.
 *
 * Dependency-free apart from the facts file, so Node can run it.
 */
import {
  ADULT_WEIGHT_G,
  BREEDING,
  INCUBATION_DAYS,
  INCUBATION_PROFILES,
  LIFE_STAGES,
} from '../../src/data/husbandry-facts.js';

// ---------- the facts, in words ----------------------------------------
// Shown in every failure message, so a reader knows what to write.
export const ACCEPTED_FACTS = {
  lillyWhiteOrigin:
    'Lilly White traces to Lilly Exotics (Nick Lumb, United Kingdom), starting with an unusual hatchling in late 2010, and was proven in 2012. AC Reptiles imported and popularised it; it did not originate there.',
  superLillyWhite:
    'Super Lilly White is lethal: embryos die in the egg or within days of hatching.',
  superCappuccino:
    'Super Cappuccino (Melanistic) is not lethal: it usually hatches, with documented health problems (narrowed nostrils, breathing difficulty).',
  superHighway:
    'Super Highway health problems are reported by some breeders, not established. Say "reported" or "not established".',
  cappuccinoOrigin:
    'Cappuccino comes from South Korea (Reptile City Korea), first produced about 2020 and proven about 2021.',
  albinoStatus:
    'Albino is expected to be recessive but is not yet proven; the first healthy hatchlings were announced by Eureka Exotics on 5 March 2026.',
  femaleBreedingMinimum: `A female's breeding minimum is ${BREEDING.femaleMinGrams} g and ${BREEDING.femaleMinMonths} months, one number everywhere.`,
  incubationDays: `Incubation windows are the app's profiles: ${INCUBATION_PROFILES.map((p) => `${p.minDays} to ${p.maxDays} days at ${p.fahrenheit}`).join('; ')} (${INCUBATION_DAYS.min} to ${INCUBATION_DAYS.max} days overall).`,
  lifeStages: `Life stages: ${LIFE_STAGES.map((s, i) => `${s.label.toLowerCase()} ${i === 0 ? `under ${s.maxGrams}` : `${LIFE_STAGES[i - 1].maxGrams}${s.maxGrams === null ? '+' : ` to ${s.maxGrams}`}`} g`).join(', ')}.`,
  adultWeight: `Adults weigh ${ADULT_WEIGHT_G.min} to ${ADULT_WEIGHT_G.max} g.`,
  shedIntervals: `Shed intervals: ${LIFE_STAGES.map((s) => `${s.label.toLowerCase()} every ${s.shedWeeks[0]} to ${s.shedWeeks[1]} weeks`).join(', ')}.`,
};

// ---------- helpers -------------------------------------------------------

// En and em dashes (written by code point so this file contains neither
// character): old ranges like "35-60 g" were often typed with them.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, 'g');

/** Split prose into sentences (also on line breaks, for lists and tables). */
export function sentences(text) {
  return String(text || '')
    .replace(DASHES, ' to ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const LILLY = /\blill?y\s*white\b/i;
const SUPER_LILLY = /\bsuper\s+lill?y(\s*white)?\b|\blill?y\s*white\s*(x|×)\s*lill?y\s*white\b|\btwo copies of (the )?lill?y white\b/i;
const SUPER_CAPP = /\bsuper\s+cap(puccino|p)?s?\b|\bmelanistic\b|\bcappuccino\s*(x|×)\s*cappuccino\b|\bcap\s*(x|×)\s*cap\b/i;
const SUPER_HIGHWAY = /\bsuper\s+highways?\b|\bhighway\s*(x|×)\s*highway\b/i;
const ORIGIN_VERB = /\b(discover\w*|originat\w*|created|founded|first (produced|hatched|bred|appeared|found)|developed|named after|came from)\b/i;
const NEGATION = /\b(not|never|no|unlike|isn't|aren't|non-?viable|nothing)\b|n't\b/i;
const HEDGE_REPORTED = /\breport\w*|not established|unconfirmed|anecdot\w*|unproven|not (yet )?documented|not (yet )?(been )?proven/i;

const STAGE_INDEX = { hatchling: 0, juvenile: 1, 'sub-adult': 2, subadult: 2, adult: 3 };
function stageRange(index) {
  const stage = LIFE_STAGES[index];
  const lo = index === 0 ? 0 : LIFE_STAGES[index - 1].maxGrams;
  return [lo, stage.maxGrams === null ? Infinity : stage.maxGrams];
}

// ---------- the rules -------------------------------------------------------
// Each rule: (sentence) => null | message. `fact` names the ACCEPTED_FACTS
// entry the message quotes.
export const SENTENCE_RULES = [
  {
    fact: 'lillyWhiteOrigin',
    test(s) {
      if (!LILLY.test(s) || !ORIGIN_VERB.test(s)) return null;
      if (/\b(caponetto|ac reptiles|acr)\b/i.test(s) && !/\b(import|popular|distribut|lilly exotics|nick lumb)\w*/i.test(s)) {
        return 'credits Lilly White\'s origin to AC Reptiles / Anthony Caponetto';
      }
      const years = [...s.matchAll(/\b(19|20)\d\d\b/g)].map((m) => Number(m[0]));
      const wrong = years.filter((y) => y !== 2010 && y !== 2012 && y < 2025);
      if (wrong.length && !/\bsuper\b/i.test(s)) return `dates Lilly White's origin to ${wrong.join(', ')}`;
      return null;
    },
  },
  {
    fact: 'superLillyWhite',
    test(s) {
      if (!SUPER_LILLY.test(s)) return null;
      // A health word right after the name, with no other super form in
      // between ("Super Lilly White dies in the egg ... and Super Soft
      // Scale is healthy" is fine).
      const claim = /super\s+lill?y\s*white\w*\b(?:(?!super)[^.;]){0,50}?\b(is|are)\s+(\w+\s+)?(healthy|viable|fine|safe)\b|\b(healthy|viable)\s+super\s+lill?y/i.exec(s);
      if (claim && !NEGATION.test(claim[0]) && !/\b(if|whether|claims?)\b/i.test(s)) {
        return 'describes Super Lilly White as healthy or viable';
      }
      return null;
    },
  },
  {
    fact: 'superCappuccino',
    test(s) {
      if (!SUPER_CAPP.test(s)) return null;
      // "lethal" said of Super Cappuccino: next to the name, or a list of
      // lethal supers that includes it. Questions, "sublethal", "not
      // (confirmed) lethal" and comparisons ("unlike Super Lilly White")
      // are fine.
      const lethalBelongsToLilly = /super\s+lill?y\s*white\s+(is|are)\s+(\w+\s+)?lethal/i.test(s);
      const near = /super\s+cap\w*\b(?:(?!super)[^.;]){0,40}?\blethal\b/i.exec(s)
        || (!lethalBelongsToLilly && /\blethal\b(?:(?!super)[^.;]){0,25}?\bsuper\s+cap/i.exec(s))
        || /\blethal (alleles?|supers?) are common\b[^.]*super\s+cap/i.exec(s);
      const denied = /\b(not|isn't|never|no)\b[^.;]{0,30}?\blethal|sub-?lethal|non-?lethal|\bunlike\b/i.test(s);
      if (near && !denied && !/\?\s*$/.test(s)) {
        return 'calls Super Cappuccino lethal';
      }
      const healthy = /super\s+cap\w*\b(?:(?!super)[^.;]){0,30}?\b(is|are)\s+(\w+\s+)?(healthy|fine|safe)\b/i.exec(s);
      if (healthy && !NEGATION.test(healthy[0]) && !/\b(if|whether|claims?|seems?|appears?|might|may)\b/i.test(s)) {
        return 'describes Super Cappuccino as healthy';
      }
      return null;
    },
  },
  {
    fact: 'superHighway',
    test(s) {
      if (!SUPER_HIGHWAY.test(s) || !/\b(nostril|health)\w*/i.test(s)) return null;
      if (/\b(has|have|with|shows?)\s+documented\b|\bdocumented (complications|health|nostril)/i.test(s) && !/super cappuccino/i.test(s)) {
        return 'states Super Highway health problems as documented';
      }
      if (!HEDGE_REPORTED.test(s) && !/\bneither\b/i.test(s)) {
        return 'states Super Highway health problems without saying they are reported, not established';
      }
      return null;
    },
  },
  {
    fact: 'cappuccinoOrigin',
    test(s) {
      if (!/\bcappuccino\b/i.test(s) || !ORIGIN_VERB.test(s) || /\bsuper\b|frappuccino|luwak/i.test(s)) return null;
      if (/\b(pangea|ac reptiles|caponetto|lm reptiles|lil monsters|gecko haven|eureka)\b/i.test(s) && !/korea/i.test(s)) {
        return 'credits Cappuccino\'s origin to a breeder outside South Korea';
      }
      const years = [...s.matchAll(/\b(19|20)\d\d\b/g)].map((m) => Number(m[0]));
      const wrong = years.filter((y) => y < 2019 || y > 2022);
      if (wrong.length) return `dates Cappuccino's origin to ${wrong.join(', ')}`;
      return null;
    },
  },
  {
    fact: 'albinoStatus',
    test(s) {
      if (!/\balbino/i.test(s) || !/\brecessive\b/i.test(s)) return null;
      if (/\b(proven|confirmed)\b/i.test(s) && !/\b(not|un)\s*(yet\s*)?(been\s*)?(proven|confirmed)|unproven|expected|has to be shown|still has to|until\b/i.test(s)) {
        return 'states Albino as a proven recessive';
      }
      return null;
    },
  },
  {
    fact: 'femaleBreedingMinimum',
    test(s) {
      if (!/\b(breed|bred|pair)\w*/i.test(s)) return null;
      const m = s.match(/\b(female|she)\b[^.]{0,80}?(at least|minimum|min\.?|under|below|≥|>=)\s*(about\s*)?(\d{2})(\s*(to|-)\s*(\d{2}))?\s*(g|grams)\b/i);
      // Weights under 25 g are about sexing or buying young, not breeding.
      if (!m || Number(m[4]) < 25) return null;
      const lo = Number(m[4]);
      const hi = m[7] ? Number(m[7]) : null;
      if (lo !== BREEDING.femaleMinGrams || (hi !== null && hi !== BREEDING.femaleMinGrams)) {
        return `gives a female breeding minimum of ${hi ? `${lo} to ${hi}` : lo} g`;
      }
      return null;
    },
  },
  {
    fact: 'incubationDays',
    test(s) {
      if (!/\b(incubat\w*|hatch\w*|eggs?)\b/i.test(s)) return null;
      const allowed = new Set([
        ...INCUBATION_PROFILES.map((p) => `${p.minDays}-${p.maxDays}`),
        `${INCUBATION_DAYS.min}-${INCUBATION_DAYS.max}`,
      ]);
      for (const m of s.matchAll(/\b(\d{2,3})\s*(?:to|-)\s*(\d{2,3})\s*days\b/gi)) {
        const lo = Number(m[1]);
        const hi = Number(m[2]);
        if (lo < 40) continue; // not an incubation-length range
        if (!allowed.has(`${lo}-${hi}`)) return `gives an incubation window of ${lo} to ${hi} days`;
      }
      return null;
    },
  },
  {
    fact: 'lifeStages',
    test(s) {
      // "Hatchling (0 to 8 g)", "Juveniles 12-25g", "Hatchlings <12g", "Adults 25g+"
      const re = /\b(hatchlings?|juveniles?|sub-?adults?|adults?)\b\s*\(?\s*(<|under|up to)?\s*(\d+(?:\.\d+)?)\s*(?:(?:to|-)\s*(\d+(?:\.\d+)?))?\s*(g|grams)\b\s*(\+)?/gi;
      for (const m of s.matchAll(re)) {
        const word = m[1].toLowerCase().replace(/s$/, '').replace('subadult', 'sub-adult');
        const index = STAGE_INDEX[word];
        if (index === undefined) continue;
        const [lo, hi] = stageRange(index);
        const a = Number(m[3]);
        const b = m[4] ? Number(m[4]) : null;
        const under = Boolean(m[2]);
        const plus = Boolean(m[6]);
        if (!under && !plus && b === null) continue; // a single weight, not a range
        // "under N g" only says where the stage ends ("a hatchling or
        // juvenile under 15 g"), so it must end inside the stage.
        const bad = under
          ? a <= lo || a > hi
          : plus
            ? a < lo || a >= hi
            : a < lo || b > hi;
        if (bad) {
          return `gives a life-stage weight range that is not the shared scale ("${m[0].trim()}")`;
        }
      }
      return null;
    },
  },
  {
    fact: 'adultWeight',
    test(s) {
      const m = s.match(/\badults?\b[^.]{0,30}?\b(weigh\w*|top out|reach\w*|range)\b[^.]{0,20}?\b(\d{2})\s*(?:to|-)\s*(\d{2})\s*(g|grams)\b/i);
      if (!m) return null;
      if (/\b(males?|females?|breeding)\b/i.test(s.slice(0, m.index + m[0].length))) return null;
      if (Number(m[2]) !== ADULT_WEIGHT_G.min || Number(m[3]) !== ADULT_WEIGHT_G.max) {
        return `gives an adult weight of ${m[2]} to ${m[3]} g`;
      }
      return null;
    },
  },
  {
    fact: 'shedIntervals',
    test(s) {
      if (!/\bshed/i.test(s)) return null;
      const m = s.match(/\bevery\s*(\d+)\s*(?:to|-)\s*(\d+)\s*(days|weeks)\b/i);
      if (!m) return null;
      const scale = m[3].toLowerCase() === 'days' ? 7 : 1;
      const lo = Number(m[1]) / scale;
      const hi = Number(m[2]) / scale;
      const stageWord = s.match(/\b(hatchlings?|juveniles?|sub-?adults?|adults?)\b/i);
      if (!stageWord) {
        const all = [LIFE_STAGES[0].shedWeeks[0], LIFE_STAGES[LIFE_STAGES.length - 1].shedWeeks[1]];
        if (lo !== all[0] || hi !== all[1]) return `gives a shed interval of ${m[1]} to ${m[2]} ${m[3]} without naming a life stage`;
        return null;
      }
      const index = STAGE_INDEX[stageWord[1].toLowerCase().replace(/s$/, '').replace('subadult', 'sub-adult')];
      const [wLo, wHi] = LIFE_STAGES[index].shedWeeks;
      if (lo !== wLo || hi !== wHi) return `gives ${stageWord[1]} a shed interval of ${m[1]} to ${m[2]} ${m[3]}`;
      return null;
    },
  },
];

/**
 * Check one passage. Calls note(message) for each sentence that breaks an
 * accepted fact, and returns how many it found.
 */
export function checkAcceptedFacts(text, note, { only } = {}) {
  let found = 0;
  for (const sentence of sentences(text)) {
    for (const rule of SENTENCE_RULES) {
      if (only && !only.includes(rule.fact)) continue;
      const problem = rule.test(sentence);
      if (problem) {
        found += 1;
        note(`${problem}: "${sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence}". Accepted fact: ${ACCEPTED_FACTS[rule.fact]}`);
      }
    }
  }
  return found;
}
