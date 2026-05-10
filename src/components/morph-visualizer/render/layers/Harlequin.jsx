/**
 * Harlequin pattern ,  lateral cream markings rising up the flanks.
 * Intensity ladder (0 → 4):
 *   0 = off
 *   1 = trace (a few small blotches low on the flanks)
 *   2 = partial (covers lower flanks)
 *   3 = strong (covers flanks, touches dorsum edge)
 *   4 = extreme (continuous pattern climbs onto the dorsum itself)
 */

import { mulberry32, FLANKS_PATH, DORSUM_PATH } from '../svgShapes';

function harlequinBlobs(count, seed, heightCap, spreadY) {
  const rand = mulberry32(seed);
  const blobs = [];
  for (let i = 0; i < count; i += 1) {
    const x = 90 + rand() * 590;
    const y = spreadY + rand() * heightCap;
    const w = 20 + rand() * 48;
    const h = 14 + rand() * 26;
    const skew = (rand() - 0.5) * 20;
    blobs.push({ x, y, w, h, skew });
  }
  return blobs;
}

export default function Harlequin({ intensity, palette, suppressed }) {
  if (!intensity || suppressed?.lateral) return null;

  const count = [0, 6, 12, 20, 32][intensity] || 0;
  const heightCap = [0, 18, 28, 38, 50][intensity] || 0;
  const spreadY = 255 - (intensity >= 3 ? 30 : 0);

  const blobs = harlequinBlobs(count, 1337 + intensity * 7, heightCap, spreadY);
  const fill = palette.pattern;

  return (
    <g id="harlequin" opacity="0.9">
      <defs>
        <clipPath id="harlequin-clip-lateral">
          <path d={FLANKS_PATH} />
        </clipPath>
        <clipPath id="harlequin-clip-dorsal">
          <path d={DORSUM_PATH} />
        </clipPath>
      </defs>

      <g clipPath="url(#harlequin-clip-lateral)">
        {blobs.map((b, i) => (
          <ellipse
            key={`h-${i}`}
            cx={b.x}
            cy={b.y}
            rx={b.w}
            ry={b.h}
            fill={fill}
            transform={`rotate(${b.skew} ${b.x} ${b.y})`}
          />
        ))}
      </g>

      {intensity >= 4 && (
        <g clipPath="url(#harlequin-clip-dorsal)" opacity="0.85">
          {harlequinBlobs(14, 4211, 18, 198).map((b, i) => (
            <ellipse
              key={`hd-${i}`}
              cx={b.x}
              cy={b.y}
              rx={b.w * 0.7}
              ry={b.h * 0.6}
              fill={fill}
              transform={`rotate(${b.skew} ${b.x} ${b.y})`}
            />
          ))}
        </g>
      )}
    </g>
  );
}
