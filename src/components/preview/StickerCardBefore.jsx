import StickerPhoto from '../store/StickerPhoto';
import LegacyStickerCardPreview from '../store/LegacyStickerCardPreview';
import StickerCardPreviewV2 from '../store/StickerCardPreviewV2';
import { cardType, CARD_STAGES, RARITY_MAP, stageEvolves } from '@/lib/store/customSticker';

const PAPERS = { grass: '#c5db8b', fire: '#efb07d', water: '#a8d2e7', lightning: '#f2df77', psychic: '#c7abd7', fighting: '#d5a570', darkness: '#aab9be', metal: '#c9cecb', fairy: '#e7b7cf', dragon: '#dfc17c', colorless: '#f7f4e8' };
// Solid silhouettes read like printed energy stamps, even at thumbnail size.
const ENERGY_SHAPES = {
  leaf: <><path d="M4 17C2 8 10 3 20 3c0 11-7 18-14 15L16 7 4 17Z" /><path d="m6 18-2 3" fill="none" stroke="currentColor" strokeWidth="2" /></>,
  flame: <path d="M12 2c2 5-2 7-1 10 3-1 4-4 4-6 7 7 6 15-3 16C3 22 0 14 6 8c-1 5 1 6 2 5-2-4 2-6 4-11Z" />,
  droplet: <path d="M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13Z" />,
  zap: <path d="M13 1 4 13h6L8 23 21 9h-7l3-8Z" />,
  eye: <><path d="M1 12Q12-1 23 12Q12 25 1 12Zm4 0q7 8 14 0-7-8-14 0Z" fillRule="evenodd" /><circle cx="12" cy="12" r="4" /></>,
  fist: <path d="M5 5h3V2h3v3h2V2h3v4h3v8l-5 7H7l-4-7V8h3v6h2V5Z" />,
  moon: <path d="M17 2a10 10 0 1 0 5 16C11 20 6 8 17 2Z" />,
  cog: <path d="m12 1 3 4 5-1-1 5 4 3-4 3 1 5-5-1-3 4-3-4-5 1 1-5-4-3 4-3-1-5 5 1 3-4Zm0 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fillRule="evenodd" />,
  sparkles: <path d="m12 1 3 7 8 4-8 4-3 7-3-7-8-4 8-4Z" />,
  gem: <path d="m6 3 12 0 5 7-11 13L1 10Zm-2 7h16L12 5 4 10Z" fillRule="evenodd" />,
  star: <path d="m12 1 2.8 6.1 6.7-.7L18 12l3.5 5.6-6.7-.7L12 23l-2.8-6.1-6.7.7L6 12 2.5 6.4l6.7.7Z" />,
};
function Energy({ type, size = 4.4 }) {
  const t = cardType(type);
  return <span title={t.label} className="inline-flex items-center justify-center shrink-0" style={{ width: `${size}cqw`, height: `${size}cqw`, borderRadius: '50%', background: `radial-gradient(circle at 35% 28%, #ffffffb0, transparent 52%), ${t.color}`, border: '0.18cqw solid #34362d', color: '#171a17' }}><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ width: '76%', height: '76%' }}>{ENERGY_SHAPES[t.glyph] || ENERGY_SHAPES.star}</svg></span>;
}
function Cost({ count, type, size = 4.4 }) {
  return <span className="inline-flex flex-wrap" style={{ gap: '0.5cqw' }}>{Array.from({ length: Math.max(0, Math.min(4, Number(count) || 0)) }, (_, i) => <Energy key={i} type={type} size={size} />)}</span>;
}
function Moves({ design, modern, compact }) {
  const moves = (design.attacks || []).filter(a => String(a.name || '').trim()).slice(0, 2);
  return <div className="h-full flex flex-col justify-evenly" style={{ gap: '2cqw' }}>
    {moves.length ? moves.map((move, i) => <div key={i} style={{ borderTop: !modern && i ? '0.2cqw solid #332e2350' : undefined, paddingTop: !modern && i ? '2cqw' : 0 }}>
      <div className="flex items-center" style={{ gap: '1.4cqw' }}>
        <div className="shrink-0" style={{ width: modern ? 'auto' : '22%', maxWidth: '25%' }}><Cost count={move.cost} type={move.cost_type || design.type} size={compact ? 3.6 : 4.5} /></div>
        <div className="flex-1 min-w-0" style={{ fontWeight: 700, fontSize: compact ? '4.2cqw' : '5.3cqw', lineHeight: 1.05, overflowWrap: 'anywhere' }}>{move.name}</div>
        <span className="shrink-0" style={{ fontWeight: 500, fontSize: compact ? '5.5cqw' : '6.8cqw' }}>{move.damage}</span>
      </div>
      {move.text && <p style={{ fontSize: compact ? '2.8cqw' : '3.2cqw', lineHeight: 1.15, margin: '1.2cqw 0 0', overflowWrap: 'anywhere' }}>{move.text}</p>}
    </div>) : <p style={{ fontSize: '3cqw', textAlign: 'center' }}>Add your gecko’s signature moves</p>}
  </div>;
}
function Matchups({ design, modern }) {
  const cell = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7cqw' };
  return <div className="grid grid-cols-3 text-center" style={{ borderTop: modern ? undefined : '0.3cqw solid #383729', padding: '1cqw 0', fontSize: modern ? '2.25cqw' : '2.65cqw', lineHeight: 1.05, background: modern ? 'linear-gradient(#eceee8,#b9bfba)' : undefined, borderRadius: modern ? '0.5cqw' : 0 }}>
    <div style={modern ? cell : undefined}>weakness<div style={{ ...cell, marginTop: modern ? 0 : '0.7cqw' }}>{design.weakness_type ? <><Energy type={design.weakness_type} size={modern ? 3.2 : 4.1} /><span>{design.weakness_multiplier}</span></> : '—'}</div></div>
    <div style={modern ? cell : undefined}>resistance<div style={{ ...cell, marginTop: modern ? 0 : '0.7cqw' }}>{design.resistance_type ? <><Energy type={design.resistance_type} size={modern ? 3.2 : 4.1} /><span>{design.resistance_amount}</span></> : '—'}</div></div>
    <div style={modern ? cell : undefined}>retreat<div style={{ marginTop: modern ? 0 : '0.7cqw' }}><Cost count={design.retreat_cost} type="colorless" size={modern ? 3.2 : 4.1} /></div></div>
  </div>;
}

/** Flat printed collector frames. Earlier sold designs retain their versioned renderers. */
export default function StickerCardPreview({ design, className = '' }) {
  if (!design) return null;
  if (design.version === 1) return <LegacyStickerCardPreview design={design} className={className} />;
  if (design.version === 2) return <StickerCardPreviewV2 design={design} className={className} />;
  const modern = design.layout === 'full_art';
  const type = cardType(design.type);
  const name = design.name || 'Your gecko';
  const stage = CARD_STAGES.find(s => s.value === design.stage)?.label || 'Hatchling';
  const paper = PAPERS[design.type] || PAPERS.colorless;
  const compact = name.length > 16 || (design.attacks || []).some(a => (a.name || '').length > 18 || (a.text || '').length > 60);
  const border = modern ? '#bdc4c4' : { yellow: '#f1d432', silver: '#cbd0cc', gold: '#cba651', white: '#ede8d9', black: '#2b302b' }[design.border_color] || '#f1d432';
  const rarity = (RARITY_MAP[design.rarity] || RARITY_MAP.common).symbol;
  const evolves = stageEvolves(design.stage) && design.evolves_from;
  const info = [design.dex_number && `No. ${design.dex_number}`, design.species_name || 'Crested gecko', design.height && `Length: ${design.height}`, design.weight && `Weight: ${design.weight}`].filter(Boolean).join(' · ');
  return <div className={`relative w-full select-none ${className}`} style={{ containerType: 'inline-size', aspectRatio: '2.5 / 3.5' }}>
    <div className="absolute inset-0 overflow-hidden" style={{ background: modern ? 'linear-gradient(130deg,#e7e9e4,#a9b0b0 45%,#d5d9d5)' : border, borderRadius: '3.5cqw', padding: modern ? '2.5cqw' : '3.4cqw', boxShadow: 'inset 0 0 0 0.35cqw #fff8, 0 0.8cqw 2cqw #0002', fontFamily: 'Arial, Helvetica, sans-serif', color: '#171b15' }}>
      <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: '0.8cqw', background: paper, border: '0.25cqw solid #4b4a3d66' }}>
        {modern ? <><StickerPhoto design={design} className="absolute inset-0 w-full h-full" style={{ top: '5cqw', height: 'calc(100% - 5cqw)' }} /><div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#091e2c28 0%,transparent 35%,#061e27aa 68%,#071b25ee 100%)' }} /><div className="absolute inset-0 pointer-events-none" style={{ border: '0.4cqw solid #e5eae7aa', borderRadius: '0.6cqw' }} /></> : <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at 20% 10%,#fff3 0%,transparent 35%),radial-gradient(ellipse at 70% 80%,#9e792818,transparent 45%)' }} />}
        <div className="absolute inset-0 flex flex-col" style={{ padding: modern ? '0 2.2cqw 1.6cqw' : '1.8cqw 3.8cqw 1.8cqw', gap: modern ? '1.4cqw' : '1cqw' }}>
          {modern ? <div style={{ margin: '0 -2.2cqw', padding: '1.3cqw 2.3cqw 1.6cqw', background: `linear-gradient(165deg,#fffff5 0%,#d5ddd4 45%,${paper} 100%)`, borderBottom: '0.4cqw solid #8c9c96', clipPath: 'polygon(0 0,100% 0,100% 100%,8% 100%,0 82%)' }}>
            <div className="flex items-center justify-between" style={{ gap: '1.4cqw' }}>
              <span style={{ fontSize: '2.35cqw', fontWeight: 800, padding: '.3cqw 1cqw', borderRadius: '1cqw', background: '#f5f6f1', border: '.2cqw solid #838f85', whiteSpace: 'nowrap' }}>{stage.toUpperCase()}</span>
              <span className="flex-1 min-w-0 font-bold" style={{ fontFamily: 'Arial, sans-serif', fontStyle: 'italic', fontSize: name.length > 16 ? '5.4cqw' : '7.1cqw', letterSpacing: '-.04em', lineHeight: 1, overflowWrap: 'anywhere' }}>{name}<span style={{ fontSize: '4cqw', color: type.accent, marginLeft: '.7cqw', letterSpacing: '-.09em' }}>GI</span></span>
              <span className="shrink-0" style={{ fontSize: '7.2cqw', fontWeight: 800, whiteSpace: 'nowrap' }}><small style={{ fontSize: '2.6cqw', marginRight: '.3cqw' }}>HP</small>{design.hp}</span><Energy type={design.type} size={6.8} />
            </div>
            {evolves && <p style={{ fontSize: '2.1cqw', margin: '.8cqw 0 0 12cqw' }}>Lineage: {design.evolves_from}</p>}
          </div> : <>
            <div className="flex justify-between" style={{ fontSize: '2.7cqw', lineHeight: 1 }}><span>{stage}</span><span style={{ fontSize: '2.1cqw' }}>{evolves ? `Lineage: ${design.evolves_from}` : 'Geck Inspect'}</span></div>
            <div className="flex items-center justify-between" style={{ minHeight: '8.7cqw', gap: '1.2cqw' }}><span className="font-bold min-w-0" style={{ fontSize: name.length > 16 ? '6.2cqw' : '8cqw', lineHeight: .98, letterSpacing: '-.025em', overflowWrap: 'anywhere' }}>{name}</span><div className="flex items-center shrink-0" style={{ gap: '1.6cqw' }}><span style={{ fontSize: '6.3cqw', color: '#ba2425', whiteSpace: 'nowrap' }}>{design.hp} HP</span><Energy type={design.type} size={6.7} /></div></div>
            <div className="relative shrink-0 overflow-hidden" style={{ height: compact ? '44cqw' : '51cqw', border: '1.1cqw solid #b49c55', boxShadow: '0.35cqw 0.5cqw 0.4cqw #4b412766, inset 0 0 0 .25cqw #62552d', background: type.color }}><StickerPhoto design={design} className="absolute inset-0 w-full h-full" /></div>
          </>}
          {modern && <div className="flex-1 min-h-0" />}
          {!modern && <div style={{ fontSize: '2.55cqw', textAlign: 'center', lineHeight: 1.1, background: 'linear-gradient(90deg,#af94592b,#e8d3a85e,#af94592b)', borderBottom: '.2cqw solid #927b45', padding: '.65cqw .3cqw' }}>{info}</div>}
          <div className={modern ? 'shrink-0' : 'flex-1 min-h-0'} style={{ padding: modern ? '2cqw .9cqw' : '1.2cqw 0', color: modern ? '#fffdf4' : undefined, textShadow: modern ? '-.18cqw -.18cqw 0 #10232d,.18cqw -.18cqw 0 #10232d,-.18cqw .18cqw 0 #10232d,.18cqw .18cqw 0 #10232d,0 .25cqw .4cqw #000' : undefined }}><Moves design={design} modern={modern} compact={compact} /></div>
          <Matchups design={design} modern={modern} />
          <div style={{ border: modern ? '.25cqw solid #b4bfbc' : '.3cqw solid #9a8348', borderRadius: modern ? '0.6cqw' : 0, padding: modern ? '1.2cqw 1.7cqw' : '1cqw 1.5cqw', fontSize: compact ? '2.5cqw' : '2.8cqw', lineHeight: 1.12, background: modern ? 'linear-gradient(170deg,#f5f6ec,#cbd3cc)' : undefined, overflowWrap: 'anywhere' }}>{modern && <span style={{ display: 'block', fontWeight: 800, fontSize: '2.5cqw', marginBottom: '.5cqw' }}>Geck Inspect collector series</span>}{design.morph_line || 'A small creature with a remarkable personality.'}</div>
          <div className="flex justify-between items-end shrink-0" style={{ color: modern ? '#fffdf1' : '#342f20', fontSize: '2.1cqw', gap: '1cqw' }}><div className="min-w-0"><div className="truncate">{design.illustrator ? `Illus. ${design.illustrator}` : '© Geck Inspect'}</div>{modern && <div style={{ fontSize: '1.7cqw', marginTop: '.35cqw' }}>{design.dex_number ? `No. ${design.dex_number} · ` : ''}{design.species_name || 'Crested gecko'}</div>}</div><span className="shrink-0">{design.set_code} {design.card_number || '1'}/{design.set_total || '150'} <span style={{ marginLeft: '1cqw', fontSize: '3cqw' }}>{rarity}</span></span></div>
        </div>
      </div>
    </div>
  </div>;
}
