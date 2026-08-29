import { describe, it, expect } from 'vitest';
import { computeAnchoredPosition, ANCHOR_MARGIN } from '../anchoredPosition';

const M = ANCHOR_MARGIN;

/** Assert a panel sits entirely inside the viewport. */
function expectInsideViewport(pos, panel, viewport) {
  expect(pos.left).toBeGreaterThanOrEqual(M);
  expect(pos.top).toBeGreaterThanOrEqual(M);
  expect(pos.left + Math.min(panel.width, pos.maxWidth)).toBeLessThanOrEqual(viewport.width - M);
  expect(pos.top + Math.min(panel.height, pos.maxHeight)).toBeLessThanOrEqual(viewport.height - M);
}

describe('the gear button on mobile: a left-edge anchor keeps its panel on screen', () => {
  // The reported bug. On the Breeding/Hatchery page the settings gear is the
  // first item in a full-width toolbar row, so on a phone it sits at the far
  // left. Right-aligning the panel with the gear put its left edge at roughly
  // -240px, leaving only a sliver visible on the left of the screen.
  const viewport = { width: 390, height: 750 };
  const panel = { width: 288, height: 300 }; // w-72 settings panel
  const anchor = { top: 118, bottom: 150, right: 48 }; // h-8 w-8 gear at the left

  const pos = computeAnchoredPosition({ anchor, panel, viewport });

  it('does not run off the left edge', () => {
    expect(pos.left).toBe(M);
  });

  it('opens below the gear', () => {
    expect(pos.top).toBe(anchor.bottom + M);
  });

  it('sits entirely inside the viewport', () => {
    expectInsideViewport(pos, panel, viewport);
  });
});

describe('horizontal placement', () => {
  const viewport = { width: 1440, height: 900 };
  const panel = { width: 288, height: 300 };

  it('right-aligns with the anchor when there is room', () => {
    const anchor = { top: 100, bottom: 132, right: 900 };
    const pos = computeAnchoredPosition({ anchor, panel, viewport });
    expect(pos.left).toBe(900 - 288);
  });

  it('clamps at the right edge when the anchor is flush right', () => {
    const anchor = { top: 100, bottom: 132, right: viewport.width };
    const pos = computeAnchoredPosition({ anchor, panel, viewport });
    expect(pos.left).toBe(viewport.width - 288 - M);
    expectInsideViewport(pos, panel, viewport);
  });

  it('keeps a wide panel on a narrow phone inside the viewport', () => {
    // w-80 notification popover on a 320px phone, capped by maxWidth.
    const narrow = { width: 320, height: 700 };
    const wide = { width: 320, height: 400 };
    const anchor = { top: 40, bottom: 72, right: 300 };
    const pos = computeAnchoredPosition({ anchor, panel: wide, viewport: narrow });
    expect(pos.maxWidth).toBe(narrow.width - M * 2);
    expectInsideViewport(pos, wide, narrow);
  });
});

describe('vertical placement', () => {
  const viewport = { width: 390, height: 750 };
  const panel = { width: 288, height: 300 };

  it('flips above the anchor when there is no room below', () => {
    const anchor = { top: 600, bottom: 632, right: 300 };
    const pos = computeAnchoredPosition({ anchor, panel, viewport });
    expect(pos.top).toBe(600 - M - 300);
    expectInsideViewport(pos, panel, viewport);
  });

  it('caps the height when the panel is taller than the viewport', () => {
    const tall = { width: 288, height: 2000 };
    const anchor = { top: 118, bottom: 150, right: 48 };
    const pos = computeAnchoredPosition({ anchor, panel: tall, viewport });
    expect(pos.top).toBe(M);
    expect(pos.maxHeight).toBe(viewport.height - M * 2);
    expectInsideViewport(pos, tall, viewport);
  });
});

describe('every anchor position on a phone stays inside the viewport', () => {
  // Sweep the anchor across the whole screen. Regardless of where the trigger
  // button lands, the panel it opens must remain fully visible.
  const viewport = { width: 390, height: 750 };
  const panel = { width: 288, height: 300 };

  for (let right = 0; right <= viewport.width; right += 15) {
    for (let top = 0; top <= viewport.height; top += 50) {
      it(`anchor at right=${right}, top=${top}`, () => {
        const anchor = { top, bottom: top + 32, right };
        const pos = computeAnchoredPosition({ anchor, panel, viewport });
        expectInsideViewport(pos, panel, viewport);
      });
    }
  }
});
