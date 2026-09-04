import {
  Leaf, Flame, Droplet, Zap, Eye, Hand, Moon, Cog, Sparkles, Gem, Star,
} from 'lucide-react';
import {
  cardType,
  CARD_STAGES,
  RARITY_MAP,
  stageEvolves,
} from '@/lib/store/customSticker';

/**
 * Live render of a custom pet sticker design.
 *
 * This is an original Geck Inspect card layout, not a reproduction of any
 * published card. It exists so the customer can see what they are buying
 * while they build it, and so production has a reference render.
 *
 * Sizing is done entirely in container-query units (cqw), so one component
 * renders correctly at thumbnail size in the cart and at full size in the
 * builder without a second set of styles. The card is 2.5 x 3.5, the
 * standard trading-card ratio.
 */

const GLYPHS = {
  leaf: Leaf,
  flame: Flame,
  droplet: Droplet,
  zap: Zap,
  eye: Eye,
  fist: Hand,
  moon: Moon,
  cog: Cog,
  sparkles: Sparkles,
  gem: Gem,
  star: Star,
};

function TypePip({ type, size = 5.4 }) {
  const t = cardType(type);
  const Icon = GLYPHS[t.glyph] || Star;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: `${size}cqw`,
        height: `${size}cqw`,
        background: t.color,
        border: `${size * 0.09}cqw solid rgba(0,0,0,0.35)`,
        boxShadow: 'inset 0 0 0 0.2cqw rgba(255,255,255,0.45)',
      }}
      title={t.label}
    >
      <Icon style={{ width: `${size * 0.6}cqw`, height: `${size * 0.6}cqw`, color: t.text }} strokeWidth={2.6} />
    </span>
  );
}

function CostPips({ count, type, size = 5.4 }) {
  const n = Math.max(0, Math.min(4, Number(count) || 0));
  if (n === 0) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{
          width: `${size}cqw`,
          height: `${size}cqw`,
          background: 'rgba(0,0,0,0.12)',
          border: `${size * 0.09}cqw dashed rgba(0,0,0,0.3)`,
        }}
      />
    );
  }
  return (
    <span className="inline-flex" style={{ gap: `${size * 0.12}cqw` }}>
      {Array.from({ length: n }).map((_, i) => (
        <TypePip key={i} type={type} size={size} />
      ))}
    </span>
  );
}

function InfoBar({ design }) {
  const bits = [];
  if (design.dex_number) bits.push(`NO. ${design.dex_number}`);
  if (design.height) bits.push(`HT: ${design.height}`);
  if (design.weight) bits.push(`WT: ${design.weight} lbs.`);
  if (bits.length === 0) return null;
  return (
    <div
      className="text-center font-medium"
      style={{
        fontSize: '2.9cqw',
        color: 'rgba(20,20,20,0.8)',
        background: 'linear-gradient(180deg, #f2f0ea 0%, #d8d5cc 100%)',
        borderRadius: '1cqw',
        padding: '0.7cqw 1.5cqw',
        border: '0.25cqw solid rgba(0,0,0,0.18)',
      }}
    >
      {bits.join('   ')}
    </div>
  );
}

function StatsBar({ design }) {
  const weak = design.weakness_type ? cardType(design.weakness_type) : null;
  const resist = design.resistance_type ? cardType(design.resistance_type) : null;
  const cell = {
    background: 'linear-gradient(180deg, #f4f2ec 0%, #dcd9d0 100%)',
    border: '0.25cqw solid rgba(0,0,0,0.2)',
    borderRadius: '3cqw',
    padding: '0.8cqw 2cqw',
    color: 'rgba(20,20,20,0.85)',
  };
  return (
    <div className="flex items-center" style={{ gap: '1.2cqw', fontSize: '2.7cqw' }}>
      <div className="flex items-center flex-1" style={{ ...cell, gap: '1cqw' }}>
        <span className="font-semibold">weakness</span>
        {weak ? (
          <>
            <TypePip type={design.weakness_type} size={4} />
            <span className="font-bold">{design.weakness_multiplier}</span>
          </>
        ) : (
          <span style={{ opacity: 0.4 }}>none</span>
        )}
      </div>
      <div className="flex items-center flex-1" style={{ ...cell, gap: '1cqw' }}>
        <span className="font-semibold">resistance</span>
        {resist ? (
          <>
            <TypePip type={design.resistance_type} size={4} />
            <span className="font-bold">{design.resistance_amount}</span>
          </>
        ) : (
          <span style={{ opacity: 0.4 }}>none</span>
        )}
      </div>
      <div className="flex items-center" style={{ ...cell, gap: '1cqw' }}>
        <span className="font-semibold">retreat</span>
        <CostPips count={design.retreat_cost} type="colorless" size={4} />
      </div>
    </div>
  );
}

function Footer({ design, onLight }) {
  const rarity = RARITY_MAP[design.rarity] || RARITY_MAP.common;
  const color = onLight ? 'rgba(20,20,20,0.8)' : 'rgba(255,255,255,0.92)';
  return (
    <div className="flex items-end justify-between" style={{ fontSize: '2.6cqw', color }}>
      <div className="min-w-0">
        {design.illustrator && (
          <div className="italic font-semibold truncate">Illus. {design.illustrator}</div>
        )}
        <div className="flex items-center" style={{ gap: '1.2cqw' }}>
          {design.set_code && (
            <span
              className="font-bold"
              style={{
                background: onLight ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.9)',
                color: onLight ? '#f5f3ee' : '#14181f',
                borderRadius: '0.6cqw',
                padding: '0.2cqw 1cqw',
              }}
            >
              {design.set_code}
            </span>
          )}
          <span className="font-semibold">
            {design.card_number || '1'}/{design.set_total || '150'}
          </span>
          <span style={{ fontSize: '3cqw', lineHeight: 1 }}>{rarity.symbol}</span>
        </div>
      </div>
      {design.morph_line && (
        <div className="text-right font-semibold truncate" style={{ maxWidth: '58%' }}>
          {design.morph_line}
        </div>
      )}
    </div>
  );
}

function PhotoSlot({ url, name, className, style }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name} sticker artwork` : 'Sticker artwork'}
        className={className}
        style={style}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div
      className={`${className} flex flex-col items-center justify-center text-center`}
      style={{ ...style, background: 'rgba(0,0,0,0.25)' }}
    >
      <span style={{ fontSize: '3.4cqw', color: 'rgba(255,255,255,0.7)', padding: '0 6cqw' }}>
        Your photo goes here
      </span>
    </div>
  );
}

export default function StickerCardPreview({ design, className = '' }) {
  if (!design) return null;
  const t = cardType(design.type);
  const stage = CARD_STAGES.find((s) => s.value === design.stage) || CARD_STAGES[0];
  const border = {
    yellow: '#f4d75e',
    silver: '#c9ced3',
    gold: '#d4a94a',
    black: '#1c2028',
    white: '#f3f1ea',
  }[design.border_color] || '#f4d75e';
  const attacks = (design.attacks || []).filter((a) => String(a.name || '').trim());
  const fullArt = design.layout === 'full_art';

  return (
    <div
      className={`relative w-full select-none ${className}`}
      style={{
        containerType: 'inline-size',
        aspectRatio: '2.5 / 3.5',
      }}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          background: border,
          borderRadius: '4.2cqw',
          padding: '3.2cqw',
          boxShadow: '0 1.5cqw 4cqw rgba(0,0,0,0.45)',
        }}
      >
        <div
          className="w-full h-full relative overflow-hidden flex flex-col"
          style={{
            borderRadius: '2.4cqw',
            padding: fullArt ? 0 : '2.4cqw',
            gap: fullArt ? 0 : '1.6cqw',
            background: fullArt
              ? '#0b0e13'
              : `radial-gradient(120% 90% at 50% 0%, ${t.color} 0%, ${t.accent} 100%)`,
            border: '0.3cqw solid rgba(0,0,0,0.35)',
          }}
        >
          {/* ---------------- Full art layout ---------------- */}
          {fullArt && (
            <>
              <PhotoSlot
                url={design.photo_url}
                name={design.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-x-0 top-0"
                style={{
                  padding: '2.6cqw 3cqw',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)',
                }}
              >
                <div className="flex items-start" style={{ gap: '1.6cqw' }}>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold uppercase inline-block"
                      style={{
                        fontSize: '2.5cqw',
                        letterSpacing: '0.06em',
                        color: '#101319',
                        background: '#e8e5dc',
                        borderRadius: '0.8cqw',
                        padding: '0.2cqw 1.2cqw',
                      }}
                    >
                      {stage.label}
                    </div>
                    <div
                      className="font-extrabold truncate"
                      style={{
                        fontSize: '8cqw',
                        color: '#fff',
                        lineHeight: 1.05,
                        textShadow: '0 0.5cqw 1cqw rgba(0,0,0,0.8)',
                      }}
                    >
                      {design.name || 'Card name'}
                    </div>
                    {stageEvolves(design.stage) && design.evolves_from && (
                      <div
                        className="italic font-semibold truncate"
                        style={{ fontSize: '2.9cqw', color: 'rgba(255,255,255,0.9)' }}
                      >
                        Evolves from {design.evolves_from}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center shrink-0" style={{ gap: '1cqw', paddingTop: '3cqw' }}>
                    <span style={{ fontSize: '3cqw', color: '#fff', fontWeight: 700 }}>HP</span>
                    <span
                      style={{
                        fontSize: '8cqw',
                        color: '#fff',
                        fontWeight: 800,
                        lineHeight: 1,
                        textShadow: '0 0.5cqw 1cqw rgba(0,0,0,0.8)',
                      }}
                    >
                      {design.hp}
                    </span>
                    <TypePip type={design.type} size={7} />
                  </div>
                </div>
              </div>

              <div
                className="absolute inset-x-0 bottom-0 flex flex-col"
                style={{
                  padding: '2.6cqw 3cqw',
                  gap: '1.4cqw',
                  background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                }}
              >
                <StatsBar design={design} />
                <Footer design={design} onLight={false} />
              </div>
            </>
          )}

          {/* ---------------- Classic layout ---------------- */}
          {!fullArt && (
            <>
              <div className="flex items-start" style={{ gap: '1.6cqw' }}>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold uppercase inline-block"
                    style={{
                      fontSize: '2.5cqw',
                      letterSpacing: '0.06em',
                      color: '#101319',
                      background: '#e8e5dc',
                      borderRadius: '0.8cqw',
                      padding: '0.2cqw 1.2cqw',
                    }}
                  >
                    {stage.label}
                  </div>
                  <div
                    className="font-extrabold truncate"
                    style={{
                      fontSize: '8cqw',
                      color: '#14181f',
                      lineHeight: 1.05,
                      textShadow: '0 0.2cqw 0 rgba(255,255,255,0.45)',
                    }}
                  >
                    {design.name || 'Card name'}
                  </div>
                  {stageEvolves(design.stage) && design.evolves_from && (
                    <div
                      className="italic font-semibold truncate"
                      style={{ fontSize: '2.9cqw', color: 'rgba(20,20,20,0.8)' }}
                    >
                      Evolves from {design.evolves_from}
                    </div>
                  )}
                </div>
                <div className="flex items-center shrink-0" style={{ gap: '1cqw', paddingTop: '2.4cqw' }}>
                  <span style={{ fontSize: '3cqw', color: '#14181f', fontWeight: 700 }}>HP</span>
                  <span style={{ fontSize: '8cqw', color: '#14181f', fontWeight: 800, lineHeight: 1 }}>
                    {design.hp}
                  </span>
                  <TypePip type={design.type} size={7} />
                </div>
              </div>

              <div
                className="relative w-full overflow-hidden shrink-0"
                style={{
                  aspectRatio: '4 / 3',
                  borderRadius: '1.2cqw',
                  border: '0.8cqw solid rgba(240,238,230,0.9)',
                  boxShadow: '0 0.6cqw 1.6cqw rgba(0,0,0,0.35)',
                }}
              >
                <PhotoSlot
                  url={design.photo_url}
                  name={design.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              <InfoBar design={design} />

              <div className="flex-1 flex flex-col justify-center" style={{ gap: '2.4cqw' }}>
                {attacks.length === 0 ? (
                  <div
                    className="text-center italic"
                    style={{ fontSize: '3cqw', color: 'rgba(20,20,20,0.55)' }}
                  >
                    Add an attack to fill this space.
                  </div>
                ) : (
                  attacks.map((a, i) => (
                    <div key={i}>
                      <div className="flex items-center" style={{ gap: '1.6cqw' }}>
                        <CostPips count={a.cost} type={a.cost_type || design.type} size={5.4} />
                        <div
                          className="flex-1 font-bold truncate text-center"
                          style={{ fontSize: '5.4cqw', color: '#14181f' }}
                        >
                          {a.name}
                        </div>
                        <div
                          className="font-extrabold shrink-0"
                          style={{ fontSize: '5.8cqw', color: '#14181f' }}
                        >
                          {a.damage}
                        </div>
                      </div>
                      {a.text && (
                        <div
                          className="text-center"
                          style={{ fontSize: '2.9cqw', color: 'rgba(20,20,20,0.85)', lineHeight: 1.3, marginTop: '0.6cqw' }}
                        >
                          {a.text}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <StatsBar design={design} />
              <Footer design={design} onLight />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
