/**
 * Tiger ,  vertical dark bands across the ribs.
 * Brindle is the same layer with broken/feathered bands.
 */

import { FLANKS_PATH, mulberry32 } from '../svgShapes';

export default function Tiger({ intensity, brindleIntensity, palette }) {
  const tigerLevel   = intensity || 0;
  const brindleLevel = brindleIntensity || 0;
  if (!tigerLevel && !brindleLevel) return null;

  const rand = mulberry32(7321 + tigerLevel * 11 + brindleLevel * 31);
  const barCount = 6 + Math.max(tigerLevel, brindleLevel) * 2;
  const bars = [];
  for (let i = 0; i < barCount; i += 1) {
    const t = i / (barCount - 1);
    const x = 100 + t * 540;
    const jitter = (rand() - 0.5) * 14;
    const width = 8 + rand() * (tigerLevel >= 3 ? 10 : 5);
    const heightY = 235 + rand() * 8;
    bars.push({ x: x + jitter, width, heightY, shatter: brindleLevel > tigerLevel });
  }

  const bandColor = '#2a1b11';

  return (
    <g id="tiger" opacity={0.55 + 0.1 * Math.max(tigerLevel, brindleLevel)}>
      <defs>
        <clipPath id="tiger-clip">
          <path d={FLANKS_PATH} />
        </clipPath>
      </defs>
      <g clipPath="url(#tiger-clip)">
        {bars.map((b, i) => (
          b.shatter ? (
            // Brindle: render bar as several disjoint vertical rectangles
            <g key={`t-${i}`}>
              {Array.from({ length: 4 }).map((_, j) => (
                <rect
                  key={j}
                  x={b.x}
                  y={200 + j * 15 + rand() * 4}
                  width={b.width * 0.9}
                  height={6 + rand() * 6}
                  fill={bandColor}
                />
              ))}
            </g>
          ) : (
            <rect
              key={`t-${i}`}
              x={b.x}
              y={198}
              width={b.width}
              height={105}
              fill={bandColor}
            />
          )
        ))}
      </g>
    </g>
  );
}
