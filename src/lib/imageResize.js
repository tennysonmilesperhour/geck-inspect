/**
 * Client-side image downscaling for uploads.
 *
 * Gecko photos are the app's dominant content and were being stored at
 * full camera resolution (up to the 10 MB cap) and served as-is, which
 * is the biggest storage + egress cost driver and a mobile LCP hazard.
 * This module downscales an image to a sane ceiling and re-encodes it to
 * WebP in the browser before it is ever uploaded. It also makes the
 * small thumbnail stored beside each photo (makeThumbnail, below).
 *
 * It is deliberately fail-safe: animated GIFs, already-small files,
 * non-DOM contexts (SSR/prerender), and any decode/encode error all fall
 * back to returning the original File untouched. Resizing must never
 * block an upload.
 */
import { THUMBNAIL } from '@/lib/photoThumbnails';

export { THUMBNAIL };

export const RESIZE_DEFAULTS = {
  maxEdge: 1600, // longest side, in CSS pixels
  quality: 0.82, // WebP quality
  skipUnderBytes: 400 * 1024, // don't bother re-encoding small files that are already within maxEdge
};

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

export function isHeicFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return HEIC_MIME_TYPES.has(type) || /\.(heic|heif)$/.test(name);
}

/**
 * Convert an iPhone HEIC/HEIF photo to a browser-safe JPEG before preview,
 * resizing, or upload. The decoder is loaded only for HEIC files so it does
 * not increase the normal application bundle.
 */
export async function convertHeicForUpload(file, { quality = 0.9 } = {}) {
  if (!isHeicFile(file)) return file;

  try {
    // The CSP build avoids unsafe-eval, which is required once F43 moves from
    // report-only to an enforcing Content-Security-Policy header.
    const { heicTo } = await import('heic-to/csp');
    const result = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality,
    });
    const jpeg = Array.isArray(result) ? result[0] : result;
    if (!(jpeg instanceof Blob) || jpeg.size === 0) {
      throw new Error('converter returned no image');
    }

    const baseName = String(file.name || 'photo').replace(/\.(heic|heif)$/i, '');
    return new File([jpeg], `${baseName || 'photo'}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch (error) {
    throw new Error(
      `This HEIC photo could not be converted. Try exporting it as JPEG or PNG. ${error?.message || ''}`.trim(),
    );
  }
}

/**
 * Pure helper: compute the target dimensions so the long edge is at most
 * maxEdge, preserving aspect ratio. Returns `scaled: false` when the
 * image is already within bounds.
 */
export function targetDimensions(width, height, maxEdge) {
  const longEdge = Math.max(width, height);
  if (!longEdge || longEdge <= maxEdge) {
    return { width, height, scaled: false };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

// Formats every consumer of an uploaded photo can read, including the
// Morph ID analyzer. Anything else is converted to WebP on upload.
const WIDELY_READ_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const EXTENSION_FOR = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

function canvasAvailable() {
  return (
    typeof document !== 'undefined' &&
    typeof createImageBitmap !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined'
  );
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Draw a decoded image at width x height and encode it, WebP first.
 *
 * Safari cannot write WebP from a canvas: asked for WebP, it quietly
 * returns a PNG, which for a photo is five to ten times larger. That is
 * where the 1 to 5 MB ".webp" photos in the bucket came from (77 of 167
 * in October 2026). When the browser ignores the WebP request, the image
 * is written as JPEG instead if `jpegFallback` allows it (a JPEG source
 * has no transparency to lose, and a thumbnail always sits on a solid
 * card). Returns null when nothing could be encoded.
 */
async function drawAndEncode(bitmap, width, height, quality, { jpegFallback }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  // An empty type means the browser did not say; take it as the WebP asked for.
  if (webp && (webp.type === 'image/webp' || !webp.type)) return webp;
  if (jpegFallback) {
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (jpeg && jpeg.type === 'image/jpeg') return jpeg;
  }
  return webp || null;
}

function renamed(name, type) {
  const base = String(name || 'image').replace(/\.[a-zA-Z0-9]+$/, '') || 'image';
  return `${base}.${EXTENSION_FOR[type] || 'webp'}`;
}

/**
 * Downscale + WebP-encode a File/Blob for upload. Returns a new File on
 * success, or the original file unchanged when resizing is skipped or
 * fails.
 *
 * @param {File|Blob} file
 * @param {object} [opts]: overrides for RESIZE_DEFAULTS
 * @returns {Promise<File|Blob>}
 */
export async function downscaleImage(file, opts = {}) {
  const { maxEdge, quality, skipUnderBytes } = { ...RESIZE_DEFAULTS, ...opts };

  // Not an image, or an animated GIF (canvas would flatten it to one
  // frame): leave it alone.
  if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  // Browser-only. In prerender/SSR or any environment without the canvas
  // and bitmap APIs, return the original untouched.
  if (!canvasAvailable()) return file;

  try {
    // `imageOrientation: 'from-image'` bakes in EXIF rotation so portrait
    // phone photos don't upload sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height, scaled } = targetDimensions(bitmap.width, bitmap.height, maxEdge);

    // AVIF, BMP and TIFF are always re-encoded: Morph ID's analyzer reads
    // only JPEG, PNG, WebP and GIF, and a small AVIF kept as is failed every
    // identification with "couldn't reach the analyzer".
    const mustReencode = !WIDELY_READ_TYPES.has(file.type);

    // Already small enough in both dimensions and bytes: keep the original.
    if (!scaled && !mustReencode && file.size <= skipUnderBytes) {
      bitmap.close?.();
      return file;
    }

    const blob = await drawAndEncode(bitmap, width, height, quality, {
      jpegFallback: file.type === 'image/jpeg',
    });
    bitmap.close?.();
    if (!blob) return file;

    // If the re-encode didn't actually shrink an unscaled image, keep the
    // original (avoids bloating tiny PNGs into larger WebPs).
    if (!scaled && !mustReencode && blob.size >= file.size) return file;

    const type = blob.type || 'image/webp';
    return new File([blob], renamed(file.name, type), {
      type,
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    // Any decode/encode failure: upload the original rather than fail.
    return file;
  }
}

/**
 * Make the small copy stored beside a photo (src/lib/photoThumbnails.js
 * has the size and the reasons). Returns a File, WebP where the browser
 * can write it and JPEG where it cannot, or null when no thumbnail can
 * be made: not an image, an animated GIF, no canvas (prerender, tests),
 * or a photo the browser cannot decode. Callers treat null as "no
 * thumbnail" and carry on; it never stops an upload.
 *
 * Unlike downscaleImage, a photo already within the size is still
 * re-encoded, so every photo that can have a thumbnail gets one and
 * small displays never ask for a missing file.
 *
 * @param {File|Blob} file: a browser-readable image (after HEIC conversion)
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<File|null>}
 */
export async function makeThumbnail(file, opts = {}) {
  const { maxEdge, quality } = { ...THUMBNAIL, ...opts };
  if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
    return null;
  }
  if (!canvasAvailable()) return null;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = targetDimensions(bitmap.width, bitmap.height, maxEdge);
    if (!width || !height) return null;
    const blob = await drawAndEncode(bitmap, width, height, quality, { jpegFallback: true });
    if (!blob || !blob.size) return null;
    const type = blob.type || 'image/webp';
    return new File([blob], renamed(file.name, type), {
      type,
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return null;
  } finally {
    bitmap?.close?.();
  }
}
