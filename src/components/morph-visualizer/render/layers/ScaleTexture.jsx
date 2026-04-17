/**
 * A subtle stippled scale texture over the body — gives the flat fills a
 * reptilian micro-detail without committing to a photorealistic render.
 * Soft Scale reduces the effect to a near-smooth surface.
 */

import { mulberry32, BODY_PATH, HEAD_PATH } from '../svgShapes';

export default function ScaleTexture({ softScale, palette }) {
  const rand = mulberry32(12321);
  const opacity = softScale ? 0.08 : 0.18;
  const count = softScale ? 220 : 520;

  return (
    <g id="scale-texture" opacity={opacity}>
      <defs>
        <clipPath id="scale-clip">
          <path d={BODY_PATH} />
          <path d={HEAD_PATH} />
        </clipPath>
      </defs>
      <g clipPath="url(#scale-clip)">
        {Array.from({ length: count }).map((_, i) => {
          const x = 75 + rand() * 650;
          const y = 170 + rand() * 145;
          const r = 0.6 + rand() * 1.1;
          return <circle key={i} cx={x} cy={y} r={r} fill={palette.shadow} />;
        })}
      </g>
    </g>
  );
}
