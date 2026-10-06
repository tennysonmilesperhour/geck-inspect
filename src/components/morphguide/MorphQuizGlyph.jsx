import { useId } from 'react';

/**
 * Hand-drawn top-down crested gecko used as the picture on every quiz
 * answer card. One drawing, switched by small props, so the answers read
 * as "the same gecko with one thing changed":
 *
 *   cream:  where the cream pattern sits ('back' | 'sides' | 'everywhere' | 'none')
 *   lines:  raised pinstripe rows ('full' | 'broken' | 'none')
 *   spots:  dark spots ('none' | 'some' | 'lots' | 'red')
 *   tone:   overall color ('normal' | 'pale' | 'gray')
 *   eyes:   'dark' | 'red'
 *   focus:  which part to ring with a soft glow ('back' | 'sides' | 'body' | 'eyes' | null)
 */

const TONES = {
  normal: { base: '#c2531c', dark: '#8a3412', cream: '#fcd9a0', line: '#fff1d6' },
  pale: { base: '#efe9df', dark: '#d6cfc3', cream: '#ffffff', line: '#ffffff' },
  gray: { base: '#7c8594', dark: '#4b5361', cream: '#e5e7eb', line: '#f3f4f6' },
};

const SOME_SPOTS = [[44, 50], [57, 62], [47, 72], [55, 44], [41, 64]];
const LOTS_SPOTS = [
  ...SOME_SPOTS,
  [50, 56], [44, 40], [58, 52], [52, 68], [45, 80], [56, 76], [49, 46], [42, 58],
  [59, 66], [47, 25], [54, 20], [27, 37], [73, 37], [26, 85], [74, 85],
];
const ROW_Y = [36, 41, 46, 51, 56, 61, 66, 71, 76];
const BROKEN_SKIP = new Set([2, 3, 6]);

export default function MorphQuizGlyph({
  cream = 'sides',
  lines = 'none',
  spots = 'none',
  tone = 'normal',
  eyes = 'dark',
  focus = null,
  className = '',
}) {
  const uid = useId().replace(/:/g, '');
  const t = TONES[tone] || TONES.normal;
  const bodyClip = `gq-body-${uid}`;
  const glow = `gq-glow-${uid}`;
  const legs = [
    'M39 42 L25 34 L19 38',
    'M61 42 L75 34 L81 38',
    'M39 74 L25 82 L21 92',
    'M61 74 L75 82 L79 92',
  ];
  const creamLegs = cream === 'sides' || cream === 'everywhere';
  const spotList = spots === 'lots' ? LOTS_SPOTS : spots === 'some' || spots === 'red' ? SOME_SPOTS : [];
  const spotColor = spots === 'red' ? '#ef4444' : '#1c1917';

  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={bodyClip}>
          <ellipse cx="50" cy="58" rx="15" ry="27" />
          <ellipse cx="50" cy="22" rx="13" ry="14" />
        </clipPath>
        <radialGradient id={glow}>
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {focus === 'back' && <ellipse cx="50" cy="58" rx="16" ry="34" fill={`url(#${glow})`} />}
      {focus === 'sides' && (
        <>
          <ellipse cx="25" cy="62" rx="16" ry="40" fill={`url(#${glow})`} />
          <ellipse cx="75" cy="62" rx="16" ry="40" fill={`url(#${glow})`} />
        </>
      )}
      {focus === 'body' && <ellipse cx="50" cy="60" rx="42" ry="56" fill={`url(#${glow})`} />}
      {focus === 'eyes' && <ellipse cx="50" cy="18" rx="22" ry="14" fill={`url(#${glow})`} />}

      {/* tail */}
      <path d="M45 80 Q46 100 52 113 Q55 117 55 111 Q53 98 55 80 Z" fill={t.dark} />

      {/* legs, drawn as thick round strokes with toe pads */}
      {legs.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={creamLegs ? t.cream : t.base}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {[[19, 38], [81, 38], [21, 92], [79, 92]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.4" fill={creamLegs ? t.cream : t.base} />
      ))}

      {/* head and body */}
      <ellipse cx="50" cy="22" rx="13" ry="14" fill={t.base} />
      <ellipse cx="50" cy="58" rx="15" ry="27" fill={t.base} />

      <g clipPath={`url(#${bodyClip})`}>
        {cream === 'back' && (
          <>
            <ellipse cx="50" cy="58" rx="6" ry="25" fill={t.cream} />
            <ellipse cx="50" cy="28" rx="4" ry="6" fill={t.cream} />
          </>
        )}
        {cream === 'sides' && (
          <>
            <rect x="33" y="40" width="7" height="40" rx="3" fill={t.cream} />
            <rect x="60" y="40" width="7" height="40" rx="3" fill={t.cream} />
            <ellipse cx="50" cy="58" rx="3.5" ry="22" fill={t.cream} opacity="0.85" />
          </>
        )}
        {cream === 'everywhere' && (
          <>
            <rect x="30" y="0" width="40" height="100" fill={t.cream} />
            <ellipse cx="44" cy="52" rx="3" ry="6" fill={t.base} />
            <ellipse cx="57" cy="66" rx="3" ry="5" fill={t.base} />
            <ellipse cx="50" cy="20" rx="4" ry="3" fill={t.base} />
          </>
        )}
        {spotList.map(([x, y]) =>
          y > 30 && y < 86 ? (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={spots === 'lots' ? 1.5 : 1.9} fill={spotColor} />
          ) : null,
        )}
        {spotList.map(([x, y]) =>
          y <= 30 ? <circle key={`h${x}-${y}`} cx={x} cy={y} r="1.4" fill={spotColor} /> : null,
        )}
      </g>
      {/* spots that land on the legs */}
      {spotList.map(([x, y]) =>
        x < 30 || x > 70 ? <circle key={`l${x}-${y}`} cx={x} cy={y} r="1.5" fill={spotColor} /> : null,
      )}

      {/* raised pinstripe rows */}
      {lines !== 'none' &&
        [43.5, 56.5].map((x) =>
          ROW_Y.map((y, i) =>
            lines === 'broken' && BROKEN_SKIP.has(i) ? null : (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.1" fill={t.line} stroke={t.dark} strokeWidth="0.6" />
            ),
          ),
        )}

      {/* crests over the eyes */}
      <path d="M36 14 l2 -4 l2 3 l2 -4 l2 4" fill="none" stroke={t.dark} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M54 13 l2 -4 l2 3 l2 -4 l2 4" fill="none" stroke={t.dark} strokeWidth="1.2" strokeLinejoin="round" />

      {/* eyes */}
      {[40, 60].map((x) => (
        <g key={x}>
          <circle cx={x} cy="19" r="4.2" fill={eyes === 'red' ? '#f43f5e' : '#1c1917'} />
          <circle cx={x - 1.2} cy="17.6" r="1.1" fill="#ffffff" opacity="0.8" />
        </g>
      ))}
    </svg>
  );
}

/** The drawing for each quiz answer, keyed by step id then option id. */
export const QUIZ_GLYPHS = {
  pattern: {
    back: { cream: 'back', focus: 'back' },
    sides: { cream: 'sides', focus: 'sides' },
    everywhere: { cream: 'everywhere', focus: 'body' },
    none: { cream: 'none' },
  },
  lines: {
    full: { cream: 'none', lines: 'full', focus: 'back' },
    broken: { cream: 'none', lines: 'broken', focus: 'back' },
    no: { cream: 'none' },
  },
  spots: {
    none: { cream: 'none' },
    some: { cream: 'none', spots: 'some' },
    lots: { cream: 'none', spots: 'lots' },
    red: { cream: 'none', spots: 'red' },
  },
  unusual: {
    'red-eyes': { cream: 'sides', eyes: 'red', focus: 'eyes' },
    pale: { cream: 'everywhere', tone: 'pale' },
    gray: { cream: 'sides', tone: 'gray' },
    none: { cream: 'sides' },
  },
};
