import StickerCardPreview from '@/components/store/StickerCardPreview';
import { stickerTheme, isCardTheme } from '@/lib/store/stickerThemes';

/**
 * Live renders for the five non-card sticker themes, plus StickerPreview,
 * the one switch every surface (builder, cart, order detail) goes through.
 *
 * Same approach as StickerCardPreview: every size is in container-query
 * width units (cqw), so one component renders correctly as a thumbnail in
 * the cart and at full size in the builder. Each theme is an original
 * Geck Inspect layout. None of them reproduces a published product.
 */

function Frame({ ratio, children, style, className = '' }) {
  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div
        className={`relative overflow-hidden ${className}`}
        style={{ aspectRatio: ratio, ...style }}
      >
        {children}
      </div>
    </div>
  );
}

function Photo({ src, alt, style, className = '' }) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 2cqw, rgba(0,0,0,0.12) 2cqw 4cqw)', color: 'rgba(0,0,0,0.45)', fontSize: '3.4cqw', ...style }}
      >
        your photo here
      </div>
    );
  }
  return <img src={src} alt={alt || ''} className={`object-cover ${className}`} style={style} draggable={false} />;
}

const morphOr = (design, fallback = 'Crested gecko') => design.morph_line || fallback;

/* ------------------------------ Field guide ------------------------------ */
function FieldGuidePreview({ design }) {
  const bits = [];
  if (design.height) bits.push(`Length ${design.height}`);
  if (design.weight) bits.push(`Weight ${design.weight}`);
  return (
    <Frame ratio="3 / 4" style={{ background: '#f3ecd9', borderRadius: '2cqw', boxShadow: 'inset 0 0 0 1.2cqw #e6dcc1, inset 0 0 0 1.6cqw #b89a63' }}>
      <div className="absolute inset-0 flex flex-col" style={{ padding: '6cqw 6cqw 5cqw', color: '#2f2418', fontFamily: "'Young Serif', Georgia, serif" }}>
        <div className="flex items-baseline justify-between" style={{ fontSize: '3cqw', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a6240' }}>
          <span>Correlophus ciliatus</span>
          <span>{design.dex_number ? `Plate ${design.dex_number}` : 'Plate'}</span>
        </div>
        <div className="mt-[3cqw] flex-1 relative" style={{ border: '0.6cqw solid #2f2418', background: '#fbf7ec' }}>
          <Photo src={design.photo_url} alt={design.name} className="absolute inset-0 w-full h-full" />
        </div>
        <div style={{ marginTop: '3.2cqw', fontSize: '7cqw', lineHeight: 1.05, fontStyle: 'italic' }}>{design.name || 'Name'}</div>
        <div style={{ fontSize: '3.4cqw', marginTop: '1cqw', color: '#4a3b28' }}>{morphOr(design)}</div>
        <div className="flex justify-between" style={{ marginTop: 'auto', fontSize: '2.6cqw', color: '#7a6240', borderTop: '0.3cqw solid #b89a63', paddingTop: '1.6cqw' }}>
          <span>{bits.join(' · ') || design.caption || 'New Caledonia'}</span>
          <span>{design.illustrator ? `Coll. ${design.illustrator}` : 'Geck Inspect'}</span>
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------- Passport ------------------------------- */
function PassportPreview({ design }) {
  const rows = [
    ['Name', design.name || 'Name'],
    ['Morph', morphOr(design)],
    ['Hatched', design.hatch_label || 'unknown'],
    ['ID', design.card_number || 'GI-0000'],
    ['Origin', design.badge_location || 'New Caledonia'],
  ];
  return (
    <Frame ratio="3.5 / 2.5" style={{ background: 'linear-gradient(135deg, #14372b, #0d2a21)', borderRadius: '3cqw', boxShadow: 'inset 0 0 0 0.8cqw #c9a84a' }}>
      <div className="absolute inset-0 flex" style={{ padding: '4cqw', gap: '4cqw', color: '#f1ead3', fontFamily: "'Montserrat', system-ui, sans-serif" }}>
        <div className="flex flex-col" style={{ width: '32%' }}>
          <Photo src={design.photo_url} alt={design.name} className="w-full" style={{ aspectRatio: '3 / 4', borderRadius: '1.2cqw', border: '0.5cqw solid #c9a84a' }} />
          <div style={{ marginTop: 'auto', fontSize: '2.2cqw', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9a84a' }}>Geck Inspect</div>
        </div>
        <div className="flex-1 flex flex-col">
          <div style={{ fontSize: '2.6cqw', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#c9a84a' }}>Crested gecko passport</div>
          <div className="grid" style={{ gridTemplateColumns: 'auto 1fr', columnGap: '2.4cqw', rowGap: '1.2cqw', marginTop: '2.4cqw', fontSize: '2.9cqw' }}>
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <span style={{ color: '#9fb8ab', textTransform: 'uppercase', fontSize: '2.2cqw', letterSpacing: '0.12em', alignSelf: 'baseline' }}>{k}</span>
                <span className="truncate" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div
            className="self-end"
            style={{ marginTop: 'auto', border: '0.5cqw solid #d96c5f', color: '#d96c5f', borderRadius: '1.5cqw', padding: '0.8cqw 2cqw', fontSize: '2.4cqw', letterSpacing: '0.18em', textTransform: 'uppercase', transform: 'rotate(-6deg)', fontWeight: 700 }}
          >
            Verified keeper
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------- Park badge ------------------------------ */
function ParkBadgePreview({ design }) {
  return (
    <Frame ratio="1 / 1" className="rounded-full" style={{ background: '#1f3a2c', boxShadow: 'inset 0 0 0 1.2cqw #e5c46b, inset 0 0 0 2.4cqw #1f3a2c, inset 0 0 0 3cqw #e5c46b' }}>
      <div className="absolute inset-0 flex flex-col items-center" style={{ padding: '7cqw 8cqw', color: '#f4ead0', fontFamily: "'Montserrat', system-ui, sans-serif", textAlign: 'center' }}>
        <div className="truncate w-full" style={{ fontSize: '7.5cqw', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{design.name || 'Name'}</div>
        <div style={{ fontSize: '3cqw', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#e5c46b', marginTop: '0.6cqw' }}>{morphOr(design)}</div>
        <div className="rounded-full overflow-hidden" style={{ width: '54%', aspectRatio: '1 / 1', marginTop: '3cqw', border: '1cqw solid #e5c46b' }}>
          <Photo src={design.photo_url} alt={design.name} className="w-full h-full" />
        </div>
        <div style={{ marginTop: 'auto', fontSize: '3.2cqw', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{design.badge_location || 'New Caledonia'}</div>
        <div style={{ fontSize: '2.6cqw', color: '#e5c46b', letterSpacing: '0.2em' }}>{design.hatch_label ? `EST. ${design.hatch_label}` : 'CORRELOPHUS CILIATUS'}</div>
      </div>
    </Frame>
  );
}

/* -------------------------------- Polaroid ------------------------------- */
function PolaroidPreview({ design }) {
  const caption = design.caption || [design.name, design.morph_line].filter(Boolean).join(', ') || 'your caption';
  return (
    <Frame ratio="3.5 / 4.2" style={{ background: '#fbfbf7', borderRadius: '1.2cqw', boxShadow: '0 0.6cqw 2cqw rgba(0,0,0,0.25)' }}>
      <div className="absolute inset-0 flex flex-col" style={{ padding: '5cqw 5cqw 4cqw' }}>
        <div className="w-full" style={{ aspectRatio: '1 / 1', background: '#111' }}>
          <Photo src={design.photo_url} alt={design.name} className="w-full h-full" style={{ color: '#ddd' }} />
        </div>
        <div className="flex-1 flex flex-col justify-center" style={{ fontFamily: "'Righteous', 'Comic Sans MS', cursive", color: '#1f2a44', transform: 'rotate(-1.5deg)' }}>
          <div className="truncate" style={{ fontSize: '6cqw' }}>{caption}</div>
          {design.hatch_label && <div style={{ fontSize: '3.6cqw', color: '#4b5675' }}>{design.hatch_label}</div>}
        </div>
      </div>
    </Frame>
  );
}

/* --------------------------------- Rosette ------------------------------- */
function RosettePreview({ design }) {
  const petals = 16;
  return (
    <Frame ratio="1 / 1.45" style={{ background: 'transparent' }}>
      {/* tails */}
      <div className="absolute" style={{ left: '30%', top: '58%', width: '17%', height: '40%', background: 'linear-gradient(180deg, #b0281f, #8e1d16)', transform: 'rotate(10deg)', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%)' }} />
      <div className="absolute" style={{ left: '53%', top: '58%', width: '17%', height: '40%', background: 'linear-gradient(180deg, #b0281f, #8e1d16)', transform: 'rotate(-10deg)', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%)' }} />
      {/* pleated ring */}
      <div className="absolute" style={{ left: '4%', top: '2%', width: '92%', aspectRatio: '1 / 1' }}>
        {Array.from({ length: petals }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ width: '22%', height: '50%', marginLeft: '-11%', marginTop: '-50%', transformOrigin: '50% 100%', transform: `rotate(${(360 / petals) * i}deg)`, background: i % 2 ? '#c8352b' : '#e04b40', borderRadius: '45% 45% 0 0' }}
          />
        ))}
        <div className="absolute rounded-full" style={{ left: '15%', top: '15%', width: '70%', height: '70%', background: '#f7e7b5', boxShadow: 'inset 0 0 0 1.2cqw #c9a84a' }}>
          <div className="absolute rounded-full overflow-hidden" style={{ left: '12%', top: '12%', width: '76%', height: '76%' }}>
            <Photo src={design.photo_url} alt={design.name} className="w-full h-full" />
          </div>
        </div>
      </div>
      {/* award text over the centre */}
      <div className="absolute inset-x-0 text-center" style={{ top: '60%', fontFamily: "'Young Serif', Georgia, serif", color: '#3a1410' }}>
        <div style={{ fontSize: '6cqw', fontWeight: 700, background: '#f7e7b5', display: 'inline-block', padding: '0.6cqw 3cqw', borderRadius: '3cqw', boxShadow: '0 0 0 0.6cqw #c9a84a' }}>{design.award_text || 'Best in Show'}</div>
        <div style={{ fontSize: '3.2cqw', marginTop: '1.4cqw', color: '#f7e7b5', textShadow: '0 0 0.8cqw rgba(0,0,0,0.6)' }}>{design.name || 'Name'}{design.award_event ? ` · ${design.award_event}` : ''}</div>
      </div>
    </Frame>
  );
}

const THEME_COMPONENTS = {
  field_guide: FieldGuidePreview,
  passport: PassportPreview,
  park_badge: ParkBadgePreview,
  polaroid: PolaroidPreview,
  show_rosette: RosettePreview,
};

/** One entry point: picks the render that matches design.theme. */
export default function StickerPreview({ design }) {
  if (!design) return null;
  if (isCardTheme(design.theme)) return <StickerCardPreview design={design} />;
  const Component = THEME_COMPONENTS[stickerTheme(design.theme).value] || StickerCardPreview;
  return <Component design={design} />;
}
