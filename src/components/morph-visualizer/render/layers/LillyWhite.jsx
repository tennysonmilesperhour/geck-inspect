/**
 * Lilly White ,  bright white irregular body highlights with a clean break
 * along the dorsum. One of the signature proven morphs.
 */

import { mulberry32, BODY_PATH, HEAD_PATH } from '../svgShapes';

export default function LillyWhite({ expressed, isSuper }) {
  if (!expressed) return null;

  const rand = mulberry32(isSuper ? 8800 : 4200);
  const count = isSuper ? 32 : 18;
  const blotches = [];
  for (let i = 0; i < count; i += 1) {
    const x = 100 + rand() * 600;
    const y = 215 + rand() * 85;
    const w = 12 + rand() * 28;
    const h = 8 + rand() * 14;
    const r = (rand() - 0.5) * 60;
    blotches.push({ x, y, w, h, r });
  }

  const color = '#f7f4ea';

  return (
    <g id="lilly-white" opacity="0.92">
      <defs>
        <clipPath id="lw-clip">
          <path d={BODY_PATH} />
          <path d={HEAD_PATH} />
        </clipPath>
      </defs>
      <g clipPath="url(#lw-clip)">
        {blotches.map((b, i) => (
          <ellipse
            key={`lw-${i}`}
            cx={b.x}
            cy={b.y}
            rx={b.w}
            ry={b.h}
            fill={color}
            transform={`rotate(${b.r} ${b.x} ${b.y})`}
          />
        ))}
        {/* A larger signature splash on the mid-flank */}
        <ellipse cx={350} cy={265} rx={60} ry={22} fill={color} opacity="0.85" />
      </g>
    </g>
  );
}
