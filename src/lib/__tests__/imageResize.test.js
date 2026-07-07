import { describe, it, expect } from 'vitest';
import { targetDimensions, downscaleImage, RESIZE_DEFAULTS } from '../imageResize';

describe('targetDimensions', () => {
  it('leaves images already within the long-edge limit unscaled', () => {
    expect(targetDimensions(1200, 800, 1600)).toEqual({ width: 1200, height: 800, scaled: false });
    expect(targetDimensions(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600, scaled: false });
  });

  it('scales a landscape image so the long edge equals maxEdge', () => {
    const r = targetDimensions(3200, 2400, 1600);
    expect(r.scaled).toBe(true);
    expect(r.width).toBe(1600);
    expect(r.height).toBe(1200);
  });

  it('scales a portrait image by its height (the long edge)', () => {
    const r = targetDimensions(2000, 4000, 1600);
    expect(r.scaled).toBe(true);
    expect(r.height).toBe(1600);
    expect(r.width).toBe(800);
  });

  it('never rounds a dimension below 1px', () => {
    const r = targetDimensions(4000, 3, 1600);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  it('handles zero dimensions without dividing by zero', () => {
    expect(targetDimensions(0, 0, 1600)).toEqual({ width: 0, height: 0, scaled: false });
  });

  it('exposes sane defaults', () => {
    expect(RESIZE_DEFAULTS.maxEdge).toBe(1600);
    expect(RESIZE_DEFAULTS.quality).toBeGreaterThan(0);
    expect(RESIZE_DEFAULTS.quality).toBeLessThanOrEqual(1);
  });
});

describe('downscaleImage fail-safe fallbacks', () => {
  // In the vitest node environment there is no canvas/createImageBitmap,
  // so downscaleImage must return the original file untouched every time.
  const makeFile = (type, size = 5_000_000, name = 'photo.jpg') => ({
    type,
    size,
    name,
    lastModified: 0,
  });

  it('returns animated GIFs untouched', async () => {
    const gif = makeFile('image/gif');
    expect(await downscaleImage(gif)).toBe(gif);
  });

  it('returns non-image blobs untouched', async () => {
    const pdf = makeFile('application/pdf');
    expect(await downscaleImage(pdf)).toBe(pdf);
  });

  it('returns the original when the canvas APIs are unavailable (SSR/node)', async () => {
    const jpg = makeFile('image/jpeg');
    expect(await downscaleImage(jpg)).toBe(jpg);
  });

  it('handles null/undefined input without throwing', async () => {
    expect(await downscaleImage(null)).toBeNull();
    expect(await downscaleImage(undefined)).toBeUndefined();
  });
});
