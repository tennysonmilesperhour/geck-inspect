import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Gecko } from '@/entities/all';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  GitBranch,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { breederSlug, looksLikeBreederName } from '@/lib/breederUtils';

// ---------------------------------------------------------------------------
// Constants & layout math
// ---------------------------------------------------------------------------

const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

// 4 generations: self + 2 parents + 4 grandparents + 8 great-grandparents = 15 nodes max.
const GENERATIONS = 4;

const NODE_W = 180;
const NODE_H = 96;
const COL_GAP = 70;
// Total vertical space reserved for the deepest column. Every other column
// centers its slots inside this span, which keeps cards vertically aligned
// with their ancestors.
const BASE_ROW = 110;

function deepestRows() {
  return 2 ** (GENERATIONS - 1); // 8
}

function totalCanvasHeight() {
  return deepestRows() * BASE_ROW; // 880
}

function totalCanvasWidth() {
  return GENERATIONS * NODE_W + (GENERATIONS - 1) * COL_GAP + 80;
}

// Row slot position within the canvas. Each column has 2^col rows of slots
// evenly distributed across the canvas height.
function nodeXY(col, row) {
  const rowsInCol = 2 ** col;
  const slotHeight = totalCanvasHeight() / rowsInCol;
  const y = slotHeight * row + slotHeight / 2 - NODE_H / 2;
  const x = col * (NODE_W + COL_GAP);
  return { x, y };
}

// ---------------------------------------------------------------------------
// Fetch: walk up the lineage up to GENERATIONS-1 levels
// ---------------------------------------------------------------------------
// Returns a flat map { "col,row" -> nodeData } where nodeData is one of:
//   { kind: 'gecko', gecko }
//   { kind: 'text',  label }   (free-text sire/dam name, no linked record)
//   { kind: 'empty' }          (no parent recorded at all)
async function buildPedigreeGrid(rootId) {
  const grid = new Map();
  const cache = new Map();

  async function fetchGecko(id) {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);
    try {
      const g = await Gecko.get(id);
      cache.set(id, g);
      return g;
    } catch {
      cache.set(id, null);
      return null;
    }
  }

  async function place(col, row, geckoId, parentTextSire, parentTextDam) {
    const key = `${col},${row}`;

    let node;
    if (geckoId) {
      const gecko = await fetchGecko(geckoId);
      if (gecko) {
        node = { kind: 'gecko', gecko };
      } else {
        node = { kind: 'empty' };
      }
    } else {
      // No FK — we may still have a free-text sire_name / dam_name we can
      // show as a text card.
      const fromParent =
        (row % 2 === 0 ? parentTextSire : parentTextDam) || null;
      node = fromParent ? { kind: 'text', label: fromParent } : { kind: 'empty' };
    }
    grid.set(key, node);

    // Recurse into parents if we still have generations left.
    if (col < GENERATIONS - 1) {
      const nextCol = col + 1;
      const sireRow = row * 2;
      const damRow = row * 2 + 1;
      if (node.kind === 'gecko') {
        await Promise.all([
          place(
            nextCol,
            sireRow,
            node.gecko.sire_id,
            node.gecko.sire_name,
            node.gecko.dam_name
          ),
          place(
            nextCol,
            damRow,
            node.gecko.dam_id,
            node.gecko.sire_name,
            node.gecko.dam_name
          ),
        ]);
      } else {
        // Fill with empty slots so the grid stays rectangular — keeps the
        // connector geometry simple.
        await Promise.all([
          place(nextCol, sireRow, null),
          place(nextCol, damRow, null),
        ]);
      }
    }
  }

  await place(0, 0, rootId);
  return grid;
}

// ---------------------------------------------------------------------------
// Node card — rendered as foreignObject so HTML + image works inside SVG
// ---------------------------------------------------------------------------
function NodeCard({ node, x, y, onClick }) {
  if (!node || node.kind === 'empty') {
    return (
      <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
        <div className="w-full h-full rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/40 flex items-center justify-center text-xs text-slate-600 uppercase tracking-widest">
          Unknown
        </div>
      </foreignObject>
    );
  }

  if (node.kind === 'text') {
    // Free-text breeder / parent name — make it linkable if it looks like
    // a breeder reference (re-uses the breederUtils heuristic).
    const slug =
      looksLikeBreederName(node.label) ? breederSlug(node.label) : null;
    const inner = (
      <div className="w-full h-full rounded-xl border border-slate-700 bg-slate-900/80 p-3 flex flex-col justify-center">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
          Breeder reference
        </p>
        <p className="text-sm font-semibold text-slate-100 line-clamp-2">
          {node.label}
        </p>
      </div>
    );
    return (
      <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
        {slug ? (
          <Link
            to={`/Breeder?slug=${slug}`}
            className="block w-full h-full hover:border-emerald-500/50 transition-colors"
          >
            {inner}
          </Link>
        ) : (
          inner
        )}
      </foreignObject>
    );
  }

  // Real gecko card
  const g = node.gecko;
  const img = g.image_urls?.[0] || DEFAULT_GECKO_IMAGE;
  const sex = g.sex === 'Male' ? '♂' : g.sex === 'Female' ? '♀' : '?';
  const sexColor =
    g.sex === 'Male'
      ? 'text-blue-300'
      : g.sex === 'Female'
      ? 'text-pink-300'
      : 'text-slate-400';

  return (
    <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
      <button
        type="button"
        onClick={() => onClick?.(g)}
        className="w-full h-full rounded-xl border border-slate-700 bg-slate-900/90 hover:border-emerald-500/60 hover:bg-slate-900 transition-all flex overflow-hidden text-left shadow-lg shadow-black/30"
      >
        <div className="w-24 h-full flex-shrink-0 bg-slate-800">
          <img
            src={img}
            alt={g.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-1 mb-1">
            <p className="text-sm font-bold text-white leading-tight truncate">
              {g.name || 'Unnamed'}
            </p>
            <span className={`text-base font-bold ${sexColor}`}>{sex}</span>
          </div>
          {g.gecko_id_code && (
            <p className="text-[10px] text-slate-500 truncate mb-1">
              {g.gecko_id_code}
            </p>
          )}
          {Array.isArray(g.morph_tags) && g.morph_tags.length > 0 && (
            <p className="text-[10px] text-emerald-300 truncate leading-tight">
              {g.morph_tags.slice(0, 2).join(', ')}
            </p>
          )}
        </div>
      </button>
    </foreignObject>
  );
}

// ---------------------------------------------------------------------------
// Connector — smooth horizontal Bezier from child's right edge to parent's left
// ---------------------------------------------------------------------------
function Connector({ from, to }) {
  const startX = from.x + NODE_W;
  const startY = from.y + NODE_H / 2;
  const endX = to.x;
  const endY = to.y + NODE_H / 2;
  const midX = (startX + endX) / 2;
  const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  return (
    <path
      d={path}
      fill="none"
      stroke="rgba(16, 185, 129, 0.45)"
      strokeWidth={1.5}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Pedigree() {
  const location = useLocation();
  const navigate = useNavigate();
  const svgRef = useRef(null);

  const geckoId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('geckoId') || params.get('id');
  }, [location.search]);

  const [grid, setGrid] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!geckoId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const g = await buildPedigreeGrid(geckoId);
        if (!cancelled) setGrid(g);
      } catch (err) {
        if (!cancelled) setErrorMsg(err.message || 'Failed to load pedigree');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geckoId]);

  const rootGecko = useMemo(() => {
    const node = grid?.get('0,0');
    return node?.kind === 'gecko' ? node.gecko : null;
  }, [grid]);

  // Build connector list: every non-empty node with row>0 in its column has
  // a child at (col-1, floor(row/2)) we should connect to.
  const connectors = useMemo(() => {
    if (!grid) return [];
    const list = [];
    for (const [key, node] of grid.entries()) {
      if (!node || node.kind === 'empty') continue;
      const [col, row] = key.split(',').map(Number);
      if (col === 0) continue;
      const childKey = `${col - 1},${Math.floor(row / 2)}`;
      const childNode = grid.get(childKey);
      if (!childNode || childNode.kind === 'empty') continue;
      const from = nodeXY(col - 1, Math.floor(row / 2));
      const to = nodeXY(col, row);
      list.push({ key: `${childKey}->${key}`, from, to });
    }
    return list;
  }, [grid]);

  const handleNodeClick = useCallback(
    (gecko) => {
      if (!gecko?.id) return;
      // Recenter the pedigree on the clicked gecko
      navigate(`/Pedigree?geckoId=${gecko.id}`);
    },
    [navigate]
  );

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current.cloneNode(true);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedigree-${rootGecko?.name || rootGecko?.id || 'gecko'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Missing geckoId param ---
  if (!geckoId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-4">
          <GitBranch className="w-12 h-12 text-slate-600 mx-auto" />
          <h1 className="text-2xl font-bold">No gecko selected</h1>
          <p className="text-slate-400">
            Add a <code>?geckoId=</code> query parameter to view a gecko&rsquo;s pedigree.
          </p>
          <Link to={createPageUrl('MyGeckos')}>
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              Browse your geckos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // --- Error / not found ---
  if (errorMsg || !rootGecko) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-4">
          <GitBranch className="w-12 h-12 text-slate-600 mx-auto" />
          <h1 className="text-2xl font-bold">Pedigree not available</h1>
          <p className="text-slate-400">
            {errorMsg || "We couldn't load this gecko's lineage."}
          </p>
          <Link to={createPageUrl('MyGeckos')}>
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Geckos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canvasW = totalCanvasWidth();
  const canvasH = totalCanvasHeight();

  return (
    <>
      <Seo
        title={`Pedigree — ${rootGecko.name || 'Crested Gecko'}`}
        description={`Multi-generation pedigree chart for ${rootGecko.name || 'this crested gecko'}, showing sire, dam, grandparents, and great-grandparents with photos and morph tags.`}
        path={`/Pedigree?geckoId=${rootGecko.id}`}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Header */}
        <header className="border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Link
                to={createPageUrl(`GeckoDetail?id=${rootGecko.id}`)}
                className="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
                title="Back to gecko detail"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-slate-500">
                  Pedigree
                </p>
                <h1 className="text-lg md:text-xl font-bold text-white truncate">
                  {rootGecko.name || 'Unnamed gecko'}
                </h1>
              </div>
            </div>

            {/* Zoom + download controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
                className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-400 w-10 text-center tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(1)}
                className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                title="Reset zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadSVG}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                title="Download pedigree as SVG"
              >
                <Download className="w-4 h-4 mr-2" />
                SVG
              </Button>
            </div>
          </div>

          {/* Generation labels */}
          <div className="max-w-7xl mx-auto px-6 pb-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-500">
            <span className="text-emerald-300">Self</span>
            <span>·</span>
            <span>Parents</span>
            <span>·</span>
            <span>Grandparents</span>
            <span>·</span>
            <span>Great-grandparents</span>
          </div>
        </header>

        {/* Pedigree canvas — horizontally scrollable, SVG scales with zoom */}
        <div className="flex-1 overflow-auto p-6">
          <div
            style={{
              width: canvasW * scale,
              height: canvasH * scale,
              margin: '0 auto',
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              width={canvasW * scale}
              height={canvasH * scale}
              xmlns="http://www.w3.org/2000/svg"
              className="block"
            >
              {/* Subtle background grid (pure decoration) */}
              <defs>
                <pattern
                  id="pedigree-grid"
                  x="0"
                  y="0"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="20" cy="20" r="1" fill="rgba(148,163,184,0.12)" />
                </pattern>
              </defs>
              <rect width={canvasW} height={canvasH} fill="url(#pedigree-grid)" />

              {/* Connectors first so cards paint over them */}
              {connectors.map((c) => (
                <Connector key={c.key} from={c.from} to={c.to} />
              ))}

              {/* Nodes */}
              {grid &&
                Array.from(grid.entries()).map(([key, node]) => {
                  const [col, row] = key.split(',').map(Number);
                  const { x, y } = nodeXY(col, row);
                  return (
                    <NodeCard
                      key={key}
                      node={node}
                      x={x}
                      y={y}
                      onClick={handleNodeClick}
                    />
                  );
                })}
            </svg>
          </div>
        </div>

        {/* Footer help text */}
        <footer className="border-t border-slate-800/50 bg-slate-950 px-6 py-4 text-xs text-slate-500 text-center">
          Click any gecko to re-center the pedigree on it. Free-text breeder
          references (Altitude Exotics, etc.) link to their breeder page.
          Hit the SVG button to download for print.
        </footer>
      </div>
    </>
  );
}
