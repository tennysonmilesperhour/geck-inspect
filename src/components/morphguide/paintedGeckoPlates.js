import { ILLUSTRATED_GECKO_PRESETS } from './illustratedGeckoPresets';

export const PAINTED_GECKO_ROOT = '/morph-guide/painted-plates-v1';
export const COVERAGE_PLATES = ['patternless', 'flame', 'harlequin', 'extreme-harlequin'];
export const PINNING_PLATES = ['patternless', 'partial-pinstripe', 'pinstripe'];
export const PAINTED_PLATE_SLUGS = [...Object.keys(ILLUSTRATED_GECKO_PRESETS), 'partial-pinstripe', 'red-spotted'];
export const plateUrl = slug => `${PAINTED_GECKO_ROOT}/${slug}.webp`;

/** Two registered paintings, with a continuous dissolve between adjacent stops. */
export function paintedFrames(track, position) {
  const plates = track === 'pinning' ? PINNING_PLATES : COVERAGE_PLATES;
  const value = Math.max(0, Math.min(plates.length - 1, Number(position) || 0));
  const lower = Math.floor(value);
  return { lower: plates[lower], upper: plates[Math.min(lower + 1, plates.length - 1)], blend: value - lower };
}

/** Legacy phenotype callers select the corresponding finished study, never synthetic pigment. */
export function paintedPlateForPhenotype(p = {}) {
  if (p.albino) return 'albino';
  if (p.palette?.base === '#787a74') return 'axanthic';
  if (p.palette?.base === '#e6dfce') return 'hypo';
  if (p.lillyWhite > .5) return 'lilly-white';
  if (p.dalmatian > 0) return p.redSpots > .5 ? 'red-spotted' : p.dalmatian > 60 ? 'super-dalmatian' : 'dalmatian';
  if (p.pinstripe > 0) return p.phantom ? 'phantom-pinstripe' : p.pinstripe < .8 ? 'partial-pinstripe' : 'pinstripe';
  if (p.tricolor > .5) return 'tricolor';
  if (p.tiger > .5) return p.brindle ? 'brindle' : 'tiger';
  if (p.lateral > .8) return 'extreme-harlequin';
  if (p.lateral > .2) return 'harlequin';
  return p.dorsal > .3 ? 'flame' : 'patternless';
}
