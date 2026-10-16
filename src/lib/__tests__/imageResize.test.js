import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  convertHeicForUpload,
  downscaleImage,
  isHeicFile,
  makeThumbnail,
  RESIZE_DEFAULTS,
  targetDimensions,
  THUMBNAIL,
} from '../imageResize';

vi.mock('heic-to/csp', () => ({
  heicTo: vi.fn(async () => new Blob(['jpeg-bytes'], { type: 'image/jpeg' })),
}));

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

describe('HEIC upload normalization', () => {
  it('detects HEIC and HEIF from MIME types or filenames', () => {
    expect(isHeicFile({ type: 'image/heic', name: 'photo' })).toBe(true);
    expect(isHeicFile({ type: '', name: 'IMG_1234.HEIF' })).toBe(true);
    expect(isHeicFile({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
  });

  it('converts HEIC to a JPEG File for preview and upload', async () => {
    const source = new File(['heic-bytes'], 'IMG_1234.HEIC', {
      type: 'image/heic',
      lastModified: 123,
    });
    const converted = await convertHeicForUpload(source);

    expect(converted).toBeInstanceOf(File);
    expect(converted.name).toBe('IMG_1234.jpg');
    expect(converted.type).toBe('image/jpeg');
    expect(converted.lastModified).toBe(123);
  });

  it('does not load or alter ordinary image files', async () => {
    const source = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    expect(await convertHeicForUpload(source)).toBe(source);
  });
});

describe('downscaleImage format safety (browser canvas mocked)', () => {
  const stubCanvas = (outBytes) => {
    vi.stubGlobal('HTMLCanvasElement', function HTMLCanvasElement() {});
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })));
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() {} }),
        toBlob: (cb, type) => cb(new Blob([new Uint8Array(outBytes)], { type })),
      }),
    });
  };
  const small = (type, size) => new File([new Uint8Array(size)], `photo.${type.split('/')[1]}`, { type });

  it('re-encodes a small AVIF to WebP so the Morph ID analyzer can read it', async () => {
    stubCanvas(5000);
    const out = await downscaleImage(small('image/avif', 2000));
    expect(out.type).toBe('image/webp');
    expect(out.name).toBe('photo.webp');
    vi.unstubAllGlobals();
  });

  it('still keeps a small JPEG as is', async () => {
    stubCanvas(5000);
    const jpg = small('image/jpeg', 2000);
    expect(await downscaleImage(jpg)).toBe(jpg);
    vi.unstubAllGlobals();
  });
});

// A canvas whose toBlob ignores the requested type for WebP and returns a
// PNG, the way Safari does, and records every type asked for.
function stubCanvasWith({ width = 4000, height = 3000, webp = true, bytes = 30_000, failDecode = false } = {}) {
  const asked = [];
  const drawn = [];
  vi.stubGlobal('HTMLCanvasElement', function HTMLCanvasElement() {});
  vi.stubGlobal('createImageBitmap', vi.fn(async () => {
    if (failDecode) throw new Error('cannot decode');
    return { width, height, close() {} };
  }));
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => drawn.push([canvas.width, canvas.height]) }),
        toBlob: (cb, type) => {
          asked.push(type);
          const out = type === 'image/webp' && !webp ? 'image/png' : type;
          const size = out === 'image/png' ? bytes * 8 : bytes;
          cb(new Blob([new Uint8Array(size)], { type: out }));
        },
      };
      return canvas;
    },
  });
  return { asked, drawn };
}
const photo = (type, size, name = 'IMG_7140.jpg') => new File([new Uint8Array(size)], name, { type });

describe('browsers that cannot write WebP (Safari)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores a JPEG photo as JPEG instead of a mislabelled PNG', async () => {
    const { asked } = stubCanvasWith({ webp: false });
    const out = await downscaleImage(photo('image/jpeg', 3_000_000));
    expect(asked).toEqual(['image/webp', 'image/jpeg']);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('IMG_7140.jpg');
  });

  it('labels a PNG source honestly when it stays PNG', async () => {
    stubCanvasWith({ webp: false });
    const out = await downscaleImage(photo('image/png', 9_000_000, 'shot.png'));
    expect(out.type).toBe('image/png');
    expect(out.name).toBe('shot.png');
  });

  it('keeps WebP where the browser can write it', async () => {
    const { asked } = stubCanvasWith({ webp: true });
    const out = await downscaleImage(photo('image/jpeg', 3_000_000));
    expect(asked).toEqual(['image/webp']);
    expect(out.type).toBe('image/webp');
    expect(out.name).toBe('IMG_7140.webp');
  });
});

describe('makeThumbnail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws the long edge at the thumbnail size and encodes WebP at the thumbnail quality', async () => {
    const { drawn } = stubCanvasWith({ width: 1600, height: 1200 });
    const out = await makeThumbnail(photo('image/webp', 300_000, 'p.webp'));
    expect(drawn).toEqual([[THUMBNAIL.maxEdge, 360]]);
    expect(out).toBeInstanceOf(File);
    expect(out.type).toBe('image/webp');
    expect(out.size).toBeLessThan(300_000);
  });

  it('passes the thumbnail quality to the encoder', async () => {
    stubCanvasWith();
    const qualities = [];
    const canvasFactory = document.createElement;
    vi.stubGlobal('document', {
      createElement: () => {
        const canvas = canvasFactory();
        const toBlob = canvas.toBlob;
        canvas.toBlob = (cb, type, quality) => { qualities.push(quality); toBlob(cb, type, quality); };
        return canvas;
      },
    });
    await makeThumbnail(photo('image/jpeg', 300_000));
    expect(qualities).toEqual([THUMBNAIL.quality]);
  });

  it('still makes a thumbnail for a photo already smaller than the thumbnail size', async () => {
    const { drawn } = stubCanvasWith({ width: 300, height: 200 });
    const out = await makeThumbnail(photo('image/png', 40_000, 'tiny.png'));
    expect(drawn).toEqual([[300, 200]]);
    expect(out.type).toBe('image/webp');
  });

  it('falls back to JPEG where WebP cannot be written, whatever the source', async () => {
    stubCanvasWith({ webp: false });
    const out = await makeThumbnail(photo('image/png', 400_000, 'shot.png'));
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('shot.jpg');
  });

  it('makes no thumbnail for GIFs, non-images, undecodable photos or without a canvas', async () => {
    expect(await makeThumbnail(photo('image/jpeg', 1000))).toBeNull(); // node: no canvas
    stubCanvasWith();
    expect(await makeThumbnail(photo('image/gif', 1000, 'dance.gif'))).toBeNull();
    expect(await makeThumbnail(photo('application/pdf', 1000, 'a.pdf'))).toBeNull();
    expect(await makeThumbnail(null)).toBeNull();
    vi.unstubAllGlobals();
    stubCanvasWith({ failDecode: true });
    expect(await makeThumbnail(photo('image/jpeg', 1000))).toBeNull();
  });
});
