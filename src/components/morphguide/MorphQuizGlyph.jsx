import IllustratedGecko from './IllustratedGecko';

/** The quiz uses the same anatomical plate as the guide and continuous slider. */
export default function MorphQuizGlyph({ cream = 'sides', lines = 'none', spots = 'none', tone = 'normal', eyes = 'dark', focus = null, className = '' }) {
  const palette = tone === 'gray'
    ? { base: '#787a74', dark: '#353d38', pattern: '#e6e2d6', eye: '#9b956b', outline: '#41473c' }
    : tone === 'pale'
      ? { base: '#e6dfce', dark: '#aa9c85', pattern: '#f9f6ed', eye: '#b9a064', outline: '#74654f' }
      : { base: '#a9502e', dark: '#542d1f', pattern: '#ead6a9', eye: '#b5a05c', outline: '#3c2b20' };
  if (eyes === 'red') palette.eye = '#cc6d77';
  return <IllustratedGecko decorative className={className} focus={focus} phenotype={{
    palette, dorsal: cream === 'none' ? 0 : 1, flameTongues: cream === 'back' ? 0.7 : 0.3,
    lateral: cream === 'everywhere' ? 1 : cream === 'sides' ? 0.55 : 0,
    pinstripe: lines === 'full' ? 1 : lines === 'broken' ? 0.5 : 0,
    dalmatian: spots === 'lots' ? 105 : spots === 'some' || spots === 'red' ? 15 : 0,
    redSpots: spots === 'red' ? 1 : 0, albino: eyes === 'red',
  }} />;
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
