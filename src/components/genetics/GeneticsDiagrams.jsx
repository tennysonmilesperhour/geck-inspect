
/**
 * Inline SVG diagrams for the Crested Gecko Genetics Guide.
 *
 * Every diagram here is hand-authored SVG so there's zero risk of
 * broken external image URLs, licensing ambiguity, or render delay.
 * The visual style matches the app:
 *   - Emerald / purple gradient accents
 *   - Dark slate fills
 *   - Consistent font sizing via `fontFamily="inherit"`
 *   - All labels use currentColor so they pick up the surrounding
 *     Tailwind text color
 *
 * Each component is small, responsive (uses viewBox), and gets a
 * short caption below so the reader always knows what they're
 * looking at.
 */

// ---- Shared primitives ------------------------------------------------------

function DiagramFrame({ caption, children, ariaLabel }) {
  return (
    <figure className="my-4">
      <div
        className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 flex items-center justify-center"
        role="img"
        aria-label={ariaLabel}
      >
        {children}
      </div>
      {caption && (
        <figcaption className="mt-2 text-[11px] text-slate-500 text-center italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ---- Punnett square ---------------------------------------------------------
//
// Draws a 2×2 grid showing the four offspring combinations of a pairing.
// Accepts two parent arrays (e.g. ['A','a'] × ['A','a']) and an optional
// tint map that colors each cell by outcome type.
export function PunnettSquare({
  sireAlleles = ['A', 'a'],
  damAlleles = ['A', 'a'],
  caption,
  highlight, // optional fn(cell) -> 'visual' | 'het' | 'normal'
}) {
  const tints = {
    visual: '#a855f7',   // purple
    het: '#10b981',      // emerald
    normal: '#475569',   // slate-600
    super: '#f59e0b',    // amber
    lethal: '#b91c1c',   // red-700
  };
  const cellSize = 60;
  const pad = 36;
  const total = pad + cellSize * 2;

  return (
    <DiagramFrame
      caption={caption}
      ariaLabel={`Punnett square for ${sireAlleles.join('')} by ${damAlleles.join('')}`}
    >
      <svg
        viewBox={`0 0 ${total + 8} ${total + 8}`}
        width="220"
        height="220"
        fontFamily="inherit"
        className="text-slate-200"
      >
        {/* Top (sire) labels */}
        {sireAlleles.map((a, i) => (
          <text
            key={`sire-${i}`}
            x={pad + cellSize * i + cellSize / 2}
            y={pad - 10}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#60a5fa"
          >
            {a}
          </text>
        ))}
        <text
          x={pad + cellSize}
          y={14}
          textAnchor="middle"
          fontSize="9"
          fill="#94a3b8"
          letterSpacing="0.1em"
        >
          SIRE ♂
        </text>

        {/* Left (dam) labels */}
        {damAlleles.map((a, i) => (
          <text
            key={`dam-${i}`}
            x={pad - 12}
            y={pad + cellSize * i + cellSize / 2 + 5}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#f472b6"
          >
            {a}
          </text>
        ))}
        <text
          x={10}
          y={pad + cellSize}
          textAnchor="middle"
          fontSize="9"
          fill="#94a3b8"
          letterSpacing="0.1em"
          transform={`rotate(-90, 10, ${pad + cellSize})`}
        >
          DAM ♀
        </text>

        {/* Grid cells */}
        {damAlleles.map((d, r) =>
          sireAlleles.map((s, c) => {
            const combo = [s, d].sort().join('');
            const tintKey = highlight ? highlight(combo) : null;
            const fill = tintKey ? tints[tintKey] : '#1e293b';
            return (
              <g key={`${r}-${c}`}>
                <rect
                  x={pad + cellSize * c}
                  y={pad + cellSize * r}
                  width={cellSize}
                  height={cellSize}
                  fill={fill}
                  fillOpacity="0.35"
                  stroke="#334155"
                  strokeWidth="1.5"
                  rx="6"
                />
                <text
                  x={pad + cellSize * c + cellSize / 2}
                  y={pad + cellSize * r + cellSize / 2 + 6}
                  textAnchor="middle"
                  fontSize="18"
                  fontWeight="800"
                  fill="#e2e8f0"
                >
                  {combo}
                </text>
              </g>
            );
          })
        )}
      </svg>
    </DiagramFrame>
  );
}

// ---- Allele pair / chromosome diagram --------------------------------------
// Shows two "chromosomes" paired together with their alleles marked at a
// single locus. Used to introduce homozygous vs heterozygous concepts.
export function AllelePair({ left = 'A', right = 'a', caption }) {
  const isHomozygous = left === right;
  return (
    <DiagramFrame
      caption={caption || `${isHomozygous ? 'Homozygous' : 'Heterozygous'} pair (${left}${right})`}
      ariaLabel={`Allele pair diagram for ${left}${right}`}
    >
      <svg viewBox="0 0 260 120" width="300" height="140" fontFamily="inherit">
        <defs>
          <linearGradient id="chromLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1e40af" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="chromRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#9d174d" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {/* Left chromosome (from sire) */}
        <rect x="50" y="20" width="32" height="90" rx="16" fill="url(#chromLeft)" />
        <text
          x="66"
          y="68"
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fill="#fff"
        >
          {left}
        </text>
        <text x="66" y="14" textAnchor="middle" fontSize="9" fill="#94a3b8">
          FROM ♂ SIRE
        </text>

        {/* Right chromosome (from dam) */}
        <rect x="178" y="20" width="32" height="90" rx="16" fill="url(#chromRight)" />
        <text
          x="194"
          y="68"
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fill="#fff"
        >
          {right}
        </text>
        <text x="194" y="14" textAnchor="middle" fontSize="9" fill="#94a3b8">
          FROM ♀ DAM
        </text>

        {/* Connecting line showing "locus" */}
        <line
          x1="82"
          y1="65"
          x2="178"
          y2="65"
          stroke="#10b981"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <text x="130" y="55" textAnchor="middle" fontSize="10" fill="#10b981">
          same gene
        </text>
      </svg>
    </DiagramFrame>
  );
}

// ---- Inheritance pattern ratio bar ------------------------------------------
// Visualizes the offspring ratio from a Punnett-square pairing as a single
// horizontal bar split by outcome.
export function OutcomeBar({ segments, caption }) {
  // segments: [{ label, pct, tint }]
  const total = segments.reduce((a, s) => a + s.pct, 0) || 100;
  let cursor = 0;
  return (
    <DiagramFrame caption={caption} ariaLabel="Offspring outcome distribution">
      <svg viewBox="0 0 320 70" width="320" height="70" fontFamily="inherit">
        <rect x="10" y="14" width="300" height="22" rx="11" fill="#0f172a" stroke="#334155" />
        {segments.map((seg, i) => {
          const x = 10 + (cursor / total) * 300;
          const w = (seg.pct / total) * 300;
          cursor += seg.pct;
          return (
            <g key={i}>
              <rect
                x={x}
                y="14"
                width={w}
                height="22"
                fill={seg.tint}
                fillOpacity="0.75"
              />
              {seg.pct >= 15 && (
                <text
                  x={x + w / 2}
                  y="30"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#fff"
                >
                  {seg.pct}%
                </text>
              )}
            </g>
          );
        })}
        {/* Legend */}
        {segments.map((seg, i) => (
          <g key={`legend-${i}`} transform={`translate(${10 + i * 100}, 50)`}>
            <rect width="10" height="10" fill={seg.tint} rx="2" />
            <text x="14" y="9" fontSize="10" fill="#94a3b8">
              {seg.label}
            </text>
          </g>
        ))}
      </svg>
    </DiagramFrame>
  );
}

// ---- Polygenic gradient ------------------------------------------------------
// Illustrates that polygenic traits form a smooth spectrum, not discrete
// categories. Shows a horizontal gradient with tick marks labeling where
// "weak" and "extreme" expression sit.
export function PolygenicGradient({ caption, low = 'Muted', high = 'Extreme' }) {
  return (
    <DiagramFrame
      caption={
        caption ||
        'Polygenic traits form a continuous spectrum ,  not a clean on/off switch.'
      }
      ariaLabel="Polygenic trait expression spectrum"
    >
      <svg viewBox="0 0 340 80" width="340" height="80" fontFamily="inherit">
        <defs>
          <linearGradient id="polyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="33%" stopColor="#10b981" />
            <stop offset="66%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <rect x="20" y="20" width="300" height="28" rx="14" fill="url(#polyGrad)" />
        {/* Discrete markers for comparison */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1={20 + (pct / 100) * 300}
            y1="18"
            x2={20 + (pct / 100) * 300}
            y2="50"
            stroke="#0f172a"
            strokeWidth="1"
          />
        ))}
        <text x="20" y="70" fontSize="10" fill="#94a3b8">
          ← {low}
        </text>
        <text x="320" y="70" fontSize="10" fill="#94a3b8" textAnchor="end">
          {high} →
        </text>
      </svg>
    </DiagramFrame>
  );
}

// ---- Pigment layers ---------------------------------------------------------
// A simple stacked-layer diagram showing how crested gecko color comes from
// three chromatophore layers: xanthophores (yellow/red), iridophores (reflective),
// and melanophores (dark base).
export function PigmentLayers({ caption }) {
  const layers = [
    {
      label: 'Xanthophores',
      detail: 'yellow + red pigments (missing in axanthic)',
      fill: '#fbbf24',
    },
    {
      label: 'Iridophores',
      detail: 'reflective crystals (brightness + fired-up shimmer)',
      fill: '#e0f2fe',
    },
    {
      label: 'Melanophores',
      detail: 'dark base pigment (black / brown)',
      fill: '#374151',
    },
  ];
  return (
    <DiagramFrame
      caption={
        caption ||
        'Three pigment-cell layers combine to produce crested gecko coloration. Axanthic animals lack the top xanthophore layer entirely.'
      }
      ariaLabel="Crested gecko pigment layer anatomy"
    >
      <svg viewBox="0 0 360 160" width="360" height="160" fontFamily="inherit">
        {layers.map((layer, i) => {
          const y = 10 + i * 42;
          return (
            <g key={layer.label}>
              <rect
                x="12"
                y={y}
                width="140"
                height="34"
                rx="6"
                fill={layer.fill}
                fillOpacity="0.8"
              />
              <text
                x="82"
                y={y + 22}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={i === 1 ? '#0f172a' : '#fff'}
              >
                {layer.label}
              </text>
              <text
                x="164"
                y={y + 20}
                fontSize="11"
                fill="#cbd5e1"
              >
                {layer.detail}
              </text>
            </g>
          );
        })}
        <text x="12" y="150" fontSize="10" fill="#64748b">
          Stacked top-to-bottom in the skin.
        </text>
      </svg>
    </DiagramFrame>
  );
}

// ---- Lethal allele diagram --------------------------------------------------
// Visualizes the Super Lilly White problem: LW × LW → 1 Super LW (lethal) +
// 2 visual LW + 1 normal.
//
// Layout is built around a viewBox that fits all four offspring cards + a
// bit of padding. Each card is 86×62 at center-x positions computed from
// an even distribution so nothing gets clipped no matter the container
// width. Uses `preserveAspectRatio="xMidYMid meet"` and a 100% width SVG
// so the browser scales instead of cropping at small containers.
export function LethalAlleleDiagram({ caption }) {
  const viewW = 460;
  const viewH = 210;
  const cardW = 86;
  const cardH = 64;
  // Evenly distribute four cards with a margin on each side
  const sideMargin = 20;
  const cardGap =
    (viewW - sideMargin * 2 - cardW * 4) / 3; // gap between consecutive cards
  const cardY = 130;
  const offspring = [
    { fill: '#b91c1c', stroke: '#ef4444', label: 'Super LW', note: 'lethal', pct: '25%' },
    { fill: '#10b981', stroke: '#34d399', label: 'Visual LW', note: 'one copy', pct: '25%' },
    { fill: '#10b981', stroke: '#34d399', label: 'Visual LW', note: 'one copy', pct: '25%' },
    { fill: '#475569', stroke: '#64748b', label: 'Normal', note: 'no LW gene', pct: '25%' },
  ];

  return (
    <DiagramFrame
      caption={
        caption ||
        'Lilly White × Lilly White: one out of four fertilized eggs is a Super Lilly White, which does not hatch.'
      }
      ariaLabel="Lethal allele inheritance diagram for Lilly White"
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        style={{ maxWidth: `${viewW}px`, height: 'auto' }}
        preserveAspectRatio="xMidYMid meet"
        fontFamily="inherit"
      >
        {/* Parents */}
        <g>
          <circle cx={viewW * 0.18} cy="34" r="22" fill="#10b981" fillOpacity="0.35" stroke="#10b981" strokeWidth="2" />
          <text x={viewW * 0.18} y="39" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">
            LW
          </text>
          <text x={viewW * 0.18} y="72" textAnchor="middle" fontSize="10" fill="#94a3b8">
            Lilly White ♂
          </text>
        </g>
        <text x={viewW / 2} y="42" textAnchor="middle" fontSize="22" fill="#94a3b8">
          ×
        </text>
        <g>
          <circle cx={viewW * 0.82} cy="34" r="22" fill="#10b981" fillOpacity="0.35" stroke="#10b981" strokeWidth="2" />
          <text x={viewW * 0.82} y="39" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">
            LW
          </text>
          <text x={viewW * 0.82} y="72" textAnchor="middle" fontSize="10" fill="#94a3b8">
            Lilly White ♀
          </text>
        </g>

        {/* Arrow down */}
        <line x1={viewW / 2} y1="88" x2={viewW / 2} y2="118" stroke="#64748b" strokeWidth="2" />
        <polygon points={`${viewW / 2 - 5},115 ${viewW / 2},125 ${viewW / 2 + 5},115`} fill="#64748b" />

        {/* Offspring */}
        {offspring.map((child, i) => {
          const x = sideMargin + i * (cardW + cardGap);
          return (
            <g key={i} transform={`translate(${x}, ${cardY})`}>
              <rect
                width={cardW}
                height={cardH}
                rx="8"
                fill={child.fill}
                fillOpacity="0.3"
                stroke={child.stroke}
                strokeWidth="1.5"
              />
              <text x={cardW / 2} y="20" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">
                {child.pct}
              </text>
              <text x={cardW / 2} y="37" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
                {child.label}
              </text>
              <text x={cardW / 2} y="52" textAnchor="middle" fontSize="9" fill="#cbd5e1">
                {child.note}
              </text>
            </g>
          );
        })}
      </svg>
    </DiagramFrame>
  );
}

// ---- Epistasis masking ------------------------------------------------------
// Shows how one gene can "mask" another ,  specifically axanthic masking
// underlying red/yellow color genes.
export function EpistasisDiagram({ caption }) {
  return (
    <DiagramFrame
      caption={
        caption ||
        'Axanthic geckos carry color genes but can\'t express them ,  the axanthic gene sits "upstream" and masks xanthophore development entirely.'
      }
      ariaLabel="Epistasis masking diagram"
    >
      <svg viewBox="0 0 400 160" width="400" height="160" fontFamily="inherit">
        {/* Underlying color gene */}
        <g transform="translate(40, 40)">
          <rect width="130" height="36" rx="6" fill="#ef4444" fillOpacity="0.4" stroke="#ef4444" />
          <text x="65" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
            High-Red genes
          </text>
        </g>
        <text x="105" y="30" textAnchor="middle" fontSize="9" fill="#94a3b8">
          PRESENT BUT HIDDEN
        </text>

        {/* Masking gene */}
        <g transform="translate(230, 40)">
          <rect width="130" height="36" rx="6" fill="#475569" fillOpacity="0.6" stroke="#64748b" />
          <text x="65" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#e2e8f0">
            Axanthic (aa)
          </text>
        </g>
        <text x="295" y="30" textAnchor="middle" fontSize="9" fill="#94a3b8">
          UPSTREAM MASK
        </text>

        {/* Result */}
        <line x1="200" y1="100" x2="200" y2="115" stroke="#64748b" strokeWidth="2" />
        <polygon points="195,112 200,122 205,112" fill="#64748b" />
        <text
          x="200"
          y="145"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#e2e8f0"
        >
          Phenotype: gray / black / white only
        </text>
      </svg>
    </DiagramFrame>
  );
}

// ---- Incomplete dominant dose-response --------------------------------------
// Side-by-side cards showing 0 / 1 / 2 copies of an incomplete dominant.
export function DoseResponse({ caption, traitName = 'Lilly White', superLabel = 'Super form' }) {
  const states = [
    { copies: 0, label: 'Normal', detail: 'No copies', fill: '#1e293b', stroke: '#334155' },
    { copies: 1, label: traitName, detail: 'Single copy (visual)', fill: '#10b981', stroke: '#34d399' },
    { copies: 2, label: superLabel, detail: 'Double copy', fill: '#a855f7', stroke: '#c084fc' },
  ];
  return (
    <DiagramFrame
      caption={
        caption ||
        `${traitName} is incomplete dominant ,  one copy shows the trait, two copies produce a distinct "super" form.`
      }
      ariaLabel="Incomplete dominant dose response"
    >
      <svg viewBox="0 0 360 140" width="360" height="140" fontFamily="inherit">
        {states.map((s, i) => {
          const x = 20 + i * 115;
          return (
            <g key={i} transform={`translate(${x}, 20)`}>
              <rect
                width="100"
                height="100"
                rx="10"
                fill={s.fill}
                fillOpacity="0.35"
                stroke={s.stroke}
                strokeWidth="2"
              />
              <text x="50" y="30" textAnchor="middle" fontSize="11" fill="#94a3b8">
                {s.copies} {s.copies === 1 ? 'copy' : 'copies'}
              </text>
              <text x="50" y="56" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">
                {s.label}
              </text>
              <text x="50" y="80" textAnchor="middle" fontSize="9" fill="#cbd5e1">
                {s.detail}
              </text>
            </g>
          );
        })}
      </svg>
    </DiagramFrame>
  );
}
