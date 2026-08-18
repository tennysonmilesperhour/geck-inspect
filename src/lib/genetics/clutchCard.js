/**
 * Clutch card: render a pairing's odds to a downloadable PNG.
 *
 * Reptile communities live in Facebook groups and Discord servers
 * where screenshots travel further than links (the Enka.network
 * lesson), so the card is drawn fully client-side on a canvas: no
 * server, no fonts to load, works offline. 1200x675 (16:9) so it
 * posts clean everywhere.
 */
import { pct } from './clutchMath';

const W = 1200;
const H = 675;

const COLORS = {
  bg: '#0F172A',
  panel: '#1E293B',
  line: '#334155',
  ink: '#F1F5F9',
  soft: '#94A3B8',
  faint: '#64748B',
  accent: '#A78BFA',
  good: '#34D399',
  bad: '#F87171',
  sire: '#93C5FD',
  dam: '#F9A8D4',
  eggEmpty: '#293548',
  eggStroke: '#3E4C63',
};

function egg(ctx, x, y, w, h, fill, stroke) {
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(`${t}...`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}...`;
}

/**
 * Draw the card. `outcomes` is the merged offspring list (label,
 * probability, health_risk); `eggs` is the season egg count.
 */
export function drawClutchCard(canvas, { sireLabel, damLabel, outcomes, eggs }) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // Ground
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = COLORS.accent;
  ctx.font = `600 22px ${sans}`;
  ctx.fillText('GECK INSPECT · CLUTCH ODDS', 60, 66);

  // Pairing line
  ctx.font = `700 40px ${sans}`;
  const sireText = truncate(ctx, sireLabel || 'Wild-type', 480);
  ctx.fillStyle = COLORS.sire;
  ctx.fillText(sireText, 60, 126);
  const sw = ctx.measureText(sireText).width;
  ctx.fillStyle = COLORS.faint;
  ctx.fillText(' x ', 60 + sw, 126);
  const xw = ctx.measureText(' x ').width;
  ctx.fillStyle = COLORS.dam;
  ctx.fillText(truncate(ctx, damLabel || 'Wild-type', W - 140 - sw - xw), 60 + sw + xw, 126);

  ctx.fillStyle = COLORS.soft;
  ctx.font = `400 22px ${sans}`;
  ctx.fillText(`Per-egg odds · a season of ${eggs} eggs (2-egg clutches)`, 60, 164);

  // Outcome rows
  const rows = outcomes.slice(0, 5);
  const top = 210;
  const rowH = 74;
  const barX = 60;
  const barW = 780;
  rows.forEach((o, i) => {
    const y = top + i * rowH;
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(barX, y, barW, rowH - 14);
    const isLethal = o.health_risk === 'lethal';
    ctx.fillStyle = isLethal ? COLORS.bad : COLORS.good;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(barX, y, Math.max(barW * o.probability, 8), rowH - 14);
    ctx.globalAlpha = 1;

    ctx.font = `600 26px ${sans}`;
    ctx.fillStyle = isLethal ? COLORS.bad : COLORS.ink;
    ctx.fillText(truncate(ctx, o.label + (isLethal ? ' (non-viable)' : ''), barW - 160), barX + 18, y + 38);

    ctx.font = `700 26px ${sans}`;
    ctx.fillStyle = COLORS.ink;
    const p = pct(o.probability);
    ctx.fillText(p, barX + barW - ctx.measureText(p).width - 18, y + 38);
  });

  // Egg array for the top non-wild outcome
  const featured = outcomes.find((o) => o.label !== 'Wild-type') || outcomes[0];
  if (featured) {
    const ax = 900;
    let ay = 220;
    ctx.font = `600 24px ${sans}`;
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(truncate(ctx, featured.label, 240), ax, ay);
    ctx.font = `400 20px ${sans}`;
    ctx.fillStyle = COLORS.soft;
    const expected = Math.round(featured.probability * eggs * 10) / 10;
    ctx.fillText(`expect about ${expected} of ${eggs} eggs`, ax, ay + 30);

    ay += 56;
    const cols = 4;
    const size = 44;
    const gap = 14;
    const hits = Math.round(featured.probability * eggs);
    const shown = Math.min(eggs, 16);
    const shownHits = Math.min(Math.round((hits / eggs) * shown), shown);
    // Deterministic scatter: mark every kth egg.
    const marks = new Set();
    if (shownHits > 0) {
      const step = shown / shownHits;
      for (let i = 0; i < shownHits; i++) marks.add(Math.floor(i * step + step / 2) % shown);
    }
    for (let i = 0; i < shown; i++) {
      const cx = ax + (i % cols) * (size + gap);
      const cy = ay + Math.floor(i / cols) * (size * 1.25 + gap);
      const hit = marks.has(i);
      egg(
        ctx,
        cx,
        cy,
        size,
        size * 1.25,
        hit ? COLORS.good : COLORS.eggEmpty,
        hit ? null : COLORS.eggStroke,
      );
    }
  }

  // Footer
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, H - 72);
  ctx.lineTo(W - 60, H - 72);
  ctx.stroke();
  ctx.font = `600 22px ${sans}`;
  ctx.fillStyle = COLORS.ink;
  ctx.fillText('geckinspect.com/calculator', 60, H - 32);
  ctx.font = `400 20px ${sans}`;
  ctx.fillStyle = COLORS.faint;
  const tag = 'free crested gecko genetics calculator';
  ctx.fillText(tag, W - 60 - ctx.measureText(tag).width, H - 32);
}

/** Draw to an offscreen canvas and trigger a PNG download. */
export function downloadClutchCard(opts, filename = 'clutch-odds.png') {
  const canvas = document.createElement('canvas');
  drawClutchCard(canvas, opts);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
