import LegacyStickerCardPreview from './LegacyStickerCardPreview';
import StickerPhoto from '@/components/store/StickerPhoto';
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
        <span className="font-semibold">challenge</span>
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
        <span className="font-semibold">strength</span>
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
        <span className="font-semibold">rest</span>
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
          <div className="italic font-semibold truncate">Art by {design.illustrator}</div>
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

function MovePanel({ design, onDark = false, compact = false }) {
  const moves = (design.attacks || []).filter((a) => String(a.name || '').trim()).slice(0, 2);
  return (
    <div className="flex flex-col justify-center" style={{ gap: '2cqw', flex: 1, padding: '2cqw 1.5cqw', color: onDark ? '#fff' : '#24271e' }}>
      {moves.length ? moves.map((move, i) => (
        <div key={i} style={{ borderTop: i ? `0.25cqw solid ${onDark ? '#ffffff38' : '#473a242b'}` : undefined, paddingTop: i ? '1.8cqw' : 0 }}>
          <div className="flex items-center" style={{ gap: '1.5cqw' }}>
            <CostPips count={move.cost} type={move.cost_type || design.type} size={compact ? 3.8 : 4.6} />
            <span className="flex-1 font-bold" style={{ fontSize: compact ? '3.9cqw' : '4.7cqw', lineHeight: 1.1, overflowWrap: 'anywhere' }}>{move.name}</span>
            <span className="font-extrabold" style={{ fontSize: compact ? '4.6cqw' : '5.5cqw' }}>{move.damage}</span>
          </div>
          {move.text && <p style={{ fontSize: compact ? '2.5cqw' : '2.8cqw', lineHeight: 1.3, marginTop: '1cqw' }}>{move.text}</p>}
        </div>
      )) : <span style={{ fontSize: '3cqw' }}>Your signature moves</span>}
    </div>
  );
}

function CardIdentity({ design, light = false }) {
  const stage = CARD_STAGES.find((s) => s.value === design.stage) || CARD_STAGES[0];
  const name = design.name || 'Your gecko';
  return (
    <div className="flex items-start" style={{ gap: '2cqw', color: light ? '#fff' : '#202820' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center" style={{ gap: '1.4cqw', fontSize: '2.3cqw', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>
          <span style={{ background: light ? '#ffffff26' : '#f5ecd3', border: '0.2cqw solid #8d7b5355', padding: '0.4cqw 1.2cqw', borderRadius: '0.6cqw' }}>{stage.label}</span>
          <span style={{ opacity: 0.7 }}>Geck Inspect</span>
        </div>
        <div className="font-extrabold" style={{ fontSize: name.length > 16 ? '5.6cqw' : '7.6cqw', lineHeight: 1.12, marginTop: '1cqw', overflowWrap: 'anywhere' }}>{name}</div>
        {stageEvolves(design.stage) && design.evolves_from && <div style={{ fontSize: '2.6cqw', marginTop: '0.6cqw' }}>Lineage: {design.evolves_from}</div>}
      </div>
      <div className="flex items-center shrink-0" style={{ gap: '1cqw', paddingTop: '4cqw' }}>
        <div className="text-right"><div style={{ fontSize: '2.2cqw', letterSpacing: '0.06em' }}>POWER</div><div style={{ fontSize: '7cqw', fontWeight: 900, lineHeight: 1 }}>{design.hp}</div></div>
        <TypePip type={design.type} size={6.8} />
      </div>
    </div>
  );
}

export default function StickerCardPreview({ design, className = '' }) {
  if (!design) return null;
  if (design.version === 1) return <LegacyStickerCardPreview design={design} className={className} />;
  const type = cardType(design.type);
  const fullArt = design.layout === 'full_art';
  const modern = design.layout === 'modern';
  // Reserve enough room for two detailed moves and long identities.
  const compact = String(design.name || '').length > 16 || (design.attacks || []).some((move) => String(move.name || '').length > 16 || String(move.text || '').length > 65);
  const border = { yellow: '#e8c657', silver: '#c8ced1', gold: '#bd9653', black: '#24302e', white: '#f4f0e6' }[design.border_color] || '#e8c657';
  return (
    <div className={`relative w-full select-none ${className}`} style={{ containerType: 'inline-size', aspectRatio: '2.5 / 3.5' }}>
      <div className="absolute inset-0 overflow-hidden" style={{ background: border, borderRadius: '4cqw', padding: '3cqw', boxShadow: 'inset 0 0 0 0.45cqw #fff5, 0 1cqw 3cqw #0003', fontFamily: "'Montserrat', system-ui, sans-serif" }}>
        <div className="relative w-full h-full overflow-hidden flex flex-col" style={{ borderRadius: '1.7cqw', border: '0.4cqw solid #252f294d', background: modern ? '#f6f2e8' : `linear-gradient(140deg, #fff5, #fff0), ${type.color}` }}>
          {fullArt ? (
            <>
              <StickerPhoto design={design} className="absolute inset-0 w-full h-full" style={{ background: type.accent }} />
              <div className="relative" style={{ padding: '3cqw', background: 'linear-gradient(#101c22d9, #101c2222)' }}><CardIdentity design={design} light /></div>
              <div className="relative mt-auto" style={{ padding: '2cqw 3cqw 3cqw', background: 'linear-gradient(#101c2266, #101c22f5 25%)' }}>
                <MovePanel design={design} onDark />
                <div style={{ marginTop: '2cqw', marginBottom: '1.8cqw' }}><StatsBar design={design} /></div>
                <Footer design={design} onLight={false} />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col" style={{ padding: '2.8cqw', gap: '1.8cqw', backgroundImage: modern ? undefined : 'repeating-linear-gradient(30deg, transparent 0 1.4cqw, #fff08 1.4cqw 1.6cqw)' }}>
              {modern && <div className="absolute inset-x-0 top-0" style={{ height: '1.2cqw', background: type.accent }} />}
              <CardIdentity design={design} />
              <div className="relative w-full overflow-hidden shrink-0" style={{ aspectRatio: compact ? '2.25 / 1' : modern ? '1.6 / 1' : '1.65 / 1', border: modern ? `0.8cqw solid ${type.accent}` : '1cqw solid #f1e6c8', borderRadius: modern ? '3cqw' : '0.5cqw', boxShadow: '0 0 0 0.25cqw #69563488, 0 0.8cqw 1.5cqw #0002', background: type.color }}>
                <StickerPhoto design={design} className="absolute inset-0 w-full h-full" />
              </div>
              <InfoBar design={design} />
              <div className="flex-1 flex flex-col min-h-0" style={{ background: modern ? '#fff' : '#f6ecd9c9', border: '0.25cqw solid #84735855', borderRadius: modern ? '2cqw' : '0.6cqw', padding: '0 1cqw' }}><MovePanel design={design} compact={compact} /></div>
              <StatsBar design={design} />
              <Footer design={design} onLight />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
