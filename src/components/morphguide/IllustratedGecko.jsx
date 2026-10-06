import { memo } from 'react';
import TraitGecko from './TraitGecko';
import { ILLUSTRATED_GECKO_PRESETS } from './illustratedGeckoPresets';
import { paintedFrames, paintedPlateForPhenotype, plateUrl } from './paintedGeckoPlates';
export { hasIllustration } from './illustratedGeckoPresets';

/** Common patterns use registered ink studies with independent pigment layers. Specialist plates retain their earlier illustrations pending review. */
function IllustratedGecko({ morph, phenotype, track, position, size, className = '', title, decorative = false, focus = null, detail = false }) {
  const supported = ['patternless', 'flame', 'harlequin', 'extreme-harlequin', 'pinstripe', 'phantom-pinstripe', 'tiger', 'brindle', 'dalmatian', 'super-dalmatian'];
  const source = phenotype || ILLUSTRATED_GECKO_PRESETS[morph]?.phenotype;
  if (track || supported.includes(morph)) {
    const p = track === 'pinning' ? { pinstripe: Math.max(0, Math.min(1, position / 2)) } : track === 'coverage' ? { dorsal: position > 0 ? 1 : 0, lateral: Math.max(0, Math.min(1, (position - 1) / 2)) } : source || {};
    return <div style={size ? { width: size } : undefined} className={className}><TraitGecko view={track === 'pinning' ? 'top' : 'side'} traits={{ ...p, pinstripe: p.phantom ? 0 : p.pinstripe, spots: Math.min(1, (p.dalmatian || 0) / 150) }} title={title || `${ILLUSTRATED_GECKO_PRESETS[morph]?.label || 'Crested gecko'} ink and pencil study`} decorative={decorative} /></div>;
  }
  const slug = ILLUSTRATED_GECKO_PRESETS[morph] ? morph : paintedPlateForPhenotype(phenotype);
  const frames = track ? paintedFrames(track, position) : { lower: slug, upper: slug, blend: 0 };
  const label = title || `${ILLUSTRATED_GECKO_PRESETS[morph]?.label || 'Crested gecko'} natural-history illustration`;
  const eyeStudy = detail && focus === 'eyes';
  const transform = detail ? eyeStudy ? 'translate(34%, 7%) scale(2.2)' : 'scale(1.65)' : undefined;
  const transformOrigin = eyeStudy ? '15% 40%' : '35% 48%';
  return <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '3 / 2', background: '#f4efdf', ...(size ? { width: size, height: size * 2 / 3 } : {}) }} role={decorative ? undefined : 'img'} aria-hidden={decorative ? 'true' : undefined} aria-label={decorative ? undefined : label} data-painted-gecko={frames.lower} data-focus={focus || undefined}>
    <img src={plateUrl(frames.lower)} alt="" decoding="async" className="absolute inset-0 w-full h-full object-contain" style={{ transform, transformOrigin }} draggable={false} />
    {frames.upper !== frames.lower && <img src={plateUrl(frames.upper)} alt="" decoding="async" className="absolute inset-0 w-full h-full object-contain" style={{ opacity: frames.blend, transform, transformOrigin }} draggable={false} />}
  </div>;
}
export default memo(IllustratedGecko);
