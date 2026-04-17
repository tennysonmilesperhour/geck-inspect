/**
 * Crest spikes — the signature supraorbital + dorsal ridge.
 * Renders small triangular scales along the back and above the eye.
 * Furred gives them longer, whisker-like extensions.
 */

import { crestSpikes, SUPRAORBITAL_PATH } from '../svgShapes';

export default function Crests({ palette, structural, suppressed }) {
  const spikes = crestSpikes();
  const size    = structural?.crest_size === 'heavy' ? 1.4 : structural?.crest_size === 'reduced' ? 0.6 : 1;
  const furred  = structural?.furred;
  const crowned = structural?.crowned;

  const spikeColor = suppressed?.warmPigment ? '#2a2a2a' : palette.shadow;

  return (
    <g id="crests">
      {/* Supraorbital — the "eyelash" ridge above the eye */}
      <path d={SUPRAORBITAL_PATH} fill={spikeColor} opacity="0.95" />

      {/* Dorsal ridge spikes */}
      {spikes.map((s, i) => {
        const h = s.h * size;
        const extra = furred ? h * 1.4 : 0;
        return (
          <g key={`c-${i}`}>
            <path
              d={`M ${s.x - 3.2},${s.y + 3} L ${s.x},${s.y - h} L ${s.x + 3.2},${s.y + 3} Z`}
              fill={spikeColor}
              opacity="0.9"
            />
            {extra > 0 && (
              <line
                x1={s.x}
                y1={s.y - h}
                x2={s.x + (i % 2 === 0 ? 1 : -1)}
                y2={s.y - h - extra}
                stroke={spikeColor}
                strokeWidth="0.6"
                opacity="0.55"
              />
            )}
          </g>
        );
      })}

      {/* Crowned — extra fan of spikes on the crown of the head */}
      {crowned && (
        <g opacity="0.95">
          {Array.from({ length: 7 }).map((_, i) => {
            const t = (i - 3) * 0.15;
            const x = 685 + Math.cos(-Math.PI / 2 + t) * 24;
            const y = 155 + Math.sin(-Math.PI / 2 + t) * 20;
            return (
              <path
                key={`crown-${i}`}
                d={`M ${x - 3},${y + 2} L ${x},${y - 10} L ${x + 3},${y + 2} Z`}
                fill={spikeColor}
              />
            );
          })}
        </g>
      )}
    </g>
  );
}
