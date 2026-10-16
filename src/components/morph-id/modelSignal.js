/**
 * Plain words for Morph ID's 0 to 100 scores.
 *
 * The scores (a candidate's fit, a photo's evidence strength, the overall
 * model_signal) are numbers the model writes about its own answer. Language
 * and vision models are poorly calibrated when they rate themselves, and
 * Morph ID has not been measured on an independent, seller-disjoint set of
 * photos yet (docs/morph-id-eval/README.md), so "82/100" read as a
 * measurement it is not. The app shows a word instead, always introduced as
 * the AI's own estimate. The cut points are round numbers, not fitted ones;
 * replace them with bands fitted on the validation split once the gold set
 * in that README exists.
 */

const FIT_WORDS = [
  { min: 70, word: 'close fit' },
  { min: 40, word: 'partial fit' },
  { min: 0, word: 'weak fit' },
];

const EVIDENCE_WORDS = [
  { min: 70, word: 'clear evidence' },
  { min: 40, word: 'some evidence' },
  { min: 0, word: 'little evidence' },
];

function pick(list, score) {
  const n = Number(score);
  const value = Number.isFinite(n) ? n : 0;
  return list.find((band) => value >= band.min).word;
}

/** How well one look fits the photos, in the AI's own estimate. */
export function fitWord(score) {
  return pick(FIT_WORDS, score);
}

/** How much one photo shows, in the AI's own estimate. */
export function evidenceWord(score) {
  return pick(EVIDENCE_WORDS, score);
}

/** The label put before either word, so it never reads as a measurement. */
export const ESTIMATE_PREFIX = "AI's own estimate";
