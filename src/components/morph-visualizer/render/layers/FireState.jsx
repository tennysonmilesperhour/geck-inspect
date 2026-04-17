/**
 * Fire state overlay — simulates the difference between a fired-up
 * (dark, saturated) and fired-down (pale, milky) gecko.
 *
 * Most of the adjustment already happened in the palette, so this layer
 * just adds a subtle tint so fired-down animals read as "diurnal washed-out".
 */

import { BODY_PATH, HEAD_PATH } from '../svgShapes';

export default function FireState({ fireFactor }) {
  if (fireFactor == null) return null;
  if (fireFactor >= 0.7) return null; // no overlay needed on fired-up

  const opacity = (0.7 - fireFactor) * 0.6;

  return (
    <g id="fire-state" style={{ mixBlendMode: 'screen' }}>
      <path d={BODY_PATH} fill="#f4ece0" opacity={opacity} />
      <path d={HEAD_PATH} fill="#f4ece0" opacity={opacity} />
    </g>
  );
}
