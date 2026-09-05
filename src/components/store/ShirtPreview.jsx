import { SHIRT_COLOR_MAP } from '@/lib/store/customShirt';

/**
 * Live render of a custom gecko tee.
 *
 * A flat shirt silhouette in the chosen colour with the print composed on
 * top. Sizes are container-query units (cqw) so the same component works
 * as a cart thumbnail and as the full builder preview. The print itself is
 * what production receives; the shirt drawing is only there so the customer
 * can judge colour and placement.
 */

function Photo({ src, alt, className = '', style }) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center text-center ${className}`}
        style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: '2.6cqw', padding: '1cqw', ...style }}
      >
        your photo
      </div>
    );
  }
  return <img src={src} alt={alt || ''} className={`object-cover ${className}`} style={style} draggable={false} />;
}

function PrintArt({ design, ink, scale = 1 }) {
  const s = (n) => `${n * scale}cqw`;
  const headline = design.headline || 'Name';
  const subline = design.subline || 'Crested gecko';

  if (design.style === 'poster') {
    return (
      <div className="flex flex-col items-center text-center" style={{ color: ink, width: s(34), gap: s(1.2) }}>
        <Photo src={design.photo_url} alt={headline} className="w-full" style={{ aspectRatio: '4 / 3', border: `${s(0.4)} solid ${ink}` }} />
        <div className="truncate w-full" style={{ fontSize: s(5.2), fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'Montserrat', system-ui, sans-serif", lineHeight: 1 }}>{headline}</div>
        <div className="truncate w-full" style={{ fontSize: s(2.4), letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.9 }}>{subline}</div>
        {design.fine_print && <div style={{ fontSize: s(1.8), opacity: 0.65, letterSpacing: '0.1em' }}>{design.fine_print}</div>}
      </div>
    );
  }

  if (design.style === 'badge') {
    return (
      <div className="relative rounded-full flex flex-col items-center justify-center text-center" style={{ width: s(32), height: s(32), border: `${s(0.7)} solid ${ink}`, color: ink, boxShadow: `inset 0 0 0 ${s(1.3)} transparent, inset 0 0 0 ${s(1.6)} ${ink}` }}>
        <div className="truncate" style={{ fontSize: s(3), fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', maxWidth: '78%', fontFamily: "'Montserrat', system-ui, sans-serif" }}>{headline}</div>
        <div className="rounded-full overflow-hidden" style={{ width: s(15), height: s(15), border: `${s(0.5)} solid ${ink}`, marginTop: s(0.8) }}>
          <Photo src={design.photo_url} alt={headline} className="w-full h-full" />
        </div>
        <div className="truncate" style={{ fontSize: s(1.9), letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: s(0.8), maxWidth: '78%', opacity: 0.9 }}>{subline}</div>
      </div>
    );
  }

  const round = design.style === 'circle';
  return (
    <div className="flex flex-col items-center text-center" style={{ color: ink, width: s(32), gap: s(1.4) }}>
      <div className={round ? 'rounded-full overflow-hidden' : 'overflow-hidden'} style={{ width: s(26), height: s(26), border: `${s(0.5)} solid ${ink}` }}>
        <Photo src={design.photo_url} alt={headline} className="w-full h-full" />
      </div>
      <div className="truncate w-full" style={{ fontSize: s(4.4), fontWeight: 700, fontFamily: "'Young Serif', Georgia, serif", lineHeight: 1.05 }}>{headline}</div>
      <div className="truncate w-full" style={{ fontSize: s(2.2), letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85 }}>{subline}</div>
    </div>
  );
}

export default function ShirtPreview({ design }) {
  if (!design) return null;
  const color = SHIRT_COLOR_MAP[design.color] || SHIRT_COLOR_MAP.black;
  const ink = color.ink;
  const placement = design.placement || 'front';
  const chest = placement === 'chest';
  const back = placement === 'back';

  // Print position on the flat shirt. Percentages of the silhouette box.
  const printStyle = chest
    ? { left: '58%', top: '24%', transform: 'translate(-50%, 0)' }
    : { left: '50%', top: back ? '22%' : '27%', transform: 'translate(-50%, 0)' };

  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div className="relative w-full" style={{ aspectRatio: '1 / 1.1' }}>
        <svg viewBox="0 0 100 110" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="shirt-shade" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
              <stop offset="1" stopColor="#000" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <path
            d="M32 8 L44 4 Q50 9 56 4 L68 8 L88 22 L80 33 L72 28 L72 100 Q50 105 28 100 L28 28 L20 33 L12 22 Z"
            fill={color.hex}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          <path d="M32 8 L44 4 Q50 9 56 4 L68 8 L88 22 L80 33 L72 28 L72 100 Q50 105 28 100 L28 28 L20 33 L12 22 Z" fill="url(#shirt-shade)" />
          {!back && <path d="M44 4 Q50 12 56 4" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />}
          {back && <path d="M42 5 Q50 3 58 5" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />}
        </svg>
        <div className="absolute" style={printStyle}>
          <PrintArt design={design} ink={ink} scale={chest ? 0.42 : 1} />
        </div>
        <div
          className="absolute left-2 bottom-1 text-[10px] uppercase tracking-wider"
          style={{ color: 'rgba(148,163,184,0.9)' }}
        >
          {back ? 'Back' : 'Front'} · {color.label} · {design.size || 'L'}
        </div>
      </div>
    </div>
  );
}
