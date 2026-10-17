/**
 * Which pattern studio lesson a Morph Guide page opens, or null when the
 * page has none. Kept apart from PatternSpectrum.jsx so a morph page can
 * tell whether to show the studio without downloading it. Connects detail
 * pages to an existing, relevant specimen and progression lesson.
 */
export function spectrumPositionFor(slug) {
  const coverage = ['flame', 'harlequin', 'extreme-harlequin'].indexOf(slug);
  if (coverage >= 0) return { track: 'coverage', pos: coverage + 1 };
  if (
    [
      'bicolor',
      'lilly-white',
      'super-lilly-white',
      'whiteout',
      'super-whiteout',
      'white-wall',
      'white-wall-white-spot',
      'creamsicle',
      'tricolor',
    ].includes(slug)
  ) {
    return { track: 'coverage', pos: 2 };
  }
  if (slug === 'pinstripe') return { track: 'pinning', pos: 2 };
  if (
    [
      'partial-pinstripe',
      'quad-stripe',
      'super-stripe',
      'empty-back',
      'super-empty-back',
      'highway',
      'super-highway',
    ].includes(slug)
  ) {
    return { track: 'pinning', pos: 1 };
  }
  if (
    [
      'tiger',
      'brindle',
      'extreme-brindle',
      'tiger-brindle',
      'dalmatian',
      'super-dalmatian',
      'mardi-gras',
      'confetti',
      'halloween',
    ].includes(slug)
  ) {
    return { track: 'features', pos: 0 };
  }
  if (
    [
      'buckskin',
      'cream',
      'yellow-base',
      'orange-base',
      'orange-tangerine',
      'red-base',
      'chocolate',
      'olive',
    ].includes(slug)
  ) {
    return { track: 'bases', pos: 0 };
  }
  if (
    [
      'phantom',
      'cappuccino',
      'super-cappuccino',
      'frappuccino',
      'sable',
      'super-sable',
      'luwak',
      'axanthic',
      'hypo',
      'albino',
      'pied',
      'moonglow',
      'lavender',
    ].includes(slug)
  ) {
    return { track: 'pigment', pos: 0 };
  }
  return null;
}
