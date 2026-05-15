/**
 * Secondary / accent traits ,  portholes, kneecaps, drippy dorsal, crest tips.
 * Small cosmetic overlays on top of the main pattern stack.
 */

import { mulberry32, FLANKS_PATH, crestSpikes } from '../svgShapes';

export default function Accents({ accents, palette }) {
  if (!accents) return null;

  const rand = mulberry32(1212);

  return (
    <g id="accents">
      <defs>
        <clipPath id="flank-clip-accents">
          <path d={FLANKS_PATH} />
        </clipPath>
      </defs>

      {/* Portholes ,  round white circles along the lateral body */}
      {accents.portholes && (
        <g clipPath="url(#flank-clip-accents)">
          {Array.from({ length: 6 }).map((_, i) => {
            const x = 160 + i * 80 + (rand() - 0.5) * 20;
            const y = 265 + (rand() - 0.5) * 14;
            return (
              <g key={`ph-${i}`}>
                <circle cx={x} cy={y} r="10" fill="#f3ede0" />
                <circle cx={x} cy={y} r="10" fill="none" stroke={palette.shadow} strokeWidth="1.5" opacity="0.4" />
              </g>
            );
          })}
        </g>
      )}

      {/* Kneecaps ,  white patches on the knees. Positions track the elbow /
          knee bend on each near-side leg, with smaller fainter spots on the
          far-side legs so the marking reads on both sides without crowding. */}
      {accents.kneecaps && (
        <g>
          <ellipse cx={504} cy={354} rx="9" ry="7" fill="#f3ede0" />
          <ellipse cx={184} cy={354} rx="9" ry="7" fill="#f3ede0" />
          <ellipse cx={572} cy={350} rx="6" ry="4.5" fill="#f3ede0" opacity="0.75" />
          <ellipse cx={252} cy={350} rx="6" ry="4.5" fill="#f3ede0" opacity="0.75" />
        </g>
      )}

      {/* Drippy dorsal ,  dripping pattern from the dorsal line down the flanks */}
      {accents.drippy_dorsal && (
        <g opacity="0.85">
          {Array.from({ length: 9 }).map((_, i) => {
            const x = 150 + i * 60 + (rand() - 0.5) * 20;
            const h = 18 + rand() * 20;
            const d = `M ${x},205 Q ${x - 5},${215 + h / 2} ${x + 2},${215 + h} Q ${x + 7},${215 + h / 2} ${x + 4},205 Z`;
            return <path key={`dd-${i}`} d={d} fill={palette.pattern} />;
          })}
        </g>
      )}

      {/* White-tipped crests ,  tiny light dots at each crest-spike tip */}
      {accents.white_tipped_crests && (
        <g>
          {crestSpikes().map((s, i) => (
            <circle key={`ct-${i}`} cx={s.x} cy={s.y - s.h + 2} r="1.6" fill="#f6f1e0" />
          ))}
        </g>
      )}
    </g>
  );
}
