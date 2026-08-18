/**
 * Dynamic Open Graph image for shared pairing links.
 *
 * GET /api/og-pairing?s=<sire label>&d=<dam label>&o=<label~pct|label~pct|...>
 *
 * Rendered at the edge with @vercel/og (Satori) so /api/share pages
 * unfurl as rich cards in Discord, Facebook, and Messenger. Element
 * trees are plain objects (Satori's format) because this is a .js
 * file with no JSX transform.
 */
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length === 1 ? children[0] : children },
});

const clip = (text, max) =>
  text && text.length > max ? `${text.slice(0, max - 3)}...` : text || '';

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const sire = clip(searchParams.get('s') || 'Wild-type', 60);
  const dam = clip(searchParams.get('d') || 'Wild-type', 60);
  const outcomes = (searchParams.get('o') || '')
    .split('|')
    .map((pair) => {
      const idx = pair.lastIndexOf('~');
      if (idx === -1) return null;
      return { label: clip(pair.slice(0, idx), 46), pct: clip(pair.slice(idx + 1), 8) };
    })
    .filter(Boolean)
    .slice(0, 4);

  const rows = outcomes.map((o, i) =>
    el(
      'div',
      {
        key: String(i),
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#1E293B',
          borderRadius: 12,
          padding: '14px 24px',
          marginBottom: 12,
        },
      },
      el('span', { style: { color: '#E2E8F0', fontSize: 30 } }, o.label),
      el('span', { style: { color: '#34D399', fontSize: 30, fontWeight: 700 } }, o.pct),
    ),
  );

  return new ImageResponse(
    el(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0F172A',
          padding: '48px 60px',
          fontFamily: 'sans-serif',
        },
      },
      el(
        'div',
        { style: { color: '#A78BFA', fontSize: 24, letterSpacing: 2, marginBottom: 18 } },
        'GECK INSPECT · CLUTCH ODDS',
      ),
      el(
        'div',
        { style: { display: 'flex', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' } },
        el('span', { style: { color: '#93C5FD', fontSize: 44, fontWeight: 700 } }, sire),
        el('span', { style: { color: '#64748B', fontSize: 40, margin: '0 14px' } }, 'x'),
        el('span', { style: { color: '#F9A8D4', fontSize: 44, fontWeight: 700 } }, dam),
      ),
      el(
        'div',
        { style: { color: '#94A3B8', fontSize: 24, marginBottom: 28 } },
        'Per-egg odds from exact Punnett math',
      ),
      el('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1 } }, ...rows),
      el(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid #334155',
            paddingTop: 22,
          },
        },
        el('span', { style: { color: '#E2E8F0', fontSize: 26, fontWeight: 600 } }, 'geckinspect.com/calculator'),
        el('span', { style: { color: '#64748B', fontSize: 24 } }, 'free crested gecko genetics calculator'),
      ),
    ),
    { width: 1200, height: 630 },
  );
}
