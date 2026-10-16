import IllustratedGecko from './IllustratedGecko';
import TraitGecko from './TraitGecko';

/** Visible pattern examples; no invented pictures of unverified genotypes. */
export default function MorphQuizGlyph({ cream = 'sides', lines = 'none', spots = 'none', tone = 'normal', eyes = 'dark', className = '' }) {
  if (eyes === 'red' || tone !== 'normal' || spots === 'red') {
    const morph = eyes === 'red' ? 'albino' : spots === 'red' ? 'super-dalmatian' : tone === 'gray' ? 'axanthic' : 'lilly-white';
    return <IllustratedGecko decorative morph={morph} className={className} />;
  }
  return <TraitGecko decorative view={lines === 'none' ? 'side' : 'top'} className={className} traits={{ dorsal:cream === 'none' ? 0 : 1, lateral:cream === 'everywhere' ? 1 : cream === 'sides' ? .62 : 0, pinstripe:lines === 'full' ? 1 : lines === 'broken' ? .5 : 0, spots:spots === 'lots' ? 1 : spots === 'some' ? .2 : 0 }} />;
}

/** The drawing for each quiz answer, keyed by step id then option id. */
export const QUIZ_GLYPHS = {
  pattern: {
    back: { cream: 'back', focus: 'back' },
    sides: { cream: 'sides', focus: 'sides' },
    everywhere: { cream: 'everywhere', focus: 'body' },
    none: { cream: 'none' },
  },
  lines: {
    full: { cream: 'none', lines: 'full', focus: 'back' },
    broken: { cream: 'none', lines: 'broken', focus: 'back' },
    no: { cream: 'none' },
  },
  spots: {
    none: { cream: 'none' },
    some: { cream: 'none', spots: 'some' },
    lots: { cream: 'none', spots: 'lots' },
    red: { cream: 'none', spots: 'red' },
  },
  unusual: {
    'red-eyes': { cream: 'sides', eyes: 'red', focus: 'eyes' },
    pale: { cream: 'everywhere', tone: 'pale' },
    gray: { cream: 'sides', tone: 'gray' },
    none: { cream: 'sides' },
  },
};
