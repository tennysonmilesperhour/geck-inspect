import { MORPHS } from '@/data/morph-guide';

/**
 * "Which morph is my gecko?" quiz: the questions and the scoring.
 *
 * Pure logic, no React, so it can be unit tested. The quiz asks four
 * picture questions. Every answer adds points to a few morphs according to
 * the RULES table below, then scoreMorphs() returns the best one to three
 * matches with a plain reason for each.
 *
 * This is a friendly first guess, not an identification. A photo through
 * the Recognition tool gives a far more confident answer, and the result
 * screen says so.
 */

export const QUIZ_STEPS = [
  {
    id: 'pattern',
    question: 'Where is the cream or light pattern?',
    help: 'Look at your gecko from above, ideally when it is fired up (darker and brighter colors).',
    options: [
      { id: 'back', label: 'Back only', hint: 'A light stripe down the back' },
      { id: 'sides', label: 'Sides and legs', hint: 'Cream climbs the sides and the legs' },
      { id: 'everywhere', label: 'Almost everywhere', hint: 'More cream than base color' },
      { id: 'none', label: 'None', hint: 'One even color all over' },
    ],
  },
  {
    id: 'lines',
    question: 'Raised cream scales in lines down the back?',
    help: 'Pinstripe scales are a raised row along each edge of the back, like two rows of beads.',
    options: [
      { id: 'full', label: 'Full lines', hint: 'Unbroken, head to hips' },
      { id: 'broken', label: 'Broken lines', hint: 'Rows with gaps in them' },
      { id: 'no', label: 'No', hint: 'No raised rows' },
    ],
  },
  {
    id: 'spots',
    question: 'Any dark spots?',
    help: 'Spots that show in both fired-up and fired-down colors, not just freckles of pattern.',
    options: [
      { id: 'none', label: 'None', hint: 'Clean, no spots' },
      { id: 'some', label: 'Some', hint: 'A handful scattered around' },
      { id: 'lots', label: 'Lots', hint: 'Dozens, often on the head and legs' },
      { id: 'red', label: 'Red spots', hint: 'Spots that are red, not black' },
    ],
  },
  {
    id: 'unusual',
    question: 'Anything unusual?',
    help: 'Pick the one that stands out most. Most geckos are "none of these".',
    options: [
      { id: 'red-eyes', label: 'Red or pink eyes', hint: 'No dark pupil color' },
      { id: 'pale', label: 'Very pale or white', hint: 'White patches or a near-white body' },
      { id: 'gray', label: 'Gray, no yellow or red', hint: 'Black, white and gray tones only' },
      { id: 'none', label: 'None of these', hint: 'Normal eyes and colors' },
    ],
  },
];

/**
 * The rule table. For each step and answer: which morphs gain points, how
 * many, and the clue shown to the visitor in the reason line. Weights:
 * 5 = this answer nearly names the morph (red eyes), 3 = strong sign,
 * 2 = good sign, 1 = a hint that only matters to break a tie.
 *
 * Every slug here must exist in MORPHS; a unit test checks this.
 */
export const RULES = {
  pattern: {
    back: {
      clue: 'cream only down the back',
      points: { flame: 3, bicolor: 1, harlequin: 1 },
    },
    sides: {
      clue: 'cream on the sides and legs',
      points: { harlequin: 3, 'extreme-harlequin': 1, tricolor: 1 },
    },
    everywhere: {
      clue: 'cream almost everywhere',
      points: { 'extreme-harlequin': 3, harlequin: 1, 'lilly-white': 1 },
    },
    none: {
      clue: 'no cream pattern',
      points: { patternless: 3, bicolor: 1 },
    },
  },
  lines: {
    full: {
      clue: 'full lines of raised scales',
      points: { pinstripe: 3, 'phantom-pinstripe': 1 },
    },
    broken: {
      clue: 'broken lines of raised scales',
      points: { pinstripe: 2, 'phantom-pinstripe': 1 },
    },
    no: { clue: null, points: {} },
  },
  spots: {
    none: { clue: null, points: {} },
    some: {
      clue: 'some dark spots',
      points: { dalmatian: 3 },
    },
    lots: {
      clue: 'lots of dark spots',
      points: { 'super-dalmatian': 3, dalmatian: 1 },
    },
    red: {
      clue: 'red spots (a red spot Dalmatian)',
      points: { dalmatian: 3 },
    },
  },
  unusual: {
    'red-eyes': {
      clue: 'red or pink eyes',
      points: { albino: 5 },
    },
    pale: {
      clue: 'very pale or white',
      points: { 'lilly-white': 3, moonglow: 2, 'white-wall': 1, cream: 1 },
    },
    gray: {
      clue: 'gray with no yellow or red',
      points: { axanthic: 5, lavender: 1 },
    },
    none: { clue: null, points: {} },
  },
};

/**
 * Rules that only make sense for a pair of answers. Raised scales on a
 * gecko with no cream pattern are the classic Phantom Pinstripe: the rows
 * are there but the same color as the body.
 */
export const COMBO_RULES = [
  {
    when: { pattern: 'none', lines: ['full', 'broken'] },
    clue: 'raised scales with no cream color',
    points: { 'phantom-pinstripe': 4 },
  },
  {
    when: { pattern: 'sides', lines: ['full'] },
    // A Harlequin Pinstripe: the full rows are the rarer, defining trait,
    // so Pinstripe should lead with Harlequin as the runner-up.
    clue: null,
    points: { pinstripe: 2 },
  },
];

const MAX_RESULTS = 3;

function matches(when, answers) {
  return Object.entries(when).every(([step, want]) =>
    Array.isArray(want) ? want.includes(answers[step]) : answers[step] === want,
  );
}

function sentence(clues) {
  if (clues.length === 0) return '';
  if (clues.length === 1) return clues[0];
  return `${clues.slice(0, -1).join(', ')} and ${clues[clues.length - 1]}`;
}

/**
 * Score every morph against the answers.
 *
 * @param {Record<string,string>} answers  step id -> option id
 * @param {Array} morphs  defaults to MORPHS; only slugs in this list are returned
 * @returns {Array<{slug:string,name:string,score:number,reason:string}>}
 *   the best one to three matches, best first. A morph is kept when it
 *   scores at least half of the top score, so a clear winner is shown
 *   alone and a close call shows its runners-up.
 */
export function scoreMorphs(answers = {}, morphs = MORPHS) {
  const bySlug = new Map(morphs.map((m, i) => [m.slug, { morph: m, order: i }]));
  const tally = new Map();

  const add = (slug, pts, clue) => {
    if (!bySlug.has(slug) || !pts) return;
    const t = tally.get(slug) || { score: 0, clues: [] };
    t.score += pts;
    if (clue) t.clues.push({ clue, pts });
    tally.set(slug, t);
  };

  for (const step of QUIZ_STEPS) {
    const rule = RULES[step.id]?.[answers[step.id]];
    if (!rule) continue;
    for (const [slug, pts] of Object.entries(rule.points)) add(slug, pts, rule.clue);
  }
  for (const combo of COMBO_RULES) {
    if (!matches(combo.when, answers)) continue;
    for (const [slug, pts] of Object.entries(combo.points)) add(slug, pts, combo.clue);
  }

  const ranked = [...tally.entries()]
    .map(([slug, t]) => ({ slug, ...t, order: bySlug.get(slug).order }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
  if (ranked.length === 0) return [];

  const top = ranked[0].score;
  return ranked
    .filter((r) => r.score * 2 >= top)
    .slice(0, MAX_RESULTS)
    .map((r) => {
      // Strongest clues first, at most two, so the line stays short.
      const clues = [...new Set(
        [...r.clues].sort((a, b) => b.pts - a.pts).map((c) => c.clue),
      )].slice(0, 2);
      return {
        slug: r.slug,
        name: bySlug.get(r.slug).morph.name,
        score: r.score,
        reason: clues.length ? `You said ${sentence(clues)}.` : '',
      };
    });
}

/** True once every step has an answer. */
export function quizComplete(answers = {}) {
  return QUIZ_STEPS.every((s) => Boolean(answers[s.id]));
}
