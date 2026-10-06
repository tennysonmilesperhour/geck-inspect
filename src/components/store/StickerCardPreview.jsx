import { Leaf, Flame, Droplet, Zap, Eye, Hand, Moon, Cog, Sparkles, Gem, Star } from 'lucide-react';
import StickerPhoto from './StickerPhoto';
import LegacyStickerCardPreview from './LegacyStickerCardPreview';
import StickerCardPreviewV2 from './StickerCardPreviewV2';
import { cardType, CARD_STAGES, RARITY_MAP, stageEvolves } from '@/lib/store/customSticker';

const ICONS = { leaf: Leaf, flame: Flame, droplet: Droplet, zap: Zap, eye: Eye, fist: Hand, moon: Moon, cog: Cog, sparkles: Sparkles, gem: Gem, star: Star };

function Energy({ type, size = 4.4 }) {
  const t = cardType(type); const Icon = ICONS[t.glyph] || Star;
  return <span title={t.label} className="inline-flex items-center justify-center shrink-0" style={{ width: `${size}cqw`, height: `${size}cqw`, borderRadius: '50%', background: t.color, border: '0.22cqw solid #292c27', boxShadow: 'inset 0.3cqw 0.4cqw 0 #ffffff60' }}><Icon color="#17231b" strokeWidth={2.7} style={{ width: '66%', height: '66%' }} /></span>;
}
function Cost({ count, type, size = 4.4 }) {
  return <span className="inline-flex flex-wrap" style={{ gap: '0.65cqw' }}>{Array.from({ length: Math.max(0, Math.min(4, Number(count) || 0)) }, (_, i) => <Energy key={i} type={type} size={size} />)}</span>;
}
function Moves({ design, modern }) {
  const moves = (design.attacks || []).filter(a => String(a.name || '').trim()).slice(0, 2);
  const compact = moves.some(a => a.name.length > 18 || (a.text || '').length > 60);
  return <div className="h-full flex flex-col justify-evenly" style={{ padding: modern ? '1.8cqw 2.3cqw' : '1cqw 0', gap: '1.5cqw' }}>
    {moves.length ? moves.map((move, i) => <div key={i} style={{ borderTop: i ? '0.18cqw solid #363d323d' : undefined, paddingTop: i ? '1.8cqw' : 0 }}>
      <div className="flex items-center" style={{ gap: '1.5cqw' }}>
        <div className="shrink-0" style={{ width: '21%' }}><Cost count={move.cost} type={move.cost_type || design.type} size={compact ? 3.6 : 4.2} /></div>
        <div className="flex-1 min-w-0 font-bold" style={{ fontSize: compact ? '4cqw' : '4.8cqw', lineHeight: 1.05, overflowWrap: 'anywhere' }}>{move.name}</div>
        <span className="font-bold shrink-0" style={{ fontSize: '5.7cqw' }}>{move.damage}</span>
      </div>
      {move.text && <p style={{ fontSize: compact ? '2.65cqw' : '2.9cqw', lineHeight: 1.2, margin: '1.2cqw 0 0', overflowWrap: 'anywhere' }}>{move.text}</p>}
    </div>) : <p style={{ fontSize: '3cqw', textAlign: 'center' }}>Add your gecko’s signature moves</p>}
  </div>;
}
function Matchups({ design }) {
  return <div className="grid grid-cols-3 text-center" style={{ borderTop: '0.35cqw solid #39452e', paddingTop: '1cqw', fontSize: '2.45cqw', lineHeight: 1.1 }}>
    <div>weakness<div className="flex items-center justify-center" style={{ gap: '1cqw', marginTop: '0.7cqw' }}>{design.weakness_type ? <><Energy type={design.weakness_type} size={3.6} /><span>{design.weakness_multiplier}</span></> : '—'}</div></div>
    <div>resistance<div className="flex items-center justify-center" style={{ gap: '1cqw', marginTop: '0.7cqw' }}>{design.resistance_type ? <><Energy type={design.resistance_type} size={3.6} /><span>{design.resistance_amount}</span></> : '—'}</div></div>
    <div>retreat cost<div style={{ marginTop: '0.7cqw' }}><Cost count={design.retreat_cost} type="colorless" size={3.6} /></div></div>
  </div>;
}

/** Two print-ready original collector layouts, with versioned order previews. */
export default function StickerCardPreview({ design, className = '' }) {
  if (!design) return null;
  if (design.version === 1) return <LegacyStickerCardPreview design={design} className={className} />;
  if (design.version === 2) return <StickerCardPreviewV2 design={design} className={className} />;
  const modern = design.layout === 'full_art';
  const type = cardType(design.type);
  const name = design.name || 'Your gecko';
  const stage = CARD_STAGES.find(s => s.value === design.stage)?.label || 'Hatchling';
  const compact = name.length > 16 || (design.attacks || []).some(a => (a.name || '').length > 18 || (a.text || '').length > 60);
  const border = modern ? '#cbd0cc' : { yellow: '#f1d330', silver: '#cbd0cc', gold: '#cba651', white: '#ede8d9', black: '#2b302b' }[design.border_color] || '#f1d330';
  const rarity = (RARITY_MAP[design.rarity] || RARITY_MAP.common).symbol;
  return <div className={`relative w-full select-none ${className}`} style={{ containerType: 'inline-size', aspectRatio: '2.5 / 3.5' }}>
    <div className="absolute inset-0 overflow-hidden" style={{ background: border, borderRadius: '3.6cqw', padding: '3.4cqw', boxShadow: 'inset 0 0 0 0.4cqw #fff8, 0 0.8cqw 2cqw #0002', fontFamily: 'Arial, Helvetica, sans-serif', color: '#20261c' }}>
      <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: '0.8cqw', background: modern ? '#153b31' : `linear-gradient(125deg, #fcf4c8c9, #edf0bbbd 45%, #d4dc98d9), ${type.color}`, border: '0.25cqw solid #52634277' }}>
        {modern && <><svg aria-hidden="true" viewBox="0 0 100 140" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ zIndex: 1, pointerEvents: 'none' }}><path d="M1,15L1,5Q1,1 5,1L83,1L99,14L99,112M99,120L99,135Q99,139 95,139L17,139L1,126L1,25" fill="none" stroke="#e1efdc" strokeWidth="0.45" opacity="0.7" /><path d="M1,25L4,28L4,42M96,100L96,112L99,115" fill="none" stroke="#e1efdc" strokeWidth="0.6" opacity="0.6" /></svg><StickerPhoto design={design} className="absolute inset-0 w-full h-full" /><div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#092b32cc 0%,transparent 30%,transparent 40%,#0d242299 57%,#0d2422 100%)' }} /><div className="absolute inset-x-0 top-0" style={{ height: '1cqw', background: type.color }} /></>}
        <div className="absolute inset-0 flex flex-col" style={{ padding: '2.2cqw 3cqw', gap: '1.3cqw' }}>
          <div className="flex items-center justify-between" style={{ color: modern ? '#fff' : '#272d1e', fontSize: '2.6cqw', fontWeight: 700, letterSpacing: '0.06em', position: 'relative', zIndex: 2 }}><span style={{ borderBottom: `0.2cqw solid ${modern ? '#fff7' : '#778155'}`, paddingBottom: '0.4cqw' }}>{stage.toUpperCase()}</span><span style={{ fontWeight: 400, fontSize: '2.1cqw' }}>{stageEvolves(design.stage) && design.evolves_from ? `Lineage: ${design.evolves_from}` : 'GECK INSPECT · ORIGINAL SERIES'}</span></div>
          <div className="flex items-center justify-between" style={{ gap: '1.5cqw', color: modern ? '#fff' : '#161d10', minHeight: '10cqw' }}>
            <span className="font-bold min-w-0" style={{ fontSize: name.length > 16 ? '6.3cqw' : '8.6cqw', lineHeight: 0.98, letterSpacing: '-0.04em', overflowWrap: 'anywhere', textShadow: modern ? '0 0.5cqw 1cqw #0009' : undefined }}>{name}</span>
            <div className="flex items-center shrink-0" style={{ gap: '1.2cqw' }}><span style={{ fontSize: '6.5cqw', fontWeight: modern ? 800 : 500, color: modern ? '#fff' : '#ba2928', whiteSpace: 'nowrap' }}><small style={{ fontSize: '2.7cqw' }}>HP </small>{design.hp}</span><Energy type={design.type} size={6.7} /></div>
          </div>
          {!modern && <div className="relative shrink-0 overflow-hidden" style={{ height: compact ? '43cqw' : '49cqw', border: '1.25cqw solid #b6a351', boxShadow: 'inset 0 0 0 0.3cqw #625b30, 0 0 0 0.22cqw #514f2c', background: type.color }}><StickerPhoto design={design} className="absolute inset-0 w-full h-full" /></div>}
          {modern && <div className="flex-1 min-h-0" />}
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '2.4cqw', textAlign: 'center', lineHeight: 1.15, color: modern ? '#fff' : '#2b321b', background: modern ? '#173e37c9' : '#d8d59b', borderBottom: `0.25cqw solid ${modern ? '#a8c7ae' : '#8d9257'}`, padding: '0.8cqw 0.5cqw' }}>{[design.dex_number && `No. ${design.dex_number}`, design.height && `Length: ${design.height}`, design.weight && `Weight: ${design.weight}`, !design.height && !design.weight && `${design.species_name || 'Gecko'} · Collector specimen`].filter(Boolean).join(' · ')}</div>
          <div className={modern ? 'shrink-0' : 'flex-1 min-h-0'} style={{ background: modern ? '#ffffedee' : undefined, borderRadius: modern ? '1.3cqw' : 0, clipPath: modern ? 'polygon(0 0, 97% 0, 100% 8%, 100% 100%, 3% 100%, 0 92%)' : undefined, border: modern ? '0.25cqw solid #d7e3cd' : undefined }}><Moves design={design} modern={modern} /></div>
          <div style={{ color: modern ? '#f2f6e6' : '#20281b' }}><Matchups design={design} /></div>
          <div style={{ color: modern ? '#f2f6e6' : '#25311b', border: modern ? '0.2cqw solid #a4cbb477' : '0.3cqw solid #aaa55f', borderRadius: '0.4cqw', padding: '1cqw 1.5cqw', fontFamily: 'Georgia, serif', fontSize: '2.65cqw', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{design.morph_line || 'A small creature with a remarkable personality.'}</div>
          <div className="flex justify-between items-end shrink-0" style={{ color: modern ? '#e7efe1' : '#3b412b', fontSize: '2cqw', gap: '1cqw' }}><span className="min-w-0 truncate">{design.illustrator ? `Art by ${design.illustrator}` : '© Geck Inspect · Personal collection'}</span><span className="shrink-0">{design.set_code} {design.card_number || '1'}/{design.set_total || '150'} {rarity}</span></div>
        </div>
      </div>
    </div>
  </div>;
}
