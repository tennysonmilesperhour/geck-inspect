/**
 * Belly layer ,  the lighter underside of the gecko. Receives the White Wall
 * band and, optionally, a white-fringe edging.
 */

import { BELLY_PATH } from '../svgShapes';

export default function Belly({ palette, expressed, accents }) {
  const bellyFill = expressed?.white_wall ? palette.belly : palette.belly;
  const opacity = expressed?.white_wall ? 0.95 : 0.55;
  return (
    <g id="belly-layer">
      <path d={BELLY_PATH} fill={bellyFill} opacity={opacity} />
      {accents?.white_fringe && (
        <path
          d={BELLY_PATH}
          fill="none"
          stroke="#f6f1e2"
          strokeWidth="5"
          strokeLinejoin="round"
          opacity="0.9"
        />
      )}
    </g>
  );
}
