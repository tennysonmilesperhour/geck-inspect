import { memo } from 'react';
import TraitGecko from './TraitGecko';
import { ILLUSTRATED_GECKO_PRESETS } from './illustratedGeckoPresets';

// Only visible features supported by the registered study are illustrated.
// Specialist genotypes must not be invented by recoloring a generic animal.
export const STUDY_MORPHS = ['patternless','flame','harlequin','extreme-harlequin','pinstripe','tiger','dalmatian','super-dalmatian'];
export const hasIllustration = slug => STUDY_MORPHS.includes(slug);
function IllustratedGecko({ morph, phenotype, track, position = 0, size, className = '', title, decorative = false }) {
  if (!track && !phenotype && !hasIllustration(morph)) return <div className={`flex items-center justify-center rounded-xl bg-slate-900 p-6 text-center text-sm text-slate-400 ${className}`} style={{ aspectRatio:'3/2' }}>Use documented specimen photographs for this trait.</div>;
  const source = phenotype || ILLUSTRATED_GECKO_PRESETS[morph]?.phenotype || {};
  const p = track === 'pinning' ? { pinstripe: position/2 } : track === 'coverage' ? { dorsal: Math.min(1,position), lateral: Math.max(0,(position-1)/2) } : source;
  return <div style={size ? { width:size } : undefined} className={className}><TraitGecko view={track === 'pinning' || morph === 'pinstripe' ? 'top' : 'side'} traits={{ ...p, spots: p.spots ?? Math.min(1,(p.dalmatian||0)/150) }} title={title || `${ILLUSTRATED_GECKO_PRESETS[morph]?.label || 'Crested gecko'} visible-feature illustration`} decorative={decorative} /></div>;
}
export default memo(IllustratedGecko);
