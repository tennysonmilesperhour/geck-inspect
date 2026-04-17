/**
 * Top-down (aerial) view of the gecko.
 *
 * Intentionally kept as a single file with inline pattern layers — the view
 * is younger than the side view and we'd rather iterate fast than over-split.
 * When this view matures, split it into per-layer components like the side view.
 */

import {
  VIEWBOX_TOP,
  BODY_TOP_PATH,
  HEAD_TOP_PATH,
  TAIL_TOP_PATH,
  DORSUM_TOP_PATH,
  SPINE_TOP_PATH,
  CREST_TOP_RAIL_UPPER,
  CREST_TOP_RAIL_LOWER,
  SUPRAORBITAL_TOP_UPPER,
  SUPRAORBITAL_TOP_LOWER,
  EYES_TOP,
  NOSTRILS_TOP,
  LEG_TOP_FRONT_UP,
  LEG_TOP_FRONT_DOWN,
  LEG_TOP_BACK_UP,
  LEG_TOP_BACK_DOWN,
  LEG_TOE_POSITIONS,
  topToePads,
  BRANCH_TOP_PATH,
} from './svgShapesTop';
import { mulberry32 } from './svgShapes';
import { ZYGOSITY as Z } from '../data/traits';

const BODY_TOP_CLIP = 'gecko-body-top-clip';

export default function GeckoCanvasTop({ phenotype, selections }) {
  const { palette, structural, accents, patternIntensity, expressed, suppressed, fireFactor } = phenotype;
  const mend = selections.mendelian || {};
  const lwSuper   = mend.lilly_white === Z.SUPER;
  const cappSuper = mend.cappuccino  === Z.SUPER;
  const showTail  = structural?.tail !== 'absent';

  return (
    <svg
      viewBox={VIEWBOX_TOP}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      role="img"
      aria-label="Top view of crested gecko morph preview"
    >
      <defs>
        <radialGradient id="bg-grad-top" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="#1e2e1e" />
          <stop offset="100%" stopColor="#0d170d" />
        </radialGradient>
        <linearGradient id="body-top-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={palette.shadow} />
          <stop offset="50%"  stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.shadow} />
        </linearGradient>
        <linearGradient id="branch-top-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3e2f1c" />
          <stop offset="50%" stopColor="#553e22" />
          <stop offset="100%" stopColor="#281c10" />
        </linearGradient>
        <clipPath id={BODY_TOP_CLIP}>
          <path d={BODY_TOP_PATH} />
          <path d={HEAD_TOP_PATH} />
        </clipPath>
      </defs>

      <rect width="800" height="480" fill="url(#bg-grad-top)" />

      {/* Branch under the gecko */}
      <path d={BRANCH_TOP_PATH} fill="url(#branch-top-grad)" />
      <path d={BRANCH_TOP_PATH} fill="none" stroke="#1c1206" strokeWidth="1" opacity="0.5" />

      {/* Soft shadow directly under the gecko */}
      <ellipse cx="400" cy="360" rx="260" ry="14" fill="#000" opacity="0.35" />

      {/* --- gecko silhouette --- */}
      {showTail && <path d={TAIL_TOP_PATH} fill={palette.shadow} />}
      {showTail && <path d={TAIL_TOP_PATH} fill="url(#body-top-grad)" opacity="0.85" />}

      {/* Legs (under body so toes fan out) */}
      <g opacity="0.95">
        <path d={LEG_TOP_FRONT_UP}   fill="url(#body-top-grad)" />
        <path d={LEG_TOP_FRONT_DOWN} fill="url(#body-top-grad)" />
        <path d={LEG_TOP_BACK_UP}    fill="url(#body-top-grad)" />
        <path d={LEG_TOP_BACK_DOWN}  fill="url(#body-top-grad)" />
      </g>

      {/* Toe pads */}
      <g fill={palette.shadow} opacity="0.9">
        {LEG_TOE_POSITIONS.map((pos, idx) => {
          const axisDown = pos.cy > 240;
          return topToePads(pos.cx, pos.cy, pos.count, pos.spread, 3, axisDown).map((p, i) => (
            <ellipse key={`leg-${idx}-toe-${i}`} cx={p.cx} cy={p.cy} rx={p.r} ry={p.r * 1.2} />
          ));
        })}
      </g>

      {/* Main body */}
      <path d={BODY_TOP_PATH} fill="url(#body-top-grad)" />
      <path d={HEAD_TOP_PATH} fill="url(#body-top-grad)" />

      {/* Dorsum tint */}
      <g clipPath={`url(#${BODY_TOP_CLIP})`}>
        <path d={DORSUM_TOP_PATH} fill={palette.dorsum} opacity={expressed.cappuccino ? 0.95 : 0.4} />

        {/* --- Pinstripe rails --- */}
        {!suppressed.dorsal && (patternIntensity.pinstripe || 0) > 0 && (
          <PinstripeTop intensity={patternIntensity.pinstripe} palette={palette} />
        )}

        {/* --- Harlequin blobs on flanks --- */}
        {!suppressed.lateral && (patternIntensity.harlequin || 0) > 0 && (
          <HarlequinTop intensity={patternIntensity.harlequin} palette={palette} />
        )}

        {/* --- Flame lateral marks --- */}
        {(patternIntensity.flame || 0) > 0 && (
          <FlameTop intensity={patternIntensity.flame} palette={palette} />
        )}

        {/* --- Tiger banding across the dorsum --- */}
        {(patternIntensity.tiger || 0) > 0 && (
          <TigerTop intensity={patternIntensity.tiger} />
        )}

        {/* --- Dalmatian spots --- */}
        {(patternIntensity.dalmatian || 0) > 0 && (
          <DalmatianTop intensity={patternIntensity.dalmatian} />
        )}

        {/* --- Cappuccino dorsum repaint --- */}
        {expressed.cappuccino && (
          <CappuccinoTop isSuper={cappSuper} palette={palette} />
        )}

        {/* --- Lilly White splashes --- */}
        {expressed.lilly_white && (
          <LillyWhiteTop isSuper={lwSuper} />
        )}

        {/* --- Axanthic makes the whole dorsum greyscale --- */}
        {suppressed.warmPigment && (
          <path d={BODY_TOP_PATH} fill="#9a9a9a" opacity="0.2" />
        )}
      </g>

      {/* --- Crest rails (on top of patterns) --- */}
      <g fill="none" stroke={suppressed.warmPigment ? '#3a3a3a' : palette.shadow} strokeWidth="2.2" opacity="0.85">
        <path d={CREST_TOP_RAIL_UPPER} />
        <path d={CREST_TOP_RAIL_LOWER} />
      </g>

      {/* --- Crest spikes along each rail (little hashes) --- */}
      <CrestSpikesTop structural={structural} suppressed={suppressed} palette={palette} />

      {/* --- Supraorbital (eyelash) --- */}
      <g fill="none" stroke={suppressed.warmPigment ? '#2a2a2a' : palette.shadow} strokeWidth="3" strokeLinecap="round">
        <path d={SUPRAORBITAL_TOP_UPPER} />
        <path d={SUPRAORBITAL_TOP_LOWER} />
      </g>

      {/* --- Eyes --- */}
      {EYES_TOP.map((e, i) => (
        <g key={i}>
          <circle cx={e.cx} cy={e.cy} r={e.r + 1.5} fill={suppressed.warmPigment ? '#1d1d1d' : '#2a1c10'} />
          <circle cx={e.cx} cy={e.cy} r={e.r} fill={palette.eye} />
          <ellipse cx={e.cx} cy={e.cy} rx="1.2" ry={e.r - 2} fill="#0a0a0a" />
          <circle cx={e.cx - 2} cy={e.cy - 2} r="1.1" fill="#ffffff" opacity="0.9" />
        </g>
      ))}

      {/* --- Nostrils --- */}
      {NOSTRILS_TOP.map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r="1.3" fill="#2a1c10" opacity="0.85" />
      ))}

      {/* --- Fire state overlay (fired-down = washed out) --- */}
      {fireFactor < 0.4 && (
        <g style={{ mixBlendMode: 'screen' }} opacity={(0.4 - fireFactor) * 0.9}>
          <path d={BODY_TOP_PATH} fill="#f4ece0" />
          <path d={HEAD_TOP_PATH} fill="#f4ece0" />
        </g>
      )}
    </svg>
  );
}

// ----- Inline pattern sub-components -----

function PinstripeTop({ intensity, palette }) {
  // Rails run along the dorso-lateral edges (ish) — two strong lines.
  const coverage = [0, 0.25, 0.5, 0.8, 1.0][intensity];
  const rand = mulberry32(9901 + intensity);
  const seg = 16;
  const dashes = [];
  for (let x = 170; x < 650; x += seg) {
    const on = rand() < coverage;
    dashes.push(on ? seg : 0);
    dashes.push(on ? 0 : seg);
  }
  const dash = coverage >= 1 ? 'none' : dashes.join(' ');
  return (
    <g opacity="0.95">
      <path
        d="M 170,220 C 280,206 420,204 550,210 C 605,212 640,220 660,230"
        stroke={palette.pattern}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
      <path
        d="M 170,300 C 280,314 420,316 550,312 C 605,310 640,302 660,290"
        stroke={palette.pattern}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </g>
  );
}

function HarlequinTop({ intensity, palette }) {
  const count = [0, 10, 18, 30, 48][intensity];
  const rand = mulberry32(2001 + intensity * 11);
  const blobs = Array.from({ length: count }).map(() => {
    // Blobs scatter along the two flanks (top/bottom edges of body in top view)
    const onTop = rand() > 0.5;
    const x = 170 + rand() * 470;
    const y = onTop ? 200 + rand() * 26 : 304 - rand() * 26;
    const rx = 14 + rand() * 28;
    const ry = 8 + rand() * 14;
    const rot = (rand() - 0.5) * 40;
    return { x, y, rx, ry, rot };
  });
  return (
    <g opacity="0.9">
      {blobs.map((b, i) => (
        <ellipse
          key={i}
          cx={b.x}
          cy={b.y}
          rx={b.rx}
          ry={b.ry}
          fill={palette.pattern}
          transform={`rotate(${b.rot} ${b.x} ${b.y})`}
        />
      ))}
    </g>
  );
}

function FlameTop({ intensity, palette }) {
  const count = [0, 6, 10, 16, 22][intensity];
  const rand = mulberry32(3100 + intensity * 9);
  const marks = Array.from({ length: count }).map(() => {
    const onTop = rand() > 0.5;
    const x = 180 + rand() * 460;
    const yStart = onTop ? 190 : 320;
    const yEnd = onTop ? 230 : 282;
    const w = 12 + rand() * 14;
    return { x, yStart, yEnd, w };
  });
  return (
    <g opacity="0.85">
      {marks.map((m, i) => {
        const d = `M ${m.x - m.w},${m.yStart}
                   Q ${m.x - m.w * 0.4},${(m.yStart + m.yEnd) / 2}
                     ${m.x},${m.yEnd}
                   Q ${m.x + m.w * 0.4},${(m.yStart + m.yEnd) / 2}
                     ${m.x + m.w},${m.yStart} Z`;
        return <path key={i} d={d} fill={palette.pattern} opacity="0.85" />;
      })}
    </g>
  );
}

function TigerTop({ intensity }) {
  const bars = 8 + intensity * 2;
  const rand = mulberry32(7801 + intensity);
  return (
    <g opacity={0.6 + 0.08 * intensity}>
      {Array.from({ length: bars }).map((_, i) => {
        const t = i / (bars - 1);
        const x = 160 + t * 490;
        const w = 8 + rand() * 10;
        return (
          <rect
            key={i}
            x={x + (rand() - 0.5) * 8}
            y={210}
            width={w}
            height={95}
            fill="#2a1b11"
          />
        );
      })}
    </g>
  );
}

function DalmatianTop({ intensity }) {
  const count = [0, 16, 36, 72, 140][intensity];
  const rand = mulberry32(5500 + intensity * 7);
  return (
    <g opacity="0.92">
      {Array.from({ length: count }).map((_, i) => {
        const x = 150 + rand() * 520;
        const y = 195 + rand() * 130;
        const r = 2 + rand() * (intensity >= 3 ? 6 : 4);
        return <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.85} fill="#231713" />;
      })}
    </g>
  );
}

function CappuccinoTop({ isSuper, palette }) {
  const stain = isSuper
    ? 'M 150,230 C 250,210 400,206 550,212 C 620,216 660,230 670,260 C 660,290 620,304 550,308 C 400,314 250,310 150,290 Z'
    : 'M 170,230 C 260,216 400,212 530,218 C 590,222 625,234 640,258 C 625,282 590,294 530,298 C 400,304 260,300 170,286 Z';
  return <path d={stain} fill={palette.dorsum} opacity="0.96" />;
}

function LillyWhiteTop({ isSuper }) {
  const count = isSuper ? 32 : 18;
  const rand = mulberry32(isSuper ? 8801 : 4201);
  return (
    <g opacity="0.93">
      {Array.from({ length: count }).map((_, i) => {
        const x = 150 + rand() * 520;
        const y = 200 + rand() * 120;
        const rx = 10 + rand() * 22;
        const ry = 7 + rand() * 14;
        const rot = (rand() - 0.5) * 60;
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={rx}
            ry={ry}
            fill="#f7f4ea"
            transform={`rotate(${rot} ${x} ${y})`}
          />
        );
      })}
    </g>
  );
}

function CrestSpikesTop({ structural, suppressed, palette }) {
  const size = structural?.crest_size === 'heavy' ? 1.4 : structural?.crest_size === 'reduced' ? 0.6 : 1;
  const color = suppressed?.warmPigment ? '#2a2a2a' : palette.shadow;
  const hashes = [];
  for (let i = 0; i < 40; i += 1) {
    const t = i / 39;
    const x = 180 + t * 475;
    const yTop = 216 + Math.sin(t * Math.PI) * -4;
    const yBot = 304 - Math.sin(t * Math.PI) * -4;
    hashes.push({ x, yTop, yBot });
  }
  return (
    <g opacity="0.85">
      {hashes.map((h, i) => (
        <g key={i}>
          <line x1={h.x} y1={h.yTop - 6 * size} x2={h.x} y2={h.yTop + 1} stroke={color} strokeWidth="1.5" />
          <line x1={h.x} y1={h.yBot - 1} x2={h.x} y2={h.yBot + 6 * size} stroke={color} strokeWidth="1.5" />
        </g>
      ))}
    </g>
  );
}
