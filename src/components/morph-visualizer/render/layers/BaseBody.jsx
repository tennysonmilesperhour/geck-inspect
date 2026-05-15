/**
 * Base body layer, the flat fill of the gecko silhouette.
 *
 * Draw order inside the layer:
 *   1. Far-side legs (lowest depth)
 *   2. Tail (if present)
 *   3. Body + head silhouette
 *   4. Near-side legs (highest depth)
 *   5. Toe pads on each foot
 *   6. A dark outline tracing the whole silhouette so the gecko reads as
 *      a clean illustrated character even on the darkest base colors
 */

import {
  BODY_PATH,
  HEAD_PATH,
  LEG_FRONT_NEAR_PATH,
  LEG_FRONT_FAR_PATH,
  LEG_BACK_NEAR_PATH,
  LEG_BACK_FAR_PATH,
  TAIL_PATH,
  FOOT_FRONT_NEAR,
  FOOT_FRONT_FAR,
  FOOT_BACK_NEAR,
  FOOT_BACK_FAR,
  toePads,
} from '../svgShapes';

export default function BaseBody({ palette, structural }) {
  const { shadow, base, highlight } = palette;
  const showTail = structural?.tail !== 'absent';
  const outline = '#1a120b';

  return (
    <g id="base-body">
      <defs>
        {/* userSpaceOnUse so head, body and tail share a single top-to-bottom
            shading ramp instead of each path stretching its own gradient
            across its bounding box (which made the head look "stuck on"). */}
        <linearGradient id="bodyGrad" x1="0" y1="170" x2="0" y2="345" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={shadow} />
          <stop offset="55%"  stopColor={base} />
          <stop offset="100%" stopColor={highlight} />
        </linearGradient>
        <linearGradient id="legGrad" x1="0" y1="270" x2="0" y2="415" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor={base} />
          <stop offset="100%" stopColor={shadow} />
        </linearGradient>
      </defs>

      {/* far-side legs sit behind everything */}
      <path d={LEG_BACK_FAR_PATH}  fill={shadow} opacity="0.78" />
      <path d={LEG_FRONT_FAR_PATH} fill={shadow} opacity="0.78" />
      <path d={LEG_BACK_FAR_PATH}  fill="none" stroke={outline} strokeWidth="1.5" opacity="0.4" />
      <path d={LEG_FRONT_FAR_PATH} fill="none" stroke={outline} strokeWidth="1.5" opacity="0.4" />

      {showTail && (
        <>
          <path d={TAIL_PATH} fill="url(#bodyGrad)" />
          <path d={TAIL_PATH} fill="none" stroke={outline} strokeWidth="1.8" opacity="0.55" />
        </>
      )}

      <path d={BODY_PATH} fill="url(#bodyGrad)" />
      <path d={HEAD_PATH} fill="url(#bodyGrad)" />

      {/* Body + head silhouette outline. Drawn BEFORE the near-side legs so
          the leg fills cover the body outline at the leg-attach overlap,
          instead of the body outline cutting a horizontal stripe across the
          near-side legs. */}
      <g fill="none" stroke={outline} strokeLinejoin="round" strokeLinecap="round">
        <path d={BODY_PATH} strokeWidth="2.2" opacity="0.85" />
        <path d={HEAD_PATH} strokeWidth="2.2" opacity="0.9" />
      </g>

      {/* near-side legs in front of body */}
      <path d={LEG_BACK_NEAR_PATH}  fill="url(#legGrad)" />
      <path d={LEG_FRONT_NEAR_PATH} fill="url(#legGrad)" />

      {/* Toe pads (lamellae). Five splayed toes on each near-side foot,
          three on partially hidden far-side feet so depth reads instantly.
          Each toe is drawn as a body-colored oval with a dark outline so the
          fingers stay readable against any base color or pattern. */}
      <g>
        {toePads(FOOT_FRONT_NEAR.cx, FOOT_FRONT_NEAR.cy, 5, 14, 4.4).map((p, i) => (
          <ellipse key={`tf-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.5}
            fill={base} stroke={outline} strokeWidth="1.4" opacity="0.95" />
        ))}
        {toePads(FOOT_BACK_NEAR.cx, FOOT_BACK_NEAR.cy, 5, 14, 4.4).map((p, i) => (
          <ellipse key={`tb-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.5}
            fill={base} stroke={outline} strokeWidth="1.4" opacity="0.95" />
        ))}
        {toePads(FOOT_FRONT_FAR.cx, FOOT_FRONT_FAR.cy, 3, 9, 3).map((p, i) => (
          <ellipse key={`tff-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.5}
            fill={shadow} stroke={outline} strokeWidth="1" opacity="0.75" />
        ))}
        {toePads(FOOT_BACK_FAR.cx, FOOT_BACK_FAR.cy, 3, 9, 3).map((p, i) => (
          <ellipse key={`tbf-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.5}
            fill={shadow} stroke={outline} strokeWidth="1" opacity="0.75" />
        ))}
      </g>

      {/* Near-side leg outlines on top of the leg fills (and on top of the
          body outline so the leg silhouette reads as one continuous shape
          against the body). */}
      <g fill="none" stroke={outline} strokeLinejoin="round" strokeLinecap="round">
        <path d={LEG_BACK_NEAR_PATH}  strokeWidth="1.8" opacity="0.75" />
        <path d={LEG_FRONT_NEAR_PATH} strokeWidth="1.8" opacity="0.75" />
      </g>
    </g>
  );
}
