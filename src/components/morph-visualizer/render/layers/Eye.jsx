/**
 * Eye ,  large round iris with a vertical slit pupil. Color driven by structural.
 * Eyes can't be blinked (no eyelids in crested geckos), so a strong eye-ring
 * gives the face its definition.
 */

import { EYE_CENTER, EYE_RADIUS, NOSTRIL, MOUTH_PATH } from '../svgShapes';

export default function Eye({ palette, suppressed }) {
  const eyeColor = palette.eye;
  const ring = suppressed?.warmPigment ? '#1d1d1d' : '#2a1c10';

  return (
    <g id="eye">
      {/* eye socket */}
      <circle cx={EYE_CENTER.cx} cy={EYE_CENTER.cy} r={EYE_RADIUS + 1.5} fill={ring} />
      {/* iris */}
      <circle cx={EYE_CENTER.cx} cy={EYE_CENTER.cy} r={EYE_RADIUS} fill={eyeColor} />
      {/* reticulation (radial streaks) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x1 = EYE_CENTER.cx + Math.cos(a) * 2;
        const y1 = EYE_CENTER.cy + Math.sin(a) * 2;
        const x2 = EYE_CENTER.cx + Math.cos(a) * (EYE_RADIUS - 1);
        const y2 = EYE_CENTER.cy + Math.sin(a) * (EYE_RADIUS - 1);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ring} strokeWidth="0.45" opacity="0.6" />
        );
      })}
      {/* vertical slit pupil */}
      <ellipse
        cx={EYE_CENTER.cx}
        cy={EYE_CENTER.cy}
        rx="1.3"
        ry={EYE_RADIUS - 2}
        fill="#0a0a0a"
      />
      {/* highlight */}
      <circle cx={EYE_CENTER.cx - 3} cy={EYE_CENTER.cy - 3} r="1.2" fill="#ffffff" opacity="0.9" />

      {/* nostril */}
      <circle cx={NOSTRIL.cx} cy={NOSTRIL.cy} r="1.3" fill={ring} />
      {/* mouth */}
      <path d={MOUTH_PATH} stroke={ring} strokeWidth="1.1" fill="none" opacity="0.8" />
    </g>
  );
}
