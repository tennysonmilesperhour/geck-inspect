/**
 * Dalmatian spots — scatter of dark ink spots across the body.
 * Spot density scales with intensity; "super dalmatian" fully blankets the animal.
 */

import { mulberry32, BODY_PATH, HEAD_PATH } from '../svgShapes';

export default function Dalmatian({ intensity, suppressed }) {
  if (!intensity) return null;

  const rand = mulberry32(5201 + intensity * 13);
  const count = [0, 14, 28, 54, 110][intensity];
  const spots = [];
  for (let i = 0; i < count; i += 1) {
    const x = 75 + rand() * 640;
    const y = 175 + rand() * 130;
    const r = 2 + rand() * (intensity >= 3 ? 6 : 4);
    const flattenY = 0.55 + rand() * 0.35;
    spots.push({ x, y, r, flattenY });
  }

  return (
    <g id="dalmatian" opacity="0.92">
      <defs>
        <clipPath id="dalmatian-clip">
          <path d={BODY_PATH} />
          <path d={HEAD_PATH} />
        </clipPath>
      </defs>
      <g clipPath="url(#dalmatian-clip)">
        {spots.map((s, i) => (
          <ellipse
            key={`d-${i}`}
            cx={s.x}
            cy={s.y}
            rx={s.r}
            ry={s.r * s.flattenY}
            fill={suppressed?.warmPigment ? '#1c1c1c' : '#241813'}
          />
        ))}
      </g>
    </g>
  );
}
