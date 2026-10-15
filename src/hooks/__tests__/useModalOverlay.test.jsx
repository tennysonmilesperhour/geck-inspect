import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { shouldCloseOnEscape } from '../useModalOverlay';

// src/lib/utils.js reads window.self at import time; tests run in Node.
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/entities/all', () => ({
  WeightRecord: { create: vi.fn() },
  Gecko: { update: vi.fn(), filter: vi.fn(async () => []) },
  OtherReptile: { create: vi.fn(), update: vi.fn() },
}));
vi.mock('@/integrations/Core', () => ({ UploadFile: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
// framer-motion needs a real browser once window exists; a plain element
// is enough to read the overlay's attributes.
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await vi.importActual('react');
  const plain = (tag) => forwardRef(function Plain({ initial: _i, animate: _a, exit: _e, transition: _t, ...rest }, ref) {
    return createElement(tag, { ref, ...rest });
  });
  return {
    motion: new Proxy({}, { get: (_, tag) => plain(tag) }),
    AnimatePresence: ({ children }) => children,
  };
});

// A stand-in for the page: a list of elements in document order. Each fake
// element knows its index, which is all compareDocumentPosition needs here.
function fakePage(count) {
  const els = Array.from({ length: count }, (_, i) => ({
    i,
    compareDocumentPosition(other) {
      return other.i > this.i ? 4 : 2; // FOLLOWING : PRECEDING
    },
  }));
  return {
    els,
    doc: (open) => ({ querySelectorAll: () => open }),
  };
}

const esc = (extra = {}) => ({ key: 'Escape', defaultPrevented: false, ...extra });

describe('Escape on a hand-built overlay', () => {
  it('closes the overlay when it is the top layer', () => {
    const { els, doc } = fakePage(2);
    expect(shouldCloseOnEscape(esc(), els[1], doc([els[0], els[1]]))).toBe(true);
  });

  it('leaves Escape to a dialog or menu opened above it', () => {
    const { els, doc } = fakePage(3);
    // els[2] is a Radix dialog or popover portaled after the overlay.
    expect(shouldCloseOnEscape(esc(), els[1], doc([els[1], els[2]]))).toBe(false);
  });

  it('ignores a key another layer already handled, and other keys', () => {
    const { els, doc } = fakePage(1);
    expect(shouldCloseOnEscape(esc({ defaultPrevented: true }), els[0], doc([els[0]]))).toBe(false);
    expect(shouldCloseOnEscape({ key: 'Enter' }, els[0], doc([els[0]]))).toBe(false);
    expect(shouldCloseOnEscape(esc(), null, doc([]))).toBe(false);
  });
});

// The rule in src/index.css that hides the feedback tab, the guest notice
// and feeding alerts only fires for [role="dialog"][data-state="open"].
// These overlays used to have neither, so the widgets covered Cancel and
// Save (Weigh-in mode on a phone).
const OPEN_DIALOG = /role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/;

describe('hand-built overlays announce themselves as open dialogs', () => {
  it('Weigh-in mode', async () => {
    const { default: WeighInMode } = await import('@/components/my-geckos/WeighInMode');
    const html = renderToStaticMarkup(<WeighInMode geckos={[]} onClose={() => {}} />);
    expect(html).toMatch(OPEN_DIALOG);
    expect(html).toContain('data-state="open"');
    expect(html).toContain('aria-label="Weigh-in"');
  });

  it('the buyer inquiry form, only while open', async () => {
    const { default: BuyerInquiryModal } = await import('@/components/breeder/BuyerInquiryModal');
    const open = renderToStaticMarkup(<BuyerInquiryModal open onClose={() => {}} breederName="Lilly Lane" />);
    expect(open).toMatch(OPEN_DIALOG);
    expect(open).toContain('data-state="open"');
    expect(renderToStaticMarkup(<BuyerInquiryModal open={false} onClose={() => {}} />)).toBe('');
  });

  it('the reptile form', async () => {
    const { default: ReptileForm } = await import('@/components/other-reptiles/ReptileForm');
    const html = renderToStaticMarkup(<ReptileForm onSubmit={() => {}} onCancel={() => {}} />);
    expect(html).toMatch(OPEN_DIALOG);
    expect(html).toContain('data-state="open"');
  });

  it('every other hand-built overlay uses the shared hook or the dialog attributes', () => {
    const root = path.resolve(__dirname, '../..');
    const files = [
      'components/my-geckos/GeckoDetailModal.jsx',
      'components/marketplace/GeckoSelectionModal.jsx',
      'components/other-reptiles/ReptileDetailModal.jsx',
      'components/project-manager/ProjectCalendar.jsx',
      'pages/GeckoDetail.jsx',
      'pages/MarketplaceSalesStats.jsx',
      'pages/StorePage.jsx',
    ];
    for (const file of files) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      expect(text, file).toMatch(/useModalOverlay\(/);
    }
    const tutorial = fs.readFileSync(path.join(root, 'components/tutorial/TutorialModal.jsx'), 'utf8');
    expect(tutorial).toMatch(/role="dialog"[\s\S]{0,80}aria-modal="true"[\s\S]{0,80}data-state="open"/);
  });

  it('the closed phone menu is not a modal and is out of the Tab order', async () => {
    const { Sidebar, SidebarProvider } = await import('@/components/ui/Sidebar');
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SidebarProvider>
          <Sidebar>menu</Sidebar>
        </SidebarProvider>
      </MemoryRouter>,
    );
    expect(html).toContain('data-state="closed"');
    expect(html).toContain('inert=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('role="dialog"');
  });
});
