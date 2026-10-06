import { useId } from 'react';
import { DEFAULT_PALETTE, mixHex } from './illustratedGeckoPresets';

// Fixed anatomical anchors: pigment grows across the same specimen at every slider value.
const BODY = 'M154,108C188,85 238,91 276,108C318,118 353,127 378,151C405,178 429,199 463,221C488,237 518,235 527,214C533,201 526,193 518,197C514,200 514,207 520,210C508,205 513,188 525,190C544,193 544,220 530,235C504,263 466,247 442,229C411,208 391,193 371,188C344,211 313,211 281,205C241,207 198,197 176,177C159,157 144,132 154,108Z';
const HEAD = 'M62,139C58,132 66,125 78,116L101,90C119,73 145,76 163,92L191,116C196,134 187,158 171,170C154,180 132,174 109,163L79,152Q65,149 62,139Z';
const DORSAL = 'M155,104C196,83 238,89 278,107C322,117 352,125 379,150';
const INNER_CREST = 'M160,113C204,102 240,105 280,120C313,127 345,137 368,155';
function crestPoint(t, row) {
  const segments = row
    ? [[[160,113],[204,102],[240,105],[280,120]], [[280,120],[313,127],[345,137],[368,155]]]
    : [[[154,108],[188,85],[238,91],[276,108]], [[276,108],[318,118],[353,127],[378,151]]];
  const n = Math.min(1, Math.floor(t * 2)); const u = t * 2 - n; const v = 1 - u;
  const points = segments[n];
  return [0, 1].map(axis => v*v*v*points[0][axis] + 3*v*v*u*points[1][axis] + 3*v*u*u*points[2][axis] + u*u*u*points[3][axis]);
}
const LIMBS = [
  { key: 'far-front', path: 'M198,127C220,126 231,146 226,164L218,193L243,201L240,211L204,205Q191,199 196,183L204,159L186,144Z', foot: [242,207], angle: 8, far: true },
  { key: 'far-back', path: 'M329,145C355,138 382,156 389,177L403,202L428,207L424,217L393,213Q382,211 374,193L356,174L326,174Z', foot: [426,212], angle: 12, far: true },
  { key: 'front', path: 'M178,153C193,151 202,165 193,177L172,205Q168,216 155,221L129,229L124,219L145,209L160,177L161,162Z', foot: [125,226], angle: 165 },
  { key: 'back', path: 'M323,176C335,162 358,169 369,187L377,211Q380,224 363,233L340,247L325,247L328,236L350,220L343,203L317,196Z', foot: [328,244], angle: 165 },
];
const CREAM_PATCHES = Array.from({ length: 22 }, (_, i) => ({ x: 184 + i % 8 * 23 + Math.sin(i * 7) * 7, y: 143 + Math.floor(i / 8) * 21, rx: 12 + i % 3 * 3, ry: 15 + i % 4 * 3, threshold: i % 8 * 0.075 }));
const SPOTS = Array.from({ length: 150 }, (_, i) => ({ x: 88 + ((i * 67.713) % 348), y: 94 + ((i * 37.731) % 132), r: 1.2 + i % 7 * 0.45 }));
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function island(x, y, rx, ry, seed) {
  return Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; const r = 0.8 + Math.sin(i * 11.13 + seed * 3.7) * 0.14 + Math.sin(i * 5.71 + seed) * 0.13; return `${i ? 'L' : 'M'}${(x + Math.cos(a) * rx * r).toFixed(2)},${(y + Math.sin(a) * ry * r).toFixed(2)}`; }).join('') + 'Z';
}
function foot(leg, color, outline) {
  return <g key={`${leg.key}-digits`} transform={`translate(${leg.foot.join(' ')}) rotate(${leg.angle})`}>
    {[-65, -30, 0, 30, 65].map((angle, i) => <g key={angle} transform={`rotate(${angle})`}><path d={`M-2,0Q6,-3 ${[12,18,21,18,13][i]},0`} stroke={outline} strokeWidth="3.2" strokeLinecap="round" fill="none" /><path d={`M-2,0Q6,-3 ${[12,18,21,18,13][i]},0`} stroke={color} strokeWidth="2.3" strokeLinecap="round" fill="none" /><ellipse cx={[12,18,21,18,13][i]} rx="3.3" ry="2.4" fill={color} stroke={outline} strokeWidth="0.65" /><path d={`M${[12,18,21,18,13][i]-1},-1.6v3.2m1,-3.2v3.2m1,-3.2v3.2`} stroke={outline} strokeWidth="0.3" opacity="0.5" /></g>)}
  </g>;
}

export default function ObliqueGecko({ phenotype: p, className, size, label, decorative, focus }) {
  const id = `og${useId().replace(/[^a-z0-9]/gi, '')}`;
  const pal = { ...DEFAULT_PALETTE, ...p.palette };
  const outline = mixHex(pal.base, pal.outline, 0.65);
  const dorsal = p.dorsalStyle === 'solid' ? pal.dorsal || pal.pattern : pal.pattern;
  const pin = p.phantom ? mixHex(pal.base, pal.pattern, 0.2) : pal.pattern;
  const crest = mixHex(pal.base, pal.pattern, 0.28);
  const limbs = <>{LIMBS.map(leg => <path key={leg.key} d={leg.path} />)}</>;
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 300" className={className} style={size ? { width: size, height: size * 300 / 580 } : undefined} role={decorative ? undefined : 'img'} aria-hidden={decorative ? 'true' : undefined} aria-label={decorative ? undefined : label}>
    <defs>
      <clipPath id={`${id}-clip`}><path d={BODY} /><path d={HEAD} />{limbs}</clipPath>
      <linearGradient id={`${id}-body`} x1="0" x2="0" y1="0" y2="1"><stop stopColor={mixHex(pal.base, '#fff4d4', .22)} /><stop offset=".4" stopColor={pal.base} /><stop offset="1" stopColor={mixHex(pal.base, pal.dark, .45)} /></linearGradient>
      <linearGradient id={`${id}-relief`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#fff7df" stopOpacity=".22" /><stop offset=".55" stopColor="#fff7df" stopOpacity="0" /><stop offset="1" stopColor={pal.dark} stopOpacity=".46" /></linearGradient>
      <radialGradient id={`${id}-iris`} cx=".35" cy=".3"><stop stopColor={mixHex(pal.eye, '#fff4cc', .35)} /><stop offset="1" stopColor={mixHex(pal.eye, pal.dark, .5)} /></radialGradient>
      <pattern id={`${id}-scales`} width="5" height="4.3" patternUnits="userSpaceOnUse"><path d="M1,.8l1.4,.6v1.4l-1.4,.6l-1.4,-.6V1.4ZM3.6,3l1.2,.5v1.2l-1.2,.5l-1.2,-.5V3.5Z" fill="none" stroke={pal.dark} strokeWidth=".32" opacity=".25" /><circle cx="1" cy="1.2" r=".35" fill="#fff4dc" opacity=".3" /></pattern>
    </defs>
    <ellipse cx="298" cy="257" rx="205" ry="7" fill="#273c2c" opacity=".065" />
    {LIMBS.filter(l => l.far).map(leg => <g key={leg.key} opacity=".78"><path d={leg.path} fill={mixHex(pal.base, pal.dark, .25)} stroke={outline} strokeWidth="1.2" />{foot(leg, mixHex(pal.base, pal.dark, .2), outline)}</g>)}
    <path d={BODY} fill={`url(#${id}-body)`} stroke={outline} strokeWidth="1.2" />
    <path d={HEAD} fill={`url(#${id}-body)`} stroke={outline} strokeWidth="1.2" />
    {LIMBS.filter(l => !l.far).map(leg => <g key={leg.key}><path d={leg.path} fill={`url(#${id}-body)`} stroke={outline} strokeWidth="1.1" />{foot(leg, pal.base, outline)}</g>)}
    <g clipPath={`url(#${id}-clip)`}>
      <path d={DORSAL} stroke={dorsal} strokeWidth={2 + p.dorsal * (p.dorsalStyle === 'solid' ? 28 : 25)} opacity={p.dorsal} fill="none" />
      <path d="M83,120C106,104 112,89 133,91L159,103L175,121L165,132L143,124L122,125L107,137Z" fill={dorsal} opacity={p.dorsal * .88} />
      {Array.from({ length: 16 }, (_, i) => <path key={`d${i}`} d={island(166 + i * 13, 114 + Math.pow(i / 15, 1.8) * 38, 8, 6 + p.flameTongues * 8, i)} fill={dorsal} opacity={p.dorsal * p.flameTongues} />)}
      {CREAM_PATCHES.map((patch, i) => { const g = smooth(patch.threshold, patch.threshold + .28, p.lateral); return <path key={`c${i}`} d={island(patch.x, patch.y, patch.rx * (.12 + .7 * g + .7 * smooth(.65, 1, p.lateral)), patch.ry * (.12 + .7 * g + .7 * smooth(.65, 1, p.lateral)), i)} fill={pal.pattern} opacity={g} />; })}
      {LIMBS.filter(l => !l.far).flatMap((leg, j) => [0, 1, 2].map(i => <path key={`${leg.key}-cream${i}`} d={island(j ? 336 + i * 8 : 172 - i * 8, j ? 195 + i * 15 : 181 + i * 13, 7 + p.lateral * 5, 7 + p.lateral * 5, i + 20)} fill={pal.pattern} opacity={smooth(.22, .75, p.lateral)} />))}
      {CREAM_PATCHES.slice(4, 15).map((patch, i) => <path key={`tri${i}`} d={island(patch.x + 5, patch.y + 7, patch.rx * .5, patch.ry * .5, i + 40)} fill={pal.accent} opacity={p.tricolor} />)}
      {Array.from({ length: 12 }, (_, i) => <path key={`tiger${i}`} d={`M${173 + i * 17},100Q${193 + i * 16},143 ${176 + i * 16},210`} fill="none" stroke={pal.dark} strokeWidth={p.brindle ? 3 : 7} opacity={p.tiger * .8} strokeDasharray={p.brindle ? '13 12 7 16' : undefined} />)}
      {CREAM_PATCHES.map((patch, i) => <path key={`lw${i}`} d={island(patch.x, patch.y + 17, patch.rx * (0.1 + p.lillyWhite * 1.4), patch.ry * (0.1 + p.lillyWhite * 1.5), i + 60)} fill="#fbf9f1" opacity={smooth(i % 6 * .08, i % 6 * .08 + .3, p.lillyWhite)} />)}
      <path d="M63,145Q103,165 151,174" stroke="#fbf9f1" strokeWidth="5" fill="none" opacity={p.lillyWhite} />
      {SPOTS.map((spot, i) => <path key={`spot${i}`} d={island(spot.x, spot.y, spot.r, spot.r * .9, i + 90)} fill={i % 10 / 10 < p.redSpots ? pal.redSpot : pal.spot} opacity={smooth(i, i + 1, p.dalmatian)} />)}
      <rect width="580" height="300" fill={`url(#${id}-scales)`} />
      <path d={BODY} fill={`url(#${id}-relief)`} /><path d={HEAD} fill={`url(#${id}-relief)`} />
      <path d="M175,162Q203,187 227,185M309,190Q336,190 347,203" fill="none" stroke={pal.dark} strokeWidth=".8" opacity=".4" />
    </g>
    <path d={DORSAL} stroke={crest} strokeWidth="2.2" fill="none" /><path d={INNER_CREST} stroke={crest} strokeWidth="1.5" fill="none" opacity=".85" />
    {[0, 1].map(row => <g key={row}>{Array.from({ length: 36 }, (_, i) => {
      const [x, y] = crestPoint(i / 36, row); const [nx, ny] = crestPoint((i + 1) / 36, row);
      const threshold = (Math.sin(i * 23.9 + row * 37) * 4382 % 1 + 1) % 1 * .82;
      const growth = smooth(threshold, threshold + .16, p.pinstripe);
      return <g key={i}><path d={`M${x},${y}L${nx},${ny}`} stroke={pin} strokeWidth={row ? 2 : 3} strokeLinecap="round" opacity={growth} /><path d={`M${x},${y+1}L${x+1.2},${y-(row ? 2.2 : 4)-i%3*.5}L${nx},${ny+1}`} fill={mixHex(crest, pin, growth)} stroke={outline} strokeWidth=".45" /></g>;
    })}</g>)}
    <path d="M90,105Q98,81 124,81Q145,81 163,99" fill="none" stroke={crest} strokeWidth="4" />
    {Array.from({ length: 14 }, (_, i) => {const x = 91+i*5.1; const y = 83 + Math.pow((i-6)/7, 2)*15; return <path key={`lash${i}`} d={`M${x},${y+4}L${x+1},${y-5-i%3}L${x+5},${y+4}`} fill={crest} stroke={outline} strokeWidth=".6" />;})}
    <ellipse cx="120" cy="109" rx="18.5" ry="20" fill={outline} />
    <ellipse cx="120" cy="108" rx="17" ry="18.7" fill={`url(#${id}-iris)`} />
    {Array.from({length: 36}, (_, i) => {const a=i*Math.PI/18;return <path key={`iris${i}`} d={`M${120+Math.cos(a)*6},${108+Math.sin(a)*7}L${120+Math.cos(a)*15.7},${108+Math.sin(a)*17}`} stroke={pal.dark} strokeWidth=".55" opacity=".55" />;})}
    <path d="M120,92Q123,98 121,102Q125,108 121,114Q123,119 120,125Q117,119 118,113Q114,107 118,102Q117,97 120,92Z" fill={p.albino ? '#752b38' : '#1e2015'} />
    <ellipse cx="114" cy="101" rx="2.4" ry="3.3" fill="#fff8df" opacity=".6" />
    <path d="M64,143Q99,149 130,159Q150,168 163,158" fill="none" stroke={outline} strokeWidth="1.1" />
    {[0,1,2,3,4,5,6,7].map(i => <path key={`lip${i}`} d={`M${75+i*9},${146+i*1.8}l0,3`} stroke={outline} strokeWidth=".55" opacity=".6" />)}
    <ellipse cx="77" cy="129" rx="2.1" ry="1.4" fill={outline} />
    {focus && <g fill="none" stroke="#62b99e" strokeWidth="2" strokeDasharray="4 4" opacity=".7">{focus === 'eyes' ? <ellipse cx="120" cy="108" rx="26" ry="28" /> : focus === 'back' ? <path d={DORSAL} /> : <ellipse cx="269" cy="163" rx="97" ry="38" />}</g>}
  </svg>;
}
