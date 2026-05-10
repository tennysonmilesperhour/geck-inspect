/**
 * Base body layer ,  the flat fill of the gecko silhouette.
 * Uses a vertical gradient to suggest a slightly darker dorsum shadow
 * against a lit belly, which reads as dimensional without being cartoony.
 */

import {
  BODY_PATH,
  HEAD_PATH,
  LEG_FRONT_NEAR_PATH,
  LEG_FRONT_FAR_PATH,
  LEG_BACK_NEAR_PATH,
  LEG_BACK_FAR_PATH,
  TAIL_PATH,
  toePads,
} from '../svgShapes';

export default function BaseBody({ palette, structural }) {
  const { shadow, base, highlight } = palette;
  const showTail = structural?.tail !== 'absent';

  return (
    <g id="base-body">
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={shadow} />
          <stop offset="55%"  stopColor={base} />
          <stop offset="100%" stopColor={highlight} />
        </linearGradient>
        <linearGradient id="legGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={base} />
          <stop offset="100%" stopColor={shadow} />
        </linearGradient>
      </defs>

      {/* far-side legs (lower z) */}
      <path d={LEG_BACK_FAR_PATH}  fill={shadow} opacity="0.75" />
      <path d={LEG_FRONT_FAR_PATH} fill={shadow} opacity="0.75" />

      {showTail && <path d={TAIL_PATH} fill="url(#bodyGrad)" />}
      <path d={BODY_PATH} fill="url(#bodyGrad)" />
      <path d={HEAD_PATH} fill="url(#bodyGrad)" />

      {/* near-side legs (higher z) */}
      <path d={LEG_BACK_NEAR_PATH}  fill="url(#legGrad)" />
      <path d={LEG_FRONT_NEAR_PATH} fill="url(#legGrad)" />

      {/* toe pads / lamellae ,  signature gecko feature */}
      <g fill={shadow} opacity="0.9">
        {toePads(597, 395, 5, 10, 3.4).map((p, i) => (
          <ellipse key={`tf-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.2} />
        ))}
        {toePads(205, 395, 5, 10, 3.4).map((p, i) => (
          <ellipse key={`tb-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.2} />
        ))}
        {toePads(620, 398, 3, 6, 2.4).map((p, i) => (
          <ellipse key={`tff-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.2} opacity="0.7" />
        ))}
        {toePads(236, 394, 3, 6, 2.4).map((p, i) => (
          <ellipse key={`tbf-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.2} opacity="0.7" />
        ))}
      </g>
    </g>
  );
}
