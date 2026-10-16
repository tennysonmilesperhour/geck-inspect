import { memo } from 'react';
import TraitGecko from './TraitGecko';
import { ILLUSTRATED_GECKO_PRESETS } from './illustratedGeckoPresets';

export const STUDY_MORPHS = Object.keys(ILLUSTRATED_GECKO_PRESETS);

export const hasIllustration = (slug) =>
  Boolean(slug && Object.prototype.hasOwnProperty.call(ILLUSTRATED_GECKO_PRESETS, slug));

export const fieldGuidePlate = (slug) => `/morph-guide/field-guide-v1/${slug}.webp`;

function IllustratedGecko({
  morph,
  phenotype,
  track,
  position = 0,
  size,
  className = '',
  title,
  decorative = false,
}) {
  if (!track && !phenotype && !hasIllustration(morph)) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-slate-900 p-6 text-center text-sm text-slate-400 ${className}`}
        style={{ aspectRatio: '3/2' }}
      >
        Use documented specimen photographs for this trait.
      </div>
    );
  }

  const label =
    title ||
    `${ILLUSTRATED_GECKO_PRESETS[morph]?.label || 'Crested gecko'} field-guide illustration`;

  if (!track && !phenotype && hasIllustration(morph)) {
    return (
      <div
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        data-morph-plate={morph}
        style={size ? { width: size, aspectRatio: '3/2' } : { aspectRatio: '3/2' }}
        className={`relative overflow-hidden rounded-lg bg-[#f4efdf] select-none ${className}`}
      >
        <img
          src={fieldGuidePlate(morph)}
          alt={decorative ? '' : label}
          width="1264"
          height="848"
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-contain"
        />
      </div>
    );
  }

  const source = phenotype || ILLUSTRATED_GECKO_PRESETS[morph]?.phenotype || {};
  const p =
    track === 'pinning'
      ? { pinstripe: position / 2 }
      : track === 'coverage'
      ? { dorsal: Math.min(1, position), lateral: Math.max(0, (position - 1) / 2) }
      : source;

  return (
    <div style={size ? { width: size } : undefined} className={className}>
      <TraitGecko
        view={track === 'pinning' || morph === 'pinstripe' ? 'top' : 'side'}
        traits={{ ...p, spots: p.spots ?? Math.min(1, (p.dalmatian || 0) / 150) }}
        title={label}
        decorative={decorative}
      />
    </div>
  );
}

export default memo(IllustratedGecko);
