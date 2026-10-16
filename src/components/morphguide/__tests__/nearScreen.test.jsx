// @vitest-environment jsdom
// The Morph Guide's Field Notebook and eye guide mount only when a visitor
// scrolls near them, so visitors who stop at the morph grid never download
// them (src/components/morphguide/NearScreen.jsx).
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import NearScreen from '@/components/morphguide/NearScreen';

installDomHarness();

const original = globalThis.IntersectionObserver;
afterEach(() => {
  globalThis.IntersectionObserver = original;
  window.IntersectionObserver = original;
});

describe('NearScreen', () => {
  it('shows its section only once the spot comes near the screen', () => {
    const seen = [];
    class Observer {
      constructor(callback, options) { this.callback = callback; this.options = options; }
      observe(el) { seen.push(this); this.el = el; }
      disconnect() {}
    }
    globalThis.IntersectionObserver = Observer;
    window.IntersectionObserver = Observer;
    render(<NearScreen><p>Field Notebook</p></NearScreen>);
    expect(screen.queryByText('Field Notebook')).toBeNull();
    expect(seen[0].options.rootMargin).toBe('800px 0px');
    act(() => seen[0].callback([{ isIntersecting: true, target: seen[0].el }]));
    expect(screen.getByText('Field Notebook')).toBeTruthy();
  });

  it('shows its section at once where the browser cannot tell', () => {
    globalThis.IntersectionObserver = undefined;
    window.IntersectionObserver = undefined;
    render(<NearScreen><p>Field Notebook</p></NearScreen>);
    expect(screen.getByText('Field Notebook')).toBeTruthy();
  });
});
