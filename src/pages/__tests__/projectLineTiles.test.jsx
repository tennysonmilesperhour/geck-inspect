// Each project line page shows up to four "Related morph traits" tiles.
// A tile with no member photo falls back to the morph's painted field
// guide plate, so a morph with no plate (Super Lilly White, related to the
// Lilly White ACR line) would show a broken image. Such a morph keeps its
// link in the list further down the page instead.
import { existsSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PROJECT_LINES } from '@/data/project-lines';

vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null, addEventListener() {}, removeEventListener() {} }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/posthog', () => ({ captureEvent: () => {} }));

const { default: ProjectLineDetail } = await import('@/pages/ProjectLineDetail');

function page(slug) {
  return renderToStaticMarkup(
    <HelmetProvider context={{}}>
      <MemoryRouter initialEntries={[`/MorphGuide/lines/${slug}`]}>
        <Routes>
          <Route path="/MorphGuide/lines/:slug" element={<ProjectLineDetail />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('project line related-morph tiles', () => {
  it('shows only pictures that exist, on every line page', () => {
    for (const line of PROJECT_LINES) {
      const html = page(line.slug);
      const plates = [...html.matchAll(/src="(\/morph-guide\/field-guide-v1\/[^"]+)"/g)].map((m) => m[1]);
      for (const src of plates) expect(existsSync(`public${src}`), `${line.slug}: ${src}`).toBe(true);
    }
  });

  it('keeps Super Lilly White as a link on the Lilly White ACR page, without a tile', () => {
    const line = PROJECT_LINES.find((l) => (l.relatedMorphs || []).includes('super-lilly-white'));
    expect(line).toBeTruthy();
    const html = page(line.slug);
    expect(html).not.toContain('field-guide-v1/super-lilly-white.webp');
    expect(html).toContain('href="/MorphGuide/super-lilly-white"');
  });
});
