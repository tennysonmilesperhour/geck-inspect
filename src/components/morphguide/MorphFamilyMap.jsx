import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Moon, Network } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';
import { MORPHS, MORPH_CATEGORIES } from '@/data/morph-guide';

/**
 * Morph family map: every morph in the guide as a dot, joined to the
 * morphs it is often bred with (solid lines, from `combinesWith`) and the
 * ones it is often mistaken for (dashed lines, from `lookalikes`).
 *
 * The layout is computed once when the module loads, with a small seeded
 * force simulation (no extra library): morphs are pulled toward a spot for
 * their category, pushed apart from each other, and joined by springs, so
 * the picture is the same on every visit and every device.
 */

const W = 920;
const H = 660;
const NODE_R = 20;
const PAD = 54;

export const CATEGORY_COLORS = {
  pattern: '#f59e0b',
  base: '#fb7185',
  color: '#a5b4fc',
  structure: '#34d399',
  combo: '#e879f9',
};

/** The Albino + Axanthic route to a true white gecko, told on three nodes. */
const STORY_EDGES = new Set(['albino|moonglow', 'axanthic|moonglow']);
const STORY_NOTES = {
  moonglow:
    'A true all-white Moonglow is now possible: Albino removes black pigment and Axanthic removes yellow and red. Nobody has produced one yet, so every Moonglow sold today is line-bred near-white.',
  albino:
    'Albino is half of the recipe for a true all-white Moonglow. Paired with Axanthic it should remove almost all pigment. That gecko has not been produced yet.',
  axanthic:
    'Axanthic is the other half of the true Moonglow recipe. Combined with the new Albino it should give an all-white gecko, which nobody has produced yet.',
};

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lookalikeSlug(l) {
  return typeof l === 'string' ? l : l?.slug;
}

/** Nodes, edges and neighbor lists built from the local MORPHS data. */
export function buildFamilyGraph(morphs = MORPHS) {
  const slugs = new Set(morphs.map((m) => m.slug));
  const edges = new Map();
  for (const m of morphs) {
    for (const other of m.combinesWith || []) {
      if (!slugs.has(other) || other === m.slug) continue;
      const k = pairKey(m.slug, other);
      edges.set(k, { key: k, a: m.slug, b: other, kind: 'combo' });
    }
  }
  for (const m of morphs) {
    for (const l of m.lookalikes || []) {
      const other = lookalikeSlug(l);
      if (!slugs.has(other) || other === m.slug) continue;
      const k = pairKey(m.slug, other);
      if (!edges.has(k)) edges.set(k, { key: k, a: m.slug, b: other, kind: 'lookalike' });
    }
  }
  const neighbors = new Map(morphs.map((m) => [m.slug, new Set()]));
  for (const e of edges.values()) {
    neighbors.get(e.a).add(e.b);
    neighbors.get(e.b).add(e.a);
  }
  return { edges: [...edges.values()], neighbors };
}

/** Seeded force layout. Returns Map slug -> {x, y} inside the W by H box. */
export function layoutFamilyGraph(morphs = MORPHS, edges = buildFamilyGraph(morphs).edges) {
  const rand = mulberry32(20261006);
  const cats = MORPH_CATEGORIES.map((c) => c.id);
  const cx = W / 2;
  const cy = H / 2;
  const anchors = {};
  cats.forEach((id, i) => {
    const ang = -Math.PI / 2 + (i / cats.length) * Math.PI * 2;
    anchors[id] = { x: cx + Math.cos(ang) * 250, y: cy + Math.sin(ang) * 200 };
  });
  const nodes = morphs.map((m) => {
    const a = anchors[m.category] || { x: cx, y: cy };
    return { slug: m.slug, cat: m.category, x: a.x + (rand() - 0.5) * 120, y: a.y + (rand() - 0.5) * 120, vx: 0, vy: 0 };
  });
  const idx = new Map(nodes.map((n, i) => [n.slug, i]));
  const springs = edges.map((e) => [idx.get(e.a), idx.get(e.b), e.kind === 'combo' ? 0.006 : 0.01]);

  for (let iter = 0; iter < 500; iter++) {
    const cool = 1 - iter / 500;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const f = 5200 / d2;
        const d = Math.sqrt(d2);
        nodes[i].vx -= (dx / d) * f;
        nodes[i].vy -= (dy / d) * f;
        nodes[j].vx += (dx / d) * f;
        nodes[j].vy += (dy / d) * f;
      }
    }
    for (const [i, j, k] of springs) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 120) * k;
      nodes[i].vx += (dx / d) * f;
      nodes[i].vy += (dy / d) * f;
      nodes[j].vx -= (dx / d) * f;
      nodes[j].vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      const a = anchors[n.cat] || { x: cx, y: cy };
      n.vx += (a.x - n.x) * 0.035;
      n.vy += (a.y - n.y) * 0.035;
      n.x += Math.max(-12, Math.min(12, n.vx)) * cool;
      n.y += Math.max(-12, Math.min(12, n.vy)) * cool;
      n.vx *= 0.5;
      n.vy *= 0.5;
    }
  }

  // Fit into the box, then nudge apart anything still close enough for
  // two labels to touch.
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (const n of nodes) {
    n.x = PAD + ((n.x - minX) / (maxX - minX || 1)) * (W - PAD * 2);
    n.y = PAD - 6 + ((n.y - minY) / (maxY - minY || 1)) * (H - PAD * 2);
  }
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = (nodes[j].y - nodes[i].y) * 1.6; // labels are wide, not tall
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const min = 92;
        if (d >= min) continue;
        const push = (min - d) / 2;
        nodes[i].x -= (dx / d) * push;
        nodes[j].x += (dx / d) * push;
        nodes[i].y -= (dy / d) * push * 0.6;
        nodes[j].y += (dy / d) * push * 0.6;
      }
    }
    for (const n of nodes) {
      n.x = Math.max(PAD, Math.min(W - PAD, n.x));
      n.y = Math.max(PAD - 10, Math.min(H - PAD + 4, n.y));
    }
  }
  return new Map(nodes.map((n) => [n.slug, { x: n.x, y: n.y }]));
}

const GRAPH = buildFamilyGraph(MORPHS);
const POSITIONS = layoutFamilyGraph(MORPHS, GRAPH.edges);
const NAME_BY_SLUG = new Map(MORPHS.map((m) => [m.slug, m.name]));

function initials(name) {
  const words = String(name || '').replace(/\([^)]*\)/g, ' ').split(/[\s-]+/).filter((w) => /^[a-z]/i.test(w));
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function shortName(name) {
  return String(name || '').replace(/\s*\([^)]*\)/g, '');
}

function Chip({ slug, onSelect, dashed = false }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slug)}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        dashed
          ? 'border-dashed border-slate-500 text-slate-300 hover:border-sky-300 hover:text-sky-200'
          : 'border-slate-600 bg-slate-800/60 text-slate-200 hover:border-emerald-400 hover:text-emerald-200'
      }`}
    >
      {shortName(NAME_BY_SLUG.get(slug))}
    </button>
  );
}

function Panel({ morph, onSelect }) {
  if (!morph) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-300 leading-relaxed">
          Tap any morph to light up the morphs it is bred with and the ones it gets mistaken for.
        </p>
        <button
          type="button"
          onClick={() => onSelect('moonglow')}
          className="w-full text-left rounded-xl border border-rose-300/30 bg-gradient-to-r from-rose-950/50 to-slate-900/40 hover:border-rose-300/60 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-200">
            <Moon className="w-3.5 h-3.5" />
            The Moonglow story
          </span>
          <span className="block mt-1 text-sm text-slate-300 leading-snug">
            Albino (new in 2026) plus Axanthic could finally make an all-white crested gecko.
          </span>
        </button>
      </div>
    );
  }
  const combos = (morph.combinesWith || []).filter((s) => NAME_BY_SLUG.has(s) && s !== morph.slug);
  const looks = (morph.lookalikes || []).map(lookalikeSlug).filter((s) => NAME_BY_SLUG.has(s) && s !== morph.slug);
  const cat = MORPH_CATEGORIES.find((c) => c.id === morph.category);
  const story = STORY_NOTES[morph.slug];
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: CATEGORY_COLORS[morph.category] }}>
          <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[morph.category] }} />
          {cat?.label || 'Morph'}
        </div>
        <h3 className="mt-0.5 text-lg font-bold text-white leading-snug">{morph.name}</h3>
        <p className="mt-1 text-sm text-slate-300 leading-relaxed">{morph.definition || morph.summary}</p>
      </div>
      {story && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-950/30 p-2.5 text-sm text-rose-100 leading-snug">
          <Moon className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
          {story}
        </p>
      )}
      {combos.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Often combined with</div>
          <div className="flex flex-wrap gap-1.5">
            {combos.map((s) => <Chip key={s} slug={s} onSelect={onSelect} />)}
          </div>
        </div>
      )}
      {looks.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Often confused with</div>
          <div className="flex flex-wrap gap-1.5">
            {looks.map((s) => <Chip key={s} slug={s} onSelect={onSelect} dashed />)}
          </div>
        </div>
      )}
      <Link
        to={`/MorphGuide/${morph.slug}`}
        onClick={() => captureEvent('morph_guide_cta_clicked', { target: morph.slug, placement: 'family_map' })}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-3.5 h-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
      >
        Open {shortName(morph.name)}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export default function MorphFamilyMap({ morphs = MORPHS }) {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [failed, setFailed] = useState(() => new Set());
  const scrollRef = useRef(null);
  const panelRef = useRef(null);

  const bySlug = useMemo(() => new Map(morphs.map((m) => [m.slug, m])), [morphs]);
  const nodes = useMemo(
    () => MORPHS.map((m) => ({ ...(bySlug.get(m.slug) || m), pos: POSITIONS.get(m.slug) })),
    [bySlug],
  );

  const active = hovered || selected;
  const near = active ? GRAPH.neighbors.get(active) : null;

  // On a phone the canvas is wider than the screen, so bring the chosen
  // morph to the middle of the visible strip.
  const centerOn = useCallback((slug) => {
    const el = scrollRef.current;
    const pos = POSITIONS.get(slug);
    if (!el || !pos || el.scrollWidth <= el.clientWidth + 4) return;
    const x = (pos.x / W) * el.scrollWidth - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
  }, []);

  const select = useCallback(
    (slug) => {
      setSelected((cur) => (cur === slug ? null : slug));
      if (slug) {
        captureEvent('morph_family_map_node', { slug });
        centerOn(slug);
      }
    },
    [centerOn],
  );

  // Chips in the panel always select (never toggle off).
  const selectFromPanel = useCallback(
    (slug) => {
      setSelected(slug);
      captureEvent('morph_family_map_node', { slug });
      centerOn(slug);
    },
    [centerOn],
  );

  const onImgError = (slug) =>
    setFailed((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });

  // On a phone, open the strip on the Moonglow story rather than the left
  // edge, so the highlighted lines are the first thing in view.
  useEffect(() => {
    const el = scrollRef.current;
    const pos = POSITIONS.get('moonglow');
    if (!el || !pos || el.scrollWidth <= el.clientWidth + 4) return;
    el.scrollLeft = Math.max(0, (pos.x / W) * el.scrollWidth - el.clientWidth * 0.45);
  }, []);

  const selectedMorph = selected ? bySlug.get(selected) || MORPHS.find((m) => m.slug === selected) : null;
  const storyLit = !active || active === 'moonglow' || active === 'albino' || active === 'axanthic';

  return (
    <section aria-labelledby="morph-family-map-heading" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3 px-1">
        <div>
          <h2 id="morph-family-map-heading" className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
            <Network className="w-5 h-5 text-emerald-400" />
            Morph family map
          </h2>
          <p className="text-sm text-slate-400">How the {MORPHS.length} morphs connect. Tap one to see its circle.</p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke="#6ee7b7" strokeWidth="2" /></svg>
            solid line: often combined
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="4 3" /></svg>
            dashed: often confused
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative min-w-0 rounded-xl border border-slate-800 bg-slate-950/70">
          <div
            ref={scrollRef}
            className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block w-full min-w-[720px] h-auto select-none"
              role="group"
              aria-label="Morph family map"
            >
              <defs>
                <linearGradient id="fm-story" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fda4af" />
                  <stop offset="100%" stopColor="#f8fafc" />
                </linearGradient>
                <radialGradient id="fm-bg" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.07" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
                <filter id="fm-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {nodes.map((n) => (
                  <clipPath key={n.slug} id={`fm-clip-${n.slug}`}>
                    <circle cx={n.pos.x} cy={n.pos.y} r={NODE_R - 2} />
                  </clipPath>
                ))}
              </defs>
              <rect width={W} height={H} fill="url(#fm-bg)" onClick={() => setSelected(null)} />

              {/* edges */}
              <g>
                {GRAPH.edges.map((e) => {
                  const a = POSITIONS.get(e.a);
                  const b = POSITIONS.get(e.b);
                  const isStory = STORY_EDGES.has(e.key);
                  const touches = active && (e.a === active || e.b === active);
                  let opacity = active ? (touches ? 0.9 : 0.05) : 0.16;
                  if (isStory && storyLit) opacity = 0.95;
                  const stroke = isStory ? 'url(#fm-story)' : e.kind === 'combo' ? '#6ee7b7' : '#7dd3fc';
                  return (
                    <line
                      key={e.key}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={stroke}
                      strokeWidth={isStory ? 3.5 : touches ? 2 : 1.2}
                      strokeDasharray={e.kind === 'lookalike' ? '6 5' : undefined}
                      strokeLinecap="round"
                      opacity={opacity}
                      filter={isStory && storyLit ? 'url(#fm-glow)' : undefined}
                      style={{ transition: 'opacity 200ms, stroke-width 200ms' }}
                    />
                  );
                })}
              </g>

              {/* nodes */}
              {nodes.map((n) => {
                const { x, y } = n.pos;
                const color = CATEGORY_COLORS[n.category] || '#94a3b8';
                const isActive = n.slug === active;
                const isSel = n.slug === selected;
                const dim = active && !isActive && !near?.has(n.slug);
                const img = !failed.has(n.slug) ? n.heroImage : null;
                const label = shortName(n.name);
                return (
                  <g
                    key={n.slug}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.name}${isSel ? ', selected' : ''}`}
                    aria-pressed={isSel}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setHovered(null);
                      select(n.slug);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        select(n.slug);
                      }
                    }}
                    onMouseEnter={() => setHovered(n.slug)}
                    onFocus={() => setHovered(n.slug)}
                    onBlur={() => setHovered(null)}
                    className="cursor-pointer outline-none [&:focus-visible>circle.fm-ring]:stroke-white"
                    opacity={dim ? 0.28 : 1}
                    style={{ transition: 'opacity 200ms' }}
                  >
                    <circle cx={x} cy={y} r={NODE_R + 14} fill="transparent" />
                    {(isActive || isSel) && (
                      <circle cx={x} cy={y} r={NODE_R + 6} fill={color} opacity="0.22" />
                    )}
                    <circle cx={x} cy={y} r={NODE_R} fill="#0f172a" />
                    <circle cx={x} cy={y} r={NODE_R - 2} fill={color} opacity="0.32" />
                    <text
                      x={x}
                      y={y + 4.5}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="800"
                      fill="#f8fafc"
                      opacity="0.92"
                    >
                      {initials(n.name)}
                    </text>
                    {img && (
                      <image
                        href={img}
                        x={x - NODE_R}
                        y={y - NODE_R}
                        width={NODE_R * 2}
                        height={NODE_R * 2}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#fm-clip-${n.slug})`}
                        // React does fire error events on SVG <image>; the
                        // lint rule only knows the HTML elements.
                        // eslint-disable-next-line react/no-unknown-property
                        onError={() => onImgError(n.slug)}
                      />
                    )}
                    <circle
                      className="fm-ring"
                      cx={x}
                      cy={y}
                      r={NODE_R}
                      fill="none"
                      stroke={isActive || isSel ? '#ffffff' : color}
                      strokeWidth={isActive || isSel ? 2.5 : 1.8}
                    />
                    <text
                      x={x}
                      y={y + NODE_R + 15}
                      textAnchor="middle"
                      fontSize="12.5"
                      fontWeight={isActive ? 700 : 600}
                      fill={isActive ? '#ffffff' : '#cbd5e1'}
                      stroke="#020617"
                      strokeWidth="3.5"
                      paintOrder="stroke"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Moonglow story badge */}
              {(() => {
                const m = POSITIONS.get('moonglow');
                if (!m || !storyLit) return null;
                const bw = 124;
                // Under the Moonglow label, where the map is least crowded.
                const by = m.y + NODE_R + 21 > H - 24 ? m.y - NODE_R - 30 : m.y + NODE_R + 21;
                const bx = Math.max(6, Math.min(W - bw - 6, m.x - bw / 2 - 16));
                return (
                  <g pointerEvents="none">
                    <rect x={bx} y={by} width={bw} height="20" rx="10" fill="#4c0519" stroke="#fda4af" strokeOpacity="0.6" />
                    <text x={bx + bw / 2} y={by + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffe4e6">
                      Albino + Axanthic
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
          <div className="sm:hidden pointer-events-none absolute right-0 inset-y-0 w-8 rounded-r-xl bg-gradient-to-l from-slate-950/90 to-transparent" />
          <p className="sm:hidden px-3 pb-2 pt-1 text-xs text-slate-500">Swipe sideways to see the whole map.</p>
        </div>

        <aside
          ref={panelRef}
          aria-live="polite"
          className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 lg:self-start lg:sticky lg:top-20"
        >
          <Panel morph={selectedMorph} onSelect={selectFromPanel} />
        </aside>
      </div>
    </section>
  );
}
