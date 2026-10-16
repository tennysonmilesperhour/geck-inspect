/**
 * Which pattern studio lesson a Morph Guide page opens, or null when the
 * page has none. Kept apart from PatternSpectrum.jsx so a morph page can
 * tell whether to show the studio without downloading it.
 */
export function spectrumPositionFor(slug) {
  const coverage = ['flame', 'harlequin', 'extreme-harlequin'].indexOf(slug);
  if (coverage >= 0) return { track: 'coverage', pos: coverage + 1 };
  if (slug === 'pinstripe') return { track: 'pinning', pos: 2 };
  if (['tiger', 'brindle', 'dalmatian', 'super-dalmatian'].includes(slug)) return { track: 'features', pos: 0 };
  return null;
}
