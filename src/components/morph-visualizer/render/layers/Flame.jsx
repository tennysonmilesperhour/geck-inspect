/**
 * Flame — lighter lateral markings that shoot up the flanks like tongues of fire.
 * A subtler cousin of harlequin: lower coverage, more organic shapes.
 */

import { mulberry32, FLANKS_PATH } from '../svgShapes';

export default function Flame({ intensity, palette }) {
  if (!intensity) return null;

  const rand = mulberry32(3100 + intensity * 9);
  const count = [0, 5, 9, 14, 20][intensity];
  const flames = [];
  for (let i = 0; i < count; i += 1) {
    const cx = 100 + (i / count) * 540 + (rand() - 0.5) * 30;
    const topY = 215 + rand() * 20;
    const baseY = 290 - rand() * 8;
    const spread = 10 + rand() * 16;
    flames.push({ cx, topY, baseY, spread });
  }

  return (
    <g id="flame" opacity="0.85">
      <defs>
        <clipPath id="flame-clip">
          <path d={FLANKS_PATH} />
        </clipPath>
      </defs>
      <g clipPath="url(#flame-clip)">
        {flames.map((f, i) => {
          const d = `M ${f.cx - f.spread},${f.baseY}
                     Q ${f.cx - f.spread * 0.5},${(f.baseY + f.topY) / 2}
                       ${f.cx},${f.topY}
                     Q ${f.cx + f.spread * 0.5},${(f.baseY + f.topY) / 2}
                       ${f.cx + f.spread},${f.baseY} Z`;
          return <path key={`f-${i}`} d={d} fill={palette.pattern} opacity="0.9" />;
        })}
      </g>
    </g>
  );
}
