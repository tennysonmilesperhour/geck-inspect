/**
 * Pinstripe ,  raised cream scales along the lateral edges of the dorsum.
 * In a 100% pinstripe the two rails are unbroken from the nape to the
 * tail base. Intensity controls coverage.
 */

import { mulberry32 } from '../svgShapes';

export default function Pinstripe({ intensity, palette, suppressed }) {
  if (!intensity || suppressed?.dorsal) return null;

  // Sample an unbroken rail path, then punch "breaks" into it at low intensity.
  const coverage = [0, 0.25, 0.5, 0.8, 1.0][intensity];
  const rand = mulberry32(9001 + intensity);

  // The upper rail runs along the dorsum top edge.
  // Use a curve with slight waver, then mask with dashes when coverage < 1.
  const railTop = 'M 130,198 C 230,186 330,180 430,180 C 530,180 600,184 660,188';
  const railBot = 'M 130,208 C 230,196 330,192 430,192 C 530,192 600,194 660,196';

  // Dashing: stroke-dasharray with random "on"/"off" segments
  const segLen = 14;
  const segs = [];
  for (let x = 130; x < 660; x += segLen) {
    const on = rand() < coverage;
    segs.push(on ? segLen : 0);
    segs.push(on ? 0 : segLen);
  }
  const dashTop = coverage >= 1 ? 'none' : segs.join(' ');
  const dashBot = coverage >= 1 ? 'none' : segs.slice(4).concat(segs.slice(0, 4)).join(' ');

  return (
    <g id="pinstripe" opacity="0.95">
      <path d={railTop} stroke={palette.pattern} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeDasharray={dashTop} />
      <path d={railBot} stroke={palette.pattern} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeDasharray={dashBot} />
    </g>
  );
}
